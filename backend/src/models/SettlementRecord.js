const mongoose = require('mongoose');

const SettlementRecordSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required.'],
      index: true
    },
    payerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant',
      required: [true, 'Debtor (payer) ID is required.']
    },
    payeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant',
      required: [true, 'Creditor (payee) ID is required.']
    },
    amountPaise: {
      type: Number,
      required: [true, 'Settlement amount in paise is required.'],
      min: [1, 'Settlement amount must be at least 1 paise.']
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [300, 'Notes cannot exceed 300 characters.']
    },
    status: {
      type: String,
      default: 'COMPLETED',
      enum: ['COMPLETED', 'REVERSED']
    },
    reversalReason: {
      type: String,
      trim: true,
      maxlength: [300, 'Reversal reason cannot exceed 300 characters.']
    },
    reversedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

SettlementRecordSchema.index({ eventId: 1, status: 1 });
SettlementRecordSchema.index({ eventId: 1, createdAt: -1 });

module.exports = mongoose.model('SettlementRecord', SettlementRecordSchema);
