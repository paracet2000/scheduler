const CodeMapping = require('../model/code-mapping.model');
const User = require('../model/user.model');
const asyncHandler = require('../helpers/async.handler');
const AppError = require('../helpers/apperror');
const response = require('../helpers/response');

exports.list = asyncHandler(async (req, res) => {
  const { userId, status, deviceEmpCode } = req.query;
  const filter = {};
  if (userId) filter.userId = userId;
  if (status) filter.status = status;
  if (deviceEmpCode) filter.deviceEmpCode = String(deviceEmpCode).trim();

  const items = await CodeMapping.find(filter)
    .populate('userId', 'name employeeCode email avatar')
    .sort({ createdAt: -1 });

  response.success(res, items, 'Code mappings loaded');
});

exports.meta = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select('name employeeCode email avatar')
    .sort({ createdAt: -1 });

  response.success(res, { users }, 'Meta loaded');
});

exports.create = asyncHandler(async (req, res) => {
  const { deviceEmpCode, userId, status, meta } = req.body;
  if (!deviceEmpCode || !userId) {
    throw new AppError('deviceEmpCode and userId are required', 400);
  }

  const doc = await CodeMapping.create({
    deviceEmpCode: String(deviceEmpCode).trim(),
    userId,
    status: status || 'ACTIVE',
    meta: meta || {},
    createdBy: req.user?._id || null
  });

  response.success(res, doc, 'Code mapping created', 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deviceEmpCode, userId, status, meta } = req.body;

  const doc = await CodeMapping.findById(id);
  if (!doc) throw new AppError('Code mapping not found', 404);

  if (deviceEmpCode !== undefined) doc.deviceEmpCode = String(deviceEmpCode).trim();
  if (userId !== undefined) doc.userId = userId;
  if (status && ['ACTIVE', 'INACTIVE'].includes(status)) doc.status = status;
  if (meta !== undefined) doc.meta = meta;

  await doc.save();
  response.success(res, doc, 'Code mapping updated');
});
