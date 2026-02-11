// models/Type.js
const mongoose = require('mongoose')

const typeSchema = new mongoose.Schema(
  {
    typ_code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true
    },
    typ_description: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'types'
  }
)

module.exports = mongoose.model('Type', typeSchema)
