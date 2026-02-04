// models/schedule.model.js
const mongoose = require('mongoose')

const scheduleSchema = new mongoose.Schema(
  {
    /**
     * context หลัก
     */
    wardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ward',
      required: true
    },

    userWardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserWard',
      required: true
    },

    /**
     * วันที่ทำงาน
     */
    workDate: {
      type: Date,
      required: true
    },

    /**
     * รหัสเวร เช่น M, A, N, A*, N#
     */
    shiftCode: {
      type: String,
      required: true,
      trim: true
    },

    /**
     * สถานะ workflow
     */
    status: {
      type: String,
      enum: [
        'BOOK',        // user ลงเอง
        'PROPOSE',     // head ปรับ
        'ACTIVE',      // ตารางใช้งานจริง
        'OK',          // มาทำงาน
        'CALCULATED',  // คำนวณเงินแล้ว
        'PAID'         // จ่ายเงินแล้ว
      ],
      default: 'BOOK'
    },

    /**
     * กรณีพิเศษ เช่น OT, เปลี่ยนเวร, สีพื้นหลัง
     */
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
      /*
        {
          color: "#ff0000",
          isOvertime: true,
          note: "swap with xxx",
          hours: 10
        }
      */
    },

    /**
     * audit
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    collection: 'schedules'
  }
)

/**
 * index สำคัญมาก
 * 1 คน / 1 วัน / 1 เวร ต้องไม่ซ้ำ
 */
scheduleSchema.index(
  { userWardId: 1, workDate: 1, shiftCode: 1 },
  { unique: true }
)

/**
 * ใช้ query helper
 */
scheduleSchema.query.active = function () {
  return this.where({ status: 'ACTIVE' })
}

module.exports = mongoose.model('Schedule', scheduleSchema)
