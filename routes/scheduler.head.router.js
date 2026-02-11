// routes/scheduler.head.router.js

const express = require('express');
const router = express.Router();

const {
  createSchedulerHead,
  openSchedulerHead,
  closeSchedulerHead,
  getSchedulerHeads,
  getActiveSchedulerHeadByWard,
} = require('../controllers/scheduler.head.controller');

const authenticate = require('../middleware/authenticate');
const AppError = require('../helpers/apperror');

const authorizeRoles = () => (req, res, next) => next();

/**
 * =========================
 * Scheduler Head Routes
 * =========================
 * HEAD / ADMIN เท่านั้น
 */

// list heads (ใช้ดูย้อนหลัง / audit)
router.get('/', authenticate, getSchedulerHeads);

// ดูรอบที่ OPEN ของ ward (ใช้ตอน create schedule)
router.get('/ward/:wardCode/active', authenticate, getActiveSchedulerHeadByWard
);

// สร้างรอบเวร (DRAFT)
router.post('/', authenticate, authorizeRoles('head', 'admin'), createSchedulerHead
);

// เปิดรอบเวร
router.patch('/:id/open', authenticate, authorizeRoles('head', 'admin'), openSchedulerHead
);

// ปิดรอบเวร
router.patch('/:id/close', authenticate, authorizeRoles('head', 'admin'), closeSchedulerHead
);

module.exports = router;
