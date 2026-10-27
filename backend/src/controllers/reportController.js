const reportService = require('../services/reportService');

async function getReconciliationReport(req, res, next) {
  try {
    const report = await reportService.getReconciliationReport(req.params.eventId);
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (err) {
    next(err);
  }
}

async function exportEventCSV(req, res, next) {
  try {
    const csvData = await reportService.exportEventCSV(req.params.eventId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campussplit-event-${req.params.eventId}.csv"`);
    res.status(200).send(csvData);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getReconciliationReport,
  exportEventCSV
};
