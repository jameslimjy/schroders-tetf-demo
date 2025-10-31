# Tokenized ETF Demo Project

A full-stack demonstration project showcasing how a tokenized Exchange-Traded Fund (ETF) system might work in a future state where a country's central depository operates a decentralized sidecar for securities tokenization.

## Quick Start

### Prerequisites

- **Node.js** (v18+)
- **Foundry** (forge, anvil, cast)
- **npm** or **yarn**

### Installation

1. **Install Foundry** (if not already installed):
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Install Backend Dependencies**:
   ```bash
   cd backend
   forge install
   ```

3. **Install Frontend Dependencies** (when frontend is ready):
   ```bash
   cd frontend
   npm install
   ```

### Running the Demo

**Option 1: Automated Startup (Recommended)**

Simply run the startup script:

```bash
# macOS/Linux
./start-demo.sh

# Windows
start-demo.bat
```

This script will:
1. ✅ Start Anvil blockchain (if not already running)
2. ✅ Deploy all smart contracts
3. ✅ Start the frontend development server

**Option 2: Manual Startup**

If you prefer to run commands individually:

```bash
# Terminal 1: Start Anvil
cd backend
anvil

# Terminal 2: Deploy Contracts
cd backend
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Terminal 3: Start Frontend
cd frontend
npm start
```

## Project Structure

```
tetf/
├── backend/              # Smart contracts (Foundry)
│   ├── src/             # Solidity contracts
│   ├── test/            # Contract tests
│   ├── script/          # Deployment & helper scripts
│   └── data/            # CDP registry (offchain data)
├── frontend/            # React frontend (to be built)
├── start-demo.sh        # Startup script (macOS/Linux)
├── start-demo.bat       # Startup script (Windows)
└── FRONTEND_INTEGRATION_GUIDE.md  # Integration guide
```

## Backend Status

✅ **Complete** - All smart contracts implemented and tested

- **SGDC.sol**: Stablecoin contract
- **TES3.sol**: Tokenized ETF contract  
- **dCDP.sol**: Protocol contract
- **48 tests** - All passing
- **Deployment script** - Automated deployment

See `backend/BACKEND_README.md` for detailed backend documentation.

## Frontend Status

⏳ **In Progress** - Frontend development

See `FRONTEND_INTEGRATION_GUIDE.md` for integration instructions.

## Demo Storyboard

The demo follows 7 key steps:

1. **ETF Creation** - AP creates 100 ES3 shares from underlying stocks
2. **Tokenization** - AP tokenizes 50 ES3 shares → 50 TES3 tokens
3. **Listing** - AP lists TES3 on digital exchange
4. **Account Creation** - Thomas creates account, dCDP creates wallet
5. **Onramp** - Thomas onramps $1000 via stablecoin (SGDC)
6. **Buy Asset** - Thomas buys 5.5 TES3 for $550 SGDC
7. **Sell Asset** - Thomas sells 3 TES3 for $300 SGDC

## Key Features

- **Fractional Ownership**: Buy/sell fractional shares (e.g., 5.5 TES3)
- **Instant Settlement**: Transactions settle immediately using smart contracts
- **Lock-and-Mint**: Traditional securities locked in CDP, tokens minted on dCDP
- **Real-time Updates**: Blockchain events trigger UI updates

## Network Configuration

- **RPC URL**: `http://localhost:8545`
- **Chain ID**: `31337`
- **Network**: Anvil (local development)

## Contract Addresses

After deployment, addresses are saved in `backend/deployment-info.json`:

- **SGDC**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **TES3**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- **dCDP**: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`

## Testing

Run backend tests:
```bash
cd backend
forge test
```

## Troubleshooting

### Anvil Already Running
If you see "Address already in use":
```bash
# Check what's using port 8545
lsof -i :8545

# Kill the process if needed
kill <PID>
```

### Contracts Not Deployed
Make sure Anvil is running before deploying:
```bash
# Check if Anvil is running
curl http://localhost:8545
```

### Frontend Can't Connect
- Verify Anvil is running on `http://localhost:8545`
- Check that contracts are deployed (see `backend/deployment-info.json`)
- Ensure frontend is reading contract addresses correctly

## Documentation

- **Backend**: `backend/BACKEND_README.md`
- **Frontend Integration**: `FRONTEND_INTEGRATION_GUIDE.md`
- **Project Specification**: `PROJECT_SPECIFICATION.md`

## License

This is a demonstration project for educational purposes.
