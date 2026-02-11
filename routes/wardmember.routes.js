const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const AppError = require('../helpers/apperror');
const wardMemberController = require('../controllers/wardmember.controller');

const authorizeRoles = () => (req, res, next) => next();

router.use(authenticate);

router.get('/meta', authorizeRoles('head', 'admin'), wardMemberController.meta);
router.get('/mine', authorizeRoles('user', 'head', 'admin'), wardMemberController.myWards);
router.get('/users', authorizeRoles('user', 'head', 'admin'), wardMemberController.usersByWard);
router.get('/me', authorizeRoles('user', 'head', 'admin'), wardMemberController.meByWard);
router.get('/', authorizeRoles('head', 'admin'), wardMemberController.list);
router.post('/', authorizeRoles('head', 'admin'), wardMemberController.create);
router.put('/:id', authorizeRoles('head', 'admin'), wardMemberController.update);

module.exports = router;
