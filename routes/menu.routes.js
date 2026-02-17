const express = require('express');
const router = express.Router();

const controller = require('../controllers/menu.controller');
const authenticate = require('../middleware/authenticate');

// public: list active menus
router.get('/', controller.listActive);
router.post('/import', controller.bulkUpsert);
router.post('/bulk-upsert', controller.bulkUpsert);
router.post('/:mnuCode/click', authenticate, controller.trackClick);

module.exports = router;
