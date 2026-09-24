import mongoose from 'mongoose';
import Notification from '../models/notifications/notifications.model.js';

/**
 * Creates and persists a system/user notification safely.
 *
 * @param {Object} params
 * @param {Object} [params.actor] User document or actor info
 * @param {string} params.type Notification event type
 * @param {string} params.title Title of the notification
 * @param {string} params.message Detailed message text
 * @param {string} [params.targetRole='All'] Target role ('All' | 'Taskflow Admin' | 'Project Manager' | 'Developer' | 'QA')
 * @param {string|mongoose.Types.ObjectId} [params.recipientId] Specific target user ID
 * @param {Object} [params.metadata={}] Extra context
 * @returns {Promise<Object|null>} Created notification or null
 */
export async function createNotification({
  actor = null,
  type,
  title,
  message,
  targetRole = 'All',
  recipientId = null,
  metadata = {},
}) {
  try {
    if (mongoose.connection.readyState === 0 && !Notification.create.mock) {
      return null;
    }
    let actorId = null;
    let actorName = 'System';
    let actorRole = 'System';

    if (actor) {
      actorId = actor._id || actor.id || null;
      const firstName = actor.firstName || '';
      const lastName = actor.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      actorName = fullName || actor.name || actor.email || 'User';
      actorRole = actor.role || 'User';
    }

    const doc = await Notification.create({
      actorId,
      actorName,
      actorRole,
      recipientId: recipientId || null,
      targetRole,
      type,
      title,
      message,
      metadata,
      readBy: [],
      isDeleted: false,
    });

    return doc;
  } catch (error) {
    console.error('Failed to create notification:', error.message);
    return null;
  }
}

export default createNotification;
