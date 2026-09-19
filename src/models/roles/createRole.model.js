import Joi from 'joi';
import { VALID_ROLE_TYPES } from '../../constants/permissions/permissions.constants.js';

export const createRoleValidationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60).required().messages({
    'string.empty': 'Role name is required',
    'string.min': 'Role name must be at least 2 characters long',
    'string.max': 'Role name cannot exceed 60 characters',
    'any.required': 'Role name is required',
  }),
  description: Joi.string().trim().max(300).allow('').default('').messages({
    'string.max': 'Description cannot exceed 300 characters',
  }),
  roleType: Joi.string()
    .valid(...VALID_ROLE_TYPES)
    .default('Custom')
    .messages({
      'any.only': `Role type must be one of: ${VALID_ROLE_TYPES.join(', ')}`,
    }),
  permissions: Joi.array().items(Joi.string().trim()).default([]).messages({
    'array.base': 'Permissions must be an array of permission keys',
  }),
  isActive: Joi.boolean().default(true).messages({
    'boolean.base': 'isActive must be a boolean',
  }),
});

export default createRoleValidationSchema;
