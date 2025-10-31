# Tokenized ETF Demo - Frontend

React frontend application for the Tokenized ETF Demo project.

## Overview

This frontend application provides a visual interface for demonstrating tokenized securities on a blockchain. It includes:

- **Network Visualizer**: Animated visualization of stakeholder network and transaction flows
- **Block Explorer**: Real-time display of blockchain transactions
- **CDP Registry**: Display of offchain traditional securities balances
- **dCDP Registry**: Display of onchain tokenized securities balances
- **Action Panels**: Interactive buttons for performing actions (onramp, buy, sell, tokenize, etc.)

## Tech Stack

- **React** - UI framework
- **ethers.js v6** - Blockchain interaction library
- **Framer Motion** - Animation library
- **CSS3** - Styling

## Setup

### Prerequisites

- Node.js (v18+)
- Running Anvil blockchain instance on `http://localhost:8545`
- Deployed smart contracts (SGDC, TES3, dCDP)

### Installation

```bash
cd frontend
npm install
```

### Configuration

Update contract addresses in `src/utils/constants.js` after backend deployment:

```javascript
export const CONTRACT_ADDRESSES = {
  SGDC: '0x...', // Actual deployed address
  TES3: '0x...', // Actual deployed address
  dCDP: '0x...', // Actual deployed address
};

export const ACCOUNTS = {
  AP: '0x...', // Authorized Participant address
  THOMAS: '0x...', // Thomas address
  ADMIN: '0x...', // Admin address
  STABLECOIN_PROVIDER: '0x...', // Stablecoin provider address
};
```

### Running

```bash
npm start
```

The application will open at `http://localhost:3000`.

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── NetworkVisualizer.jsx
│   │   ├── BlockExplorer.jsx
│   │   ├── CDPRegistry.jsx
│   │   ├── dCDPRegistry.jsx
│   │   └── ActionPanel.jsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useBlockchain.js
│   │   └── useContracts.js
│   ├── utils/              # Utility functions
│   │   ├── constants.js
│   │   ├── contractHelpers.js
│   │   └── api.js
│   ├── App.js              # Main app component
│   └── index.js            # Entry point
├── public/
│   └── api/
│       └── cdp-registry.json  # CDP registry data
└── package.json
```

## Components

### NetworkVisualizer

Displays the stakeholder network with animated transaction flows. Uses SVG and Framer Motion for smooth animations.

### BlockExplorer

Shows recent blockchain transactions in a table format. Auto-updates when new blocks are mined.

### CDPRegistry

Displays offchain traditional securities balances from the CDP registry JSON file. Updates every 5 seconds.

### dCDPRegistry

Displays onchain tokenized securities balances by querying smart contracts. Updates in real-time via event listeners.

### ActionPanel

Contains three action panels:
- **ThomasActions**: Onramp, Buy Asset, Sell Asset
- **dCDPActions**: Tokenize, Create Wallet
- **APActions**: Create ETF

## Blockchain Integration

The frontend connects to a local Anvil instance at `http://localhost:8545`. It uses ethers.js v6 to:

- Connect to the blockchain
- Read contract state
- Listen to events
- Send transactions (when signers are provided)

## Development Notes

### Placeholder Functions

Some action buttons show placeholder implementations because they require:
- Private keys for signing transactions
- Backend API endpoints for offchain operations
- Actual contract ABIs with full function signatures

These will be implemented once the backend provides:
- Contract addresses and ABIs
- Account private keys (for demo purposes)
- API endpoints for CDP registry updates

### Event Listening

The frontend listens to:
- `Transfer` events on SGDC and TES3 contracts
- `Tokenized` events on dCDP contract
- `WalletCreated` events on dCDP contract
- Block confirmations from Anvil

### Real-time Updates

- Block Explorer: Updates when new blocks are mined
- dCDP Registry: Updates when Transfer events occur
- CDP Registry: Polls JSON file every 5 seconds

## Testing

To test the frontend:

1. Ensure Anvil is running: `anvil`
2. Deploy contracts (backend team handles this)
3. Update contract addresses in `constants.js`
4. Start the frontend: `npm start`
5. Open `http://localhost:3000`

## Future Enhancements

- [LOG] Add proper error handling and user feedback
- [LOG] Implement actual transaction signing with MetaMask or similar
- [LOG] Add transaction status indicators
- [LOG] Improve animation system for network visualizer
- [LOG] Add loading states for all async operations
- [LOG] Implement proper API integration for CDP registry updates

## License

MIT - Demo/Educational Project

