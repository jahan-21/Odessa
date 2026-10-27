/**
 * CampusSplit Financial Core — Split Allocation Engine
 *
 * Implements deterministic allocation policies for Equal, Exact, and Percentage
 * splits, fully resolving the "one-paise problem" with zero sum leakage.
 */

const { isValidPaise, formatRupees, rupeesToPaise } = require('./money');

const BASIS_POINTS_TOTAL = 10000; // 100.00% = 10,000 basis points

/**
 * Validates a list of beneficiary IDs for uniqueness and validity.
 *
 * @param {string[]} participantIds
 * @throws {Error} If empty or contains duplicates
 */
function validateBeneficiaryIds(participantIds) {
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new Error('At least one beneficiary must be selected.');
  }

  const seen = new Set();
  for (const id of participantIds) {
    if (!id || typeof id !== 'string') {
      throw new Error(`Invalid participant ID provided: ${id}`);
    }
    const cleanId = id.trim();
    if (seen.has(cleanId)) {
      throw new Error(`Duplicate beneficiary detected: participant "${cleanId}" cannot be included more than once.`);
    }
    seen.add(cleanId);
  }
}

/**
 * Equal Split Allocation
 *
 * Allocates an expense equally among M participants.
 * Deterministic remainder policy:
 * - Base share Q = floor(amountPaise / M)
 * - Remainder R = amountPaise % M
 * - Beneficiaries sorted lexicographically by participant ID
 * - Top R beneficiaries receive Q + 1 paise; remaining receive Q paise.
 *
 * Invariant: sum(shares) === amountPaise
 *
 * @param {number} amountPaise - Total expense in integer paise
 * @param {string[]} beneficiaryIds - Array of participant IDs
 * @returns {Array<{ participantId: string, sharePaise: number }>}
 */
function calculateEqualSplit(amountPaise, beneficiaryIds) {
  if (!isValidPaise(amountPaise)) {
    throw new Error(`Invalid expense amount: ${amountPaise}`);
  }
  validateBeneficiaryIds(beneficiaryIds);

  const M = beneficiaryIds.length;
  const quotient = Math.floor(amountPaise / M);
  const remainder = amountPaise % M;

  // Stable sort by participant ID to ensure determinism
  const sortedIds = [...beneficiaryIds].map(String).sort();

  // Create allocation map based on sorted IDs
  const shareMap = new Map();
  sortedIds.forEach((id, index) => {
    const extraPaise = index < remainder ? 1 : 0;
    shareMap.set(id, quotient + extraPaise);
  });

  // Return in original order of input beneficiaryIds
  const shares = beneficiaryIds.map(id => ({
    participantId: String(id),
    sharePaise: shareMap.get(String(id))
  }));

  assertSumInvariant(amountPaise, shares, 'Equal Split');
  return shares;
}

/**
 * Exact Split Allocation
 *
 * Validates that user-supplied exact shares are positive integers and
 * sum up exactly to the total expense amount.
 *
 * @param {number} amountPaise - Total expense in integer paise
 * @param {Array<{ participantId: string, sharePaise: number }>} rawShares
 * @returns {Array<{ participantId: string, sharePaise: number }>}
 */
function calculateExactSplit(amountPaise, rawShares) {
  if (!isValidPaise(amountPaise)) {
    throw new Error(`Invalid expense amount: ${amountPaise}`);
  }
  if (!Array.isArray(rawShares) || rawShares.length === 0) {
    throw new Error('At least one beneficiary share must be provided for exact split.');
  }

  const participantIds = rawShares.map(s => s.participantId);
  validateBeneficiaryIds(participantIds);

  let allocatedSum = 0;
  const shares = [];

  for (const item of rawShares) {
    const share = item.sharePaise;
    if (!Number.isInteger(share) || share < 1) {
      throw new Error(`Exact share for participant "${item.participantId}" must be an integer >= 1 paise. Received: ${share}`);
    }
    allocatedSum += share;
    shares.push({
      participantId: String(item.participantId),
      sharePaise: share
    });
  }

  if (allocatedSum !== amountPaise) {
    const diff = amountPaise - allocatedSum;
    const diffText = diff > 0 ? `short by ${formatRupees(diff)} (${diff} paise)` : `exceeds by ${formatRupees(Math.abs(diff))} (${Math.abs(diff)} paise)`;
    throw new Error(
      `Exact split mismatch: Total shares (${formatRupees(allocatedSum)}) does not match expense amount (${formatRupees(amountPaise)}). Allocation is ${diffText}.`
    );
  }

  assertSumInvariant(amountPaise, shares, 'Exact Split');
  return shares;
}

/**
 * Percentage Split Allocation (Hare-Niemeyer / Largest-Remainder Method)
 *
 * Distributes amount according to percentage basis points (100% = 10,000 bps).
 * Computes exact shares, assigns floor share, and distributes remaining paise
 * to the beneficiaries with the largest fractional remainders.
 * Deterministic tie-breaker: participant ID lexicographical order.
 *
 * @param {number} amountPaise - Total expense in integer paise
 * @param {Array<{ participantId: string, percentageBps: number }>} rawPercentages
 * @returns {Array<{ participantId: string, sharePaise: number, percentageBps: number }>}
 */
function calculatePercentageSplit(amountPaise, rawPercentages) {
  if (!isValidPaise(amountPaise)) {
    throw new Error(`Invalid expense amount: ${amountPaise}`);
  }
  if (!Array.isArray(rawPercentages) || rawPercentages.length === 0) {
    throw new Error('At least one beneficiary percentage must be provided.');
  }

  const participantIds = rawPercentages.map(p => p.participantId);
  validateBeneficiaryIds(participantIds);

  let totalBps = 0;
  for (const item of rawPercentages) {
    if (!Number.isInteger(item.percentageBps) || item.percentageBps < 1) {
      throw new Error(`Percentage for participant "${item.participantId}" must be a positive integer in basis points (1 - 10000).`);
    }
    totalBps += item.percentageBps;
  }

  if (totalBps !== BASIS_POINTS_TOTAL) {
    const totalPercent = (totalBps / 100).toFixed(2);
    throw new Error(`Percentage split must total exactly 100.00% (10,000 basis points). Current total is ${totalPercent}% (${totalBps} bps).`);
  }

  // 1. Calculate exact shares, floor shares, and fractional remainders
  let floorSum = 0;
  const items = rawPercentages.map(item => {
    const exactShare = (amountPaise * item.percentageBps) / BASIS_POINTS_TOTAL;
    const floorShare = Math.floor(exactShare);
    const fractionalRemainder = exactShare - floorShare;
    floorSum += floorShare;
    return {
      participantId: String(item.participantId),
      percentageBps: item.percentageBps,
      floorShare,
      fractionalRemainder
    };
  });

  // 2. Remaining paise to distribute
  let remainderPaise = amountPaise - floorSum;

  // 3. Sort by remainder descending, tie-breaking by participantId ascending
  const sorted = [...items].sort((a, b) => {
    // Primary: largest remainder first (tolerance 1e-9 for floating-point comparison of fractions)
    if (Math.abs(b.fractionalRemainder - a.fractionalRemainder) > 1e-9) {
      return b.fractionalRemainder - a.fractionalRemainder;
    }
    // Deterministic tie-breaker: ascending participant ID
    return a.participantId.localeCompare(b.participantId);
  });

  // 4. Distribute 1 extra paise to top remainderPaise beneficiaries
  const bonusSet = new Set();
  for (let i = 0; i < remainderPaise; i++) {
    bonusSet.add(sorted[i].participantId);
  }

  // 5. Finalize shares in original order
  const finalShares = items.map(item => {
    const extra = bonusSet.has(item.participantId) ? 1 : 0;
    return {
      participantId: item.participantId,
      sharePaise: item.floorShare + extra,
      percentageBps: item.percentageBps
    };
  });

  assertSumInvariant(amountPaise, finalShares, 'Percentage Split');
  return finalShares;
}

/**
 * Universal split dispatcher
 *
 * @param {string} splitMethod - 'EQUAL' | 'EXACT' | 'PERCENTAGE'
 * @param {number} amountPaise
 * @param {Array<any>} rawBeneficiaries
 * @returns {Array<{ participantId: string, sharePaise: number, [key: string]: any }>}
 */
function allocateExpenseShares(splitMethod, amountPaise, rawBeneficiaries) {
  switch (splitMethod) {
    case 'EQUAL': {
      const ids = Array.isArray(rawBeneficiaries)
        ? rawBeneficiaries.map(b => (typeof b === 'string' ? b : b.participantId))
        : [];
      return calculateEqualSplit(amountPaise, ids);
    }
    case 'EXACT': {
      return calculateExactSplit(amountPaise, rawBeneficiaries);
    }
    case 'PERCENTAGE': {
      return calculatePercentageSplit(amountPaise, rawBeneficiaries);
    }
    default:
      throw new Error(`Unsupported split method: "${splitMethod}". Expected EQUAL, EXACT, or PERCENTAGE.`);
  }
}

/**
 * Asserts the invariant: sum(shares) === amountPaise
 */
function assertSumInvariant(amountPaise, shares, methodName) {
  const sum = shares.reduce((acc, s) => acc + s.sharePaise, 0);
  if (sum !== amountPaise) {
    throw new Error(
      `Financial Invariant Violation in ${methodName}: Allocated shares sum (${sum} paise) does not match total expense (${amountPaise} paise).`
    );
  }
}

module.exports = {
  BASIS_POINTS_TOTAL,
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  allocateExpenseShares,
  assertSumInvariant,
  validateBeneficiaryIds
};
