import mongoose from 'mongoose';
import {
  NOTIFICATION_TARGET_ROLES,
  NOTIFICATION_ID_PREFIX,
} from '../../constants/permissions/permissions.constants.js';

export async function getNextNotificationId(model) {
  try {
    const lastDoc = await model
      .findOne({ notificationId: { $regex: /^NT\d+$/ } })
      .sort({ notificationId: -1 })
      .collation({ locale: 'en_US', numericOrdering: true })
      .lean();

    if (!lastDoc?.notificationId) {
      return `${NOTIFICATION_ID_PREFIX}0001`;
    }

    const match = lastDoc.notificationId.match(/^NT(\d+)$/);
    if (!match) {
      return `${NOTIFICATION_ID_PREFIX}0001`;
    }

    const nextNum = Number.parseInt(match[1], 10) + 1;
    const paddedNum = String(nextNum).padStart(4, '0');
    return `${NOTIFICATION_ID_PREFIX}${paddedNum}`;
  } catch {
    return `${NOTIFICATION_ID_PREFIX}0001`;
  }
}

const notificationSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GetAllUsers',
      default: null,
    },
    actorName: {
      type: String,
      default: 'System',
      trim: true,
    },
    actorRole: {
      type: String,
      default: 'System',
      trim: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GetAllUsers',
      default: null,
      index: true,
    },
    targetRole: {
      type: String,
      enum: NOTIFICATION_TARGET_ROLES,
      default: 'All',
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'GetAllUsers',
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, collection: 'notifications' }
);

notificationSchema.pre('save', async function () {
  if (!this.notificationId) {
    this.notificationId = await getNextNotificationId(this.constructor);
  }
});

const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
