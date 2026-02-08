const mongoose = require('mongoose');

const kpiThresholdSchema = new mongoose.Schema(
  {
    widgetCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    greenMin: { type: Number, default: null },
    greenMax: { type: Number, default: null },
    amberMin: { type: Number, default: null },
    amberMax: { type: Number, default: null },
    redMin: { type: Number, default: null },
    redMax: { type: Number, default: null },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
    }
  },
  { timestamps: true, collection: 'kpi_thresholds' }
);

kpiThresholdSchema.index({ widgetCode: 1 }, { unique: true });

module.exports = mongoose.model('KpiThreshold', kpiThresholdSchema);
