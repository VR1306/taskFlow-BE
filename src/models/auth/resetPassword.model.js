import Joi from 'joi';

export const resetPasswordValidationSchema = Joi.object({
  password: Joi.string().min(8).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'Password is required',
  }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'string.empty': 'Confirm password is required',
    'any.only': 'Passwords do not match',
    'any.required': 'Confirm password is required',
  }),
});

export default resetPasswordValidationSchema;
