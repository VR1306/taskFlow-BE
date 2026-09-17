import Joi from 'joi';

export const refreshTokenValidationSchema = Joi.object({
  refreshToken: Joi.string().trim().required().messages({
    'string.empty': 'Refresh token is required',
    'any.required': 'Refresh token is required',
  }),
});

export default refreshTokenValidationSchema;
