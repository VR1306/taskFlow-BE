import mongoose from 'mongoose';
import { COMMENT_ID_PREFIX } from '../../constants/permissions/permissions.constants.js';

export async function getNextCommentId(model) {
  try {
    const lastComment = await model
      .findOne({ commentId: { $regex: /^CMT\d+$/ } })
      .sort({ commentId: -1 })
      .collation({ locale: 'en_US', numericOrdering: true })
      .lean();

    if (!lastComment?.commentId) {
      return `${COMMENT_ID_PREFIX}0001`;
    }

    const match = lastComment.commentId.match(/^CMT(\d+)$/);
    if (!match) {
      return `${COMMENT_ID_PREFIX}0001`;
    }

    const nextNum = Number.parseInt(match[1], 10) + 1;
    const paddedNum = String(nextNum).padStart(4, '0');
    return `${COMMENT_ID_PREFIX}${paddedNum}`;
  } catch {
    return `${COMMENT_ID_PREFIX}0001`;
  }
}

const commentSchema = new mongoose.Schema(
  {
    commentId: {
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
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GetAllUsers',
      required: true,
    },
    body: {
      type: String,
      required: [true, 'Comment body is required'],
      trim: true,
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
  { timestamps: true, collection: 'comments' }
);

commentSchema.pre('save', async function () {
  if (!this.commentId) {
    this.commentId = await getNextCommentId(this.constructor);
  }
});

const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);

export default Comment;
