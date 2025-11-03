/**
 * Tokenized Depository Registry Component
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

// Logo path for Tokenized Depository Registry
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
      // Try both getAddress() and ownerToAddress() (public mapping getter)
      try {
        // Try ownerToAddress first (public mapping getter - more reliable)
        let thomasAddress;
        try {
          thomasAddress = await contracts.dcdp.ownerToAddress('THOMAS');
        } catch (e1) {
          // Fallback to getAddress if ownerToAddress doesn't work
          try {
            thomasAddress = await contracts.dcdp.getAddress('THOMAS');
          } catch (e2) {
            console.error('[DCDPRegistry] resolveAddresses - Both ownerToAddress and getAddress failed:', e1, e2);
            throw e2;
          }
        }
        
        // Check if it's a contract address
        const isContractAddr = isContractAddress(thomasAddress, contracts, contractAddresses);
        
        // Only include THOMAS if wallet was created (non-zero address)
        // Also verify it's not a contract address
        // Check for null/undefined as well as zero address
        const isValidAddress = thomasAddress && 
            thomasAddress !== '0x0000000000000000000000000000000000000000' &&
            thomasAddress !== null &&
            thomasAddress !== undefined &&
            typeof thomasAddress === 'string' &&
            thomasAddress.length === 42;
            
        if (isValidAddress && !isContractAddr) {
          addresses.THOMAS = thomasAddress;
        } else {
          if (isContractAddr) {
            console.warn('[DCDPRegistry] resolveAddresses - THOMAS address matches contract address - wallet was NOT created successfully!');
            console.warn('[DCDPRegistry] resolveAddresses - This means createWallet() transaction may have failed or reverted');
          }
        }
        // Do NOT fallback to ACCOUNTS.THOMAS - THOMAS should not appear until wallet is created
      } catch (e) {
        console.error('[DCDPRegistry] resolveAddresses - Error getting THOMAS address:', e);
        // Do NOT fallback to ACCOUNTS.THOMAS - THOMAS should not appear until wallet is created
        // Leave THOMAS out of addresses object
      }

      setAccountAddresses(addresses);
      return addresses; // Return addresses for promise chain
    } catch (err) {
      console.error('Error resolving addresses:', err);
      // On error, only show AP with default address
      const fallbackAddresses = { AP: ACCOUNTS.AP };
      setAccountAddresses(fallbackAddresses);
      return fallbackAddresses;
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

      // Use accountAddresses state as the source of truth
      // This is updated by resolveAddresses() which listens to WalletCreated events
      // Start with the current accountAddresses state
      const accountsToCheck = { ...accountAddresses };
      
      // Also check contract directly to ensure we have the latest state
      // This helps catch cases where state might be stale
      if (contracts.dcdp) {
        // Check AP's wallet
        try {
          const apAddress = await contracts.dcdp.getAddress('AP');
          
          // Verify the address is valid and not a contract address
          if (apAddress && 
              apAddress !== '0x0000000000000000000000000000000000000000' &&
              !isContractAddress(apAddress, contracts, contractAddresses)) {
            accountsToCheck.AP = apAddress;
          } else if (!accountsToCheck.AP) {
            // AP starts with default wallet address if not already set
            accountsToCheck.AP = ACCOUNTS.AP;
          }
        } catch (e) {
          console.error('[DCDPRegistry] Error getting AP address:', e);
          if (!accountsToCheck.AP) {
            accountsToCheck.AP = ACCOUNTS.AP;
          }
        }
        
        // Check THOMAS's wallet - this is critical for detecting wallet creation
        // THOMAS should NOT appear until wallet is created via createWallet()
        // Use ownerToAddress (public mapping) which is more reliable
        try {
          let thomasAddress;
          try {
            thomasAddress = await contracts.dcdp.ownerToAddress('THOMAS');
          } catch (e1) {
            thomasAddress = await contracts.dcdp.getAddress('THOMAS');
          }
          
          const isContractAddr = isContractAddress(thomasAddress, contracts, contractAddresses);
          
          // Only include THOMAS if wallet was created (non-zero address)
          // Also verify it's not a contract address
          if (thomasAddress && 
              thomasAddress !== '0x0000000000000000000000000000000000000000' &&
              !isContractAddr) {
            accountsToCheck.THOMAS = thomasAddress;
          } else {
            // Remove THOMAS from accountsToCheck if it was there but wallet wasn't created
            delete accountsToCheck.THOMAS;
            if (isContractAddr) {
              console.warn('[DCDPRegistry] loadBalances - THOMAS address matches contract address - wallet was NOT created!');
            }
          }
        } catch (e) {
          console.error('[DCDPRegistry] loadBalances - Error checking THOMAS address:', e);
          // Remove THOMAS if there was an error checking
          delete accountsToCheck.THOMAS;
        }
      } else {
        // If contract not ready, only show AP with default address
        accountsToCheck.AP = ACCOUNTS.AP;
        delete accountsToCheck.THOMAS;
      }
      
      // Final safety check: ensure we're not using any contract address
      for (const [name, addr] of Object.entries(accountsToCheck)) {
        if (addr && isContractAddress(addr, contracts, contractAddresses)) {
          console.error(`[DCDPRegistry] ERROR: ${name} address matches a contract address! Removing.`);
          if (name === 'AP') {
            // For AP, use the correct wallet address from constants
            accountsToCheck.AP = ACCOUNTS.AP;
          } else {
            // For others, remove them
            delete accountsToCheck[name];
          }
        }
      }

      // Always include AP with default address if contracts are ready
      // AP should always be shown from the start
      if (isReady) {
        // Always include AP
        if (!accountsToCheck.AP) {
          accountsToCheck.AP = ACCOUNTS.AP;
        }
        
        // DO NOT include THOMAS unless wallet was created in the contract
        // THOMAS should only appear after createWallet() is called
        // The getAddress('THOMAS') check above already handles this correctly
        // No fallback - if wallet wasn't created, THOMAS won't appear
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
      // Update prevBalancesRef AFTER state update completes
      // Use setTimeout to ensure state has been set before updating ref
      setBalances(newBalances);
      setTimeout(() => {
        prevBalancesRef.current = newBalances;
      }, 0);
      setError(null);
    } catch (err) {
      console.error('Error loading dCDP balances:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isReady, contracts, getBalance, contractAddresses, accountAddresses]);

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

    const handleTransfer = (from, to, amount, event) => {
      // Clear any pending updates
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Trigger animation first, then update balances during the animation
      // This creates a smoother effect where the balance updates mid-animation
      debounceTimerRef.current = setTimeout(() => {
        // Trigger animation key update first - this starts the phase out animation
        setAnimationKey(prev => prev + 1);
        
        // Wait for animation to start (phase out), then load balances mid-animation
        // The animation duration is ~0.5s, so we update balances at ~0.35s
        setTimeout(async () => {
          // Load balances mid-animation - this will cause the number to change during phase in
          await loadBalancesRef.current();
          debounceTimerRef.current = null;
        }, 350); // Update balances during animation
        
      }, 300); // Small delay to ensure transaction is confirmed
    };

    const handleWalletCreated = (ownerId, walletAddress, event) => {
      // Clear any pending updates
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Trigger animation key update to show phase in/out animation
      // This makes it obvious that a new account (THOMAS) has been added
      setAnimationKey(prev => prev + 1);
      
      // Immediately refresh addresses and balances when wallet is created
      // Use refs to get latest functions without dependency on them
      // Increase delay slightly to ensure blockchain state has propagated
      debounceTimerRef.current = setTimeout(async () => {
        await resolveAddressesRef.current();
        // Give a small delay for state to update before loading balances
        setTimeout(() => {
          loadBalancesRef.current();
        }, 100);
        debounceTimerRef.current = null;
      }, 800); // Increased delay to ensure transaction is fully mined
    };

    const handleTokenized = () => {
      // Clear any pending updates
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Refresh balances when tokenization occurs (TES3 tokens are minted)
      // Trigger animation first, then update balances during animation
      debounceTimerRef.current = setTimeout(() => {
        // Trigger animation first
        setAnimationKey(prev => prev + 1);
        
        // Update balances mid-animation
        setTimeout(async () => {
          await loadBalancesRef.current();
          debounceTimerRef.current = null;
        }, 350); // Update during animation
        
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
    
    window.addEventListener('tokenized-depository-registry-updated', handleRegistryUpdate);
    
    return () => {
      window.removeEventListener('tokenized-depository-registry-updated', handleRegistryUpdate);
    };
  }, []);

  // Copy contract address to clipboard
  const copyToClipboard = async (text, tokenName) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if desired
    } catch (err) {
      console.error(`[DCDPRegistry] Failed to copy ${tokenName} address:`, err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (fallbackErr) {
        console.error(`[DCDPRegistry] Fallback copy failed:`, fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

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
    // This detects when THOMAS first appears after wallet creation
    // Compare current balances with previous to detect new accounts
    const wasPreviouslyInBalances = prevBalancesRef.current && prevBalancesRef.current[accountName];
    const isCurrentlyInBalances = balances[accountName];
    const isNew = !wasPreviouslyInBalances && isCurrentlyInBalances;
    
    // Enhanced animation for new accounts (especially THOMAS)
    // More pronounced animation to make it obvious when a new account appears
    const animationProps = isNew ? {
      initial: { opacity: 0, scale: 0.8, y: -20, x: -10 },
      animate: { opacity: 1, scale: 1, y: 0, x: 0 },
      transition: { 
        duration: 0.6, 
        ease: "easeOut",
        type: "spring",
        stiffness: 200,
        damping: 15
      }
    } : {
      initial: false,
      animate: { opacity: 1, scale: 1, y: 0 },
      transition: { duration: 0.3 }
    };

    return (
      <motion.div
        key={`${accountName}-${animationKey}`}
        className="dcdp-account"
        initial={animationProps.initial}
        animate={animationProps.animate}
        transition={animationProps.transition}
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
              {contractAddresses?.TES3 && (
                <button
                  className="dcdp-clipboard-btn"
                  onClick={() => copyToClipboard(contractAddresses.TES3, 'TES3')}
                  title="Copy TES3 contract address to clipboard"
                  aria-label="Copy TES3 contract address"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              )}
              <span className="dcdp-symbol">
                TES3 {contractAddresses?.TES3 ? `(${shortenAddress(contractAddresses.TES3)})` : ''}:
              </span>
              <span className="dcdp-quantity">{parseFloat(tes3).toLocaleString()}</span>
            </div>
          )}
          {parseFloat(sgdc) > 0 && (
            <div className="dcdp-holding">
              {contractAddresses?.SGDC && (
                <button
                  className="dcdp-clipboard-btn"
                  onClick={() => copyToClipboard(contractAddresses.SGDC, 'SGDC')}
                  title="Copy SGDC contract address to clipboard"
                  aria-label="Copy SGDC contract address"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              )}
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
            alt="Tokenized Depository" 
            className="dcdp-registry-logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h3>Tokenized Depository Registry</h3>
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
          alt="Tokenized Depository" 
          className="dcdp-registry-logo"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <h3>Tokenized Depository Registry</h3>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={animationKey}
          className="dcdp-registry-content"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ backgroundColor: animationKey % 2 === 0 ? 'transparent' : '#e8f5e9' }}
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

