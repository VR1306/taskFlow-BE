import Joi from 'joi';
import { VALID_ROLE_TYPES } from '../../constants/permissions/permissions.constants.js';

export const updateRoleValidationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60).messages({
    'string.empty': 'Role name cannot be empty',
    'string.min': 'Role name must be at least 2 characters long',
    'string.max': 'Role name cannot exceed 60 characters',
  }),
  description: Joi.string().trim().max(300).allow('').messages({
    'string.max': 'Description cannot exceed 300 characters',
  }),
  roleType: Joi.string()
    .valid(...VALID_ROLE_TYPES)
    .messages({
      'any.only': `Role type must be one of: ${VALID_ROLE_TYPES.join(', ')}`,
    }),
  permissions: Joi.array().items(Joi.string().trim()).messages({
    'array.base': 'Permissions must be an array of permission keys',
  }),
  isActive: Joi.boolean().messages({
    'boolean.base': 'isActive must be a boolean',
  }),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided to update',
  });

export default updateRoleValidationSchema;
