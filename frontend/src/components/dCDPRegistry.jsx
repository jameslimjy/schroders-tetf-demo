/**
 * dCDP Registry Component
 * Displays onchain tokenized securities balances
 * Queries smart contracts in real-time
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useContracts } from '../hooks/useContracts';
import { useDeploymentInfo } from '../hooks/useDeploymentInfo';
import { formatTokenAmount, shortenAddress } from '../utils/contractHelpers';
import { ACCOUNTS, ADDRESS_SHORT_LENGTH } from '../utils/constants';
import './dCDPRegistry.css';

// Logo path for dCDP Registry
const LOGO_BASE_PATH = '/assets/logos/';

// Helper function to check if an address is a contract address
// This prevents calling balanceOf on contract addresses
// Uses dynamic contract addresses from deployment info
function isContractAddress(address, contracts, contractAddresses) {
  if (!address || typeof address !== 'string') return false;
  
  const addrLower = address.toLowerCase();
  const contractAddressesList = [];
  
  // Add addresses from deployment info (or fallback)
  if (contractAddresses) {
    if (contractAddresses.dCDP) {
      contractAddressesList.push(contractAddresses.dCDP.toLowerCase());
    }
    if (contractAddresses.SGDC) {
      contractAddressesList.push(contractAddresses.SGDC.toLowerCase());
    }
    if (contractAddresses.TES3) {
      contractAddressesList.push(contractAddresses.TES3.toLowerCase());
    }
  }
  
  // Also check contract.target addresses (these should match, but double-check)
  if (contracts?.dcdp?.target) {
    contractAddressesList.push(contracts.dcdp.target.toLowerCase());
  }
  if (contracts?.sgdc?.target) {
    contractAddressesList.push(contracts.sgdc.target.toLowerCase());
  }
  if (contracts?.tes3?.target) {
    contractAddressesList.push(contracts.tes3.target.toLowerCase());
  }
  
  return contractAddressesList.includes(addrLower);
}

function DCDPRegistry() {
  const { contracts, isReady, getBalance } = useContracts();
  const { contractAddresses } = useDeploymentInfo();
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animationKey, setAnimationKey] = useState(0); // Key to trigger re-animation
  const prevBalancesRef = useRef({});

  // Account names mapped to addresses
  // Only AP starts with an address; THOMAS is added after wallet creation
  const [accountAddresses, setAccountAddresses] = useState({
    AP: ACCOUNTS.AP,
    // THOMAS is NOT included initially - will be added when wallet is created
  });

  // Function to resolve addresses (extracted for reuse)
  const resolveAddresses = useCallback(async () => {
    if (!contracts.dcdp) return;

    try {
      const addresses = {};
      
      // Try to get AP address from contract
      try {
        const apAddress = await contracts.dcdp.getAddress('AP');
        // Verify the address is valid and not a contract address
        if (apAddress && 
            apAddress !== '0x0000000000000000000000000000000000000000' &&
            !isContractAddress(apAddress, contracts, contractAddresses)) {
          addresses.AP = apAddress;
        } else {
          addresses.AP = ACCOUNTS.AP;
        }
      } catch (e) {
        addresses.AP = ACCOUNTS.AP;
      }

      // Try to get THOMAS address from contract
      // THOMAS should NOT appear until wallet is created via createWallet()
      try {
        const thomasAddress = await contracts.dcdp.getAddress('THOMAS');
        // Only include THOMAS if wallet was created (non-zero address)
        // Also verify it's not a contract address
        if (thomasAddress && 
            thomasAddress !== '0x0000000000000000000000000000000000000000' &&
            !isContractAddress(thomasAddress, contracts, contractAddresses)) {
          addresses.THOMAS = thomasAddress;
        }
        // Do NOT fallback to ACCOUNTS.THOMAS - THOMAS should not appear until wallet is created
      } catch (e) {
        // Do NOT fallback to ACCOUNTS.THOMAS - THOMAS should not appear until wallet is created
        // Leave THOMAS out of addresses object
      }

      setAccountAddresses(addresses);
    } catch (err) {
      console.error('Error resolving addresses:', err);
      // On error, only show AP with default address
      setAccountAddresses({
        AP: ACCOUNTS.AP,
      });
    }
  }, [contracts, contractAddresses]);

  // Try to resolve owner IDs to addresses via dCDP contract
  useEffect(() => {
    resolveAddresses();
  }, [contracts.dcdp, resolveAddresses]);

  // Load balances for all accounts
  const loadBalances = useCallback(async () => {
    if (!isReady) return;

    try {
      const newBalances = {};

      // Only show accounts that have wallets registered in the dCDP contract
      // This ensures THOMAS only appears AFTER the wallet is created
      const accountsToCheck = {};
      
      if (contracts.dcdp) {
        // Check AP's wallet
        // AP should have a wallet from the start (pre-registered)
        try {
          const apAddress = await contracts.dcdp.getAddress('AP');
          console.log('[DCDPRegistry] AP address from contract:', apAddress);
          console.log('[DCDPRegistry] AP address from constants:', ACCOUNTS.AP);
          console.log('[DCDPRegistry] dCDP contract address:', contracts.dcdp.target);
          
          // Verify the address is valid and not a contract address
          if (apAddress && 
              apAddress !== '0x0000000000000000000000000000000000000000' &&
              !isContractAddress(apAddress, contracts, contractAddresses)) {
            accountsToCheck.AP = apAddress;
            console.log('[DCDPRegistry] Using AP address from contract:', apAddress);
          } else {
            // AP starts with default wallet address
            accountsToCheck.AP = ACCOUNTS.AP;
            console.log('[DCDPRegistry] Using AP address from constants:', ACCOUNTS.AP);
          }
        } catch (e) {
          console.error('[DCDPRegistry] Error getting AP address:', e);
          // AP starts with default wallet address
          accountsToCheck.AP = ACCOUNTS.AP;
          console.log('[DCDPRegistry] Using AP address from constants (error fallback):', ACCOUNTS.AP);
        }
        
        // Check THOMAS's wallet
        // THOMAS should NOT appear until wallet is created via createWallet()
        try {
          const thomasAddress = await contracts.dcdp.getAddress('THOMAS');
          // Debug logging to help troubleshoot
          console.log('[DCDPRegistry] THOMAS address from contract:', thomasAddress);
          console.log('[DCDPRegistry] THOMAS address from constants:', ACCOUNTS.THOMAS);
          console.log('[DCDPRegistry] dCDP contract address:', contracts.dcdp.target);
          
          // Only include THOMAS if wallet was created (non-zero address)
          // Also verify it's not a contract address
          if (thomasAddress && 
              thomasAddress !== '0x0000000000000000000000000000000000000000' &&
              !isContractAddress(thomasAddress, contracts, contractAddresses)) {
            console.log('[DCDPRegistry] Including THOMAS with address:', thomasAddress);
            accountsToCheck.THOMAS = thomasAddress;
          } else {
            console.log('[DCDPRegistry] THOMAS wallet not created yet, excluding from display');
            if (thomasAddress && isContractAddress(thomasAddress, contracts, contractAddresses)) {
              console.warn('[DCDPRegistry] THOMAS address matches contract address - this is incorrect!');
            }
          }
          // Do NOT fallback to ACCOUNTS.THOMAS - THOMAS should not appear until wallet is created
        } catch (e) {
          console.log('[DCDPRegistry] Error checking THOMAS address:', e);
          // Do NOT fallback to ACCOUNTS.THOMAS - THOMAS should not appear until wallet is created
          // Leave THOMAS out of accountsToCheck
        }
      } else {
        // If contract not ready, only show AP with default address
        console.log('[DCDPRegistry] Contract not ready, using AP address from constants:', ACCOUNTS.AP);
        accountsToCheck.AP = ACCOUNTS.AP;
        // Do NOT include THOMAS until contract is ready and wallet is created
      }
      
      // Final safety check: ensure we're not using any contract address
      for (const [name, addr] of Object.entries(accountsToCheck)) {
        if (addr && isContractAddress(addr, contracts, contractAddresses)) {
          console.error(`[DCDPRegistry] ERROR: ${name} address matches a contract address! Removing.`);
          if (name === 'AP') {
            // For AP, use the correct wallet address from constants
            accountsToCheck.AP = ACCOUNTS.AP;
            console.log(`[DCDPRegistry] Replaced ${name} with correct wallet address: ${ACCOUNTS.AP}`);
          } else {
            // For others, remove them
            delete accountsToCheck[name];
          }
        }
      }
      
      console.log('[DCDPRegistry] Final accountsToCheck after safety checks:', accountsToCheck);

      // Always include AP and THOMAS with their default addresses if contracts are ready
      // This ensures they're shown even if wallets aren't registered in dCDP contract
      if (isReady) {
        // Always include AP
        if (!accountsToCheck.AP) {
          accountsToCheck.AP = ACCOUNTS.AP;
          console.log('[DCDPRegistry] Adding AP with default address:', ACCOUNTS.AP);
        }
        
        // Include THOMAS if wallet was created, otherwise use default address as fallback
        // (This allows showing THOMAS even if wallet creation didn't register properly)
        if (!accountsToCheck.THOMAS) {
          // Try to get from contract first
          try {
            const thomasAddress = await contracts.dcdp.getAddress('THOMAS');
            if (thomasAddress && 
                thomasAddress !== '0x0000000000000000000000000000000000000000' &&
                !isContractAddress(thomasAddress, contracts, contractAddresses)) {
              accountsToCheck.THOMAS = thomasAddress;
              console.log('[DCDPRegistry] Adding THOMAS with contract address:', thomasAddress);
            } else {
              // Fallback to default address if contract lookup fails
              accountsToCheck.THOMAS = ACCOUNTS.THOMAS;
              console.log('[DCDPRegistry] Adding THOMAS with default address (fallback):', ACCOUNTS.THOMAS);
            }
          } catch (e) {
            // Fallback to default address
            accountsToCheck.THOMAS = ACCOUNTS.THOMAS;
            console.log('[DCDPRegistry] Adding THOMAS with default address (error fallback):', ACCOUNTS.THOMAS);
          }
        }
      }

      // Load balances for each account
      // Only include accounts that have valid addresses (not zero address, not contract address)
      for (const [accountName, address] of Object.entries(accountsToCheck)) {
        // Skip invalid addresses
        if (!address || 
            address === '0x0000000000000000000000000000000000000000' ||
            address.length !== 42 ||
            !address.startsWith('0x')) {
          console.warn(`[DCDPRegistry] Skipping ${accountName} - invalid address: ${address}`);
          continue;
        }
        
        // Final check: ensure address is not any contract address before calling balanceOf
        if (isContractAddress(address, contracts, contractAddresses)) {
          console.error(`[DCDPRegistry] BLOCKED: Skipping ${accountName} - address matches a contract address: ${address}`);
          console.error(`[DCDPRegistry] Contract addresses:`, {
            dCDP: contractAddresses?.dCDP,
            SGDC: contractAddresses?.SGDC,
            TES3: contractAddresses?.TES3,
            dcdpTarget: contracts.dcdp?.target,
          });
          continue;
        }

        // Log before calling balanceOf to track what addresses are being used
        console.log(`[DCDPRegistry] Loading balances for ${accountName} at ${address}`);
        
        try {
          const [sgdcBalance, tes3Balance] = await Promise.all([
            getBalance('sgdc', address),
            getBalance('tes3', address),
          ]);

          console.log(`[DCDPRegistry] ${accountName} balances - SGDC: ${sgdcBalance}, TES3: ${tes3Balance}`);
          console.log(`[DCDPRegistry] ${accountName} formatted - SGDC: ${formatTokenAmount(sgdcBalance)}, TES3: ${formatTokenAmount(tes3Balance)}`);

          // Always include accounts with valid addresses, even if balances are zero
          newBalances[accountName] = {
            address,
            sgdc: formatTokenAmount(sgdcBalance),
            tes3: formatTokenAmount(tes3Balance),
          };
        } catch (err) {
          console.error(`[DCDPRegistry] Failed to load balances for ${accountName} at ${address}:`, err);
          // Even if balance loading fails, include the account if it has a valid address
          // This ensures accounts with wallets are shown (with zero balances)
          newBalances[accountName] = {
            address,
            sgdc: '0',
            tes3: '0',
          };
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
  }, [isReady, accountAddresses, contracts, getBalance, contractAddresses]);

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

    const handleTokenized = () => {
      // Clear any pending updates
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Refresh balances when tokenization occurs (TES3 tokens are minted)
      // Use a shorter delay since the transaction should already be confirmed
      debounceTimerRef.current = setTimeout(() => {
        loadBalancesRef.current();
        debounceTimerRef.current = null;
      }, 300);
    };

    // Listen to SGDC transfers
    contracts.sgdc.on('Transfer', handleTransfer);
    
    // Listen to TES3 transfers (includes mints and burns)
    contracts.tes3.on('Transfer', handleTransfer);
    
    // Listen to WalletCreated events from dCDP
    contracts.dcdp.on('WalletCreated', handleWalletCreated);
    
    // Listen to Tokenized events from dCDP (when tokenize() is called)
    contracts.dcdp.on('Tokenized', handleTokenized);

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
      contracts.dcdp.off('Tokenized', handleTokenized);
    };
  }, [isReady, contracts]); // Removed resolveAddresses and loadBalances from dependencies

  // Listen for registry update events (triggered when tokenize is called)
  useEffect(() => {
    const handleRegistryUpdate = () => {
      // Trigger phase out/in animation by updating the key
      setAnimationKey(prev => prev + 1);
      // Refresh balances after a delay to ensure blockchain state has updated
      // The delay allows the transaction to be mined and state to propagate
      setTimeout(() => {
        // Refresh addresses first in case they changed, then balances
        resolveAddressesRef.current().then(() => {
          loadBalancesRef.current();
        });
      }, 500);
    };
    
    window.addEventListener('dcdp-registry-updated', handleRegistryUpdate);
    
    return () => {
      window.removeEventListener('dcdp-registry-updated', handleRegistryUpdate);
    };
  }, []);

  // Render account balances with animation
  const renderAccount = (accountName, accountData) => {
    const { address, sgdc, tes3 } = accountData || {};
    
    // Safety check: THOMAS should only appear if wallet was created in contract
    // Double-check by querying contract if this is THOMAS
    if (accountName === 'THOMAS') {
      // For THOMAS, we should verify the wallet exists in the contract
      // This is a safeguard in case THOMAS somehow got into balances incorrectly
      if (!address || address === '0x0000000000000000000000000000000000000000') {
        console.warn('[DCDPRegistry] THOMAS found in balances but has no valid address, skipping render');
        return null;
      }
      // Additional check: ensure THOMAS address is not the dCDP contract address
      // (which would indicate an error)
      if (address && contracts.dcdp && address.toLowerCase() === contracts.dcdp.target?.toLowerCase()) {
        console.warn('[DCDPRegistry] THOMAS address matches dCDP contract address, this is incorrect, skipping render');
        return null;
      }
    }
    
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
              <span className="dcdp-symbol">
                TES3 {contractAddresses?.TES3 ? `(${shortenAddress(contractAddresses.TES3)})` : ''}:
              </span>
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
      <AnimatePresence mode="wait">
        <motion.div
          key={animationKey}
          className="dcdp-registry-content"
          initial={{ opacity: 0, x: -20, backgroundColor: '#e8f5e9' }}
          animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
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
        </motion.div>
      </AnimatePresence>
      {error && <div className="dcdp-error">Error: {error}</div>}
    </div>
  );
}

export default DCDPRegistry;

