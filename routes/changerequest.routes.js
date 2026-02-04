const express = require('express');
const router = express.Router();

const changeRequestController = require('../controllers/changerequest.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

/**
 * =========================
 * Change / Swap / Leave
 * =========================
 * ทุก route ต้อง login ก่อน
 */
router.use(authenticate);

/**
 * -------------------------
 * USER
 * -------------------------
 */

/**
 * สร้างคำขอ (Leave / Swap / Change)
 */
router.post(
  '/',
  authorize(['user', 'head', 'admin']),
  changeRequestController.create
);

/**
 * ดูคำขอของตัวเอง
 */
router.get(
  '/my',
  authorize(['user', 'head', 'admin']),
  changeRequestController.getMyRequests
);

/**
 * ยกเลิกคำขอ (เฉพาะ status OPEN)
 */
router.patch(
  '/:id/cancel',
  authorize(['user', 'head', 'admin']),
  changeRequestController.cancel
);

/**
 * รับคำขอ (อาสามาแทน)
 */
router.patch(
  '/:id/accept',
  authorize(['user', 'head', 'admin']),
  changeRequestController.accept
);

/**
 * -------------------------
 * HEAD / APPROVER
 * -------------------------
 */

/**
 * ดูคำขอใน ward (filter ได้)
 * ?wardId=&status=&type=
 */
router.get(
  '/',
  authorize(['head', 'approver', 'admin']),
  changeRequestController.list
);

/**
 * approve คำขอ
 */
router.patch(
  '/:id/approve',
  authorize(['head', 'approver', 'admin']),
  changeRequestController.approve
);

/**
 * reject คำขอ
 */
router.patch(
  '/:id/reject',
  authorize(['head', 'approver', 'admin']),
  changeRequestController.reject
);

module.exports = router;
