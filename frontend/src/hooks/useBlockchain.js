/**
 * useBlockchain Hook
 * Manages blockchain connection and provides provider/signer utilities
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { createProvider } from '../utils/contractHelpers';

/**
 * Custom hook for blockchain connection management
 * @returns {Object} Blockchain utilities and connection state
 */
export function useBlockchain() {
  const [provider, setProvider] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [blockNumber, setBlockNumber] = useState(null);
  const [error, setError] = useState(null);

  // Initialize provider connection
  useEffect(() => {
    async function connect() {
      try {
        const prov = createProvider();
        
        // Test connection by getting block number
        const blockNum = await prov.getBlockNumber();
        
        setProvider(prov);
        setIsConnected(true);
        setBlockNumber(blockNum);
        setError(null);
      } catch (err) {
        console.error('Failed to connect to blockchain:', err);
        setError(err.message);
        setIsConnected(false);
      }
    }

    connect();

    // Set up block listener for real-time updates
    let blockListener = null;
    if (provider) {
      blockListener = provider.on('block', (blockNum) => {
        setBlockNumber(blockNum);
      });
    }

    return () => {
      if (blockListener) {
        provider.off('block', blockListener);
      }
    };
  }, []);

  /**
   * Get a signer for a specific address (for Anvil local development)
   * Uses Anvil default private keys
   * @param {string} address - Ethereum address
   * @returns {ethers.Wallet} Wallet signer instance
   */
  const getSigner = useCallback((address) => {
    if (!provider) {
      throw new Error('Provider not connected');
    }
    
    // Anvil default private keys (from Anvil startup output)
    // Account #0: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
    // Account #1: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
    // Account #2: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
    
    const privateKeys = {
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266': '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Account #0
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8': '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Account #1
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC': '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // Account #2
    };
    
    const privateKey = privateKeys[address];
    if (!privateKey) {
      throw new Error(`No private key found for address ${address}`);
    }
    
    try {
      return new ethers.Wallet(privateKey, provider);
    } catch (err) {
      console.error('Error creating wallet:', err);
      throw new Error(`Failed to create signer for ${address}`);
    }
  }, [provider]);

  /**
   * Listen to contract events
   * @param {ethers.Contract} contract - Contract instance
   * @param {string} eventName - Event name to listen for
   * @param {Function} callback - Callback function when event is emitted
   * @returns {Function} Cleanup function to remove listener
   */
  const listenToEvent = useCallback((contract, eventName, callback) => {
    if (!contract) return () => {};

    const filter = contract.filters[eventName]();
    contract.on(filter, callback);

    // Return cleanup function
    return () => {
      contract.off(filter, callback);
    };
  }, []);

  return {
    provider,
    isConnected,
    blockNumber,
    error,
    getSigner,
    listenToEvent,
  };
}

