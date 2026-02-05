const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/master.controller');
const auth = require('../middleware/authenticate');
const authorizeRole = require('../middleware/authorize-ward');

/**
 * =========================
 * Master Routes
 * =========================
 * ใช้สำหรับ reference data เช่น
 * - WARD
 * - SHIFT
 * - POSITION
 * - SHIFT_NOTATION
 */

/**
 * @route   GET /api/masters/:type
 * @desc    List master by type (WARD, SHIFT, POSITION, ...)
 * @access  Authenticated
 */
router.get('/:type', auth, ctrl.listByType);

/**
 * @route   POST /api/masters
 * @desc    Create master
 * @access  Admin / HR
 */
router.post(
  '/',
  auth,
  authorizeRole('admin', 'hr'),
  ctrl.create
);

/**
 * @route   PUT /api/masters/:id
 * @desc    Update master
 * @access  Admin / HR
 */
router.put(
  '/:id',
  auth,
  authorizeRole('admin', 'hr'),
  ctrl.update
);

/**
 * @route   DELETE /api/masters/:id
 * @desc    Soft delete (set status = INACTIVE)
 * @access  Admin / HR
 */
router.delete(
  '/:id',
  auth,
  authorizeRole('admin', 'hr'),
  ctrl.remove
);

module.exports = router;
