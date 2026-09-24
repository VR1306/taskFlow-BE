import Joi from 'joi';
import {
  USER_ROLES,
  USER_DEFAULT_ROLE,
} from '../../constants/permissions/permissions.constants.js';

export const createUserValidationSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required().messages({
    'string.empty': 'First name is required',
    'string.min': 'First name must be at least 2 characters long',
    'any.required': 'First name is required',
  }),
  lastName: Joi.string().trim().min(1).max(50).required().messages({
    'string.empty': 'Last name is required',
    'any.required': 'Last name is required',
  }),
  email: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required',
    }),
  role: Joi.string()
    .valid(...USER_ROLES)
    .default(USER_DEFAULT_ROLE)
    .messages({
      'any.only': `Role must be one of: ${USER_ROLES.join(', ')}`,
    }),
  isActive: Joi.boolean().default(true).messages({
    'boolean.base': 'isActive must be a boolean',
  }),
});

export default createUserValidationSchema;
