const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const AppError = require('../helpers/apperror');
const ctrl = require('../controllers/user-shift-rate.controller');

const authorizeRoles = (...roles) => (req, res, next) => {
  const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const allow = roles.flat().map(r => String(r).toLowerCase());
  const ok = userRoles.some(r => allow.includes(String(r).toLowerCase()));
  if (!ok) return next(new AppError('Forbidden', 403));
  return next();
};

router.use(authenticate);

router.get('/meta', authorizeRoles('admin', 'finance'), ctrl.meta);
router.get('/', authorizeRoles('admin', 'finance'), ctrl.list);
router.post('/', authorizeRoles('admin', 'finance'), ctrl.create);
router.put('/:id', authorizeRoles('admin', 'finance'), ctrl.update);

module.exports = router;
