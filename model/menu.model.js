// models/Menu.js
const mongoose = require('mongoose')

const menuClickerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: {
      type: String,
      trim: true,
      default: ''
    },
    avatar: {
      type: String,
      trim: true,
      default: ''
    },
    clickedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
)

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
    mnu_name: {
      type: String,
      trim: true,
      index: true
    },
    mnu_icon: {
      type: String,
      trim: true
    },
    mnu_clickCounter: {
      type: Number,
      default: 0,
      index: true
    },
    mnu_lastClickedAt: {
      type: Date,
      default: null,
      index: true
    },
    last10Clicker: {
      type: [menuClickerSchema],
      default: []
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

menuSchema.pre('validate', function (next) {
  const safeDescription = String(this.mnu_description || '').trim()
  const safeCode = String(this.mnu_code || '').trim()
  const safeName = String(this.mnu_name || '').trim()
  if (!safeName) {
    this.mnu_name = safeDescription || safeCode
  }

  if (!Number.isFinite(Number(this.mnu_clickCounter)) || Number(this.mnu_clickCounter) < 0) {
    this.mnu_clickCounter = 0
  } else {
    this.mnu_clickCounter = Math.floor(Number(this.mnu_clickCounter))
  }

  if (Array.isArray(this.last10Clicker) && this.last10Clicker.length) {
    this.last10Clicker = this.last10Clicker
      .slice()
      .sort((a, b) => new Date(b?.clickedAt || 0) - new Date(a?.clickedAt || 0))
      .slice(0, 10)
  }
  next()
})

module.exports = mongoose.model('Menu-list', menuSchema)
