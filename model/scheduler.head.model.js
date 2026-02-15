// models/scheduler.head.model.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

const schedulerHeadSchema = new Schema(
  {
    // ใช้รหัส ward (conf_code) แทน ObjectId
    wardCode: {
      type: String,
      required: true,
      trim: true
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

    monthYear: {
      type: String,
      trim: true,
      match: [/^\d{2}-\d{4}$/, 'monthYear must be in MM-YYYY format'],
      index: true,
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
  { wardCode: 1, monthYear: 1 },
  { unique: true, partialFilterExpression: { monthYear: { $exists: true } } }
);

// index สำหรับ query ตอน create / edit schedule
schedulerHeadSchema.index({
  wardCode: 1,
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

  if (this.periodStart) {
    const d = new Date(this.periodStart);
    if (!Number.isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = String(d.getFullYear());
      this.monthYear = `${mm}-${yyyy}`;
    }
  }

  next();
});

module.exports = mongoose.model('SchedulerHead', schedulerHeadSchema);
