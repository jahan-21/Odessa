const mongoose = require('mongoose');
const { AppError } = require('./errorHandler');

function validateObjectId(paramName) {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return next(
        new AppError(
          `Invalid parameter: "${paramName}" must be a valid 24-character hexadecimal ID.`,
          400,
          'INVALID_ID_FORMAT'
        )
      );
    }
    next();
  };
}

module.exports = {
  validateObjectId
};
