const log = require('../helpers/log.helper');
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  let userId = req.user?._id || null;
  if (!userId && req.headers.authorization?.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];
    try {
      const decoded = jwt.decode(token);
      userId = decoded?.id || null;
    } catch {
      userId = null;
    }
  }

  log.info('Incoming request', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userId
  });

  next();
};
