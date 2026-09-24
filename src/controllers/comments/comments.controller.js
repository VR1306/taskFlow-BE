import mongoose from 'mongoose';
import { catchAsync } from '../../helpers/helpers.js';
import Comment from '../../models/comments/comments.model.js';
import { findActiveTask } from '../tasks/tasks.controller.js';
import { createNotification } from '../../helpers/notification.helper.js';
import { logActivity } from '../../helpers/activity.helper.js';

const AUTHOR_POPULATE_FIELDS = 'userId firstName lastName email role profilePic';

/**
 * GET /api/v1/tasks/:id/comments
 * Retrieve all comments for a task, oldest first
 */
export const getTaskComments = catchAsync(async (req, res) => {
  const task = await findActiveTask(req.params.id, { lean: true });

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found.',
    });
  }

  const comments = await Comment.find({ taskId: task._id, isDeleted: { $ne: true } })
    .populate('authorId', AUTHOR_POPULATE_FIELDS)
    .sort({ createdAt: 1 })
    .lean();

  return res.status(200).json({
    success: true,
    data: comments.map((c) => ({ ...c, id: c._id.toString() })),
  });
});

/**
 * POST /api/v1/tasks/:id/comments
 * Add a comment to a task
 */
export const createTaskComment = catchAsync(async (req, res) => {
  const task = await findActiveTask(req.params.id, { lean: true });

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found.',
    });
  }

  const { body } = req.body;
  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Comment body is required.',
    });
  }

  const comment = await Comment.create({
    taskId: task._id,
    authorId: req.user?._id || null,
    body: body.trim(),
    isDeleted: false,
  });

  await logActivity({
    taskId: task._id,
    actor: req.user,
    action: 'commented',
    message: 'Added a comment.',
  });

  const notifyRecipients = new Set(
    [task.assigneeId?._id || task.assigneeId, task.reporterId?._id || task.reporterId]
      .filter(Boolean)
      .map(String)
      .filter((id) => id !== String(req.user?._id || ''))
  );

  await Promise.all(
    [...notifyRecipients].map((recipientId) =>
      createNotification({
        actor: req.user,
        type: 'task_comment',
        title: 'New Comment',
        message: `New comment on ${task.taskKey}: ${task.title}`,
        targetRole: 'All',
        recipientId,
        metadata: { taskId: task._id, taskKey: task.taskKey, projectId: task.projectId },
      })
    )
  );

  const populatedComment = await Comment.findById(comment._id)
    .populate('authorId', AUTHOR_POPULATE_FIELDS)
    .lean();

  return res.status(201).json({
    success: true,
    message: 'Comment added successfully.',
    data: { ...populatedComment, id: populatedComment._id.toString() },
  });
});

/**
 * DELETE /api/v1/tasks/:id/comments/:commentId
 * Soft delete a comment (author or a user with tasks.edit permission)
 */
export const deleteTaskComment = catchAsync(async (req, res) => {
  const taskIdParam = String(req.params.id);
  const commentId = String(req.params.commentId);

  const task = await findActiveTask(taskIdParam, { lean: true });
  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found.',
    });
  }

  const query = mongoose.Types.ObjectId.isValid(commentId)
    ? { _id: commentId, taskId: task._id, isDeleted: { $ne: true } }
    : { commentId, taskId: task._id, isDeleted: { $ne: true } };

  const comment = await Comment.findOne(query);
  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found.',
    });
  }

  const isAuthor = String(comment.authorId) === String(req.user?._id || '');
  const canEditAnyTask = Array.isArray(req.user?.permissions)
    ? req.user.permissions.includes('tasks.edit') || req.user.permissions.includes('*')
    : false;

  if (!isAuthor && !canEditAnyTask) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: you can only delete your own comments.',
    });
  }

  comment.isDeleted = true;
  comment.deletedAt = new Date();
  await comment.save();

  return res.status(200).json({
    success: true,
    message: 'Comment deleted successfully.',
  });
});
