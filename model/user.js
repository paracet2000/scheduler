const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    /* ---------- identity ---------- */
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    /* ---------- profile ---------- */
    name: {
      type: String,
      trim: true
    },

    profileImage: {
      type: String,
      default: null
    },

    phone: {
      type: String,
      default: null,
      trim: true
      // ❌ ไม่ required
      // ❌ ไม่ unique (เผื่อ shared / temp)
    },

    isPhoneVerified: {
      type: Boolean,
      default: false
    },

    /* ---------- authorization ---------- */
    role: {
      type: String,
      enum: ['admin', 'staff'],
      default: 'staff'
    },

    isVerified: {
      type: Boolean,
      default: false
    },

    isActive: {
      type: Boolean,
      default: true
    },

    /* ---------- security flows ---------- */
    emailVerifyToken: String,
    emailVerifyExpires: Date,

    resetPasswordToken: String,
    resetPasswordExpires: Date,

    phoneVerifyToken: String,
    phoneVerifyExpires: Date,

    lastLoginAt: Date
  },
  {
    timestamps: true,
    versionKey: false
  }
);

/* ---------- hooks ---------- */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

/* ---------- methods ---------- */
userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

/* ---------- safe response ---------- */
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerifyToken;
  delete obj.resetPasswordToken;
  delete obj.phoneVerifyToken;
  return obj;
};

module.exports = mongoose.model('User_sched', userSchema);
