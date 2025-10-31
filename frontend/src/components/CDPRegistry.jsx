/**
 * CDP Registry Component
 * Displays offchain traditional securities balances from CDP registry
 * Reads from JSON file or API endpoint
 */

import React, { useState, useEffect } from 'react';
import { CDP_REGISTRY_API } from '../utils/constants';
import './CDPRegistry.css';

function CDPRegistry() {
  const [registryData, setRegistryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load CDP registry data
  useEffect(() => {
    async function loadRegistry() {
      try {
        // Try to fetch from backend/data directory first
        // Fallback to public/api if backend not accessible
        let response;
        try {
          // Try backend path (may not work in browser, but worth trying)
          response = await fetch('../../backend/data/cdp-registry.json');
          if (!response.ok) throw new Error('Backend path failed');
        } catch (e) {
          // Fallback to public API endpoint
          response = await fetch(CDP_REGISTRY_API);
        }
        
        if (!response.ok) {
          throw new Error('Failed to load CDP registry');
        }
        
        const data = await response.json();
        setRegistryData(data);
        setError(null);
      } catch (err) {
        console.error('Error loading CDP registry:', err);
        setError(err.message);
        
        // Set empty placeholder data if loading fails
        setRegistryData({
          accounts: {
            AP: { stocks: {}, etfs: {} },
            THOMAS: { stocks: {}, etfs: {} },
          },
        });
      } finally {
        setLoading(false);
      }
    }

    loadRegistry();

    // Set up polling to refresh data periodically
    const interval = setInterval(loadRegistry, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Render account balances
  const renderAccount = (accountId, accountData) => {
    const { stocks = {}, etfs = {} } = accountData || {};
    
    // Combine stocks and ETFs for display
    const allHoldings = { ...stocks, ...etfs };
    const holdingsEntries = Object.entries(allHoldings).filter(([_, value]) => value > 0);

    if (holdingsEntries.length === 0) {
      return (
        <div key={accountId} className="cdp-account">
          <div className="cdp-account-name">{accountId}:</div>
          <div className="cdp-empty">No holdings</div>
        </div>
      );
    }

    return (
      <div key={accountId} className="cdp-account">
        <div className="cdp-account-name">{accountId}:</div>
        <div className="cdp-holdings">
          {holdingsEntries.map(([symbol, quantity]) => (
            <div key={symbol} className="cdp-holding">
              <span className="cdp-symbol">{symbol}:</span>
              <span className="cdp-quantity">{quantity.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="cdp-registry">
        <h3>CDP Registry</h3>
        <div className="cdp-loading">Loading...</div>
      </div>
    );
  }

  if (error && !registryData) {
    return (
      <div className="cdp-registry">
        <h3>CDP Registry</h3>
        <div className="cdp-error">Error: {error}</div>
      </div>
    );
  }

  const accounts = registryData?.accounts || {};

  return (
    <div className="cdp-registry">
      <h3>CDP Registry</h3>
      <div className="cdp-registry-content">
        {Object.entries(accounts).map(([accountId, accountData]) =>
          renderAccount(accountId, accountData)
        )}
      </div>
      {error && <div className="cdp-warning">Warning: {error}</div>}
    </div>
  );
}

export default CDPRegistry;

