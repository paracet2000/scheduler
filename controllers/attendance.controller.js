const Schedule = require('../model/schedule.model');
const Configuration = require('../model/configuration.model');
const { parseConfValue } = require('../utils/config-meta');
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
    const parts = String(time || '').trim().replace('.', ':').split(':').map(Number);
    if (parts.length < 2) return null;
    const [h, m, s = 0] = parts;
    return (h * 3600) + (m * 60) + s;
  };

  const computeDiff = ({ inSec, outSec, tfSec, ttSec, crossDay }) => {
    if (inSec === null || outSec === null || tfSec === null || ttSec === null) return null;

    let expectedOut = ttSec;
    let actualOut = outSec;

    const isCross = !!crossDay || (ttSec < tfSec);
    if (isCross) {
      expectedOut += 86400;
      // If the punch-out is after midnight, it will look "smaller" than tfSec.
      // Align it to next day for diff calculation.
      if (actualOut < tfSec) actualOut += 86400;
    }

    return Math.abs(inSec - tfSec) + Math.abs(actualOut - expectedOut);
  };

  for (const row of rows) {
    const { userId, date, actualIn, actualOut, punchCount, singleTime } = row || {};
    if (!userId || !date) continue;
    const { start, end } = getDayRange(date);

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
      const shifts = await Configuration.find({ typ_code: 'SHIFT', conf_code: { $in: shiftCodes } })
        .select('conf_code conf_value options')
        .lean();
      const shiftMap = new Map(
        shifts.map(s => [String(s.conf_code).toUpperCase(), parseConfValue(s)])
      );

      const punchSec = timeToSeconds(singleTime);
      if (punchSec === null) continue;

      // Pick the closest schedule (by min distance to timeFrom/timeTo)
      let best = null;
      schedules.forEach((s) => {
        const meta = shiftMap.get(String(s.shiftCode || '').toUpperCase()) || {};
        const tfText = meta.timeFrom || meta.timefrom || null;
        const ttText = meta.timeTo || meta.timeto || null;
        const tf = timeToSeconds(tfText || '');
        const tt = timeToSeconds(ttText || '');
        if (tf === null && tt === null) return;

        const dIn = tf === null ? Number.POSITIVE_INFINITY : Math.abs(punchSec - tf);
        const dOut = tt === null ? Number.POSITIVE_INFINITY : Math.abs(punchSec - tt);
        const diff = Math.min(dIn, dOut);
        if (!best || diff < best.diff) {
          best = {
            id: String(s._id),
            shiftCode: String(s.shiftCode || ''),
            diff,
            tfText,
            ttText,
            tf,
            tt
          };
        }
      });

      // Fallback: if shift metadata missing for all, just update the first schedule.
      if (!best) {
        best = { id: String(schedules[0]._id), shiftCode: String(schedules[0].shiftCode || ''), diff: null };
      }

      for (const s of schedules) {
        const isMatch = String(s._id) === String(best.id);
        const meta = shiftMap.get(String(s.shiftCode || '').toUpperCase()) || {};
        const tfText = meta.timeFrom || meta.timefrom || null;
        const ttText = meta.timeTo || meta.timeto || null;

        let setIn = null;
        let setOut = null;
        let flag = null;

        if (isMatch) {
          // If both timeFrom and timeTo exist, decide whether this punch is closer to IN or OUT.
          const tf = timeToSeconds(tfText || '');
          const tt = timeToSeconds(ttText || '');
          if (tf !== null && tt !== null) {
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
          } else {
            // No metadata to decide: keep backward behavior (set both to singleTime)
            setIn = singleTime;
            setOut = singleTime;
          }
        }

        const result = await Schedule.updateOne(
          { _id: s._id },
          {
            $set: {
              'meta.expectedIn': tfText || null,
              'meta.expectedOut': ttText || null,
              'meta.actualIn': setIn,
              'meta.actualOut': setOut,
              'meta.attendanceFlag': flag,
              'meta.attendanceNote': isMatch && flag ? 'single punch' : null,
              'meta.attendanceDiffSec': isMatch && best.diff !== null ? best.diff : null,
              'meta.attendanceMatchedShift': isMatch ? String(s.shiftCode || '') : null
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

    const shiftCodes = Array.from(new Set(schedules.map(s => String(s.shiftCode || '').toUpperCase())));
    const shifts = await Configuration.find({ typ_code: 'SHIFT', conf_code: { $in: shiftCodes } })
      .select('conf_code conf_value options')
      .lean();
    const shiftMap = new Map(
      shifts.map(s => [String(s.conf_code).toUpperCase(), parseConfValue(s)])
    );

    const inSec = timeToSeconds(actualIn);
    const outSec = timeToSeconds(actualOut);

    // Pick the closest schedule by total abs diff:
    // |actualIn - timeFrom| + |actualOut - timeTo| (handles cross-day)
    let best = null;
    schedules.forEach((s) => {
      const meta = shiftMap.get(String(s.shiftCode || '').toUpperCase()) || {};
      const tfText = meta.timeFrom || meta.timefrom || null;
      const ttText = meta.timeTo || meta.timeto || null;
      const tf = timeToSeconds(tfText || '');
      const tt = timeToSeconds(ttText || '');
      if (tf === null || tt === null) return;

      const diff = computeDiff({
        inSec,
        outSec,
        tfSec: tf,
        ttSec: tt,
        crossDay: !!meta.crossDay
      });
      if (diff === null) return;

      if (!best || diff < best.diff) {
        best = {
          id: String(s._id),
          shiftCode: String(s.shiftCode || ''),
          diff
        };
      }
    });

    // Fallback: if shift metadata missing, just match the first schedule.
    if (!best) {
      best = { id: String(schedules[0]._id), shiftCode: String(schedules[0].shiftCode || ''), diff: null };
    }

    for (const s of schedules) {
      const meta = shiftMap.get(String(s.shiftCode || '').toUpperCase()) || {};
      const tfText = meta.timeFrom || meta.timefrom || null;
      const ttText = meta.timeTo || meta.timeto || null;
      const isMatch = String(s._id) === String(best.id);

      const result = await Schedule.updateOne(
        { _id: s._id },
        {
          $set: {
            'meta.expectedIn': tfText || null,
            'meta.expectedOut': ttText || null,
            'meta.actualIn': isMatch ? actualIn : null,
            'meta.actualOut': isMatch ? actualOut : null,
            'meta.attendanceFlag': null,
            'meta.attendanceNote': null,
            'meta.attendanceDiffSec': isMatch && best.diff !== null ? best.diff : null,
            'meta.attendanceMatchedShift': isMatch ? String(s.shiftCode || '') : null
          }
        }
      );
      matched += result.matchedCount || 0;
      modified += result.modifiedCount || 0;
    }
  }

  response.success(res, { matched, modified, noSchedule }, 'Attendance synced');
});
