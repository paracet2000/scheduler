// controllers/menu.authorize.controller.js
const MenuAuthorize = require('../model/menu.authorize.model');
const Menu = require('../model/menu.model');
const asyncHandler = require('../helpers/async.handler');
const response = require('../helpers/response');
const AppError = require('../helpers/apperror');

exports.listMyMenus = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }
  const menus = await MenuAuthorize.find({ userId: req.user._id }).sort({ mnu_code: 1 });
  response.success(res, menus, 'Menu authorizations loaded');
});

exports.listByUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new AppError('userId is required', 400);
  }
  const menus = await MenuAuthorize.find({ userId }).sort({ mnu_code: 1 });
  response.success(res, menus, 'Menu authorizations loaded');
});

exports.listMenus = asyncHandler(async (req, res) => {
  const menus = await Menu.find({ mnu_status: 'ACTIVE' })
    .select('mnu_code mnu_name mnu_description mnu_icon mnu_clickCounter mnu_lastClickedAt last10Clicker')
    .sort({ mnu_code: 1 });
  response.success(res, menus, 'Menus loaded');
});

exports.upsertByUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { permissions } = req.body || {};
  if (!userId) {
    throw new AppError('userId is required', 400);
  }
  if (!Array.isArray(permissions)) {
    throw new AppError('permissions must be an array', 400);
  }

  const normalized = permissions
    .map((p) => ({
      userId,
      mnu_code: String(p.mnu_code || '').trim(),
      acc_read: Number(p.acc_read) ? 1 : 0,
      acc_write: Number(p.acc_write) ? 1 : 0,
      acc_export: Number(p.acc_export) ? 1 : 0
    }))
    .filter((p) => p.mnu_code);

  const codes = normalized.map(p => p.mnu_code);
  await MenuAuthorize.deleteMany({ userId, mnu_code: { $nin: codes } });

  const ops = normalized.map((p) => ({
    updateOne: {
      filter: { userId, mnu_code: p.mnu_code },
      update: { $set: p },
      upsert: true
    }
  }));

  if (ops.length) {
    await MenuAuthorize.bulkWrite(ops, { ordered: false });
  }

  const current = await MenuAuthorize.find({ userId }).sort({ mnu_code: 1 });
  response.success(res, current, 'Menu authorizations updated');
});
