// model/mastertype.model.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Master Type Model
 * เน้นเก็บประเภทของ master ที่ใช้งานจริง เช่น
 * - WARD
 * - SHIFT
 * - POSITION
 * - SHIFT_NOTATION
 */
const masterTypeSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
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

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },

    order: {
      type: Number,
      default: 0,
      index: true,
    },

    meta: {
      type: Schema.Types.Mixed,
      default: function () {
        const t = String(this.code || this.type || '').toUpperCase();
        switch (t) {
          case 'WARD':
            return { color: '#2563eb', icon: 'ward', hint: 'ใช้สำหรับ ward' };
          case 'SHIFT':
            return { color: '#0ea5e9', icon: 'clock', hint: 'ใช้สำหรับ shift' };
          case 'POSITION':
            return { color: '#22c55e', icon: 'briefcase', hint: 'ใช้สำหรับ position' };
          case 'SHIFT_NOTATION':
            return { color: '#f59e0b', icon: 'tag', hint: 'ใช้สำหรับ notation' };
          default:
            return { color: '#64748b', icon: 'settings', hint: 'master type' };
        }
      },
    },

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
masterTypeSchema.index({ status: 1, order: 1 });

module.exports = mongoose.model(
  'MasterType',
  masterTypeSchema,
  'master_types'
);
