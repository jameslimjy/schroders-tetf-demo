/**
 * useContracts Hook
 * Manages contract instances and provides contract interaction utilities
 * Loads contract addresses from deployment-info.json (golden source of truth)
 */

import { useState, useEffect, useCallback } from 'react';
import { createContract, createContractWithSigner } from '../utils/contractHelpers';
import { CONTRACT_ADDRESSES_FALLBACK } from '../utils/constants';
import { useBlockchain } from './useBlockchain';
import { useDeploymentInfo } from './useDeploymentInfo';

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
  const { contractAddresses, loading: deploymentLoading, usingFallback } = useDeploymentInfo();
  const [contracts, setContracts] = useState({
    sgdc: null,
    tes3: null,
    dcdp: null,
  });
  const [error, setError] = useState(null);

  // Initialize contracts when provider is ready and deployment info is loaded
  useEffect(() => {
    if (!isConnected || !provider || deploymentLoading) return;

    try {
      // Use addresses from deployment-info.json (or fallback if loading failed)
      const addresses = contractAddresses || CONTRACT_ADDRESSES_FALLBACK;
      
      if (usingFallback) {
        console.warn('[useContracts] Using fallback contract addresses. Deployment info not available.');
      } else {
        console.log('[useContracts] Using contract addresses from deployment-info.json:', addresses);
      }

      const sgdc = createContract(addresses.SGDC, ERC20_ABI, provider);
      const tes3 = createContract(addresses.TES3, TES3_ABI_ACTUAL, provider);
      const dcdp = createContract(addresses.dCDP, dCDP_ABI, provider);

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
  }, [isConnected, provider, contractAddresses, deploymentLoading, usingFallback]);

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

    // Use addresses from deployment info (or fallback)
    const addresses = contractAddresses || CONTRACT_ADDRESSES_FALLBACK;
    
    // Map contract name to address key
    // Handle case-insensitive matching and special cases
    let addressKey;
    if (contractName.toLowerCase() === 'dcdp') {
      addressKey = 'dCDP'; // Special case: dCDP has mixed case
    } else {
      addressKey = contractName.toUpperCase();
    }
    
    const address = addresses[addressKey];
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
  }, [contracts, contractAddresses]);

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

    // Validate address before calling balanceOf
    if (!address || 
        address === '0x0000000000000000000000000000000000000000' ||
        address.length !== 42 || // Ethereum addresses are 42 chars (0x + 40 hex)
        !address.startsWith('0x')) {
      console.warn(`[useContracts] Invalid address for balanceOf: ${address}`);
      return '0'; // Return zero balance for invalid addresses
    }

    // CRITICAL: Check if this is a contract address before calling balanceOf
    // Use current contract addresses (from deployment info or fallback)
    const addresses = contractAddresses || CONTRACT_ADDRESSES_FALLBACK;
    const addressLower = address.toLowerCase();
    const contractAddressesLower = [
      addresses.dCDP?.toLowerCase(),
      addresses.SGDC?.toLowerCase(),
      addresses.TES3?.toLowerCase(),
    ].filter(Boolean); // Remove any undefined values
    
    if (contractAddressesLower.includes(addressLower)) {
      console.error(`[useContracts] BLOCKED: Attempted to call balanceOf on contract address ${address} for ${contractName}`);
      console.error(`[useContracts] Stack trace:`, new Error().stack);
      return '0'; // Return zero instead of calling
    }

    try {
      const balance = await contracts[contractName].balanceOf(address);
      return balance.toString();
    } catch (err) {
      // Handle decode errors gracefully (e.g., when contract returns 0x)
      if (err.code === 'BAD_DATA' || err.message?.includes('could not decode')) {
        console.warn(`[useContracts] Could not decode balance for ${contractName} at ${address}, assuming zero balance`);
        return '0';
      }
      console.error(`[useContracts] Failed to get ${contractName} balance:`, err);
      // Return zero instead of throwing for better UX
      return '0';
    }
  }, [contracts, contractAddresses]);

  return {
    contracts,
    isReady: contracts.sgdc && contracts.tes3 && contracts.dcdp,
    error,
    getContractWithSigner,
    getBalance,
  };
}

