const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authenticate');
const controller = require('../controllers/menu.authorize.controller');

router.use(authenticate);

// list menus authorized for current user
router.get('/me', controller.listMyMenus);
router.get('/menus', controller.listMenus);
router.get('/user/:userId', controller.listByUser);
router.post('/user/:userId', controller.upsertByUser);

module.exports = router;
