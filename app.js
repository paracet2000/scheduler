const express = require('express');
const cors = require('cors');
const AppError = require('./helpers/AppError');

const app = express();

/* ---------- middlewares ---------- */
app.use(cors());
app.use(express.json());

/* optional request log */
const requestLogger = require('./middleware/requestLogger');
app.use(requestLogger);

/* ---------- routes ---------- */
app.use('/api/users', require('./routes/user.routes'));

/* ---------- 404 handler ---------- */
app.use((req, res, next) => {
  next(new AppError('Route not found', 404));
});

/* ---------- global error handler ---------- */
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    result: false,
    message: err.message || 'Internal server error',
    data: null
  });
});

module.exports = app;