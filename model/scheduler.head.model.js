// models/scheduler.head.model.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

const schedulerHeadSchema = new Schema(
  {
    // อ้างอิง ward จาก master.model (type = WARD)
    wardId: {
      type: Schema.Types.ObjectId,
      ref: 'Master',
      required: true,
    },

    // ช่วงวันที่อนุญาตให้สร้าง / แก้ไขเวร
    periodStart: {
      type: Date,
      required: true,
    },

    periodEnd: {
      type: Date,
      required: true,
    },

    // สถานะของรอบเวร
    status: {
      type: String,
      enum: ['DRAFT', 'OPEN', 'CLOSED'],
      default: 'DRAFT',
      index: true,
    },

    // policy เสริม (เผื่ออนาคต)
    allowPast: {
      type: Boolean,
      default: false,
    },

    allowFuture: {
      type: Boolean,
      default: true,
    },

    // หมายเหตุจากหัวหน้า
    note: {
      type: String,
      trim: true,
    },

    // audit
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    openedAt: {
      type: Date,
    },

    closedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * =========================
 * Indexes
 * =========================
 */

// 1 ward สามารถมี OPEN ได้เพียง 1 record เท่านั้น
schedulerHeadSchema.index(
  { wardId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'OPEN' },
  }
);

// index สำหรับ query ตอน create / edit schedule
schedulerHeadSchema.index({
  wardId: 1,
  status: 1,
  periodStart: 1,
  periodEnd: 1,
});

/**
 * =========================
 * Validations
 * =========================
 */

// กัน period กลับหัว
schedulerHeadSchema.pre('validate', function (next) {
  if (this.periodStart && this.periodEnd && this.periodStart > this.periodEnd) {
    return next(
      new Error('periodStart must be earlier than periodEnd')
    );
  }
  next();
});

module.exports = mongoose.model('SchedulerHead', schedulerHeadSchema);
