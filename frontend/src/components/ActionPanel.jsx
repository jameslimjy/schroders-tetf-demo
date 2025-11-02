/**
 * Action Panel Component
 * Contains action buttons for different stakeholders
 * Supports Thomas Actions, dCDP Actions, and AP Actions
 */

/* eslint-env es2020 */
import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useContracts } from '../hooks/useContracts';
import { useBlockchain } from '../hooks/useBlockchain';
import { useToastContext } from '../contexts/ToastContext';
import { parseTokenAmount, formatTokenAmount, waitForTransaction } from '../utils/contractHelpers';
import { TES3_PRICE, ACCOUNTS, UNIQUE_ID_TO_OWNER_ID } from '../utils/constants';
import { createETF, tokenizeSecurity } from '../utils/api';
import './ActionPanel.css';

/**
 * Thomas Actions Panel
 * Actions: Onramp, Buy Asset, Sell Asset
 */
export function ThomasActions() {
  const { contracts, getContractWithSigner, getBalance } = useContracts();
  const { provider, getSigner } = useBlockchain();
  const [onrampAmount, setOnrampAmount] = useState('1000');
  const [buyQuantity, setBuyQuantity] = useState('5.5');
  const [sellQuantity, setSellQuantity] = useState('3');
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
      
      setSuccess(`Onramp successful: ${onrampAmount} SGDC minted to Thomas`);
    } catch (err) {
      console.error('Onramp error:', err);
      setError(err.message || 'Failed to onramp stablecoin');
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
      const cost = (BigInt(quantity) * BigInt(TES3_PRICE)) / BigInt(10 ** 18);

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
      
      setSuccess(`Buy successful: ${buyQuantity} TES3 for ${formatTokenAmount(cost)} SGDC`);
    } catch (err) {
      console.error('Buy error:', err);
      setError(err.message || 'Failed to buy asset');
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
      const proceeds = (BigInt(quantity) * BigInt(TES3_PRICE)) / BigInt(10 ** 18);

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
      
      setSuccess(`Sell successful: ${sellQuantity} TES3 for ${formatTokenAmount(proceeds)} SGDC`);
    } catch (err) {
      console.error('Sell error:', err);
      setError(err.message || 'Failed to sell asset');
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
          placeholder="1000"
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
          placeholder="5.5"
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
          placeholder="3"
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
 * dCDP Actions Panel
 * Actions: Tokenize, Create Wallet
 */
export function DCDPActions() {
  const { contracts, getContractWithSigner } = useContracts();
  const { provider, getSigner } = useBlockchain();
  const [tokenizeOwnerId, setTokenizeOwnerId] = useState('SN91X81J21');
  const [tokenizeQuantity, setTokenizeQuantity] = useState('50');
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
      
      // Call dCDP.tokenize() function with owner ID (not unique identifier)
      // Note: This assumes offchain CDP registry validation has occurred
      const tx = await dcdp.tokenize(ownerId, quantity, tokenizeSymbol);
      // Wait for transaction with timeout to prevent indefinite hanging
      await waitForTransaction(tx, 60000); // 60 second timeout
      
      setSuccess(`Tokenize successful: ${tokenizeQuantity} ${tokenizeSymbol} for ${tokenizeOwnerId} (${ownerId})`);
    } catch (err) {
      console.error('Tokenize error:', err);
      setError(err.message || 'Failed to tokenize');
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
      
      // Call dCDP.createWallet() function with owner ID (not unique identifier)
      const tx = await dcdp.createWallet(ownerId, newAddress);
      // Wait for transaction with timeout to prevent indefinite hanging
      await waitForTransaction(tx, 60000); // 60 second timeout
      
      setSuccess(`Wallet created: ${walletOwnerId} (${ownerId}) -> ${newAddress.slice(0, 10)}...`);
    } catch (err) {
      console.error('Create wallet error:', err);
      setError(err.message || 'Failed to create wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="action-panel">
      <h4>dCDP Actions</h4>
      
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
          placeholder="50"
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
 * Sections: Thomas, dCDP, AP
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
          <img 
            src={`${LOGO_BASE_PATH}thomas-logo.png`} 
            alt="Thomas" 
            className="action-section-logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h4>Thomas</h4>
        </div>
        <ThomasActionsContent onOnrampSuccess={onOnrampSuccess} />
      </div>

      {/* dCDP Section */}
      <div className="action-section action-section-dcdp">
        <div className="action-section-header">
          <img 
            src={`${LOGO_BASE_PATH}dcdp-logo.png`} 
            alt="dCDP" 
            className="action-section-logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h4>dCDP</h4>
        </div>
        <DCDPActionsContent />
      </div>

      {/* AP Section */}
      <div className="action-section action-section-ap">
        <div className="action-section-header">
          <img 
            src={`${LOGO_BASE_PATH}ap-logo.png`} 
            alt="AP" 
            className="action-section-logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
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
  const [onrampAmount, setOnrampAmount] = useState('1000');
  const [buyQuantity, setBuyQuantity] = useState('2.5');
  const [buyContractAddress, setBuyContractAddress] = useState('');
  const [sellQuantity, setSellQuantity] = useState('1.3');
  const [sellContractAddress, setSellContractAddress] = useState('');
  const [loading, setLoading] = useState(false);

  // Onramp stablecoin
  const handleOnramp = async () => {
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
      
      showSuccess(`Onramp successful: ${onrampAmount} SGDC minted to Thomas`);
      
      // Trigger network visualizer animation after successful onramp
      // This will show the cash flow and stablecoin flow animation
      if (onOnrampSuccess) {
        onOnrampSuccess();
      }
    } catch (err) {
      console.error('Onramp error:', err);
      showError(err.message || 'Failed to onramp stablecoin');
    } finally {
      setLoading(false);
    }
  };

  // Buy tokenized asset
  // Rate: 100:1 (e.g., 2.5 TES3 = 250 SGDC)
  // Transfers: TES3 from AP to Thomas, SGDC from Thomas to AP
  const handleBuy = async () => {
    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      // Validate contract address
      if (!buyContractAddress || !buyContractAddress.startsWith('0x')) {
        throw new Error('Please enter a valid contract address');
      }

      // Parse quantity (e.g., 2.5 TES3)
      const quantity = parseTokenAmount(buyQuantity);
      const quantityNumber = parseFloat(buyQuantity);
      
      if (isNaN(quantityNumber) || quantityNumber <= 0) {
        throw new Error('Quantity must be a positive number');
      }

      // Calculate SGDC cost using 100:1 rate
      // If quantity is 2.5 TES3, cost is 250 SGDC
      const sgdcCost = parseTokenAmount((quantityNumber * 100).toString());

      // Check if Thomas has sufficient SGDC balance
      const thomasBalance = await getBalance('sgdc', ACCOUNTS.THOMAS);
      if (BigInt(thomasBalance) < BigInt(sgdcCost)) {
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
      
      showSuccess(`Buy successful: ${buyQuantity} tokens for ${formatTokenAmount(sgdcCost)} SGDC`);
      
      // Trigger dCDP Registry refresh to show updated balances with phase in/out animation
      window.dispatchEvent(new CustomEvent('dcdp-registry-updated'));
      
      // Trigger network visualizer animation: Thomas → Digital Exchange → dCDP, then reverse
      window.dispatchEvent(new CustomEvent('buy-asset-executed', {
        detail: {
          quantity: buyQuantity,
          contractAddress: buyContractAddress,
          sgdcCost: formatTokenAmount(sgdcCost)
        }
      }));
    } catch (err) {
      console.error('Buy error:', err);
      showError(err.message || 'Failed to buy asset');
    } finally {
      setLoading(false);
    }
  };

  // Sell tokenized asset
  // Rate: 100:1 (e.g., 1.3 TES3 = 130 SGDC)
  // Transfers: TES3 from Thomas to AP, SGDC from AP to Thomas
  const handleSell = async () => {
    setLoading(true);

    try {
      if (!provider) {
        throw new Error('Provider not connected');
      }

      // Validate contract address
      if (!sellContractAddress || !sellContractAddress.startsWith('0x')) {
        throw new Error('Please enter a valid contract address');
      }

      // Parse quantity (e.g., 1.3 TES3)
      const quantity = parseTokenAmount(sellQuantity);
      const quantityNumber = parseFloat(sellQuantity);
      
      if (isNaN(quantityNumber) || quantityNumber <= 0) {
        throw new Error('Quantity must be a positive number');
      }

      // Calculate SGDC proceeds using 100:1 rate
      // If quantity is 1.3 TES3, proceeds is 130 SGDC
      const sgdcProceeds = parseTokenAmount((quantityNumber * 100).toString());

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
      if (BigInt(apSgdcBalance) < BigInt(sgdcProceeds)) {
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
      
      showSuccess(`Sell successful: ${sellQuantity} tokens for ${formatTokenAmount(sgdcProceeds)} SGDC`);
      
      // Trigger dCDP Registry refresh to show updated balances with phase in/out animation
      window.dispatchEvent(new CustomEvent('dcdp-registry-updated'));
      
      // Trigger network visualizer animation: Thomas → Digital Exchange → dCDP, then reverse (same as buy)
      window.dispatchEvent(new CustomEvent('buy-asset-executed', {
        detail: {
          quantity: sellQuantity,
          contractAddress: sellContractAddress,
          sgdcCost: formatTokenAmount(sgdcProceeds)
        }
      }));
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
        <div className="action-name">Onramp Cash</div>
        <div className="action-input-row">
          <input
            type="number"
            value={onrampAmount}
            onChange={(e) => setOnrampAmount(e.target.value)}
            placeholder="insert amount"
          />
          <button onClick={handleOnramp} disabled={loading} className="action-submit-btn" title="Onramp">
            &gt;
            <i>✓</i>
          </button>
        </div>
      </div>

      <div className="action-group">
        <div className="action-name">Buy Asset</div>
        <div className="action-multi-input">
          <div className="action-input-stack">
            <input
              type="number"
              step="0.1"
              value={buyQuantity}
              onChange={(e) => setBuyQuantity(e.target.value)}
              placeholder="insert quantity"
            />
            <input
              type="text"
              value={buyContractAddress}
              onChange={(e) => setBuyContractAddress(e.target.value)}
              placeholder="insert contract address"
            />
          </div>
          <button onClick={handleBuy} disabled={loading} className="action-submit-btn action-submit-btn-centered" title="Buy Asset">
            &gt;
            <i>✓</i>
          </button>
        </div>
      </div>

      <div className="action-group">
        <div className="action-name">Sell Asset</div>
        <div className="action-multi-input">
          <div className="action-input-stack">
            <input
              type="number"
              step="0.1"
              value={sellQuantity}
              onChange={(e) => setSellQuantity(e.target.value)}
              placeholder="insert quantity"
            />
            <input
              type="text"
              value={sellContractAddress}
              onChange={(e) => setSellContractAddress(e.target.value)}
              placeholder="insert contract address"
            />
          </div>
          <button onClick={handleSell} disabled={loading} className="action-submit-btn action-submit-btn-centered" title="Sell Asset">
            &gt;
            <i>✓</i>
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * dCDP Actions Content (extracted for reuse)
 */
function DCDPActionsContent() {
  const { contracts, getContractWithSigner } = useContracts();
  const { provider, getSigner } = useBlockchain();
  const { showSuccess, showError } = useToastContext();
  const [tokenizeOwnerId, setTokenizeOwnerId] = useState('SN91X81J21');
  const [tokenizeQuantity, setTokenizeQuantity] = useState('50');
  const [tokenizeSymbol, setTokenizeSymbol] = useState('ES3');
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
      // Parse quantity as number for CDP registry (regular number, not wei)
      const quantityNumber = parseFloat(tokenizeQuantity);
      
      if (isNaN(quantityNumber) || quantityNumber <= 0) {
        throw new Error('Quantity must be a positive number');
      }

      // Step 1: Check CDP registry and decrease balance (offchain)
      // This validates that AP has sufficient ES3 shares and decreases the balance
      console.log(`[Tokenize] Checking CDP registry for ${quantityNumber} ${tokenizeSymbol} for ${ownerId}...`);
      await tokenizeSecurity(ownerId, quantityNumber, tokenizeSymbol);
      console.log(`[Tokenize] CDP registry updated: ${quantityNumber} ${tokenizeSymbol} deducted`);
      
      // Step 2: Mint TES3 tokens onchain via dCDP contract
      // Get admin signer (Account #0) - admin has permission to call tokenize
      const adminSigner = getSigner(ACCOUNTS.ADMIN);
      const dcdp = getContractWithSigner('dcdp', adminSigner);
      
      // Call dCDP.tokenize() function with owner ID (not unique identifier)
      // This mints TES3 tokens to the owner's registered wallet address
      console.log(`[Tokenize] Calling dCDP.tokenize(${ownerId}, ${quantity.toString()}, ${tokenizeSymbol})...`);
      const tx = await dcdp.tokenize(ownerId, quantity, tokenizeSymbol);
      console.log(`[Tokenize] Transaction submitted: ${tx.hash}`);
      
      // Wait for transaction with timeout to prevent indefinite hanging
      await waitForTransaction(tx, 60000); // 60 second timeout
      console.log(`[Tokenize] Transaction confirmed!`);
      
      // Show success message
      showSuccess(
        `Tokenize successful: ${tokenizeQuantity} ${tokenizeSymbol} tokenized. ` +
        `Minted ${tokenizeQuantity} TES3 tokens to ${ownerId}. ` +
        `Transaction: ${tx.hash.slice(0, 10)}...`
      );
      
      // Trigger custom event to refresh CDP Registry component
      // This ensures the registry updates immediately to show decreased balance
      window.dispatchEvent(new CustomEvent('cdp-registry-updated'));
      
      // Trigger network visualizer animation for tokenization
      // This creates a glow effect and particle animation: AP → CDP → dCDP
      window.dispatchEvent(new CustomEvent('tokenize-executed', { 
        detail: { 
          quantity, 
          symbol: tokenizeSymbol,
          ownerId
        } 
      }));
      
    } catch (err) {
      console.error('Tokenize error:', err);
      showError(err.message || 'Failed to tokenize');
    } finally {
      setLoading(false);
    }
  };

  // Create wallet
  const handleCreateWallet = async () => {
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
      
      // Get admin signer
      const adminSigner = await provider.getSigner(ACCOUNTS.ADMIN);
      const dcdp = getContractWithSigner('dcdp', adminSigner);
      
      // Call dCDP.createWallet() function with owner ID (not unique identifier)
      console.log('[ActionPanel] Calling createWallet with ownerId:', ownerId, 'address:', newAddress);
      const tx = await dcdp.createWallet(ownerId, newAddress);
      // Wait for transaction with timeout to prevent indefinite hanging
      await waitForTransaction(tx, 60000); // 60 second timeout
      
      console.log('[ActionPanel] Wallet created successfully!');
      showSuccess(`Wallet created: ${walletOwnerId} (${ownerId}) -> ${newAddress.slice(0, 10)}...`);
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
        <div className="action-name">Tokenize</div>
        <div className="action-multi-input">
          <div className="action-input-stack">
            <input
              type="text"
              value={tokenizeOwnerId}
              onChange={(e) => setTokenizeOwnerId(e.target.value)}
              placeholder="insert unique ID (e.g., SN72K45M83)"
            />
            <input
              type="number"
              value={tokenizeQuantity}
              onChange={(e) => setTokenizeQuantity(e.target.value)}
              placeholder="insert quantity"
            />
            <input
              type="text"
              value={tokenizeSymbol}
              onChange={(e) => setTokenizeSymbol(e.target.value)}
              placeholder="insert symbol"
            />
          </div>
          <button onClick={handleTokenize} disabled={loading} className="action-submit-btn action-submit-btn-centered" title="Tokenize">
            &gt;
            <i>✓</i>
          </button>
        </div>
      </div>

      <div className="action-group">
        <div className="action-name">Create Wallet</div>
        <div className="action-input-row">
          <input
            type="text"
            value={walletOwnerId}
            onChange={(e) => setWalletOwnerId(e.target.value)}
            placeholder="insert unique ID (e.g., SN72K45M83)"
          />
          <button onClick={handleCreateWallet} disabled={loading} className="action-submit-btn" title="Create Wallet">
            &gt;
            <i>✓</i>
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * AP Actions Content (extracted for reuse)
 */
function APActionsContent() {
  const { showSuccess, showError } = useToastContext();
  const [etfQuantity, setEtfQuantity] = useState('100');
  const [etfSymbol, setEtfSymbol] = useState('ES3');
  const [loading, setLoading] = useState(false);

  // Create ETF (offchain operation)
  // This creates ETF shares by deducting underlying stocks according to ETF composition
  // Updates CDP registry stored in localStorage and triggers refresh event
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
      
      // Show success message with details
      showSuccess(
        `ETF creation successful: ${quantity} ${etfSymbol} shares created. ` +
        `New balance: ${result.newETFBalance}`
      );
      
      // Trigger custom event to refresh CDP Registry component
      // This ensures the registry updates immediately without waiting for polling
      window.dispatchEvent(new CustomEvent('cdp-registry-updated'));
      
      // Trigger network visualizer animation for CDP and AP nodes
      // This creates a glow effect around CDP and AP blocks to show ETF creation
      window.dispatchEvent(new CustomEvent('etf-created', { 
        detail: { 
          quantity, 
          symbol: etfSymbol 
        } 
      }));
      
    } catch (err) {
      console.error('Create ETF error:', err);
      showError(err.message || 'Failed to create ETF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="action-group">
        <div className="action-name">Create ETF</div>
        <div className="action-multi-input">
          <div className="action-input-stack">
            <input
              type="number"
              value={etfQuantity}
              onChange={(e) => setEtfQuantity(e.target.value)}
              placeholder="insert quantity"
            />
            <input
              type="text"
              value={etfSymbol}
              onChange={(e) => setEtfSymbol(e.target.value)}
              placeholder="insert symbol"
            />
          </div>
          <button onClick={handleCreateETF} disabled={loading} className="action-submit-btn action-submit-btn-centered" title="Create ETF">
            &gt;
            <i>✓</i>
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * AP Actions Panel
 * Actions: Create ETF
 */
export function APActions() {
  const [etfQuantity, setEtfQuantity] = useState('100');
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
      // This is an offchain operation that updates CDP registry JSON
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
      setSuccess(`ETF creation successful: ${etfQuantity} ${etfSymbol} shares created`);
    } catch (err) {
      console.error('Create ETF error:', err);
      // For demo purposes, show success even if API fails (CDP registry updates happen via backend scripts)
      setSuccess(`ETF creation initiated: ${etfQuantity} ${etfSymbol} shares (Note: Run backend script to update CDP registry)`);
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
          placeholder="100"
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

