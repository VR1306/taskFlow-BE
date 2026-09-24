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
// notificationId is assigned by scanning for the current max and adding one (see the
// model's pre('save') hook), which isn't atomic — two notifications created around the
// same time (e.g. a single event fanned out to several recipients) can compute the same
// "next" id and collide on the unique index. Retrying re-scans for a fresh max on each
// attempt, so the loser of a race gets a new, now-correct id instead of being dropped.
const MAX_DUPLICATE_ID_RETRIES = 3;

export async function createNotification({
  actor = null,
  type,
  title,
  message,
  targetRole = 'All',
  recipientId = null,
  metadata = {},
}) {
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

  for (let attempt = 0; attempt <= MAX_DUPLICATE_ID_RETRIES; attempt += 1) {
    try {
      return await Notification.create({
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
    } catch (error) {
      // On the final attempt this is always true (attempt < MAX is false), so every
      // path through the loop ends in a return — collision retries never fall through.
      const isRetryableIdCollision = error?.code === 11000 && attempt < MAX_DUPLICATE_ID_RETRIES;
      if (!isRetryableIdCollision) {
        console.error('Failed to create notification:', error.message);
        return null;
      }
    }
  }
}

/**
 * Fans a single event out to several recipients as individual, user-scoped notifications.
 * Recipients may be ObjectIds, id strings, or populated user objects (with an `_id`/`id`);
 * falsy entries, duplicates, and (by default) the acting user are skipped.
 *
 * @param {Object} params
 * @param {Array} params.recipientIds User ids (or user objects) to notify
 * @param {Object} [params.actor] User document or actor info performing the action
 * @param {string} params.type Notification event type
 * @param {string} params.title Title of the notification
 * @param {string} params.message Detailed message text
 * @param {Object} [params.metadata={}] Extra context
 * @param {boolean} [params.excludeActorId=true] Skip the actor if present among recipients
 * @returns {Promise<Array>} Created notifications (nulls included for any that failed silently)
 */
export async function notifyUsers({
  recipientIds = [],
  actor = null,
  type,
  title,
  message,
  metadata = {},
  excludeActorId = true,
}) {
  const actorId = actor ? String(actor._id || actor.id || '') : '';

  const uniqueRecipientIds = new Set(
    recipientIds
      .map((entry) => entry && (entry._id || entry.id || entry))
      .filter(Boolean)
      .map(String)
      .filter((recipientId) => !(excludeActorId && recipientId === actorId))
  );

  // Created one at a time (not Promise.all) so each notificationId is assigned after
  // the previous one has actually persisted, avoiding the race in createNotification's
  // id-collision retry (which only guards against concurrent writers it can't see, not
  // ones started by this same fan-out).
  const results = [];
  for (const recipientId of uniqueRecipientIds) {
    results.push(await createNotification({ actor, type, title, message, recipientId, metadata }));
  }
  return results;
}

export default createNotification;
