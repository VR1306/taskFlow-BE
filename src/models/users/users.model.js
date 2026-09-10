import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    firstName:{
        type:String,
        required:[true, 'First name is required'] ,
        trim:true
    },
    lastName:{
        type:String,
        required:[true, 'Last name is required'] ,
        trim:true
    },
    email:{
        type:String,
        required:[true, 'Email is required'] ,
        unique:true,
        trim:true
    },
    password:{
        type:String,
        required:[true, 'Password is required'] ,
    },
    role:{
        type:String,
        enum:['Admin','User'],
        default:'User'
    },
    profilePic:{
        type:String,
    },
    signIn:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'SignIn'
    }
}, {timestamps:true})

userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified or is new
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Helper Method: Compare entered password with hashed password in database
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const GetAllUsers = mongoose.model('GetAllUsers',userSchema);

export default GetAllUsers;
