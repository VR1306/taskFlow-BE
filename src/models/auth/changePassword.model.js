import Joi from 'joi';

export const changePasswordValidationSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Current password is required',
    'any.required': 'Current password is required',
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.empty': 'New password is required',
    'string.min': 'New password must be at least 8 characters long',
    'any.required': 'New password is required',
  }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'string.empty': 'Confirm password is required',
    'any.only': 'New passwords do not match',
    'any.required': 'Confirm password is required',
  }),
});

export default changePasswordValidationSchema;
