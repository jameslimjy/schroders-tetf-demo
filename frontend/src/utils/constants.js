/**
 * Application Constants
 * Contains contract addresses, RPC URLs, and configuration
 * 
 * Reads deployment info from backend/deployment-info.json
 */

// Contract addresses - these match backend/deployment-info.json
// In production, you could fetch this dynamically, but for demo we use defaults

// Blockchain connection
export const RPC_URL = 'http://localhost:8545';
export const CHAIN_ID = 31337; // Anvil default chain ID

// Contract addresses from backend deployment
// These match backend/deployment-info.json
export const CONTRACT_ADDRESSES = {
  SGDC: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  TES3: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
  dCDP: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
};

// Anvil default account addresses (pre-funded with 10,000 ETH each)
// Account #0: Admin & Stablecoin Provider
// Account #1: AP (Authorized Participant)
// Account #2: Thomas (Retail Investor)
export const ACCOUNTS = {
  ADMIN: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Account #0
  AP: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Account #1
  THOMAS: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Account #2
  STABLECOIN_PROVIDER: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Same as admin (Account #0)
};

// Fixed price for TES3 token (in SGDC, 18 decimals)
export const TES3_PRICE = '100000000000000000000'; // 100 SGDC per TES3

// API endpoint for CDP registry (offchain data)
// Try to load from backend/data directory, fallback to public/api
export const CDP_REGISTRY_API = '/api/cdp-registry.json';
export const CDP_REGISTRY_PATH = '../../backend/data/cdp-registry.json';

// Token decimals (all tokens use 18 decimals)
export const TOKEN_DECIMALS = 18;

// Display settings
export const ADDRESS_SHORT_LENGTH = 6; // Characters to show before/after ... in shortened addresses
export const MAX_TRANSACTIONS_DISPLAY = 20; // Maximum transactions to show in block explorer

// Unique identifier to owner ID mapping
// Maps unique identifiers (SN codes) to owner IDs for wallet creation
export const UNIQUE_ID_TO_OWNER_ID = {
  'SN91X81J21': 'AP',
  'SN72K45M83': 'THOMAS',
};

// Owner ID to unique identifier mapping (reverse lookup)
export const OWNER_ID_TO_UNIQUE_ID = {
  'AP': 'SN91X81J21',
  'THOMAS': 'SN72K45M83',
};

