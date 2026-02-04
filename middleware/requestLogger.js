const log = require('../helpers/log.helper');

module.exports = (req, res, next) => {
  log.info('Incoming request', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userId: req.user?._id || null
  });

  next();
};
