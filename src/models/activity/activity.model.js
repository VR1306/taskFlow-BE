import mongoose from 'mongoose';
import { ACTIVITY_ID_PREFIX } from '../../constants/permissions/permissions.constants.js';

export async function getNextActivityId(model) {
  try {
    const lastActivity = await model
      .findOne({ activityId: { $regex: /^ACT\d+$/ } })
      .sort({ activityId: -1 })
      .collation({ locale: 'en_US', numericOrdering: true })
      .lean();

    if (!lastActivity?.activityId) {
      return `${ACTIVITY_ID_PREFIX}0001`;
    }

    const match = lastActivity.activityId.match(/^ACT(\d+)$/);
    if (!match) {
      return `${ACTIVITY_ID_PREFIX}0001`;
    }

    const nextNum = Number.parseInt(match[1], 10) + 1;
    const paddedNum = String(nextNum).padStart(4, '0');
    return `${ACTIVITY_ID_PREFIX}${paddedNum}`;
  } catch {
    return `${ACTIVITY_ID_PREFIX}0001`;
  }
}

const activitySchema = new mongoose.Schema(
  {
    activityId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
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
    // 'created' | 'status_changed' | 'assigned' | 'priority_changed' | 'commented' | 'attachment_added'
    action: {
      type: String,
      required: true,
    },
    fromValue: {
      type: String,
      default: null,
    },
    toValue: {
      type: String,
      default: null,
    },
    message: {
      type: String,
      required: [true, 'Activity message is required'],
      trim: true,
    },
  },
  { timestamps: true, collection: 'activity_logs' }
);

activitySchema.pre('save', async function () {
  if (!this.activityId) {
    this.activityId = await getNextActivityId(this.constructor);
  }
});

const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activitySchema);

export default ActivityLog;
