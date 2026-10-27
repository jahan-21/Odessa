const mongoose = require('mongoose');

const BeneficiaryShareSchema = new mongoose.Schema(
  {
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant',
      required: [true, 'Beneficiary participant ID is required.']
    },
    sharePaise: {
      type: Number,
      required: [true, 'Share amount in paise is required.'],
      min: [1, 'Share must be at least 1 paise.']
    },
    percentageBps: {
      type: Number,
      min: 1,
      max: 10000
    },
    exactInputPaise: {
      type: Number,
      min: 1
    }
  },
  { _id: false }
);

const ExpenseSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required.'],
      index: true
    },
    description: {
      type: String,
      required: [true, 'Expense description is required.'],
      trim: true,
      maxlength: [200, 'Expense description cannot exceed 200 characters.']
    },
    amountPaise: {
      type: Number,
      required: [true, 'Expense amount in paise is required.'],
      min: [1, 'Expense amount must be at least 1 paise.'],
      max: [1000000000, 'Expense amount cannot exceed ₹10,000,000.00.']
    },
    payerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Participant',
      required: [true, 'Payer ID is required.']
    },
    splitMethod: {
      type: String,
      required: [true, 'Split method is required.'],
      enum: {
        values: ['EQUAL', 'EXACT', 'PERCENTAGE'],
        message: 'Split method must be EQUAL, EXACT, or PERCENTAGE.'
      }
    },
    category: {
      type: String,
      default: 'GENERAL',
      uppercase: true,
      enum: {
        values: ['GENERAL', 'FOOD', 'TRAVEL', 'STAY', 'SUPPLIES', 'TICKETS', 'OTHER'],
        message: 'Invalid expense category.'
      }
    },
    beneficiaries: {
      type: [BeneficiaryShareSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'An expense must contain at least one beneficiary.'
      }
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters.']
    }
  },
  {
    timestamps: true
  }
);

// Indexes for scoped queries
ExpenseSchema.index({ eventId: 1, createdAt: -1 });
ExpenseSchema.index({ eventId: 1, payerId: 1 });
ExpenseSchema.index({ eventId: 1, category: 1 });

module.exports = mongoose.model('Expense', ExpenseSchema);
