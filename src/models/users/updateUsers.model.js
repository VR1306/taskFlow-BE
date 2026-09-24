import Joi from 'joi';
import { USER_ROLES } from '../../constants/permissions/permissions.constants.js';

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
  role: Joi.string()
    .valid(...USER_ROLES)
    .messages({
      'any.only': `Role must be one of: ${USER_ROLES.join(', ')}`,
    }),
  isActive: Joi.boolean().messages({
    'boolean.base': 'isActive must be a boolean',
  }),
}).min(1);

export default updateUserValidationSchema;
