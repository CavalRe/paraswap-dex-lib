import { Contract } from 'web3-eth-contract';
import { TokenState, PoolState } from './types';
import { DeepReadonly } from 'ts-essentials';
import _ from 'lodash';

export const ONE = BigInt(10 ** 18);
export function typecastReadOnly<State>(pool: DeepReadonly<State>): State {
  return _.cloneDeep(pool) as State;
}

// export const generatePoolState = async () => {
//   const assets: TokenState[] = [];
//   const poolInfo: TokenState = getPoolInfo();
//   const pool: PoolState = {
//     address: poolInfo.address,
//     name: poolInfo.name,
//     symbol: poolInfo.symbol,
//     decimals: poolInfo.decimals,
//     balance: poolInfo.balance,
//     fee: poolInfo.fee,
//     scale: poolInfo.scale,
//     weight: poolInfo.weight,
//     conversion: poolInfo.conversion,
//     assets: {},
//     addresses: [],
//   };
// };
