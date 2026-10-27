const mongoose = require('mongoose');

const ParticipantSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required.'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Participant name is required.'],
      trim: true,
      maxlength: [80, 'Participant name cannot exceed 80 characters.']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [120, 'Email cannot exceed 120 characters.']
    },
    status: {
      type: String,
      default: 'ACTIVE',
      enum: ['ACTIVE', 'INACTIVE']
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate participant names within the same event
ParticipantSchema.index({ eventId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Participant', ParticipantSchema);
