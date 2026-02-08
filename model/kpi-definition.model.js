const mongoose = require('mongoose');

const kpiDefinitionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    valueType: {
      type: String,
      enum: ['number', 'text', 'boolean', 'select', 'group'],
      default: 'number'
    },
    required: {
      type: Boolean,
      default: false
    },
    options: {
      type: [String],
      default: []
    },
    unit: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
    },
    order: {
      type: Number,
      default: 0,
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
  { timestamps: true, collection: 'kpi_definitions' }
);

module.exports = mongoose.model('KpiDefinition', kpiDefinitionSchema);
