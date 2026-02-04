// models/User.js
const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  employeeCode: {
    type: String,
    index: true
  },

  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },

  password: {
    type: String,
    required: true,
    select: false
  },

  phone: {
    type: String
  },

  avatar: String,

  roles: {
    type: [String],
    enum: ['user', 'head', 'approver', 'hr', 'finance', 'admin'],
    default: ['user']
  },

  emailVerified: {
    type: Boolean,
    default: false
  },

  emailVerifiedAt: Date

}, { timestamps: true })

module.exports = mongoose.model('User', userSchema)
