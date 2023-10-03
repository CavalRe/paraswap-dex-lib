import { PoolState } from '../../types';

export type MultiswapBetaQuoteInputs = {
  payTokens: string[];
  amounts: bigint[];
  receiveTokens: string[];
  allocations: bigint[];
};

export type MultiswapBetaQuoteResult = {
  isValid: boolean;
  receiveAmounts: bigint[];
  feeAmount: bigint;
  errors: string[];
};

const ONE = BigInt(1e18);

const validationCheck = (pool: PoolState, inputs: MultiswapBetaQuoteInputs) => {
  let result: MultiswapBetaQuoteResult = {
    isValid: true,
    receiveAmounts: [],
    feeAmount: 0n,
    errors: [],
  };

  const { payTokens, amounts, receiveTokens, allocations } = inputs;
  if (payTokens.length !== amounts.length) {
    result.isValid = false;
    result.errors.push('payTokens and amounts must be the same length');
  }
  if (receiveTokens.length !== allocations.length) {
    result.isValid = false;
    result.errors.push('receiveTokens and allocations must be the same length');
  }
  payTokens.forEach(token => {
    const notAnAsset = !pool.assets[token];
    const notThePool = token !== pool.address;
    if (notAnAsset && notThePool) {
      result.isValid = false;
      result.errors.push(`pool does not contain token ${token}`);
    }
  });
  receiveTokens.forEach(token => {
    const notAnAsset = !pool.assets[token];
    const notThePool = token !== pool.address;
    if (notAnAsset && notThePool) {
      result.isValid = false;
      result.errors.push(`pool does not contain token ${token}`);
    }
  });
  amounts.forEach((amount, i) => {
    if (amount === 0n) {
      result.isValid = false;
      result.errors.push(`amounts[${i}] must be positive`);
    }
  });
  allocations.forEach((allocation, i) => {
    if (allocation === 0n) {
      result.isValid = false;
      result.errors.push(`allocations[${i}] must be positive`);
    }
  });
  const totalAllocation = allocations.reduce((a, b) => a + b, 0n);
  if (totalAllocation !== ONE) {
    result.isValid = false;
    result.errors.push(`totalAllocation must be 1, got ${totalAllocation}`);
  }
  payTokens.forEach((tokenAddress, i) => {
    if (tokenAddress === pool.address && i > 0) {
      result.isValid = false;
      result.errors.push('pool token must be first in payTokens');
    }
  });
  receiveTokens.forEach((tokenAddress, i) => {
    if (tokenAddress === pool.address && i > 0) {
      result.isValid = false;
      result.errors.push('pool token must be first in receiveTokens');
    }
  });
  return result;
};

export function multiswapBetaQuote(
  pool: PoolState,
  inputs: {
    payTokens: string[];
    amounts: bigint[];
    receiveTokens: string[];
    allocations: bigint[];
  },
) {
  const { payTokens, amounts: ogAmounts, receiveTokens, allocations } = inputs;
  //convertAmounts to use asset.conversion
  const amounts = ogAmounts.map((amount, i) => {
    const token = payTokens[i];
    if (token === pool.address) return amount;
    const asset = pool.assets[token];
    return amount / asset.conversion;
  });
  const result: MultiswapBetaQuoteResult = validationCheck(pool, {
    ...inputs,
    amounts,
  });
  if (!result.isValid) {
    return result;
  }
  const receiveAmounts: bigint[] = new Array(receiveTokens.length).fill(
    BigInt(0),
  );
  let feeAmount: bigint = BigInt(0);

  // Compute the fee
  let fee: bigint = BigInt(0);
  for (let i = 0; i < receiveTokens.length; i++) {
    const token_: string = receiveTokens[i];
    if (token_ !== pool.address) {
      fee += (allocations[i] * pool.assets[token_].fee) / ONE;
    }
  }

  // Compute scaledValueIn, poolOut, and feeAmount
  let scaledValueIn: bigint = BigInt(0);
  let poolOut: bigint = BigInt(0);

  // Contribution from assets only
  for (let i = 0; i < payTokens.length; i++) {
    const token_: string = payTokens[i];
    if (token_ !== pool.address) {
      const assetIn = pool.assets[token_];
      const amount_: bigint = amounts[i] * assetIn.conversion; // Convert to canonical
      scaledValueIn += (assetIn.scale * amount_) / (assetIn.balance + amount_);
    }
  }

  let poolAlloc: bigint = fee;
  if (receiveTokens[0] === pool.address) {
    poolAlloc += (allocations[0] * (ONE - fee)) / ONE;
  }
  const lastPoolBalance: bigint = pool.balance;
  const scaledPoolOut: bigint = (scaledValueIn * poolAlloc) / ONE;

  if (payTokens[0] === pool.address) {
    const poolIn: bigint = amounts[0];
    poolOut =
      (poolAlloc *
        (scaledValueIn * (lastPoolBalance - poolIn) + pool.scale * poolIn)) /
      (pool.scale - scaledPoolOut) /
      ONE;
    scaledValueIn +=
      (pool.scale * poolIn) / (lastPoolBalance + poolOut - poolIn);
    feeAmount = poolOut;
  } else {
    poolOut = (lastPoolBalance * scaledPoolOut) / (pool.scale - scaledPoolOut);
    if (poolAlloc > BigInt(0)) {
      feeAmount = (poolOut * fee) / poolAlloc;
    }
  }

  // Compute receiveAmounts
  for (let i = 0; i < receiveTokens.length; i++) {
    const receiveToken: string = receiveTokens[i];
    const allocation: bigint = (allocations[i] * (ONE - fee)) / ONE;
    const scaledValueOut: bigint = (scaledValueIn * allocation) / ONE;

    if (receiveToken === pool.address) {
      receiveAmounts[i] = poolOut - feeAmount;
    } else {
      const assetOut = pool.assets[receiveToken];
      receiveAmounts[i] =
        (assetOut.balance * scaledValueOut) /
        (assetOut.scale + scaledValueOut) /
        assetOut.conversion;
    }
  }

  result.receiveAmounts = receiveAmounts.map((amount, i) => {
    const token = receiveTokens[i];
    if (token === pool.address) return amount;
    const asset = pool.assets[token];
    return amount * asset.conversion;
  });
  result.feeAmount = feeAmount;
  return result;
}
