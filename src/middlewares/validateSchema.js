export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      // Extract clean, readable error messages
      const errorMessages = error.details.map((detail) => detail.message);
      
      return res.status(400).json({
        success: false,
        errors: errorMessages
      });
    }
    
    next(); // Data is perfectly fine, move to the controller
  };
};