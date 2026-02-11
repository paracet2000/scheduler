// controllers/scheduler.head.controller.js

const SchedulerHead = require('../model/scheduler.head.model');
const asyncHandler = require('../helpers/async.handler');
const AppError = require('../helpers/apperror');

/**
 * =========================
 * Create Scheduler Head (DRAFT)
 * =========================
 * HEAD / ADMIN
 */
exports.createSchedulerHead = asyncHandler(async (req, res) => {
  const { wardCode, periodStart, periodEnd, note } = req.body;
  const code = String(wardCode || '').trim().toUpperCase();

  if (!code || !periodStart || !periodEnd) {
    throw new AppError('wardCode, periodStart and periodEnd are required', 400);
  }

  const head = await SchedulerHead.create({
    wardCode: code,
    periodStart,
    periodEnd,
    note,
    status: 'DRAFT',
    createdBy: req.user._id,
  });

  res.status(201).json({
    result: 'success',
    message: 'Scheduler head created',
    data: head,
  });
});

/**
 * =========================
 * Open Scheduler Head
 * =========================
 * เปลี่ยนจาก DRAFT → OPEN
 */
exports.openSchedulerHead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const head = await SchedulerHead.findById(id);
  if (!head) {
    throw new AppError('Scheduler head not found', 404);
  }

  if (head.status !== 'DRAFT') {
    throw new AppError('Only DRAFT scheduler head can be opened', 400);
  }

  // ป้องกัน OPEN ซ้อนใน ward เดียวกัน
  const existingOpen = await SchedulerHead.findOne({
    wardCode: head.wardCode,
    status: 'OPEN',
  });

  if (existingOpen) {
    throw new AppError('Another OPEN scheduler head already exists for this ward', 409);
  }

  head.status = 'OPEN';
  head.openedAt = new Date();
  await head.save();

  res.json({
    result: 'success',
    message: 'Scheduler head opened',
    data: head,
  });
});

/**
 * =========================
 * Close Scheduler Head
 * =========================
 * เปลี่ยนจาก OPEN → CLOSED
 */
exports.closeSchedulerHead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const head = await SchedulerHead.findById(id);
  if (!head) {
    throw new AppError('Scheduler head not found', 404);
  }

  if (head.status !== 'OPEN') {
    throw new AppError('Only OPEN scheduler head can be closed', 400);
  }

  head.status = 'CLOSED';
  head.closedAt = new Date();
  await head.save();

  res.json({
    result: 'success',
    message: 'Scheduler head closed',
    data: head,
  });
});

/**
 * =========================
 * Get all Scheduler Heads (list / audit)
 * =========================
 * HEAD / ADMIN
 */
exports.getSchedulerHeads = asyncHandler(async (req, res) => {
  const { wardCode, status } = req.query;
  const code = String(wardCode || '').trim().toUpperCase();

  const filter = {};
  if (code) filter.wardCode = code;
  if (status) filter.status = status;

  const heads = await SchedulerHead.find(filter)
    .populate('createdBy', 'name role')
    .sort({ createdAt: -1 });

  res.json({
    result: 'success',
    message: 'Scheduler heads retrieved',
    data: heads,
  });
});

/**
 * =========================
 * Get ACTIVE (OPEN) Scheduler Head by Ward
 * =========================
 * ใช้ตอน create / edit schedule
 */
exports.getActiveSchedulerHeadByWard = asyncHandler(async (req, res) => {
  const { wardCode } = req.params;
  const code = String(wardCode || '').trim();

  const head = await SchedulerHead.findOne({
    wardCode: code,
    status: 'OPEN',
  });

  if (!head) {
    throw new AppError('No active scheduler head for this ward', 404);
  }

  res.json({
    result: 'success',
    message: 'Active scheduler head retrieved',
    data: head,
  });
});
