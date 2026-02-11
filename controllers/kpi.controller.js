const mongoose = require('mongoose');
const KpiDefinition = require('../model/kpi-definition.model');
const KpiEntry = require('../model/kpi-entry.model');
const KpiDashboardWidget = require('../model/kpi-dashboard-widget.model');
const KpiThreshold = require('../model/kpi-threshold.model');
const Configuration = require('../model/configuration.model');
const asyncHandler = require('../helpers/async.handler');
const AppError = require('../helpers/apperror');
const response = require('../helpers/response');

const toDayStart = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const toMonthRange = (month, year) => {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return null;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
};

const normalizeCodes = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map(v => String(v || '').toUpperCase())
    .filter(Boolean);

const toObjectIds = (values) => {
  const list = Array.isArray(values) ? values : [values];
  return list
    .map(v => {
      try {
        return new mongoose.Types.ObjectId(String(v));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
};

const expandShiftCodes = (codes) => {
  const upper = (codes || []).map(v => String(v || '').toUpperCase());
  const expanded = new Set();
  upper.forEach((code) => {
    if (!code) return;
    expanded.add(code);
    if (code === 'M') {
      expanded.add('ช');
    } else if (code === 'A') {
      expanded.add('บ');
    } else if (code === 'N') {
      expanded.add('ด');
    }
  });
  return Array.from(expanded);
};

const inRange = (value, min, max) => {
  if (min === null || min === undefined) return false;
  if (max === null || max === undefined) return false;
  return value >= min && value <= max;
};

const countDaysInclusive = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diff = e.getTime() - s.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
};

exports.listDefinitions = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const items = await KpiDefinition.find(filter).sort({ order: 1, name: 1 });
  response.success(res, items, 'KPI definitions loaded');
});

exports.createDefinition = asyncHandler(async (req, res) => {
  const {
    code,
    name,
    description,
    valueType,
    required,
    options,
    unit,
    status,
    order,
    meta
  } = req.body;

  if (!code || !name) throw new AppError('code and name are required', 400);

  const doc = await KpiDefinition.create({
    code,
    name,
    description,
    valueType,
    required: !!required,
    options: Array.isArray(options) ? options : [],
    unit,
    status: status || 'ACTIVE',
    order: Number(order || 0),
    meta: meta || {},
    createdBy: req.user?._id || null
  });

  response.success(res, doc, 'KPI definition created', 201);
});

exports.updateDefinition = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await KpiDefinition.findById(id);
  if (!doc) throw new AppError('KPI definition not found', 404);

  const {
    name,
    description,
    valueType,
    required,
    options,
    unit,
    status,
    order,
    meta
  } = req.body;

  if (name !== undefined) doc.name = name;
  if (description !== undefined) doc.description = description;
  if (valueType) doc.valueType = valueType;
  if (required !== undefined) doc.required = !!required;
  if (options !== undefined) doc.options = Array.isArray(options) ? options : [];
  if (unit !== undefined) doc.unit = unit;
  if (status) doc.status = status;
  if (order !== undefined) doc.order = Number(order || 0);
  if (meta !== undefined) doc.meta = meta;

  await doc.save();
  response.success(res, doc, 'KPI definition updated');
});

exports.getEntry = asyncHandler(async (req, res) => {
  const { wardId, shiftCode, date } = req.query;
  if (!wardId || !shiftCode || !date) {
    throw new AppError('wardId, shiftCode and date are required', 400);
  }
  const day = toDayStart(date);
  if (!day) throw new AppError('Invalid date', 400);

  const entry = await KpiEntry.findOne({
    wardId,
    shiftCode: String(shiftCode).toUpperCase(),
    date: day
  });

  response.success(res, entry || null, 'KPI entry loaded');
});

exports.listEntriesRange = asyncHandler(async (req, res) => {
  const { wardIds, from, to, shiftCodes } = req.query;
  if (!from || !to) throw new AppError('from and to are required', 400);
  const start = toDayStart(from);
  const end = toDayStart(to);
  if (!start || !end) throw new AppError('Invalid date range', 400);

  const match = { date: { $gte: start, $lte: end } };
  if (wardIds) {
    const list = String(wardIds).split(',').map(v => v.trim()).filter(Boolean);
    const ids = toObjectIds(list);
    if (ids.length) match.wardId = { $in: ids };
  }
  if (shiftCodes) {
    const list = String(shiftCodes).split(',').map(v => v.trim()).filter(Boolean);
    if (list.length) match.shiftCode = { $in: expandShiftCodes(list) };
  }

  const entries = await KpiEntry.find(match)
    .select('wardId shiftCode date')
    .lean();

  response.success(res, entries, 'KPI entries loaded');
});

exports.upsertEntry = asyncHandler(async (req, res) => {
  const { wardId, shiftCode, date, values } = req.body;
  if (!wardId || !shiftCode || !date) {
    throw new AppError('wardId, shiftCode and date are required', 400);
  }
  const day = toDayStart(date);
  if (!day) throw new AppError('Invalid date', 400);

  const payload = {
    wardId,
    shiftCode: String(shiftCode).toUpperCase(),
    date: day,
    values: values || {},
    updatedBy: req.user?._id || null
  };

  const doc = await KpiEntry.findOneAndUpdate(
    { wardId: payload.wardId, shiftCode: payload.shiftCode, date: payload.date },
    {
      $set: payload,
      $setOnInsert: { createdBy: req.user?._id || null }
    },
    { upsert: true, new: true }
  );

  response.success(res, doc, 'KPI entry saved');
});

exports.listDashboardWidgets = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const items = await KpiDashboardWidget.find(filter).sort({ order: 1, title: 1 });
  response.success(res, items, 'KPI dashboard widgets loaded');
});

exports.createDashboardWidget = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    code: String(req.body.code || '').toUpperCase(),
    sourceCodes: normalizeCodes(req.body.sourceCodes),
    numeratorCodes: normalizeCodes(req.body.numeratorCodes),
    denominatorCodes: normalizeCodes(req.body.denominatorCodes),
    numeratorMode: req.body.numeratorMode || 'sum',
    denominatorMode: req.body.denominatorMode || 'sum',
    numeratorValue: req.body.numeratorValue ?? null,
    denominatorValue: req.body.denominatorValue ?? null,
    roles: Array.isArray(req.body.roles) ? req.body.roles : [],
    curveWidth: req.body.curveWidth !== undefined ? Number(req.body.curveWidth) : 30,
    gradient: req.body.gradient !== undefined ? !!req.body.gradient : false,
    createdBy: req.user?._id || null
  };
  if (!payload.code || !payload.title) {
    throw new AppError('code and title are required', 400);
  }
  const doc = await KpiDashboardWidget.create(payload);
  response.success(res, doc, 'KPI dashboard widget created', 201);
});

exports.updateDashboardWidget = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await KpiDashboardWidget.findById(id);
  if (!doc) throw new AppError('Widget not found', 404);
  const body = req.body || {};
  if (body.title !== undefined) doc.title = body.title;
  if (body.description !== undefined) doc.description = body.description;
  if (body.calc) doc.calc = body.calc;
  if (body.sourceCodes !== undefined) doc.sourceCodes = normalizeCodes(body.sourceCodes);
  if (body.numeratorCodes !== undefined) doc.numeratorCodes = normalizeCodes(body.numeratorCodes);
  if (body.denominatorCodes !== undefined) doc.denominatorCodes = normalizeCodes(body.denominatorCodes);
  if (body.numeratorMode !== undefined) doc.numeratorMode = body.numeratorMode;
  if (body.denominatorMode !== undefined) doc.denominatorMode = body.denominatorMode;
  if (body.numeratorValue !== undefined) doc.numeratorValue = body.numeratorValue;
  if (body.denominatorValue !== undefined) doc.denominatorValue = body.denominatorValue;
  if (body.unit !== undefined) doc.unit = body.unit;
  if (body.curveWidth !== undefined) doc.curveWidth = Number(body.curveWidth);
  if (body.gradient !== undefined) doc.gradient = !!body.gradient;
  if (body.roles !== undefined) doc.roles = Array.isArray(body.roles) ? body.roles : [];
  if (body.order !== undefined) doc.order = Number(body.order || 0);
  if (body.status) doc.status = body.status;
  if (body.meta !== undefined) doc.meta = body.meta;
  await doc.save();
  response.success(res, doc, 'KPI dashboard widget updated');
});

exports.listThresholds = asyncHandler(async (req, res) => {
  const items = await KpiThreshold.find({ status: 'ACTIVE' }).sort({ widgetCode: 1 });
  response.success(res, items, 'KPI thresholds loaded');
});

exports.upsertThreshold = asyncHandler(async (req, res) => {
  const { widgetCode } = req.body;
  if (!widgetCode) throw new AppError('widgetCode is required', 400);
  const payload = {
    widgetCode: String(widgetCode).toUpperCase(),
    greenMin: req.body.greenMin ?? null,
    greenMax: req.body.greenMax ?? null,
    amberMin: req.body.amberMin ?? null,
    amberMax: req.body.amberMax ?? null,
    redMin: req.body.redMin ?? null,
    redMax: req.body.redMax ?? null,
    status: req.body.status || 'ACTIVE'
  };
  const doc = await KpiThreshold.findOneAndUpdate(
    { widgetCode: payload.widgetCode },
    { $set: payload },
    { upsert: true, new: true }
  );
  response.success(res, doc, 'KPI threshold saved');
});

exports.dashboardSummary = asyncHandler(async (req, res) => {
  const { wardId, wardIds, month, year, from, to, shiftCode, shiftCodes } = req.query;
  let range = null;
  if (from && to) {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new AppError('Invalid date range', 400);
    }
    range = { start, end };
  } else {
    range = toMonthRange(month, year);
  }
  if (!range) throw new AppError('date range or month/year are required', 400);

  const roles = Array.isArray(req.user?.roles) ? req.user.roles.map(r => String(r).toLowerCase()) : [];
  const widgets = await KpiDashboardWidget.find({ status: 'ACTIVE' }).sort({ order: 1 });
  const visibleWidgets = widgets.filter(w => {
    if (!w.roles || !w.roles.length) return true;
    return w.roles.some(r => roles.includes(String(r).toLowerCase()));
  });

  const thresholdList = await KpiThreshold.find({ status: 'ACTIVE' }).lean();
  const thresholdMap = new Map(
    thresholdList.map(t => [String(t.widgetCode).toUpperCase(), t])
  );

  const filter = { date: { $gte: range.start, $lte: range.end } };
  if (wardId) {
    const ids = toObjectIds(wardId);
    if (ids.length) filter.wardId = ids[0];
  } else if (wardIds) {
    const list = String(wardIds).split(',').map(v => v.trim()).filter(Boolean);
    const ids = toObjectIds(list);
    if (ids.length) filter.wardId = { $in: ids };
  }
  if (shiftCode) {
    filter.shiftCode = { $in: expandShiftCodes([shiftCode]) };
  } else if (shiftCodes) {
    const list = String(shiftCodes).split(',').map(v => v.trim()).filter(Boolean);
    if (list.length) filter.shiftCode = { $in: expandShiftCodes(list) };
  }

  const entries = await KpiEntry.find(filter).lean();

  const sumCodes = (codes) => {
    if (!codes.length) return 0;
    let sum = 0;
    entries.forEach(e => {
      codes.forEach(c => {
        const v = Number(e.values?.[c] ?? 0);
        if (!Number.isNaN(v)) sum += v;
      });
    });
    return sum;
  };

  const result = visibleWidgets.map(w => {
    const code = String(w.code || '').toUpperCase();
    const source = normalizeCodes(w.sourceCodes);
    const numerator = normalizeCodes(w.numeratorCodes);
    const denominator = normalizeCodes(w.denominatorCodes);
    let value = 0;
    if (w.calc === 'count') {
      value = entries.length;
    } else if (w.calc === 'ratio') {
      const numMode = String(w.numeratorMode || 'sum').toLowerCase();
      const denMode = String(w.denominatorMode || 'sum').toLowerCase();
      const num = numMode === 'absolute'
        ? Number(w.numeratorValue || 0)
        : numMode === 'count'
          ? entries.length
          : sumCodes(numerator.length ? numerator : source);
      const den = denMode === 'absolute'
        ? Number(w.denominatorValue || 0)
        : denMode === 'count'
          ? entries.length
          : sumCodes(denominator);
      value = den ? num / den : 0;
    } else if (w.calc === 'avg') {
      const total = sumCodes(source);
      value = entries.length ? total / entries.length : 0;
    } else {
      value = sumCodes(source);
    }

    const threshold = thresholdMap.get(code);
    let status = 'unknown';
    if (threshold) {
      if (inRange(value, threshold.greenMin, threshold.greenMax)) status = 'green';
      else if (inRange(value, threshold.amberMin, threshold.amberMax)) status = 'amber';
      else if (inRange(value, threshold.redMin, threshold.redMax)) status = 'red';
    }

    return {
      code,
      title: w.title,
      description: w.description,
      unit: w.unit,
      curveWidth: w.curveWidth ?? 30,
      gradient: !!w.gradient,
      numeratorMode: w.numeratorMode || 'sum',
      denominatorMode: w.denominatorMode || 'sum',
      numeratorValue: w.numeratorValue ?? null,
      denominatorValue: w.denominatorValue ?? null,
      value,
      status,
      icon: w.meta?.icon || '',
      threshold: threshold
        ? {
            greenMin: threshold.greenMin,
            greenMax: threshold.greenMax,
            amberMin: threshold.amberMin,
            amberMax: threshold.amberMax,
            redMin: threshold.redMin,
            redMax: threshold.redMax
          }
        : null
    };
  });

  response.success(res, result, 'KPI dashboard summary loaded');
});

exports.dashboardChecklist = asyncHandler(async (req, res) => {
  const { wardId, wardIds, from, to, shiftCode, shiftCodes } = req.query;
  if (!from || !to) throw new AppError('from and to are required', 400);
  const start = toDayStart(from);
  const end = toDayStart(to);
  if (!start || !end) {
    throw new AppError('Invalid date range', 400);
  }
  const days = countDaysInclusive(start, end);
  if (!days) throw new AppError('Invalid date range', 400);

  let wardList = [];
  if (wardId) {
    const ids = toObjectIds(wardId);
    wardList = await Configuration.find({ _id: { $in: ids }, typ_code: 'DEPT' })
      .select('_id conf_description conf_code')
      .lean();
  } else if (wardIds) {
    const list = String(wardIds).split(',').map(v => v.trim()).filter(Boolean);
    const ids = toObjectIds(list);
    wardList = await Configuration.find({ _id: { $in: ids }, typ_code: 'DEPT' })
      .select('_id conf_description conf_code')
      .lean();
  } else {
    wardList = await Configuration.find({ typ_code: 'DEPT' })
      .select('_id conf_description conf_code')
      .lean();
  }

  const rawList = shiftCode
    ? [String(shiftCode).toUpperCase()]
    : shiftCodes
      ? String(shiftCodes).split(',').map(v => v.trim().toUpperCase()).filter(Boolean)
      : ['M', 'A', 'N'];
  const rawSet = Array.from(new Set(rawList)).filter(Boolean);
  const shifts = expandShiftCodes(rawSet);
  const shiftCount = rawSet.length || 3;

  const match = {
    date: { $gte: start, $lte: end },
    shiftCode: { $in: shifts }
  };
  if (wardId) {
    const ids = toObjectIds(wardId);
    if (ids.length) match.wardId = ids[0];
  } else if (wardIds) {
    const list = String(wardIds).split(',').map(v => v.trim()).filter(Boolean);
    const ids = toObjectIds(list);
    if (ids.length) match.wardId = { $in: ids };
  }

  const agg = await KpiEntry.aggregate([
    { $match: match },
    { $group: { _id: { wardId: '$wardId', date: '$date', shiftCode: '$shiftCode' } } },
    { $group: { _id: '$_id.wardId', completed: { $sum: 1 } } }
  ]);

  const completedMap = new Map(agg.map(r => [String(r._id), r.completed]));
  const totalExpected = days * shiftCount;

  const rows = wardList.map(w => {
    const completed = completedMap.get(String(w._id)) || 0;
    const percent = totalExpected ? Math.round((completed / totalExpected) * 100) : 0;
    let status = 'red';
    if (percent >= 100) status = 'green';
    else if (percent >= 75) status = 'blue';
    else if (percent >= 26) status = 'amber';
    return {
      wardId: w._id,
      wardName: w.conf_description,
      wardCode: w.conf_code,
      days,
      shifts: shiftCount,
      totalExpected,
      completed,
      percent,
      status
    };
  });

  response.success(res, rows, 'KPI checklist loaded');
});
