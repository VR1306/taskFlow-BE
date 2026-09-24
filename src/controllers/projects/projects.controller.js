import mongoose from 'mongoose';
import { catchAsync, escapeRegex } from '../../helpers/helpers.js';
import Project from '../../models/projects/projects.model.js';
import Task from '../../models/tasks/tasks.model.js';
import GetAllUsers from '../../models/users/users.model.js';
import { createNotification, notifyUsers } from '../../helpers/notification.helper.js';
import { sendProjectAssignmentEmail } from '../../helpers/sendEmail.js';
import {
  PROJECT_STATUSES,
  PROJECT_DEFAULT_STATUS,
} from '../../constants/permissions/permissions.constants.js';

const MEMBER_POPULATE_FIELDS = 'userId firstName lastName email role profilePic isActive';

/**
 * Taskflow Admin accounts administer the workspace and are never assignable as a project
 * lead or member — mirrors the exclusion already applied in getProjectMemberCandidates,
 * enforced here too as a server-side guard against direct API calls that bypass the UI.
 */
async function findAdminAssignee(userIds) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (ids.length === 0) return null;
  const admins = await GetAllUsers.find({ _id: { $in: ids }, role: 'Taskflow Admin' })
    .select('firstName lastName')
    .lean();
  return admins[0] || null;
}

/**
 * Emails every given member their project assignment (project name + role), looking up
 * each user's name/email/role. The project lead is labeled "Project Lead"; everyone
 * else is labeled with their account role. Failures are logged, not thrown, so a mail
 * outage never blocks the project create/update response.
 *
 * Sent one at a time (not Promise.all): opening several SMTP connections to Gmail at
 * once gets the later ones throttled/rejected, so a parallel fan-out silently delivers
 * only the first email (typically the lead's) and drops the rest with no visible error
 * (see notifyUsers in notification.helper.js for the same fan-out-serialization fix).
 */
async function emailAssignedMembers({ memberIds, leadId, projectName }) {
  if (!Array.isArray(memberIds) || memberIds.length === 0) return;

  const users = await GetAllUsers.find({
    _id: { $in: memberIds },
    isDeleted: { $ne: true },
  })
    .select('firstName lastName email role')
    .lean();

  for (const user of users) {
    const roleLabel =
      leadId && String(user._id) === String(leadId) ? 'Project Lead' : user.role || 'Team Member';
    try {
      await sendProjectAssignmentEmail({
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
        projectName,
        role: roleLabel,
      });
    } catch (error) {
      console.error(`Project assignment email failed for ${user.email}:`, error.message);
    }
  }
}

/**
 * Builds the query filter for listing projects. Every user — including Taskflow Admin —
 * only sees projects they lead, are a member of, or created; there is no role-based
 * bypass here (unlike the notification feed, which does give Admin an unrestricted
 * global view). The createdBy clause matters most for Taskflow Admin, who can never be
 * assigned as a lead or member (see findAdminAssignee) but should still be able to see
 * projects they personally created.
 */
export const buildProjectFilter = ({ search, status, user }) => {
  const filter = { isDeleted: { $ne: true } };

  if (user) {
    const userId = user._id || user.id;
    filter.$or = [{ leadId: userId }, { members: userId }, { createdBy: userId }];
  }

  if (typeof search === 'string' && search.trim().length > 0) {
    const escapedSearch = escapeRegex(search.trim());
    const searchRegex = new RegExp(escapedSearch, 'i');
    const searchConditions = [
      { name: searchRegex },
      { key: searchRegex },
      { description: searchRegex },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  if (
    typeof status === 'string' &&
    status.trim().length > 0 &&
    status.trim().toLowerCase() !== 'all'
  ) {
    filter.status = status.trim().toLowerCase();
  }

  return filter;
};

/**
 * Derives a short, unique, uppercase project key from a project name (e.g.
 * "Customer Portal" -> "CUP"), falling back to a numeric suffix on collision.
 */
export const generateProjectKey = async (name) => {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  let base;
  if (words.length >= 2) {
    base = words
      .slice(0, 4)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  } else {
    base =
      String(name || 'PROJ')
        .replace(/[^a-zA-Z]/g, '')
        .slice(0, 4)
        .toUpperCase() || 'PROJ';
  }

  let candidate = base;
  let suffix = 1;
  while (await Project.findOne({ key: candidate, isDeleted: { $ne: true } }).lean()) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }

  return candidate;
};

export const findActiveProject = (idParam, { lean = false } = {}) => {
  const sanitizedId = String(idParam || '').trim();
  const query = mongoose.Types.ObjectId.isValid(sanitizedId)
    ? { _id: sanitizedId, isDeleted: { $ne: true } }
    : { projectId: sanitizedId, isDeleted: { $ne: true } };

  const queryChain = Project.findOne(query)
    .populate('leadId', MEMBER_POPULATE_FIELDS)
    .populate('members', MEMBER_POPULATE_FIELDS);
  return lean ? queryChain.lean() : queryChain;
};

/**
 * GET /api/v1/projects
 * Retrieve paginated projects with lead, member count, and task count
 */
export const getAllProjects = catchAsync(async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page), 10) || 1);
  const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit), 10) || 10));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const skip = (page - 1) * limit;

  const filter = buildProjectFilter({ search, status, user: req.user });

  const [projects, totalProjects] = await Promise.all([
    Project.find(filter)
      .populate('leadId', MEMBER_POPULATE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Project.countDocuments(filter),
  ]);

  const projectIds = projects.map((p) => p._id);
  const taskCounts = await Task.aggregate([
    { $match: { projectId: { $in: projectIds }, isDeleted: { $ne: true } } },
    { $group: { _id: '$projectId', count: { $sum: 1 } } },
  ]);
  const taskCountMap = new Map(taskCounts.map((t) => [String(t._id), t.count]));

  const sanitizedProjects = projects.map((p) => ({
    ...p,
    id: p._id.toString(),
    memberCount: Array.isArray(p.members) ? p.members.length : 0,
    taskCount: taskCountMap.get(String(p._id)) || 0,
  }));

  const totalPages = Math.ceil(totalProjects / limit) || 1;

  return res.status(200).json({
    success: true,
    pagination: {
      totalItems: totalProjects,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: sanitizedProjects,
  });
});

/**
 * GET /api/v1/projects/:id
 * Retrieve single project details
 */
export const getProjectById = catchAsync(async (req, res) => {
  const project = await findActiveProject(req.params.id, { lean: true });

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found.',
    });
  }

  const taskCount = await Task.countDocuments({
    projectId: project._id,
    isDeleted: { $ne: true },
  });

  return res.status(200).json({
    success: true,
    data: {
      ...project,
      id: project._id.toString(),
      memberCount: Array.isArray(project.members) ? project.members.length : 0,
      taskCount,
    },
  });
});

/**
 * POST /api/v1/projects
 * Create a new project
 */
export const createProject = catchAsync(async (req, res) => {
  const { name, description = '', key, leadId, memberIds } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Project name is required.',
    });
  }

  const existingProject = await Project.findOne({
    name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
    isDeleted: { $ne: true },
  }).lean();

  if (existingProject) {
    return res.status(400).json({
      success: false,
      message: 'A project with this name already exists.',
    });
  }

  let projectKey = key ? String(key).trim().toUpperCase() : null;
  if (projectKey) {
    const duplicateKey = await Project.findOne({
      key: projectKey,
      isDeleted: { $ne: true },
    }).lean();
    if (duplicateKey) {
      return res.status(400).json({
        success: false,
        message: 'A project with this key already exists.',
      });
    }
  } else {
    projectKey = await generateProjectKey(name);
  }

  const resolvedLeadId =
    leadId && mongoose.Types.ObjectId.isValid(leadId) ? leadId : req.user?._id || null;

  const memberSet = new Set(
    Array.isArray(memberIds) ? memberIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) : []
  );
  if (resolvedLeadId) memberSet.add(String(resolvedLeadId));

  // Guards both an explicitly chosen admin lead/member and the implicit fallback below
  // (a Taskflow Admin creating a project without picking a lead would otherwise default
  // to themselves).
  const adminAssignee = await findAdminAssignee([...memberSet]);
  if (adminAssignee) {
    return res.status(400).json({
      success: false,
      message:
        'Taskflow Admin accounts cannot be assigned as a project lead or member. Please choose a different lead.',
    });
  }

  const newProject = await Project.create({
    name: name.trim(),
    key: projectKey,
    description: description ? description.trim() : '',
    leadId: resolvedLeadId,
    members: [...memberSet],
    createdBy: req.user?._id || null,
    status: PROJECT_STATUSES.includes(req.body.status) ? req.body.status : PROJECT_DEFAULT_STATUS,
    isDeleted: false,
  });

  const assignedMembers = await GetAllUsers.find({
    _id: { $in: [...memberSet] },
    isDeleted: { $ne: true },
  })
    .select('firstName lastName')
    .lean();
  const assignedNames = assignedMembers
    .map((u) => `${u.firstName || ''} ${u.lastName || ''}`.trim())
    .filter(Boolean)
    .join(', ');

  await createNotification({
    actor: req.user,
    type: 'project_created',
    title: 'Project Created',
    message: `Project "${newProject.name}" (${newProject.key}) was created and assigned to: ${assignedNames || 'no members yet'}.`,
    targetRole: 'All',
    metadata: { projectId: newProject._id, projectKey: newProject.key },
  });

  await emailAssignedMembers({
    memberIds: [...memberSet],
    leadId: resolvedLeadId,
    projectName: newProject.name,
  });

  return res.status(201).json({
    success: true,
    message: 'Project created successfully.',
    data: {
      ...newProject.toObject(),
      id: newProject._id.toString(),
    },
  });
});

/**
 * PUT /api/v1/projects/:id
 * Update project details, lead, membership, and status
 */
export const updateProject = catchAsync(async (req, res) => {
  const project = await Project.findOne(
    mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: String(req.params.id), isDeleted: { $ne: true } }
      : { projectId: String(req.params.id), isDeleted: { $ne: true } }
  );

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found.',
    });
  }

  const { name, description, status, leadId, memberIds } = req.body;

  const previousMemberIds = new Set((project.members || []).map(String));

  if (name && name.trim().toLowerCase() !== project.name.toLowerCase()) {
    const duplicate = await Project.findOne({
      name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
      _id: { $ne: project._id },
      isDeleted: { $ne: true },
    }).lean();

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'A project with this name already exists.',
      });
    }
    project.name = name.trim();
  }

  if (description !== undefined) project.description = String(description).trim();
  if (status && PROJECT_STATUSES.includes(status)) project.status = status;
  if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
    const adminLead = await findAdminAssignee([leadId]);
    if (adminLead) {
      return res.status(400).json({
        success: false,
        message: 'Taskflow Admin accounts cannot be assigned as a project lead.',
      });
    }
    project.leadId = leadId;
  }

  let addedMemberIds = [];
  let removedMemberIds = [];
  if (Array.isArray(memberIds)) {
    const memberSet = new Set(memberIds.filter((id) => mongoose.Types.ObjectId.isValid(id)));
    if (project.leadId) memberSet.add(String(project.leadId));

    const adminAssignee = await findAdminAssignee([...memberSet]);
    if (adminAssignee) {
      return res.status(400).json({
        success: false,
        message: 'Taskflow Admin accounts cannot be assigned as a project member.',
      });
    }

    project.members = [...memberSet];

    const currentMemberIds = new Set([...memberSet].map(String));
    addedMemberIds = [...currentMemberIds].filter((id) => !previousMemberIds.has(id));
    removedMemberIds = [...previousMemberIds].filter((id) => !currentMemberIds.has(id));
  }

  await project.save();

  await createNotification({
    actor: req.user,
    type: 'project_updated',
    title: 'Project Updated',
    message: `Project "${project.name}" details have been updated.`,
    targetRole: 'All',
    metadata: { projectId: project._id, projectKey: project.key },
  });

  if (addedMemberIds.length > 0) {
    await notifyUsers({
      recipientIds: addedMemberIds,
      actor: req.user,
      type: 'project_member_added',
      title: 'Added to Project',
      message: `You were added to project "${project.name}" (${project.key}).`,
      metadata: { projectId: project._id, projectKey: project.key },
    });

    await emailAssignedMembers({
      memberIds: addedMemberIds,
      leadId: project.leadId,
      projectName: project.name,
    });
  }

  if (removedMemberIds.length > 0) {
    await notifyUsers({
      recipientIds: removedMemberIds,
      actor: req.user,
      type: 'project_member_removed',
      title: 'Removed from Project',
      message: `You were removed from project "${project.name}" (${project.key}).`,
      metadata: { projectId: project._id, projectKey: project.key },
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Project updated successfully.',
    data: {
      ...project.toObject(),
      id: project._id.toString(),
    },
  });
});

/**
 * DELETE /api/v1/projects/:id
 * Permanently (hard) deletes a project — unlike PUT .../status:'archived', which is the
 * reversible alternative that keeps the project and its tasks intact but out of the
 * default active view. Deleting cascades: every active task under the project is
 * soft-deleted (matching the same convention a standalone task delete already uses) and
 * each task's assignee/reporter gets their own "Task Deleted" notification, before the
 * project document itself is removed and its members are notified.
 */
export const deleteProject = catchAsync(async (req, res) => {
  const project = await Project.findOne(
    mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: String(req.params.id), isDeleted: { $ne: true } }
      : { projectId: String(req.params.id), isDeleted: { $ne: true } }
  );

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found.',
    });
  }

  const affectedTasks = await Task.find({
    projectId: project._id,
    isDeleted: { $ne: true },
  })
    .select('assigneeId reporterId title taskKey')
    .lean();

  if (affectedTasks.length > 0) {
    await Task.updateMany(
      { _id: { $in: affectedTasks.map((task) => task._id) } },
      { isDeleted: true, deletedAt: new Date() }
    );

    for (const task of affectedTasks) {
      await notifyUsers({
        recipientIds: [task.assigneeId, task.reporterId],
        actor: req.user,
        type: 'task_deleted',
        title: 'Task Deleted',
        message: `${task.taskKey}: ${task.title} was deleted because its project "${project.name}" was deleted.`,
        metadata: { taskId: task._id, taskKey: task.taskKey, projectId: project._id },
      });
    }
  }

  const affectedMemberIds = [
    ...new Set([...(project.members || []), project.leadId].filter(Boolean).map(String)),
  ];
  const { name: projectName, key: projectKey, _id: projectMongoId, projectId } = project;

  await Project.deleteOne({ _id: project._id });

  // Notified directly by recipientId (rather than relying on project-membership
  // scoping) since the project no longer exists for its former members to be scoped by.
  await notifyUsers({
    recipientIds: affectedMemberIds,
    actor: req.user,
    type: 'project_deleted',
    title: 'Project Deleted',
    message: `Project "${projectName}" (${projectKey}) was deleted.`,
    metadata: { projectId: projectMongoId, projectKey },
  });

  return res.status(200).json({
    success: true,
    message: 'Project deleted successfully.',
    data: { id: projectMongoId, projectId },
  });
});

/**
 * GET /api/v1/projects/:id/members/candidates
 * Retrieve active users eligible to be added as project members. Taskflow Admin accounts
 * are excluded — they administer the workspace and are never assignable as a project
 * lead or member (see the same rule enforced in createProject/updateProject).
 */
export const getProjectMemberCandidates = catchAsync(async (req, res) => {
  const users = await GetAllUsers.find({
    isDeleted: { $ne: true },
    isActive: { $ne: false },
    role: { $ne: 'Taskflow Admin' },
  })
    .select(MEMBER_POPULATE_FIELDS)
    .sort({ firstName: 1 })
    .lean();

  return res.status(200).json({
    success: true,
    data: users.map((u) => ({ ...u, id: u._id.toString() })),
  });
});
