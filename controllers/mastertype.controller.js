const MasterType = require('../model/mastertype.model');
const AppError = require('../helpers/apperror');
const asyncHandler = require('../helpers/async.handler');

const ensureAdminOrHr = (user) => {
  console.log('user Data in ensureAdminOrHr : ',user);
  const roles = user?.roles || [];
  if (!roles.includes('admin') && !roles.includes('hr')) {
    throw new AppError('Forbidden', 403);
  }
};

/**
 * =========================
 * List master types
 * GET /api/master-types
 * =========================
 */
exports.list = asyncHandler(async (req, res) => {
  const items = await MasterType.find({ status: 'ACTIVE' })
    .sort({ order: 1, code: 1 });

  res.json({
    result: true,
    data: items,
    message: 'Success',
  });
});

/**
 * =========================
 * Create master type
 * POST /api/master-types
 * =========================
 */
exports.create = asyncHandler(async (req, res) => {
  ensureAdminOrHr(req.user);

  const { code, name, description, order, meta } = req.body;

  if (!code || !name) {
    throw new AppError('code and name are required', 400);
  }

  const masterType = await MasterType.create({
    code,
    name,
    description,
    order: order ?? 0,
    meta: meta || undefined,
    createdBy: req.user.id,
  });

  res.status(201).json({
    result: true,
    data: masterType,
    message: 'Master type created',
  });
});

/**
 * =========================
 * Update master type
 * PUT /api/master-types/:id
 * =========================
 */
exports.update = asyncHandler(async (req, res) => {
  ensureAdminOrHr(req.user);

  const { id } = req.params;
  const { name, description, meta, status, order } = req.body;

  const masterType = await MasterType.findById(id);
  if (!masterType) {
    throw new AppError('Master type not found', 404);
  }

  if (req.body.code) {
    throw new AppError('Cannot change code', 400);
  }

  if (name !== undefined) masterType.name = name;
  if (description !== undefined) masterType.description = description;
  if (meta !== undefined) masterType.meta = meta;
  if (order !== undefined) masterType.order = order;

  if (status && ['ACTIVE', 'INACTIVE'].includes(status)) {
    masterType.status = status;
  }

  await masterType.save();

  res.json({
    result: true,
    data: masterType,
    message: 'Master type updated',
  });
});

/**
 * =========================
 * Soft delete master type
 * DELETE /api/master-types/:id
 * =========================
 */
exports.remove = asyncHandler(async (req, res) => {
  ensureAdminOrHr(req.user);

  const { id } = req.params;

  const masterType = await MasterType.findById(id);
  if (!masterType) {
    throw new AppError('Master type not found', 404);
  }

  masterType.status = 'INACTIVE';
  await masterType.save();

  res.json({
    result: true,
    data: masterType,
    message: 'Master type set to INACTIVE',
  });
});
