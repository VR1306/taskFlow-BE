import mongoose from 'mongoose';
import {
  TASK_STATUSES,
  TASK_DEFAULT_STATUS,
  TASK_TYPES,
  TASK_DEFAULT_TYPE,
  TASK_PRIORITIES,
  TASK_DEFAULT_PRIORITY,
} from '../../constants/permissions/permissions.constants.js';

const taskSchema = new mongoose.Schema(
  {
    // Human-readable per-project key, e.g. "ENG-1" — assigned by the controller using
    // Project.taskSequence, since it requires cross-document coordination.
    taskKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    type: {
      type: String,
      enum: TASK_TYPES,
      default: TASK_DEFAULT_TYPE,
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: TASK_DEFAULT_STATUS,
      index: true,
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: TASK_DEFAULT_PRIORITY,
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GetAllUsers',
      default: null,
      index: true,
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GetAllUsers',
      default: null,
    },
    labels: [
      {
        type: String,
        trim: true,
      },
    ],
    dueDate: {
      type: Date,
      default: null,
    },
    // Position within its status column, used to persist Kanban drag-and-drop ordering
    order: {
      type: Number,
      default: 0,
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
  { timestamps: true, collection: 'tasks' }
);

const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);

export default Task;
