import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network } from '../../constants';

export const CavalReMultiswapConfig: DexConfigMap<DexParams> = {
  CavalReMultiswap: {
    [Network.AVALANCHE]: {
      pools: [
        {
          address: '0x5f1e8eD8468232Bab71EDa9F4598bDa3161F48eA',
          name: 'Multiswap Beta',
        },
      ],
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {};
