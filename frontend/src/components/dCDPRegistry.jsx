/**
 * dCDP Registry Component
 * Displays onchain tokenized securities balances
 * Queries smart contracts in real-time
 */

import React, { useState, useEffect } from 'react';
import { useContracts } from '../hooks/useContracts';
import { formatTokenAmount, shortenAddress } from '../utils/contractHelpers';
import { ACCOUNTS, ADDRESS_SHORT_LENGTH } from '../utils/constants';
import './dCDPRegistry.css';

function DCDPRegistry() {
  const { contracts, isReady, getBalance } = useContracts();
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Account names mapped to addresses
  // Try to get addresses from dCDP contract, fallback to constants
  const [accountAddresses, setAccountAddresses] = useState({
    AP: ACCOUNTS.AP,
    THOMAS: ACCOUNTS.THOMAS,
  });

  // Try to resolve owner IDs to addresses via dCDP contract
  useEffect(() => {
    async function resolveAddresses() {
      if (!contracts.dcdp) return;

      try {
        const addresses = { ...accountAddresses };
        
        // Try to get AP address from contract
        try {
          const apAddress = await contracts.dcdp.getAddress('AP');
          if (apAddress && apAddress !== '0x0000000000000000000000000000000000000000') {
            addresses.AP = apAddress;
          }
        } catch (e) {
          // Contract may not have AP registered yet
        }

        // Try to get THOMAS address from contract
        try {
          const thomasAddress = await contracts.dcdp.getAddress('THOMAS');
          if (thomasAddress && thomasAddress !== '0x0000000000000000000000000000000000000000') {
            addresses.THOMAS = thomasAddress;
          }
        } catch (e) {
          // Contract may not have THOMAS registered yet
        }

        setAccountAddresses(addresses);
      } catch (err) {
        console.error('Error resolving addresses:', err);
      }
    }

    resolveAddresses();
  }, [contracts.dcdp]);

  // Load balances for all accounts
  const loadBalances = async () => {
    if (!isReady) return;

    try {
      const newBalances = {};

      // Load balances for each account
      for (const [accountName, address] of Object.entries(accountAddresses)) {
        if (!address || address === '0x0000000000000000000000000000000000000000') {
          continue; // Skip placeholder addresses
        }

        try {
          const [sgdcBalance, tes3Balance] = await Promise.all([
            getBalance('sgdc', address),
            getBalance('tes3', address),
          ]);

          newBalances[accountName] = {
            address,
            sgdc: formatTokenAmount(sgdcBalance),
            tes3: formatTokenAmount(tes3Balance),
          };
        } catch (err) {
          console.error(`Failed to load balances for ${accountName}:`, err);
        }
      }

      setBalances(newBalances);
      setError(null);
    } catch (err) {
      console.error('Error loading dCDP balances:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load balances when contracts are ready
  useEffect(() => {
    if (isReady) {
      loadBalances();

      // Set up polling to refresh balances periodically
      const interval = setInterval(loadBalances, 3000); // Refresh every 3 seconds

      return () => clearInterval(interval);
    }
  }, [isReady, accountAddresses]);

  // Listen to Transfer events for real-time updates
  useEffect(() => {
    if (!isReady || !contracts.sgdc || !contracts.tes3) return;

    const handleTransfer = () => {
      // Refresh balances when transfer occurs
      setTimeout(loadBalances, 500);
    };

    // Listen to SGDC transfers
    contracts.sgdc.on('Transfer', handleTransfer);
    
    // Listen to TES3 transfers
    contracts.tes3.on('Transfer', handleTransfer);

    return () => {
      contracts.sgdc.off('Transfer', handleTransfer);
      contracts.tes3.off('Transfer', handleTransfer);
    };
  }, [isReady, contracts]);

  // Render account balances
  const renderAccount = (accountName, accountData) => {
    const { address, sgdc, tes3 } = accountData || {};
    
    // Filter out zero balances for cleaner display
    const hasHoldings = parseFloat(sgdc) > 0 || parseFloat(tes3) > 0;

    if (!hasHoldings && !address) {
      return null;
    }

    return (
      <div key={accountName} className="dcdp-account">
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
      </div>
    );
  };

  if (loading && Object.keys(balances).length === 0) {
    return (
      <div className="dcdp-registry">
        <h3>dCDP Registry</h3>
        <div className="dcdp-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dcdp-registry">
      <h3>dCDP Registry</h3>
      <div className="dcdp-registry-content">
        {Object.entries(balances).map(([accountName, accountData]) => (
          renderAccount(accountName, accountData)
        ))}
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

