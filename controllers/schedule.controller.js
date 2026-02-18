const Schedule = require('../model/schedule.model');
const SchedulerHead = require('../model/scheduler.head.model');
const WardMember = require('../model/ward-member.model');
const CodeType = require('../model/configuration.model');
const User = require('../model/user.model');
const { parseConfValue } = require('../utils/config-meta');
const { toMonthYear } = require('../utils/month-year');
const AppError = require('../helpers/apperror');
const asyncHandler = require('../helpers/async.handler');
const response = require('../helpers/response');

const getValidShiftCodeSet = async () => {
  const shifts = await CodeType.find({ typ_code: 'SHIFT' })
    .select('conf_code code')
    .lean();
  return new Set(
    shifts
      .map((s) => String(s?.conf_code || s?.code || '').trim().toUpperCase())
      .filter(Boolean)
  );
};

const assertValidShiftCodes = (codes, validSet) => {
  const invalid = Array.from(
    new Set(
      (Array.isArray(codes) ? codes : [])
        .map((c) => String(c || '').trim().toUpperCase())
        .filter(Boolean)
        .filter((c) => !validSet.has(c))
    )
  );
  if (invalid.length) {
    throw new AppError(`Invalid shiftCode: ${invalid.join(', ')}`, 400);
  }
};

const normalizeShiftCodeValue = (value) =>
  String(value || '').toUpperCase().replace(/\s+/g, '').trim();

const parsePositionList = (positions) => {
  if (Array.isArray(positions)) {
    return positions.map((p) => String(p || '').trim()).filter(Boolean);
  }
  if (typeof positions === 'string' && positions.trim()) {
    return positions
      .split(',')
      .map((p) => String(p || '').trim())
      .filter(Boolean);
  }
  return [];
};

const buildSummaryRowsFromWardMembers = async ({ wardId, positionList, daysCount }) => {
  const userWardQuery = {
    wardId,
    status: 'ACTIVE'
  };

  if (Array.isArray(positionList) && positionList.length) {
    userWardQuery.position = { $in: positionList };
  }

  const userWards = await WardMember.find(userWardQuery)
    .select('userId position')
    .lean();

  const wardUserIds = Array.from(new Set(
    userWards
      .map((uw) => String(uw?.userId || '').trim())
      .filter((id) => /^[a-f0-9]{24}$/i.test(id))
  ));

  const users = wardUserIds.length
    ? await User.find({ _id: { $in: wardUserIds } })
        .select('name employeeCode empcode avatar')
        .lean()
    : [];

  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const rowsMap = new Map();

  userWards.forEach((uw) => {
    const userId = String(uw?.userId || '').trim();
    if (!/^[a-f0-9]{24}$/i.test(userId)) return;
    const user = userMap.get(userId) || {};
    const fallbackName = `User ${userId.slice(-6)}`;
    rowsMap.set(userId, {
      userId,
      name: String(user.name || '').trim() || fallbackName,
      employeeCode: String(user.employeeCode || user.empcode || '').trim(),
      avatar: user.avatar || '',
      position: String(uw?.position || '').trim(),
      days: Array.from({ length: daysCount }, () => []),
      dayChange: Array.from({ length: daysCount }, () => false),
      totals: { morning: 0, afternoon: 0, night: 0, total: 0 }
    });
  });

  return {
    rowsMap,
    userIds: Array.from(rowsMap.keys())
  };
};

/**
 * USER: book ตารางเวร (ทั้งเดือน)
 */
exports.bookSchedule = asyncHandler(async (req, res) => {
  const { schedules } = req.body;
  if (String(process.env.DEBUG_BOOK_SCHEDULE || '').trim() === '1') {
    console.log('Book req count:', Array.isArray(schedules) ? schedules.length : schedules);
  }
  if (!Array.isArray(schedules) || schedules.length === 0) {
    throw new AppError('Schedule data is required', 400);
  }
  const validShiftCodes = await getValidShiftCodeSet();
  if (!validShiftCodes.size) {
    throw new AppError('SHIFT configuration is missing', 500);
  }

  const docs = schedules.map(item => {
    const rawWorkDate = item.workDate || item.date;
    const workDate = new Date(rawWorkDate);
    const wardId = (item.wardId && item.wardId._id) ? item.wardId._id : item.wardId;
    const shiftCodeRaw = item.shiftCode || item.shiftId;
    const shiftCode = normalizeShiftCodeValue(shiftCodeRaw);
    const targetUserId = (item.userId && item.userId._id) ? item.userId._id : item.userId;

    if (!rawWorkDate || Number.isNaN(workDate.getTime())) {
      throw new AppError('Invalid workDate', 400);
    }
    if (!wardId || !/^[a-f0-9]{24}$/i.test(String(wardId).trim())) {
      throw new AppError('Invalid wardId', 400);
    }
    if (!shiftCode) {
      throw new AppError('workDate, wardId and shiftCode are required', 400);
    }

    let finalUserId = req.user._id;
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    const isHead = roles.includes('head');
    const isAdmin = roles.includes('admin');
    if (targetUserId && (isHead || isAdmin) && /^[a-f0-9]{24}$/i.test(String(targetUserId).trim())) {
      finalUserId = targetUserId;
    }

    return {
      workDate,
      wardId: String(wardId).trim(),
      shiftCode,
      meta: item.meta || {},
      userId: finalUserId,
      status: 'BOOK',
      createdBy: req.user._id
    };
  });
  assertValidShiftCodes(docs.map((d) => d.shiftCode), validShiftCodes);

  let created = [];
  try {
    created = await Schedule.insertMany(docs, { ordered: false });
  } catch (err) {
    const writeErrors = Array.isArray(err?.writeErrors) ? err.writeErrors : [];
    const hasNonDuplicateWriteError = writeErrors.some((e) => Number(e?.code) && Number(e.code) !== 11000);
    const isDuplicateOnly =
      (Number(err?.code) === 11000 && !hasNonDuplicateWriteError) ||
      (writeErrors.length > 0 && writeErrors.every((e) => Number(e?.code) === 11000)) ||
      (typeof err?.message === 'string' && err.message.includes('E11000 duplicate key error'));

    if (isDuplicateOnly) {
      // Duplicate can mean:
      // 1) idempotent re-save in the same ward (OK)
      // 2) same user+date+shift already exists in another ward (conflict for this UI)
      const dedupeKeys = docs.map((d) => ({
        userId: d.userId,
        workDate: d.workDate,
        shiftCode: d.shiftCode
      }));
      const existing = dedupeKeys.length
        ? await Schedule.find({ $or: dedupeKeys })
            .select('_id userId wardId workDate shiftCode status createdBy meta')
            .lean()
        : [];

      const toNoWardKey = (d) => `${String(d.userId)}|${new Date(d.workDate).getTime()}|${String(d.shiftCode || '').toUpperCase()}`;
      const toFullKey = (d) => `${toNoWardKey(d)}|${String(d.wardId)}`;

      const existingByNoWard = new Map();
      existing.forEach((e) => {
        const k = toNoWardKey(e);
        if (!existingByNoWard.has(k)) existingByNoWard.set(k, []);
        existingByNoWard.get(k).push(e);
      });

      const insertedDocs = Array.isArray(err?.insertedDocs) ? err.insertedDocs : [];
      const insertedKeySet = new Set(insertedDocs.map((d) => toFullKey(d)));

      const idempotentExisting = [];
      const conflicts = [];

      docs.forEach((d) => {
        if (insertedKeySet.has(toFullKey(d))) return;
        const sameShiftRows = existingByNoWard.get(toNoWardKey(d)) || [];
        if (!sameShiftRows.length) return;
        const sameWard = sameShiftRows.find((x) => String(x.wardId) === String(d.wardId));
        if (sameWard) {
          idempotentExisting.push(sameWard);
        } else {
          conflicts.push({ requested: d, exists: sameShiftRows[0] });
        }
      });

      if (conflicts.length) {
        const c = conflicts[0];
        const dateText = new Date(c.requested.workDate).toISOString().slice(0, 10);
        throw new AppError(
          `Shift ${c.requested.shiftCode} on ${dateText} already exists in another ward (${c.exists.wardId})`,
          409
        );
      }

      const outById = new Map();
      [...insertedDocs, ...idempotentExisting].forEach((d) => {
        if (!d?._id) return;
        outById.set(String(d._id), d);
      });
      const out = Array.from(outById.values());

      return response.success(res, out, 'Schedule booked successfully (some entries already existed)', 201);
    }

    if (err?.name === 'ValidationError' || err?.name === 'CastError') {
      throw new AppError(err.message || 'Invalid schedule data', 400);
    }

    throw err;
  }

  response.success(res, created, 'Schedule booked successfully', 201);
});

/**
 * USER: book schedule for a single day
 * POST /api/schedules/dayBook (alias: /day-book)
 *
 * Body:
 * - workDate/date: required
 * - wardId: required
 * - shiftCodes: required (array or string "M A N")
 * - userId: optional (only head/admin can book for others)
 * - meta: optional (applies to all created rows unless shifts[] supplies per-code meta)
 * - shifts: optional [{ shiftCode, meta }]
 */
exports.dayBookSchedule = asyncHandler(async (req, res) => {
  /*
   * Goal: prevent confusion between "ผู้ป้อน" and "เจ้าของเวร"
   * - createdBy = req.user._id (from token) : ผู้ป้อน/ผู้บันทึก
   * - userId (Schedule.userId)             : เจ้าของเวร
   *
   * Body:
   * - workDate/date: required
   * - wardId: required
   * - shifts: array of shiftCode (empty => clear day)
   * - userId: optional owner userId (ObjectId) [head/admin only]
   * - empCode: optional owner empcode         [head/admin only, will be mapped to userId]
   */

  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const isHead = roles.includes('head');
  const isAdmin = roles.includes('admin');
  const source = String(req.body?.source || '').trim().toUpperCase();

  // Summary inline edit is restricted to HEAD role only.
  if (source === 'SUMMARY' && !isHead) {
    throw new AppError('Only head role can edit from summary', 403);
  }

  const rawWorkDate = req.body?.workDate || req.body?.date;
  const workDate = new Date(rawWorkDate);
  const wardId = (req.body?.wardId && req.body.wardId._id) ? req.body.wardId._id : req.body?.wardId;

  const createdBy = req.user?._id;
  if (!createdBy) {
    throw new AppError('Unauthorized', 401);
  }

  if (!rawWorkDate || Number.isNaN(workDate.getTime())) {
    throw new AppError('Invalid workDate', 400);
  }
  if (!wardId || !/^[a-f0-9]{24}$/i.test(String(wardId).trim())) {
    throw new AppError('Invalid wardId', 400);
  }

  const requestedOwnerUserId = (req.body?.userId && req.body.userId._id) ? req.body.userId._id : req.body?.userId;
  const requestedEmpCode = String(req.body?.empCode || req.body?.empcode || '').trim();

  let ownerUserId = createdBy; // default: self
  if (requestedOwnerUserId && /^[a-f0-9]{24}$/i.test(String(requestedOwnerUserId).trim())) {
    ownerUserId = String(requestedOwnerUserId).trim();
  } else if (requestedEmpCode) {
    const u = await User.findOne({ empcode: requestedEmpCode, status: 'ACTIVE' }).select('_id').lean();
    if (!u?._id) {
      throw new AppError('Invalid empCode', 400);
    }
    ownerUserId = u._id;
  }

  // Only head/admin can write schedules for other users.
  if (!(isHead || isAdmin) && String(ownerUserId) !== String(createdBy)) {
    throw new AppError('Forbidden', 403);
  }

  const rawShifts = Array.isArray(req.body?.shifts)
    ? req.body.shifts
    : (Array.isArray(req.body?.shiftCodes) ? req.body.shiftCodes : []);

  const normalizeShiftCode = (code) => normalizeShiftCodeValue(code);
  const shiftCodes = Array.from(new Set(rawShifts.map(normalizeShiftCode).filter(Boolean)));
  if (shiftCodes.length) {
    const validShiftCodes = await getValidShiftCodeSet();
    if (!validShiftCodes.size) {
      throw new AppError('SHIFT configuration is missing', 500);
    }
    assertValidShiftCodes(shiftCodes, validShiftCodes);
  }

  // clear all shifts (this ward + this date + this owner)
  await Schedule.deleteMany({ userId: ownerUserId, wardId: String(wardId).trim(), workDate });

  if (shiftCodes.length === 0) {
    return response.success(res, { cleared: true }, 'Schedule cleared', 200);
  }

  const docs = shiftCodes.map((shiftCode) => ({
    userId: ownerUserId,
    wardId: String(wardId).trim(),
    workDate,
    shiftCode,
    status: 'BOOK',
    createdBy
  }));

  let created = [];
  try {
    created = await Schedule.insertMany(docs, { ordered: false });
  } catch (err) {
    const writeErrors = Array.isArray(err?.writeErrors) ? err.writeErrors : [];
    const hasNonDuplicateWriteError = writeErrors.some((e) => Number(e?.code) && Number(e.code) !== 11000);
    const isDuplicateOnly =
      (Number(err?.code) === 11000 && !hasNonDuplicateWriteError) ||
      (writeErrors.length > 0 && writeErrors.every((e) => Number(e?.code) === 11000)) ||
      (typeof err?.message === 'string' && err.message.includes('E11000 duplicate key error'));

    if (isDuplicateOnly) {
      const inserted = Array.isArray(err?.insertedDocs) ? err.insertedDocs : [];
      return response.success(res, inserted, 'Schedule booked successfully (some entries already existed)', 201);
    }

    if (err?.name === 'ValidationError' || err?.name === 'CastError') {
      throw new AppError(err.message || 'Invalid schedule data', 400);
    }
    throw err;
  }

  return response.success(res, created, 'Schedule booked successfully', 201);
});

/**
 * USER: ดูตารางเวรของตัวเอง
 */
exports.mySchedule = asyncHandler(async (req, res) => {
    /*
  expected body:
    - fromDate (ISO string): required
    - toDate (ISO string, exclusive): required
    - wards (array of wardId ObjectId strings): optional (defaults to user's ACTIVE wards)
  */
  if (String(req.method || '').toUpperCase() !== 'POST') {
    throw new AppError('Method not allowed. Use POST /api/schedules/my', 405);
  }

  const userId = req.user?._id || req.user?.id;

  // Frontend sends all filters via JSON body (POST /api/schedules/my).
  // We intentionally do not parse req.query anymore to keep behavior predictable.
  const src = req.body || {};

  const fromDate = src.fromDate;
  const toDate = src.toDate;
  const wards = Array.isArray(src.wards) ? src.wards : [];

  const normalizeWardId = (w) => (w && typeof w === 'object' && w._id) ? w._id : w;
  let wardIdList = wards
    .map(normalizeWardId)
    .map((x) => String(x || '').trim())
    .filter(Boolean);

  const invalidWardId = wardIdList.find((id) => !/^[a-f0-9]{24}$/i.test(id));
  if (invalidWardId) {
    throw new AppError('Invalid wardId in wards', 400);
  }
  wardIdList = Array.from(new Set(wardIdList));

  // Date range: fromDate/toDate (toDate is exclusive).
  let from = null;
  let to = null;
  if (!fromDate || !toDate) {
    throw new AppError('fromDate and toDate are required', 400);
  }
  from = new Date(fromDate);
  to = new Date(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError('Invalid fromDate/toDate', 400);
  }
  if (to <= from) {
    throw new AppError('toDate must be after fromDate', 400);
  }

  const query = {
    userId,
    status: { $ne: 'INACTIVE' },
    workDate: { $gte: from, $lt: to },
  };

  // If caller didn't provide wardIds, default to the user's ACTIVE wards.
  if (!wardIdList.length) {
    const mine = await WardMember.find({ userId, status: 'ACTIVE' }).select('wardId').lean();
    const mineIds = Array.isArray(mine)
      ? mine.map((m) => String(m?.wardId || '').trim()).filter((id) => /^[a-f0-9]{24}$/i.test(id))
      : [];
    if (mineIds.length) wardIdList = mineIds;
  }

  if (wardIdList.length) query.wardId = { $in: wardIdList };

  const schedules = await Schedule.find(query)
    .populate('wardId')
    .sort({ workDate: 1 })
    .lean();

  response.success(res, schedules, 'My schedule loaded');
});

exports.userScheduleById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { month, year, wardId } = req.query;

  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const isHead = roles.includes('head');
  const isAdmin = roles.includes('admin');
  const isSelf = String(req.user._id) === String(userId);

  if (!isSelf && !(isHead || isAdmin)) {
    throw new AppError('Forbidden', 403);
  }

  if (!month || !year) {
    throw new AppError('month and year are required', 400);
  }

  const monthNum = Number(month);
  const yearNum = Number(year);
  if (!Number.isInteger(monthNum) || !Number.isInteger(yearNum) || monthNum < 1 || monthNum > 12) {
    throw new AppError('Invalid month/year', 400);
  }

  const from = new Date(yearNum, monthNum - 1, 1);
  const to = new Date(yearNum, monthNum, 0, 23, 59, 59);

  const query = {
    userId,
    workDate: { $gte: from, $lte: to },
    status: { $ne: 'INACTIVE' }
  };
  if (wardId) query.wardId = wardId;

  const schedules = await Schedule.find(query)
    .populate('wardId')
    .sort({ workDate: 1 });

  response.success(res, schedules, 'User schedule loaded');
});

/**
 * HEAD / ADMIN: ดูตารางราย ward (รายเดือน)
 * รองรับ filter หลาย position เช่น ?positions=RN,PN
 */
exports.wardSchedule = asyncHandler(async (req, res) => {
  const { wardId } = req.params;
  const { month, year, positions } = req.query;

  if (!month || !year) {
    throw new AppError('month and year are required', 400);
  }

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const query = {
    wardId,
    workDate: { $gte: from, $lte: to },
    status: { $ne: 'INACTIVE' }
  };

  const schedules = await Schedule.find(query)
    .populate('userId wardId')
    .sort({ workDate: 1 });

  response.success(res, schedules, 'Ward schedule loaded');
});

/**
 * HEAD / ADMIN: ปรับแก้เวร (สถานะ -> PROPOSE)
 */
exports.updateSchedule = asyncHandler(async (req, res) => {
  const schedule = await Schedule.findById(req.params.id);

  if (!schedule) {
    throw new AppError('Schedule not found', 404);
  }

  Object.assign(schedule, req.body);

  schedule.status = 'PROPOSE';
  schedule.updatedBy = req.user.id;
  schedule.updatedAt = new Date();

  await schedule.save();

  response.success(res, schedule, 'Schedule updated');
});

/**
 * HEAD / ADMIN: approve เวร (สถานะ -> ACTIVE)
 */
exports.activateSchedule = asyncHandler(async (req, res) => {
  const schedule = await Schedule.findById(req.params.id);

  if (!schedule) {
    throw new AppError('Schedule not found', 404);
  }

  schedule.status = 'ACTIVE';
  schedule.approvedBy = req.user.id;
  schedule.approvedAt = new Date();

  await schedule.save();

  response.success(res, schedule, 'Schedule activated');
});

/**
 * USER: check booking window by ward
 * GET /api/schedules/head/:wardId
 */
exports.bookingWindow = asyncHandler(async (req, res) => {
  const { wardId } = req.params;
  const { month, year } = req.query;
  const raw = String(wardId || '').trim();

  let monthNum = Number(month);
  let yearNum = Number(year);
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12 || !Number.isInteger(yearNum) || yearNum < 1900) {
    const now = new Date();
    monthNum = now.getMonth() + 1;
    yearNum = now.getFullYear();
  }
  const monthYear = `${String(monthNum).padStart(2, '0')}-${yearNum}`;

  let wardCode = raw;
  if (/^[a-f0-9]{24}$/i.test(raw)) {
    const doc = await CodeType.findById(raw).select('conf_code').lean();
    wardCode = doc?.conf_code ? String(doc.conf_code).trim() : raw;
  }
  wardCode = String(wardCode || '').trim().toUpperCase();

  let head = await SchedulerHead.findOne({ wardCode, status: 'OPEN', monthYear })
    .select('status monthYear periodStart')
    .lean();

  // Backward compatibility for old records without monthYear.
  if (!head) {
    const candidates = await SchedulerHead.find({ wardCode, status: 'OPEN' })
      .select('status monthYear periodStart')
      .lean();
    head = candidates.find((c) => {
      const key = String(c.monthYear || '').trim() || toMonthYear(c.periodStart);
      return key === monthYear;
    }) || null;
  }

  if (!head && /^[a-f0-9]{24}$/i.test(raw)) {
    const candidates = await SchedulerHead.find({ wardId: raw, status: 'OPEN' })
      .select('status monthYear periodStart')
      .lean();
    head = candidates.find((c) => {
      const key = String(c.monthYear || '').trim() || toMonthYear(c.periodStart);
      return key === monthYear;
    }) || null;
  }

  if (!head) {
    return response.success(res, { open: false, status: 'NOT_FOUND', monthYear }, 'Not opened');
  }

  const open = head.status === 'OPEN';
  response.success(res, { open, status: head.status, monthYear }, 'Booking window');
});

/**
 * HEAD / ADMIN: summary by ward
 * GET /api/schedules/summary/:wardId?month=1&year=2026&positions=GN,CLERK
 */
exports.summaryByWard = asyncHandler(async (req, res) => {
  const { wardId } = req.params;
  const { month, year, positions } = req.query;

  if (!wardId || !month || !year) {
    throw new AppError('wardId, month and year are required', 400);
  }

  const monthNum = Number(month);
  const yearNum = Number(year);
  if (!Number.isInteger(monthNum) || !Number.isInteger(yearNum) || monthNum < 1 || monthNum > 12) {
    throw new AppError('Invalid month/year', 400);
  }

  const from = new Date(yearNum, monthNum - 1, 1);
  const to = new Date(yearNum, monthNum, 0, 23, 59, 59);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const positionList = parsePositionList(positions);
  const { rowsMap, userIds } = await buildSummaryRowsFromWardMembers({
    wardId,
    positionList,
    daysCount: daysInMonth
  });

  const schedules = userIds.length
    ? await Schedule.find({
        wardId,
        userId: { $in: userIds },
        workDate: { $gte: from, $lte: to },
        status: { $ne: 'INACTIVE' }
      })
        .select('userId workDate shiftCode meta')
        .lean()
    : [];

  const shifts = await CodeType.find({ typ_code: 'SHIFT' })
    .select('conf_code conf_value options')
    .lean();

  const shiftMeta = new Map(
    shifts.map(s => [String(s.conf_code || '').toUpperCase(), parseConfValue(s)])
  );

  const getBucket = (code) => {
    const upper = String(code || '').trim().toUpperCase();
    const compact = upper.replace(/\s+/g, '');
    const meta = shiftMeta.get(compact) || shiftMeta.get(upper) || {};
    if (compact.startsWith('ช')) return 'morning';
    if (compact.startsWith('บ')) return 'afternoon';
    if (compact.startsWith('ด')) return 'night';
    const raw = String(
      meta.bucket || meta.shift || meta.period || meta.group || meta.slot || meta.value || ''
    ).toLowerCase();

    if (['m', 'morning', 'am', 'day'].includes(raw)) return 'morning';
    if (['a', 'afternoon', 'pm', 'evening'].includes(raw)) return 'afternoon';
    if (['n', 'night'].includes(raw)) return 'night';

    if (compact.startsWith('M')) return 'morning';
    if (compact.startsWith('A')) return 'afternoon';
    if (compact.startsWith('N')) return 'night';

    return 'other';
  };

  schedules.forEach(s => {
    const id = String(s.userId);
    const row = rowsMap.get(id);
    if (!row) return;
    const day = new Date(s.workDate).getDate();
    if (day < 1 || day > daysInMonth) return;
    const label = String(s.shiftCode).toUpperCase();
    row.days[day - 1].push(label);
    if (s.meta?.changeStatus === 'OPEN') {
      row.dayChange[day - 1] = 'OPEN';
    }
    if (s.meta?.changeStatus === 'ACCEPTED') {
      row.dayChange[day - 1] = 'ACCEPTED';
    }
    if (s.meta?.changeStatus === 'APPROVED') {
      row.dayChange[day - 1] = 'APPROVED';
    }
    if (s.meta?.changeStatus === 'REJECTED') {
      row.dayChange[day - 1] = 'REJECTED';
    }
    row.totals.total += 1;
    const bucket = getBucket(s.shiftCode);
    if (bucket === 'morning') row.totals.morning += 1;
    if (bucket === 'afternoon') row.totals.afternoon += 1;
    if (bucket === 'night') row.totals.night += 1;
  });

  const rows = Array.from(rowsMap.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

  response.success(res, {
    wardId,
    month: monthNum,
    year: yearNum,
    daysInMonth,
    rows
  }, 'Schedule summary');
});

/**
 * HEAD / ADMIN: summary by ward (range)
 * GET /api/schedules/summary-range/:wardId?from=2026-02-01&to=2026-02-28&positions=GN,CLERK
 */
exports.summaryByWardRange = asyncHandler(async (req, res) => {
  const { wardId } = req.params;
  const { from, to, positions } = req.query;

  if (!wardId || !from || !to) {
    throw new AppError('wardId, from and to are required', 400);
  }

  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError('Invalid from/to date', 400);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (end < start) {
    throw new AppError('Invalid date range', 400);
  }
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const daysCount = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  const positionList = parsePositionList(positions);
  const { rowsMap, userIds } = await buildSummaryRowsFromWardMembers({
    wardId,
    positionList,
    daysCount
  });

  const schedules = userIds.length
    ? await Schedule.find({
        wardId,
        userId: { $in: userIds },
        workDate: { $gte: start, $lte: end },
        status: { $ne: 'INACTIVE' }
      })
        .select('userId workDate shiftCode meta')
        .lean()
    : [];

  const shifts = await CodeType.find({ typ_code: 'SHIFT' })
    .select('conf_code conf_value options')
    .lean();

  const shiftMeta = new Map(
    shifts.map(s => [String(s.conf_code || '').toUpperCase(), parseConfValue(s)])
  );

  const getBucket = (code) => {
    const upper = String(code || '').trim().toUpperCase();
    const compact = upper.replace(/\s+/g, '');
    const meta = shiftMeta.get(compact) || shiftMeta.get(upper) || {};
    if (compact.startsWith('ช')) return 'morning';
    if (compact.startsWith('บ')) return 'afternoon';
    if (compact.startsWith('ด')) return 'night';
    const raw = String(
      meta.bucket || meta.shift || meta.period || meta.group || meta.slot || meta.value || ''
    ).toLowerCase();

    if (['m', 'morning', 'am', 'day'].includes(raw)) return 'morning';
    if (['a', 'afternoon', 'pm', 'evening'].includes(raw)) return 'afternoon';
    if (['n', 'night'].includes(raw)) return 'night';

    if (compact.startsWith('M')) return 'morning';
    if (compact.startsWith('A')) return 'afternoon';
    if (compact.startsWith('N')) return 'night';

    return 'other';
  };

  const dates = [];
  for (let i = 0; i < daysCount; i += 1) {
    const d = new Date(start.getTime() + i * MS_PER_DAY);
    dates.push(d.toISOString());
  }

  schedules.forEach(s => {
    const id = String(s.userId);
    const row = rowsMap.get(id);
    if (!row) return;
    const dayDate = new Date(s.workDate);
    dayDate.setHours(0, 0, 0, 0);
    const idx = Math.floor((dayDate.getTime() - start.getTime()) / MS_PER_DAY);
    if (idx < 0 || idx >= daysCount) return;
    const label = String(s.shiftCode).toUpperCase();
    row.days[idx].push(label);
    if (s.meta?.changeStatus === 'OPEN') row.dayChange[idx] = 'OPEN';
    if (s.meta?.changeStatus === 'ACCEPTED') row.dayChange[idx] = 'ACCEPTED';
    if (s.meta?.changeStatus === 'APPROVED') row.dayChange[idx] = 'APPROVED';
    if (s.meta?.changeStatus === 'REJECTED') row.dayChange[idx] = 'REJECTED';
    row.totals.total += 1;
    const bucket = getBucket(s.shiftCode);
    if (bucket === 'morning') row.totals.morning += 1;
    if (bucket === 'afternoon') row.totals.afternoon += 1;
    if (bucket === 'night') row.totals.night += 1;
  });

  const rows = Array.from(rowsMap.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

  response.success(res, {
    wardId,
    from: start.toISOString(),
    to: end.toISOString(),
    dates,
    rows
  }, 'Schedule summary (range)');
});
