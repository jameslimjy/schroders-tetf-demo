/**
 * API Utility Functions
 * Handles communication with backend API endpoints
 * For CDP registry and other offchain operations
 */

import { CDP_REGISTRY_API } from './constants';

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
 * @param {string} quantity - Number of ETF shares to create
 * @param {string} symbol - ETF symbol (e.g., "ES3")
 * @returns {Promise<Object>} Result of ETF creation
 */
export async function createETF(quantity, symbol = 'ES3') {
  try {
    // TODO: Implement actual API endpoint when backend is ready
    // const response = await fetch('/api/create-etf', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ quantity, symbol }),
    // });
    // return await response.json();
    
    // Placeholder response
    return {
      success: true,
      message: `Created ${quantity} ${symbol} shares`,
    };
  } catch (error) {
    console.error('Error creating ETF:', error);
    throw error;
  }
}

