const Schedule = require('../model/schedule.model');
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

    if (!workDate || !wardId || !shiftCode) {
      throw new AppError('workDate, wardId and shiftCode are required', 400);
    }

    return {
      workDate,
      wardId,
      shiftCode,
      meta: item.meta || {},
      userId: req.user._id,
      status: 'BOOK',
      createdBy: req.user._id
    };
  });

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
