const mongoose = require('mongoose');

const AuditRecordSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required.'],
      index: true
    },
    action: {
      type: String,
      required: [true, 'Audit action is required.'],
      enum: [
        'EVENT_CREATED',
        'PARTICIPANT_ADDED',
        'PARTICIPANT_DEACTIVATED',
        'EXPENSE_CREATED',
        'EXPENSE_UPDATED',
        'EXPENSE_DELETED',
        'SETTLEMENT_RECORDED',
        'SETTLEMENT_REVERSED'
      ]
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required.']
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId
    },
    details: {
      type: mongoose.Schema.Types.Mixed
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

AuditRecordSchema.index({ eventId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditRecord', AuditRecordSchema);
