const expenseService = require('../services/expenseService');

async function previewExpenseAllocation(req, res, next) {
  try {
    const preview = await expenseService.previewExpenseAllocation(req.params.eventId, req.body);
    res.status(200).json({
      success: true,
      data: preview
    });
  } catch (err) {
    next(err);
  }
}

async function createExpense(req, res, next) {
  try {
    const expense = await expenseService.createExpense(req.params.eventId, req.body);
    res.status(201).json({
      success: true,
      data: expense
    });
  } catch (err) {
    next(err);
  }
}

async function listExpenses(req, res, next) {
  try {
    const result = await expenseService.listExpenses(req.params.eventId, req.query);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function getExpenseById(req, res, next) {
  try {
    const expense = await expenseService.getExpenseById(req.params.eventId, req.params.expenseId);
    res.status(200).json({
      success: true,
      data: expense
    });
  } catch (err) {
    next(err);
  }
}

async function updateExpense(req, res, next) {
  try {
    const expense = await expenseService.updateExpense(
      req.params.eventId,
      req.params.expenseId,
      req.body
    );
    res.status(200).json({
      success: true,
      data: expense
    });
  } catch (err) {
    next(err);
  }
}

async function deleteExpense(req, res, next) {
  try {
    const result = await expenseService.deleteExpense(req.params.eventId, req.params.expenseId);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  previewExpenseAllocation,
  createExpense,
  listExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense
};
