// routes/scheduler.head.router.js

const express = require('express');
const router = express.Router();

const {
  createSchedulerHead,
  openSchedulerHead,
  closeSchedulerHead,
  getSchedulerHeads,
  getActiveSchedulerHeadByWard,
} = require('../controllers/schedulerHead.controller');

const authorize = require('../middlewares/authorize');
const authenticate = require('../middlewares/authenticate');

/**
 * =========================
 * Scheduler Head Routes
 * =========================
 * HEAD / ADMIN เท่านั้น
 */

// list heads (ใช้ดูย้อนหลัง / audit)
router.get('/',authenticate,authorize('HEAD', 'ADMIN'),
  getSchedulerHeads
);

// ดูรอบที่ OPEN ของ ward (ใช้ตอน create schedule)
router.get('/ward/:wardId/active',authenticate,getActiveSchedulerHeadByWard
);

// สร้างรอบเวร (DRAFT)
router.post('/',authenticate,  authorize('HEAD', 'ADMIN'),  createSchedulerHead
);

// เปิดรอบเวร
router.patch(  '/:id/open',  authenticate,  authorize('HEAD', 'ADMIN'),  openSchedulerHead
);

// ปิดรอบเวร
router.patch(  '/:id/close',  authenticate,  authorize('HEAD', 'ADMIN'),  closeSchedulerHead
);

module.exports = router;
