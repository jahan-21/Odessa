const {
  rupeesToPaise,
  isValidPaise,
  formatRupees,
  paiseToRupees,
  MAX_EXPENSE_PAISE,
  MIN_EXPENSE_PAISE
} = require('../../src/core/money');

describe('Core Financial Utilities — money.js', () => {
  describe('rupeesToPaise conversion & validation', () => {
    test('converts clean rupee integers to paise', () => {
      expect(rupeesToPaise(100)).toBe(10000);
      expect(rupeesToPaise('100')).toBe(10000);
      expect(rupeesToPaise(1)).toBe(100);
      expect(rupeesToPaise('5000')).toBe(500000);
    });

    test('converts decimal rupees to exact paise without floating point error', () => {
      expect(rupeesToPaise('100.50')).toBe(10050);
      expect(rupeesToPaise(100.5)).toBe(10050);
      expect(rupeesToPaise('0.01')).toBe(1);
      expect(rupeesToPaise('0.99')).toBe(99);
      expect(rupeesToPaise('1.14')).toBe(114); // Common float bug: 1.14 * 100 is 113.99999999999999
      expect(rupeesToPaise('19.99')).toBe(1999);
    });

    test('rejects values with more than two decimal places', () => {
      expect(() => rupeesToPaise('10.555')).toThrow(/more than two decimal places/);
      expect(() => rupeesToPaise('0.001')).toThrow(/more than two decimal places/);
      expect(() => rupeesToPaise('100.1234')).toThrow(/more than two decimal places/);
    });

    test('rejects negative numbers and zero', () => {
      expect(() => rupeesToPaise('-50')).toThrow(/cannot be negative/);
      expect(() => rupeesToPaise('-0.01')).toThrow(/cannot be negative/);
      expect(() => rupeesToPaise('0')).toThrow(/at least ₹0.01/);
      expect(() => rupeesToPaise('0.00')).toThrow(/at least ₹0.01/);
    });

    test('rejects non-numeric inputs, null, and empty values', () => {
      expect(() => rupeesToPaise(null)).toThrow(/required/);
      expect(() => rupeesToPaise('')).toThrow(/required/);
      expect(() => rupeesToPaise('abc')).toThrow(/valid positive number/);
      expect(() => rupeesToPaise('12.34.56')).toThrow(/valid positive number/);
    });

    test('enforces maximum supported expense limit', () => {
      expect(rupeesToPaise('10000000.00')).toBe(MAX_EXPENSE_PAISE);
      expect(() => rupeesToPaise('10000000.01')).toThrow(/exceeds maximum supported limit/);
    });
  });

  describe('formatRupees display formatting', () => {
    test('formats standard positive amounts', () => {
      expect(formatRupees(10000)).toBe('₹100.00');
      expect(formatRupees(10050)).toBe('₹100.50');
      expect(formatRupees(1)).toBe('₹0.01');
      expect(formatRupees(99)).toBe('₹0.99');
    });

    test('formats negative amounts (debtors)', () => {
      expect(formatRupees(-75000)).toBe('-₹750.00');
      expect(formatRupees(-50)).toBe('-₹0.50');
    });

    test('formats with explicit positive sign when requested', () => {
      expect(formatRupees(60000, true)).toBe('+₹600.00');
      expect(formatRupees(-75000, true)).toBe('-₹750.00');
      expect(formatRupees(0, true)).toBe('₹0.00');
    });

    test('throws if given non-integer paise', () => {
      expect(() => formatRupees(100.5)).toThrow(/Expected integer paise/);
    });
  });

  describe('paiseToRupees helper', () => {
    test('accurately divides integer paise by 100', () => {
      expect(paiseToRupees(10000)).toBe(100);
      expect(paiseToRupees(3333)).toBe(33.33);
    });
  });
});
