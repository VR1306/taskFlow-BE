import mongoose from 'mongoose';
import { catchAsync, escapeRegex } from '../../helpers/helpers.js';
import Project from '../../models/projects/projects.model.js';
import Task from '../../models/tasks/tasks.model.js';
import GetAllUsers from '../../models/users/users.model.js';
import { createNotification } from '../../helpers/notification.helper.js';
import {
  PROJECT_STATUSES,
  PROJECT_DEFAULT_STATUS,
} from '../../constants/permissions/permissions.constants.js';

const MEMBER_POPULATE_FIELDS = 'userId firstName lastName email role profilePic isActive';

export const buildProjectFilter = ({ search, status }) => {
  const filter = { isDeleted: { $ne: true } };

  if (typeof search === 'string' && search.trim().length > 0) {
    const escapedSearch = escapeRegex(search.trim());
    const searchRegex = new RegExp(escapedSearch, 'i');
    filter.$or = [{ name: searchRegex }, { key: searchRegex }, { description: searchRegex }];
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

  const filter = buildProjectFilter({ search, status });

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

  const newProject = await Project.create({
    name: name.trim(),
    key: projectKey,
    description: description ? description.trim() : '',
    leadId: resolvedLeadId,
    members: [...memberSet],
    status: PROJECT_STATUSES.includes(req.body.status) ? req.body.status : PROJECT_DEFAULT_STATUS,
    isDeleted: false,
  });

  await createNotification({
    actor: req.user,
    type: 'project_created',
    title: 'Project Created',
    message: `Project "${newProject.name}" (${newProject.key}) was created.`,
    targetRole: 'All',
    metadata: { projectId: newProject._id, projectKey: newProject.key },
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
  if (leadId && mongoose.Types.ObjectId.isValid(leadId)) project.leadId = leadId;
  if (Array.isArray(memberIds)) {
    const memberSet = new Set(memberIds.filter((id) => mongoose.Types.ObjectId.isValid(id)));
    if (project.leadId) memberSet.add(String(project.leadId));
    project.members = [...memberSet];
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
 * Soft delete a project (blocked while it still has active tasks)
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

  const activeTaskCount = await Task.countDocuments({
    projectId: project._id,
    isDeleted: { $ne: true },
  });

  if (activeTaskCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete project: ${activeTaskCount} active task(s) exist. Please delete or move them first.`,
    });
  }

  project.isDeleted = true;
  project.deletedAt = new Date();
  await project.save();

  return res.status(200).json({
    success: true,
    message: 'Project deleted successfully.',
    data: { id: project._id, projectId: project.projectId },
  });
});

/**
 * GET /api/v1/projects/:id/members/candidates
 * Retrieve active users eligible to be added as project members
 */
export const getProjectMemberCandidates = catchAsync(async (req, res) => {
  const users = await GetAllUsers.find({ isDeleted: { $ne: true }, isActive: { $ne: false } })
    .select(MEMBER_POPULATE_FIELDS)
    .sort({ firstName: 1 })
    .lean();

  return res.status(200).json({
    success: true,
    data: users.map((u) => ({ ...u, id: u._id.toString() })),
  });
});
