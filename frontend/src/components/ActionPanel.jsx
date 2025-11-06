/**
 * Action Panel Component
 * Contains action buttons for different stakeholders
 * Supports Thomas Actions, Tokenized Depository Actions, and AP Actions
 */

/* eslint-env es2020 */
import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useContracts } from '../hooks/useContracts';
import { useBlockchain } from '../hooks/useBlockchain';
import { useToastContext } from '../contexts/ToastContext';
import { useDatePrice } from '../contexts/DatePriceContext';
import { parseTokenAmount, formatTokenAmount, waitForTransaction } from '../utils/contractHelpers';
import { ACCOUNTS, UNIQUE_ID_TO_OWNER_ID } from '../utils/constants';
import { createETF, tokenizeSecurity, redeemSecurity } from '../utils/api';
import './ActionPanel.css';

/**
 * Thomas Actions Panel
 * Actions: Onramp, Buy Asset, Sell Asset
 */
export function ThomasActions() {
  const { contracts, getContractWithSigner, getBalance } = useContracts();
  const { provider, getSigner } = useBlockchain();
  const { getCurrentPrice } = useDatePrice();
  const [onrampAmount, setOnrampAmount] = useState('500000');
  const [buyQuantity, setBuyQuantity] = useState('2750');
  const [sellQuantity, setSellQuantity] = useState('1500');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Onramp stablecoin
  const handleOnramp = async () => {
    clearMessages();
    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      const amount = parseTokenAmount(onrampAmount);
      
      // Get stablecoin provider signer (Account #0 / Admin)
      const stablecoinSigner = getSigner(ACCOUNTS.STABLECOIN_PROVIDER);
      const sgdc = getContractWithSigner('sgdc', stablecoinSigner);
      
      // Mint SGDC to Thomas
      const tx = await sgdc.mint(ACCOUNTS.THOMAS, amount);
      // Wait for transaction with timeout to prevent indefinite hanging
      await waitForTransaction(tx, 60000); // 60 second timeout
      
      setSuccess(`✓ Onramp Complete`);
    } catch (err) {
      console.error('Onramp error:', err);
      setError('Onramp Failed');
    } finally {
      setLoading(false);
    }
  };

  // Buy tokenized asset
  const handleBuy = async () => {
    clearMessages();
    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      const quantity = parseTokenAmount(buyQuantity);
      const tes3Price = getCurrentPrice();
      const cost = (BigInt(quantity) * BigInt(tes3Price)) / BigInt(10 ** 18);

      // Check if Thomas has sufficient SGDC balance
      const thomasBalance = await getBalance('sgdc', ACCOUNTS.THOMAS);
      if (BigInt(thomasBalance) < cost) {
        throw new Error(`Insufficient SGDC balance. Need ${formatTokenAmount(cost)}, have ${formatTokenAmount(thomasBalance)}`);
      }

      // Check if AP has sufficient TES3 balance
      const apTes3Balance = await getBalance('tes3', ACCOUNTS.AP);
      if (BigInt(apTes3Balance) < quantity) {
        throw new Error(`AP has insufficient TES3. Need ${formatTokenAmount(quantity)}, AP has ${formatTokenAmount(apTes3Balance)}`);
      }

      // Get signers
      const thomasSigner = getSigner(ACCOUNTS.THOMAS);
      const apSigner = getSigner(ACCOUNTS.AP);
      
      const sgdc = getContractWithSigner('sgdc', thomasSigner);
      const tes3 = getContractWithSigner('tes3', apSigner);
      
      // Step 1: Thomas approves AP to spend SGDC
      const approveTx = await sgdc.approve(ACCOUNTS.AP, cost);
      await waitForTransaction(approveTx, 60000);
      
      // Step 2: AP approves Thomas to spend TES3
      const approveTes3Tx = await tes3.approve(ACCOUNTS.THOMAS, quantity);
      await waitForTransaction(approveTes3Tx, 60000);
      
      // Step 3: Execute atomic swap
      // AP transfers TES3 to Thomas
      const tes3TransferTx = await tes3.transferFrom(ACCOUNTS.AP, ACCOUNTS.THOMAS, quantity);
      await waitForTransaction(tes3TransferTx, 60000);
      
      // Thomas transfers SGDC to AP
      const sgdcTransferTx = await sgdc.transferFrom(ACCOUNTS.THOMAS, ACCOUNTS.AP, cost);
      await waitForTransaction(sgdcTransferTx, 60000);
      
      setSuccess(`✓ Purchase Complete`);
    } catch (err) {
      console.error('Buy error:', err);
      setError('Purchase Failed');
    } finally {
      setLoading(false);
    }
  };

  // Sell tokenized asset
  const handleSell = async () => {
    clearMessages();
    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      const quantity = parseTokenAmount(sellQuantity);
      const tes3Price = getCurrentPrice();
      const proceeds = (BigInt(quantity) * BigInt(tes3Price)) / BigInt(10 ** 18);

      // Check if Thomas has sufficient TES3 balance
      const thomasBalance = await getBalance('tes3', ACCOUNTS.THOMAS);
      if (BigInt(thomasBalance) < quantity) {
        throw new Error(`Insufficient TES3 balance. Need ${formatTokenAmount(quantity)}, have ${formatTokenAmount(thomasBalance)}`);
      }

      // Check if AP has sufficient SGDC balance
      const apSgdcBalance = await getBalance('sgdc', ACCOUNTS.AP);
      if (BigInt(apSgdcBalance) < proceeds) {
        throw new Error(`AP has insufficient SGDC. Need ${formatTokenAmount(proceeds)}, AP has ${formatTokenAmount(apSgdcBalance)}`);
      }

      // Get signers
      const thomasSigner = getSigner(ACCOUNTS.THOMAS);
      const apSigner = getSigner(ACCOUNTS.AP);
      
      const tes3 = getContractWithSigner('tes3', thomasSigner);
      const sgdc = getContractWithSigner('sgdc', apSigner);
      
      // Step 1: Thomas approves AP to spend TES3
      const approveTes3Tx = await tes3.approve(ACCOUNTS.AP, quantity);
      await waitForTransaction(approveTes3Tx, 60000);
      
      // Step 2: AP approves Thomas to spend SGDC
      const approveSgdcTx = await sgdc.approve(ACCOUNTS.THOMAS, proceeds);
      await waitForTransaction(approveSgdcTx, 60000);
      
      // Step 3: Execute reverse swap
      // Thomas transfers TES3 to AP
      const tes3TransferTx = await tes3.transferFrom(ACCOUNTS.THOMAS, ACCOUNTS.AP, quantity);
      await waitForTransaction(tes3TransferTx, 60000);
      
      // AP transfers SGDC to Thomas
      const sgdcTransferTx = await sgdc.transferFrom(ACCOUNTS.AP, ACCOUNTS.THOMAS, proceeds);
      await waitForTransaction(sgdcTransferTx, 60000);
      
      setSuccess(`✓ Sale Complete`);
    } catch (err) {
      console.error('Sell error:', err);
      setError('Sale Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="action-panel">
      <h4>Thomas Actions</h4>
      
      <div className="action-group">
        <label>Onramp Amount (SGDC)</label>
        <input
          type="number"
          value={onrampAmount}
          onChange={(e) => setOnrampAmount(e.target.value)}
          placeholder="500000"
        />
        <button onClick={handleOnramp} disabled={loading}>
          Onramp
        </button>
      </div>

      <div className="action-group">
        <label>Buy Quantity (TES3)</label>
        <input
          type="number"
          step="0.1"
          value={buyQuantity}
          onChange={(e) => setBuyQuantity(e.target.value)}
          placeholder="2750"
        />
        <button onClick={handleBuy} disabled={loading}>
          Buy Asset
        </button>
      </div>

      <div className="action-group">
        <label>Sell Quantity (TES3)</label>
        <input
          type="number"
          step="0.1"
          value={sellQuantity}
          onChange={(e) => setSellQuantity(e.target.value)}
          placeholder="1500"
        />
        <button onClick={handleSell} disabled={loading}>
          Sell Asset
        </button>
      </div>

      {error && <div className="action-error">{error}</div>}
      {success && <div className="action-success">{success}</div>}
    </div>
  );
}

/**
 * Tokenized Depository Actions Panel
 * Actions: Tokenize, Create Wallet
 */
export function DCDPActions() {
  const { contracts, getContractWithSigner } = useContracts();
  const { provider, getSigner } = useBlockchain();
  const [tokenizeOwnerId, setTokenizeOwnerId] = useState('SN91X81J21');
  const [tokenizeQuantity, setTokenizeQuantity] = useState('4000');
  const [tokenizeSymbol, setTokenizeSymbol] = useState('ES3');
  const [walletOwnerId, setWalletOwnerId] = useState('SN72K45M83');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Tokenize securities
  const handleTokenize = async () => {
    clearMessages();
    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      const quantity = parseTokenAmount(tokenizeQuantity);
      
      // Map unique identifier (SN code) to owner ID
      // User inputs unique identifier, but contract needs owner ID
      const ownerId = UNIQUE_ID_TO_OWNER_ID[tokenizeOwnerId.toUpperCase()] || tokenizeOwnerId;
      
      // Get admin signer (Account #0)
      const adminSigner = getSigner(ACCOUNTS.ADMIN);
      const dcdp = getContractWithSigner('dcdp', adminSigner);
      
      // Call Tokenized Depository.tokenize() function with owner ID (not unique identifier)
      // Note: This assumes offchain Depository registry validation has occurred
      const tx = await dcdp.tokenize(ownerId, quantity, tokenizeSymbol);
      // Wait for transaction with timeout to prevent indefinite hanging
      await waitForTransaction(tx, 60000); // 60 second timeout
      
      setSuccess(`✓ Tokenization Complete`);
    } catch (err) {
      console.error('Tokenize error:', err);
      setError('Tokenization Failed');
    } finally {
      setLoading(false);
    }
  };

  // Create wallet
  const handleCreateWallet = async () => {
    clearMessages();
    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      // Map unique identifier (SN code) to owner ID
      // User inputs unique identifier, but contract needs owner ID
      const ownerId = UNIQUE_ID_TO_OWNER_ID[walletOwnerId.toUpperCase()] || walletOwnerId;
      
      // Get the wallet address for the owner_id
      // For THOMAS, use ACCOUNTS.THOMAS
      // For AP, use ACCOUNTS.AP
      // In a real scenario, this would be generated by the wallet provider
      let newAddress;
      if (ownerId.toUpperCase() === 'THOMAS') {
        newAddress = ACCOUNTS.THOMAS;
      } else if (ownerId.toUpperCase() === 'AP') {
        newAddress = ACCOUNTS.AP;
      } else {
        // Generate a random address for other owner IDs
        const randomWallet = ethers.Wallet.createRandom();
        newAddress = randomWallet.address;
      }
      
      // Get admin signer
      const adminSigner = await provider.getSigner(ACCOUNTS.ADMIN);
      const dcdp = getContractWithSigner('dcdp', adminSigner);
      
      // Call Tokenized Depository.createWallet() function with owner ID (not unique identifier)
      const tx = await dcdp.createWallet(ownerId, newAddress);
      // Wait for transaction with timeout to prevent indefinite hanging
      await waitForTransaction(tx, 60000); // 60 second timeout
      
      setSuccess(`✓ Wallet Created`);
    } catch (err) {
      console.error('Create wallet error:', err);
      setError('Wallet Creation Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="action-panel">
          <h4>Tokenized Depository Actions</h4>
      
      <div className="action-group">
        <label>Owner ID</label>
        <input
          type="text"
          value={tokenizeOwnerId}
          onChange={(e) => setTokenizeOwnerId(e.target.value)}
          placeholder="insert unique ID (e.g., SN91X81J21)"
        />
        <label>Quantity</label>
        <input
          type="number"
          value={tokenizeQuantity}
          onChange={(e) => setTokenizeQuantity(e.target.value)}
          placeholder="4000"
        />
        <label>Symbol</label>
        <input
          type="text"
          value={tokenizeSymbol}
          onChange={(e) => setTokenizeSymbol(e.target.value)}
          placeholder="ES3"
        />
        <button onClick={handleTokenize} disabled={loading}>
          Tokenize
        </button>
      </div>

      <div className="action-group">
        <label>Owner ID</label>
        <input
          type="text"
          value={walletOwnerId}
          onChange={(e) => setWalletOwnerId(e.target.value)}
          placeholder="THOMAS"
        />
        <button onClick={handleCreateWallet} disabled={loading}>
          Create Wallet
        </button>
      </div>

      {error && <div className="action-error">{error}</div>}
      {success && <div className="action-success">{success}</div>}
    </div>
  );
}

/**
 * Combined Actions Panel
 * Combines all three stakeholder action sections into a single panel
 * Sections: Thomas, Tokenized Depository, AP
 */
export function CombinedActions({ onOnrampSuccess }) {
  const LOGO_BASE_PATH = '/assets/logos/';

  return (
    <div className="action-panel combined-actions">
      {/* Header */}
      <div className="action-panel-header">
        <h3>Action Panel</h3>
      </div>

      {/* Thomas Section */}
      <div className="action-section action-section-thomas">
        <div className="action-section-header">
          <div className="action-section-logo-container">
            <img 
              src={`${LOGO_BASE_PATH}thomas-logo.png`} 
              alt="Thomas" 
              className="action-section-logo"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <h4>Thomas</h4>
        </div>
        <ThomasActionsContent onOnrampSuccess={onOnrampSuccess} />
      </div>

      {/* Digital Exchange Section */}
      <div className="action-section action-section-digital-exchange">
        <div className="action-section-header">
          <div className="action-section-logo-container">
            <img 
              src={`${LOGO_BASE_PATH}digital-exchange-logo.png`} 
              alt="Digital Exchange" 
              className="action-section-logo"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <h4>Digital Exchange</h4>
        </div>
        <DigitalExchangeActionsContent />
      </div>

      {/* Tokenized Depository Section */}
      <div className="action-section action-section-dcdp">
        <div className="action-section-header">
          <div className="action-section-logo-container">
            <img 
              src={`${LOGO_BASE_PATH}dcdp-logo.png`} 
              alt="Tokenized Depository" 
              className="action-section-logo"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <h4>Tokenized Depository</h4>
        </div>
        <DCDPActionsContent />
      </div>

      {/* AP Section */}
      <div className="action-section action-section-ap">
        <div className="action-section-header">
          <div className="action-section-logo-container">
            <img 
              src={`${LOGO_BASE_PATH}ap-logo.png`} 
              alt="AP" 
              className="action-section-logo"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <h4>AP</h4>
        </div>
        <APActionsContent />
      </div>
    </div>
  );
}

/**
 * Thomas Actions Content (extracted for reuse)
 * Accepts onOnrampSuccess callback to trigger network visualizer animation
 */
function ThomasActionsContent({ onOnrampSuccess }) {
  const { contracts, getContractWithSigner, getBalance } = useContracts();
  const { provider, getSigner } = useBlockchain();
  const { showSuccess, showError } = useToastContext();
  const { getCurrentPrice } = useDatePrice();
  const [onrampAmount, setOnrampAmount] = useState('10000');
  const [buyQuantity, setBuyQuantity] = useState('1000');
  // Hardcoded TES3 contract address - always use this address for buy/sell operations
  const buyContractAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
  const [sellQuantity, setSellQuantity] = useState('1000');
  // Hardcoded TES3 contract address - always use this address for buy/sell operations
  const sellContractAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
  const [loading, setLoading] = useState(false);

  // Onramp stablecoin
  const handleOnramp = async () => {
    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      // Check if Thomas's wallet exists in dCDP contract before proceeding
      // Wallet must be created via Create Wallet button first
      const adminSigner = getSigner(ACCOUNTS.ADMIN);
      const dcdp = getContractWithSigner('dcdp', adminSigner);
      
      // Check if wallet exists - ownerToAddress returns zero address if not found
      const thomasAddress = await dcdp.ownerToAddress('THOMAS');
      if (!thomasAddress || thomasAddress === '0x0000000000000000000000000000000000000000') {
        showError('Error, wallet not found!');
        return; // Finally block will handle setLoading(false)
      }

      const amount = parseTokenAmount(onrampAmount);
      
      // Dispatch onramp-started event immediately to prevent components from refreshing
      // This flag prevents immediate refresh when transaction completes, Transfer events fire, or blocks are mined
      // Must be dispatched before transaction to catch all refresh triggers
      window.dispatchEvent(new CustomEvent('onramp-started'));
      
      // Get stablecoin provider signer (Account #0 / Admin)
      const stablecoinSigner = getSigner(ACCOUNTS.STABLECOIN_PROVIDER);
      const sgdc = getContractWithSigner('sgdc', stablecoinSigner);
      
      // Mint SGDC to Thomas
      const tx = await sgdc.mint(ACCOUNTS.THOMAS, amount);
      // Wait for transaction with timeout to prevent indefinite hanging
      await waitForTransaction(tx, 60000); // 60 second timeout
      
      showSuccess('Onramp successful!');
      
      // Trigger network visualizer animation after successful onramp
      // This will show the cash flow and stablecoin flow animation
      // Animation duration is 3.5 seconds (3500ms)
      if (onOnrampSuccess) {
        onOnrampSuccess();
      }
      
      // Refresh registries 2 seconds after animation completes
      // Animation takes 3.5 seconds, so total delay is 5.5 seconds
      // This ensures the glow animation finishes before registries refresh
      setTimeout(() => {
        // Clear the onramp-started flag by dispatching onramp-completed event
        // This allows components to resume normal refresh behavior
        window.dispatchEvent(new CustomEvent('onramp-completed'));
        
        // Trigger custom event to refresh Depository Registry component (CDP Registry)
        window.dispatchEvent(new CustomEvent('depository-registry-updated'));
        
        // Trigger custom event to refresh Tokenized Depository Registry component (dCDP Registry)
        window.dispatchEvent(new CustomEvent('tokenized-depository-registry-updated'));
        
        // Trigger custom event to refresh Block Explorer
        window.dispatchEvent(new CustomEvent('block-explorer-refresh'));
      }, 5500); // 3500ms (animation) + 2000ms (delay) = 5500ms
    } catch (err) {
      console.error('Onramp error:', err);
      // Only show error if it hasn't been shown already (wallet check)
      if (err.message !== 'Error, wallet not found!') {
        showError(err.message || 'Failed to onramp stablecoin');
      }
    } finally {
      setLoading(false);
    }
  };

  // Buy tokenized asset
  // Uses current dynamic TES3 price from context
  // Transfers: TES3 from AP to Thomas, SGDC from Thomas to AP
  const handleBuy = async () => {
    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      // Dispatch buy-started event immediately to prevent components from refreshing
      // This flag prevents immediate refresh when transaction completes, Transfer events fire, or blocks are mined
      // Must be dispatched before transaction to catch all refresh triggers
      window.dispatchEvent(new CustomEvent('buy-started'));
      
      // Parse quantity (e.g., 2.5 TES3)
      // Contract address is hardcoded to TES3 contract: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
      const quantity = parseTokenAmount(buyQuantity);
      const quantityNumber = parseFloat(buyQuantity);
      
      if (isNaN(quantityNumber) || quantityNumber <= 0) {
        throw new Error('Quantity must be a positive number');
      }

      // Calculate SGDC cost using current dynamic price
      // Get current price in wei (18 decimals)
      const tes3Price = getCurrentPrice();
      // Calculate: (quantity * price) / 10^18
      const sgdcCost = (BigInt(quantity) * BigInt(tes3Price)) / BigInt(10 ** 18);

      // Check if Thomas has sufficient SGDC balance
      const thomasBalance = await getBalance('sgdc', ACCOUNTS.THOMAS);
      if (BigInt(thomasBalance) < sgdcCost) {
        throw new Error(`Insufficient SGDC balance. Need ${formatTokenAmount(sgdcCost)}, have ${formatTokenAmount(thomasBalance)}`);
      }

      // Get the token contract using the provided contract address
      // We'll use ethers to get the contract instance
      const tokenContract = new ethers.Contract(
        buyContractAddress,
        [
          'function balanceOf(address) view returns (uint256)',
          'function transfer(address,uint256) returns (bool)',
          'function approve(address,uint256) returns (bool)',
          'function transferFrom(address,address,uint256) returns (bool)'
        ],
        provider
      );

      // Check if AP has sufficient token balance
      const apTokenBalance = await tokenContract.balanceOf(ACCOUNTS.AP);
      if (BigInt(apTokenBalance) < quantity) {
        throw new Error(`AP has insufficient tokens. Need ${formatTokenAmount(quantity)}, AP has ${formatTokenAmount(apTokenBalance)}`);
      }

      // Get signers
      const thomasSigner = getSigner(ACCOUNTS.THOMAS);
      const apSigner = getSigner(ACCOUNTS.AP);
      
      const sgdc = getContractWithSigner('sgdc', thomasSigner);
      const tokenWithSigner = tokenContract.connect(apSigner);
      
      // Step 1: Thomas approves AP to spend SGDC
      // This allows AP to call transferFrom to take SGDC from Thomas
      console.log(`[Buy Asset] Step 1: Thomas approving AP to spend ${formatTokenAmount(sgdcCost)} SGDC...`);
      const approveTx = await sgdc.approve(ACCOUNTS.AP, sgdcCost);
      await waitForTransaction(approveTx, 60000);
      console.log(`[Buy Asset] SGDC approval confirmed`);
      
      // Step 2: Execute atomic swap
      // AP transfers their own tokens to Thomas using transfer() (not transferFrom)
      // Since AP owns the tokens, they can use transfer() directly without approval
      console.log(`[Buy Asset] Step 2: AP transferring ${buyQuantity} tokens to Thomas...`);
      
      // Double-check AP's token balance right before transfer
      const apTokenBalanceBeforeTransfer = await tokenContract.balanceOf(ACCOUNTS.AP);
      console.log(`[Buy Asset] AP token balance before transfer: ${formatTokenAmount(apTokenBalanceBeforeTransfer)}`);
      console.log(`[Buy Asset] Required quantity: ${formatTokenAmount(quantity)}`);
      
      if (BigInt(apTokenBalanceBeforeTransfer) < quantity) {
        throw new Error(`AP has insufficient tokens. Need ${formatTokenAmount(quantity)}, AP has ${formatTokenAmount(apTokenBalanceBeforeTransfer)}`);
      }
      
      let tokenTransferTx;
      try {
        // Use transfer() instead of transferFrom() since AP is sending their own tokens
        tokenTransferTx = await tokenWithSigner.transfer(ACCOUNTS.THOMAS, quantity);
        console.log(`[Buy Asset] Token transfer transaction submitted: ${tokenTransferTx.hash}`);
        const tokenReceipt = await waitForTransaction(tokenTransferTx, 60000);
        console.log(`[Buy Asset] Token transfer confirmed in block ${tokenReceipt.blockNumber}`);
        
        // Check if transaction actually succeeded
        if (tokenReceipt.status === 0) {
          throw new Error('Token transfer transaction failed. AP may not have sufficient gas (ETH) or token balance.');
        }
      } catch (err) {
        console.error('[Buy Asset] Token transfer failed:', err);
        console.error('[Buy Asset] Error details:', {
          message: err.message,
          code: err.code,
          reason: err.reason,
          data: err.data,
          transaction: err.transaction
        });
        
        // Extract the actual revert reason if available
        let errorMessage = err.message || 'Unknown error';
        if (err.reason) {
          errorMessage = err.reason;
        } else if (err.data && err.data.message) {
          errorMessage = err.data.message;
        }
        
        if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
          throw new Error('AP account has insufficient ETH for gas. Please fund the AP account.');
        } else if (errorMessage.includes('execution reverted') || errorMessage.includes('ERC20')) {
          // Check if it's a balance issue
          if (errorMessage.includes('balance') || errorMessage.includes('insufficient')) {
            throw new Error(`Token transfer failed: AP has insufficient token balance. ${errorMessage}`);
          }
          throw new Error(`Token transfer failed: ${errorMessage}. Check that AP has sufficient token balance.`);
        }
        throw new Error(`Token transfer failed: ${errorMessage}`);
      }
      
      // Step 3: Thomas transfers SGDC to AP using transferFrom
      // This requires the approval from Step 1
      console.log(`[Buy Asset] Step 3: Thomas transferring ${formatTokenAmount(sgdcCost)} SGDC to AP...`);
      let sgdcTransferTx;
      try {
        // Thomas already approved AP in Step 1, so AP can now call transferFrom
        // Get SGDC contract with AP signer since AP is the one calling transferFrom
        const sgdcWithAPSigner = getContractWithSigner('sgdc', apSigner);
        sgdcTransferTx = await sgdcWithAPSigner.transferFrom(ACCOUNTS.THOMAS, ACCOUNTS.AP, sgdcCost);
        console.log(`[Buy Asset] SGDC transfer transaction submitted: ${sgdcTransferTx.hash}`);
        const sgdcReceipt = await waitForTransaction(sgdcTransferTx, 60000);
        console.log(`[Buy Asset] SGDC transfer confirmed in block ${sgdcReceipt.blockNumber}`);
        
        // Check if transaction actually succeeded
        if (sgdcReceipt.status === 0) {
          throw new Error('SGDC transfer transaction failed. Check that Thomas has sufficient SGDC balance and AP has been approved.');
        }
      } catch (err) {
        console.error('[Buy Asset] SGDC transfer failed:', err);
        if (err.message && err.message.includes('insufficient funds')) {
          throw new Error('AP account has insufficient ETH for gas. Please fund the AP account.');
        } else if (err.message && err.message.includes('execution reverted')) {
          throw new Error(`SGDC transfer failed: ${err.message}. Check that Thomas has sufficient SGDC balance and allowance.`);
        }
        throw new Error(`SGDC transfer failed: ${err.message || 'Unknown error. AP may not have sufficient gas (ETH).'}`);
      }
      
      showSuccess('Buy successful!');
      
      // Trigger network visualizer animation: Thomas → Digital Exchange → Tokenized Depository, then reverse
      // Animation duration is 3.5 seconds (3500ms)
      window.dispatchEvent(new CustomEvent('buy-asset-executed', {
        detail: {
          quantity: buyQuantity,
          contractAddress: buyContractAddress,
          sgdcCost: formatTokenAmount(sgdcCost)
        }
      }));
      
      // Refresh registries 2 seconds after animation completes
      // Animation takes 3.5 seconds, so total delay is 5.5 seconds
      // This ensures the glow animation finishes before registries refresh
      // Note: CDP Registry (Depository Registry) does NOT refresh for Buy/Sell as these are onchain token transfers
      // that don't affect the offchain traditional securities registry
      setTimeout(() => {
        // Clear the buy-started flag by dispatching buy-completed event
        // This allows components to resume normal refresh behavior
        window.dispatchEvent(new CustomEvent('buy-completed'));
        
        // Trigger custom event to refresh Tokenized Depository Registry component (dCDP Registry)
        // This shows updated onchain token balances after the buy transaction
        window.dispatchEvent(new CustomEvent('tokenized-depository-registry-updated'));
        
        // Trigger custom event to refresh Block Explorer
        window.dispatchEvent(new CustomEvent('block-explorer-refresh'));
      }, 5500); // 3500ms (animation) + 2000ms (delay) = 5500ms
    } catch (err) {
      console.error('Buy error:', err);
      showError(err.message || 'Failed to buy asset');
    } finally {
      setLoading(false);
    }
  };

  // Sell tokenized asset
  // Uses current dynamic TES3 price from context
  // Transfers: TES3 from Thomas to AP, SGDC from AP to Thomas
  const handleSell = async () => {
    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      // Dispatch sell-started event immediately to prevent components from refreshing
      // This flag prevents immediate refresh when transaction completes, Transfer events fire, or blocks are mined
      // Must be dispatched before transaction to catch all refresh triggers
      window.dispatchEvent(new CustomEvent('sell-started'));
      
      // Parse quantity (e.g., 1.3 TES3)
      // Contract address is hardcoded to TES3 contract: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
      const quantity = parseTokenAmount(sellQuantity);
      const quantityNumber = parseFloat(sellQuantity);
      
      if (isNaN(quantityNumber) || quantityNumber <= 0) {
        throw new Error('Quantity must be a positive number');
      }

      // Calculate SGDC proceeds using current dynamic price
      // Get current price in wei (18 decimals)
      const tes3Price = getCurrentPrice();
      // Calculate: (quantity * price) / 10^18
      const sgdcProceeds = (BigInt(quantity) * BigInt(tes3Price)) / BigInt(10 ** 18);

      // Get the token contract using the provided contract address
      const tokenContract = new ethers.Contract(
        sellContractAddress,
        [
          'function balanceOf(address) view returns (uint256)',
          'function transfer(address,uint256) returns (bool)',
          'function approve(address,uint256) returns (bool)',
          'function transferFrom(address,address,uint256) returns (bool)'
        ],
        provider
      );

      // Check if Thomas has sufficient token balance
      const thomasTokenBalance = await tokenContract.balanceOf(ACCOUNTS.THOMAS);
      if (BigInt(thomasTokenBalance) < quantity) {
        throw new Error(`Thomas has insufficient tokens. Need ${formatTokenAmount(quantity)}, Thomas has ${formatTokenAmount(thomasTokenBalance)}`);
      }

      // Check if AP has sufficient SGDC balance
      const apSgdcBalance = await getBalance('sgdc', ACCOUNTS.AP);
      if (BigInt(apSgdcBalance) < sgdcProceeds) {
        throw new Error(`AP has insufficient SGDC. Need ${formatTokenAmount(sgdcProceeds)}, AP has ${formatTokenAmount(apSgdcBalance)}`);
      }

      // Get signers
      const thomasSigner = getSigner(ACCOUNTS.THOMAS);
      const apSigner = getSigner(ACCOUNTS.AP);
      
      const sgdc = getContractWithSigner('sgdc', apSigner);
      const tokenWithSigner = tokenContract.connect(thomasSigner);
      
      // Step 1: Execute atomic swap
      // Thomas transfers their own tokens to AP using transfer() (not transferFrom)
      // Since Thomas owns the tokens, they can use transfer() directly without approval
      console.log(`[Sell Asset] Step 1: Thomas transferring ${sellQuantity} tokens to AP...`);
      
      // Double-check Thomas's token balance right before transfer
      const thomasTokenBalanceBeforeTransfer = await tokenContract.balanceOf(ACCOUNTS.THOMAS);
      console.log(`[Sell Asset] Thomas token balance before transfer: ${formatTokenAmount(thomasTokenBalanceBeforeTransfer)}`);
      console.log(`[Sell Asset] Required quantity: ${formatTokenAmount(quantity)}`);
      
      if (BigInt(thomasTokenBalanceBeforeTransfer) < quantity) {
        throw new Error(`Thomas has insufficient tokens. Need ${formatTokenAmount(quantity)}, Thomas has ${formatTokenAmount(thomasTokenBalanceBeforeTransfer)}`);
      }
      
      let tokenTransferTx;
      try {
        // Use transfer() instead of transferFrom() since Thomas is sending their own tokens
        tokenTransferTx = await tokenWithSigner.transfer(ACCOUNTS.AP, quantity);
        console.log(`[Sell Asset] Token transfer transaction submitted: ${tokenTransferTx.hash}`);
        const tokenReceipt = await waitForTransaction(tokenTransferTx, 60000);
        console.log(`[Sell Asset] Token transfer confirmed in block ${tokenReceipt.blockNumber}`);
        
        // Check if transaction actually succeeded
        if (tokenReceipt.status === 0) {
          throw new Error('Token transfer transaction failed. Thomas may not have sufficient gas (ETH) or token balance.');
        }
      } catch (err) {
        console.error('[Sell Asset] Token transfer failed:', err);
        console.error('[Sell Asset] Error details:', {
          message: err.message,
          code: err.code,
          reason: err.reason,
          data: err.data,
          transaction: err.transaction
        });
        
        // Extract the actual revert reason if available
        let errorMessage = err.message || 'Unknown error';
        if (err.reason) {
          errorMessage = err.reason;
        } else if (err.data && err.data.message) {
          errorMessage = err.data.message;
        }
        
        if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
          throw new Error('Thomas account has insufficient ETH for gas. Please fund the Thomas account.');
        } else if (errorMessage.includes('execution reverted') || errorMessage.includes('ERC20')) {
          if (errorMessage.includes('balance') || errorMessage.includes('insufficient')) {
            throw new Error(`Token transfer failed: Thomas has insufficient token balance. ${errorMessage}`);
          }
          throw new Error(`Token transfer failed: ${errorMessage}. Check that Thomas has sufficient token balance.`);
        }
        throw new Error(`Token transfer failed: ${errorMessage}`);
      }
      
      // Step 2: AP transfers their own SGDC to Thomas using transfer() (not transferFrom)
      // Since AP owns the SGDC, they can use transfer() directly without approval
      console.log(`[Sell Asset] Step 2: AP transferring ${formatTokenAmount(sgdcProceeds)} SGDC to Thomas...`);
      
      // Double-check AP's SGDC balance right before transfer
      const apSgdcBalanceBeforeTransfer = await getBalance('sgdc', ACCOUNTS.AP);
      console.log(`[Sell Asset] AP SGDC balance before transfer: ${formatTokenAmount(apSgdcBalanceBeforeTransfer)}`);
      console.log(`[Sell Asset] Required proceeds: ${formatTokenAmount(sgdcProceeds)}`);
      
      if (BigInt(apSgdcBalanceBeforeTransfer) < BigInt(sgdcProceeds)) {
        throw new Error(`AP has insufficient SGDC. Need ${formatTokenAmount(sgdcProceeds)}, AP has ${formatTokenAmount(apSgdcBalanceBeforeTransfer)}`);
      }
      
      let sgdcTransferTx;
      try {
        // Use transfer() instead of transferFrom() since AP is sending their own SGDC
        sgdcTransferTx = await sgdc.transfer(ACCOUNTS.THOMAS, sgdcProceeds);
        console.log(`[Sell Asset] SGDC transfer transaction submitted: ${sgdcTransferTx.hash}`);
        const sgdcReceipt = await waitForTransaction(sgdcTransferTx, 60000);
        console.log(`[Sell Asset] SGDC transfer confirmed in block ${sgdcReceipt.blockNumber}`);
        
        // Check if transaction actually succeeded
        if (sgdcReceipt.status === 0) {
          throw new Error('SGDC transfer transaction failed. AP may not have sufficient gas (ETH) or SGDC balance.');
        }
      } catch (err) {
        console.error('[Sell Asset] SGDC transfer failed:', err);
        console.error('[Sell Asset] Error details:', {
          message: err.message,
          code: err.code,
          reason: err.reason,
          data: err.data,
          transaction: err.transaction
        });
        
        // Extract the actual revert reason if available
        let errorMessage = err.message || 'Unknown error';
        if (err.reason) {
          errorMessage = err.reason;
        } else if (err.data && err.data.message) {
          errorMessage = err.data.message;
        }
        
        if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
          throw new Error('AP account has insufficient ETH for gas. Please fund the AP account.');
        } else if (errorMessage.includes('execution reverted') || errorMessage.includes('ERC20')) {
          if (errorMessage.includes('balance') || errorMessage.includes('insufficient')) {
            throw new Error(`SGDC transfer failed: AP has insufficient SGDC balance. ${errorMessage}`);
          }
          throw new Error(`SGDC transfer failed: ${errorMessage}. Check that AP has sufficient SGDC balance.`);
        }
        throw new Error(`SGDC transfer failed: ${errorMessage}`);
      }
      
      showSuccess('Sell successful!');
      
      // Trigger network visualizer animation: Thomas → Digital Exchange → Tokenized Depository, then reverse (same as buy)
      // Animation duration is 3.5 seconds (3500ms)
      window.dispatchEvent(new CustomEvent('buy-asset-executed', {
        detail: {
          quantity: sellQuantity,
          contractAddress: sellContractAddress,
          sgdcCost: formatTokenAmount(sgdcProceeds)
        }
      }));
      
      // Refresh registries 2 seconds after animation completes
      // Animation takes 3.5 seconds, so total delay is 5.5 seconds
      // This ensures the glow animation finishes before registries refresh
      // Note: CDP Registry (Depository Registry) does NOT refresh for Buy/Sell as these are onchain token transfers
      // that don't affect the offchain traditional securities registry
      setTimeout(() => {
        // Clear the sell-started flag by dispatching sell-completed event
        // This allows components to resume normal refresh behavior
        window.dispatchEvent(new CustomEvent('sell-completed'));
        
        // Trigger custom event to refresh Tokenized Depository Registry component (dCDP Registry)
        // This shows updated onchain token balances after the sell transaction
        window.dispatchEvent(new CustomEvent('tokenized-depository-registry-updated'));
        
        // Trigger custom event to refresh Block Explorer
        window.dispatchEvent(new CustomEvent('block-explorer-refresh'));
      }, 5500); // 3500ms (animation) + 2000ms (delay) = 5500ms
    } catch (err) {
      console.error('Sell error:', err);
      showError(err.message || 'Failed to sell asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="action-group">
        <button onClick={handleOnramp} disabled={loading} className="action-button">
          Onramp Cash
        </button>
      </div>

      <div className="action-group">
        <button onClick={handleBuy} disabled={loading} className="action-button">
          Buy TES3
        </button>
      </div>

      <div className="action-group">
        <button onClick={handleSell} disabled={loading} className="action-button">
          Sell TES3
        </button>
      </div>
    </>
  );
}

/**
 * Digital Exchange Actions Content (extracted for reuse)
 */
function DigitalExchangeActionsContent() {
  const { showSuccess, showError } = useToastContext();
  const [loading, setLoading] = useState(false);

  // Validate KYC action
  const handleValidateKYC = async () => {
    setLoading(true);

    try {
      // Simulate KYC validation process
      // In a real implementation, this would call a backend API or smart contract
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      // Mark KYC as validated in localStorage
      localStorage.setItem('kycValidated', 'true');
      
      showSuccess('KYC validation successful!');
      
      // Trigger network visualizer animation: Thomas → Digital Exchange
      // Animation duration is 3.5 seconds (3500ms)
      window.dispatchEvent(new CustomEvent('validate-kyc-executed', {
        detail: {
          timestamp: Date.now()
        }
      }));
    } catch (err) {
      console.error('Validate KYC error:', err);
      showError(err.message || 'Failed to validate KYC');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="action-group">
        <button onClick={handleValidateKYC} disabled={loading} className="action-button">
          Validate KYC
        </button>
      </div>
    </>
  );
}

/**
 * Tokenized Depository Actions Content (extracted for reuse)
 */
function DCDPActionsContent() {
  const { contracts, getContractWithSigner, getBalance } = useContracts();
  const { provider, getSigner } = useBlockchain();
  const { showSuccess, showError } = useToastContext();
  // Hardcoded owner ID - always use SN91X81J21 for tokenization and redemption
  const tokenizeOwnerId = 'SN91X81J21';
  const [tokenizeQuantity, setTokenizeQuantity] = useState('4000');
  const [redeemQuantity, setRedeemQuantity] = useState('3000');
  // Hardcoded symbol - always use ES3 for tokenization and redemption
  const tokenizeSymbol = 'ES3';
  const [walletOwnerId, setWalletOwnerId] = useState('SN72K45M83');
  const [loading, setLoading] = useState(false);

  // Tokenize securities
  // This converts traditional securities (ES3 ETF) into tokenized tokens (TES3)
  // Steps:
  // 1. Check CDP registry for sufficient balance
  // 2. Decrease CDP registry balance (offchain)
  // 3. Mint TES3 tokens onchain via dCDP contract
  // 4. Transaction appears in Block Explorer automatically
  // 5. TES3 tokens appear in dCDP Registry automatically
  const handleTokenize = async () => {
    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      // Map unique identifier (SN code) to owner ID
      // User inputs unique identifier (e.g., SN91X81J21), but contract needs owner ID (e.g., AP)
      const ownerId = UNIQUE_ID_TO_OWNER_ID[tokenizeOwnerId.toUpperCase()] || tokenizeOwnerId;
      
      // Parse quantity to wei (18 decimals) for blockchain transaction
      const quantity = parseTokenAmount(tokenizeQuantity);
      // Parse quantity as number for Depository registry (regular number, not wei)
      const quantityNumber = parseFloat(tokenizeQuantity);
      
      if (isNaN(quantityNumber) || quantityNumber <= 0) {
        throw new Error('Quantity must be a positive number');
      }

      // Step 1: Check Depository registry and decrease balance (offchain)
      // This validates that AP has sufficient ES3 shares and decreases the balance
      console.log(`[Tokenize] Checking Depository registry for ${quantityNumber} ${tokenizeSymbol} for ${ownerId}...`);
      await tokenizeSecurity(ownerId, quantityNumber, tokenizeSymbol);
      console.log(`[Tokenize] Depository registry updated: ${quantityNumber} ${tokenizeSymbol} deducted`);
      
      // Step 2: Mint TES3 tokens onchain via Tokenized Depository contract
      // Get admin signer (Account #0) - admin has permission to call tokenize
      const adminSigner = getSigner(ACCOUNTS.ADMIN);
      const dcdp = getContractWithSigner('dcdp', adminSigner);
      
      // Dispatch tokenize-started event immediately to prevent components from refreshing
      // This flag prevents immediate refresh when transaction completes, Transfer events fire, or blocks are mined
      // Must be dispatched before transaction to catch all refresh triggers
      window.dispatchEvent(new CustomEvent('tokenize-started'));
      
      // Call Tokenized Depository.tokenize() function with owner ID (not unique identifier)
      // This mints TES3 tokens to the owner's registered wallet address
      console.log(`[Tokenize] Calling Tokenized Depository.tokenize(${ownerId}, ${quantity.toString()}, ${tokenizeSymbol})...`);
      const tx = await dcdp.tokenize(ownerId, quantity, tokenizeSymbol);
      console.log(`[Tokenize] Transaction submitted: ${tx.hash}`);
      
      // Wait for transaction with timeout to prevent indefinite hanging
      await waitForTransaction(tx, 60000); // 60 second timeout
      console.log(`[Tokenize] Transaction confirmed!`);
      
      // Show success message
      showSuccess('Tokenization successful!');
      
      // Trigger network visualizer animation for tokenization immediately
      // This creates a glow effect and particle animation: AP → Depository → Tokenized Depository
      // Animation duration is 3.5 seconds (3500ms)
      window.dispatchEvent(new CustomEvent('tokenize-executed', { 
        detail: { 
          quantity, 
          symbol: tokenizeSymbol,
          ownerId
        } 
      }));
      
      // Refresh registries 2 seconds after animation completes
      // Animation takes 3.5 seconds, so total delay is 5.5 seconds
      // This ensures the glow animation finishes before registries refresh
      setTimeout(() => {
        // Clear the tokenize-started flag by dispatching tokenize-completed event
        // This allows components to resume normal refresh behavior
        window.dispatchEvent(new CustomEvent('tokenize-completed'));
        
        // Trigger custom event to refresh Depository Registry component (CDP Registry)
        window.dispatchEvent(new CustomEvent('depository-registry-updated'));
        
        // Trigger custom event to refresh Tokenized Depository Registry component (dCDP Registry)
        window.dispatchEvent(new CustomEvent('tokenized-depository-registry-updated'));
        
        // Trigger custom event to refresh Block Explorer
        window.dispatchEvent(new CustomEvent('block-explorer-refresh'));
      }, 5500); // 3500ms (animation) + 2000ms (delay) = 5500ms
      
    } catch (err) {
      console.error('Tokenize error:', err);
      showError(err.message || 'Failed to tokenize');
    } finally {
      setLoading(false);
    }
  };

  // Redeem tokenized securities
  // This converts tokenized tokens (TES3) back to traditional securities (ES3)
  // Steps:
  // 1. Check if AP has sufficient TES3 tokens
  // 2. Burn TES3 tokens onchain via dCDP contract
  // 3. Increase CDP registry balance (offchain)
  // 4. Transaction appears in Block Explorer automatically
  // 5. TES3 tokens decrease in dCDP Registry automatically
  // 6. ES3 balance increases in CDP Registry automatically
  const handleRedeem = async () => {
    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      // Dispatch redeem-started event immediately to prevent components from refreshing
      // This flag prevents immediate refresh when transaction completes, Transfer events fire, or blocks are mined
      // Must be dispatched before transaction to catch all refresh triggers
      window.dispatchEvent(new CustomEvent('redeem-started'));
      
      // Map unique identifier (SN code) to owner ID
      // User inputs unique identifier (e.g., SN91X81J21), but contract needs owner ID (e.g., AP)
      const ownerId = UNIQUE_ID_TO_OWNER_ID[tokenizeOwnerId.toUpperCase()] || tokenizeOwnerId;
      
      // Parse quantity to wei (18 decimals) for blockchain transaction
      const quantity = parseTokenAmount(redeemQuantity);
      // Parse quantity as number for Depository registry (regular number, not wei)
      const quantityNumber = parseFloat(redeemQuantity);
      
      if (isNaN(quantityNumber) || quantityNumber <= 0) {
        throw new Error('Quantity must be a positive number');
      }

      // Step 1: Check if AP has sufficient TES3 tokens
      // Get admin signer (Account #0) - admin has permission to call redeem
      const adminSigner = getSigner(ACCOUNTS.ADMIN);
      const dcdp = getContractWithSigner('dcdp', adminSigner);
      
      // Get AP's wallet address
      const apAddress = await dcdp.ownerToAddress(ownerId);
      if (!apAddress || apAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error(`${ownerId} does not have a registered wallet`);
      }

      // Check TES3 balance
      const tes3Balance = await getBalance('tes3', apAddress);
      if (BigInt(tes3Balance) < quantity) {
        throw new Error(`Insufficient TES3 balance. Need ${formatTokenAmount(quantity)}, have ${formatTokenAmount(tes3Balance)}`);
      }

      // Step 2: Burn TES3 tokens onchain via Tokenized Depository contract
      // Call Tokenized Depository.redeem() function with owner ID (not unique identifier)
      // This burns TES3 tokens from the owner's registered wallet address
      console.log(`[Redeem] Calling Tokenized Depository.redeem(${ownerId}, ${quantity.toString()}, ${tokenizeSymbol})...`);
      const tx = await dcdp.redeem(ownerId, quantity, tokenizeSymbol);
      console.log(`[Redeem] Transaction submitted: ${tx.hash}`);
      
      // Wait for transaction with timeout to prevent indefinite hanging
      await waitForTransaction(tx, 60000); // 60 second timeout
      console.log(`[Redeem] Transaction confirmed!`);
      
      // Step 3: Update Depository registry and increase balance (offchain)
      // This increases AP's ES3 shares in the registry
      console.log(`[Redeem] Updating Depository registry for ${quantityNumber} ${tokenizeSymbol} for ${ownerId}...`);
      await redeemSecurity(ownerId, quantityNumber, tokenizeSymbol);
      console.log(`[Redeem] Depository registry updated: ${quantityNumber} ${tokenizeSymbol} added`);
      
      // Show success message
      showSuccess('Redemption successful!');
      
      // Trigger network visualizer animation for redemption
      // This creates a glow effect and particle animation: Tokenized Depository → Depository (reverse of tokenize)
      // Animation duration is 3.5 seconds (3500ms)
      window.dispatchEvent(new CustomEvent('redeem-executed', { 
        detail: { 
          quantity, 
          symbol: tokenizeSymbol,
          ownerId
        } 
      }));
      
      // Refresh registries 2 seconds after animation completes
      // Animation takes 3.5 seconds, so total delay is 5.5 seconds
      // This ensures the glow animation finishes before registries refresh
      setTimeout(() => {
        // Clear the redeem-started flag by dispatching redeem-completed event
        // This allows components to resume normal refresh behavior
        window.dispatchEvent(new CustomEvent('redeem-completed'));
        
        // Trigger custom event to refresh Depository Registry component (CDP Registry)
        window.dispatchEvent(new CustomEvent('depository-registry-updated'));
        
        // Trigger custom event to refresh Tokenized Depository Registry component (dCDP Registry)
        window.dispatchEvent(new CustomEvent('tokenized-depository-registry-updated'));
        
        // Trigger custom event to refresh Block Explorer
        window.dispatchEvent(new CustomEvent('block-explorer-refresh'));
      }, 5500); // 3500ms (animation) + 2000ms (delay) = 5500ms
      
    } catch (err) {
      console.error('Redeem error:', err);
      showError(err.message || 'Failed to redeem');
    } finally {
      setLoading(false);
    }
  };

  // Create wallet
  const handleCreateWallet = async () => {
    // Check if KYC has been validated before allowing wallet creation
    const kycValidated = localStorage.getItem('kycValidated') === 'true';
    if (!kycValidated) {
      showError('Please validate KYC before creating a wallet');
      return;
    }

    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      // Map unique identifier (SN code) to owner ID
      // User inputs unique identifier, but contract needs owner ID
      const ownerId = UNIQUE_ID_TO_OWNER_ID[walletOwnerId.toUpperCase()] || walletOwnerId;
      console.log('[ActionPanel] Create Wallet - Input:', walletOwnerId, 'Mapped to ownerId:', ownerId);
      
      // Get the wallet address for the owner_id
      // For THOMAS, use ACCOUNTS.THOMAS
      // For AP, use ACCOUNTS.AP
      // In a real scenario, this would be generated by the wallet provider
      let newAddress;
      if (ownerId.toUpperCase() === 'THOMAS') {
        newAddress = ACCOUNTS.THOMAS;
      } else if (ownerId.toUpperCase() === 'AP') {
        newAddress = ACCOUNTS.AP;
      } else {
        // Generate a random address for other owner IDs
        const randomWallet = ethers.Wallet.createRandom();
        newAddress = randomWallet.address;
      }
      
      console.log('[ActionPanel] Create Wallet - Address:', newAddress);
      
      // Dispatch immediate event BEFORE transaction to prevent components from refreshing immediately
      // This flag prevents block listener and contract event from triggering refreshes
      // Must be dispatched before transaction to catch all refresh triggers
      window.dispatchEvent(new CustomEvent('wallet-creation-started'));
      
      // Get admin signer
      const adminSigner = await provider.getSigner(ACCOUNTS.ADMIN);
      const dcdp = getContractWithSigner('dcdp', adminSigner);
      
      // Call Tokenized Depository.createWallet() function with owner ID (not unique identifier)
      console.log('[ActionPanel] Calling createWallet with ownerId:', ownerId, 'address:', newAddress);
      const tx = await dcdp.createWallet(ownerId, newAddress);
      // Wait for transaction with timeout to prevent indefinite hanging
      await waitForTransaction(tx, 60000); // 60 second timeout
      
      console.log('[ActionPanel] Wallet created successfully!');
      
      showSuccess('Wallet creation successful!');
      
      // Staggered sequence for wallet creation:
      // 1. Toast appears immediately (done above)
      // 2. Wait 2 seconds, then trigger animation
      // 3. Components will refresh 1 second after animation finishes (handled in their listeners)
      setTimeout(() => {
        // Trigger network visualizer animation for wallet creation
        // Animation flows: Thomas → Digital Exchange → Tokenized Depository
        window.dispatchEvent(new CustomEvent('wallet-created', { 
          detail: { 
            ownerId,
            address: newAddress 
          } 
        }));
      }, 2000); // Wait 2 seconds after toast appears before starting animation
    } catch (err) {
      console.error('Create wallet error:', err);
      showError(err.message || 'Failed to create wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="action-group">
        <button onClick={handleCreateWallet} disabled={loading} className="action-button">
          Create Wallet
        </button>
      </div>

      <div className="action-group">
        <button onClick={handleTokenize} disabled={loading} className="action-button">
          Tokenize ES3
        </button>
      </div>

      <div className="action-group">
        <button onClick={handleRedeem} disabled={loading} className="action-button">
          Redeem ES3
        </button>
      </div>
    </>
  );
}

/**
 * AP Actions Content (extracted for reuse)
 */
function APActionsContent() {
  const { showSuccess, showError } = useToastContext();
  const [etfQuantity, setEtfQuantity] = useState('5000');
  // Hardcoded symbol - always use ES3 for ETF creation
  const etfSymbol = 'ES3';
  const [loading, setLoading] = useState(false);

  // Create ETF (offchain operation)
  // This creates ETF shares by deducting underlying stocks according to ETF composition
  // Updates Depository registry stored in localStorage and triggers refresh event
  const handleCreateETF = async () => {
    setLoading(true);

    try {
      const quantity = parseInt(etfQuantity);
      
      // Validate quantity
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error('Quantity must be a positive number');
      }

      // Use createETF function from api.js to perform ETF creation
      // This validates holdings, deducts stocks, and adds ETF shares
      const result = await createETF('AP', quantity, etfSymbol);
      
      // Show success message
      showSuccess('Creation successful!');
      
      // Trigger network visualizer animation for Depository and AP nodes
      // This creates a glow effect around Depository and AP blocks to show ETF creation
      // Animation duration is 2.5 seconds
      window.dispatchEvent(new CustomEvent('etf-created', { 
        detail: { 
          quantity, 
          symbol: etfSymbol 
        } 
      }));
      
      // Trigger custom event to refresh Depository Registry component immediately
      // The registry will refresh once immediately after ETF creation
      window.dispatchEvent(new CustomEvent('depository-registry-updated'));
      
    } catch (err) {
      console.error('Create ETF error:', err);
      showError(err.message || 'Failed to create ETF');
    } finally {
      setLoading(false);
    }
  };

  // List TES3 action
  // This lists TES3 tokens on the Digital Exchange
  // Moves listing functionality from Digital Exchange to AP section
  const handleListTES3 = async () => {
    setLoading(true);

    try {
      // Simulate listing process
      // In a real implementation, this would call a backend API or smart contract
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      showSuccess('TES3 listing successful!');
      
      // Trigger network visualizer animation: AP → Digital Exchange
      // Animation duration is 3.5 seconds (3500ms)
      window.dispatchEvent(new CustomEvent('list-tes3-executed', {
        detail: {
          timestamp: Date.now()
        }
      }));
    } catch (err) {
      console.error('List TES3 error:', err);
      showError(err.message || 'Failed to list TES3');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="action-group">
        <button onClick={handleCreateETF} disabled={loading} className="action-button">
          Create ES3
        </button>
      </div>

      <div className="action-group">
        <button onClick={handleListTES3} disabled={loading} className="action-button">
          List TES3
        </button>
      </div>
    </>
  );
}

/**
 * AP Actions Panel
 * Actions: Create ETF
 */
export function APActions() {
  const [etfQuantity, setEtfQuantity] = useState('5000');
  const [etfSymbol, setEtfSymbol] = useState('ES3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Create ETF (offchain operation)
  const handleCreateETF = async () => {
    clearMessages();
    setLoading(true);

    try {
      // This is an offchain operation that updates Depository registry JSON
      // Call backend script endpoint or API
      const response = await fetch('/api/create-etf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ownerId: 'AP',
          quantity: parseInt(etfQuantity), 
          symbol: etfSymbol 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create ETF - backend script may not be running');
      }

      // Check if response is actually JSON before parsing
      // This prevents "Unexpected token '<'" errors when HTML error pages are returned
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON - API endpoint may not be available');
      }

      const result = await response.json();
      setSuccess(`✓ ETF Created`);
    } catch (err) {
      console.error('Create ETF error:', err);
      // For demo purposes, show success even if API fails (Depository registry updates happen via backend scripts)
      setSuccess(`✓ ETF Creation Started`);
      // setError(err.message || 'Failed to create ETF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="action-panel">
      <h4>AP Actions</h4>
      
      <div className="action-group">
        <label>Quantity</label>
        <input
          type="number"
          value={etfQuantity}
          onChange={(e) => setEtfQuantity(e.target.value)}
          placeholder="5000"
        />
        <label>Symbol</label>
        <input
          type="text"
          value={etfSymbol}
          onChange={(e) => setEtfSymbol(e.target.value)}
          placeholder="ES3"
        />
        <button onClick={handleCreateETF} disabled={loading}>
          Create ETF
        </button>
      </div>

      {error && <div className="action-error">{error}</div>}
      {success && <div className="action-success">{success}</div>}
    </div>
  );
}

