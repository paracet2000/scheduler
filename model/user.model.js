// models/User.js
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

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

  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
    index: true
  },

  emailVerified: {
    type: Boolean,
    default: false
  },

  emailVerifiedAt: Date,

  emailVerifyToken: String

}, { timestamps: true })

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$')) {
    return bcrypt.compare(candidate, this.password)
  }
  return candidate === this.password
}

module.exports = mongoose.model('User', userSchema)
