const Schedule = require('../model/schedule.model');
const AppError = require('../helpers/apperror');
const asyncHandler = require('../helpers/async.handler');
const { getPositionIdsByCodes } = require('../helpers/master.helper');

/**
 * USER: book ตารางเวร (ทั้งเดือน)
 */
exports.bookSchedule = asyncHandler(async (req) => {
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

  const docs = schedules.map(item => ({
    ...item,
    userId: req.user.id,
    status: 'BOOK',
    createdBy: req.user.id
  }));

  const created = await Schedule.insertMany(docs);

  return {
    result: true,
    message: 'Schedule booked successfully',
    data: created
  };
});

/**
 * USER: ดูตารางเวรของตัวเอง
 */
exports.mySchedule = asyncHandler(async (req) => {
  const schedules = await Schedule.find({
    userId: req.user.id,
    status: { $ne: 'INACTIVE' }
  })
    .populate('wardId shiftId positionId')
    .sort({ date: 1 });

  return {
    result: true,
    data: schedules
  };
});

/**
 * HEAD / ADMIN: ดูตารางราย ward (รายเดือน)
 * รองรับ filter หลาย position เช่น ?positions=RN,PN
 */
exports.wardSchedule = asyncHandler(async (req) => {
  const { wardId } = req.params;
  const { month, year, positions } = req.query;

  if (!month || !year) {
    throw new AppError('month and year are required', 400);
  }

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const query = {
    wardId,
    date: { $gte: from, $lte: to },
    status: { $ne: 'INACTIVE' }
  };

  // positions=RN,PN
  if (positions) {
    const codes = positions.split(',').map(p => p.trim());
    const positionIds = await getPositionIdsByCodes(codes);

    if (positionIds.length > 0) {
      query.positionId = { $in: positionIds };
    }
  }

  const schedules = await Schedule.find(query)
    .populate('userId positionId shiftId')
    .sort({ date: 1 });

  return {
    result: true,
    data: schedules
  };
});

/**
 * HEAD / ADMIN: ปรับแก้เวร (สถานะ -> PROPOSE)
 */
exports.updateSchedule = asyncHandler(async (req) => {
  const schedule = await Schedule.findById(req.params.id);

  if (!schedule) {
    throw new AppError('Schedule not found', 404);
  }

  Object.assign(schedule, req.body);

  schedule.status = 'PROPOSE';
  schedule.updatedBy = req.user.id;
  schedule.updatedAt = new Date();

  await schedule.save();

  return {
    result: true,
    message: 'Schedule updated',
    data: schedule
  };
});

/**
 * HEAD / ADMIN: approve เวร (สถานะ -> ACTIVE)
 */
exports.activateSchedule = asyncHandler(async (req) => {
  const schedule = await Schedule.findById(req.params.id);

  if (!schedule) {
    throw new AppError('Schedule not found', 404);
  }

  schedule.status = 'ACTIVE';
  schedule.approvedBy = req.user.id;
  schedule.approvedAt = new Date();

  await schedule.save();

  return {
    result: true,
    message: 'Schedule activated',
    data: schedule
  };
});
