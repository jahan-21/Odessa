const express = require('express');
const router = express.Router({ mergeParams: true });
const expenseController = require('../../controllers/expenseController');
const { validateObjectId } = require('../../middleware/validate');

router.post('/preview', validateObjectId('eventId'), expenseController.previewExpenseAllocation);
router.post('/', validateObjectId('eventId'), expenseController.createExpense);
router.get('/', validateObjectId('eventId'), expenseController.listExpenses);
router.get('/:expenseId', validateObjectId('eventId'), validateObjectId('expenseId'), expenseController.getExpenseById);
router.put('/:expenseId', validateObjectId('eventId'), validateObjectId('expenseId'), expenseController.updateExpense);
router.delete('/:expenseId', validateObjectId('eventId'), validateObjectId('expenseId'), expenseController.deleteExpense);

module.exports = router;
