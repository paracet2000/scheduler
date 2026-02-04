const ChangeRequest = require('../models/changerequest.model');
const Schedule = require('../models/schedule.model');
const AppError = require('../helpers/apperror');

/* ======================================================
 * CREATE change request (LEAVE / SWAP / CHANGE)
 * USER เรียก
 * ====================================================== */
exports.create = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const {
      type,
      reason,
      affectedSchedules,
      acceptedBy // optional (SWAP / CHANGE)
    } = req.body;

    if (!type || !affectedSchedules?.length) {
      throw new AppError('Invalid request data', 400);
    }

    const request = await ChangeRequest.create({
      type,
      reason,
      requestedBy: userId,
      acceptedBy: acceptedBy || null,
      affectedSchedules,
      status: 'OPEN'
    });

    res.status(201).json({
      result: true,
      message: 'Change request created',
      data: request
    });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
 * LIST change requests
 * USER = ของตัวเอง
 * HEAD / ADMIN = ตาม ward
 * ====================================================== */
exports.list = async (req, res, next) => {
  try {
    const { status, type } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    // user ธรรมดาเห็นของตัวเอง
    if (req.user.role === 'USER') {
      filter.requestedBy = req.user._id;
    }

    const requests = await ChangeRequest.find(filter)
      .populate('requestedBy', 'name email')
      .populate('acceptedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      result: true,
      data: requests
    });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
 * GET single request
 * ====================================================== */
exports.getById = async (req, res, next) => {
  try {
    const request = await ChangeRequest.findById(req.params.id)
      .populate('requestedBy', 'name email')
      .populate('acceptedBy', 'name email')
      .populate('affectedSchedules.scheduleId');

    if (!request) {
      throw new AppError('Change request not found', 404);
    }

    res.json({
      result: true,
      data: request
    });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
 * APPROVE request
 * HEAD / APPROVER / ADMIN
 * ====================================================== */
exports.approve = async (req, res, next) => {
  try {
    const request = await ChangeRequest.findById(req.params.id);
    if (!request) throw new AppError('Request not found', 404);

    if (request.status !== 'OPEN') {
      throw new AppError('Request already processed', 400);
    }

    // validation
    if (
      (request.type === 'SWAP' || request.type === 'CHANGE') &&
      !request.acceptedBy
    ) {
      throw new AppError('No replacement user', 400);
    }

    /* -------- apply to schedules -------- */
    for (const item of request.affectedSchedules) {
      const schedule = await Schedule.findById(item.scheduleId);
      if (!schedule) continue;

      switch (request.type) {
        case 'LEAVE':
          schedule.status = 'LEAVE';
          schedule.meta = {
            ...schedule.meta,
            leaveReason: request.reason
          };
          break;

        case 'SWAP':
          schedule.meta = {
            ...schedule.meta,
            swappedFrom: schedule.user
          };
          schedule.user = request.acceptedBy;
          schedule.status = 'SWAPPED';
          break;

        case 'CHANGE':
          schedule.meta = {
            ...schedule.meta,
            replacedFrom: schedule.user
          };
          schedule.user = request.acceptedBy;
          schedule.status = 'REPLACED';
          break;
      }

      schedule.changeRequest = request._id;
      await schedule.save();
    }

    /* -------- update request -------- */
    request.status = 'APPROVED';
    request.approvedBy = req.user._id;
    request.approvedAt = new Date();

    await request.save();

    res.json({
      result: true,
      message: 'Request approved',
      data: request
    });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
 * REJECT request
 * HEAD / APPROVER / ADMIN
 * ====================================================== */
exports.reject = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const request = await ChangeRequest.findById(req.params.id);

    if (!request) throw new AppError('Request not found', 404);
    if (request.status !== 'OPEN') {
      throw new AppError('Request already processed', 400);
    }

    request.status = 'REJECTED';
    request.rejectedBy = req.user._id;
    request.rejectedAt = new Date();
    request.rejectReason = reason || null;

    await request.save();

    res.json({
      result: true,
      message: 'Request rejected',
      data: request
    });
  } catch (err) {
    next(err);
  }
};
