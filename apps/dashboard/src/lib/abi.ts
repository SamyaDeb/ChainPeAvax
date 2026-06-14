/** Minimal ABIs the dashboard needs (registry reads/writes + reputation + USDC). */

const SERVICE_COMPONENTS = [
  { name: 'name', type: 'string' },
  { name: 'description', type: 'string' },
  { name: 'tags', type: 'string' },
  { name: 'endpoint', type: 'string' },
  { name: 'pricePerRequest', type: 'string' },
  { name: 'paymentToken', type: 'string' },
  { name: 'network', type: 'string' },
  { name: 'payTo', type: 'address' },
  { name: 'developer', type: 'address' },
  { name: 'agentId', type: 'uint256' },
  { name: 'createdAt', type: 'uint64' },
  { name: 'updatedAt', type: 'uint64' },
  { name: 'exists', type: 'bool' }
] as const

const SERVICE_INPUT_COMPONENTS = [
  { name: 'name', type: 'string' },
  { name: 'description', type: 'string' },
  { name: 'tags', type: 'string' },
  { name: 'endpoint', type: 'string' },
  { name: 'pricePerRequest', type: 'string' },
  { name: 'paymentToken', type: 'string' },
  { name: 'network', type: 'string' },
  { name: 'payTo', type: 'address' },
  { name: 'agentId', type: 'uint256' }
] as const

export const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'getServiceCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'getServices',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' }
    ],
    outputs: [{ name: 'page', type: 'tuple[]', components: SERVICE_COMPONENTS }]
  },
  {
    type: 'function',
    name: 'hasService',
    stateMutability: 'view',
    inputs: [
      { name: 'developer', type: 'address' },
      { name: 'name', type: 'string' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'registrationFee',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'feeToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'input', type: 'tuple', components: SERVICE_INPUT_COMPONENTS }],
    outputs: [{ name: 'key', type: 'bytes32' }]
  },
  {
    type: 'function',
    name: 'update',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'input', type: 'tuple', components: SERVICE_INPUT_COMPONENTS }],
    outputs: [{ name: 'key', type: 'bytes32' }]
  }
] as const

export const REPUTATION_ABI = [
  {
    type: 'function',
    name: 'getClients',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }]
  },
  {
    type: 'function',
    name: 'getSummary',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' }
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'summaryValue', type: 'int128' },
      { name: 'summaryValueDecimals', type: 'uint8' }
    ]
  }
] as const

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const
