const Master = require('../models/master.model');
const AppError = require('../helpers/apperror');
const asyncHandler = require('../helpers/asyncHandler');

/**
 * =========================
 * List master by type
 * GET /api/masters/:type
 * =========================
 */
exports.listByType = asyncHandler(async (req, res) => {
  const type = req.params.type.toUpperCase();

  const items = await Master.find({
    type,
    status: 'ACTIVE',
  }).sort({ code: 1 });

  res.json({
    result: true,
    data: items,
    message: 'Success',
  });
});

/**
 * =========================
 * Create master
 * POST /api/masters
 * =========================
 */
exports.create = asyncHandler(async (req, res) => {
  const { code, name, description, type, meta } = req.body;

  if (!code || !name || !type) {
    throw new AppError('code, name and type are required', 400);
  }

  const master = await Master.create({
    code,
    name,
    description,
    type: type.toUpperCase(),
    meta: meta || {},
    createdBy: req.user.id,
  });

  res.status(201).json({
    result: true,
    data: master,
    message: 'Master created',
  });
});

/**
 * =========================
 * Update master
 * PUT /api/masters/:id
 * =========================
 */
exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, meta, status } = req.body;

  const master = await Master.findById(id);
  if (!master) {
    throw new AppError('Master not found', 404);
  }

  // ❗ code และ type ห้ามแก้ (freeze contract)
  if (req.body.code || req.body.type) {
    throw new AppError('Cannot change code or type', 400);
  }

  if (name !== undefined) master.name = name;
  if (description !== undefined) master.description = description;
  if (meta !== undefined) master.meta = meta;

  // soft toggle
  if (status && ['ACTIVE', 'INACTIVE'].includes(status)) {
    master.status = status;
  }

  await master.save();

  res.json({
    result: true,
    data: master,
    message: 'Master updated',
  });
});

/**
 * =========================
 * Soft delete master
 * DELETE /api/masters/:id
 * =========================
 */
exports.remove = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const master = await Master.findById(id);
  if (!master) {
    throw new AppError('Master not found', 404);
  }

  // soft delete only
  master.status = 'INACTIVE';
  await master.save();

  res.json({
    result: true,
    data: master,
    message: 'Master set to INACTIVE',
  });
});
