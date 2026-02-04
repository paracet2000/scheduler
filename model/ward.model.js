// models/Ward.js
const mongoose = require('mongoose')
const masterSchema = require('./base/master.schema')

const wardSchema = new mongoose.Schema(
  {
    ...masterSchema,

    type: {
      type: String,
      default: 'WARD',
      immutable: true
    }
  },
  {
    timestamps: true,          // createdAt / updatedAt
    collection: 'wards'
  }
)

/**
 * Index
 * - code ต้อง unique
 */
wardSchema.index({ code: 1 }, { unique: true })

/**
 * Query helper (optional)
 * ใช้ Ward.findActive()
 */
wardSchema.query.active = function () {
  return this.where({ status: 'ACTIVE' })
}

module.exports = mongoose.model('Ward', wardSchema)
