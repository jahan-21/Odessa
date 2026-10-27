const {
  generateSettlements,
  verifySettlementPostConditions
} = require('../../src/core/settlement');

describe('Core Financial Engine — settlement.js', () => {
  describe('Case Study Example Verification', () => {
    test('settles Asha (+₹600), Bala (+₹150), Charan (-₹750) exactly', () => {
      const balances = [
        { participantId: 'p1', participantName: 'Asha', residualBalancePaise: 60000 },
        { participantId: 'p2', participantName: 'Bala', residualBalancePaise: 15000 },
        { participantId: 'p3', participantName: 'Charan', residualBalancePaise: -75000 }
      ];

      const result = generateSettlements(balances);

      expect(result.isFullySettled).toBe(false);
      expect(result.proposedTransfers).toHaveLength(2);

      // Charan pays Asha ₹600.00 (60,000 paise)
      expect(result.proposedTransfers[0]).toEqual({
        fromParticipantId: 'p3',
        fromParticipantName: 'Charan',
        toParticipantId: 'p1',
        toParticipantName: 'Asha',
        amountPaise: 60000,
        amountRupees: '₹600.00'
      });

      // Charan pays Bala ₹150.00 (15,000 paise)
      expect(result.proposedTransfers[1]).toEqual({
        fromParticipantId: 'p3',
        fromParticipantName: 'Charan',
        toParticipantId: 'p2',
        toParticipantName: 'Bala',
        amountPaise: 15000,
        amountRupees: '₹150.00'
      });

      expect(result.totalSettlementAmountPaise).toBe(75000);
      expect(result.verification.postConditionsSatisfied).toBe(true);
    });
  });

  describe('Multiple debtors and creditors topology', () => {
    test('settles multiple debtors to single creditor', () => {
      const balances = [
        { participantId: 'p1', participantName: 'Asha', residualBalancePaise: 10000 },
        { participantId: 'p2', participantName: 'Bala', residualBalancePaise: -6000 },
        { participantId: 'p3', participantName: 'Charan', residualBalancePaise: -4000 }
      ];

      const result = generateSettlements(balances);
      expect(result.proposedTransfers).toHaveLength(2);
      expect(result.verification.postConditionsSatisfied).toBe(true);

      const toAsha = result.proposedTransfers.filter(t => t.toParticipantId === 'p1');
      expect(toAsha.reduce((acc, t) => acc + t.amountPaise, 0)).toBe(10000);
    });

    test('settles complex multi-party distribution', () => {
      // D1: -5000, D2: -3000, D3: -2000
      // C1: +7000, C2: +3000
      const balances = [
        { participantId: 'd1', participantName: 'Debtor 1', residualBalancePaise: -5000 },
        { participantId: 'd2', participantName: 'Debtor 2', residualBalancePaise: -3000 },
        { participantId: 'd3', participantName: 'Debtor 3', residualBalancePaise: -2000 },
        { participantId: 'c1', participantName: 'Creditor 1', residualBalancePaise: 7000 },
        { participantId: 'c2', participantName: 'Creditor 2', residualBalancePaise: 3000 }
      ];

      const result = generateSettlements(balances);
      expect(result.verification.postConditionsSatisfied).toBe(true);
      expect(result.totalSettlementAmountPaise).toBe(10000);
    });
  });

  describe('Edge cases', () => {
    test('handles already-settled group (all zero balances)', () => {
      const balances = [
        { participantId: 'p1', participantName: 'Asha', residualBalancePaise: 0 },
        { participantId: 'p2', participantName: 'Bala', residualBalancePaise: 0 }
      ];

      const result = generateSettlements(balances);
      expect(result.isFullySettled).toBe(true);
      expect(result.proposedTransfers).toHaveLength(0);
      expect(result.totalSettlementAmountPaise).toBe(0);
    });

    test('handles empty group', () => {
      const result = generateSettlements([]);
      expect(result.isFullySettled).toBe(true);
      expect(result.proposedTransfers).toHaveLength(0);
    });

    test('throws if total credit does not equal total debt (pre-condition)', () => {
      const corruptedBalances = [
        { participantId: 'p1', participantName: 'Asha', residualBalancePaise: 5000 },
        { participantId: 'p2', participantName: 'Bala', residualBalancePaise: -4000 }
      ];

      expect(() => generateSettlements(corruptedBalances)).toThrow(
        /Pre-condition Violation in Settlement Engine/
      );
    });
  });

  describe('Determinism & Invariants', () => {
    test('guarantees identical output across permuted inputs', () => {
      const inputA = [
        { participantId: 'p1', participantName: 'Asha', residualBalancePaise: 60000 },
        { participantId: 'p2', participantName: 'Bala', residualBalancePaise: 15000 },
        { participantId: 'p3', participantName: 'Charan', residualBalancePaise: -75000 }
      ];

      const inputB = [
        { participantId: 'p3', participantName: 'Charan', residualBalancePaise: -75000 },
        { participantId: 'p2', participantName: 'Bala', residualBalancePaise: 15000 },
        { participantId: 'p1', participantName: 'Asha', residualBalancePaise: 60000 }
      ];

      const resultA = generateSettlements(inputA);
      const resultB = generateSettlements(inputB);

      expect(resultA.proposedTransfers).toEqual(resultB.proposedTransfers);
    });

    test('verifySettlementPostConditions throws if any invariant is broken', () => {
      const originalBalances = [
        { participantId: 'p1', residualBalancePaise: 5000 },
        { participantId: 'p2', residualBalancePaise: -5000 }
      ];

      // Bad transfer overpaying debtor
      const badTransfers = [
        { fromParticipantId: 'p2', toParticipantId: 'p1', amountPaise: 6000 }
      ];

      expect(() => verifySettlementPostConditions(originalBalances, badTransfers)).toThrow(
        /Invariant 1 Failed/
      );
    });
  });
});
