// controllers/menu.controller.js
const Menu = require('../model/menu.model');
const MenuAuthorize = require('../model/menu.authorize.model');
const asyncHandler = require('../helpers/async.handler');
const response = require('../helpers/response');
const AppError = require('../helpers/apperror');

function normalizeMenuCode(code) {
  return String(code || '').trim().replace(/^\d+/, '');
}

function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMenuCodeFilter(code) {
  const raw = String(code || '').trim();
  const normalized = normalizeMenuCode(raw);
  const filters = [];
  if (raw) filters.push({ mnu_code: raw });
  if (normalized) {
    filters.push({ mnu_code: normalized });
    filters.push({ mnu_code: { $regex: new RegExp(`^\\d+${escapeRegex(normalized)}$`, 'i') } });
  }
  if (!filters.length) {
    return { mnu_code: '__invalid__' };
  }
  return filters.length === 1 ? filters[0] : { $or: filters };
}

exports.listActive = asyncHandler(async (req, res) => {
  const menus = await Menu.find({ mnu_status: 'ACTIVE' }).sort({ mnu_code: 1 });
  response.success(res, menus, 'Menus loaded');
});

exports.trackClick = asyncHandler(async (req, res) => {
  if (!req.user?._id) {
    throw new AppError('Unauthorized', 401);
  }

  const rawCode = String(req.params?.mnuCode || '').trim();
  if (!rawCode) {
    throw new AppError('mnuCode is required', 400);
  }

  const menu = await Menu.findOne({
    mnu_status: 'ACTIVE',
    ...buildMenuCodeFilter(rawCode)
  });
  if (!menu) {
    throw new AppError('Menu not found', 404);
  }

  const normalized = normalizeMenuCode(menu.mnu_code);
  const isSpecialGuestMenu = normalized === 'menuSignup' || normalized === 'menuLogin';

  if (!isSpecialGuestMenu) {
    const auth = await MenuAuthorize.findOne({
      userId: req.user._id,
      mnu_code: { $in: [...new Set([menu.mnu_code, normalized, rawCode, normalizeMenuCode(rawCode)])] },
      acc_read: 1
    }).lean();

    if (!auth) {
      throw new AppError('Forbidden: read access is required for this menu', 403);
    }
  }

  const now = new Date();
  const clicker = {
    userId: req.user._id,
    name: String(req.user.name || req.user.email || 'User').trim(),
    avatar: String(req.user.avatar || '').trim(),
    clickedAt: now
  };
  const userIdText = String(req.user._id);
  const currentClickers = Array.isArray(menu.last10Clicker) ? menu.last10Clicker : [];
  const nextClickers = [clicker, ...currentClickers.filter((c) => String(c?.userId || '') !== userIdText)].slice(0, 10);

  const updated = await Menu.findByIdAndUpdate(
    menu._id,
    {
      $inc: { mnu_clickCounter: 1 },
      $set: {
        mnu_lastClickedAt: now,
        last10Clicker: nextClickers
      }
    },
    {
      new: true,
      select: 'mnu_code mnu_clickCounter mnu_lastClickedAt last10Clicker'
    }
  ).lean();

  response.success(res, updated, 'Menu click tracked');
});
