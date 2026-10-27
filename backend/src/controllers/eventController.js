const eventService = require('../services/eventService');

async function createEvent(req, res, next) {
  try {
    const event = await eventService.createEvent(req.body);
    res.status(201).json({
      success: true,
      data: event
    });
  } catch (err) {
    next(err);
  }
}

async function listEvents(req, res, next) {
  try {
    const events = await eventService.listEvents();
    res.status(200).json({
      success: true,
      data: events
    });
  } catch (err) {
    next(err);
  }
}

async function getEventById(req, res, next) {
  try {
    const event = await eventService.getEventById(req.params.eventId);
    res.status(200).json({
      success: true,
      data: event
    });
  } catch (err) {
    next(err);
  }
}

async function seedDemoEvent(req, res, next) {
  try {
    const seeded = await eventService.seedDemoEvent();
    res.status(201).json({
      success: true,
      message: 'Demonstration event successfully created with case study participants and expenses.',
      data: seeded
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createEvent,
  listEvents,
  getEventById,
  seedDemoEvent
};
