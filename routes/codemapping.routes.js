const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const AppError = require('../helpers/apperror');
const controller = require('../controllers/codemapping.controller');

const authorizeRoles = (...roles) => (req, res, next) => {
  const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const allow = roles.flat().map(r => String(r).toLowerCase());
  const ok = userRoles.some(r => allow.includes(String(r).toLowerCase()));
  if (!ok) return next(new AppError('Forbidden', 403));
  return next();
};

router.use(authenticate);

router.get('/meta', authorizeRoles('admin', 'hr'), controller.meta);
router.get('/', authorizeRoles('admin', 'hr'), controller.list);
router.post('/', authorizeRoles('admin', 'hr'), controller.create);
router.put('/:id', authorizeRoles('admin', 'hr'), controller.update);

module.exports = router;
