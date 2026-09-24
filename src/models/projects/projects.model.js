import mongoose from 'mongoose';
import {
  PROJECT_ID_PREFIX,
  PROJECT_STATUSES,
  PROJECT_DEFAULT_STATUS,
} from '../../constants/permissions/permissions.constants.js';

export async function getNextProjectId(model) {
  try {
    const lastProject = await model
      .findOne({ projectId: { $regex: /^PRJ\d+$/ } })
      .sort({ projectId: -1 })
      .collation({ locale: 'en_US', numericOrdering: true })
      .lean();

    if (!lastProject?.projectId) {
      return `${PROJECT_ID_PREFIX}0001`;
    }

    const match = lastProject.projectId.match(/^PRJ(\d+)$/);
    if (!match) {
      return `${PROJECT_ID_PREFIX}0001`;
    }

    const nextNum = Number.parseInt(match[1], 10) + 1;
    const paddedNum = String(nextNum).padStart(4, '0');
    return `${PROJECT_ID_PREFIX}${paddedNum}`;
  } catch {
    return `${PROJECT_ID_PREFIX}0001`;
  }
}

const projectSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    key: {
      type: String,
      required: [true, 'Project key is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GetAllUsers',
      default: null,
      index: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GetAllUsers',
      },
    ],
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: PROJECT_DEFAULT_STATUS,
      index: true,
    },
    // Atomically incremented to generate sequential per-project task keys (e.g. ENG-1, ENG-2)
    taskSequence: {
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
  { timestamps: true, collection: 'projects' }
);

projectSchema.pre('save', async function () {
  if (!this.projectId) {
    this.projectId = await getNextProjectId(this.constructor);
  }
});

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);

export default Project;
