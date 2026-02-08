const mongoose = require('mongoose');

const kpiEntrySchema = new mongoose.Schema(
  {
    wardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Master',
      required: true,
      index: true
    },
    shiftCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    values: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true, collection: 'kpi_entries' }
);

kpiEntrySchema.index({ wardId: 1, shiftCode: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('KpiEntry', kpiEntrySchema);
