import mongoose from 'mongoose';
import multer from 'multer';
import { catchAsync } from '../../helpers/helpers.js';
import Attachment from '../../models/attachments/attachments.model.js';
import { findActiveTask } from '../tasks/tasks.controller.js';
import { logActivity } from '../../helpers/activity.helper.js';
import { MAX_ATTACHMENT_SIZE_BYTES } from '../../constants/permissions/permissions.constants.js';

const UPLOADER_POPULATE_FIELDS = 'userId firstName lastName email role profilePic';

// Attachments are held in memory just long enough to persist their Buffer into MongoDB —
// there is no local disk to write to on a serverless deployment.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES },
});

export const uploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `Attachment exceeds the maximum allowed size of ${Math.floor(
            MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024)
          )} MB.`,
        });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next();
  });
};

/**
 * GET /api/v1/tasks/:id/attachments
 * Retrieve attachment metadata (without binary content) for a task
 */
export const getTaskAttachments = catchAsync(async (req, res) => {
  const task = await findActiveTask(req.params.id, { lean: true });

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found.',
    });
  }

  const attachments = await Attachment.find({ taskId: task._id, isDeleted: { $ne: true } })
    .populate('uploaderId', UPLOADER_POPULATE_FIELDS)
    .select('-data')
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({
    success: true,
    data: attachments.map((a) => ({ ...a, id: a._id.toString() })),
  });
});

/**
 * POST /api/v1/tasks/:id/attachments
 * Upload a file attachment to a task (stored inline as a Buffer)
 */
export const uploadTaskAttachment = catchAsync(async (req, res) => {
  const task = await findActiveTask(req.params.id, { lean: true });

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found.',
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'A file is required.',
    });
  }

  const attachment = await Attachment.create({
    taskId: task._id,
    uploaderId: req.user?._id || null,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    data: req.file.buffer,
    isDeleted: false,
  });

  await logActivity({
    taskId: task._id,
    actor: req.user,
    action: 'attachment_added',
    message: `Attached "${attachment.filename}".`,
  });

  const populated = await Attachment.findById(attachment._id)
    .populate('uploaderId', UPLOADER_POPULATE_FIELDS)
    .select('-data')
    .lean();

  return res.status(201).json({
    success: true,
    message: 'Attachment uploaded successfully.',
    data: { ...populated, id: populated._id.toString() },
  });
});

const findTaskAndAttachment = async (taskIdParam, attachmentId, { lean = false } = {}) => {
  const task = await findActiveTask(taskIdParam, { lean: true });
  if (!task) {
    return { task: null, attachment: null };
  }

  const query = mongoose.Types.ObjectId.isValid(attachmentId)
    ? { _id: attachmentId, taskId: task._id, isDeleted: { $ne: true } }
    : { attachmentId, taskId: task._id, isDeleted: { $ne: true } };

  const attachment = lean
    ? await Attachment.findOne(query).lean()
    : await Attachment.findOne(query);
  return { task, attachment };
};

/**
 * GET /api/v1/tasks/:id/attachments/:attachmentId
 * Stream an attachment's binary content back to the client
 */
export const downloadTaskAttachment = catchAsync(async (req, res) => {
  const { task, attachment } = await findTaskAndAttachment(
    String(req.params.id),
    String(req.params.attachmentId),
    { lean: true }
  );

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found.',
    });
  }

  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: 'Attachment not found.',
    });
  }

  res.setHeader('Content-Type', attachment.mimetype);
  res.setHeader('Content-Disposition', `inline; filename="${attachment.filename}"`);
  return res.status(200).send(attachment.data);
});

/**
 * DELETE /api/v1/tasks/:id/attachments/:attachmentId
 * Soft delete an attachment (uploader or a user with tasks.edit permission)
 */
export const deleteTaskAttachment = catchAsync(async (req, res) => {
  const { task, attachment } = await findTaskAndAttachment(
    String(req.params.id),
    String(req.params.attachmentId)
  );

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found.',
    });
  }

  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: 'Attachment not found.',
    });
  }

  const isUploader = String(attachment.uploaderId) === String(req.user?._id || '');
  const canEditAnyTask = Array.isArray(req.user?.permissions)
    ? req.user.permissions.includes('tasks.edit') || req.user.permissions.includes('*')
    : false;

  if (!isUploader && !canEditAnyTask) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: you can only delete your own attachments.',
    });
  }

  attachment.isDeleted = true;
  attachment.deletedAt = new Date();
  await attachment.save();

  return res.status(200).json({
    success: true,
    message: 'Attachment deleted successfully.',
  });
});
