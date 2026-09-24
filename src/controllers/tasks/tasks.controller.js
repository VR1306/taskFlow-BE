import mongoose from 'mongoose';
import { catchAsync, escapeRegex } from '../../helpers/helpers.js';
import Task from '../../models/tasks/tasks.model.js';
import Project from '../../models/projects/projects.model.js';
import Comment from '../../models/comments/comments.model.js';
import Attachment from '../../models/attachments/attachments.model.js';
import ActivityLog from '../../models/activity/activity.model.js';
import { createNotification, notifyUsers } from '../../helpers/notification.helper.js';
import { logActivity } from '../../helpers/activity.helper.js';
import {
  TASK_STATUSES,
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_DEFAULT_TYPE,
  TASK_DEFAULT_PRIORITY,
} from '../../constants/permissions/permissions.constants.js';

const ASSIGNEE_POPULATE_FIELDS = 'userId firstName lastName email role profilePic';

export const buildTaskFilter = ({ projectId, search, status, assigneeId, priority, type }) => {
  const filter = { isDeleted: { $ne: true } };

  if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
    filter.projectId = String(projectId);
  }

  if (typeof search === 'string' && search.trim().length > 0) {
    const escapedSearch = escapeRegex(search.trim());
    const searchRegex = new RegExp(escapedSearch, 'i');
    filter.$or = [{ title: searchRegex }, { taskKey: searchRegex }, { description: searchRegex }];
  }

  if (status && TASK_STATUSES.includes(status)) {
    filter.status = String(status);
  }

  if (assigneeId && mongoose.Types.ObjectId.isValid(assigneeId)) {
    filter.assigneeId = String(assigneeId);
  }

  if (priority && TASK_PRIORITIES.includes(priority)) {
    filter.priority = String(priority);
  }

  if (type && TASK_TYPES.includes(type)) {
    filter.type = String(type);
  }

  return filter;
};

export const findActiveTask = (idParam, { lean = false } = {}) => {
  const sanitizedId = String(idParam || '').trim();
  const query = mongoose.Types.ObjectId.isValid(sanitizedId)
    ? { _id: sanitizedId, isDeleted: { $ne: true } }
    : { taskKey: sanitizedId.toUpperCase(), isDeleted: { $ne: true } };

  const queryChain = Task.findOne(query)
    .populate('assigneeId', ASSIGNEE_POPULATE_FIELDS)
    .populate('reporterId', ASSIGNEE_POPULATE_FIELDS);
  return lean ? queryChain.lean() : queryChain;
};

/**
 * GET /api/v1/tasks
 * Retrieve paginated tasks, optionally scoped to a project
 */
export const getAllTasks = catchAsync(async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page), 10) || 1);
  const limit = Math.max(1, Math.min(200, Number.parseInt(String(req.query.limit), 10) || 20));
  const skip = (page - 1) * limit;

  const filter = buildTaskFilter({
    projectId: req.query.projectId,
    search: req.query.search,
    status: req.query.status,
    assigneeId: req.query.assigneeId,
    priority: req.query.priority,
    type: req.query.type,
  });

  const [tasks, totalTasks] = await Promise.all([
    Task.find(filter)
      .populate('assigneeId', ASSIGNEE_POPULATE_FIELDS)
      .populate('reporterId', ASSIGNEE_POPULATE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Task.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalTasks / limit) || 1;

  return res.status(200).json({
    success: true,
    pagination: {
      totalItems: totalTasks,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: tasks.map((t) => ({ ...t, id: t._id.toString() })),
  });
});

/**
 * GET /api/v1/tasks/board?projectId=...
 * Retrieve every active task for a project, ordered for direct Kanban rendering
 */
export const getBoardTasks = catchAsync(async (req, res) => {
  const { projectId } = req.query;

  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({
      success: false,
      message: 'A valid projectId query parameter is required.',
    });
  }

  const tasks = await Task.find({ projectId: String(projectId), isDeleted: { $ne: true } })
    .populate('assigneeId', ASSIGNEE_POPULATE_FIELDS)
    .populate('reporterId', ASSIGNEE_POPULATE_FIELDS)
    .sort({ status: 1, order: 1 })
    .lean();

  return res.status(200).json({
    success: true,
    data: tasks.map((t) => ({ ...t, id: t._id.toString() })),
  });
});

/**
 * GET /api/v1/tasks/:id
 * Retrieve a single task by ObjectId or taskKey
 */
export const getTaskById = catchAsync(async (req, res) => {
  const task = await findActiveTask(req.params.id, { lean: true });

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found.',
    });
  }

  return res.status(200).json({
    success: true,
    data: { ...task, id: task._id.toString() },
  });
});

/**
 * POST /api/v1/tasks
 * Create a new task within a project
 */
export const createTask = catchAsync(async (req, res) => {
  const {
    projectId,
    title,
    description = '',
    type,
    priority,
    assigneeId,
    dueDate,
    labels,
  } = req.body;

  if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({
      success: false,
      message: 'A valid projectId is required.',
    });
  }

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Task title is required.',
    });
  }

  // Atomically increment the project's task sequence to derive a unique, human-readable key
  const project = await Project.findOneAndUpdate(
    { _id: String(projectId), isDeleted: { $ne: true } },
    { $inc: { taskSequence: 1 } },
    { new: true }
  );

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found.',
    });
  }

  const taskStatus = 'Todo';
  const lastInColumn = await Task.findOne({
    projectId: String(projectId),
    status: taskStatus,
    isDeleted: { $ne: true },
  })
    .sort({ order: -1 })
    .lean();
  const order = (lastInColumn?.order ?? -1) + 1;

  const validAssigneeId =
    assigneeId && mongoose.Types.ObjectId.isValid(assigneeId) ? assigneeId : null;

  const task = await Task.create({
    taskKey: `${project.key}-${project.taskSequence}`,
    projectId,
    title: title.trim(),
    description: description ? description.trim() : '',
    type: TASK_TYPES.includes(type) ? type : TASK_DEFAULT_TYPE,
    status: taskStatus,
    priority: TASK_PRIORITIES.includes(priority) ? priority : TASK_DEFAULT_PRIORITY,
    assigneeId: validAssigneeId,
    reporterId: req.user?._id || null,
    labels: Array.isArray(labels) ? labels.filter((l) => typeof l === 'string') : [],
    dueDate: dueDate || null,
    order,
    isDeleted: false,
  });

  await logActivity({
    taskId: task._id,
    actor: req.user,
    action: 'created',
    message: `${task.taskKey} was created.`,
  });

  if (validAssigneeId) {
    await createNotification({
      actor: req.user,
      type: 'task_assigned',
      title: 'Task Assigned',
      message: `You were assigned to ${task.taskKey}: ${task.title}`,
      targetRole: 'All',
      recipientId: validAssigneeId,
      metadata: { taskId: task._id, taskKey: task.taskKey, projectId: project._id },
    });
  }

  const populatedTask = await findActiveTask(task._id, { lean: true });

  return res.status(201).json({
    success: true,
    message: 'Task created successfully.',
    data: { ...populatedTask, id: populatedTask._id.toString() },
  });
});

/**
 * PUT /api/v1/tasks/:id
 * Update general task fields (title, description, type, priority, assignee, due date, labels)
 */
async function updateTaskAssignee(task, assigneeId, actor) {
  if (assigneeId !== undefined) {
    const nextAssigneeId =
      assigneeId && mongoose.Types.ObjectId.isValid(assigneeId) ? assigneeId : null;
    const previousAssigneeId = task.assigneeId ? String(task.assigneeId) : null;

    if (String(nextAssigneeId || '') !== String(task.assigneeId || '')) {
      await logActivity({
        taskId: task._id,
        actor: actor,
        action: 'assigned',
        toValue: nextAssigneeId ? String(nextAssigneeId) : 'Unassigned',
        message: nextAssigneeId ? 'Task was reassigned.' : 'Task was unassigned.',
      });
      task.assigneeId = nextAssigneeId;

      if (nextAssigneeId) {
        await createNotification({
          actor: actor,
          type: 'task_assigned',
          title: 'Task Assigned',
          message: `You were assigned to ${task.taskKey}: ${task.title}`,
          targetRole: 'All',
          recipientId: nextAssigneeId,
          metadata: { taskId: task._id, taskKey: task.taskKey, projectId: task.projectId },
        });
      } else {
        // Reaching here means nextAssigneeId is falsy but the assignee still changed,
        // which is only possible if the task previously had an assignee to notify.
        await createNotification({
          actor: actor,
          type: 'task_unassigned',
          title: 'Task Unassigned',
          message: `You were unassigned from ${task.taskKey}: ${task.title}`,
          recipientId: previousAssigneeId,
          metadata: { taskId: task._id, taskKey: task.taskKey, projectId: task.projectId },
        });
      }
    }
  }
}

export const updateTask = catchAsync(async (req, res) => {
  const task = await Task.findOne(
    mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: String(req.params.id), isDeleted: { $ne: true } }
      : { taskKey: String(req.params.id).toUpperCase(), isDeleted: { $ne: true } }
  );

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found.',
    });
  }

  const { title, description, type, priority, assigneeId, dueDate, labels } = req.body;

  if (title !== undefined) task.title = String(title).trim();
  if (description !== undefined) task.description = String(description).trim();
  if (type && TASK_TYPES.includes(type)) task.type = type;
  if (dueDate !== undefined) task.dueDate = dueDate || null;
  if (Array.isArray(labels)) task.labels = labels.filter((l) => typeof l === 'string');

  if (priority && TASK_PRIORITIES.includes(priority) && priority !== task.priority) {
    await logActivity({
      taskId: task._id,
      actor: req.user,
      action: 'priority_changed',
      fromValue: task.priority,
      toValue: priority,
      message: `Priority changed from ${task.priority} to ${priority}.`,
    });
    task.priority = priority;
  }

  await updateTaskAssignee(task, assigneeId, req.user);

  await task.save();

  const populatedTask = await findActiveTask(task._id, { lean: true });

  return res.status(200).json({
    success: true,
    message: 'Task updated successfully.',
    data: { ...populatedTask, id: populatedTask._id.toString() },
  });
});

/**
 * PATCH /api/v1/tasks/:id/status
 * Move a task between Kanban columns (and/or reorder within a column) — drives drag-and-drop
 */
export const updateTaskStatus = catchAsync(async (req, res) => {
  const { status, order } = req.body;

  if (!status || !TASK_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Status must be one of: ${TASK_STATUSES.join(', ')}`,
    });
  }

  const task = await Task.findOne(
    mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: String(req.params.id), isDeleted: { $ne: true } }
      : { taskKey: String(req.params.id).toUpperCase(), isDeleted: { $ne: true } }
  );

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found.',
    });
  }

  const previousStatus = task.status;
  task.status = status;
  task.order = typeof order === 'number' ? order : task.order;
  await task.save();

  if (previousStatus !== status) {
    await logActivity({
      taskId: task._id,
      actor: req.user,
      action: 'status_changed',
      fromValue: previousStatus,
      toValue: status,
      message: `Status changed from ${previousStatus} to ${status}.`,
    });

    if (status === 'Done' && task.reporterId) {
      await createNotification({
        actor: req.user,
        type: 'task_completed',
        title: 'Task Completed',
        message: `${task.taskKey}: ${task.title} was marked Done.`,
        targetRole: 'All',
        recipientId: task.reporterId,
        metadata: { taskId: task._id, taskKey: task.taskKey, projectId: task.projectId },
      });
    }
  }

  const populatedTask = await findActiveTask(task._id, { lean: true });

  return res.status(200).json({
    success: true,
    message: 'Task status updated successfully.',
    data: { ...populatedTask, id: populatedTask._id.toString() },
  });
});

/**
 * DELETE /api/v1/tasks/:id
 * Soft delete a task
 */
export const deleteTask = catchAsync(async (req, res) => {
  const task = await Task.findOne(
    mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: String(req.params.id), isDeleted: { $ne: true } }
      : { taskKey: String(req.params.id).toUpperCase(), isDeleted: { $ne: true } }
  );

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found.',
    });
  }

  task.isDeleted = true;
  task.deletedAt = new Date();
  await task.save();

  await notifyUsers({
    recipientIds: [task.assigneeId, task.reporterId],
    actor: req.user,
    type: 'task_deleted',
    title: 'Task Deleted',
    message: `${task.taskKey}: ${task.title} was deleted.`,
    metadata: { taskId: task._id, taskKey: task.taskKey, projectId: task.projectId },
  });

  return res.status(200).json({
    success: true,
    message: 'Task deleted successfully.',
    data: { id: task._id, taskKey: task.taskKey },
  });
});

/**
 * GET /api/v1/tasks/:id/activity
 * Retrieve the chronological activity feed for a task
 */
export const getTaskActivity = catchAsync(async (req, res) => {
  const task = await findActiveTask(req.params.id, { lean: true });

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found.',
    });
  }

  const activity = await ActivityLog.find({ taskId: task._id }).sort({ createdAt: -1 }).lean();

  return res.status(200).json({
    success: true,
    data: activity.map((a) => ({ ...a, id: a._id.toString() })),
  });
});

/**
 * Internal helper (not a route): counts comments + attachments for a set of tasks.
 * Exported for reuse by the comments/attachments controllers if needed later.
 */
export const getTaskCounters = async (taskIds) => {
  const [commentCounts, attachmentCounts] = await Promise.all([
    Comment.aggregate([
      { $match: { taskId: { $in: taskIds }, isDeleted: { $ne: true } } },
      { $group: { _id: '$taskId', count: { $sum: 1 } } },
    ]),
    Attachment.aggregate([
      { $match: { taskId: { $in: taskIds }, isDeleted: { $ne: true } } },
      { $group: { _id: '$taskId', count: { $sum: 1 } } },
    ]),
  ]);

  return { commentCounts, attachmentCounts };
};
