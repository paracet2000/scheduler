// models/WardMember.js
const mongoose = require('mongoose')

const userWardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    wardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Master',
      required: true
    },

    /**
     * ตำแหน่งใน ward
     * เช่น RN, GN, AID, HEAD
     */
    position: {
      type: String,
      required: true,
      trim: true
    },

    /**
     * สิทธิ์ระดับ ward
     */
    roles: {
      type: [String],
      default: ['USER']
      /*
        USER        : ลงเวรตัวเอง
        HEAD        : จัดตาราง ward
        APPROVER    : approve ตาราง
        HR          : ดู attendance
        FINANCE     : คำนวณเงิน
      */
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE'
    },

    /**
     * เก็บ context เพิ่มเติม
     */
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
      /*
        {
          canOvertime: true,
          note: "ช่วย ward อื่นชั่วคราว"
        }
      */
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    collection: 'user_wards'
  }
)

/**
 * 1 user + 1 ward = 1 record
 */
userWardSchema.index(
  { userId: 1, wardId: 1 },
  { unique: true }
)

/**
 * helper
 */
userWardSchema.query.active = function () {
  return this.where({ status: 'ACTIVE' })
}

module.exports = mongoose.model('WardMember', userWardSchema, 'user_wards')
