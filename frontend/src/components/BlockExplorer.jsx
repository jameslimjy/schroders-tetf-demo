/**
 * Block Explorer Component
 * Displays onchain transactions in real-time
 * Shows transaction hash, function name, block number, from/to addresses
 */

import React, { useState, useEffect } from 'react';
import { useBlockchain } from '../hooks/useBlockchain';
import { shortenAddress } from '../utils/contractHelpers';
import { MAX_TRANSACTIONS_DISPLAY, ADDRESS_SHORT_LENGTH } from '../utils/constants';
import './BlockExplorer.css';

function BlockExplorer() {
  const { provider, isConnected, blockNumber } = useBlockchain();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Parse transaction to extract function name
  const getFunctionName = (tx) => {
    // Try to decode function name from input data
    if (!tx.input || tx.input === '0x' || tx.input.length < 10) {
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
      '0xa54c222f': 'createWallet', // dCDP.createWallet
      '0xbf40fac1': 'getAddress', // dCDP.getAddress (view)
      '0xef4a7203': 'getOwnerId', // dCDP.getOwnerId (view)
    };

    const sig = tx.input.slice(0, 10).toLowerCase();
    return functionSignatures[sig] || 'unknown';
  };

  // Load recent transactions
  const loadTransactions = async () => {
    if (!isConnected || !provider || !blockNumber) return;

    try {
      setLoading(true);

      // Get recent blocks (last 5 blocks)
      const recentBlocks = [];
      for (let i = 0; i < 5 && blockNumber - i >= 0; i++) {
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
                  function: getFunctionName(fullTx),
                  input: fullTx.data,
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
              function: getFunctionName(tx),
              input: tx.data,
            });
          }
        }
      }

      // Sort by block number (newest first) and limit
      txList.sort((a, b) => b.blockNumber - a.blockNumber);
      setTransactions(txList.slice(0, MAX_TRANSACTIONS_DISPLAY));
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load transactions when block number changes
  useEffect(() => {
    if (isConnected && blockNumber !== null) {
      loadTransactions();
    }
  }, [blockNumber, isConnected]);

  // Set up block listener for real-time updates
  useEffect(() => {
    if (!provider) return;

    const blockListener = provider.on('block', () => {
      loadTransactions();
    });

    return () => {
      provider.off('block', blockListener);
    };
  }, [provider]);

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
                <th>Txn Hash</th>
                <th>Function</th>
                <th>Block</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, index) => (
                <tr key={`${tx.hash}-${index}`} className="block-explorer-row">
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default BlockExplorer;

