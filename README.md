# Tokenized ETF Demo

This repository contains a full-stack prototype that illustrates how a traditional exchange-traded fund could be tokenized and managed through a decentralized sidecar operated by a national central depository. The demo combines an Ethereum-based smart contract suite with a React-based user interface to walk through the complete product storyboard.

## Getting Started

### Prerequisites

- Node.js 18 or later
- Foundry toolchain (`forge`, `anvil`, `cast`)
- npm or yarn

### Install Dependencies

```bash
# Install Foundry if it is not already available
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install backend libraries (Solidity dependencies)
cd backend
forge install

# Install frontend packages
cd ../frontend
npm install
```

## Running the Demo

### Automated Startup (recommended)

Start the complete environment with the provided script. It launches Anvil, deploys the contracts, and boots the React development server.

```bash
# macOS / Linux
./start-demo.sh

# Windows
./start-demo.bat
```

### Manual Startup

Run each service manually when you need additional control.

```bash
# Terminal 1: local blockchain
cd backend
anvil

# Terminal 2: contract deployment
cd backend
forge script script/Deploy.s.sol --broadcast \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Terminal 3: frontend development server
cd frontend
npm start
```

## Repository Layout

```
tetf/
├── backend/                  Smart contracts, tests, and deployment scripts
├── frontend/                 React frontend for the demo experience
├── start-demo.sh             Convenience launcher for macOS and Linux
├── start-demo.bat            Convenience launcher for Windows
├── FRONTEND_INTEGRATION_GUIDE.md
└── PROJECT_SPECIFICATION.md
```

## Smart Contract Suite

The backend contracts implement the tokenized ETF lifecycle. All tests pass and the deployment script is production ready for a local environment. Detailed documentation lives in `backend/BACKEND_README.md`.

- `SGDC.sol`: Singapore dollar-denominated ERC-20 stablecoin
- `TES3.sol`: Token representing tokenized ES3 ETF shares
- `dCDP.sol`: Decentralized central depository protocol orchestrating tokenization

## Frontend Status

The React application renders the storyboard for the seven demo stages, covering ETF creation, tokenization, listing, wallet creation, onramping, secondary market trades, and redemption. Integration notes, sample data, and ABI usage guidelines are available in `FRONTEND_INTEGRATION_GUIDE.md` and `FRONTEND_AGENT_CONTEXT.md`.

## Testing

Execute the Solidity test suite with Foundry.

```bash
cd backend
forge test
```

## Troubleshooting

**Anvil already running**  
Port 8545 must be free before launching a new chain.

```bash
lsof -i :8545
kill <PID>
```

**Contracts missing from deployment output**  
Confirm Anvil is running and re-run the deployment script.

```bash
curl http://localhost:8545
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545
```

**Frontend cannot connect to contracts**  
Ensure the deployment script has populated `backend/deployment-info.json`, and verify the React app reads the generated addresses (see `frontend/src/utils/constants.js`).

## Supporting Documentation

- `backend/BACKEND_README.md`: Contract design, deployment details, and helper scripts
- `FRONTEND_INTEGRATION_GUIDE.md`: Guidance for integrating contract data into the UI
- `PROJECT_SPECIFICATION.md`: End-to-end storyboard and platform assumptions

## License

This project is provided for demonstration and educational purposes only.
