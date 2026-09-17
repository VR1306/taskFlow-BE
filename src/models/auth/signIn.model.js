import Joi from 'joi';

export const signInValidationSchema = Joi.object({
  email: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required',
    }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
    'any.required': 'Password is required',
  }),
  rememberMe: Joi.boolean().optional().default(false),
});

export default signInValidationSchema;
