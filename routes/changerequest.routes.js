const express = require('express');
const router = express.Router();

const changeRequestController = require('../controllers/changerequest.controller');
const authenticate = require('../middleware/authenticate');
const AppError = require('../helpers/apperror');

const authorizeRoles = () => (req, res, next) => next();

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
  authorizeRoles(['user', 'head', 'admin']),
  changeRequestController.create
);

/**
 * ดูคำขอของตัวเอง
 */
router.get( '/my',  authorizeRoles(['user', 'head', 'admin']),  changeRequestController.list);
router.get( '/inbox',  authorizeRoles(['user', 'head', 'admin']),  changeRequestController.inbox);

/**
 * ยกเลิกคำขอ (เฉพาะ status OPEN)
 */
// router.patch(  '/:id/cancel',  authorize(['user', 'head', 'admin']),  changeRequestController.);

/**
 * รับคำขอ (อาสามาแทน)
 */
router.patch(  '/:id/accept',  authorizeRoles(['user', 'head', 'admin']),  changeRequestController.accept);

/**
 * -------------------------
 * HEAD / APPROVER
 * -------------------------

 */

/**
 * ดูคำขอใน ward (filter ได้)
 * ?wardId=&status=&type=
 */
router.get('/',  authorizeRoles(['head', 'approver', 'admin']),  changeRequestController.list);

/**
 * approve คำขอ
 */
router.patch(  '/:id/approve',  authorizeRoles(['head', 'approver', 'admin']),  changeRequestController.approve);

/**
 * reject คำขอ
 */
router.patch(  '/:id/reject',  authorizeRoles(['head', 'approver', 'admin']),  changeRequestController.reject);

module.exports = router;
