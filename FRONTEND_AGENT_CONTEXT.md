# Frontend Development Context Summary

## Project Overview

This is a **Tokenized ETF Demo Project** that demonstrates the tokenization of traditional securities (specifically the SPDR Straits Times Index ETF - ES3) into blockchain-based tokens (TES3). The project consists of:

- **Backend**: Foundry-based Solidity smart contracts (deployed and functional)
- **Frontend**: React-based web application for visualizing and interacting with the tokenized securities system

## Current Project Status

### Backend Status: ✅ COMPLETE
- Smart contracts deployed and tested
- Anvil local blockchain running on port 8545
- Deployment info available in `backend/deployment-info.json`
- Contracts: SGDC (stablecoin), TES3 (tokenized ETF), dCDP (decentralized CDP protocol)

### Frontend Status: 🚧 IN PROGRESS
- Basic structure and components implemented
- Integration with backend contracts completed
- Layout matching design specification
- Network Visualizer updated to use rectangles with logos
- Transaction signing and interaction working
- Some styling and polish still needed

## Technical Stack

- **React**: Version 19.2.0
- **ethers.js**: Version 6.9.0 (for blockchain interaction)
- **Framer Motion**: Version 12.23.24 (for animations)
- **Node Version**: Check `package.json` in frontend directory
- **Build Tool**: Create React App (react-scripts 5.0.1)

## Codebase Structure

```
frontend/
├── public/
│   ├── assets/logos/          # Logo images for Network Visualizer
│   └── api/
│       └── cdp-registry.json   # CDP registry data (offchain)
├── src/
│   ├── components/
│   │   ├── ActionPanel.jsx    # Action buttons for Thomas, dCDP, AP
│   │   ├── BlockExplorer.jsx  # Displays blockchain transactions
│   │   ├── CDPRegistry.jsx    # Offchain CDP registry display
│   │   ├── DCDPRegistry.jsx   # Onchain dCDP registry display
│   │   ├── NetworkVisualizer.jsx  # Visual network diagram
│   │   └── *.css              # Component stylesheets
│   ├── hooks/
│   │   ├── useBlockchain.js   # Blockchain connection management
│   │   └── useContracts.js    # Contract instance management
│   ├── utils/
│   │   ├── constants.js       # Contract addresses, account addresses
│   │   └── contractHelpers.js # Helper functions for contracts
│   ├── App.js                 # Main app component
│   ├── App.css                # Main app styles
│   └── index.js               # Entry point (uses React 18+ API)
└── package.json
```

## Key Files and Their Purpose

### `src/utils/constants.js`
- Contains hardcoded contract addresses (from `backend/deployment-info.json`)
- Contains Anvil account addresses (Account #0 = Admin, #1 = AP, #2 = Thomas)
- RPC URL: `http://localhost:8545`
- Chain ID: 31337 (Anvil default)

### `src/hooks/useBlockchain.js`
- Manages connection to Anvil blockchain
- Provides `getSigner(address)` function using Anvil's default private keys
- Listens for new blocks
- Handles connection errors

### `src/hooks/useContracts.js`
- Initializes contract instances (SGDC, TES3, dCDP)
- Loads ABIs from `backend/out/*.json` files (with fallback to minimal ABIs)
- Provides `getContractWithSigner()` for write operations
- Provides `getBalance()` for reading token balances

### `src/components/ActionPanel.jsx`
- Contains three exported components: `ThomasActions`, `DCDPActions`, `APActions`
- Implements transaction signing for:
  - Onramp (mint SGDC to Thomas)
  - Buy/Sell TES3 (token swaps)
  - Tokenize (lock securities and mint tokens)
  - Create Wallet (register owner ID on dCDP)
  - Create ETF (offchain operation via API)

### `src/components/NetworkVisualizer.jsx`
- Recently updated to use rectangles instead of circles
- Displays stakeholder names and logos
- Nodes are NOT clickable (by design)
- Logos expected in `public/assets/logos/`
- Uses SVG with Framer Motion for animations

### `src/components/DCDPRegistry.jsx`
- Note: Component name is `DCDPRegistry` (capitalized) - React requirement
- Displays onchain token balances
- Dynamically resolves owner IDs to addresses via dCDP contract
- Updates in real-time via event listeners

## Important Implementation Details

### React 19 Compatibility
- Uses `ReactDOM.createRoot()` API (not `ReactDOM.render()`)
- Component names MUST start with uppercase (React hooks requirement)
- Fixed components: `DCDPRegistry`, `DCDPActions`

### Transaction Signing
- Uses Anvil's default private keys (hardcoded in `useBlockchain.js`)
- Account #0: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- Account #1: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
- Account #2: `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`

### Contract Addresses (Current Deployment)
- SGDC: `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`
- TES3: `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707`
- dCDP: `0x0165878A594ca255338adfa4d48449f69242Eb8F`

Note: These addresses may change if contracts are redeployed. Check `backend/deployment-info.json` for current addresses.

## Current Layout Structure

The frontend uses a CSS Grid layout:
- **Top Row**: Network Visualizer (left, 350px height) + Action Panels (right, 350px height, vertically stacked)
- **Bottom Row**: Block Explorer, CDP Registry, dCDP Registry (horizontally arranged, 300px height)

All fits on a standard laptop screen without scrolling.

## Setup and Running

1. **Start Backend** (if not already running):
   ```bash
   cd backend
   anvil  # Runs on port 8545
   ```

2. **Deploy Contracts** (if not already deployed):
   ```bash
   cd backend
   forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```

3. **Start Frontend**:
   ```bash
   cd frontend
   npm install  # If first time
   npm start    # Runs on port 3000 (or 3001 if 3000 is busy)
   ```

   Or use the automated script:
   ```bash
   ./start-demo.sh  # From project root - starts everything
   ```

## Known Issues and TODOs

1. **Logos**: Logo images need to be added to `frontend/public/assets/logos/`
2. **Styling**: Some components may need additional styling polish
3. **Error Handling**: Some error messages could be more user-friendly
4. **Loading States**: Some operations could benefit from better loading indicators
5. **Responsive Design**: Mobile responsiveness may need improvement

## Concurrent Development Guidelines

### ⚠️ IMPORTANT: Multiple Agents Working Simultaneously

**This codebase is being worked on by multiple AI agents simultaneously.** Please follow these guidelines:

1. **File-Level Coordination**:
   - Before editing a file, check if it's currently being modified by another agent
   - If you see unsaved changes or recent modifications, coordinate or wait
   - Read the file fully before making changes

2. **Component Boundaries**:
   - Try to work on different components/files when possible
   - If you need to modify shared files (like `constants.js`, `App.js`), be careful
   - Consider creating new components rather than heavily modifying existing ones

3. **Testing**:
   - Test your changes immediately after making them
   - If something breaks, check if another agent made recent changes
   - The frontend should remain functional at all times

4. **Communication**:
   - Document your changes in comments
   - If you create new files or make significant changes, note them clearly
   - Use clear commit messages if committing changes

5. **Common Files to Coordinate On**:
   - `src/App.js` - Main layout component
   - `src/App.css` - Main styles
   - `src/utils/constants.js` - Shared constants
   - `package.json` - Dependencies

6. **Safe Areas to Work**:
   - Individual component files (ActionPanel, BlockExplorer, etc.)
   - Component-specific CSS files
   - New components/features
   - Utility functions (if creating new ones)

## Design Specifications

Refer to:
- `PROJECT_SPECIFICATION.md` - Complete project requirements
- `FRONTEND_INTEGRATION_GUIDE.md` - Backend integration details

## Recent Changes Made

1. Fixed React component naming (DCDPRegistry, DCDPActions - capitalized)
2. Updated Network Visualizer to use rectangles with logos
3. Fixed React 19 compatibility (createRoot API)
4. Updated layout to match design specification
5. Fixed syntax errors in dCDPRegistry component
6. Removed clickable functionality from network nodes

## Questions or Issues?

- Check `backend/deployment-info.json` for current contract addresses
- Check `backend/out/*.json` for contract ABIs
- Check browser console for runtime errors
- Ensure Anvil is running on port 8545
- Ensure contracts are deployed before testing interactions

---

**Last Updated**: After Network Visualizer rectangle/logo implementation
**Next Agent**: Please read this document fully before starting work. Coordinate on shared files carefully.

