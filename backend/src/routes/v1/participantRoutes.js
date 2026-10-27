const express = require('express');
const router = express.Router({ mergeParams: true });
const participantController = require('../../controllers/participantController');
const { validateObjectId } = require('../../middleware/validate');

router.post('/', validateObjectId('eventId'), participantController.addParticipant);
router.get('/', validateObjectId('eventId'), participantController.listParticipants);
router.patch(
  '/:participantId/deactivate',
  validateObjectId('eventId'),
  validateObjectId('participantId'),
  participantController.deactivateParticipant
);

module.exports = router;
