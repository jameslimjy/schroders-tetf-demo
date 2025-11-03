/**
 * API Utility Functions
 * Handles communication with backend API endpoints
 * For CDP registry and other offchain operations
 */

import { CDP_REGISTRY_API } from './constants';

/**
 * Fetch deployment info from public/deployment-info.json
 * Contains contract addresses and network configuration
 * @returns {Promise<Object>} Deployment info with contract addresses
 */
export async function fetchDeploymentInfo() {
  try {
    const response = await fetch('/deployment-info.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch deployment info: ${response.status} ${response.statusText}`);
    }
    
    // Check if response is actually JSON before parsing
    // This prevents "Unexpected token '<'" errors when HTML error pages are returned
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Response is not JSON - received HTML error page instead');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching deployment info:', error);
    throw error;
  }
}

/**
 * Fetch CDP registry data
 * @returns {Promise<Object>} CDP registry data
 */
export async function fetchCDPRegistry() {
  try {
    const response = await fetch(CDP_REGISTRY_API);
    if (!response.ok) {
      throw new Error(`Failed to fetch CDP registry: ${response.status} ${response.statusText}`);
    }
    
    // Check if response is actually JSON before parsing
    // This prevents "Unexpected token '<'" errors when HTML error pages are returned
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Response is not JSON - received HTML error page instead');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching CDP registry:', error);
    throw error;
  }
}

/**
 * Create ETF shares (offchain operation)
 * This function performs the ETF creation logic client-side:
 * - Reads current CDP registry (from localStorage or API)
 * - Validates sufficient holdings for each constituent stock
 * - Deducts constituent stocks according to ETF composition
 * - Adds ETF shares to the account
 * - Stores updated registry in localStorage
 * 
 * @param {string} ownerId - Owner ID (e.g., "AP")
 * @param {number} quantity - Number of ETF shares to create
 * @param {string} symbol - ETF symbol (e.g., "ES3")
 * @returns {Promise<Object>} Result of ETF creation
 */
export async function createETF(ownerId, quantity, symbol = 'ES3') {
  try {
    // Get current registry - check localStorage first, then fetch from API
    let registry;
    const storedRegistry = localStorage.getItem('cdp-registry');
    
    if (storedRegistry) {
      try {
        registry = JSON.parse(storedRegistry);
      } catch (e) {
        console.warn('Failed to parse stored registry, fetching fresh copy');
        registry = await fetchCDPRegistry();
      }
    } else {
      registry = await fetchCDPRegistry();
    }

    // Validate owner exists
    if (!registry.accounts || !registry.accounts[ownerId]) {
      throw new Error(`Owner ${ownerId} not found in CDP registry`);
    }

    // Validate ETF composition exists
    if (!registry.etf_compositions || !registry.etf_compositions[symbol]) {
      throw new Error(`ETF ${symbol} composition not found`);
    }

    const account = registry.accounts[ownerId];
    const composition = registry.etf_compositions[symbol];

    // Initialize ETF balance if it doesn't exist
    if (!account.etfs) {
      account.etfs = {};
    }
    if (!account.etfs[symbol]) {
      account.etfs[symbol] = 0;
    }

    // Initialize stocks object if it doesn't exist
    if (!account.stocks) {
      account.stocks = {};
    }

    // Validate sufficient holdings for each constituent stock
    const constituents = composition.constituents;
    const validationErrors = [];
    
    for (const [stockSymbol, requiredPerETF] of Object.entries(constituents)) {
      const currentBalance = account.stocks[stockSymbol] || 0;
      const required = requiredPerETF * quantity;

      if (currentBalance < required) {
        validationErrors.push(
          `Insufficient ${stockSymbol}: have ${currentBalance}, need ${required} ` +
          `(${requiredPerETF} per ETF × ${quantity} ETFs)`
        );
      }
    }

    // If validation fails, throw error with all issues
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('; '));
    }

    // Deduct constituent stocks and add ETF shares
    const deductedStocks = {};
    for (const [stockSymbol, requiredPerETF] of Object.entries(constituents)) {
      const required = requiredPerETF * quantity;
      account.stocks[stockSymbol] = (account.stocks[stockSymbol] || 0) - required;
      deductedStocks[stockSymbol] = required;
    }

    // Increase ETF balance
    account.etfs[symbol] = (account.etfs[symbol] || 0) + quantity;

    // Store updated registry in localStorage
    localStorage.setItem('cdp-registry', JSON.stringify(registry));

    return {
      success: true,
      newETFBalance: account.etfs[symbol],
      deductedStocks,
      message: `Successfully created ${quantity} ${symbol} shares for ${ownerId}`,
    };
  } catch (error) {
    console.error('Error creating ETF:', error);
    throw error;
  }
}

/**
 * Tokenize securities (decrease CDP registry balance)
 * This function updates the CDP registry when tokenization occurs:
 * - Decreases the ETF balance in CDP registry
 * - Stores updated registry in localStorage
 * 
 * @param {string} ownerId - Owner ID (e.g., "AP")
 * @param {number} quantity - Number of securities to tokenize
 * @param {string} symbol - Security symbol (e.g., "ES3")
 * @returns {Promise<Object>} Result of tokenization
 */
export async function tokenizeSecurity(ownerId, quantity, symbol = 'ES3') {
  try {
    // Get current registry - check localStorage first, then fetch from API
    let registry;
    const storedRegistry = localStorage.getItem('cdp-registry');
    
    if (storedRegistry) {
      try {
        registry = JSON.parse(storedRegistry);
      } catch (e) {
        console.warn('Failed to parse stored registry, fetching fresh copy');
        registry = await fetchCDPRegistry();
      }
    } else {
      registry = await fetchCDPRegistry();
    }

    // Validate owner exists
    if (!registry.accounts || !registry.accounts[ownerId]) {
      throw new Error(`Owner ${ownerId} not found in CDP registry`);
    }

    const account = registry.accounts[ownerId];

    // Initialize ETF balance if it doesn't exist
    if (!account.etfs) {
      account.etfs = {};
    }
    if (!account.etfs[symbol]) {
      account.etfs[symbol] = 0;
    }

    // Validate sufficient holdings
    const currentBalance = account.etfs[symbol] || 0;
    if (currentBalance < quantity) {
      throw new Error(
        `Insufficient ${symbol}: have ${currentBalance}, need ${quantity}`
      );
    }

    // Decrease ETF balance
    account.etfs[symbol] = currentBalance - quantity;

    // Store updated registry in localStorage
    localStorage.setItem('cdp-registry', JSON.stringify(registry));

    return {
      success: true,
      newBalance: account.etfs[symbol],
      message: `Successfully tokenized ${quantity} ${symbol} for ${ownerId}`,
    };
  } catch (error) {
    console.error('Error tokenizing security:', error);
    throw error;
  }
}

/**
 * Redeem tokenized securities (increase CDP registry balance)
 * This function updates the CDP registry when redemption occurs:
 * - Increases the ETF balance in CDP registry
 * - Stores updated registry in localStorage
 * 
 * @param {string} ownerId - Owner ID (e.g., "AP")
 * @param {number} quantity - Number of securities to redeem
 * @param {string} symbol - Security symbol (e.g., "ES3")
 * @returns {Promise<Object>} Result of redemption
 */
export async function redeemSecurity(ownerId, quantity, symbol = 'ES3') {
  try {
    // Get current registry - check localStorage first, then fetch from API
    let registry;
    const storedRegistry = localStorage.getItem('cdp-registry');
    
    if (storedRegistry) {
      try {
        registry = JSON.parse(storedRegistry);
      } catch (e) {
        console.warn('Failed to parse stored registry, fetching fresh copy');
        registry = await fetchCDPRegistry();
      }
    } else {
      registry = await fetchCDPRegistry();
    }

    // Validate owner exists
    if (!registry.accounts || !registry.accounts[ownerId]) {
      throw new Error(`Owner ${ownerId} not found in CDP registry`);
    }

    const account = registry.accounts[ownerId];

    // Initialize ETF balance if it doesn't exist
    if (!account.etfs) {
      account.etfs = {};
    }
    if (!account.etfs[symbol]) {
      account.etfs[symbol] = 0;
    }

    // Increase ETF balance
    const oldBalance = account.etfs[symbol];
    account.etfs[symbol] = oldBalance + quantity;

    // Store updated registry in localStorage
    localStorage.setItem('cdp-registry', JSON.stringify(registry));

    return {
      success: true,
      newBalance: account.etfs[symbol],
      message: `Successfully redeemed ${quantity} ${symbol} for ${ownerId}`,
    };
  } catch (error) {
    console.error('Error redeeming security:', error);
    throw error;
  }
}

