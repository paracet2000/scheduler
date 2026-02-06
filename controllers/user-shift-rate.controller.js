const UserShiftRate = require('../model/user-shift-rate.model');
const User = require('../model/user.model');
const Master = require('../model/base/master.schema');
const asyncHandler = require('../helpers/async.handler');
const AppError = require('../helpers/apperror');
const response = require('../helpers/response');

exports.meta = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select('name employeeCode email avatar')
    .sort({ createdAt: -1 });
  const shifts = await Master.find({ type: 'SHIFT', status: 'ACTIVE' })
    .select('code name');

  response.success(res, { users, shifts }, 'Meta loaded');
});

exports.list = asyncHandler(async (req, res) => {
  const { userIds, status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (userIds) {
    const ids = String(userIds).split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length) filter.userId = { $in: ids };
  }

  const items = await UserShiftRate.find(filter)
    .populate('userId', 'name employeeCode email avatar')
    .sort({ createdAt: -1 });

  response.success(res, items, 'User shift rates loaded');
});

exports.create = asyncHandler(async (req, res) => {
  const { userId, shiftCode, amount, currency, status } = req.body;
  if (!userId || !shiftCode || amount === undefined) {
    throw new AppError('userId, shiftCode and amount are required', 400);
  }

  const doc = await UserShiftRate.create({
    userId,
    shiftCode,
    amount,
    currency: currency || 'THB',
    status: status || 'ACTIVE'
  });

  response.success(res, doc, 'User shift rate created', 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, currency, status } = req.body;

  const doc = await UserShiftRate.findById(id);
  if (!doc) throw new AppError('User shift rate not found', 404);

  if (amount !== undefined) doc.amount = amount;
  if (currency) doc.currency = currency;
  if (status && ['ACTIVE', 'INACTIVE'].includes(status)) doc.status = status;

  await doc.save();
  response.success(res, doc, 'User shift rate updated');
});
