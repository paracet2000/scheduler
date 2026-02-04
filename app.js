// app.js
const express = require('express');
const cors = require('cors');

const AppError = require('./helpers/apperror');
const requestLogger = require('./middleware/requestLogger');

const app = express();

/* =========================
 * Global Middlewares
 * ========================= */
app.use(cors());
app.use(express.json());
app.use(requestLogger);

/* =========================
 * Routes
 * ========================= */
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/masters', require('./routes/master.routes'));
app.use('/api/user-wards', require('./routes/userward.routes'));
app.use('/api/schedules', require('./routes/schedule.routes'));
app.use('/api/changes', require('./routes/change.routes'));

/* =========================
 * 404 Handler
 * ========================= */
app.use((req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

/* =========================
 * Global Error Handler
 * ========================= */
app.use((err, req, res, next) => {
  const status = err.status || 500;

  res.status(status).json({
    result: false,
    message: err.message || 'Internal server error',
    data: null,
  });
});

module.exports = app;
