const {
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  allocateExpenseShares,
  assertSumInvariant,
  validateBeneficiaryIds,
  BASIS_POINTS_TOTAL
} = require('../../src/core/splits');

describe('Core Financial Engine — splits.js', () => {
  const participants = ['part-A', 'part-B', 'part-C'];

  describe('Equal Split & The One-Paise Problem', () => {
    test('splits evenly divisible amounts exactly', () => {
      // ₹90.00 = 9000 paise among 3 people -> 3000 each
      const shares = calculateEqualSplit(9000, participants);
      expect(shares).toEqual([
        { participantId: 'part-A', sharePaise: 3000 },
        { participantId: 'part-B', sharePaise: 3000 },
        { participantId: 'part-C', sharePaise: 3000 }
      ]);
      expect(shares.reduce((acc, s) => acc + s.sharePaise, 0)).toBe(9000);
    });

    test('resolves 1-paise remainder deterministically (₹100 among 3 people)', () => {
      // ₹100.00 = 10,000 paise among 3 people -> 3334, 3333, 3333
      const shares = calculateEqualSplit(10000, participants);
      expect(shares).toHaveLength(3);
      expect(shares[0].sharePaise).toBe(3334);
      expect(shares[1].sharePaise).toBe(3333);
      expect(shares[2].sharePaise).toBe(3333);

      const total = shares.reduce((acc, s) => acc + s.sharePaise, 0);
      expect(total).toBe(10000);
    });

    test('resolves 2-paise remainder deterministically (₹100.01 among 3 people)', () => {
      // 10,001 paise among 3 people -> remainder 2 paise -> 3334, 3334, 3333
      const shares = calculateEqualSplit(10001, participants);
      expect(shares[0].sharePaise).toBe(3334);
      expect(shares[1].sharePaise).toBe(3334);
      expect(shares[2].sharePaise).toBe(3333);

      const total = shares.reduce((acc, s) => acc + s.sharePaise, 0);
      expect(total).toBe(10001);
    });

    test('guarantees determinism regardless of input order', () => {
      // Permuted input order should allocate the remainder to the same participant IDs
      const shares1 = calculateEqualSplit(10000, ['part-A', 'part-B', 'part-C']);
      const shares2 = calculateEqualSplit(10000, ['part-C', 'part-B', 'part-A']);

      const partAShare1 = shares1.find(s => s.participantId === 'part-A').sharePaise;
      const partAShare2 = shares2.find(s => s.participantId === 'part-A').sharePaise;

      expect(partAShare1).toBe(3334);
      expect(partAShare2).toBe(3334);
    });

    test('rejects empty beneficiary lists', () => {
      expect(() => calculateEqualSplit(1000, [])).toThrow(/At least one beneficiary/);
    });

    test('rejects duplicate beneficiaries', () => {
      expect(() => calculateEqualSplit(1000, ['part-A', 'part-B', 'part-A'])).toThrow(
        /Duplicate beneficiary detected/
      );
    });
  });

  describe('Exact Split Allocation', () => {
    test('accepts exact shares that sum up to total amount', () => {
      const rawShares = [
        { participantId: 'part-A', sharePaise: 4000 },
        { participantId: 'part-B', sharePaise: 3500 },
        { participantId: 'part-C', sharePaise: 2500 }
      ];
      const shares = calculateExactSplit(10000, rawShares);
      expect(shares).toEqual(rawShares);
      expect(shares.reduce((acc, s) => acc + s.sharePaise, 0)).toBe(10000);
    });

    test('rejects exact shares that are short by even 1 paise', () => {
      const rawShares = [
        { participantId: 'part-A', sharePaise: 4000 },
        { participantId: 'part-B', sharePaise: 3500 },
        { participantId: 'part-C', sharePaise: 2499 }
      ];
      expect(() => calculateExactSplit(10000, rawShares)).toThrow(/short by ₹0.01/);
    });

    test('rejects exact shares that exceed total amount', () => {
      const rawShares = [
        { participantId: 'part-A', sharePaise: 5000 },
        { participantId: 'part-B', sharePaise: 5001 }
      ];
      expect(() => calculateExactSplit(10000, rawShares)).toThrow(/exceeds by ₹0.01/);
    });

    test('rejects zero or negative exact shares', () => {
      const rawShares = [
        { participantId: 'part-A', sharePaise: 10000 },
        { participantId: 'part-B', sharePaise: 0 }
      ];
      expect(() => calculateExactSplit(10000, rawShares)).toThrow(/must be an integer >= 1 paise/);
    });
  });

  describe('Percentage Split (Largest-Remainder Method)', () => {
    test('splits clean 50-50 percentage exactly', () => {
      const raw = [
        { participantId: 'part-A', percentageBps: 5000 },
        { participantId: 'part-B', percentageBps: 5000 }
      ];
      const shares = calculatePercentageSplit(10000, raw);
      expect(shares[0].sharePaise).toBe(5000);
      expect(shares[1].sharePaise).toBe(5000);
      expect(shares.reduce((acc, s) => acc + s.sharePaise, 0)).toBe(10000);
    });

    test('distributes remainder to highest fractional remainder', () => {
      // Expense = ₹100.00 (10000 paise)
      // A: 33.34% (3334 bps) -> exact 3334 paise, remainder 0
      // B: 33.33% (3333 bps) -> exact 3333 paise, remainder 0
      // C: 33.33% (3333 bps) -> exact 3333 paise, remainder 0
      const raw = [
        { participantId: 'part-A', percentageBps: 3334 },
        { participantId: 'part-B', percentageBps: 3333 },
        { participantId: 'part-C', percentageBps: 3333 }
      ];
      const shares = calculatePercentageSplit(10000, raw);
      expect(shares[0].sharePaise).toBe(3334);
      expect(shares[1].sharePaise).toBe(3333);
      expect(shares[2].sharePaise).toBe(3333);
      expect(shares.reduce((acc, s) => acc + s.sharePaise, 0)).toBe(10000);
    });

    test('distributes remainder paise when fractions exist', () => {
      // Expense = ₹100.00 (10000 paise)
      // Split among 3 people: 40%, 35%, 25%
      // 4000 bps, 3500 bps, 2500 bps
      const raw = [
        { participantId: 'part-A', percentageBps: 4000 },
        { participantId: 'part-B', percentageBps: 3500 },
        { participantId: 'part-C', percentageBps: 2500 }
      ];
      const shares = calculatePercentageSplit(10000, raw);
      expect(shares[0].sharePaise).toBe(4000);
      expect(shares[1].sharePaise).toBe(3500);
      expect(shares[2].sharePaise).toBe(2500);
    });

    test('rejects percentages that do not sum to 10,000 basis points (100%)', () => {
      const raw = [
        { participantId: 'part-A', percentageBps: 5000 },
        { participantId: 'part-B', percentageBps: 4999 }
      ];
      expect(() => calculatePercentageSplit(10000, raw)).toThrow(
        /must total exactly 100.00%/
      );
    });
  });

  describe('Universal dispatcher allocateExpenseShares', () => {
    test('routes EQUAL method correctly', () => {
      const res = allocateExpenseShares('EQUAL', 3000, ['p1', 'p2', 'p3']);
      expect(res).toHaveLength(3);
      expect(res[0].sharePaise).toBe(1000);
    });

    test('throws for unsupported split method', () => {
      expect(() => allocateExpenseShares('BITCOIN', 3000, ['p1'])).toThrow(
        /Unsupported split method/
      );
    });
  });
});
