/**
 * Block Explorer Component
 * Displays onchain transactions in real-time
 * Shows transaction hash, function name, block number, from/to addresses
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBlockchain } from '../hooks/useBlockchain';
import { shortenAddress } from '../utils/contractHelpers';
import { ADDRESS_SHORT_LENGTH } from '../utils/constants';
import './BlockExplorer.css';

function BlockExplorer() {
  const { provider, isConnected, blockNumber } = useBlockchain();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const prevTransactionsRef = useRef([]);

  // Parse transaction to extract function name
  const getFunctionName = (tx) => {
    // Get input data from transaction (can be data or input field)
    const inputData = tx.input || tx.data || '';
    
    // Try to decode function name from input data
    if (!inputData || inputData === '0x' || inputData.length < 10) {
      return 'transfer'; // Likely a simple transfer or contract creation
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
      '0xbf40fac1': 'getAddress', // dCDP.getAddress (view)
      '0xef4a7203': 'getOwnerId', // dCDP.getOwnerId (view)
    };

    const sig = inputData.slice(0, 10).toLowerCase();
    return functionSignatures[sig] || 'unknown';
  };

  // Load all transactions from recent blocks
  // Loads up to 100 blocks to capture all past transactions
  // Removed transaction limit - shows all transactions with scrollbar
  const loadTransactions = useCallback(async () => {
    if (!isConnected || !provider || !blockNumber) return;

    try {
      setLoading(true);

      // Get recent blocks (up to 100 blocks to capture all past transactions)
      // This ensures we show all transactions, not just the most recent ones
      const recentBlocks = [];
      const maxBlocksToLoad = 100; // Load up to 100 blocks to capture history
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
      const txList = [];
      for (const block of recentBlocks) {
        for (const tx of block.transactions) {
          if (typeof tx === 'string') {
            // Transaction hash, need to fetch full transaction
            try {
              const fullTx = await provider.getTransaction(tx);
              if (fullTx) {
                txList.push({
                  hash: tx,
                  blockNumber: block.number,
                  from: fullTx.from,
                  to: fullTx.to,
                  function: getFunctionName({ input: fullTx.data || fullTx.input, data: fullTx.data }),
                  input: fullTx.data || fullTx.input,
                });
              }
            } catch (err) {
              console.error(`Error loading transaction ${tx}:`, err);
            }
          } else {
            // Already have transaction object
            txList.push({
              hash: tx.hash,
              blockNumber: block.number,
              from: tx.from,
              to: tx.to,
              function: getFunctionName({ input: tx.data || tx.input, data: tx.data }),
              input: tx.data || tx.input,
            });
          }
        }
      }

      // Sort by block number (newest first)
      // No limit - show all transactions (scrollbar will handle overflow)
      txList.sort((a, b) => b.blockNumber - a.blockNumber);
      
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
  }, [isConnected, provider, blockNumber]);

  // Use ref to store latest loadTransactions function to prevent re-renders
  const loadTransactionsRef = useRef(loadTransactions);
  
  // Update ref when callback changes (but don't trigger useEffect re-run)
  useEffect(() => {
    loadTransactionsRef.current = loadTransactions;
  }, [loadTransactions]);

  // Track if we're in the middle of a wallet creation sequence to prevent immediate refresh
  const isWalletCreationInProgressRef = useRef(false);

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
  // Skip immediate refresh if wallet creation is in progress
  useEffect(() => {
    if (isConnected && blockNumber !== null) {
      // Skip immediate refresh during wallet creation sequence
      // The wallet-created window event will trigger the delayed refresh instead
      if (isWalletCreationInProgressRef.current) {
        return;
      }
      loadTransactions();
    }
  }, [blockNumber, isConnected, loadTransactions]);

  // Track if wallet creation just happened to delay Block Explorer update
  // This allows network visualizer animation to complete first
  const walletCreatedDelayRef = useRef(null);

  // Listen for wallet creation events to delay Block Explorer update
  // Staggered sequence: animation starts 2s after toast, takes 3.5s, then wait 1s before refresh
  useEffect(() => {
    const handleWalletCreated = () => {
      // Mark that wallet creation is in progress to prevent immediate block refreshes
      isWalletCreationInProgressRef.current = true;
      
      // Clear any pending delayed update
      if (walletCreatedDelayRef.current) {
        clearTimeout(walletCreatedDelayRef.current);
      }
      
      // Refresh 1 second after animation finishes
      // Animation duration is 3.5 seconds, so wait 3.5s + 1s = 4.5s after wallet-created event
      // (The wallet-created event is already delayed 2s after toast in ActionPanel)
      walletCreatedDelayRef.current = setTimeout(() => {
        // Refresh transactions simultaneously with dCDP Registry update
        loadTransactionsRef.current();
        walletCreatedDelayRef.current = null;
        // Reset flag after refresh completes
        isWalletCreationInProgressRef.current = false;
      }, 4500); // 3.5s (animation) + 1s (post-animation wait) = 4.5s after wallet-created event
    };

    window.addEventListener('wallet-created', handleWalletCreated);

    return () => {
      window.removeEventListener('wallet-created', handleWalletCreated);
      if (walletCreatedDelayRef.current) {
        clearTimeout(walletCreatedDelayRef.current);
      }
    };
  }, []); // Empty dependencies - setup only once

  // Set up block listener for real-time updates
  // Use ref for callback to prevent infinite loops when callback changes
  useEffect(() => {
    if (!provider) return;

    const blockListener = provider.on('block', () => {
      // Skip immediate update if wallet creation delay is active
      // This prevents Block Explorer from updating during the network visualizer animation
      if (walletCreatedDelayRef.current) {
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

