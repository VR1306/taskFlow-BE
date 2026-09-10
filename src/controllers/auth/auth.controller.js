import GetAllUsers from "../../models/users/users.model";
import jwt from 'jsonwebtoken';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// //Api controller for userRegister
// export const signUpUser = async (req, res) => {
//   try {
//     const { firstName,lastName, email, password, role } = req.body;

//     // Check if user already exists
//     const userExists = await GetAllUsers.findOne({ email });
//     if (userExists) {
//       return res.status(400).json({ success: false, message: 'User already exists' });
//     }

//     // Create user (the pre-save hook in userSchema hashes the password here!)
//     const user = await GetAllUsers.create({ firstName,lastName, email, password, role });

//     return res.status(200).json({
//       success: true,
//       message: 'User created successfully!',
//       user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, name: user.firstName + " " + user.lastName }
//     });
//   } catch (error) {
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };


//Api controller for signIn
export const SignInUserApiCall = async (req, response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return response.status(400).json({ message: "Email and password are required" });
        }
        
        const user = await GetAllUsers.findOne({email})
        if(!user){
            return response.status(404).json({ message: "User not found" });
        }
        
        const isPasswordValid = user.password === password;
        if(!isPasswordValid){
            return response.status(401).json({ message: "Invalid password" });
        }
        
      const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Sign-in successful!',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });

    } catch (error) {
        response.status(500).json({ message: "Internal server error" });
    }
}