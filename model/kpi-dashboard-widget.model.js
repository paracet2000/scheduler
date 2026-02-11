const mongoose = require('mongoose');

const kpiDashboardWidgetSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    calc: {
      type: String,
      enum: ['sum', 'avg', 'ratio', 'count'],
      default: 'sum'
    },
    sourceCodes: {
      type: [String],
      default: []
    },
    numeratorCodes: {
      type: [String],
      default: []
    },
    denominatorCodes: {
      type: [String],
      default: []
    },
    numeratorMode: {
      type: String,
      enum: ['sum', 'count', 'absolute'],
      default: 'sum'
    },
    denominatorMode: {
      type: String,
      enum: ['sum', 'count', 'absolute'],
      default: 'sum'
    },
    numeratorValue: {
      type: Number,
      default: null
    },
    denominatorValue: {
      type: Number,
      default: null
    },
    unit: {
      type: String,
      trim: true,
      default: ''
    },
    curveWidth: {
      type: Number,
      default: 30
    },
    gradient: {
      type: Boolean,
      default: false
    },
    roles: {
      type: [String],
      default: []
    },
    order: {
      type: Number,
      default: 0,
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
  { timestamps: true, collection: 'kpi_dashboard_widgets' }
);

module.exports = mongoose.model('KpiDashboardWidget', kpiDashboardWidgetSchema);
