export const validateRequest = (schema) => {
  return (req, res, next) => {
    if (!schema) return next();

    // Joi Schema Validation
    if (typeof schema.validate === 'function') {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false, // Return all errors instead of stopping at first
        stripUnknown: true, // Strip fields not defined in schema
      });

      if (error) {
        const errorMessages = error.details.map((detail) => detail.message);
        return res.status(400).json({
          success: false,
          errors: errorMessages,
        });
      }

      req.body = value;
      return next();
    }

    // Mongoose Model / Fallback Validation
    if (schema.schema || typeof schema === 'function') {
      try {
        const doc = new schema(req.body);
        const validationError = doc.validateSync();
        if (validationError?.errors) {
          const errorMessages = Object.values(validationError.errors).map((err) => err.message);
          return res.status(400).json({
            success: false,
            errors: errorMessages,
          });
        }
      } catch (err) {
        return res.status(400).json({
          success: false,
          errors: [err.message],
        });
      }
    }

    next();
  };
};
