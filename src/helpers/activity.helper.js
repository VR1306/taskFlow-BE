import mongoose from 'mongoose';
import ActivityLog from '../models/activity/activity.model.js';

/**
 * Records a task activity entry safely (used to drive the task detail activity feed).
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.taskId
 * @param {Object} [params.actor] User document or actor info
 * @param {string} params.action 'created' | 'status_changed' | 'assigned' | 'priority_changed' | 'commented' | 'attachment_added'
 * @param {string} [params.fromValue]
 * @param {string} [params.toValue]
 * @param {string} params.message Human-readable summary of the change
 * @returns {Promise<Object|null>} Created activity entry or null
 */
export async function logActivity({
  taskId,
  actor = null,
  action,
  fromValue = null,
  toValue = null,
  message,
}) {
  try {
    if (mongoose.connection.readyState === 0 && !ActivityLog.create.mock) {
      return null;
    }

    let actorId = null;
    let actorName = 'System';

    if (actor) {
      actorId = actor._id || actor.id || null;
      const fullName = `${actor.firstName || ''} ${actor.lastName || ''}`.trim();
      actorName = fullName || actor.name || actor.email || 'User';
    }

    return await ActivityLog.create({
      taskId,
      actorId,
      actorName,
      action,
      fromValue,
      toValue,
      message,
    });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
    return null;
  }
}

export default logActivity;
