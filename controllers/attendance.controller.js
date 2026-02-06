const Schedule = require('../model/schedule.model');
const Master = require('../model/base/master.schema');
const asyncHandler = require('../helpers/async.handler');
const AppError = require('../helpers/apperror');
const response = require('../helpers/response');

const getDayRange = (dateStr) => {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { start, end };
};

exports.sync = asyncHandler(async (req, res) => {
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AppError('rows is required', 400);
  }

  let matched = 0;
  let modified = 0;
  const noSchedule = [];

  const timeToSeconds = (time) => {
    const parts = String(time || '').split(':').map(Number);
    if (parts.length < 2) return null;
    const [h, m, s = 0] = parts;
    return (h * 3600) + (m * 60) + s;
  };

  for (const row of rows) {
    const { userId, date, actualIn, actualOut, punchCount, singleTime } = row || {};
    if (!userId || !date) continue;
    const { start, end } = getDayRange(date);

    // TODO: Night shift cross-day handling (timeFrom/timeTo spans midnight)
    if (punchCount === 1 && singleTime) {
      const schedules = await Schedule.find({
        userId,
        workDate: { $gte: start, $lte: end }
      }).select('_id shiftCode').lean();

      if (!schedules.length) {
        noSchedule.push({ userId, date });
        continue;
      }

      const shiftCodes = Array.from(new Set(schedules.map(s => String(s.shiftCode || '').toUpperCase())));
      const shifts = await Master.find({ type: 'SHIFT', code: { $in: shiftCodes } })
        .select('code meta')
        .lean();
      const shiftMap = new Map(
        shifts.map(s => [String(s.code).toUpperCase(), s.meta || {}])
      );

      const punchSec = timeToSeconds(singleTime);

      for (const s of schedules) {
        const meta = shiftMap.get(String(s.shiftCode || '').toUpperCase()) || {};
        const tf = timeToSeconds(meta.timeFrom || meta.timefrom || '');
        const tt = timeToSeconds(meta.timeTo || meta.timeto || '');
        let setIn = singleTime;
        let setOut = singleTime;
        let flag = null;
        if (punchSec !== null && tf !== null && tt !== null) {
          const dIn = Math.abs(punchSec - tf);
          const dOut = Math.abs(punchSec - tt);
          if (dIn <= dOut) {
            setIn = singleTime;
            setOut = null;
            flag = 'IN_ONLY';
          } else {
            setIn = null;
            setOut = singleTime;
            flag = 'OUT_ONLY';
          }
        }

        const result = await Schedule.updateOne(
          { _id: s._id },
          {
            $set: {
              'meta.actualIn': setIn,
              'meta.actualOut': setOut,
              'meta.attendanceFlag': flag,
              'meta.attendanceNote': flag ? 'single punch' : null
            }
          }
        );
        matched += result.matchedCount || 0;
        modified += result.modifiedCount || 0;
      }
      continue;
    }

    if (!actualIn || !actualOut) continue;

    const schedules = await Schedule.find({
      userId,
      workDate: { $gte: start, $lte: end }
    }).select('_id shiftCode').lean();

    if (!schedules.length) {
      noSchedule.push({ userId, date });
      continue;
    }

    if (schedules.length > 1) {
      const shiftCodes = Array.from(new Set(schedules.map(s => String(s.shiftCode || '').toUpperCase())));
      const shifts = await Master.find({ type: 'SHIFT', code: { $in: shiftCodes } })
        .select('code meta')
        .lean();
      const shiftMap = new Map(
        shifts.map(s => [String(s.code).toUpperCase(), s.meta || {}])
      );

      const inSec = timeToSeconds(actualIn);
      const outSec = timeToSeconds(actualOut);
      let bestIn = null;
      let bestOut = null;

      schedules.forEach(s => {
        const meta = shiftMap.get(String(s.shiftCode || '').toUpperCase()) || {};
        const tf = timeToSeconds(meta.timeFrom || meta.timefrom || '');
        const tt = timeToSeconds(meta.timeTo || meta.timeto || '');
        if (inSec !== null && tf !== null) {
          const dIn = Math.abs(inSec - tf);
          if (!bestIn || dIn < bestIn.diff) bestIn = { id: s._id, diff: dIn };
        }
        if (outSec !== null && tt !== null) {
          const dOut = Math.abs(outSec - tt);
          if (!bestOut || dOut < bestOut.diff) bestOut = { id: s._id, diff: dOut };
        }
      });

      for (const s of schedules) {
        const meta = shiftMap.get(String(s.shiftCode || '').toUpperCase()) || {};
        const tf = meta.timeFrom || meta.timefrom || null;
        const tt = meta.timeTo || meta.timeto || null;
        let setIn = tf;
        let setOut = tt;
        let flag = null;

        if (bestIn && String(s._id) === String(bestIn.id)) setIn = actualIn;
        if (bestOut && String(s._id) === String(bestOut.id)) setOut = actualOut;

        const result = await Schedule.updateOne(
          { _id: s._id },
          {
            $set: {
              'meta.actualIn': setIn,
              'meta.actualOut': setOut,
              'meta.attendanceFlag': flag,
              'meta.attendanceNote': null
            }
          }
        );
        matched += result.matchedCount || 0;
        modified += result.modifiedCount || 0;
      }
      continue;
    }

    const result = await Schedule.updateMany(
      {
        userId,
        workDate: { $gte: start, $lte: end }
      },
      {
        $set: {
          'meta.actualIn': actualIn,
          'meta.actualOut': actualOut
        }
      }
    );

    matched += result.matchedCount || 0;
    modified += result.modifiedCount || 0;
    if (!result.matchedCount) {
      noSchedule.push({ userId, date });
    }
  }

  response.success(res, { matched, modified, noSchedule }, 'Attendance synced');
});
