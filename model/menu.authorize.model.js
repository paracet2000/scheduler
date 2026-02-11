// models/MenuAuthorize.js
const mongoose = require('mongoose')

const menuAuthorizeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    mnu_code: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    acc_read: {
      type: Number,
      default: 0
    },
    acc_write: {
      type: Number,
      default: 0
    },
    acc_export: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    collection: 'menu_authorizes'
  }
)

menuAuthorizeSchema.index({ userId: 1, mnu_code: 1 }, { unique: true })

module.exports = mongoose.model('MenuAuthorize', menuAuthorizeSchema)
