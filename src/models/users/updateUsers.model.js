import Joi from 'joi';

export const updateUserValidationSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).messages({
    'string.empty': 'First name cannot be empty',
    'string.min': 'First name must be at least 2 characters long',
  }),
  lastName: Joi.string().trim().min(1).max(50).messages({
    'string.empty': 'Last name cannot be empty',
  }),
  email: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .messages({
      'string.empty': 'Email cannot be empty',
      'string.email': 'Please enter a valid email address',
    }),
  role: Joi.string().valid('User', 'Admin', 'SuperAdmin').messages({
    'any.only': 'Role must be either User, Admin, or SuperAdmin',
  }),
}).min(1);

export default updateUserValidationSchema;
