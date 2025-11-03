/**
 * Date and Price Context
 * Manages the current/future date and TES3 price for time simulation
 */

import React, { createContext, useContext, useState } from 'react';

// Price constants (in SGDC, 18 decimals)
// Current price: $4.51 per TES3
const CURRENT_PRICE = '4510000000000000000'; // 4.51 * 10^18
// Future price: $4.89 per TES3  
const FUTURE_PRICE = '4890000000000000000'; // 4.89 * 10^18

// Date constants
const CURRENT_DATE = 'Nov 2025';
const FUTURE_DATE = 'Oct 2026';

const DatePriceContext = createContext(null);

/**
 * DatePriceProvider - Provides date and price state management
 */
export function DatePriceProvider({ children }) {
  // State: false = current date/price, true = future date/price
  const [isFuture, setIsFuture] = useState(false);

  // Toggle between current and future
  const toggleDatePrice = () => {
    setIsFuture(prev => !prev);
  };

  // Get current active price
  const getCurrentPrice = () => {
    return isFuture ? FUTURE_PRICE : CURRENT_PRICE;
  };

  // Get current active date
  const getCurrentDate = () => {
    return isFuture ? FUTURE_DATE : CURRENT_DATE;
  };

  // Get formatted price for display (without decimals)
  const getFormattedPrice = () => {
    const price = isFuture ? FUTURE_PRICE : CURRENT_PRICE;
    // Convert from wei (18 decimals) to readable format
    const priceNum = parseFloat(price) / 1e18;
    return priceNum.toFixed(2);
  };

  const value = {
    isFuture,
    toggleDatePrice,
    getCurrentPrice,
    getCurrentDate,
    getFormattedPrice,
    // Also expose raw values for display
    currentPrice: CURRENT_PRICE,
    futurePrice: FUTURE_PRICE,
    currentDate: CURRENT_DATE,
    futureDate: FUTURE_DATE,
  };

  return (
    <DatePriceContext.Provider value={value}>
      {children}
    </DatePriceContext.Provider>
  );
}

/**
 * Hook to use DatePrice context
 */
export function useDatePrice() {
  const context = useContext(DatePriceContext);
  if (!context) {
    throw new Error('useDatePrice must be used within DatePriceProvider');
  }
  return context;
}

