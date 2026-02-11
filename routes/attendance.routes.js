const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const AppError = require('../helpers/apperror');
const controller = require('../controllers/attendance.controller');

const authorizeRoles = () => (req, res, next) => next();

router.use(authenticate);

router.post('/sync', authorizeRoles('hr', 'admin'), controller.sync);

module.exports = router;
