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
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:; connect-src 'self' https:;"
  );
  next();
});
app.use(express.json());
app.use(requestLogger);
app.use('/uploads', express.static(path.resolve('uploads')));
app.use(express.static(path.resolve(__dirname)));

/* =========================
 * Routes
 * ========================= */
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/configuration', require('./routes/configuration.routes'));
app.use('/api/master-types', require('./routes/mastertype.routes'));
app.use('/api/master-patterns', require('./routes/masterpattern.routes'));
app.use('/api/ward-members', require('./routes/wardmember.routes'));
app.use('/api/code-mappings', require('./routes/codemapping.routes'));
app.use('/api/user-shift-rates', require('./routes/user-shift-rate.routes'));
app.use('/api/attendance', require('./routes/attendance.routes'));
app.use('/api/kpi', require('./routes/kpi.routes'));
app.use('/api/kpi-definitions', require('./routes/kpi.definition.routes'));
app.use('/api/schedules', require('./routes/schedule.routes'));
app.use('/api/scheduler-heads', require('./routes/scheduler.head.router'));
app.use('/api/changes', require('./routes/changerequest.routes'));
app.use('/api/menus', require('./routes/menu.routes'));
app.use('/api/menu-authorize', require('./routes/menu.authorize.routes'));

/* =========================
 * Frontend (index.html)
 * ========================= */
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

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
  const statusCode = Number(err.statusCode || err.status) || 500;

  res.status(statusCode).json({
    result: false,
    message: err.message || 'Internal server error',
    data: null,
  });
});

module.exports = app;
