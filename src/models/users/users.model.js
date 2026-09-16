import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
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
    profilePic: {
      type: String,
    },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
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
  // Only hash the password if it has been modified or is new
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
