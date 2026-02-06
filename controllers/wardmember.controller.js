const WardMember = require('../model/ward-member.model');
const User = require('../model/user.model');
const Master = require('../model/base/master.schema');
const asyncHandler = require('../helpers/async.handler');
const AppError = require('../helpers/apperror');
const response = require('../helpers/response');

exports.list = asyncHandler(async (req, res) => {
  const { wardId, userId, status } = req.query;
  const filter = {};
  if (wardId) filter.wardId = wardId;
  if (userId) filter.userId = userId;
  if (status) filter.status = status;

  const items = await WardMember.find(filter)
    .populate('userId', 'name employeeCode email avatar')
    .populate('wardId', 'name code')
    .sort({ createdAt: -1 });

  response.success(res, items, 'User wards loaded');
});

exports.meta = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select('name employeeCode email avatar')
    .sort({ createdAt: -1 });
  const wards = await Master.find({ type: 'WARD', status: 'ACTIVE' })
    .select('name code');
  const positions = await Master.find({ type: 'POSITION', status: 'ACTIVE' })
    .select('code name');

  response.success(res, { users, wards, positions }, 'Meta loaded');
});

exports.usersByWard = asyncHandler(async (req, res) => {
  const { wardId, position, excludeSelf } = req.query;
  if (!wardId) throw new AppError('wardId is required', 400);

  const ward = await Master.findById(wardId).select('meta');
  if (!ward) throw new AppError('Ward not found', 404);

  const group = ward.meta?.group || null;
  let wardIds = [wardId];
  if (group) {
    const sameGroup = await Master.find({ type: 'WARD', 'meta.group': group })
      .select('_id')
      .lean();
    wardIds = sameGroup.map(w => w._id);
  }

  const query = { wardId: { $in: wardIds }, status: 'ACTIVE' };
  if (position) query.position = position;

  const items = await WardMember.find(query)
    .populate('userId', 'name employeeCode email avatar')
    .lean();

  const selfId = String(req.user?._id || '');
  const users = items
    .map(i => i.userId)
    .filter(Boolean)
    .filter(u => !excludeSelf || String(u._id) !== selfId);

  response.success(res, users, 'Users in ward group loaded');
});

exports.meByWard = asyncHandler(async (req, res) => {
  const { wardId } = req.query;
  if (!wardId) throw new AppError('wardId is required', 400);

  const doc = await WardMember.findOne({
    userId: req.user._id,
    wardId,
    status: 'ACTIVE'
  }).lean();

  if (!doc) throw new AppError('User ward not found', 404);
  response.success(res, doc, 'User ward loaded');
});

exports.create = asyncHandler(async (req, res) => {
  const { userId, wardId, position, roles, status } = req.body;
  if (!userId || !wardId || !position) {
    throw new AppError('userId, wardId and position are required', 400);
  }

  const doc = await WardMember.create({
    userId,
    wardId,
    position,
    roles: Array.isArray(roles) ? roles : ['USER'],
    status: status || 'ACTIVE',
    createdBy: req.user?._id || null
  });

  response.success(res, doc, 'User ward created', 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { position, roles, status } = req.body;

  const doc = await WardMember.findById(id);
  if (!doc) throw new AppError('User ward not found', 404);

  if (position !== undefined) doc.position = position;
  if (Array.isArray(roles)) doc.roles = roles;
  if (status && ['ACTIVE', 'INACTIVE'].includes(status)) doc.status = status;

  await doc.save();
  response.success(res, doc, 'User ward updated');
});

exports.myWards = asyncHandler(async (req, res) => {
  const items = await WardMember.find({
    userId: req.user._id,
    status: 'ACTIVE'
  })
    .populate('wardId', 'name code')
    .lean();

  const wards = items
    .map(i => i.wardId)
    .filter(Boolean)
    .map(w => ({ _id: w._id, name: w.name, code: w.code }));

  response.success(res, wards, 'My wards loaded');
});
