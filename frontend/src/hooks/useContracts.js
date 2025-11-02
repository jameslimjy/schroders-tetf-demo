/**
 * useContracts Hook
 * Manages contract instances and provides contract interaction utilities
 */

import { useState, useEffect, useCallback } from 'react';
import { createContract, createContractWithSigner } from '../utils/contractHelpers';
import { CONTRACT_ADDRESSES } from '../utils/constants';
import { useBlockchain } from './useBlockchain';

// Note: We cannot import ABIs from backend directory as it's outside src/
// React/Webpack doesn't allow imports outside src/ for security reasons
// Instead, we use minimal ABIs that cover all necessary functions
// If you need full ABIs, copy them to src/contracts/ or use the public folder
let SGDC_ABI = null;
let TES3_ABI = null;
let dCDP_ABI_FULL = null;

// Minimal ERC-20 ABI (fallback if full ABI not available)
const ERC20_ABI_MINIMAL = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function mint(address to, uint256 amount)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// Minimal dCDP ABI (fallback)
const dCDP_ABI_MINIMAL = [
  'function createWallet(string memory owner_id, address walletAddress)',
  'function tokenize(string memory owner_id, uint256 quantity, string memory symbol)',
  'function getAddress(string memory owner_id) view returns (address)',
  'function getOwnerId(address walletAddress) view returns (string)',
  'function ownerToAddress(string memory owner_id) view returns (address)',
  'function addressToOwner(address walletAddress) view returns (string)',
  'event WalletCreated(string indexed owner_id, address indexed walletAddress)',
  'event Tokenized(string indexed owner_id, string symbol, uint256 quantity, address indexed tokenAddress)',
];

// Use full ABIs if available, otherwise use minimal
const ERC20_ABI = SGDC_ABI || ERC20_ABI_MINIMAL;
const TES3_ABI_ACTUAL = TES3_ABI || ERC20_ABI_MINIMAL;
const dCDP_ABI = dCDP_ABI_FULL || dCDP_ABI_MINIMAL;

/**
 * Custom hook for managing contract instances
 * @returns {Object} Contract instances and interaction functions
 */
export function useContracts() {
  const { provider, isConnected } = useBlockchain();
  const [contracts, setContracts] = useState({
    sgdc: null,
    tes3: null,
    dcdp: null,
  });
  const [error, setError] = useState(null);

  // Initialize contracts when provider is ready
  useEffect(() => {
    if (!isConnected || !provider) return;

    try {
      const sgdc = createContract(CONTRACT_ADDRESSES.SGDC, ERC20_ABI, provider);
      const tes3 = createContract(CONTRACT_ADDRESSES.TES3, TES3_ABI_ACTUAL, provider);
      const dcdp = createContract(CONTRACT_ADDRESSES.dCDP, dCDP_ABI, provider);

      setContracts({
        sgdc,
        tes3,
        dcdp,
      });
      setError(null);
    } catch (err) {
      console.error('Failed to initialize contracts:', err);
      setError(err.message);
    }
  }, [isConnected, provider]);

  /**
   * Get contract with signer for write operations
   * @param {string} contractName - 'sgdc', 'tes3', or 'dcdp'
   * @param {ethers.Signer} signer - Signer instance
   * @returns {ethers.Contract} Contract with signer
   */
  const getContractWithSigner = useCallback((contractName, signer) => {
    if (!contracts[contractName]) {
      throw new Error(`Contract ${contractName} not initialized`);
    }

    // Map contract name to CONTRACT_ADDRESSES key
    // Handle case-insensitive matching and special cases
    let addressKey;
    if (contractName.toLowerCase() === 'dcdp') {
      addressKey = 'dCDP'; // Special case: dCDP has mixed case
    } else {
      addressKey = contractName.toUpperCase();
    }
    
    const address = CONTRACT_ADDRESSES[addressKey];
    if (!address) {
      throw new Error(`Contract address not found for ${contractName} (key: ${addressKey})`);
    }
    
    let abi;
    if (contractName === 'dcdp') {
      abi = dCDP_ABI;
    } else if (contractName === 'tes3') {
      abi = TES3_ABI_ACTUAL;
    } else {
      abi = ERC20_ABI;
    }
    
    return createContractWithSigner(address, abi, signer);
  }, [contracts]);

  /**
   * Get token balance for an address
   * @param {string} contractName - 'sgdc' or 'tes3'
   * @param {string} address - Ethereum address
   * @returns {Promise<string>} Balance as formatted string
   */
  const getBalance = useCallback(async (contractName, address) => {
    if (!contracts[contractName]) {
      throw new Error(`Contract ${contractName} not initialized`);
    }

    try {
      const balance = await contracts[contractName].balanceOf(address);
      return balance.toString();
    } catch (err) {
      console.error(`Failed to get ${contractName} balance:`, err);
      throw err;
    }
  }, [contracts]);

  return {
    contracts,
    isReady: contracts.sgdc && contracts.tes3 && contracts.dcdp,
    error,
    getContractWithSigner,
    getBalance,
  };
}

