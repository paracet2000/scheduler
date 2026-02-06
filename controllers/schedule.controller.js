const Schedule = require('../model/schedule.model');
const SchedulerHead = require('../model/scheduler.head.model');
const WardMember = require('../model/ward-member.model');
const Master = require('../model/base/master.schema');
const AppError = require('../helpers/apperror');
const asyncHandler = require('../helpers/async.handler');
const response = require('../helpers/response');

/**
 * USER: book ตารางเวร (ทั้งเดือน)
 */
exports.bookSchedule = asyncHandler(async (req, res) => {
  const { schedules } = req.body;
  
  /**
   * schedules = [
   *   {
   *     date,
   *     wardId,
   *     shiftId,
   *     positionId,
   *     meta
   *   }
   * ]
   */

  if (!Array.isArray(schedules) || schedules.length === 0) {
    throw new AppError('Schedule data is required', 400);
  }

  const docs = schedules.map(item => {
    const workDate = item.workDate || item.date;
    const wardId = item.wardId;
    const shiftCode = item.shiftCode || item.shiftId;
    const targetUserId = item.userId;

    if (!workDate || !wardId || !shiftCode) {
      throw new AppError('workDate, wardId and shiftCode are required', 400);
    }

    let finalUserId = req.user._id;
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    const isHead = roles.includes('head');
    const isAdmin = roles.includes('admin');
    if (targetUserId && (isHead || isAdmin)) {
      finalUserId = targetUserId;
    }

    return {
      workDate,
      wardId,
      shiftCode,
      meta: item.meta || {},
      userId: finalUserId,
      status: 'BOOK',
      createdBy: req.user._id
    };
  });

  // ensure booking window is OPEN for ward
  const wardIds = Array.from(new Set(docs.map(d => String(d.wardId))));
  const heads = await SchedulerHead.find({ wardId: { $in: wardIds }, status: 'OPEN' })
    .select('wardId status')
    .lean();
  const openWardIds = new Set(heads.map(h => String(h.wardId)));
  const closedWard = wardIds.find(id => !openWardIds.has(String(id)));
  if (closedWard) {
    throw new AppError('Booking window is not OPEN for this ward', 400);
  }

  const created = await Schedule.insertMany(docs);

  response.success(res, created, 'Schedule booked successfully', 201);
});

/**
 * USER: ดูตารางเวรของตัวเอง
 */
exports.mySchedule = asyncHandler(async (req, res) => {
  const schedules = await Schedule.find({
    userId: req.user._id,
    status: { $ne: 'INACTIVE' }
  })
    .populate('wardId')
    .sort({ workDate: 1 });

  response.success(res, schedules, 'My schedule loaded');
});

/**
 * HEAD / ADMIN or SELF: get schedules by user + month
 * GET /api/schedules/user/:userId?month=1&year=2026&wardId=
 */
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
  const head = await SchedulerHead.findOne({ wardId });

  if (!head) {
    return response.success(res, { open: false, status: 'NOT_FOUND' }, 'Not opened');
  }

  const open = head.status !== 'CLOSED';
  response.success(res, { open, status: head.status }, 'Booking window');
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

  let positionList = [];
  if (Array.isArray(positions)) {
    positionList = positions.filter(Boolean);
  } else if (typeof positions === 'string' && positions.trim()) {
    positionList = positions.split(',').map(p => p.trim()).filter(Boolean);
  }

  const userWardQuery = {
    wardId,
    status: 'ACTIVE'
  };

  if (positionList.length) {
    userWardQuery.position = { $in: positionList };
  }

  const userWards = await WardMember.find(userWardQuery)
    .populate('userId', 'name employeeCode avatar')
    .lean();

  const userIds = userWards
    .map(uw => uw.userId?._id)
    .filter(Boolean);

  console.log('userIds in ward Data: ',userIds); // always show userIds is empty array

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

  const shifts = await Master.find({ type: 'SHIFT', status: 'ACTIVE' })
    .select('code meta')
    .lean();

  const shiftMeta = new Map(
    shifts.map(s => [String(s.code).toUpperCase(), s.meta || {}])
  );

  const getBucket = (code) => {
    const upper = String(code || '').toUpperCase();
    const meta = shiftMeta.get(upper) || {};
    const raw = String(
      meta.bucket || meta.shift || meta.period || meta.group || meta.slot || ''
    ).toLowerCase();

    if (['m', 'morning', 'am', 'day'].includes(raw)) return 'morning';
    if (['a', 'afternoon', 'pm', 'evening'].includes(raw)) return 'afternoon';
    if (['n', 'night'].includes(raw)) return 'night';

    if (upper.startsWith('M')) return 'morning';
    if (upper.startsWith('A')) return 'afternoon';
    if (upper.startsWith('N')) return 'night';

    return 'other';
  };

  const rowsMap = new Map();
  userWards.forEach(uw => {
    const user = uw.userId || {};
    const id = String(user._id || '');
    if (!id) return;
    rowsMap.set(id, {
      userId: id,
      name: user.name || '',
      employeeCode: user.employeeCode || '',
      avatar: user.avatar || '',
      position: uw.position || '',
      days: Array.from({ length: daysInMonth }, () => []),
      dayChange: Array.from({ length: daysInMonth }, () => false),
      totals: { morning: 0, afternoon: 0, night: 0, total: 0 }
    });
  });

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
