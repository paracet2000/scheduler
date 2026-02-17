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

function toMaybeTrimmedString(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

function normalizeMenuPayload(item) {
  const mnu_code = toMaybeTrimmedString(item?.mnu_code) || '';
  const mnu_name = toMaybeTrimmedString(item?.mnu_name || item?.mnu_description || item?.mnu_code) || '';
  const mnu_description = toMaybeTrimmedString(item?.mnu_description || item?.mnu_name) || '';
  const mnu_icon = toMaybeTrimmedString(item?.mnu_icon);
  const rawStatus = toMaybeTrimmedString(item?.mnu_status);
  const mnu_status = rawStatus ? rawStatus.toUpperCase() : undefined;

  if (!mnu_code) {
    throw new AppError('mnu_code is required', 400);
  }
  if (!mnu_description) {
    throw new AppError(`mnu_description is required for ${mnu_code}`, 400);
  }
  if (mnu_status && mnu_status !== 'ACTIVE' && mnu_status !== 'INACTIVE') {
    throw new AppError(`mnu_status must be ACTIVE or INACTIVE for ${mnu_code}`, 400);
  }

  const normalized = {
    mnu_code,
    mnu_name: mnu_name || mnu_description,
    mnu_description
  };

  if (mnu_icon !== undefined) normalized.mnu_icon = mnu_icon;
  if (mnu_status !== undefined) normalized.mnu_status = mnu_status;

  return normalized;
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

exports.bulkUpsert = asyncHandler(async (req, res) => {
  const body = req.body;
  const source = Array.isArray(body)
    ? body
    : (Array.isArray(body?.data) ? body.data : null);

  if (!Array.isArray(source)) {
    throw new AppError('Request body must be an array of menus, or { data: [...] }', 400);
  }
  if (!source.length) {
    throw new AppError('Menu list is empty', 400);
  }

  const dedupe = new Map();
  source.forEach((item) => {
    const normalized = normalizeMenuPayload(item);
    dedupe.set(normalized.mnu_code, normalized);
  });

  const cleaned = Array.from(dedupe.values());
  const dryRun = String(req.query?.dryRun || req.body?.dryRun || '').trim() === '1';

  if (dryRun) {
    return response.success(res, {
      received: source.length,
      valid: cleaned.length,
      duplicateIgnored: source.length - cleaned.length,
      preview: cleaned.slice(0, 10)
    }, 'Menu import dry-run complete');
  }

  const ops = cleaned.map((m) => {
    const $set = {
      mnu_name: m.mnu_name || m.mnu_description,
      mnu_description: m.mnu_description
    };
    if (m.mnu_icon !== undefined) $set.mnu_icon = m.mnu_icon;
    if (m.mnu_status !== undefined) $set.mnu_status = m.mnu_status;

    return {
      updateOne: {
        filter: { mnu_code: m.mnu_code },
        update: { $set },
        upsert: true
      }
    };
  });

  const result = await Menu.bulkWrite(ops, { ordered: false });
  return response.success(res, {
    received: source.length,
    valid: cleaned.length,
    duplicateIgnored: source.length - cleaned.length,
    upserted: Number(result.upsertedCount || 0),
    modified: Number(result.modifiedCount || 0),
    matched: Number(result.matchedCount || 0)
  }, 'Menus imported');
});
