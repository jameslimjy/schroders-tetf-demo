/**
 * Depository Registry Component
 * Displays offchain traditional securities balances from Depository registry
 * Reads from JSON file or API endpoint
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CDP_REGISTRY_API } from '../utils/constants';
import './CDPRegistry.css';

// Logo path for Depository Registry
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

// Function to format account name for display (capitalize first letter, rest lowercase)
// Keep "AP" as uppercase, convert others like "THOMAS" to "Thomas"
function formatAccountName(accountId) {
  if (!accountId) return accountId;
  // Keep AP as uppercase
  if (accountId.toUpperCase() === 'AP') {
    return 'AP';
  }
  // Capitalize first letter, lowercase the rest
  return accountId.charAt(0).toUpperCase() + accountId.slice(1).toLowerCase();
}

function CDPRegistry() {
  const [registryData, setRegistryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animationKey, setAnimationKey] = useState(0); // Key to trigger phase in/out animation
  const prevRegistryDataRef = useRef(null); // Track previous data to detect changes
  const isTokenizeInProgressRef = useRef(false); // Track if tokenize is in progress to prevent immediate refresh
  const isOnrampInProgressRef = useRef(false); // Track if onramp is in progress to prevent immediate refresh
  const isBuyInProgressRef = useRef(false); // Track if buy is in progress to prevent immediate refresh
  const isSellInProgressRef = useRef(false); // Track if sell is in progress to prevent immediate refresh
  const isRedeemInProgressRef = useRef(false); // Track if redeem is in progress to prevent immediate refresh

  // Load Depository registry data
  // Reads from localStorage first (if ETF creation has occurred), then falls back to API
  useEffect(() => {
    async function loadRegistry() {
      try {
        let data;
        
        // Check localStorage first - this contains the most up-to-date data after ETF creation
        // If ETF shares were created, the updated registry is stored in localStorage
        const storedRegistry = localStorage.getItem('cdp-registry');
        
        if (storedRegistry) {
          try {
            data = JSON.parse(storedRegistry);
          } catch (e) {
            console.warn('[DepositoryRegistry] Failed to parse stored registry, fetching from API');
            // If localStorage data is corrupted, fetch from API
            const response = await fetch(CDP_REGISTRY_API);
            
            if (!response.ok) {
              throw new Error(`Failed to load Depository registry: ${response.status} ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              throw new Error('Response is not JSON - received HTML error page instead');
            }
            
            data = await response.json();
          }
        } else {
          // No localStorage data, fetch from public API endpoint
          // Note: In browser, we can only access files in the public directory
          const response = await fetch(CDP_REGISTRY_API);
          
          if (!response.ok) {
            throw new Error(`Failed to load Depository registry: ${response.status} ${response.statusText}`);
          }
          
          // Check if response is actually JSON before parsing
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON - received HTML error page instead');
          }
          
          data = await response.json();
          
          // Sync localStorage with API data so future reads can use localStorage
          // This ensures consistency across page refreshes
          try {
            localStorage.setItem('cdp-registry', JSON.stringify(data));
          } catch (e) {
            console.warn('[DepositoryRegistry] Failed to store registry in localStorage:', e);
          }
        }
        
        // Track previous data to detect changes
        const prevData = prevRegistryDataRef.current;
        prevRegistryDataRef.current = data;
        
        setRegistryData(data);
        setError(null);
        
        // Trigger animation if data changed (not on initial load)
        if (prevData !== null && JSON.stringify(prevData) !== JSON.stringify(data)) {
          setAnimationKey(prev => prev + 1);
        }
      } catch (err) {
        console.error('Error loading Depository registry:', err);
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

    // Initial load
    loadRegistry();

    // Listen for tokenize-started event to prevent immediate refresh during tokenize sequence
    const handleTokenizeStarted = () => {
      isTokenizeInProgressRef.current = true;
    };
    
    // Listen for tokenize-completed event to allow refresh again
    const handleTokenizeCompleted = () => {
      isTokenizeInProgressRef.current = false;
    };

    // Listen for onramp-started event to prevent immediate refresh during onramp sequence
    const handleOnrampStarted = () => {
      isOnrampInProgressRef.current = true;
    };
    
    // Listen for onramp-completed event to allow refresh again
    const handleOnrampCompleted = () => {
      isOnrampInProgressRef.current = false;
    };

    // Listen for buy-started event to prevent immediate refresh during buy sequence
    const handleBuyStarted = () => {
      isBuyInProgressRef.current = true;
    };
    
    // Listen for buy-completed event to allow refresh again
    const handleBuyCompleted = () => {
      isBuyInProgressRef.current = false;
    };

    // Listen for sell-started event to prevent immediate refresh during sell sequence
    const handleSellStarted = () => {
      isSellInProgressRef.current = true;
    };
    
    // Listen for sell-completed event to allow refresh again
    const handleSellCompleted = () => {
      isSellInProgressRef.current = false;
    };

    // Listen for redeem-started event to prevent immediate refresh during redeem sequence
    const handleRedeemStarted = () => {
      isRedeemInProgressRef.current = true;
    };
    
    // Listen for redeem-completed event to allow refresh again
    const handleRedeemCompleted = () => {
      isRedeemInProgressRef.current = false;
    };

    // Listen for custom event to refresh immediately after ETF creation or tokenize completion
    // This ensures the registry updates right away without waiting for polling
    const handleRegistryUpdate = () => {
      // Skip refresh if tokenize is in progress - will refresh after animation completes
      if (isTokenizeInProgressRef.current) {
        return;
      }
      // Skip refresh if onramp is in progress - will refresh after animation completes
      if (isOnrampInProgressRef.current) {
        return;
      }
      // Skip refresh if buy is in progress - will refresh after animation completes
      if (isBuyInProgressRef.current) {
        return;
      }
      // Skip refresh if sell is in progress - will refresh after animation completes
      if (isSellInProgressRef.current) {
        return;
      }
      // Skip refresh if redeem is in progress - will refresh after animation completes
      if (isRedeemInProgressRef.current) {
        return;
      }
      // Trigger phase out/in animation by updating the key
      setAnimationKey(prev => prev + 1);
      // Load registry after a small delay to allow animation to start
      setTimeout(() => {
        loadRegistry();
      }, 100);
    };
    
    window.addEventListener('depository-registry-updated', handleRegistryUpdate);
    window.addEventListener('tokenize-started', handleTokenizeStarted);
    window.addEventListener('tokenize-completed', handleTokenizeCompleted);
    window.addEventListener('onramp-started', handleOnrampStarted);
    window.addEventListener('onramp-completed', handleOnrampCompleted);
    window.addEventListener('buy-started', handleBuyStarted);
    window.addEventListener('buy-completed', handleBuyCompleted);
    window.addEventListener('sell-started', handleSellStarted);
    window.addEventListener('sell-completed', handleSellCompleted);
    window.addEventListener('redeem-started', handleRedeemStarted);
    window.addEventListener('redeem-completed', handleRedeemCompleted);

    // Set up polling to refresh data periodically (fallback)
    // This ensures we get updates even if events are missed
    // Skip polling refresh if tokenize, onramp, buy, sell, or redeem is in progress
    const interval = setInterval(() => {
      if (!isTokenizeInProgressRef.current && !isOnrampInProgressRef.current && !isBuyInProgressRef.current && !isSellInProgressRef.current && !isRedeemInProgressRef.current) {
        loadRegistry();
      }
    }, 5000); // Refresh every 5 seconds

    return () => {
      clearInterval(interval);
      window.removeEventListener('cdp-registry-updated', handleRegistryUpdate);
      window.removeEventListener('tokenize-started', handleTokenizeStarted);
      window.removeEventListener('tokenize-completed', handleTokenizeCompleted);
      window.removeEventListener('onramp-started', handleOnrampStarted);
      window.removeEventListener('onramp-completed', handleOnrampCompleted);
      window.removeEventListener('buy-started', handleBuyStarted);
      window.removeEventListener('buy-completed', handleBuyCompleted);
      window.removeEventListener('sell-started', handleSellStarted);
      window.removeEventListener('sell-completed', handleSellCompleted);
      window.removeEventListener('redeem-started', handleRedeemStarted);
      window.removeEventListener('redeem-completed', handleRedeemCompleted);
    };
  }, []);

  // Render account balances
  const renderAccount = (accountId, accountData, uniqueId) => {
    const { stocks = {}, etfs = {} } = accountData || {};
    
    // Separate ETFs and stocks, then combine with ETFs first
    // This ensures ES3 ETF appears at the top without scrolling
    const etfEntries = Object.entries(etfs).filter(([_, value]) => value > 0);
    const stockEntries = Object.entries(stocks).filter(([_, value]) => value > 0);
    
    // Sort ETFs and stocks separately, then combine with ETFs first
    const holdingsEntries = [...etfEntries, ...stockEntries];

    if (holdingsEntries.length === 0) {
      return (
        <div key={accountId} className="cdp-account">
          <div className="cdp-account-name">
            {formatAccountName(accountId)} {uniqueId && <span className="cdp-unique-id">({uniqueId})</span>}:
          </div>
          <div className="cdp-empty">No holdings</div>
        </div>
      );
    }

    return (
      <div key={accountId} className="cdp-account">
        <div className="cdp-account-name">
          {formatAccountName(accountId)} {uniqueId && <span className="cdp-unique-id">({uniqueId})</span>}:
        </div>
        <div className="cdp-holdings">
          {holdingsEntries.map(([symbol, quantity]) => (
            <div key={symbol} className="cdp-holding">
              <span className="cdp-symbol">
                {symbol} <span className="cdp-stock-description">({getStockName(symbol)})</span>:
              </span>
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
        <h3>Depository Registry</h3>
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
        <h3>Depository Registry</h3>
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
      <h3>Depository Registry</h3>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={animationKey}
          className="cdp-registry-content"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
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

