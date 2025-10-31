# Quick Start Guide

## Prerequisites

1. Anvil running on `http://localhost:8545`
2. Contracts deployed (run `forge script script/Deploy.s.sol --broadcast` from backend)
3. Node.js and npm installed

## Starting the Frontend

```bash
cd frontend
npm start
```

The app will open at `http://localhost:3000`

## Testing the Integration

### Step 1: Create Wallet for Thomas
- Go to **dCDP Actions** panel
- Owner ID: `THOMAS`
- Click **Create Wallet**
- ✅ Should see success message

### Step 2: Onramp Stablecoin
- Go to **Thomas Actions** panel
- Amount: `1000` SGDC
- Click **Onramp**
- ✅ Should see success, check dCDP Registry for Thomas's SGDC balance

### Step 3: Create ETF (Offchain)
- This requires running backend script:
  ```bash
  cd backend
  node script/createETF.js AP ES3 100
  ```
- Or use **AP Actions** → Create ETF (shows message but doesn't update CDP registry)

### Step 4: Tokenize
- Go to **dCDP Actions** panel
- Owner ID: `AP`
- Quantity: `50`
- Symbol: `ES3`
- Click **Tokenize**
- ✅ Should see success, check dCDP Registry for AP's TES3 balance

### Step 5: Buy Asset
- Go to **Thomas Actions** panel
- Quantity: `5.5` TES3
- Click **Buy Asset**
- ✅ Should see success, balances update in dCDP Registry

### Step 6: Sell Asset
- Go to **Thomas Actions** panel
- Quantity: `3` TES3
- Click **Sell Asset**
- ✅ Should see success, balances update

## Monitoring

- **Block Explorer**: Shows all transactions in real-time
- **dCDP Registry**: Updates automatically when balances change
- **CDP Registry**: Updates every 5 seconds (if backend script modifies it)

## Troubleshooting

**"Provider not connected"**
- Make sure Anvil is running: `anvil`
- Check it's on port 8545

**"No private key found"**
- Verify you're using the correct account addresses
- Private keys are hardcoded for Anvil default accounts

**"Failed to load contract ABIs"**
- Frontend will use minimal ABIs as fallback
- Should still work, but may have limited functionality

**CDP Registry not updating**
- Run backend scripts manually to update `backend/data/cdp-registry.json`
- Frontend polls this file every 5 seconds

## What's Working

✅ All blockchain transactions execute successfully
✅ Real-time balance updates
✅ Transaction history in Block Explorer
✅ Error handling and validation
✅ Fractional token purchases (e.g., 5.5 TES3)

## Ready to Demo!

The frontend is fully integrated and ready for your demo. All action buttons execute real transactions on the Anvil blockchain.

