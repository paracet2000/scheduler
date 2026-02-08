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

// get schedule by user (head/admin or self)
router.get(
  '/user/:userId',
  auth,
  // TODO: Re-enable authorizeWard when ward-member mapping is ready.
  // authorizeWard(['HEAD', 'ADMIN']),
  ctrl.userScheduleById
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

// summary by ward (head/admin)
router.get(
  '/summary/:wardId',
  auth,
  // TODO: Re-enable authorizeWard when ward-member mapping is ready.
  // authorizeWard(['HEAD', 'ADMIN']),
  ctrl.summaryByWard
);

// summary by ward (range)
router.get(
  '/summary-range/:wardId',
  auth,
  // TODO: Re-enable authorizeWard when ward-member mapping is ready.
  // authorizeWard(['HEAD', 'ADMIN']),
  ctrl.summaryByWardRange
);

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
