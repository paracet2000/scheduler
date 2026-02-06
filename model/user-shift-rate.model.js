const mongoose = require('mongoose');

const userShiftRateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    shiftCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'THB',
      uppercase: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
    }
  },
  { timestamps: true }
);

userShiftRateSchema.index({ userId: 1, shiftCode: 1 }, { unique: true });

module.exports = mongoose.model('UserShiftRate', userShiftRateSchema);
