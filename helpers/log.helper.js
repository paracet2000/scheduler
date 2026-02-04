const logger = require('../config/logger');

module.exports = {
  info(message, meta = {}) {
    logger.info(message, meta);
  },

  warn(message, meta = {}) {
    logger.warn(message, meta);
  },

  error(message, meta = {}) {
    logger.error(message, meta);
  }
};
