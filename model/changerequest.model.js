const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * ChangeRequest
 * - LEAVE   : ขอลา
 * - SWAP    : สลับเวร (มีคนมาแทน)
 * - CHANGE  : เปลี่ยนเวร (หัวหน้าจัดให้)
 */

const ChangeRequestSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['LEAVE', 'SWAP', 'CHANGE'],
      required: true
    },

    status: {
      type: String,
      enum: ['OPEN', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'OPEN',
      index: true
    },

    reason: {
      type: String,
      trim: true
    },

    /** คนที่ขอ */
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    /** คนที่มาแทน (SWAP / CHANGE) */
    acceptedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    /** เวรที่ได้รับผลกระทบ (หลายวันได้) */
    affectedSchedules: [
      {
        scheduleId: {
          type: Schema.Types.ObjectId,
          ref: 'Schedule',
          required: true
        },
        date: {
          type: Date,
          required: true
        },
        shiftCode: {
          type: String,
          required: true
        }
      }
    ],

    /** การอนุมัติ */
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,

    /** การปฏิเสธ */
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedAt: Date,
    rejectReason: String,

    /** meta สำหรับอนาคต */
    meta: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

/* ===============================
 * Index เพื่อ performance
 * =============================== */
ChangeRequestSchema.index({ requestedBy: 1, status: 1 });
ChangeRequestSchema.index({ type: 1, status: 1 });
ChangeRequestSchema.index({ 'affectedSchedules.date': 1 });

module.exports = mongoose.model('ChangeRequest', ChangeRequestSchema);
