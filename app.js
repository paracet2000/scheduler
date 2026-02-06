// app.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const AppError = require('./helpers/apperror');
const requestLogger = require('./middleware/request.logger');

const app = express();

/* =========================
 * Global Middlewares
 * ========================= */
app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:5173'
  ],
  credentials: true
}));
app.use(express.json());
app.use(requestLogger);
app.use('/uploads', express.static(path.resolve('uploads')));

/* =========================
 * Routes
 * ========================= */
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/masters', require('./routes/master.routes'));
app.use('/api/master-types', require('./routes/masterType.routes'));
app.use('/api/master-patterns', require('./routes/masterpattern.routes'));
app.use('/api/ward-members', require('./routes/wardmember.routes'));
app.use('/api/user-shift-rates', require('./routes/user-shift-rate.routes'));
app.use('/api/schedules', require('./routes/schedule.routes'));
app.use('/api/scheduler-heads', require('./routes/scheduler.head.router'));
app.use('/api/changes', require('./routes/changerequest.routes'));

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
