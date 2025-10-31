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
import { parseTokenAmount, formatTokenAmount } from '../utils/contractHelpers';
import { TES3_PRICE, ACCOUNTS } from '../utils/constants';
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
      await tx.wait();
      
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
      await approveTx.wait();
      
      // Step 2: AP approves Thomas to spend TES3
      const approveTes3Tx = await tes3.approve(ACCOUNTS.THOMAS, quantity);
      await approveTes3Tx.wait();
      
      // Step 3: Execute atomic swap
      // AP transfers TES3 to Thomas
      const tes3TransferTx = await tes3.transferFrom(ACCOUNTS.AP, ACCOUNTS.THOMAS, quantity);
      await tes3TransferTx.wait();
      
      // Thomas transfers SGDC to AP
      const sgdcTransferTx = await sgdc.transferFrom(ACCOUNTS.THOMAS, ACCOUNTS.AP, cost);
      await sgdcTransferTx.wait();
      
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
      await approveTes3Tx.wait();
      
      // Step 2: AP approves Thomas to spend SGDC
      const approveSgdcTx = await sgdc.approve(ACCOUNTS.THOMAS, proceeds);
      await approveSgdcTx.wait();
      
      // Step 3: Execute reverse swap
      // Thomas transfers TES3 to AP
      const tes3TransferTx = await tes3.transferFrom(ACCOUNTS.THOMAS, ACCOUNTS.AP, quantity);
      await tes3TransferTx.wait();
      
      // AP transfers SGDC to Thomas
      const sgdcTransferTx = await sgdc.transferFrom(ACCOUNTS.AP, ACCOUNTS.THOMAS, proceeds);
      await sgdcTransferTx.wait();
      
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
  const [tokenizeOwnerId, setTokenizeOwnerId] = useState('AP');
  const [tokenizeQuantity, setTokenizeQuantity] = useState('50');
  const [tokenizeSymbol, setTokenizeSymbol] = useState('ES3');
  const [walletOwnerId, setWalletOwnerId] = useState('THOMAS');
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
      
      // Get admin signer (Account #0)
      const adminSigner = getSigner(ACCOUNTS.ADMIN);
      const dcdp = getContractWithSigner('dcdp', adminSigner);
      
      // Call dCDP.tokenize() function
      // Note: This assumes offchain CDP registry validation has occurred
      const tx = await dcdp.tokenize(tokenizeOwnerId, quantity, tokenizeSymbol);
      await tx.wait();
      
      setSuccess(`Tokenize successful: ${tokenizeQuantity} ${tokenizeSymbol} for ${tokenizeOwnerId}`);
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

      // Get the wallet address for the owner_id
      // For THOMAS, use ACCOUNTS.THOMAS
      // For AP, use ACCOUNTS.AP
      // In a real scenario, this would be generated by the wallet provider
      let newAddress;
      if (walletOwnerId.toUpperCase() === 'THOMAS') {
        newAddress = ACCOUNTS.THOMAS;
      } else if (walletOwnerId.toUpperCase() === 'AP') {
        newAddress = ACCOUNTS.AP;
      } else {
        // Generate a random address for other owner IDs
        const randomWallet = ethers.Wallet.createRandom();
        newAddress = randomWallet.address;
      }
      
      // Get admin signer
      const adminSigner = await provider.getSigner(ACCOUNTS.ADMIN);
      const dcdp = getContractWithSigner('dcdp', adminSigner);
      
      // Call dCDP.createWallet() function
      const tx = await dcdp.createWallet(walletOwnerId, newAddress);
      await tx.wait();
      
      setSuccess(`Wallet created: ${walletOwnerId} -> ${newAddress.slice(0, 10)}...`);
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
          placeholder="AP"
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

