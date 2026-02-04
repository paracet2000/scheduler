const mongoose = require('mongoose')

const wardSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String
    },

    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
)

// index สำหรับค้นหาเร็ว
wardSchema.index({ code: 1 })

module.exports = mongoose.model('Ward', wardSchema)
