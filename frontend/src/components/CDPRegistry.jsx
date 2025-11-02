/**
 * CDP Registry Component
 * Displays offchain traditional securities balances from CDP registry
 * Reads from JSON file or API endpoint
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CDP_REGISTRY_API } from '../utils/constants';
import './CDPRegistry.css';

// Logo path for CDP Registry
const LOGO_BASE_PATH = '/assets/logos/';

// Stock symbol to name mapping
// This maps Singapore stock symbols to their company names
// Common Singapore stock symbols and their corresponding company names
const STOCK_NAMES = {
  'D05': 'DBS Group Holdings Ltd',
  'O39': 'Overseas-Chinese Banking Corporation Ltd',
  'U11': 'United Overseas Bank Ltd',
  'Z74': 'Singapore Telecommunications Ltd',
  'C52': 'CapitaLand Investment Ltd',
  'C31': 'CapitaLand Mall Trust',
  'C09': 'City Developments Ltd',
  'G13': 'Global Investments Ltd',
  'BN4': 'Keppel Corporation Ltd',
  'S68': 'Singapore Exchange Ltd',
  'N2IU': 'NetLink NBN Trust',
  'U96': 'Sembcorp Industries Ltd',
  'V03': 'Venture Corporation Ltd',
  'S58': 'SATS Ltd',
  'Y92': 'Yangzijiang Shipbuilding Holdings Ltd',
  'ME8U': 'Mapletree Industrial Trust',
  'M44U': 'Mapletree Logistics Trust',
  'A17U': 'Ascendas Real Estate Investment Trust',
  'J36': 'Jardine Matheson Holdings Ltd',
  'C38U': 'CapitaLand Integrated Commercial Trust',
  'S63': 'Singapore Technologies Engineering Ltd',
  'BS6': 'BS6 Holdings Ltd',
  'F34': 'F34 Holdings Ltd',
  'BN2': 'BN2 Holdings Ltd',
  'H78': 'H78 Holdings Ltd',
  'N21': 'N21 Holdings Ltd',
  'S51': 'S51 Holdings Ltd',
  'AWX': 'AWX Holdings Ltd',
  'D01': 'D01 Holdings Ltd',
  'S59': 'S59 Holdings Ltd',
  'ES3': 'SPDR Straits Times Index ETF'
};

// Function to get stock name from symbol, returns symbol if not found
function getStockName(symbol) {
  return STOCK_NAMES[symbol] || symbol;
}

function CDPRegistry() {
  const [registryData, setRegistryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animationKey, setAnimationKey] = useState(0); // Key to trigger re-animation

  // Load CDP registry data
  // Priority: localStorage (for client-side updates) > API endpoint (static file)
  useEffect(() => {
    async function loadRegistry() {
      try {
        let data;
        
        // First, check localStorage for updated registry (from ETF creation, etc.)
        const storedRegistry = localStorage.getItem('cdp-registry');
        if (storedRegistry) {
          try {
            data = JSON.parse(storedRegistry);
            setRegistryData(data);
            setError(null);
            setLoading(false);
            return; // Use stored data, don't fetch from API
          } catch (e) {
            console.warn('Failed to parse stored registry, fetching from API');
            // If parsing fails, continue to fetch from API
          }
        }
        
        // If no stored registry or parsing failed, fetch from public API endpoint
        // Note: In browser, we can only access files in the public directory
        const response = await fetch(CDP_REGISTRY_API);
        
        if (!response.ok) {
          throw new Error(`Failed to load CDP registry: ${response.status} ${response.statusText}`);
        }
        
        // Check if response is actually JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON - received HTML error page instead');
        }
        
        data = await response.json();
        setRegistryData(data);
        setError(null);
        
        // Initialize localStorage with fetched data if it doesn't exist
        // This ensures consistency for subsequent operations
        if (!localStorage.getItem('cdp-registry')) {
          localStorage.setItem('cdp-registry', JSON.stringify(data));
        }
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

    // Listen for registry update events (triggered when ETF is created)
    const handleRegistryUpdate = () => {
      // Trigger phase out/in animation by updating the key
      setAnimationKey(prev => prev + 1);
      loadRegistry();
    };
    window.addEventListener('cdp-registry-updated', handleRegistryUpdate);

    // Set up polling to refresh data periodically (fallback)
    const interval = setInterval(loadRegistry, 5000); // Refresh every 5 seconds

    return () => {
      clearInterval(interval);
      window.removeEventListener('cdp-registry-updated', handleRegistryUpdate);
    };
  }, []);

  // Render account balances
  const renderAccount = (accountId, accountData, uniqueId) => {
    const { stocks = {}, etfs = {} } = accountData || {};
    
    // Combine stocks and ETFs for display, but sort to show ETFs first
    // Create separate arrays for ETFs and stocks, then combine
    const etfEntries = Object.entries(etfs || {}).filter(([_, value]) => value > 0);
    const stockEntries = Object.entries(stocks || {}).filter(([_, value]) => value > 0);
    
    // Sort ETFs first, then stocks
    const holdingsEntries = [...etfEntries, ...stockEntries];

    if (holdingsEntries.length === 0) {
      return (
        <div key={accountId} className="cdp-account">
          <div className="cdp-account-name">
            {accountId} {uniqueId && <span className="cdp-unique-id">({uniqueId})</span>}:
          </div>
          <div className="cdp-empty">No holdings</div>
        </div>
      );
    }

    return (
      <div key={accountId} className="cdp-account">
        <div className="cdp-account-name">
          {accountId} {uniqueId && <span className="cdp-unique-id">({uniqueId})</span>}:
        </div>
        <div className="cdp-holdings">
          {holdingsEntries.map(([symbol, quantity]) => (
            <div key={symbol} className="cdp-holding">
              <span className="cdp-symbol">{symbol} ({getStockName(symbol)}):</span>
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
        <div className="cdp-registry-header">
          <img 
            src={`${LOGO_BASE_PATH}cdp-logo.png`} 
            alt="CDP" 
            className="cdp-registry-logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        <h3>CDP Registry</h3>
        </div>
        <div className="cdp-loading">Loading...</div>
      </div>
    );
  }

  if (error && !registryData) {
    return (
      <div className="cdp-registry">
        <div className="cdp-registry-header">
          <img 
            src={`${LOGO_BASE_PATH}cdp-logo.png`} 
            alt="CDP" 
            className="cdp-registry-logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        <h3>CDP Registry</h3>
        </div>
        <div className="cdp-error">Error: {error}</div>
      </div>
    );
  }

  const accounts = registryData?.accounts || {};
  const ownerIds = registryData?.owner_ids || {};

  // Sort accounts to display THOMAS before AP
  // Define the desired display order
  const accountOrder = ['THOMAS', 'AP'];
  const sortedAccounts = Object.entries(accounts).sort(([idA], [idB]) => {
    const indexA = accountOrder.indexOf(idA);
    const indexB = accountOrder.indexOf(idB);
    // If both are in the order list, sort by their position
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    // If only one is in the list, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    // If neither is in the list, maintain original order
    return 0;
  });

  return (
    <div className="cdp-registry">
      <div className="cdp-registry-header">
        <img 
          src={`${LOGO_BASE_PATH}cdp-logo.png`} 
          alt="CDP" 
          className="cdp-registry-logo"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      <h3>CDP Registry</h3>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={animationKey}
          className="cdp-registry-content"
          initial={{ opacity: 0, x: -20, backgroundColor: '#e8f5e9' }}
          animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {sortedAccounts.map(([accountId, accountData]) => {
            const uniqueId = ownerIds[accountId];
            return renderAccount(accountId, accountData, uniqueId);
          })}
        </motion.div>
      </AnimatePresence>
      {error && <div className="cdp-warning">Warning: {error}</div>}
    </div>
  );
}

export default CDPRegistry;

