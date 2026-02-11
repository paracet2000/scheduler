const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const AppError = require('../helpers/apperror');
const controller = require('../controllers/codemapping.controller');

const authorizeRoles = () => (req, res, next) => next();

router.use(authenticate);

router.get('/meta', authorizeRoles('admin', 'hr'), controller.meta);
router.get('/', authorizeRoles('admin', 'hr'), controller.list);
router.post('/', authorizeRoles('admin', 'hr'), controller.create);
router.put('/:id', authorizeRoles('admin', 'hr'), controller.update);

module.exports = router;
