/**
 * Main App Component
 * Tokenized ETF Demo Application
 * Integrates all components: Network Visualizer, Block Explorer, Registries, Action Panels
 */

import React, { useState, useCallback } from 'react';
import NetworkVisualizer from './components/NetworkVisualizer';
import BlockExplorer from './components/BlockExplorer';
import CDPRegistry from './components/CDPRegistry';
import DCDPRegistry from './components/dCDPRegistry';
import { CombinedActions } from './components/ActionPanel';
import { ToastContainer } from './components/Toast';
import { ToastProvider, useToastContext } from './contexts/ToastContext';
import { useBlockchain } from './hooks/useBlockchain';
import './App.css';

function AppContent() {
  const { error: blockchainError } = useBlockchain();
  const { toasts, removeToast } = useToastContext();
  
  // State to trigger animations in NetworkVisualizer
  // When this changes, NetworkVisualizer will detect it and play the animation
  const [animationTrigger, setAnimationTrigger] = useState(null);

  // Callback to trigger onramp animation
  // This will be called from ActionPanel when onramp action is executed
  const triggerOnrampAnimation = useCallback(() => {
    setAnimationTrigger({ type: 'onramp', timestamp: Date.now() });
  }, []);

  return (
    <div className="app">
      {/* Toast notifications container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <header className="app-header">
        <h1>Schroders Tokenized ETF Demo</h1>
        {blockchainError && (
          <div className="app-error">
            Blockchain Error: {blockchainError}
          </div>
        )}
      </header>

      <main className="app-main">
        {/* Left Column: CDP Registry (top) and dCDP Registry (bottom) */}
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
      <AppContent />
    </ToastProvider>
  );
}

export default App;
