/**
 * CampusSplit Financial Core — Money Utilities
 *
 * Implements strict integer paise representation to eliminate floating-point
 * rounding artifacts. 1 INR = 100 paise.
 */

const MAX_EXPENSE_PAISE = 1000000000; // ₹10,000,000.00 (1 crore)
const MIN_EXPENSE_PAISE = 1;          // ₹0.01 (1 paise)

/**
 * Validates and converts a Rupee input (number or string) to exact integer paise.
 * Rejects values with more than 2 decimal places, negatives, zero, or non-numeric values.
 * Uses string component parsing to avoid IEEE-754 binary floating-point drift.
 *
 * @param {string|number} input - Value in Rupees (e.g. 100.50, "100.50")
 * @returns {number} Exact integer paise
 * @throws {Error} If input is invalid, has >2 decimal places, or out of range
 */
function rupeesToPaise(input) {
  if (input === null || input === undefined || input === '') {
    throw new Error('Monetary amount is required.');
  }

  const str = String(input).trim();

  // Strict regex: positive integer or decimal with up to 2 decimal places
  const rupeeRegex = /^\d+(\.\d{1,2})?$/;
  if (!rupeeRegex.test(str)) {
    if (/^\d+\.\d{3,}$/.test(str)) {
      throw new Error(`Invalid monetary precision: "${str}" contains more than two decimal places. Amounts must not exceed paise precision.`);
    }
    if (/^-/.test(str)) {
      throw new Error(`Invalid monetary amount: "${str}" cannot be negative.`);
    }
    throw new Error(`Invalid monetary format: "${str}". Must be a valid positive number with up to 2 decimal places.`);
  }

  const [integerPart, decimalPart = ''] = str.split('.');
  const decimalPadded = decimalPart.padEnd(2, '0').slice(0, 2);

  const rupees = parseInt(integerPart, 10);
  const paiseFrac = parseInt(decimalPadded, 10);
  const totalPaise = rupees * 100 + paiseFrac;

  if (totalPaise < MIN_EXPENSE_PAISE) {
    throw new Error('Monetary amount must be at least ₹0.01 (1 paise).');
  }

  if (totalPaise > MAX_EXPENSE_PAISE) {
    throw new Error(`Monetary amount exceeds maximum supported limit of ₹10,000,000.00.`);
  }

  return totalPaise;
}

/**
 * Checks if a value is a valid integer paise amount.
 *
 * @param {any} val
 * @returns {boolean}
 */
function isValidPaise(val) {
  return Number.isInteger(val) && val >= MIN_EXPENSE_PAISE && val <= MAX_EXPENSE_PAISE;
}

/**
 * Converts integer paise to formatted Rupee string for display.
 *
 * @param {number} paise - Integer paise (can be negative for balances)
 * @param {boolean} [showExplicitSign=false] - If true, prefixes positive numbers with '+'
 * @returns {string} e.g. "₹100.50", "-₹25.00", "+₹50.00"
 */
function formatRupees(paise, showExplicitSign = false) {
  if (!Number.isInteger(paise)) {
    throw new Error(`Expected integer paise, received: ${paise}`);
  }

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const paiseFrac = absPaise % 100;
  const formattedAbs = `₹${rupees.toLocaleString('en-IN')}.${String(paiseFrac).padStart(2, '0')}`;

  if (isNegative) {
    return `-${formattedAbs}`;
  }
  if (showExplicitSign && paise > 0) {
    return `+${formattedAbs}`;
  }
  return formattedAbs;
}

/**
 * Converts integer paise to decimal rupees number (for read-only displays).
 *
 * @param {number} paise
 * @returns {number}
 */
function paiseToRupees(paise) {
  if (!Number.isInteger(paise)) {
    throw new Error(`Expected integer paise, received: ${paise}`);
  }
  return paise / 100;
}

module.exports = {
  MAX_EXPENSE_PAISE,
  MIN_EXPENSE_PAISE,
  rupeesToPaise,
  isValidPaise,
  formatRupees,
  paiseToRupees
};
