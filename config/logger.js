const { createLogger, format, transports } = require('winston');

const isProduction = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

/* optional: log to file (local/dev) */
if (!isProduction) {
  logger.add(
    new transports.File({ filename: 'logs/error.log', level: 'error' })
  );
  logger.add(
    new transports.File({ filename: 'logs/combined.log' })
  );
}

module.exports = logger;
