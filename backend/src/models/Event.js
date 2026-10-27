const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Event name is required.'],
      trim: true,
      maxlength: [100, 'Event name cannot exceed 100 characters.']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Event description cannot exceed 500 characters.']
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      enum: {
        values: ['INR'],
        message: 'Currently, only INR currency is supported.'
      }
    },
    status: {
      type: String,
      default: 'ACTIVE',
      enum: ['ACTIVE', 'ARCHIVED']
    }
  },
  {
    timestamps: true
  }
);

EventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Event', EventSchema);
