const {
  calculateEventBalances,
  generateParticipantExplanation
} = require('../../src/core/balances');

describe('Core Financial Engine — balances.js', () => {
  const participants = [
    { _id: 'p1', name: 'Asha' },
    { _id: 'p2', name: 'Bala' },
    { _id: 'p3', name: 'Charan' }
  ];

  test('calculates balances correctly for single equal expense', () => {
    // Asha pays ₹900.00 (90,000 paise) shared equally among Asha, Bala, Charan (30,000 each)
    const expenses = [
      {
        _id: 'e1',
        description: 'Team Lunch',
        amountPaise: 90000,
        payerId: 'p1',
        splitMethod: 'EQUAL',
        beneficiaries: [
          { participantId: 'p1', sharePaise: 30000 },
          { participantId: 'p2', sharePaise: 30000 },
          { participantId: 'p3', sharePaise: 30000 }
        ]
      }
    ];

    const result = calculateEventBalances(participants, expenses);
    expect(result.totalExpenseAmountPaise).toBe(90000);
    expect(result.verification.isReconciled).toBe(true);
    expect(result.verification.sumOfNetBalancesPaise).toBe(0);

    const asha = result.balances.find(b => b.participantId === 'p1');
    const bala = result.balances.find(b => b.participantId === 'p2');
    const charan = result.balances.find(b => b.participantId === 'p3');

    // Asha: paid 90000, share 30000 -> net +60000 (Creditor)
    expect(asha.totalPaidPaise).toBe(90000);
    expect(asha.totalSharePaise).toBe(30000);
    expect(asha.netBalancePaise).toBe(60000);
    expect(asha.status).toBe('CREDITOR');

    // Bala: paid 0, share 30000 -> net -30000 (Debtor)
    expect(bala.totalPaidPaise).toBe(0);
    expect(bala.totalSharePaise).toBe(30000);
    expect(bala.netBalancePaise).toBe(-30000);
    expect(bala.status).toBe('DEBTOR');

    // Charan: paid 0, share 30000 -> net -30000 (Debtor)
    expect(charan.netBalancePaise).toBe(-30000);
    expect(charan.status).toBe('DEBTOR');
  });

  test('handles participant paying exact share', () => {
    // Asha pays ₹300 for herself only
    const expenses = [
      {
        _id: 'e1',
        description: 'Personal Book',
        amountPaise: 30000,
        payerId: 'p1',
        splitMethod: 'EXACT',
        beneficiaries: [{ participantId: 'p1', sharePaise: 30000 }]
      }
    ];

    const result = calculateEventBalances(participants, expenses);
    const asha = result.balances.find(b => b.participantId === 'p1');
    expect(asha.netBalancePaise).toBe(0);
    expect(asha.status).toBe('SETTLED');
  });

  test('handles zero expenses event gracefully', () => {
    const result = calculateEventBalances(participants, []);
    expect(result.totalExpenseAmountPaise).toBe(0);
    expect(result.balances.every(b => b.netBalancePaise === 0)).toBe(true);
    expect(result.verification.isReconciled).toBe(true);
  });

  test('handles single participant event', () => {
    const single = [{ _id: 'p1', name: 'Solo' }];
    const expenses = [
      {
        _id: 'e1',
        description: 'Coffee',
        amountPaise: 15000,
        payerId: 'p1',
        beneficiaries: [{ participantId: 'p1', sharePaise: 15000 }]
      }
    ];
    const result = calculateEventBalances(single, expenses);
    expect(result.balances[0].netBalancePaise).toBe(0);
  });

  test('incorporates recorded settlement transfers accurately into residual balance', () => {
    // Asha net +60000, Bala net -30000, Charan net -30000
    const expenses = [
      {
        _id: 'e1',
        description: 'Team Lunch',
        amountPaise: 90000,
        payerId: 'p1',
        splitMethod: 'EQUAL',
        beneficiaries: [
          { participantId: 'p1', sharePaise: 30000 },
          { participantId: 'p2', sharePaise: 30000 },
          { participantId: 'p3', sharePaise: 30000 }
        ]
      }
    ];

    // Bala pays Asha ₹300.00 (30,000 paise)
    const settlements = [
      {
        _id: 's1',
        payerId: 'p2',
        payeeId: 'p1',
        amountPaise: 30000,
        status: 'COMPLETED'
      }
    ];

    const result = calculateEventBalances(participants, expenses, settlements);

    const asha = result.balances.find(b => b.participantId === 'p1');
    const bala = result.balances.find(b => b.participantId === 'p2');
    const charan = result.balances.find(b => b.participantId === 'p3');

    // Asha: initial +60,000, received 30,000 -> residual +30,000
    expect(asha.netBalancePaise).toBe(60000);
    expect(asha.residualBalancePaise).toBe(30000);
    expect(asha.status).toBe('CREDITOR');

    // Bala: initial -30,000, paid 30,000 -> residual 0 (SETTLED)
    expect(bala.netBalancePaise).toBe(-30000);
    expect(bala.residualBalancePaise).toBe(0);
    expect(bala.status).toBe('SETTLED');

    // Charan: initial -30,000, paid 0 -> residual -30,000 (DEBTOR)
    expect(charan.residualBalancePaise).toBe(-30000);
    expect(charan.status).toBe('DEBTOR');

    // Residual sum must remain 0
    expect(result.verification.sumOfResidualBalancesPaise).toBe(0);
  });

  test('generates transparent explainability narrative', () => {
    const expenses = [
      {
        _id: 'e1',
        description: 'Dinner',
        amountPaise: 90000,
        payerId: 'p1',
        beneficiaries: [
          { participantId: 'p1', sharePaise: 30000 },
          { participantId: 'p2', sharePaise: 30000 },
          { participantId: 'p3', sharePaise: 30000 }
        ]
      }
    ];

    const result = calculateEventBalances(participants, expenses);
    const ashaRecord = result.balances.find(b => b.participantId === 'p1');
    const explanation = generateParticipantExplanation(ashaRecord);

    expect(explanation.narrative).toContain('Asha paid ₹900.00 in total');
    expect(explanation.narrative).toContain('personal share of group expenses was only ₹300.00');
    expect(explanation.narrative).toContain('entitled to receive ₹600.00');
    expect(explanation.paidExpensesBreakdown).toHaveLength(1);
    expect(explanation.sharedExpensesBreakdown).toHaveLength(1);
  });
});
