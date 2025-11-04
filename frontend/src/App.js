/**
 * Main App Component
 * Tokenized ETF Demo Application
 * Integrates all components: Network Visualizer, Block Explorer, Registries, Action Panels
 */

import React, { useState, useCallback, useEffect } from 'react';
import NetworkVisualizer from './components/NetworkVisualizer';
import BlockExplorer from './components/BlockExplorer';
import CDPRegistry from './components/CDPRegistry';
import DCDPRegistry from './components/dCDPRegistry';
import { CombinedActions } from './components/ActionPanel';
import { ToastContainer } from './components/Toast';
import { ToastProvider, useToastContext } from './contexts/ToastContext';
import { DatePriceProvider, useDatePrice } from './contexts/DatePriceContext';
import { useBlockchain } from './hooks/useBlockchain';
import './App.css';

function AppContent() {
  // Clear localStorage on app start to ensure fresh data from API
  // This wipes ES3 and other CDP registry data so demo starts from initial state
  useEffect(() => {
    localStorage.removeItem('cdp-registry');
    console.log('[App] Cleared CDP registry from localStorage - starting fresh');
  }, []);
  const { error: blockchainError } = useBlockchain();
  const { toasts, removeToast } = useToastContext();
  const { 
    isFuture, 
    toggleDatePrice, 
    getCurrentDate, 
    getFormattedPrice,
    currentDate,
    futureDate,
    currentPrice,
    futurePrice
  } = useDatePrice();
  
  // State to trigger animations in NetworkVisualizer
  // When this changes, NetworkVisualizer will detect it and play the animation
  const [animationTrigger, setAnimationTrigger] = useState(null);

  // Callback to trigger onramp animation
  // This will be called from ActionPanel when onramp action is executed
  const triggerOnrampAnimation = useCallback(() => {
    setAnimationTrigger({ type: 'onramp', timestamp: Date.now() });
  }, []);

  // Format price for display
  const formatPriceDisplay = (price) => {
    const priceNum = parseFloat(price) / 1e18;
    return `$${priceNum.toFixed(2)}`;
  };

  return (
    <div className="app">
      {/* Toast notifications container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <header className="app-header">
        <div className="app-header-left">
          <h1>Schroders Tokenized ETF Demo</h1>
          {blockchainError && (
            <div className="app-error">
              Blockchain Error: {blockchainError}
            </div>
          )}
        </div>
        <div className="app-header-right">
          <div className="date-price-display">
            <div className="date-price-current">
              <span className="date-label">Date:</span>
              <span className={`date-value ${isFuture ? 'date-value-old' : ''}`}>
                {currentDate}
              </span>
              {isFuture && (
                <span className="date-value"> → {futureDate}</span>
              )}
            </div>
            <div className="date-price-current">
              <span className="price-label">ES3:</span>
              <span className={`price-value ${isFuture ? 'price-value-old' : ''}`}>
                {formatPriceDisplay(currentPrice)}
              </span>
              {isFuture && (
                <span className="price-value"> → {formatPriceDisplay(futurePrice)}</span>
              )}
            </div>
          </div>
          <button 
            className="date-price-toggle"
            onClick={toggleDatePrice}
            title={isFuture ? 'Return to current date' : 'Jump to future date'}
          >
            {isFuture ? '← Return to Nov 2025' : 'Jump to Oct 2026 →'}
          </button>
        </div>
      </header>

      <main className="app-main">
        {/* Left Column: Depository Registry (top) and Tokenized Depository Registry (bottom) */}
        <section className="app-section app-section-left-registries">
          <div className="registry-item">
            <CDPRegistry />
          </div>
          <div className="registry-item">
            <DCDPRegistry />
          </div>
        </section>

        {/* Center Column: Network Visualizer (top) and Block Explorer (bottom, expanded) */}
        <section className="app-section app-section-visualizer">
          <NetworkVisualizer animationTrigger={animationTrigger} />
        </section>

        {/* Bottom Section: Block Explorer (expanded width, same as visualizer) */}
        <section className="app-section app-section-block-explorer">
          <BlockExplorer />
        </section>

        {/* Right Column: Action Panels (spans full height) */}
        <section className="app-section app-section-actions">
          <CombinedActions onOnrampSuccess={triggerOnrampAnimation} />
        </section>
      </main>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <DatePriceProvider>
        <AppContent />
      </DatePriceProvider>
    </ToastProvider>
  );
}

export default App;
