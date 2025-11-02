/**
 * useDeploymentInfo Hook
 * Loads contract addresses from deployment-info.json (golden source of truth)
 * Falls back to hardcoded addresses if fetch fails
 */

import { useState, useEffect } from 'react';
import { fetchDeploymentInfo } from '../utils/api';
import { CONTRACT_ADDRESSES_FALLBACK } from '../utils/constants';

/**
 * Custom hook for loading deployment info
 * @returns {Object} Deployment info including contract addresses and loading state
 */
export function useDeploymentInfo() {
  const [deploymentInfo, setDeploymentInfo] = useState(null);
  const [contractAddresses, setContractAddresses] = useState(CONTRACT_ADDRESSES_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    async function loadDeploymentInfo() {
      try {
        setLoading(true);
        setError(null);
        
        // Try to fetch deployment info from public folder
        const info = await fetchDeploymentInfo();
        
        // Extract contract addresses from deployment info
        // Handle both formats: contracts.SGDC.address and contracts.SGDC (if address is direct)
        const addresses = {
          SGDC: info.contracts?.SGDC?.address || info.contracts?.SGDC,
          TES3: info.contracts?.TES3?.address || info.contracts?.TES3,
          dCDP: info.contracts?.dCDP?.address || info.contracts?.dCDP,
        };

        // Validate all addresses are present
        if (!addresses.SGDC || !addresses.TES3 || !addresses.dCDP) {
          throw new Error('Missing contract addresses in deployment info');
        }

        // Validate addresses are valid Ethereum addresses
        const addressRegex = /^0x[a-fA-F0-9]{40}$/;
        if (!addressRegex.test(addresses.SGDC) || 
            !addressRegex.test(addresses.TES3) || 
            !addressRegex.test(addresses.dCDP)) {
          throw new Error('Invalid contract address format in deployment info');
        }

        setDeploymentInfo(info);
        setContractAddresses(addresses);
        setUsingFallback(false);
        console.log('[useDeploymentInfo] Loaded contract addresses from deployment-info.json:', addresses);
      } catch (err) {
        console.warn('[useDeploymentInfo] Failed to load deployment info, using fallback addresses:', err.message);
        setError(err.message);
        setUsingFallback(true);
        // Use fallback addresses on error
        setContractAddresses(CONTRACT_ADDRESSES_FALLBACK);
      } finally {
        setLoading(false);
      }
    }

    loadDeploymentInfo();
  }, []); // Only run once on mount

  return {
    deploymentInfo,
    contractAddresses,
    loading,
    error,
    usingFallback,
  };
}

