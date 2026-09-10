import mongoose from 'mongoose';

const signInSchema = new mongoose.Schema({
    email:{
        type:String,
        required:[true, 'Email is required'] ,
        unique:true,
        trim:true
    },
    password:{
        type:String,
        required:[true, 'Password is required'] ,
    }
},{timestamps:true});


const SignIn = mongoose.model('SignIn',signInSchema);

export default SignIn;