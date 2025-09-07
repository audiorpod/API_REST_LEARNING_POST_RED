const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`Error ${err.status || 500}: ${err.message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error response
  let status = err.status || 500;
  let message = 'Internal Server Error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation Error';
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid Token';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token Expired';
  } else if (err.code === '23505') { // PostgreSQL unique violation
    status = 409;
    message = 'Resource already exists';
  } else if (err.code === '23503') { // PostgreSQL foreign key violation
    status = 400;
    message = 'Invalid reference';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && status === 500) {
    message = 'Internal Server Error';
  } else if (process.env.NODE_ENV !== 'production') {
    message = err.message;
  }

  res.status(status).json({
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = errorHandler;