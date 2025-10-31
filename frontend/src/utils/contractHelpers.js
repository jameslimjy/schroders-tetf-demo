/**
 * Contract Helper Functions
 * Utility functions for interacting with smart contracts
 */

import { ethers } from 'ethers';
import { RPC_URL, TOKEN_DECIMALS } from './constants';

/**
 * Create a provider connection to the local Anvil blockchain
 * @returns {ethers.JsonRpcProvider} Provider instance
 */
export function createProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

/**
 * Create a contract instance with ABI
 * @param {string} address - Contract address
 * @param {Array} abi - Contract ABI
 * @param {ethers.Provider} provider - Ethers provider (optional, creates new if not provided)
 * @returns {ethers.Contract} Contract instance
 */
export function createContract(address, abi, provider = null) {
  const prov = provider || createProvider();
  return new ethers.Contract(address, abi, prov);
}

/**
 * Create a contract instance with signer (for write operations)
 * @param {string} address - Contract address
 * @param {Array} abi - Contract ABI
 * @param {ethers.Signer} signer - Ethers signer
 * @returns {ethers.Contract} Contract instance with signer
 */
export function createContractWithSigner(address, abi, signer) {
  return new ethers.Contract(address, abi, signer);
}

/**
 * Format token amount from wei to human-readable format
 * @param {string|BigInt} amount - Amount in wei/smallest unit
 * @param {number} decimals - Token decimals (default: 18)
 * @returns {string} Formatted amount
 */
export function formatTokenAmount(amount, decimals = TOKEN_DECIMALS) {
  return ethers.formatUnits(amount, decimals);
}

/**
 * Parse human-readable token amount to wei
 * @param {string} amount - Human-readable amount (e.g., "100.5")
 * @param {number} decimals - Token decimals (default: 18)
 * @returns {BigInt} Amount in wei
 */
export function parseTokenAmount(amount, decimals = TOKEN_DECIMALS) {
  return ethers.parseUnits(amount, decimals);
}

/**
 * Shorten an Ethereum address for display
 * @param {string} address - Full Ethereum address
 * @param {number} chars - Number of characters to show on each side
 * @returns {string} Shortened address (e.g., "0x1234...5678")
 */
export function shortenAddress(address, chars = 6) {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Wait for transaction confirmation
 * @param {ethers.ContractTransactionResponse} tx - Transaction response
 * @returns {Promise<ethers.ContractTransactionReceipt>} Transaction receipt
 */
export async function waitForTransaction(tx) {
  return await tx.wait();
}

