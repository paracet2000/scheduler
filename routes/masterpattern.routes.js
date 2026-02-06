const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/masterpattern.controller');
const auth = require('../middleware/authenticate');

/**
 * Master Pattern Routes
 */
router.get('/', auth, ctrl.list);
router.post('/', auth, ctrl.create);
router.put('/:id', auth, ctrl.update);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
