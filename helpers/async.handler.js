const log = require('./log.helper');

module.exports = fn => async (req, res, next) => {
 
  try {
    await fn(req, res, next);
  } catch (err) {
    log.error('Async handler caught error', {
      message: err.message,
      status: err.status || 500,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userId: req.user?._id || null,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });

    next(err);
  }
};
