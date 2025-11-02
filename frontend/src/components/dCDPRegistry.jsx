/**
 * dCDP Registry Component
 * Displays onchain tokenized securities balances
 * Queries smart contracts in real-time
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useContracts } from '../hooks/useContracts';
import { formatTokenAmount, shortenAddress } from '../utils/contractHelpers';
import { ACCOUNTS, ADDRESS_SHORT_LENGTH } from '../utils/constants';
import './dCDPRegistry.css';

// Logo path for dCDP Registry
const LOGO_BASE_PATH = '/assets/logos/';

function DCDPRegistry() {
  const { contracts, isReady, getBalance } = useContracts();
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const prevBalancesRef = useRef({});

  // Account names mapped to addresses
  // Try to get addresses from dCDP contract, fallback to constants
  const [accountAddresses, setAccountAddresses] = useState({
    AP: ACCOUNTS.AP,
    THOMAS: ACCOUNTS.THOMAS,
  });

  // Function to resolve addresses (extracted for reuse)
  const resolveAddresses = useCallback(async () => {
    if (!contracts.dcdp) return;

    try {
      const addresses = {};
      
      // Try to get AP address from contract
      try {
        const apAddress = await contracts.dcdp.getAddress('AP');
        if (apAddress && apAddress !== '0x0000000000000000000000000000000000000000') {
          addresses.AP = apAddress;
        } else {
          addresses.AP = ACCOUNTS.AP;
        }
      } catch (e) {
        addresses.AP = ACCOUNTS.AP;
      }

      // Try to get THOMAS address from contract
      try {
        const thomasAddress = await contracts.dcdp.getAddress('THOMAS');
        if (thomasAddress && thomasAddress !== '0x0000000000000000000000000000000000000000') {
          addresses.THOMAS = thomasAddress;
        } else {
          addresses.THOMAS = ACCOUNTS.THOMAS;
        }
      } catch (e) {
        addresses.THOMAS = ACCOUNTS.THOMAS;
      }

      setAccountAddresses(addresses);
    } catch (err) {
      console.error('Error resolving addresses:', err);
      setAccountAddresses({
        AP: ACCOUNTS.AP,
        THOMAS: ACCOUNTS.THOMAS,
      });
    }
  }, [contracts.dcdp]);

  // Try to resolve owner IDs to addresses via dCDP contract
  useEffect(() => {
    resolveAddresses();
  }, [contracts.dcdp, resolveAddresses]);

  // Load balances for all accounts
  const loadBalances = useCallback(async () => {
    if (!isReady) return;

    try {
      const newBalances = {};

      // Always check for wallets in the contract, even if not in accountAddresses
      // This ensures wallets are shown if they were created
      const accountsToCheck = { ...accountAddresses };
      
      // Always check both AP and THOMAS wallets from contract
      // This ensures wallets are always shown even if they have zero balances
      if (contracts.dcdp) {
        // Check AP's wallet
        try {
          const apAddress = await contracts.dcdp.getAddress('AP');
          if (apAddress && apAddress !== '0x0000000000000000000000000000000000000000') {
            accountsToCheck.AP = apAddress;
          } else {
            accountsToCheck.AP = ACCOUNTS.AP;
          }
        } catch (e) {
          accountsToCheck.AP = ACCOUNTS.AP;
        }
        
        // Check THOMAS's wallet
        try {
          const thomasAddress = await contracts.dcdp.getAddress('THOMAS');
          if (thomasAddress && thomasAddress !== '0x0000000000000000000000000000000000000000') {
            accountsToCheck.THOMAS = thomasAddress;
          } else {
            accountsToCheck.THOMAS = ACCOUNTS.THOMAS;
          }
        } catch (e) {
          accountsToCheck.THOMAS = ACCOUNTS.THOMAS;
        }
      } else {
        // If contract not ready, use default addresses
        accountsToCheck.AP = ACCOUNTS.AP;
        accountsToCheck.THOMAS = ACCOUNTS.THOMAS;
      }

      // Load balances for each account
      // Only include accounts that have valid addresses (not zero address)
      for (const [accountName, address] of Object.entries(accountsToCheck)) {
        if (!address || address === '0x0000000000000000000000000000000000000000') {
          continue; // Skip placeholder addresses
        }

        try {
          const [sgdcBalance, tes3Balance] = await Promise.all([
            getBalance('sgdc', address),
            getBalance('tes3', address),
          ]);

          // Always include accounts with valid addresses, even if balances are zero
          newBalances[accountName] = {
            address,
            sgdc: formatTokenAmount(sgdcBalance),
            tes3: formatTokenAmount(tes3Balance),
          };
        } catch (err) {
          console.error(`Failed to load balances for ${accountName}:`, err);
          // Even if balance loading fails, include the account if it has an address
          // This ensures accounts with wallets are shown
          if (address && address !== '0x0000000000000000000000000000000000000000') {
            newBalances[accountName] = {
              address,
              sgdc: '0',
              tes3: '0',
            };
          }
        }
      }

      // Track previous balances to detect new accounts
      // Note: We update prevBalancesRef after setBalances, not before, to avoid dependency issues
      setBalances(newBalances);
      prevBalancesRef.current = newBalances;
      setError(null);
    } catch (err) {
      console.error('Error loading dCDP balances:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isReady, accountAddresses, contracts.dcdp, getBalance]);

  // Use refs to store the latest callback functions without causing re-renders
  // This prevents the event listener useEffect from re-running when callbacks change
  // Initialize refs with the current functions
  const loadBalancesRef = useRef(loadBalances);
  const resolveAddressesRef = useRef(resolveAddresses);

  // Update refs when callbacks change (but don't trigger useEffect re-run)
  // This ensures intervals and event listeners always call the latest version of the functions
  useEffect(() => {
    loadBalancesRef.current = loadBalances;
  }, [loadBalances]);

  useEffect(() => {
    resolveAddressesRef.current = resolveAddresses;
  }, [resolveAddresses]);

  // Load balances when contracts are ready
  // Use refs to avoid dependency loop - don't include resolveAddresses/loadBalances in deps
  useEffect(() => {
    if (isReady) {
      // Initial load - resolve addresses first, then load balances
      resolveAddressesRef.current().then(() => {
        loadBalancesRef.current();
      });

      // Set up polling to refresh balances periodically
      // Use refs to prevent this effect from re-running when callbacks change
      const interval = setInterval(() => {
        resolveAddressesRef.current().then(() => {
          loadBalancesRef.current();
        });
      }, 3000); // Refresh every 3 seconds

      return () => clearInterval(interval);
    }
  }, [isReady]); // Only depend on isReady, not on the callback functions

  // Debounce timer ref to prevent multiple rapid updates
  // This needs to be outside useEffect so cleanup can access it
  const debounceTimerRef = useRef(null);

  // Listen to Transfer events and WalletCreated events for real-time updates
  // Use refs for callbacks to prevent infinite loops when callbacks change
  // Add debouncing to prevent excessive updates during rapid transactions
  useEffect(() => {
    if (!isReady || !contracts.sgdc || !contracts.tes3 || !contracts.dcdp) return;

    const handleTransfer = () => {
      // Clear any pending updates
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Debounce balance refresh to prevent excessive updates during rapid transactions
      // Use ref to get latest function without dependency on it
      debounceTimerRef.current = setTimeout(() => {
        loadBalancesRef.current();
        debounceTimerRef.current = null;
      }, 1000); // 1 second debounce to prevent UI freezing
    };

    const handleWalletCreated = () => {
      // Clear any pending updates
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Immediately refresh addresses and balances when wallet is created
      // Use refs to get latest functions without dependency on them
      debounceTimerRef.current = setTimeout(() => {
        resolveAddressesRef.current();
        loadBalancesRef.current();
        debounceTimerRef.current = null;
      }, 500);
    };

    // Listen to SGDC transfers
    contracts.sgdc.on('Transfer', handleTransfer);
    
    // Listen to TES3 transfers
    contracts.tes3.on('Transfer', handleTransfer);
    
    // Listen to WalletCreated events from dCDP
    contracts.dcdp.on('WalletCreated', handleWalletCreated);

    return () => {
      // Clear any pending debounced updates
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      
      // Remove event listeners
      contracts.sgdc.off('Transfer', handleTransfer);
      contracts.tes3.off('Transfer', handleTransfer);
      contracts.dcdp.off('WalletCreated', handleWalletCreated);
    };
  }, [isReady, contracts]); // Removed resolveAddresses and loadBalances from dependencies

  // Render account balances with animation
  const renderAccount = (accountName, accountData) => {
    const { address, sgdc, tes3 } = accountData || {};
    
    // Always show accounts that have addresses (even with zero balances)
    // This ensures wallets created via createWallet() are always visible
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    
    const hasHoldings = parseFloat(sgdc) > 0 || parseFloat(tes3) > 0;

    // Check if this is a newly added account
    const isNew = !prevBalancesRef.current[accountName] && balances[accountName];

    return (
      <motion.div
        key={accountName}
        className="dcdp-account"
        initial={isNew ? { opacity: 0, scale: 0.9, y: -10 } : false}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileHover={{ scale: 1.02 }}
      >
        <div className="dcdp-account-header">
          <span className="dcdp-account-name">{accountName}</span>
          {address && (
            <span className="dcdp-address">
              [{shortenAddress(address, ADDRESS_SHORT_LENGTH)}]
            </span>
          )}
        </div>
        <div className="dcdp-holdings">
          {parseFloat(tes3) > 0 && (
            <div className="dcdp-holding">
              <span className="dcdp-symbol">TES3:</span>
              <span className="dcdp-quantity">{parseFloat(tes3).toLocaleString()}</span>
            </div>
          )}
          {parseFloat(sgdc) > 0 && (
            <div className="dcdp-holding">
              <span className="dcdp-symbol">SGDC:</span>
              <span className="dcdp-quantity">{parseFloat(sgdc).toLocaleString()}</span>
            </div>
          )}
          {!hasHoldings && (
            <div className="dcdp-empty">No holdings</div>
          )}
        </div>
      </motion.div>
    );
  };

  if (loading && Object.keys(balances).length === 0) {
    return (
      <div className="dcdp-registry">
        <div className="dcdp-registry-header">
          <img 
            src={`${LOGO_BASE_PATH}dcdp-logo.png`} 
            alt="dCDP" 
            className="dcdp-registry-logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h3>dCDP Registry</h3>
        </div>
        <div className="dcdp-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dcdp-registry">
      <div className="dcdp-registry-header">
        <img 
          src={`${LOGO_BASE_PATH}dcdp-logo.png`} 
          alt="dCDP" 
          className="dcdp-registry-logo"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <h3>dCDP Registry</h3>
      </div>
      <div className="dcdp-registry-content">
        <AnimatePresence>
          {Object.entries(balances).map(([accountName, accountData]) => (
            renderAccount(accountName, accountData)
          ))}
        </AnimatePresence>
        {Object.keys(balances).length === 0 && !loading && (
          <div className="dcdp-empty-message">
            No accounts found. Connect to blockchain or wait for wallet creation.
          </div>
        )}
      </div>
      {error && <div className="dcdp-error">Error: {error}</div>}
    </div>
  );
}

export default DCDPRegistry;

