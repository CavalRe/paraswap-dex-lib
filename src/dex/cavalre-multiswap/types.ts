import { Address } from '../../types';

export type Dict<T> = {
  [key: string]: T;
};
export type Token = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: bigint; // Token reserves
  fee: bigint;
  scale: bigint; // Used to compute weight
  weight: bigint;
  conversion: bigint; // Used to convert decimals
  omega?: bigint; // Used for geometric mean
};
export interface Pool extends Token {
  omega: bigint;
  assets: Dict<Token>;
}
export type PoolState = Token & {
  omega: bigint;
  assets: Dict<Token>;
};

export type CavalreMultiswapData = {
  // TODO: CavalreMultiswapData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
};
