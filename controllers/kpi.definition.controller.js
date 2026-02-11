const KpiDefinition = require('../model/kpi-definition.model');
const AppError = require('../helpers/apperror');
const asyncHandler = require('../helpers/async.handler');
const response = require('../helpers/response');

const normalizeCode = (value) => String(value || '').trim().toUpperCase();

exports.list = asyncHandler(async (req, res) => {
  const items = await KpiDefinition.find().sort({ order: 1, code: 1 });
  response.success(res, items, 'KPI definitions loaded');
});

exports.create = asyncHandler(async (req, res) => {
  const { code, name, description, valueType, required, options, unit, status, order, meta } = req.body || {};

  if (!code || !name) {
    throw new AppError('code and name are required', 400);
  }

  try {
    const doc = await KpiDefinition.create({
      code: normalizeCode(code),
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      valueType: valueType || 'number',
      required: !!required,
      options: Array.isArray(options) ? options.map(v => String(v).trim()).filter(Boolean) : [],
      unit: unit ? String(unit).trim() : '',
      status: status || 'ACTIVE',
      order: Number.isFinite(order) ? order : 0,
      meta: meta || {},
      createdBy: req.user?._id || null
    });

    response.success(res, doc, 'KPI definition created', 201);
  } catch (err) {
    if (err && err.code === 11000) {
      throw new AppError('KPI definition code already exists', 400);
    }
    throw err;
  }
});

exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, valueType, required, options, unit, status, order, meta } = req.body || {};

  if (req.body?.code) {
    throw new AppError('Cannot change code', 400);
  }

  const doc = await KpiDefinition.findById(id);
  if (!doc) throw new AppError('KPI definition not found', 404);

  if (name !== undefined) doc.name = String(name).trim();
  if (description !== undefined) doc.description = String(description).trim();
  if (valueType !== undefined) doc.valueType = valueType;
  if (required !== undefined) doc.required = !!required;
  if (options !== undefined) {
    doc.options = Array.isArray(options) ? options.map(v => String(v).trim()).filter(Boolean) : [];
  }
  if (unit !== undefined) doc.unit = String(unit).trim();
  if (status && ['ACTIVE', 'INACTIVE'].includes(status)) doc.status = status;
  if (order !== undefined && order !== null && order !== '') doc.order = Number(order);
  if (meta !== undefined) doc.meta = meta;

  await doc.save();
  response.success(res, doc, 'KPI definition updated');
});
