import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export async function getNextUserId(model) {
  try {
    const lastUser = await model
      .findOne({ userId: { $regex: /^TF\d+$/ } })
      .sort({ userId: -1 })
      .collation({ locale: 'en_US', numericOrdering: true })
      .lean();

    if (!lastUser || !lastUser.userId) {
      return 'TF0001';
    }

    const match = lastUser.userId.match(/^TF(\d+)$/);
    if (!match) {
      return 'TF0001';
    }

    const nextNum = Number.parseInt(match[1], 10) + 1;
    const paddedNum = String(nextNum).padStart(4, '0');
    return `TF${paddedNum}`;
  } catch {
    return 'TF0001';
  }
}

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    role: {
      type: String,
      enum: ['SuperAdmin', 'Admin', 'User'],
      default: 'User',
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
    profilePic: {
      type: String,
    },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    refreshTokens: [
      {
        token: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, collection: 'users' }
);

// Prevent SuperAdmin deletion (Query middleware)
userSchema.pre(['deleteOne', 'findOneAndDelete', 'deleteMany'], async function () {
  const docToDelete = await this.model.findOne(this.getQuery());
  if (
    docToDelete &&
    (docToDelete.role === 'SuperAdmin' || docToDelete.email === 'vijayaraghavan130699@gmail.com')
  ) {
    throw new Error('Deletion prohibited: SuperAdmin account cannot be deleted.');
  }
});

// Prevent SuperAdmin deletion (Document middleware: doc.deleteOne())
userSchema.pre('deleteOne', { document: true, query: false }, function () {
  if (this.role === 'SuperAdmin' || this.email === 'vijayaraghavan130699@gmail.com') {
    throw new Error('Deletion prohibited: SuperAdmin account cannot be deleted.');
  }
});

userSchema.pre('save', async function () {
  // 1. Assign sequential unique userId (e.g. TF0001, TF0002) if not already set
  if (!this.userId) {
    this.userId = await getNextUserId(this.constructor);
  }

  // 2. Only hash the password if it has been modified or is new
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Helper Method: Compare entered password with hashed password in database
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const GetAllUsers = mongoose.models.GetAllUsers || mongoose.model('GetAllUsers', userSchema);

export default GetAllUsers;
