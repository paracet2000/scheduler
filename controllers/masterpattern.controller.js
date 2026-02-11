const MasterPattern = require('../model/masterpattern.model');
const AppError = require('../helpers/apperror');
const Configuration = require('../model/configuration.model');
const asyncHandler = require('../helpers/async.handler');

const ensureAdminOrHr = (user) => {
  // role check removed; access is controlled by menu rights on frontend
};

const normalizeDayCodes = (dayCodes, allowed = null) => {
  if (!Array.isArray(dayCodes)) return Array(7).fill('');
  const normalized = dayCodes.map(v => (v ? String(v).trim().toUpperCase() : ''));
  const filtered = allowed
    ? normalized.map(v => (allowed.has(v) ? v : ''))
    : normalized;
  const filled = filtered.slice(0, 7);
  while (filled.length < 7) filled.push('');
  return filled;
};

const getShiftCodeSet = async () => {
  const shifts = await Configuration.find({ typ_code: 'SHIFT' })
    .select('conf_code')
    .lean();
  return new Set(
    shifts.map(s => String(s.conf_code || '').trim().toUpperCase()).filter(Boolean)
  );
};

/**
 * @desc    List master patterns
 * @route   GET /api/master-patterns
 */
exports.list = asyncHandler(async (req, res) => {
  const items = await MasterPattern.find({ status: 'ACTIVE' })
    .sort({ order: 1, code: 1 });

  res.json({
    result: true,
    data: items,
    message: 'Success',
  });
});

/**
 * @desc    Create master pattern
 * @route   POST /api/master-patterns
 */
exports.create = asyncHandler(async (req, res) => {
  ensureAdminOrHr(req.user);

  const { code, name, description, dayCodes, order, meta } = req.body;

  if (!code || !name) {
    throw new AppError('code and name are required', 400);
  }

  const allowed = await getShiftCodeSet();
  const pattern = await MasterPattern.create({
    code,
    name,
    description,
    dayCodes: normalizeDayCodes(dayCodes, allowed),
    order: order ?? 0,
    meta: meta || {},
    createdBy: req.user._id,
  });

  res.status(201).json({
    result: true,
    data: pattern,
    message: 'Master pattern created',
  });
});

/**
 * @desc    Update master pattern
 * @route   PUT /api/master-patterns/:id
 */
exports.update = asyncHandler(async (req, res) => {
  ensureAdminOrHr(req.user);

  const { id } = req.params;
  const { name, description, dayCodes, status, order, meta } = req.body;

  const pattern = await MasterPattern.findById(id);
  if (!pattern) {
    throw new AppError('Master pattern not found', 404);
  }

  if (req.body.code) {
    throw new AppError('Cannot change code', 400);
  }

  if (name !== undefined) pattern.name = name;
  if (description !== undefined) pattern.description = description;
  if (dayCodes !== undefined) {
    const allowed = await getShiftCodeSet();
    pattern.dayCodes = normalizeDayCodes(dayCodes, allowed);
  }
  if (order !== undefined) pattern.order = order;
  if (meta !== undefined) pattern.meta = meta;

  if (status && ['ACTIVE', 'INACTIVE'].includes(status)) {
    pattern.status = status;
  }

  await pattern.save();

  res.json({
    result: true,
    data: pattern,
    message: 'Master pattern updated',
  });
});

/**
 * @desc    Soft delete master pattern
 * @route   DELETE /api/master-patterns/:id
 */
exports.remove = asyncHandler(async (req, res) => {
  ensureAdminOrHr(req.user);

  const { id } = req.params;
  const pattern = await MasterPattern.findById(id);
  if (!pattern) {
    throw new AppError('Master pattern not found', 404);
  }

  pattern.status = 'INACTIVE';
  await pattern.save();

  res.json({
    result: true,
    data: pattern,
    message: 'Master pattern set to INACTIVE',
  });
});
