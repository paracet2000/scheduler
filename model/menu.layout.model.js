// models/MenuLayout.js
const mongoose = require('mongoose')

const ALLOWED_TABS = ['schedule', 'routine-data', 'settings']

function normalizeTabName(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return raw
  if (raw === 'routine data' || raw === 'routine_data') return 'routine-data'
  return raw
}

const menuLayoutSchema = new mongoose.Schema(
  {
    tab_name: {
      type: String,
      required: true,
      trim: true,
      enum: ALLOWED_TABS,
      index: true
    },
    mnu_code: {
      type: String,
      required: true,
      trim: true,
      index: true,
      unique: true
    }
  },
  {
    timestamps: true,
    collection: 'menu_layouts'
  }
)

menuLayoutSchema.pre('validate', function (next) {
  this.tab_name = normalizeTabName(this.tab_name)
  this.mnu_code = String(this.mnu_code || '').trim()
  next()
})

module.exports = mongoose.model('MenuLayout', menuLayoutSchema)

