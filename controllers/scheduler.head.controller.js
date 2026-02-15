// controllers/scheduler.head.controller.js

const SchedulerHead = require('../model/scheduler.head.model');
const asyncHandler = require('../helpers/async.handler');
const AppError = require('../helpers/apperror');
const { toMonthYear } = require('../utils/month-year');

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

  const monthYear = toMonthYear(periodStart);
  if (!monthYear) {
    throw new AppError('periodStart is invalid', 400);
  }

  const existingMonth = await SchedulerHead.findOne({
    wardCode: code,
    monthYear,
  }).select('_id status');

  if (existingMonth) {
    throw new AppError(
      `Scheduler head already exists for ward ${code} in ${monthYear}`,
      409
    );
  }

  let head;
  try {
    head = await SchedulerHead.create({
      wardCode: code,
      periodStart,
      periodEnd,
      monthYear,
      note,
      status: 'DRAFT',
      createdBy: req.user._id,
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw new AppError(`Scheduler head already exists for ward ${code} in ${monthYear}`, 409);
    }
    throw err;
  }

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
 * Switch from DRAFT -> OPEN
 */
exports.openSchedulerHead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const head = await SchedulerHead.findById(id).select('_id wardCode monthYear periodStart status');
  if (!head) {
    throw new AppError('Scheduler head not found', 404);
  }

  if (head.status !== 'DRAFT') {
    throw new AppError('Only DRAFT scheduler head can be opened', 400);
  }

  const monthYear = head.monthYear || toMonthYear(head.periodStart);
  if (!monthYear) {
    throw new AppError('periodStart is invalid', 400);
  }

  // Prevent duplicate OPEN records in the same ward.
  const existingOpen = await SchedulerHead.findOne({
    wardCode: head.wardCode,
    monthYear,
    status: 'OPEN',
    _id: { $ne: head._id },
  }).select('_id');

  if (existingOpen) {
    throw new AppError(`Another OPEN scheduler head already exists for ${head.wardCode} (${monthYear})`, 409);
  }

  let updated;
  try {
    // Use atomic update to avoid full-document validation on legacy rows.
    updated = await SchedulerHead.findOneAndUpdate(
      { _id: head._id, status: 'DRAFT' },
      { $set: { status: 'OPEN', openedAt: new Date(), monthYear } },
      { new: true }
    );
  } catch (err) {
    if (err?.code === 11000) {
      throw new AppError(`Scheduler head already exists for ${head.wardCode} (${monthYear})`, 409);
    }
    throw err;
  }

  if (!updated) {
    throw new AppError('Scheduler head is no longer in DRAFT status', 409);
  }

  res.json({
    result: 'success',
    message: 'Scheduler head opened',
    data: updated,
  });
});

/**
 * =========================
 * Close Scheduler Head
 * =========================
 * Switch from OPEN -> CLOSED
 */
exports.closeSchedulerHead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const head = await SchedulerHead.findById(id).select('_id status');
  if (!head) {
    throw new AppError('Scheduler head not found', 404);
  }

  if (head.status !== 'OPEN') {
    throw new AppError('Only OPEN scheduler head can be closed', 400);
  }

  const updated = await SchedulerHead.findOneAndUpdate(
    { _id: head._id, status: 'OPEN' },
    { $set: { status: 'CLOSED', closedAt: new Date() } },
    { new: true }
  );

  if (!updated) {
    throw new AppError('Scheduler head is no longer in OPEN status', 409);
  }

  res.json({
    result: 'success',
    message: 'Scheduler head closed',
    data: updated,
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
 * Used when creating/editing schedules
 */
exports.getActiveSchedulerHeadByWard = asyncHandler(async (req, res) => {
  const { wardCode } = req.params;
  const code = String(wardCode || '').trim().toUpperCase();

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

