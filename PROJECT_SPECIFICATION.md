# Tokenized ETF Demo Project - Complete Specification

## Project Overview

This is a full-stack demonstration project showcasing how a tokenized Exchange-Traded Fund (ETF) system might work in a future state where a country's central depository operates a decentralized sidecar for securities tokenization.

### Core Concept
- **CDP (Central Depository)**: Traditional securities registry (offchain)
- **dCDP (Decentralized CDP)**: Blockchain-based tokenized securities platform (onchain)
- **Lock-and-Mint Mechanism**: Traditional securities are locked in CDP and corresponding tokenized securities are minted on dCDP
- **Use Case**: SPDR Straits Times Index ETF (ES3) → Tokenized ETF (TES3)

### Key Benefits Demonstrated
1. **Fractional Ownership**: Investors can buy fractional shares/tokens (e.g., 5.5 TES3)
2. **Instant Settlement**: Transactions settle immediately using smart contracts and digital cash (stablecoin), bypassing traditional T+2 settlement

## Technical Architecture

### Backend Stack
- **Framework**: Foundry (Solidity development toolkit)
- **Blockchain**: Local Anvil network (Ethereum-compatible)
- **Smart Contracts**: Solidity (ERC-20 tokens + custom protocol contracts)
- **Offchain Data**: JSON file simulating CDP database

### Frontend Stack
- **Framework**: React
- **Blockchain Library**: ethers.js or web3.js
- **Connection**: Direct integration with local Anvil instance (http://localhost:8545)
- **UI Components**: Network visualizer, block explorer, registry displays, action panels

## Stakeholders and Accounts

### Three Main Accounts (Ethereum Wallets)
1. **Authorized Participant (AP)**
   - Professional institution
   - Starts with large holdings of all 30 STI constituent stocks
   - Can create ETF shares from underlying stocks
   - Can tokenize ETF shares via dCDP
   - Lists tokenized shares on digital exchange

2. **Thomas (Retail Investor)**
   - Individual retail investor
   - Starts with zero balance
   - Onramps fiat to stablecoin
   - Buys and sells tokenized ETF shares
   - Account/wallet created by dCDP

3. **dCDP Admin**
   - System administrator account
   - Controls dCDP protocol contract
   - Manages system operations

### Other Stakeholders (Non-Wallet Entities)
- Traditional Exchanges
- ST (Traditional Settlement System)
- Digital Exchange
- Stablecoin Service Provider

## Complete Storyboard (User Journey)

### Step 1: ETF Creation (Offchain)
**Action**: AP creates 100 ES3 shares from basket of underlying stocks
- **CDP Registry**: AP's 30 stock balances decrease according to ETF weightings, ES3 balance increases by 100
- **Animation**: Show flow from Traditional Exchanges → ST → CDP, with AP creating ETF shares

### Step 2: Tokenization (Lock-and-Mint)
**Action**: AP tokenizes 50 ES3 shares using dCDP
- **CDP Registry**: AP's ES3 balance decreases by 50
- **dCDP Registry**: AP's TES3 balance increases by 50
- **Blockchain**: `tokenize()` transaction recorded
- **Block Explorer**: Displays tokenize() function call
- **Animation**: Show lock-and-mint flow between CDP and dCDP

### Step 3: Listing
**Action**: AP lists 50 TES3 on digital exchange
- No state changes, purely availability for trading
- **Animation**: Show connection between AP and Digital Exchange

### Step 4: Account Creation
**Action**: Thomas creates account on digital exchange, dCDP creates wallet for him
- **dCDP Registry**: Thomas account appears with zero balances
- **Blockchain**: `createWallet()` transaction recorded
- **Block Explorer**: Displays createWallet() function call
- **Animation**: Show Digital Exchange → dCDP wallet creation

### Step 5: Onramp Stablecoin
**Action**: Thomas onramps $1000 via stablecoin service
- **dCDP Registry**: Thomas's SGDC balance increases to 1000
- **Blockchain**: `mint()` SGDC transaction recorded
- **Block Explorer**: Displays SGDC mint function call
- **Animation**: Show Stablecoin Provider minting SGDC to Thomas's wallet

### Step 6: Buy Tokenized Asset
**Action**: Thomas purchases 5.5 TES3 (at $100/token = $550)
- **dCDP Registry**:
  - Thomas: -550 SGDC, +5.5 TES3
  - AP: +550 SGDC, -5.5 TES3
- **Blockchain**: `transfer()` SGDC transaction, `transfer()` TES3 transaction
- **Block Explorer**: Displays both transfer function calls
- **Animation**: Show atomic swap between Thomas and AP via Digital Exchange

### Step 7: Sell Tokenized Asset
**Action**: Thomas sells 3 TES3 (at $100/token = $300)
- **dCDP Registry**:
  - Thomas: +300 SGDC, -3 TES3
  - AP: -300 SGDC, +3 TES3
- **Blockchain**: `transfer()` SGDC transaction, `transfer()` TES3 transaction
- **Block Explorer**: Displays both transfer function calls
- **Animation**: Show reverse atomic swap between Thomas and AP

## Smart Contracts Specification

### 1. SGDC.sol (Singapore Dollar Coin - Stablecoin)
**Type**: ERC-20 Token
**Purpose**: Digital cash for instant settlement

**Features**:
- Standard ERC-20 functionality (transfer, approve, transferFrom, balanceOf)
- Name: "Singapore Dollar Coin"
- Symbol: "SGDC"
- Decimals: 18
- Minting function restricted to authorized minter (stablecoin service provider)

**Key Functions**:
```solidity
function mint(address to, uint256 amount) external onlyMinter
```

**Initial State**:
- Stablecoin service provider has minter role
- All accounts start with 0 SGDC

### 2. TES3.sol (Tokenized SPDR STI ETF)
**Type**: ERC-20 Token
**Purpose**: Represents tokenized ES3 shares

**Features**:
- Standard ERC-20 functionality
- Name: "Tokenized SPDR STI ETF"
- Symbol: "TES3"
- Decimals: 18 (allows fractional ownership)
- Mint/burn functions restricted to dCDP contract only

**Key Functions**:
```solidity
function mint(address to, uint256 amount) external onlyDCDP
function burn(address from, uint256 amount) external onlyDCDP
```

**Initial State**:
- Total supply: 0
- Only dCDP contract can mint/burn

### 3. dCDP.sol (Decentralized CDP Protocol)
**Type**: Protocol/System Contract
**Purpose**: Manages tokenization, wallet creation, and CDP integration

**State Variables**:
- Mapping: `owner_id` (string) → Ethereum address
- Reference to TES3 contract
- Reference to CDP registry data (via backend script integration)

**Key Functions**:

#### `createWallet(string memory owner_id, address walletAddress) external onlyAdmin`
- Creates mapping between owner_id and Ethereum address
- Emits `WalletCreated(owner_id, walletAddress)` event
- Used when digital exchange creates account for new user

#### `tokenize(string memory owner_id, uint256 quantity, string memory symbol) external onlyAdmin`
- Verifies owner has sufficient balance in CDP registry (read from JSON)
- Decreases balance in CDP registry JSON file
- Mints corresponding TES3 tokens to owner's address
- Emits `Tokenized(owner_id, symbol, quantity, tokenAddress)` event
- Only supports "ES3" symbol in this demo

**Events**:
```solidity
event WalletCreated(string indexed owner_id, address walletAddress)
event Tokenized(string indexed owner_id, string symbol, uint256 quantity, address indexed tokenAddress)
```

**Access Control**:
- Admin-only functions for system operations
- Integration with offchain CDP data

## CDP Registry Data Structure

### cdp-registry.json
**Purpose**: Simulates traditional depository database (offchain)

**Structure**:
```json
{
  "accounts": {
    "AP": {
      "stocks": {
        "D05": 10000,     // DBS Group Holdings
        "O39": 8000,      // OCBC Bank
        "U11": 7500,      // UOB
        "Z74": 6000,      // Singtel
        "C52": 5000,      // ComfortDelGro
        // ... 25 more stocks
      },
      "etfs": {
        "ES3": 0          // SPDR STI ETF (starts at 0, created via createETF)
      }
    },
    "THOMAS": {
      "stocks": {},
      "etfs": {}
    }
  },
  "etf_compositions": {
    "ES3": {
      "name": "SPDR Straits Times Index ETF",
      "constituents": {
        "D05": 100,       // 100 shares of DBS per 1 ES3
        "O39": 80,        // 80 shares of OCBC per 1 ES3
        "U11": 75,        // 75 shares of UOB per 1 ES3
        // ... 27 more stocks with quantities
      }
    }
  }
}
```

**STI 30 Constituent Stocks** (use realistic Singapore stocks):
1. D05 - DBS Group Holdings
2. O39 - OCBC Bank
3. U11 - United Overseas Bank (UOB)
4. Z74 - Singtel
5. C52 - ComfortDelGro
6. C31 - CapitaLand Integrated Commercial Trust
7. C09 - City Developments
8. G13 - Genting Singapore
9. BN4 - Keppel Corporation
10. S68 - SGX
11. N2IU - Mapletree Logistics Trust
12. U96 - Sembcorp Industries
13. V03 - Venture Corporation
14. S58 - SATS
15. Y92 - Thai Beverage
16. ME8U - Mapletree Industrial Trust
17. M44U - Mapletree Pan Asia Commercial Trust
18. A17U - Ascendas REIT
19. J36 - Jardine Matheson Holdings
20. C38U - CapitaLand Ascendas REIT
21. S63 - ST Engineering
22. BS6 - Yangzijiang Shipbuilding
23. F34 - Wilmar International
24. BN2 - Dairy Farm International
25. H78 - Hongkong Land Holdings
26. N21 - NetLink NBN Trust
27. S51 - Sembcorp Marine
28. AWX - AEM Holdings
29. D01 - Frencken Group
30. S59 - Sheng Siong Group

**Operations**:
- Read by backend scripts
- Updated when AP creates ETF shares (offchain operation)
- Updated when tokenization occurs (decreases traditional balance)

## Frontend Specifications

### Layout Structure
```
┌─────────────────────────────────────────────────────────────────┐
│                     Network Visualizer                          │
│                    (Large central area)                         │
│                                                                   │
│  [Traditional]     [ST]      [CDP]  ←→  [dCDP]                  │
│  [Exchanges]                                                     │
│                                                                   │
│                            [Thomas]                              │
│                                                                   │
│                    [Digital Exchange]                            │
│                    [Stablecoin Provider]                         │
│                            [AP]                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────┬─────────────────┬───────────────────┐
│   Block Explorer        │  CDP Registry   │  dCDP Registry    │
│   (Scrollable)          │  (Scrollable)   │  (Scrollable)     │
│                         │                 │                   │
│ TxHash | Function | ... │  AP:            │  AP:              │
│ 0x123  | tokenize | ... │   D05: 1000     │   TES3: 50        │
│ 0x456  | transfer | ... │   ES3: 50       │   SGDC: 550       │
└─────────────────────────┴─────────────────┴───────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     Action Panels (Right Side)                   │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐│
│  │ Thomas Actions   │  │ dCDP Actions     │  │  AP Actions    ││
│  │ • Onramp        │  │ • Tokenize       │  │ • Create ETF   ││
│  │ • Buy Asset     │  │ • Create Wallet  │  │                ││
│  │ • Sell Asset    │  │                  │  │                ││
│  └──────────────────┘  └──────────────────┘  └────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Component 1: Network Visualizer

**Purpose**: Visual representation of stakeholder network with animated transaction flows

**Visual Elements**:
- **Nodes**: Rounded rectangles for each stakeholder
  - Traditional Exchanges (top left)
  - ST - Settlement (left)
  - CDP (left center) - black border
  - dCDP (center) - purple border, highlighted
  - Digital Exchange (center right)
  - Stablecoin Provider (right)
  - Thomas icon (top center, person icon)
  - AP (bottom right)

**Animation Requirements** (Moderate Complexity):
- **Particle System**: Small dots/particles flow along connection lines during transfers
- **Glow Effects**: Nodes pulse/glow when active in transaction
- **Value Transfer Lines**: Animated lines showing direction of flow (green for tokens, blue for stablecoin)
- **Fade Effects**: Smooth fade in/out for connection lines
- **Highlight States**: Active node gets border glow or color change
- **Transaction Queue**: Visual indication when multiple transactions occurring

**Animation Triggers**:
- ETF Creation: Traditional Exchanges → ST → CDP (particles flow, CDP glows)
- Tokenization: CDP ↔ dCDP (bidirectional flow, lock-and-mint visualization)
- Wallet Creation: Digital Exchange → dCDP (connection pulse)
- Onramp: Stablecoin Provider → Thomas (blue particles)
- Buy/Sell: Thomas ↔ AP via Digital Exchange (dual-color particle flow)

**Technical Approach**:
- Canvas or SVG-based rendering
- Use libraries like D3.js, React Spring, or Framer Motion
- Event-driven animations triggered by blockchain events

### Component 2: Block Explorer

**Purpose**: Display onchain transactions in real-time

**Columns**:
1. **Txn Hash**: Short format (0x1234...5678)
2. **Function**: Function name called (tokenize, createWallet, mint, transfer, etc.)
3. **Block No.**: Block number
4. **From**: Sender address (short format)
5. **To**: Recipient address or contract (short format)

**Features**:
- Auto-scroll to latest transaction
- Scrollable list (shows last 10-20 transactions)
- Click to expand for full transaction details (optional)
- Color coding by transaction type
- Real-time updates via blockchain event listeners

**Data Source**: Listen to Anvil blockchain events via ethers.js

### Component 3: CDP Registry Display

**Purpose**: Show offchain traditional securities balances

**Display Format**:
```
CDP Registry
─────────────
AP:
  D05: 10000
  O39: 8000
  U11: 7500
  ES3: 50
  ...

Thomas:
  D05: 5
```

**Features**:
- Read-only display
- Scrollable (can get long with 30+ stocks)
- Updates when CDP JSON file changes
- Group by account holder
- Show both stocks and ETFs

**Data Source**: Read from cdp-registry.json via backend API or direct file read

### Component 4: dCDP Registry Display

**Purpose**: Show onchain tokenized securities balances

**Display Format**:
```
dCDP Registry
─────────────
AP [0x301...512]:
  TES3: 44.5
  SGDC: 850

Thomas [0x8f1...184]:
  TES3: 5.5
  SGDC: 700
```

**Features**:
- Read-only display
- Real-time updates from blockchain
- Shows token balances by querying smart contracts
- Displays wallet addresses (shortened)

**Data Source**: Query ERC-20 contracts (TES3.balanceOf(), SGDC.balanceOf()) via ethers.js

### Component 5: Action Panels

#### Panel A: Thomas Actions

**Button 1: Onramp**
- Input field: Amount (SGDC)
- Default: 1000
- Action: Calls SGDC.mint(thomasAddress, amount) from stablecoin provider account
- Triggers: Stablecoin mint animation, dCDP registry update

**Button 2: Buy Tokenized Asset**
- Input field 1: Quantity (TES3 tokens)
- Input field 2: Contract Address (default: TES3 address)
- Fixed price: $100 per TES3
- Validation: Check if Thomas has sufficient SGDC balance
- Action: 
  1. SGDC.transferFrom(thomas, AP, quantity * 100)
  2. TES3.transferFrom(AP, thomas, quantity)
- Triggers: Dual transfer animation, registry updates

**Button 3: Sell Tokenized Asset**
- Input field: Quantity (TES3 tokens)
- Validation: Check if Thomas has sufficient TES3 balance
- Action:
  1. TES3.transferFrom(thomas, AP, quantity)
  2. SGDC.transferFrom(AP, thomas, quantity * 100)
- Triggers: Reverse transfer animation, registry updates

#### Panel B: dCDP Actions

**Button 1: Tokenize**
- Input field 1: Owner ID (e.g., "AP")
- Input field 2: Quantity
- Input field 3: Symbol (e.g., "ES3")
- Action: Calls dCDP.tokenize(owner_id, quantity, symbol)
- Validation: Checks CDP registry for sufficient balance
- Updates: Decreases CDP registry, increases dCDP registry
- Triggers: Lock-and-mint animation

**Button 2: Create Wallet**
- Input field: Owner ID (e.g., "THOMAS")
- Action: Calls dCDP.createWallet(owner_id, newAddress)
- Generates new Ethereum address for user
- Triggers: Wallet creation animation

#### Panel C: AP Actions

**Button 1: Create ETF**
- Input field 1: Quantity (number of ES3 shares to create)
- Input field 2: Symbol (default: "ES3")
- Action: Offchain operation
  1. Reads ETF composition from cdp-registry.json
  2. Decreases constituent stock balances according to weightings
  3. Increases ES3 balance
  4. Updates cdp-registry.json
- Triggers: ETF creation animation, CDP registry update

## Backend Integration Layer

### Scripts/Functions Needed

**1. deployContracts.js**
- Deploys SGDC, TES3, dCDP to local Anvil
- Sets up proper permissions (dCDP as TES3 minter, stablecoin provider as SGDC minter)
- Saves contract addresses and ABIs to JSON file
- Creates three accounts: AP, Thomas, Admin

**2. initializeData.js**
- Creates cdp-registry.json with initial state
- AP starts with large holdings of all 30 STI stocks
- Defines ETF composition with accurate weightings

**3. createETF.js**
- Reads ETF composition
- Validates AP has sufficient stock holdings
- Updates CDP registry (decreases stocks, increases ETF shares)
- Offchain operation, no blockchain transaction

**4. tokenize.js**
- Reads CDP registry to verify balance
- Calls dCDP.tokenize() on blockchain
- Updates CDP registry JSON (decreases traditional balance)
- TES3 tokens minted automatically by smart contract

**5. Frontend API Layer**
- Functions to read CDP registry
- Functions to call smart contracts
- Event listeners for blockchain events
- State management for UI updates

## Technical Details

### Fixed Price Mechanism
- TES3 price: $100 (USD) per token
- For simplification, no price discovery
- All buy/sell transactions use this fixed price

### Decimal Handling
- All ERC-20 tokens use 18 decimals
- Fractional amounts supported (e.g., 5.5 TES3 = 5500000000000000000 in wei)
- Frontend should handle decimal conversion for user-friendly display

### Transaction Flow Pattern
```
User Action (Frontend)
  ↓
ethers.js Contract Call
  ↓
Smart Contract Execution (Anvil)
  ↓
Event Emission
  ↓
Frontend Event Listener
  ↓
UI Updates + Animation Triggers
  ↓
Registry Display Updates
```

### Event Listening
Frontend must listen for:
- `Transfer` events on SGDC and TES3
- `Tokenized` events on dCDP
- `WalletCreated` events on dCDP
- Block confirmations from Anvil

## Development Workflow

### 1. Backend Development
1. Initialize Foundry project ✅ (Started)
2. Install OpenZeppelin contracts
3. Write SGDC.sol, TES3.sol, dCDP.sol
4. Write deployment scripts
5. Write tests for all contracts
6. Create cdp-registry.json with STI constituent data
7. Create helper scripts for offchain operations

### 2. Local Blockchain Setup
1. Start Anvil: `anvil`
2. Deploy contracts: `forge script DeployContracts.s.sol --broadcast`
3. Save contract addresses and ABIs
4. Fund test accounts

### 3. Frontend Development
1. Initialize React project
2. Install ethers.js
3. Create blockchain connection utilities
4. Build Network Visualizer component
5. Build Block Explorer component
6. Build Registry display components
7. Build Action Panel components
8. Implement animation system
9. Wire up event listeners
10. Connect all components to smart contracts

### 4. Integration Testing
1. Test each storyboard step sequentially
2. Verify animations trigger correctly
3. Confirm registry updates properly
4. Validate all blockchain transactions
5. Test error handling

## Files Structure

```
tetf/
├── backend/
│   ├── src/
│   │   ├── SGDC.sol
│   │   ├── TES3.sol
│   │   └── dCDP.sol
│   ├── script/
│   │   ├── Deploy.s.sol
│   │   └── Initialize.s.sol
│   ├── test/
│   │   ├── SGDC.t.sol
│   │   ├── TES3.t.sol
│   │   └── dCDP.t.sol
│   ├── data/
│   │   └── cdp-registry.json
│   └── foundry.toml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── NetworkVisualizer.jsx
│   │   │   ├── BlockExplorer.jsx
│   │   │   ├── CDPRegistry.jsx
│   │   │   ├── dCDPRegistry.jsx
│   │   │   ├── ActionPanel.jsx
│   │   │   └── animations/
│   │   ├── hooks/
│   │   │   ├── useContracts.js
│   │   │   └── useBlockchain.js
│   │   ├── utils/
│   │   │   ├── contractHelpers.js
│   │   │   └── constants.js
│   │   ├── App.jsx
│   │   └── index.js
│   ├── package.json
│   └── README.md
├── README.md
└── PROJECT_SPECIFICATION.md (this file)
```

## Key Considerations

### Security Notes
- This is a DEMO project, not production-ready
- Access control simplified for demonstration
- No real funds or securities involved
- Local blockchain only (Anvil)

### Simplifications Made
- Fixed pricing instead of dynamic pricing
- Only one ETF (ES3/TES3) supported
- Only one stablecoin (SGDC) supported
- Simplified lock-and-mint (no actual proof mechanisms)
- Offchain CDP data in JSON (real systems would use secure databases)
- No KYC/AML compliance features
- No real-world bridge to traditional systems

### User Experience Focus
- Animations must be smooth and eye-catching
- Clear visual feedback for all actions
- Real-time updates across all components
- Easy-to-understand flow for demonstration purposes
- Professional appearance for presentation

## Success Criteria

The project is complete when:
1. ✅ All smart contracts deployed and functional on Anvil
2. ✅ All 8 storyboard steps can be executed successfully
3. ✅ Network visualizer shows animations for each action
4. ✅ Block explorer displays all transactions correctly
5. ✅ CDP and dCDP registries update in real-time
6. ✅ All action buttons work as specified
7. ✅ Fractional token purchases work (e.g., 5.5 TES3)
8. ✅ Instant settlement demonstrated
9. ✅ Professional, visually appealing UI
10. ✅ Clear demonstration of tokenization benefits

## Current Progress

- ✅ Foundry project initialized in backend/ directory
- ⏳ OpenZeppelin contracts installation (interrupted)
- ⏸️ Smart contract development pending
- ⏸️ Frontend setup pending

## Next Steps

1. Complete OpenZeppelin installation
2. Develop three smart contracts (SGDC, TES3, dCDP)
3. Create deployment and test scripts
4. Initialize CDP registry data with STI constituents
5. Test smart contracts locally
6. Begin frontend development
7. Integrate frontend with smart contracts
8. Build animation system
9. End-to-end testing
10. Polish and finalize

---

**Document Version**: 1.0  
**Last Updated**: October 31, 2025  
**Project Status**: Backend Development In Progress

