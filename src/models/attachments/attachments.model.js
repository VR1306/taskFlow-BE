import mongoose from 'mongoose';
import { ATTACHMENT_ID_PREFIX } from '../../constants/permissions/permissions.constants.js';

export async function getNextAttachmentId(model) {
  try {
    const lastAttachment = await model
      .findOne({ attachmentId: { $regex: /^ATT\d+$/ } })
      .sort({ attachmentId: -1 })
      .collation({ locale: 'en_US', numericOrdering: true })
      .lean();

    if (!lastAttachment?.attachmentId) {
      return `${ATTACHMENT_ID_PREFIX}0001`;
    }

    const match = lastAttachment.attachmentId.match(/^ATT(\d+)$/);
    if (!match) {
      return `${ATTACHMENT_ID_PREFIX}0001`;
    }

    const nextNum = Number.parseInt(match[1], 10) + 1;
    const paddedNum = String(nextNum).padStart(4, '0');
    return `${ATTACHMENT_ID_PREFIX}${paddedNum}`;
  } catch {
    return `${ATTACHMENT_ID_PREFIX}0001`;
  }
}

// Attachment binary content is stored inline (Buffer) rather than on local disk,
// since the API runs as a serverless function with no persistent filesystem.
const attachmentSchema = new mongoose.Schema(
  {
    attachmentId: {
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
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GetAllUsers',
      required: true,
    },
    filename: {
      type: String,
      required: [true, 'Attachment filename is required'],
      trim: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
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
  { timestamps: true, collection: 'attachments' }
);

attachmentSchema.pre('save', async function () {
  if (!this.attachmentId) {
    this.attachmentId = await getNextAttachmentId(this.constructor);
  }
});

const Attachment = mongoose.models.Attachment || mongoose.model('Attachment', attachmentSchema);

export default Attachment;
