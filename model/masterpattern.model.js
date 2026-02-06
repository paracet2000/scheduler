const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Master Pattern Model
 * ใช้เก็บ pattern สำหรับเติมเวรแบบอัตโนมัติ
 * เช่น "M ทุกวันจันทร์", "N เสาร์-อาทิตย์"
 */
const masterPatternSchema = new Schema(
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


    /**
     * dayCodes: 7 slots (0=Sun ... 6=Sat)
     * ใช้ค่า '' เมื่อไม่มีรหัสเวร
     */
    dayCodes: {
      type: [String],
      default: () => Array(7).fill(''),
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
      default: {},
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

masterPatternSchema.index({ status: 1, order: 1 });

module.exports = mongoose.model(
  'MasterPattern',
  masterPatternSchema,
  'master_patterns'
);
