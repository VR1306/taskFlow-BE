import mongoose from 'mongoose';
import { catchAsync, escapeRegex } from '../../helpers/helpers.js';
import Notification from '../../models/notifications/notifications.model.js';

/**
 * Builds query filter for notification retrieval based on role hierarchy
 */
export const buildNotificationFilter = ({ user, search, type, unreadOnly = false }) => {
  const filter = { isDeleted: { $ne: true } };

  const userId = user._id || user.id;
  const userRole = user.role;

  // 1. Role-based scoping
  if (userRole !== 'Taskflow Admin') {
    // Non-admins see notifications addressed to them personally, or broadcast
    // to everyone ('All') or specifically to their role
    filter.$or = [{ recipientId: userId }, { targetRole: { $in: ['All', userRole] } }];
  }
  // Taskflow Admin sees the full global notification feed (no additional scoping)

  // 2. Search filtering
  if (typeof search === 'string' && search.trim().length > 0) {
    const escapedSearch = escapeRegex(search.trim());
    const searchRegex = new RegExp(escapedSearch, 'i');
    const searchConditions = [
      { title: searchRegex },
      { message: searchRegex },
      { actorName: searchRegex },
      { type: searchRegex },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  // 3. Type filtering
  if (typeof type === 'string' && type.trim().length > 0 && type.trim().toLowerCase() !== 'all') {
    filter.type = type.trim();
  }

  // 4. Unread filter
  if (unreadOnly) {
    filter['readBy.userId'] = { $ne: userId };
  }

  return filter;
};

/**
 * GET /api/v1/notifications
 * Retrieve paginated notifications based on role hierarchy
 */
export const getNotifications = catchAsync(async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page), 10) || 1);
  const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit), 10) || 15));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';
  const unreadOnly = req.query.unread === 'true' || req.query.unread === true;
  const skip = (page - 1) * limit;

  const filter = buildNotificationFilter({
    user: req.user,
    search,
    type,
    unreadOnly,
  });

  const userIdStr = (req.user._id || req.user.id).toString();

  const [notifications, totalCount, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate('actorId', 'firstName lastName email role profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments(
      buildNotificationFilter({
        user: req.user,
        unreadOnly: true,
      })
    ),
  ]);

  const sanitized = notifications.map((n) => {
    const isRead =
      Array.isArray(n.readBy) && n.readBy.some((r) => r.userId?.toString() === userIdStr);
    return {
      id: n._id.toString(),
      notificationId: n.notificationId,
      title: n.title,
      message: n.message,
      type: n.type,
      targetRole: n.targetRole,
      actorName: n.actorName,
      actorRole: n.actorRole,
      actor: n.actorId
        ? {
            id: n.actorId._id?.toString() || '',
            name: `${n.actorId.firstName || ''} ${n.actorId.lastName || ''}`.trim(),
            email: n.actorId.email || '',
            role: n.actorId.role || '',
          }
        : null,
      isRead,
      createdAt: n.createdAt,
    };
  });

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return res.status(200).json({
    success: true,
    pagination: {
      totalItems: totalCount,
      totalPages,
      currentPage: page,
      limit,
      unreadCount,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: sanitized,
  });
});

/**
 * GET /api/v1/notifications/unread-count
 * Quick retrieval of unread notifications count for badge UI
 */
export const getUnreadNotificationsCount = catchAsync(async (req, res) => {
  const filter = buildNotificationFilter({
    user: req.user,
    unreadOnly: true,
  });

  const unreadCount = await Notification.countDocuments(filter);

  return res.status(200).json({
    success: true,
    data: {
      unreadCount,
    },
  });
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a single notification as read for current user
 */
export const markNotificationAsRead = catchAsync(async (req, res) => {
  const id = String(req.params.id);
  const userId = req.user._id || req.user.id;

  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id, isDeleted: { $ne: true } }
    : { notificationId: id, isDeleted: { $ne: true } };

  const notification = await Notification.findOne(query);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found.',
    });
  }

  const alreadyRead = notification.readBy.some((r) => r.userId.toString() === userId.toString());

  if (!alreadyRead) {
    notification.readBy.push({ userId, readAt: new Date() });
    await notification.save();
  }

  return res.status(200).json({
    success: true,
    message: 'Notification marked as read.',
    data: {
      id: notification._id.toString(),
      isRead: true,
    },
  });
});

/**
 * POST /api/v1/notifications/read-all
 * Mark all accessible unread notifications as read for current user
 */
export const markAllNotificationsAsRead = catchAsync(async (req, res) => {
  const userId = req.user._id || req.user.id;

  const filter = buildNotificationFilter({
    user: req.user,
    unreadOnly: true,
  });

  await Notification.updateMany(filter, {
    $addToSet: {
      readBy: {
        userId,
        readAt: new Date(),
      },
    },
  });

  return res.status(200).json({
    success: true,
    message: 'All notifications marked as read.',
  });
});

/**
 * DELETE /api/v1/notifications/:id
 * Soft-delete or dismiss a notification
 */
export const deleteNotification = catchAsync(async (req, res) => {
  const id = String(req.params.id);

  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id, isDeleted: { $ne: true } }
    : { notificationId: id, isDeleted: { $ne: true } };

  const notification = await Notification.findOne(query);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found.',
    });
  }

  notification.isDeleted = true;
  notification.deletedAt = new Date();
  await notification.save();

  return res.status(200).json({
    success: true,
    message: 'Notification deleted successfully.',
    data: { id: notification._id.toString() },
  });
});
