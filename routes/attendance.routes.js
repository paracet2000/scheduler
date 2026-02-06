const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const AppError = require('../helpers/apperror');
const controller = require('../controllers/attendance.controller');

const authorizeRoles = (...roles) => (req, res, next) => {
  const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const allow = roles.flat().map(r => String(r).toLowerCase());
  const ok = userRoles.some(r => allow.includes(String(r).toLowerCase()));
  if (!ok) return next(new AppError('Forbidden', 403));
  return next();
};

router.use(authenticate);

router.post('/sync', authorizeRoles('hr', 'admin'), controller.sync);

module.exports = router;
