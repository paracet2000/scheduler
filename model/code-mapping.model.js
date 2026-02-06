const mongoose = require('mongoose');

const codeMappingSchema = new mongoose.Schema(
  {
    deviceEmpCode: {
      type: String,
      required: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

codeMappingSchema.index({ deviceEmpCode: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('CodeMapping', codeMappingSchema, 'code_mappings');
