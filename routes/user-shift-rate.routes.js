const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const AppError = require('../helpers/apperror');
const ctrl = require('../controllers/user-shift-rate.controller');

const authorizeRoles = () => (req, res, next) => next();

router.use(authenticate);

router.get('/meta', authorizeRoles('admin', 'finance'), ctrl.meta);
router.get('/', authorizeRoles('admin', 'finance'), ctrl.list);
router.post('/', authorizeRoles('admin', 'finance'), ctrl.create);
router.put('/:id', authorizeRoles('admin', 'finance'), ctrl.update);

module.exports = router;
