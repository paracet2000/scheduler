const ChangeRequest = require('../model/changerequest.model');
const Schedule = require('../model/schedule.model');
const WardMember = require('../model/ward-member.model');
const Configuration = require('../model/configuration.model');
const { parseConfValue } = require('../utils/config-meta');
const mail = require('../helpers/mail.helper');
const notify = require('../helpers/notify.helper');
const AppError = require('../helpers/apperror');

/* ======================================================
 * CREATE change request (LEAVE / SWAP / CHANGE)
 * USER เรียก
 * ====================================================== */
exports.create = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userEmail = req.user.email;
    const userPhone = req.user.phone;
    const {
      type,
      reason,
      affectedSchedules,
      acceptedBy // optional (SWAP / CHANGE)
    } = req.body;

    if (!type || !affectedSchedules?.length) {
      throw new AppError('Invalid request data', 400);
    }

    if (!userEmail || !userPhone) {
      throw new AppError('Email and phone are required before creating a request', 400);
    }

    if (type === 'SWAP' && !acceptedBy) {
      throw new AppError('Change with is required for SWAP', 400);
    }

    const request = await ChangeRequest.create({
      type,
      reason,
      requestedBy: userId,
      acceptedBy: acceptedBy || null,
      affectedSchedules,
      status: 'OPEN'
    });

    const scheduleIds = affectedSchedules
      .map(item => item.scheduleId)
      .filter(Boolean);
    if (scheduleIds.length) {
      await Schedule.updateMany(
        { _id: { $in: scheduleIds } },
        {
          $set: {
            'meta.changeRequestId': request._id,
            'meta.changeStatus': 'OPEN',
            'meta.changeType': type
          }
        }
      );
    }

    // Notify (email + SMS) - enabled by default, can be disabled via ENABLE_NOTIFY=false
    const notifyEnabled = String(process.env.ENABLE_NOTIFY || 'true').toLowerCase() === 'true';
    if (notifyEnabled) {
      const scheduleDocs = await Promise.all(
        affectedSchedules.map(async (item) => {
          if (!item?.scheduleId) return null;
          return Schedule.findById(item.scheduleId).select('wardId workDate shiftCode').lean();
        })
      );
      const scheduleDetails = affectedSchedules.map((item, idx) => {
        const doc = scheduleDocs[idx];
        return {
          wardId: doc?.wardId,
          workDate: doc?.workDate || item?.date,
          shiftCode: doc?.shiftCode || item?.shiftCode
        };
      }).filter(d => d.workDate && d.shiftCode);

      const wardId = scheduleDetails[0]?.wardId || null;

      const notifyUser = async (user, message) => {
        if (user?.email) {
          await mail.sendChangeRequestEmail(user.email, 'Change Request Notification', `<p>${message}</p>`);
        }
        if (user?.phone) {
          await notify.sendSms(user.phone, message);
        }
      };

      if (type === 'SWAP' && acceptedBy) {
        const target = await WardMember.findOne({ userId: acceptedBy })
          .populate('userId', 'name email phone')
          .lean();
        if (target?.userId) {
          const detail = scheduleDetails[0];
          const dateText = detail?.workDate ? new Date(detail.workDate).toDateString() : '';
          await notifyUser(
            target.userId,
            `Swap request from ${req.user.name || req.user.email} for ${detail?.shiftCode || ''} on ${dateText}`
          );
        }
      }

      if (type === 'CHANGE' && wardId) {
        // find same position + ward group
        const myWard = await WardMember.findOne({ userId, wardId, status: 'ACTIVE' });
        const ward = await Configuration.findById(wardId).select('conf_value options').lean();
        const wardMeta = parseConfValue(ward);
        const group = wardMeta.group || wardMeta.wardGroup || wardMeta.value || null;
        let wardIds = [wardId];
        if (group) {
          const sameGroup = await Configuration.find({ typ_code: 'DEPT' })
            .select('_id conf_value options')
            .lean();
          wardIds = sameGroup
            .filter(w => {
              const meta = parseConfValue(w);
              const g = meta.group || meta.wardGroup || meta.value || null;
              return g && String(g) === String(group);
            })
            .map(w => w._id);
        }

        const query = { wardId: { $in: wardIds }, status: 'ACTIVE' };
        if (myWard?.position) query.position = myWard.position;
        const candidates = await WardMember.find(query).populate('userId', 'name email phone').lean();
        const candidateUsers = candidates.map(c => c.userId).filter(u => u && String(u._id) !== String(userId));

        for (const detail of scheduleDetails) {
          if (!detail.workDate || !detail.shiftCode) continue;
          const busy = await Schedule.find({
            userId: { $in: candidateUsers.map(u => u._id) },
            workDate: detail.workDate,
            shiftCode: detail.shiftCode
          }).select('userId').lean();
          const busyIds = new Set(busy.map(b => String(b.userId)));
          const available = candidateUsers.filter(u => !busyIds.has(String(u._id)));

          for (const u of available) {
            await notifyUser(
              u,
              `Change request available: ${detail.shiftCode} on ${new Date(detail.workDate).toDateString()}`
            );
          }
        }
      }

      if (type === 'LEAVE' && wardId) {
        const heads = await WardMember.find({ wardId, roles: { $in: ['HEAD'] }, status: 'ACTIVE' })
          .populate('userId', 'name email phone')
          .lean();
        for (const h of heads) {
          if (h.userId) {
            const detail = scheduleDetails[0];
            const dateText = detail?.workDate ? new Date(detail.workDate).toDateString() : '';
            await notifyUser(
              h.userId,
              `Leave request from ${req.user.name || req.user.email} on ${dateText}`
            );
          }
        }
      }
    }

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
    const { status, type, wardId } = req.query;

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

    const notifyEnabled = String(process.env.ENABLE_NOTIFY || 'true').toLowerCase() === 'true';

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

    const approvedIds = request.affectedSchedules
      .map(item => item.scheduleId)
      .filter(Boolean);
    if (approvedIds.length) {
      await Schedule.updateMany(
        { _id: { $in: approvedIds } },
        { $set: { 'meta.changeStatus': 'APPROVED' } }
      );
    }

    if (notifyEnabled) {
      const scheduleDocs = await Promise.all(
        request.affectedSchedules.map(async (item) => {
          if (!item?.scheduleId) return null;
          return Schedule.findById(item.scheduleId).select('wardId workDate shiftCode').lean();
        })
      );
      const scheduleDetails = request.affectedSchedules.map((item, idx) => {
        const doc = scheduleDocs[idx];
        return {
          wardId: doc?.wardId,
          workDate: doc?.workDate || item?.date,
          shiftCode: doc?.shiftCode || item?.shiftCode
        };
      }).filter(d => d.workDate && d.shiftCode);

      const notifyUser = async (user, message) => {
        if (user?.email) {
          await mail.sendChangeRequestEmail(user.email, 'Change Request Approved', `<p>${message}</p>`);
        }
        if (user?.phone) {
          await notify.sendSms(user.phone, message);
        }
      };

      const requestor = await WardMember.findOne({ userId: request.requestedBy })
        .populate('userId', 'name email phone')
        .lean();

      const acceptor = request.acceptedBy
        ? await WardMember.findOne({ userId: request.acceptedBy }).populate('userId', 'name email phone').lean()
        : null;

      const detail = scheduleDetails[0];
      const dateText = detail?.workDate ? new Date(detail.workDate).toDateString() : '';

      if (requestor?.userId) {
        await notifyUser(
          requestor.userId,
          `Your change request has been approved for ${detail?.shiftCode || ''} on ${dateText}`
        );
      }
      if (acceptor?.userId) {
        await notifyUser(
          acceptor.userId,
          `Change request approved: ${detail?.shiftCode || ''} on ${dateText}`
        );
      }
    }

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

    const notifyEnabled = String(process.env.ENABLE_NOTIFY || 'true').toLowerCase() === 'true';

    request.status = 'REJECTED';
    request.rejectedBy = req.user._id;
    request.rejectedAt = new Date();
    request.rejectReason = reason || null;

    await request.save();

    const rejectedIds = request.affectedSchedules
      .map(item => item.scheduleId)
      .filter(Boolean);
    if (rejectedIds.length) {
      await Schedule.updateMany(
        { _id: { $in: rejectedIds } },
        { $set: { 'meta.changeStatus': 'REJECTED' } }
      );
    }

    if (notifyEnabled) {
      const scheduleDocs = await Promise.all(
        request.affectedSchedules.map(async (item) => {
          if (!item?.scheduleId) return null;
          return Schedule.findById(item.scheduleId).select('wardId workDate shiftCode').lean();
        })
      );
      const scheduleDetails = request.affectedSchedules.map((item, idx) => {
        const doc = scheduleDocs[idx];
        return {
          wardId: doc?.wardId,
          workDate: doc?.workDate || item?.date,
          shiftCode: doc?.shiftCode || item?.shiftCode
        };
      }).filter(d => d.workDate && d.shiftCode);

      const notifyUser = async (user, message) => {
        if (user?.email) {
          await mail.sendChangeRequestEmail(user.email, 'Change Request Rejected', `<p>${message}</p>`);
        }
        if (user?.phone) {
          await notify.sendSms(user.phone, message);
        }
      };

      const requestor = await WardMember.findOne({ userId: request.requestedBy })
        .populate('userId', 'name email phone')
        .lean();

      const acceptor = request.acceptedBy
        ? await WardMember.findOne({ userId: request.acceptedBy }).populate('userId', 'name email phone').lean()
        : null;

      const detail = scheduleDetails[0];
      const dateText = detail?.workDate ? new Date(detail.workDate).toDateString() : '';

      if (requestor?.userId) {
        await notifyUser(
          requestor.userId,
          `Your change request has been rejected for ${detail?.shiftCode || ''} on ${dateText}`
        );
      }
      if (acceptor?.userId) {
        await notifyUser(
          acceptor.userId,
          `Change request rejected: ${detail?.shiftCode || ''} on ${dateText}`
        );
      }
    }

    res.json({
      result: true,
      message: 'Request rejected',
      data: request
    });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
 * LIST inbox requests (for acceptedBy user)
 * USER
 * ====================================================== */
exports.inbox = async (req, res, next) => {
  try {
    const { status, wardId } = req.query;
    const filter = { acceptedBy: req.user._id };
    if (status) filter.status = status;

    let requests = await ChangeRequest.find(filter)
      .populate('requestedBy', 'name email')
      .populate('acceptedBy', 'name email')
      .sort({ createdAt: -1 });

    if (wardId) {
      const wardScheduleIds = await Schedule.find({ wardId })
        .select('_id')
        .lean();
      const wardSet = new Set(wardScheduleIds.map(s => String(s._id)));
      requests = requests.filter(r =>
        Array.isArray(r.affectedSchedules) &&
        r.affectedSchedules.some(a => wardSet.has(String(a.scheduleId)))
      );
    }

    res.json({
      result: true,
      data: requests
    });
  } catch (err) {
    next(err);
  }
};

/* ======================================================
 * ACCEPT request (for SWAP/CHANGE partner)
 * USER (acceptedBy) only
 * ====================================================== */
exports.accept = async (req, res, next) => {
  try {
    const request = await ChangeRequest.findById(req.params.id);

    if (!request) throw new AppError('Request not found', 404);
    if (request.status !== 'OPEN') {
      throw new AppError('Request already processed', 400);
    }

    if (!['SWAP', 'CHANGE'].includes(request.type)) {
      throw new AppError('Only SWAP or CHANGE can be accepted', 400);
    }

    if (!request.acceptedBy || String(request.acceptedBy) !== String(req.user._id)) {
      throw new AppError('You are not the designated replacement', 403);
    }

    const notifyEnabled = String(process.env.ENABLE_NOTIFY || 'true').toLowerCase() === 'true';

    request.meta = {
      ...request.meta,
      acceptedAt: new Date(),
      acceptedBy: req.user._id,
      acceptedStatus: 'ACCEPTED'
    };
    await request.save();

    const scheduleIds = request.affectedSchedules
      .map(item => item.scheduleId)
      .filter(Boolean);
    if (scheduleIds.length) {
      await Schedule.updateMany(
        { _id: { $in: scheduleIds } },
        { $set: { 'meta.changeStatus': 'ACCEPTED' } }
      );
    }

    if (notifyEnabled) {
      const scheduleDocs = await Promise.all(
        request.affectedSchedules.map(async (item) => {
          if (!item?.scheduleId) return null;
          return Schedule.findById(item.scheduleId).select('wardId workDate shiftCode').lean();
        })
      );
      const scheduleDetails = request.affectedSchedules.map((item, idx) => {
        const doc = scheduleDocs[idx];
        return {
          wardId: doc?.wardId,
          workDate: doc?.workDate || item?.date,
          shiftCode: doc?.shiftCode || item?.shiftCode
        };
      }).filter(d => d.workDate && d.shiftCode);

      const notifyUser = async (user, message) => {
        if (user?.email) {
          await mail.sendChangeRequestEmail(user.email, 'Change Request Accepted', `<p>${message}</p>`);
        }
        if (user?.phone) {
          await notify.sendSms(user.phone, message);
        }
      };

      const requestedBy = await WardMember.findOne({ userId: request.requestedBy })
        .populate('userId', 'name email phone')
        .lean();

      if (requestedBy?.userId) {
        const detail = scheduleDetails[0];
        const dateText = detail?.workDate ? new Date(detail.workDate).toDateString() : '';
        await notifyUser(
          requestedBy.userId,
          `Your change request has been accepted for ${detail?.shiftCode || ''} on ${dateText}`
        );
      }
    }

    res.json({
      result: true,
      message: 'Request accepted',
      data: request
    });
  } catch (err) {
    next(err);
  }
};
