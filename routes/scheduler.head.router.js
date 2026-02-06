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

const authorizeRoles = (...roles) => (req, res, next) => {
  const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const allow = roles.flat().map(r => String(r).toLowerCase());
  const ok = userRoles.some(r => allow.includes(String(r).toLowerCase()));
  if (!ok) {
    return next(new AppError('Forbidden', 403));
  }
  return next();
};

/**
 * =========================
 * Scheduler Head Routes
 * =========================
 * HEAD / ADMIN เท่านั้น
 */

// list heads (ใช้ดูย้อนหลัง / audit)
router.get('/', authenticate, authorizeRoles('head', 'admin'),
  getSchedulerHeads
);

// ดูรอบที่ OPEN ของ ward (ใช้ตอน create schedule)
router.get('/ward/:wardId/active', authenticate, getActiveSchedulerHeadByWard
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
