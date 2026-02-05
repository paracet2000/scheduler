const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/mastertype.controller');
const auth = require('../middleware/authenticate');

/**
 * =========================
 * Master Type Routes
 * =========================
 */

/**
 * @route   GET /api/master-types
 * @desc    List master types
 * @access  Authenticated
 */
router.get('/', auth, ctrl.list);

/**
 * @route   POST /api/master-types
 * @desc    Create master type
 * @access  Admin / HR
 */
router.post('/', auth, ctrl.create);

/**
 * @route   PUT /api/master-types/:id
 * @desc    Update master type
 * @access  Admin / HR
 */
router.put('/:id', auth, ctrl.update);

/**
 * @route   DELETE /api/master-types/:id
 * @desc    Soft delete (set status = INACTIVE)
 * @access  Admin / HR
 */
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
