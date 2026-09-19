import mongoose from 'mongoose';
import { VALID_ROLE_TYPES } from '../../constants/permissions/permissions.constants.js';

export async function getNextRoleId(model) {
  try {
    const lastRole = await model
      .findOne({ roleId: { $regex: /^RL\d+$/ } })
      .sort({ roleId: -1 })
      .collation({ locale: 'en_US', numericOrdering: true })
      .lean();

    if (!lastRole?.roleId) {
      return 'RL0001';
    }

    const match = lastRole.roleId.match(/^RL(\d+)$/);
    if (!match) {
      return 'RL0001';
    }

    const nextNum = Number.parseInt(match[1], 10) + 1;
    const paddedNum = String(nextNum).padStart(4, '0');
    return `RL${paddedNum}`;
  } catch {
    return 'RL0001';
  }
}

const roleSchema = new mongoose.Schema(
  {
    roleId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    roleType: {
      type: String,
      enum: VALID_ROLE_TYPES,
      default: 'Custom',
      index: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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
  {
    timestamps: true,
    collection: 'roles',
  }
);

// Prevent deletion of system roles via query middleware
roleSchema.pre(['deleteOne', 'findOneAndDelete', 'deleteMany'], async function () {
  const docToDelete = await this.model.findOne(this.getQuery());
  if (docToDelete?.isSystem || docToDelete?.name === 'Super Admin') {
    throw new Error('Deletion prohibited: System protected roles cannot be deleted.');
  }
});

const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);

export default Role;
