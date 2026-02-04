// models/UserWard.js
const mongoose = require('mongoose')

const userWardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  wardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ward',
    required: true,
    index: true
  },

  position: {
    type: String,
    enum: ['Head', 'Nurse', 'Ast', 'Manager'],
    required: true
  },

  canSchedule: {
    type: Boolean,
    default: false
  },

  canApprove: {
    type: Boolean,
    default: false
  },

  isPrimary: {
    type: Boolean,
    default: false
  },

  active: {
    type: Boolean,
    default: true
  }

}, { timestamps: true })

userWardSchema.index({ userId: 1, wardId: 1 }, { unique: true })

module.exports = mongoose.model('UserWard', userWardSchema)
