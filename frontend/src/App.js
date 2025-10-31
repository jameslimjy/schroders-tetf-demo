/**
 * Main App Component
 * Tokenized ETF Demo Application
 * Integrates all components: Network Visualizer, Block Explorer, Registries, Action Panels
 */

import React from 'react';
import NetworkVisualizer from './components/NetworkVisualizer';
import BlockExplorer from './components/BlockExplorer';
import CDPRegistry from './components/CDPRegistry';
import DCDPRegistry from './components/dCDPRegistry';
import { ThomasActions, DCDPActions, APActions } from './components/ActionPanel';
import { useBlockchain } from './hooks/useBlockchain';
import './App.css';

function App() {
  const { isConnected, error: blockchainError } = useBlockchain();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tokenized ETF Demo</h1>
        <p className="app-subtitle">
          SPDR Straits Times Index ETF (ES3) → Tokenized ETF (TES3)
        </p>
        <div className={`app-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '✓ Connected to Blockchain' : '✗ Disconnected'}
        </div>
        {blockchainError && (
          <div className="app-error">
            Blockchain Error: {blockchainError}
          </div>
        )}
      </header>

      <main className="app-main">
        {/* Network Visualizer - Large top/central area */}
        <section className="app-section app-section-visualizer">
          <NetworkVisualizer />
        </section>

        {/* Action Panels - Right Side (vertically stacked) */}
        <section className="app-section app-section-actions">
          <ThomasActions />
          <DCDPActions />
          <APActions />
        </section>

        {/* Bottom Section: Block Explorer, CDP Registry, dCDP Registry (horizontally arranged) */}
        <section className="app-section app-section-registries">
          <div className="registry-grid">
            <div className="registry-item">
              <BlockExplorer />
            </div>
            <div className="registry-item">
              <CDPRegistry />
            </div>
            <div className="registry-item">
              <DCDPRegistry />
            </div>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Demo Project - Tokenized Securities Platform | 
          {' '}
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
