/**
 * Block Explorer Component
 * Displays onchain transactions in real-time
 * Shows transaction hash, function name, block number, from/to addresses
 * 
 * Enhanced Features:
 * - Detects contract deployments and identifies which contract was deployed (SGDC, TES3, dCDP)
 * - Shows descriptive function names instead of "unknown"
 * - Identifies contract-specific function calls (setDCDP, createWallet, etc.)
 * - Matches transactions to known contract addresses for better context
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { useBlockchain } from '../hooks/useBlockchain';
import { useDeploymentInfo } from '../hooks/useDeploymentInfo';
import { shortenAddress } from '../utils/contractHelpers';
import { ADDRESS_SHORT_LENGTH } from '../utils/constants';
import './BlockExplorer.css';

function BlockExplorer() {
  const { provider, isConnected, blockNumber } = useBlockchain();
  const { contractAddresses } = useDeploymentInfo();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const prevTransactionsRef = useRef([]);

  // Calculate function selector for setDCDP(address)
  // Using ethers.id() to get the function selector (first 4 bytes of keccak256 hash)
  const SETDCDP_SELECTOR = ethers.id('setDCDP(address)').slice(0, 10).toLowerCase();

  // Parse transaction to extract function name with enhanced detection
  // Now handles contract deployments and matches to known contract addresses
  const getFunctionName = useCallback((tx, contractAddressesMap = null) => {
    // Get input data from transaction (can be data or input field)
    const inputData = tx.input || tx.data || '';
    const toAddress = tx.to;
    
    // Detect contract deployments (when 'to' is null/undefined)
    // Contract deployments create new contracts, so they don't have a 'to' address
    if (!toAddress && inputData && inputData !== '0x' && inputData.length > 10) {
      // This is a contract deployment transaction
      // We'll identify which contract was deployed by checking the deployed address
      // The deployed address is in the transaction receipt, so we'll handle this in loadTransactions
      return 'deployContract'; // Placeholder, will be updated with specific contract name
    }
    
    // Handle transactions with no input data or empty input
    // This could be a simple ETH transfer or contract creation with minimal data
    if (!inputData || inputData === '0x' || inputData.length < 10) {
      // Check if it's a contract deployment (no 'to' address)
      if (!toAddress) {
        return 'deployContract'; // Will be updated with specific contract name
      }
      // Otherwise, it's likely a simple ETH transfer
      return 'ethTransfer';
    }

    // Function signatures (first 4 bytes / 10 hex chars including 0x)
    // These are the actual function selectors from the contracts
    const functionSignatures = {
      // ERC-20 standard functions
      '0xa9059cbb': 'transfer',
      '0x23b872dd': 'transferFrom',
      '0x095ea7b3': 'approve',
      '0x40c10f19': 'mint', // SGDC.mint
      '0x9dc29fac': 'burn', // TES3.burn
      // dCDP functions
      '0x3f53de20': 'tokenize', // dCDP.tokenize
      '0xba087652': 'redeem', // dCDP.redeem(string,uint256,string)
      '0xa54c222f': 'createWallet', // dCDP.createWallet
      '0xbf40fac1': 'getAddress', // dCDP.getAddress (view - should not appear in transactions)
      '0xef4a7203': 'getOwnerId', // dCDP.getOwnerId (view - should not appear in transactions)
      // TES3 functions
      [SETDCDP_SELECTOR]: 'setDCDP', // TES3.setDCDP(address)
    };

    const sig = inputData.slice(0, 10).toLowerCase();
    const functionName = functionSignatures[sig] || 'unknown';
    
    // If we have contract addresses, try to identify which contract this transaction is calling
    if (contractAddressesMap && toAddress) {
      const toLower = toAddress.toLowerCase();
      // Add context to function name based on which contract is being called
      if (toLower === contractAddressesMap.SGDC?.toLowerCase()) {
        if (functionName === 'unknown') {
          return 'sgdcCall';
        }
        return functionName === 'mint' ? 'mintSGDC' : functionName;
      } else if (toLower === contractAddressesMap.TES3?.toLowerCase()) {
        if (functionName === 'setDCDP') {
          return 'linkTES3';
        }
        if (functionName === 'unknown') {
          return 'tes3Call';
        }
        return functionName;
      } else if (toLower === contractAddressesMap.dCDP?.toLowerCase()) {
        if (functionName === 'unknown') {
          return 'dcdpCall';
        }
        return functionName === 'createWallet' ? 'createWallet' : functionName;
      }
    }
    
    return functionName;
  }, [SETDCDP_SELECTOR]);

  // Load all transactions from recent blocks
  // Loads up to 50 blocks to capture all past transactions (reduced from 100 for better performance)
  // Removed transaction limit - shows all transactions with scrollbar
  const loadTransactions = useCallback(async () => {
    if (!isConnected || !provider || !blockNumber) return;

    try {
      setLoading(true);

      // Get recent blocks (up to 100 blocks to capture all past transactions)
      // This ensures we show all transactions, not just the most recent ones
      // Reduced to 50 blocks for faster loading while still showing sufficient history
      const recentBlocks = [];
      const maxBlocksToLoad = 50; // Load up to 50 blocks (reduced from 100 for better performance)
      for (let i = 0; i < maxBlocksToLoad && blockNumber - i >= 0; i++) {
        try {
          const block = await provider.getBlock(blockNumber - i, true);
          if (block && block.transactions) {
            recentBlocks.push(block);
          }
        } catch (err) {
          console.error(`Error loading block ${blockNumber - i}:`, err);
        }
      }

      // Extract transactions with details
      // Enhanced to detect contract deployments and identify which contract was deployed
      const txList = [];
      for (const block of recentBlocks) {
        for (const tx of block.transactions) {
          let fullTx, txHash, txReceipt;
          
          if (typeof tx === 'string') {
            // Transaction hash, need to fetch full transaction
            try {
              txHash = tx;
              fullTx = await provider.getTransaction(tx);
              if (!fullTx) continue;
            } catch (err) {
              console.error(`Error loading transaction ${tx}:`, err);
              continue;
            }
          } else {
            // Already have transaction object
            fullTx = tx;
            txHash = tx.hash;
          }

          // Fetch transaction receipt to get deployed contract address (for contract deployments)
          let deployedContractAddress = null;
          if (!fullTx.to) {
            // This is a contract deployment - fetch receipt to get deployed contract address
            try {
              txReceipt = await provider.getTransactionReceipt(txHash);
              if (txReceipt && txReceipt.contractAddress) {
                deployedContractAddress = txReceipt.contractAddress;
              }
            } catch (err) {
              // Receipt might not be available yet, that's okay
              console.debug(`Receipt not available for ${txHash}:`, err.message);
            }
          }

          // Determine function name with enhanced detection
          // Using camelCase for function names: deploySGDC, deployTES3, deployTDepository, linkTES3, createWallet
          let functionName;
          if (!fullTx.to && deployedContractAddress) {
            // Contract deployment - identify which contract was deployed
            const deployedLower = deployedContractAddress.toLowerCase();
            const addresses = contractAddresses || {};
            
            if (addresses.SGDC && deployedLower === addresses.SGDC.toLowerCase()) {
              functionName = 'deploySGDC';
            } else if (addresses.TES3 && deployedLower === addresses.TES3.toLowerCase()) {
              functionName = 'deployTES3';
            } else if (addresses.dCDP && deployedLower === addresses.dCDP.toLowerCase()) {
              functionName = 'deployTDepository';
            } else {
              functionName = 'deployContract';
            }
          } else {
            // Regular transaction - use getFunctionName with contract addresses
            functionName = getFunctionName(
              { 
                input: fullTx.data || fullTx.input, 
                data: fullTx.data || fullTx.input,
                to: fullTx.to 
              },
              contractAddresses
            );
          }

          txList.push({
            hash: txHash,
            blockNumber: block.number,
            from: fullTx.from,
            to: fullTx.to || deployedContractAddress, // Show deployed contract address if available
            function: functionName,
            input: fullTx.data || fullTx.input,
          });
        }
      }

      // Sort by block number (newest first)
      // Within the same block, sort by function name priority for block 2:
      // deployTDepository -> deployTES3 -> linkTES3
      // Function name priority map for custom ordering within blocks
      const functionPriority = {
        'deployTDepository': 1,
        'deployTES3': 2,
        'linkTES3': 3,
        'deploySGDC': 1,
        'createWallet': 1,
      };
      
      txList.sort((a, b) => {
        // First sort by block number (newest first)
        if (b.blockNumber !== a.blockNumber) {
          return b.blockNumber - a.blockNumber;
        }
        
        // Within the same block, use function priority for specific functions
        const priorityA = functionPriority[a.function] || 999;
        const priorityB = functionPriority[b.function] || 999;
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // If same priority, maintain original order (or sort alphabetically)
        return a.function.localeCompare(b.function);
      });
      
      // Track previous transactions to detect new ones
      // Use functional update to avoid dependency on transactions state
      setTransactions((prevTx) => {
        prevTransactionsRef.current = prevTx;
        return txList; // Return all transactions, not limited
      });
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [isConnected, provider, blockNumber, contractAddresses, getFunctionName]);

  // Use ref to store latest loadTransactions function to prevent re-renders
  const loadTransactionsRef = useRef(loadTransactions);
  
  // Update ref when callback changes (but don't trigger useEffect re-run)
  useEffect(() => {
    loadTransactionsRef.current = loadTransactions;
  }, [loadTransactions]);

  // Track if we're in the middle of a wallet creation sequence to prevent immediate refresh
  const isWalletCreationInProgressRef = useRef(false);
  // Track if tokenize is in progress to prevent immediate refresh
  const isTokenizeInProgressRef = useRef(false);
  const isOnrampInProgressRef = useRef(false);
  const isBuyInProgressRef = useRef(false);
  const isSellInProgressRef = useRef(false);
  const isRedeemInProgressRef = useRef(false);

  // Listen for wallet creation start event (dispatched immediately when button is pressed)
  // This prevents immediate refresh when transaction is mined
  useEffect(() => {
    const handleWalletCreationStart = () => {
      isWalletCreationInProgressRef.current = true;
    };

    window.addEventListener('wallet-creation-started', handleWalletCreationStart);

    return () => {
      window.removeEventListener('wallet-creation-started', handleWalletCreationStart);
    };
  }, []);

  // Load transactions when block number changes
  // Skip immediate refresh if wallet creation or tokenize is in progress
  useEffect(() => {
    if (isConnected && blockNumber !== null) {
      // Skip immediate refresh during wallet creation or tokenize sequence
      // The wallet-created or block-explorer-refresh window events will trigger the delayed refresh instead
      if (isWalletCreationInProgressRef.current || isTokenizeInProgressRef.current || isOnrampInProgressRef.current || isBuyInProgressRef.current || isSellInProgressRef.current || isRedeemInProgressRef.current) {
        return;
      }
      loadTransactions();
    }
  }, [blockNumber, isConnected, loadTransactions]);

  // Track if wallet creation just happened to delay Block Explorer update
  // This allows network visualizer animation to complete first
  const walletCreatedDelayRef = useRef(null);

  // Listen for wallet creation events to delay Block Explorer update
  // Staggered sequence: animation starts 2s after toast, takes 3.5s, then wait 2s before refresh
  useEffect(() => {
    const handleWalletCreated = () => {
      // Mark that wallet creation is in progress to prevent immediate block refreshes
      isWalletCreationInProgressRef.current = true;
      
      // Clear any pending delayed update
      if (walletCreatedDelayRef.current) {
        clearTimeout(walletCreatedDelayRef.current);
      }
      
      // Refresh 2 seconds after animation finishes (same timing as other components)
      // Animation duration is 3.5 seconds, so wait 3.5s + 2s = 5.5s after wallet-created event
      // (The wallet-created event is already delayed 2s after toast in ActionPanel)
      walletCreatedDelayRef.current = setTimeout(async () => {
        // Refresh transactions simultaneously with dCDP Registry and CDP Registry updates
        // Await the load to ensure it completes before resetting flags
        await loadTransactionsRef.current();
        walletCreatedDelayRef.current = null;
        // Reset flag after refresh completes
        isWalletCreationInProgressRef.current = false;
      }, 5500); // 3.5s (animation) + 2s (post-animation wait) = 5.5s after wallet-created event
    };

    window.addEventListener('wallet-created', handleWalletCreated);

    return () => {
      window.removeEventListener('wallet-created', handleWalletCreated);
      if (walletCreatedDelayRef.current) {
        clearTimeout(walletCreatedDelayRef.current);
      }
    };
  }, []); // Empty dependencies - setup only once

  // Listen for tokenize-started and tokenize-completed events
  useEffect(() => {
    const handleTokenizeStarted = () => {
      isTokenizeInProgressRef.current = true;
    };
    
    const handleTokenizeCompleted = () => {
      isTokenizeInProgressRef.current = false;
    };
    
    window.addEventListener('tokenize-started', handleTokenizeStarted);
    window.addEventListener('tokenize-completed', handleTokenizeCompleted);
    
    return () => {
      window.removeEventListener('tokenize-started', handleTokenizeStarted);
      window.removeEventListener('tokenize-completed', handleTokenizeCompleted);
    };
  }, []); // Empty dependencies - setup only once

  // Listen for onramp-started and onramp-completed events
  useEffect(() => {
    const handleOnrampStarted = () => {
      isOnrampInProgressRef.current = true;
    };
    
    const handleOnrampCompleted = () => {
      isOnrampInProgressRef.current = false;
    };
    
    window.addEventListener('onramp-started', handleOnrampStarted);
    window.addEventListener('onramp-completed', handleOnrampCompleted);
    
    return () => {
      window.removeEventListener('onramp-started', handleOnrampStarted);
      window.removeEventListener('onramp-completed', handleOnrampCompleted);
    };
  }, []); // Empty dependencies - setup only once

  // Listen for buy-started and buy-completed events
  useEffect(() => {
    const handleBuyStarted = () => {
      isBuyInProgressRef.current = true;
    };
    
    const handleBuyCompleted = () => {
      isBuyInProgressRef.current = false;
    };
    
    window.addEventListener('buy-started', handleBuyStarted);
    window.addEventListener('buy-completed', handleBuyCompleted);
    
    return () => {
      window.removeEventListener('buy-started', handleBuyStarted);
      window.removeEventListener('buy-completed', handleBuyCompleted);
    };
  }, []); // Empty dependencies - setup only once

  // Listen for sell-started and sell-completed events
  useEffect(() => {
    const handleSellStarted = () => {
      isSellInProgressRef.current = true;
    };
    
    const handleSellCompleted = () => {
      isSellInProgressRef.current = false;
    };
    
    window.addEventListener('sell-started', handleSellStarted);
    window.addEventListener('sell-completed', handleSellCompleted);
    
    return () => {
      window.removeEventListener('sell-started', handleSellStarted);
      window.removeEventListener('sell-completed', handleSellCompleted);
    };
  }, []); // Empty dependencies - setup only once

  // Listen for redeem-started and redeem-completed events
  useEffect(() => {
    const handleRedeemStarted = () => {
      isRedeemInProgressRef.current = true;
    };
    
    const handleRedeemCompleted = () => {
      isRedeemInProgressRef.current = false;
    };
    
    window.addEventListener('redeem-started', handleRedeemStarted);
    window.addEventListener('redeem-completed', handleRedeemCompleted);
    
    return () => {
      window.removeEventListener('redeem-started', handleRedeemStarted);
      window.removeEventListener('redeem-completed', handleRedeemCompleted);
    };
  }, []); // Empty dependencies - setup only once

  // Listen for block explorer refresh events (triggered after tokenize animation completes)
  // This ensures Block Explorer refreshes 2 seconds after the network visualizer glow animation finishes
  useEffect(() => {
    const handleBlockExplorerRefresh = () => {
      // Refresh transactions when refresh event is received
      // This is called 5.5 seconds after tokenize button is pressed
      // (3.5s animation + 2s delay)
      if (loadTransactionsRef.current) {
        loadTransactionsRef.current();
      }
    };

    window.addEventListener('block-explorer-refresh', handleBlockExplorerRefresh);

    return () => {
      window.removeEventListener('block-explorer-refresh', handleBlockExplorerRefresh);
    };
  }, []); // Empty dependencies - setup only once

  // Set up block listener for real-time updates
  // Use ref for callback to prevent infinite loops when callback changes
  useEffect(() => {
    if (!provider) return;

    const blockListener = provider.on('block', () => {
      // Skip immediate update if wallet creation is in progress
      // This prevents Block Explorer from updating during the network visualizer animation
      // Check both flags: walletCreatedDelayRef (set when wallet-created event received) 
      // and isWalletCreationInProgressRef (set immediately when button is pressed)
      if (walletCreatedDelayRef.current || isWalletCreationInProgressRef.current) {
        return; // Skip this update, delayed update will happen after animation
      }
      
      // Also skip if tokenize is in progress
      if (isTokenizeInProgressRef.current) {
        return; // Skip this update, delayed update will happen after animation
      }
      
      // Also skip if onramp is in progress
      if (isOnrampInProgressRef.current) {
        return; // Skip this update, delayed update will happen after animation
      }
      
      // Also skip if buy is in progress
      if (isBuyInProgressRef.current) {
        return; // Skip this update, delayed update will happen after animation
      }
      
      // Also skip if sell is in progress
      if (isSellInProgressRef.current) {
        return; // Skip this update, delayed update will happen after animation
      }
      
      // Also skip if redeem is in progress
      if (isRedeemInProgressRef.current) {
        return; // Skip this update, delayed update will happen after animation
      }
      
      // Use ref to get latest function without dependency on it
      loadTransactionsRef.current();
    });

    return () => {
      provider.off('block', blockListener);
    };
  }, [provider]); // Removed loadTransactions from dependencies

  return (
    <div className="block-explorer">
      <h3>Block Explorer</h3>
      <div className="block-explorer-content">
        {loading && transactions.length === 0 ? (
          <div className="block-explorer-loading">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="block-explorer-empty">
            No transactions found. Transactions will appear here as they occur.
          </div>
        ) : (
          <table className="block-explorer-table">
            <thead>
              <tr>
                <th>Transaction Hash</th>
                <th>Function</th>
                <th>Block</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {transactions.map((tx, index) => {
                  // Check if this is a new transaction
                  const isNew = !prevTransactionsRef.current.find(
                    prevTx => prevTx.hash === tx.hash
                  );
                  
                  return (
                    <motion.tr
                      key={`${tx.hash}-${index}`}
                      className="block-explorer-row"
                      initial={isNew ? { opacity: 0, x: -20, backgroundColor: '#e8f5e9' } : false}
                      animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <td className="block-explorer-hash">
                        {shortenAddress(tx.hash, ADDRESS_SHORT_LENGTH)}
                      </td>
                      <td className="block-explorer-function">
                        <span className={`function-badge function-${tx.function}`}>
                          {tx.function}
                        </span>
                      </td>
                      <td className="block-explorer-block">{tx.blockNumber}</td>
                      <td className="block-explorer-address">
                        {tx.from ? shortenAddress(tx.from, ADDRESS_SHORT_LENGTH) : 'N/A'}
                      </td>
                      <td className="block-explorer-address">
                        {tx.to ? shortenAddress(tx.to, ADDRESS_SHORT_LENGTH) : 'N/A'}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default BlockExplorer;

