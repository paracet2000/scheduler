const express = require('express');
const router = express.Router();

const auth = require('../middleware/authenticate');
const authorizeWard = require('../middleware/authorize-ward');
const ctrl = require('../controllers/schedule.controller');

/* =========================
 * User
 * ========================= */

// book ตารางเวร (ทั้งเดือน)
router.post(
  '/book',
  auth,
  ctrl.bookSchedule
);

// ดูตารางของตัวเอง
router.get(
  '/my',
  auth,
  ctrl.mySchedule
);

// check booking window by ward
router.get(
  '/head/:wardId',
  auth,
  ctrl.bookingWindow
);

/* =========================
 * Head / Admin
 * ========================= */

// ดูตารางราย ward
router.get(
  '/ward/:wardId',
  auth,
  authorizeWard(['HEAD', 'ADMIN']),
  ctrl.wardSchedule
);

// แก้ไขเวร
router.put(
  '/:id',
  auth,
  authorizeWard(['HEAD', 'ADMIN']),
  ctrl.updateSchedule
);

// activate (approve)
router.post(
  '/:id/activate',
  auth,
  authorizeWard(['HEAD', 'ADMIN']),
  ctrl.activateSchedule
);

module.exports = router;
