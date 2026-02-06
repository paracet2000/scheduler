const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const AppError = require('../helpers/apperror');
const wardMemberController = require('../controllers/wardmember.controller');

const authorizeRoles = (...roles) => (req, res, next) => {
  const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const allow = roles.flat().map(r => String(r).toLowerCase());
  const ok = userRoles.some(r => allow.includes(String(r).toLowerCase()));
  if (!ok) return next(new AppError('Forbidden', 403));
  return next();
};

router.use(authenticate);

router.get('/meta', authorizeRoles('head', 'admin'), wardMemberController.meta);
router.get('/mine', authorizeRoles('user', 'head', 'admin'), wardMemberController.myWards);
router.get('/users', authorizeRoles('user', 'head', 'admin'), wardMemberController.usersByWard);
router.get('/me', authorizeRoles('user', 'head', 'admin'), wardMemberController.meByWard);
router.get('/', authorizeRoles('head', 'admin'), wardMemberController.list);
router.post('/', authorizeRoles('head', 'admin'), wardMemberController.create);
router.put('/:id', authorizeRoles('head', 'admin'), wardMemberController.update);

module.exports = router;
