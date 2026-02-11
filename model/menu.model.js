// models/Menu.js
const mongoose = require('mongoose')

const menuSchema = new mongoose.Schema(
  {
    mnu_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    mnu_description: {
      type: String,
      required: true,
      trim: true
    },
    mnu_icon: {
      type: String,
      trim: true
    },
    mnu_status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'menus'
  }
)

module.exports = mongoose.model('Menu-list', menuSchema)
