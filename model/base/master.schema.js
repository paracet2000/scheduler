const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Master Model
 * ใช้เป็น reference data กลาง เช่น
 * - WARD
 * - SHIFT
 * - POSITION
 * - SHIFT_NOTATION
 * - ROLE (optional)
 */
const masterSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    /**
     * Namespace / Category
     * เช่น WARD, SHIFT, POSITION
     */
    type: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },

    /**
     * สถานะการใช้งาน
     */
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },

    /**
     * Meta data (presentation / hint / config)
     * ❗ ห้ามใส่ business logic สำคัญไว้ตรงนี้
     */
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },

    /**
     * Audit
     */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* =========================
 * Indexes
 * ========================= */

// code ต้อง unique ภายใน type เดียวกัน
masterSchema.index(
  { type: 1, code: 1 },
  { unique: true }
);

// ใช้ filter เร็ว ๆ
masterSchema.index({ type: 1, status: 1 });

/* =========================
 * Export
 * ========================= */

module.exports = mongoose.model(
  'Master',
  masterSchema,
  'masters'
);
