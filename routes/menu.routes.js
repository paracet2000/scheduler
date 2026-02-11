const express = require('express');
const router = express.Router();

const controller = require('../controllers/menu.controller');

// public: list active menus
router.get('/', controller.listActive);

module.exports = router;
