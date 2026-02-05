// services/schedulepolicy.service.js

const SchedulerHead = require('../models/scheduler.head.model');
const AppError = require('../utils/apperror');

/**
 * =========================
 * Helper
 * =========================
 */

const normalizeDate = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * =========================
 * Validate create schedule policy
 * =========================
 * ใช้ก่อน CREATE schedule
 */
exports.validateCreateSchedulePolicy = async ({
  user,
  wardId,
  dates,
}) => {
  if (!dates || dates.length === 0) {
    throw new AppError('No schedule dates provided', 400);
  }

  // หา scheduler head ที่ OPEN
  const head = await SchedulerHead.findOne({
    wardId,
    status: 'OPEN',
  });

  if (!head) {
    throw new AppError(
      'Schedule period is not open for this ward',
      403
    );
  }

  for (const rawDate of dates) {
    const date = normalizeDate(rawDate);

    // ต้องอยู่ในช่วง period
    if (date < head.periodStart || date > head.periodEnd) {
      throw new AppError(
        'Selected date is outside the allowed scheduling period',
        403
      );
    }

    // USER ห้ามย้อนหลัง
    if (user.role === 'USER' && !head.allowPast) {
      const today = normalizeDate(new Date());
      if (date < today) {
        throw new AppError(
          'You are not allowed to create schedule in the past',
          403
        );
      }
    }
  }

  return true;
};

/**
 * =========================
 * Validate direct edit schedule policy
 * =========================
 * ใช้ก่อน UPDATE schedule ตรง ๆ
 */
exports.validateEditSchedulePolicy = async ({
  user,
  schedule,
}) => {
  const status = schedule.status;

  // USER แก้ได้เฉพาะ BOOKED
  if (user.role === 'USER') {
    if (status !== 'BOOKED') {
      throw new AppError(
        'You are not allowed to edit this schedule',
        403
      );
    }
  }

  // HEAD / ADMIN แก้ได้ BOOKED + PROPOSED
  if (['HEAD', 'ADMIN'].includes(user.role)) {
    if (!['BOOKED', 'PROPOSED'].includes(status)) {
      throw new AppError(
        'Schedule cannot be edited directly in its current status',
        403
      );
    }
  }

  return true;
};

/**
 * =========================
 * Validate change request policy
 * =========================
 * ใช้ก่อน CREATE ChangeRequest
 */
exports.validateChangeRequestPolicy = ({
  schedule,
}) => {
  const lockedStatus = ['WORKED', 'CALCULATED', 'PAID'];

  if (lockedStatus.includes(schedule.status)) {
    throw new AppError(
      `Schedule with status ${schedule.status} cannot be changed`,
      403
    );
  }

  if (schedule.status !== 'ACTIVE') {
    throw new AppError(
      'Change request can be created only for ACTIVE schedule',
      403
    );
  }

  return true;
};

/**
 * =========================
 * Validate apply change (approve CR)
 * =========================
 * ใช้ตอน APPROVE ChangeRequest
 */
exports.validateApplyChangePolicy = ({
  schedule,
}) => {
  const lockedStatus = ['WORKED', 'CALCULATED', 'PAID'];

  if (lockedStatus.includes(schedule.status)) {
    throw new AppError(
      `Cannot apply change to schedule with status ${schedule.status}`,
      403
    );
  }

  return true;
};
