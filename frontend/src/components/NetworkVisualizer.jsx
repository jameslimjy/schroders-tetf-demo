/**
 * Network Visualizer Component
 * Visual representation of stakeholder network with animated transaction flows
 * Uses SVG and Framer Motion for animations
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBlockchain } from '../hooks/useBlockchain';
import './NetworkVisualizer.css';

// Logo paths - place your logo images in frontend/src/assets/logos/
// The app will work without logos, but they won't be displayed until you add them
// Example: Add thomas-logo.png, ap-logo.png, etc. to the logos folder
const LOGO_BASE_PATH = '/assets/logos/';

// Node positions (relative coordinates, will be scaled to container)
// Arranged to match the image layout with 90-degree connections
// Increased spacing to prevent overlap on smaller screens
const NODE_POSITIONS = {
  // Left column (vertical stack) - increased vertical spacing
  traditionalExchanges: { x: 15, y: 12 },  // Top-left
  settlement: { x: 15, y: 45 },            // Middle-left (Settlement) - increased gap
  cdp: { x: 15, y: 78 },                   // Bottom-left - increased gap
  
  // Right column - increased spacing
  thomas: { x: 65, y: 12 },                // Top-right (above Digital Exchange)
  digitalExchange: { x: 65, y: 45 },       // Middle-right-left - increased gap
  stablecoinProvider: { x: 85, y: 45 },    // Middle-right-right - increased horizontal spacing
  dcdp: { x: 65, y: 78 },                  // Bottom-right (aligned with CDP) - increased gap
  
  // AP (connected to CDP with 90-degree angle) - adjusted to prevent overlap
  ap: { x: 40, y: 65 },                    // Right of CDP, then up - more spacing
};

// Node configuration with logos and styling
const NODE_CONFIG = {
  traditionalExchanges: {
    label: 'Traditional Exchanges',
    logo: `${LOGO_BASE_PATH}traditional-exchange-logo.png`,
    type: 'institution', // light grey background
    width: 150, // Reduced width for less horizontal padding
    height: 90, // Increased height for bottom padding
  },
  settlement: {
    label: 'Settlement',
    logo: `${LOGO_BASE_PATH}settlement-logo.png`,
    type: 'wallet', // dark blue background
    width: 150, // Same width as Traditional Exchanges
    height: 90, // Same height as Traditional Exchanges
  },
  cdp: {
    label: 'Depository',
    logo: `${LOGO_BASE_PATH}cdp-logo.png`,
    type: 'institution',
    width: 150, // Same width as Traditional Exchanges
    height: 90, // Same height as Traditional Exchanges
  },
  dcdp: {
    label: 'Tokenized Depository',
    logo: `${LOGO_BASE_PATH}dcdp-logo.png`,
    type: 'wallet',
    width: 150, // Same width as Traditional Exchanges
    height: 90, // Same height as Traditional Exchanges
  },
  digitalExchange: {
    label: 'Digital Exchange',
    logo: `${LOGO_BASE_PATH}digital-exchange-logo.png`,
    type: 'wallet',
    width: 150, // Same width as Traditional Exchanges
    height: 90, // Same height as Traditional Exchanges
  },
  stablecoinProvider: {
    label: 'Stablecoin Provider',
    logo: `${LOGO_BASE_PATH}stablecoin-logo.png`,
    type: 'institution',
    width: 150, // Same width as Traditional Exchanges
    height: 90, // Same height as Traditional Exchanges
  },
  thomas: {
    label: 'Thomas',
    logo: `${LOGO_BASE_PATH}thomas-logo.png`,
    type: 'wallet',
    width: 150, // Same width as Traditional Exchanges
    height: 90, // Same height as Traditional Exchanges
  },
  ap: {
    label: 'AP',
    logo: `${LOGO_BASE_PATH}ap-logo.png`,
    type: 'wallet',
    width: 150, // Same width as Traditional Exchanges
    height: 90, // Same height as Traditional Exchanges
  },
};

function NetworkVisualizer({ animationTrigger }) {
  const { blockNumber, isConnected } = useBlockchain();
  const [activeNodes, setActiveNodes] = useState(new Set());
  const [particles, setParticles] = useState([]);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 }); // Increased default size for better spacing
  const lastTriggerRef = useRef(null); // Track last animation trigger to avoid duplicates
  
  // Refs to store latest functions for event listeners (prevents stale closures)
  const createParticleRef = useRef(null);
  const playTokenizeAnimationRef = useRef(null);

  // Update refs when functions change (ensures event listeners use latest versions)
  useEffect(() => {
    createParticleRef.current = createParticle;
    playTokenizeAnimationRef.current = playTokenizeAnimation;
  }, [dimensions]); // Update when dimensions change to ensure correct coordinates

  // Update dimensions on resize with throttling to prevent excessive re-renders
  // Throttle resize events to max once per 100ms for better performance
  useEffect(() => {
    let timeoutId = null;
    
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        // Only update if dimensions actually changed significantly (avoid micro-adjustments)
        setDimensions((prev) => {
          const widthDiff = Math.abs(prev.width - rect.width);
          const heightDiff = Math.abs(prev.height - rect.height);
          // Only update if change is more than 5 pixels to reduce unnecessary re-renders
          if (widthDiff > 5 || heightDiff > 5) {
            return { width: rect.width, height: rect.height };
          }
          return prev;
        });
      }
    };

    // Throttled resize handler - only runs once per 100ms max
    const throttledResize = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(updateDimensions, 100);
    };

    // Initial measurement
    updateDimensions();
    
    // Add throttled resize listener
    window.addEventListener('resize', throttledResize);
    
    return () => {
      window.removeEventListener('resize', throttledResize);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // Fix SVG className issue for browser dev tools compatibility
  // SVG elements expose className as SVGAnimatedString, which breaks tools expecting strings
  // Only run this once on mount, not on every dimension change (performance optimization)
  useEffect(() => {
    const fixSVGClassNames = () => {
      if (svgRef.current) {
        const svgElements = svgRef.current.querySelectorAll('.network-node');
        svgElements.forEach((el) => {
          if (el && el.className && typeof el.className !== 'string') {
            const classNameValue = el.className.baseVal || el.className.animVal || 'network-node';
            el.setAttribute('class', classNameValue);
          }
        });
      }
    };
    
    // Fix after elements are rendered (only once on mount)
    const timeoutId = setTimeout(fixSVGClassNames, 500);
    return () => clearTimeout(timeoutId);
  }, []); // Run only once on mount, not on every dimension change

  // Convert percentage coordinates to pixel coordinates
  const toPixels = (percentX, percentY) => {
    return {
      x: (percentX / 100) * dimensions.width,
      y: (percentY / 100) * dimensions.height,
    };
  };

  // Animate node glow
  const animateNode = (nodeId, duration = 2000) => {
    setActiveNodes((prev) => new Set(prev).add(nodeId));
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }, duration);
  };

  // Create particle animation between two nodes with neon effects
  // Uses connection points (edges) for more natural flow visualization
  // Creates multiple particles for a trail effect with neon glow
  // Supports color interpolation from startColor to endColor
  // Wrapped in useCallback to ensure it always uses latest dimensions
  const createParticle = useCallback((fromNode, toNode, startColor = '#1976d2', endColor = null, type = 'default') => {
    // Use endColor if provided, otherwise use startColor (no color change)
    const finalEndColor = endColor || startColor;
    
    // Use connection points for natural flow visualization
    // Calculate connection points dynamically based on current node positions
    let from, to;
    try {
      const points = getConnectionPoint(fromNode, toNode);
      from = points.from;
      to = points.to;
      
      // Validate coordinates are numbers (not NaN or undefined)
      if (isNaN(from.x) || isNaN(from.y) || isNaN(to.x) || isNaN(to.y)) {
        throw new Error('Invalid coordinates from getConnectionPoint');
      }
    } catch (e) {
      console.warn(`[NetworkVisualizer] Failed to get connection points for ${fromNode} → ${toNode}, using centers:`, e);
      // Fallback to center positions if getConnectionPoint not available
      const fromPos = NODE_POSITIONS[fromNode];
      const toPos = NODE_POSITIONS[toNode];
      if (fromPos && toPos) {
        from = toPixels(fromPos.x, fromPos.y);
        to = toPixels(toPos.x, toPos.y);
      } else {
        console.error(`[NetworkVisualizer] Invalid node positions for ${fromNode} or ${toNode}`);
        return; // Don't create particle if we can't get valid coordinates
      }
    }

    // Create multiple particles for a neon trail effect
    // Main particle (larger, brighter)
    // Enhanced particle size for tokenize and cash flows (better visibility)
    const baseSize = (type === 'tokenize' || type === 'cash' || type === 'stablecoin') ? 2 : 1; // Larger size for enhanced animations
    const mainParticle = {
      id: `main-${Date.now()}-${Math.random()}`,
      from,
      to,
      startColor, // Starting color
      endColor: finalEndColor, // Ending color for interpolation
      type,
      size: baseSize, // Size based on type
      glow: true, // Apply neon glow filter
      delay: 0,
    };

    // Trail particles (smaller, trailing behind)
    const trailParticles = [];
    // Enhanced animations (tokenize, cash, stablecoin) get more trail particles
    const enhancedTypes = ['tokenize', 'cash', 'stablecoin'];
    const trailCount = enhancedTypes.includes(type) ? 6 : 5; // More trail particles for enhanced animations
    for (let i = 0; i < trailCount; i++) {
      trailParticles.push({
        id: `trail-${Date.now()}-${Math.random()}-${i}`,
        from,
        to,
        startColor, // Starting color
        endColor: finalEndColor, // Ending color for interpolation
        type,
        size: baseSize * (0.7 - i * 0.1), // Decreasing size based on baseSize
        glow: enhancedTypes.includes(type) ? i < 3 : i < 2, // More trail particles have glow for enhanced animations
        delay: i * 50, // Reduced delay for 2x speed (was i * 100)
        opacity: 0.8 - i * 0.12, // Decreasing opacity
      });
    }

    // Add all particles
    setParticles((prev) => {
      const newParticles = [...prev, mainParticle, ...trailParticles];
      if (type === 'tokenize') {
        console.log(`[NetworkVisualizer] Added ${1 + trailParticles.length} particles. Total particles: ${newParticles.length}`);
        console.log(`[NetworkVisualizer] Particle from: (${from.x}, ${from.y}), to: (${to.x}, ${to.y})`);
      }
      return newParticles;
    });

    // Remove particles after animation completes - reduced timeout for 2x speed
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => 
        p.id !== mainParticle.id && !trailParticles.some(tp => tp.id === p.id)
      ));
    }, 1250); // Reduced from 2500 to 1250 for 2x speed
  }, [dimensions]); // Update when dimensions change to use latest coordinate calculations

  // Animation sequence for onramp cash flow with enhanced neon effects
  // Shows cash flow: Thomas → Digital Exchange → Stablecoin Provider
  // Then stablecoin flow: Stablecoin Provider → Digital Exchange → Thomas
  // All timing reduced by 50% for 2x speed
  const playOnrampAnimation = () => {
    // Step 1: Make Thomas glow with neon effect
    setActiveNodes((prev) => new Set(prev).add('thomas'));

    // Step 2: Cash flow animation with color gradient
    // Create multiple particle bursts for more flashy effect
    // Thomas to Digital Exchange - bright blue to bright purple gradient (same as tokenize)
    setTimeout(() => {
      createParticle('thomas', 'digitalExchange', '#00aaff', '#aa55ff', 'cash'); // Bright blue to bright purple
      // Additional burst particles for more flash - reduced delays for 2x speed
      setTimeout(() => createParticle('thomas', 'digitalExchange', '#00aaff', '#aa55ff', 'cash'), 25); // Was 50
      setTimeout(() => createParticle('thomas', 'digitalExchange', '#00aaff', '#aa55ff', 'cash'), 50); // Was 100
    }, 150); // Reduced from 300 to 150 for 2x speed

    // Digital Exchange to Stablecoin Provider (cash flow continues) - bright purple maintained
    setTimeout(() => {
      createParticle('digitalExchange', 'stablecoinProvider', '#aa55ff', '#aa55ff', 'cash'); // Bright purple to bright purple
      setTimeout(() => createParticle('digitalExchange', 'stablecoinProvider', '#aa55ff', '#aa55ff', 'cash'), 25); // Was 50
      setTimeout(() => createParticle('digitalExchange', 'stablecoinProvider', '#aa55ff', '#aa55ff', 'cash'), 50); // Was 100
    }, 500); // Reduced from 1000 to 500 for 2x speed

    // Step 3: Make Digital Exchange glow with neon effect when cash arrives
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('digitalExchange');
        return next;
      });
    }, 750); // Reduced from 1500 to 750 for 2x speed

    // Step 4: Make Stablecoin Provider glow with neon effect when cash arrives
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('stablecoinProvider');
        return next;
      });
    }, 1000); // Reduced from 2000 to 1000 for 2x speed

    // Step 5: Stablecoin flow (reverse direction) with bright purple to bright blue gradient
    // Stablecoin Provider to Digital Exchange - bright purple to bright blue (same as tokenize)
    setTimeout(() => {
      createParticle('stablecoinProvider', 'digitalExchange', '#aa55ff', '#00aaff', 'stablecoin'); // Bright purple to bright blue
      setTimeout(() => createParticle('stablecoinProvider', 'digitalExchange', '#aa55ff', '#00aaff', 'stablecoin'), 25); // Was 50
      setTimeout(() => createParticle('stablecoinProvider', 'digitalExchange', '#aa55ff', '#00aaff', 'stablecoin'), 50); // Was 100
    }, 1500); // Reduced from 3000 to 1500 for 2x speed

    // Digital Exchange to Thomas (stablecoin flow continues) - bright blue maintained
    setTimeout(() => {
      createParticle('digitalExchange', 'thomas', '#00aaff', '#00aaff', 'stablecoin'); // Bright blue to bright blue
      setTimeout(() => createParticle('digitalExchange', 'thomas', '#00aaff', '#00aaff', 'stablecoin'), 25); // Was 50
      setTimeout(() => createParticle('digitalExchange', 'thomas', '#00aaff', '#00aaff', 'stablecoin'), 50); // Was 100
    }, 1850); // Reduced from 3700 to 1850 for 2x speed

    // Step 6: Remove glows after animation completes
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('thomas');
        next.delete('digitalExchange');
        next.delete('stablecoinProvider');
        return next;
      });
    }, 3250); // Reduced from 6500 to 3250 for 2x speed
  };

  // Animation sequence for ETF creation - makes CDP and AP glow
  // Shows that ETF shares were created in Depository registry for AP
  const playETFAnimation = () => {
    // Step 1: Make CDP glow with neon effect
    setActiveNodes((prev) => new Set(prev).add('cdp'));

    // Step 2: Make AP glow with neon effect
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('ap');
        return next;
      });
    }, 300);

    // Step 3: Remove glows after animation completes
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('cdp');
        next.delete('ap');
        return next;
      });
    }, 2500); // 2.5 second animation duration
  };

  // Animation sequence for Tokenize operation
  // Shows the flow: AP → Depository → Tokenized Depository (tokenization process)
  // Sequence:
  // 1. AP block glows first
  // 2. 0.2 seconds later, Depository block glows and particle travels from Depository to Tokenized Depository
  // 3. After particle reaches Tokenized Depository, Tokenized Depository block glows
  const playTokenizeAnimation = () => {
    // Step 1: Make AP glow with neon effect (AP initiates tokenization)
    setActiveNodes((prev) => new Set(prev).add('ap'));

    // Step 2: After 0.2 seconds, make CDP glow and create particle animation
    // Use same pattern as onramp animation for consistency
    setTimeout(() => {
      // Make CDP glow
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('cdp');
        return next;
      });

      // Create particle animation from CDP to dCDP
      // Use bright blue/purple colors for better visibility (similar to onramp green/orange)
      // Use ref to ensure we have the latest createParticle function with current dimensions
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('cdp', 'dcdp', '#00aaff', '#aa55ff', 'tokenize'); // Bright blue to bright purple
      // Additional burst particles for more visual impact - same timing as onramp
      setTimeout(() => createParticleFn('cdp', 'dcdp', '#00aaff', '#aa55ff', 'tokenize'), 25);
      setTimeout(() => createParticleFn('cdp', 'dcdp', '#00aaff', '#aa55ff', 'tokenize'), 50);
    }, 200); // 0.2 seconds delay

    // Step 3: After particle animation reaches dCDP (approximately 1 second for particle to travel)
    // Make dCDP glow when tokens are minted
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('dcdp');
        return next;
      });
    }, 1200); // 200ms (initial delay) + 1000ms (particle travel time) = 1200ms

    // Step 4: Remove all glows after animation completes
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('ap');
        next.delete('cdp');
        next.delete('dcdp');
        return next;
      });
    }, 3500); // Total animation duration: ~3.5 seconds
  };

  // Animation sequence for redeem (reverse of tokenize)
  // Shows redemption flow: Tokenized Depository → Depository
  // Uses same glow animation as tokenize but flows in reverse direction
  const playRedeemAnimation = useCallback(() => {
    console.log('[NetworkVisualizer] Playing redeem animation...');
    
    // Step 1: Make dCDP glow (source of redemption)
    setActiveNodes((prev) => {
      const next = new Set(prev);
      next.add('dcdp');
      return next;
    });

    // Step 2: Create particle animation from dCDP to CDP (reverse flow)
    // Use bright blue/purple colors (same as tokenize but reverse direction)
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('cdp');
        return next;
      });

      // Create particle animation from dCDP to CDP (reverse of tokenize)
      // Use ref to ensure we have the latest createParticle function with current dimensions
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('dcdp', 'cdp', '#aa55ff', '#00aaff', 'redeem'); // Bright purple to bright blue (reverse)
      // Additional burst particles for more visual impact
      setTimeout(() => createParticleFn('dcdp', 'cdp', '#aa55ff', '#00aaff', 'redeem'), 25);
      setTimeout(() => createParticleFn('dcdp', 'cdp', '#aa55ff', '#00aaff', 'redeem'), 50);
    }, 200); // 0.2 seconds delay

    // Step 3: After particle animation reaches CDP
    // Make CDP glow when securities are redeemed
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('cdp');
        return next;
      });
    }, 1200); // 200ms (initial delay) + 1000ms (particle travel time) = 1200ms

    // Step 4: Remove all glows after animation completes
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('dcdp');
        next.delete('cdp');
        return next;
      });
    }, 3500); // Total animation duration: ~3.5 seconds
  }, []);

  // Store redeem animation ref for event listener
  const playRedeemAnimationRef = useRef(null);
  
  useEffect(() => {
    playRedeemAnimationRef.current = playRedeemAnimation;
  }, [playRedeemAnimation]);

  // Listen for Redeem events to trigger dCDP → CDP animation (reverse of tokenize)
  useEffect(() => {
    const handleRedeemExecuted = () => {
      console.log('[NetworkVisualizer] Redeem executed event received, playing animation...');
      if (playRedeemAnimationRef.current) {
        playRedeemAnimationRef.current();
      }
    };

    window.addEventListener('redeem-executed', handleRedeemExecuted);

    return () => {
      window.removeEventListener('redeem-executed', handleRedeemExecuted);
    };
  }, []); // Empty dependencies - event listener setup only once

  // Watch for animation trigger changes
  useEffect(() => {
    if (animationTrigger && animationTrigger.type === 'onramp') {
      // Check if this is a new trigger (avoid duplicate animations)
      if (lastTriggerRef.current !== animationTrigger.timestamp) {
        lastTriggerRef.current = animationTrigger.timestamp;
        playOnrampAnimation();
      }
    }
  }, [animationTrigger]);

  // Listen for ETF creation events to trigger CDP and AP glow animation
  useEffect(() => {
    const handleETFCreated = () => {
      console.log('[NetworkVisualizer] ETF created event received, playing animation...');
      playETFAnimation();
    };

    window.addEventListener('etf-created', handleETFCreated);

    return () => {
      window.removeEventListener('etf-created', handleETFCreated);
    };
  }, []);

  // Listen for Tokenize events to trigger AP → CDP → dCDP animation
  useEffect(() => {
    const handleTokenize = () => {
      console.log('[NetworkVisualizer] Tokenize event received, playing animation...');
      // Use ref to get latest function (ensures it has access to current dimensions)
      if (playTokenizeAnimationRef.current) {
        playTokenizeAnimationRef.current();
      }
    };

    window.addEventListener('tokenize-executed', handleTokenize);

    return () => {
      window.removeEventListener('tokenize-executed', handleTokenize);
    };
  }, []); // Empty dependencies - event listener setup only once

  // Animation sequence for Buy Asset operation
  // Shows the flow: Thomas → Digital Exchange → dCDP (forward), then dCDP → Digital Exchange → Thomas (reverse)
  // Sequence:
  // 1. Thomas glows first
  // 2. Particles travel: Thomas → Digital Exchange → dCDP
  // 3. After particles reach dCDP, reverse flow: dCDP → Digital Exchange → Thomas
  const playBuyAssetAnimation = useCallback(() => {
    // Step 1: Make Thomas glow (initiates buy)
    setActiveNodes((prev) => new Set(prev).add('thomas'));

    // Step 2: Forward flow - Thomas → Digital Exchange → dCDP
    // Thomas to Digital Exchange
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('digitalExchange');
        return next;
      });
      
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('thomas', 'digitalExchange', '#00aaff', '#aa55ff', 'cash');
      setTimeout(() => createParticleFn('thomas', 'digitalExchange', '#00aaff', '#aa55ff', 'cash'), 25);
      setTimeout(() => createParticleFn('thomas', 'digitalExchange', '#00aaff', '#aa55ff', 'cash'), 50);
    }, 200);

    // Digital Exchange to dCDP
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('dcdp');
        return next;
      });
      
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('digitalExchange', 'dcdp', '#aa55ff', '#aa55ff', 'cash');
      setTimeout(() => createParticleFn('digitalExchange', 'dcdp', '#aa55ff', '#aa55ff', 'cash'), 25);
      setTimeout(() => createParticleFn('digitalExchange', 'dcdp', '#aa55ff', '#aa55ff', 'cash'), 50);
    }, 700); // 200ms (initial) + 500ms (particle travel time)

    // Step 3: Reverse flow - dCDP → Digital Exchange → Thomas
    // Wait for forward flow to complete (~1.2 seconds total)
    setTimeout(() => {
      // dCDP to Digital Exchange (reverse)
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('dcdp', 'digitalExchange', '#aa55ff', '#00aaff', 'cash');
      setTimeout(() => createParticleFn('dcdp', 'digitalExchange', '#aa55ff', '#00aaff', 'cash'), 25);
      setTimeout(() => createParticleFn('dcdp', 'digitalExchange', '#aa55ff', '#00aaff', 'cash'), 50);
    }, 1200);

    // Digital Exchange to Thomas (reverse)
    setTimeout(() => {
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('digitalExchange', 'thomas', '#00aaff', '#00aaff', 'cash');
      setTimeout(() => createParticleFn('digitalExchange', 'thomas', '#00aaff', '#00aaff', 'cash'), 25);
      setTimeout(() => createParticleFn('digitalExchange', 'thomas', '#00aaff', '#00aaff', 'cash'), 50);
    }, 1700); // 1200ms (previous) + 500ms (particle travel time)

    // Step 4: Remove all glows after animation completes
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('thomas');
        next.delete('digitalExchange');
        next.delete('dcdp');
        return next;
      });
    }, 3500); // Total animation duration: ~3.5 seconds
  }, []);

  // Store buy asset animation ref for event listener
  const playBuyAssetAnimationRef = useRef(null);
  
  useEffect(() => {
    playBuyAssetAnimationRef.current = playBuyAssetAnimation;
  }, [playBuyAssetAnimation]);

  // Listen for Buy Asset events to trigger Thomas → Digital Exchange → dCDP → reverse animation
  useEffect(() => {
    const handleBuyAsset = () => {
      console.log('[NetworkVisualizer] Buy Asset event received, playing animation...');
      if (playBuyAssetAnimationRef.current) {
        playBuyAssetAnimationRef.current();
      }
    };

    window.addEventListener('buy-asset-executed', handleBuyAsset);

    return () => {
      window.removeEventListener('buy-asset-executed', handleBuyAsset);
    };
  }, []); // Empty dependencies - event listener setup only once

  // Animation sequence for Create Wallet operation
  // Shows the flow: Thomas → Digital Exchange → Tokenized Depository
  // Sequence:
  // 1. Thomas glows first (wallet creation initiated)
  // 2. Particles travel: Thomas → Digital Exchange
  // 3. Digital Exchange glows when particles arrive
  // 4. Particles travel: Digital Exchange → Tokenized Depository
  // 5. Tokenized Depository glows when wallet is registered
  const playCreateWalletAnimation = useCallback(() => {
    console.log('[NetworkVisualizer] Playing create wallet animation...');
    
    // Step 1: Make Thomas glow (wallet creation initiated)
    setActiveNodes((prev) => new Set(prev).add('thomas'));

    // Step 2: Forward flow - Thomas → Digital Exchange
    // Thomas to Digital Exchange with particles
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('digitalExchange');
        return next;
      });
      
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('thomas', 'digitalExchange', '#00aaff', '#aa55ff', 'cash');
      setTimeout(() => createParticleFn('thomas', 'digitalExchange', '#00aaff', '#aa55ff', 'cash'), 25);
      setTimeout(() => createParticleFn('thomas', 'digitalExchange', '#00aaff', '#aa55ff', 'cash'), 50);
    }, 200);

    // Step 3: Digital Exchange → Tokenized Depository
    // Wait for particles to reach Digital Exchange, then continue to Tokenized Depository
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('dcdp');
        return next;
      });
      
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('digitalExchange', 'dcdp', '#aa55ff', '#aa55ff', 'cash');
      setTimeout(() => createParticleFn('digitalExchange', 'dcdp', '#aa55ff', '#aa55ff', 'cash'), 25);
      setTimeout(() => createParticleFn('digitalExchange', 'dcdp', '#aa55ff', '#aa55ff', 'cash'), 50);
    }, 700); // 200ms (initial) + 500ms (particle travel time)

    // Step 4: Remove all glows after animation completes
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('thomas');
        next.delete('digitalExchange');
        next.delete('dcdp');
        return next;
      });
    }, 3500); // Total animation duration: ~3.5 seconds
  }, []);

  // Store create wallet animation ref for event listener
  const playCreateWalletAnimationRef = useRef(null);
  
  useEffect(() => {
    playCreateWalletAnimationRef.current = playCreateWalletAnimation;
  }, [playCreateWalletAnimation]);

  // Listen for Create Wallet events to trigger Thomas → Digital Exchange → Tokenized Depository animation
  useEffect(() => {
    const handleWalletCreated = () => {
      console.log('[NetworkVisualizer] Wallet created event received, playing animation...');
      if (playCreateWalletAnimationRef.current) {
        playCreateWalletAnimationRef.current();
      }
    };

    window.addEventListener('wallet-created', handleWalletCreated);

    return () => {
      window.removeEventListener('wallet-created', handleWalletCreated);
    };
  }, []); // Empty dependencies - event listener setup only once

  // Helper function to get rectangle bounds for connection points
  const getNodeBounds = (nodeId, position) => {
    const config = NODE_CONFIG[nodeId];
    if (!config) return null;
    const pos = toPixels(position.x, position.y);
    const width = config.width;
    const height = config.height;
    return {
      left: pos.x - width / 2,
      right: pos.x + width / 2,
      top: pos.y - height / 2,
      bottom: pos.y + height / 2,
      centerX: pos.x,
      centerY: pos.y,
    };
  };

  // Helper function to get connection point between two nodes
  // Returns the edge point where a particle should start/end for natural flow
  // This function is recreated on each render to ensure it uses current dimensions
  const getConnectionPoint = (fromNode, toNode) => {
    // Ensure dimensions are available before calculating
    if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
      console.warn('[NetworkVisualizer] Dimensions not ready, using fallback coordinates');
      // Fallback to center positions
      return {
        from: toPixels(NODE_POSITIONS[fromNode].x, NODE_POSITIONS[fromNode].y),
        to: toPixels(NODE_POSITIONS[toNode].x, NODE_POSITIONS[toNode].y),
      };
    }

    const fromBounds = getNodeBounds(fromNode, NODE_POSITIONS[fromNode]);
    const toBounds = getNodeBounds(toNode, NODE_POSITIONS[toNode]);
    
    if (!fromBounds || !toBounds) {
      console.warn(`[NetworkVisualizer] Could not get bounds for ${fromNode} or ${toNode}`);
      // Fallback to center if bounds not available
      return {
        from: toPixels(NODE_POSITIONS[fromNode].x, NODE_POSITIONS[fromNode].y),
        to: toPixels(NODE_POSITIONS[toNode].x, NODE_POSITIONS[toNode].y),
      };
    }

    // Determine which edge to use based on relative positions
    let fromPoint = { x: fromBounds.centerX, y: fromBounds.centerY };
    let toPoint = { x: toBounds.centerX, y: toBounds.centerY };

    // Calculate direction vector
    const dx = toBounds.centerX - fromBounds.centerX;
    const dy = toBounds.centerY - fromBounds.centerY;

    // Determine exit point from source node (edge closest to destination)
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection
      fromPoint.x = dx > 0 ? fromBounds.right : fromBounds.left;
      fromPoint.y = fromBounds.centerY;
    } else {
      // Vertical connection
      fromPoint.x = fromBounds.centerX;
      fromPoint.y = dy > 0 ? fromBounds.bottom : fromBounds.top;
    }

    // Determine entry point to destination node (edge closest to source)
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection
      toPoint.x = dx > 0 ? toBounds.left : toBounds.right;
      toPoint.y = toBounds.centerY;
    } else {
      // Vertical connection
      toPoint.x = toBounds.centerX;
      toPoint.y = dy > 0 ? toBounds.top : toBounds.bottom;
    }

    return { from: fromPoint, to: toPoint };
  };

  // Render a network node as a rectangle with logo and name
  const renderNode = (nodeId, position) => {
    const config = NODE_CONFIG[nodeId];
    if (!config) return null;

    const pos = toPixels(position.x, position.y);
    const isActive = activeNodes.has(nodeId);
    const isWallet = config.type === 'wallet';
    
    // Rectangle dimensions
    const width = config.width;
    const height = config.height;
    const x = pos.x - width / 2;
    const y = pos.y - height / 2;

    // Colors - use gradients for Thomas, dCDP, and AP, solid colors for others
    const getFillColor = (nodeId) => {
      // Use gradient URLs for stakeholders with ombre backgrounds
      if (nodeId === 'thomas') return 'url(#thomasGradient)';
      if (nodeId === 'dcdp') return 'url(#dcdpGradient)';
      if (nodeId === 'ap') return 'url(#apGradient)';
      // Default dark blue for other nodes
      return '#0f2859';
    };
    const fillColor = getFillColor(nodeId);
    const textColor = '#ffffff'; // White text for all blocks
    // Neon glow colors for active nodes - all use light neon blue
    const neonStrokeColor = isActive 
      ? '#00d4ff' // Light neon blue for all active nodes
      : '#0f2859'; // Default outline

    return (
      <g key={nodeId}>
        {/* Rectangle node - border shadow effects removed, simple stroke only */}
        <motion.rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={8}
          ry={8}
          fill={fillColor}
          stroke={neonStrokeColor}
          strokeWidth={isActive ? 3 : 1}
          className="network-node"
          data-node-id={nodeId}
          // Border shadow/glow effects removed - simple stroke only
          animate={{
            scale: isActive ? 1.05 : 1,
            opacity: isActive ? 1 : 0.95,
          }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Logo image (centered horizontally, top portion) - bigger size */}
        <image
          x={pos.x - 18}
          y={y + 12}
          width="36"
          height="36"
          href={config.logo}
          className="network-logo"
          opacity={0.9}
          onError={(e) => {
            // Hide logo if image fails to load
            e.target.style.display = 'none';
          }}
        />
        
        {/* Stakeholder name (centered in rectangle, below logo) - bigger font */}
        {/* Adjusted y position to add bottom padding - text positioned higher in box */}
        {/* Multi-line labels (Traditional Exchanges, Digital Exchange, Stablecoin Provider) have more bottom spacing */}
        <text
          x={pos.x}
          y={nodeId === 'traditionalExchanges' || nodeId === 'digitalExchange' || nodeId === 'stablecoinProvider' || nodeId === 'dcdp'
            ? pos.y + 15  // Higher position for two-line labels = more bottom spacing
            : pos.y + 20}  // Standard position for single-line labels
          textAnchor="middle"
          fontSize="16"
          fontWeight="600"
          fill={textColor}
          className="network-label"
        >
          {nodeId === 'traditionalExchanges' && (
            <>
              <tspan x={pos.x} dy="0">Traditional</tspan>
              <tspan x={pos.x} dy="18">Exchanges</tspan>
            </>
          )}
          {nodeId === 'digitalExchange' && (
            <>
              <tspan x={pos.x} dy="0">Digital</tspan>
              <tspan x={pos.x} dy="18">Exchange</tspan>
            </>
          )}
          {nodeId === 'stablecoinProvider' && (
            <>
              <tspan x={pos.x} dy="0">Stablecoin</tspan>
              <tspan x={pos.x} dy="18">Provider</tspan>
            </>
          )}
          {nodeId === 'dcdp' && (
            <>
              <tspan x={pos.x} dy="0">Tokenized</tspan>
              <tspan x={pos.x} dy="18">Depository</tspan>
            </>
          )}
          {!['traditionalExchanges', 'digitalExchange', 'stablecoinProvider', 'dcdp'].includes(nodeId) && config.label}
        </text>
      </g>
    );
  };

  // Render particles with neon glow effects and color interpolation
  // Animation durations reduced to 1 second (from 2) for 2x speed
  // Particle sizes reduced - main particle is 1, trails are smaller
  // Colors interpolate from startColor to endColor during animation
  const renderParticles = () => {
    const tokenizeParticles = particles.filter(p => p.type === 'tokenize');
    if (tokenizeParticles.length > 0) {
      console.log(`[NetworkVisualizer] Rendering ${tokenizeParticles.length} tokenize particles out of ${particles.length} total`);
    }
    return particles.map((particle) => {
      const size = particle.size || 1; // Default size set to 1 (matching main particle)
      const opacity = particle.opacity !== undefined ? particle.opacity : 1;
      const delay = particle.delay || 0;
      // Use startColor and endColor for interpolation, fallback to single color
      const startColor = particle.startColor || particle.color || '#1976d2';
      const endColor = particle.endColor || particle.color || '#1976d2';
      
      return (
        <g key={particle.id}>
          {/* Outer glow layer for neon effect */}
          {particle.glow && (
            <motion.circle
              r={size + 4}
              fill={startColor}
              initial={{ 
                cx: particle.from.x, 
                cy: particle.from.y, 
                opacity: 0.3 
              }}
              animate={{ 
                cx: particle.to.x, 
                cy: particle.to.y, 
                fill: endColor, // Interpolate color from startColor to endColor
                opacity: [0.3, 0.6, 0],
                scale: [1, 1.2, 1.5],
              }}
              transition={{ 
                duration: 1, // Reduced from 2 to 1 for 2x speed
                delay: delay / 1000,
                ease: [0.4, 0, 0.6, 1] // Cubic bezier for acceleration - starts slow, accelerates significantly mid-journey
              }}
              filter="url(#neonGlow)"
            />
          )}
          
          {/* Main particle */}
          <motion.circle
            r={size}
            fill={startColor}
            initial={{ 
              cx: particle.from.x, 
              cy: particle.from.y, 
              opacity: opacity 
            }}
            animate={{ 
              cx: particle.to.x, 
              cy: particle.to.y, 
              fill: endColor, // Interpolate color from startColor to endColor
              opacity: [opacity, opacity * 0.8, 0],
              scale: [1, 1.1, 0.8],
            }}
            transition={{ 
              duration: 1, // Reduced from 2 to 1 for 2x speed
              delay: delay / 1000,
              ease: 'easeInOut' 
            }}
            filter={particle.glow ? 'url(#neonGlow)' : 'none'}
          />
          
          {/* Inner bright core */}
          {particle.glow && (
            <motion.circle
              r={size * 0.4}
              fill="#ffffff"
              initial={{ 
                cx: particle.from.x, 
                cy: particle.from.y, 
                opacity: 0.9 
              }}
              animate={{ 
                cx: particle.to.x, 
                cy: particle.to.y, 
                opacity: [0.9, 0.7, 0],
              }}
              transition={{ 
                duration: 1, // Reduced from 2 to 1 for 2x speed
                delay: delay / 1000,
                ease: [0.4, 0, 0.6, 1] // Cubic bezier for acceleration - starts slow, accelerates significantly mid-journey
              }}
            />
          )}
        </g>
      );
    });
  };

  return (
    <div className="network-visualizer">
      <h3>Network Visualizer</h3>
      <div className="network-container">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="network-svg"
        >
          {/* Background grid and neon filters */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="1" />
            </pattern>
            
            {/* Neon glow filter for particles and nodes */}
            <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* Stronger neon glow for active nodes */}
            <filter id="neonGlowStrong" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="2"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* Gradient definitions for ombre backgrounds - matching ActionPanel colors */}
            {/* Thomas gradient - teal ombre */}
            <linearGradient id="thomasGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00a895" />
              <stop offset="50%" stopColor="#00796d" />
              <stop offset="100%" stopColor="#004d40" />
            </linearGradient>
            
            {/* dCDP gradient - orange ombre */}
            <linearGradient id="dcdpGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            
            {/* AP gradient - red ombre */}
            <linearGradient id="apGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="50%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" opacity="0.3" />

          {/* Connection lines - all at 90-degree angles */}
          {(() => {
            const tradEx = getNodeBounds('traditionalExchanges', NODE_POSITIONS.traditionalExchanges);
            const st = getNodeBounds('settlement', NODE_POSITIONS.settlement);
            const cdp = getNodeBounds('cdp', NODE_POSITIONS.cdp);
            const dcdp = getNodeBounds('dcdp', NODE_POSITIONS.dcdp);
            const thomas = getNodeBounds('thomas', NODE_POSITIONS.thomas);
            const digitalEx = getNodeBounds('digitalExchange', NODE_POSITIONS.digitalExchange);
            const stablecoin = getNodeBounds('stablecoinProvider', NODE_POSITIONS.stablecoinProvider);
            const ap = getNodeBounds('ap', NODE_POSITIONS.ap);

            return (
              <>
                {/* Left column vertical connections */}
                {/* Traditional Exchanges → ST (vertical down) */}
                <line
                  x1={tradEx.centerX}
                  y1={tradEx.bottom}
                  x2={st.centerX}
                  y2={st.top}
                  stroke="#666666"
                  strokeWidth="2"
                />
                
                {/* ST → CDP (vertical down) */}
                <line
                  x1={st.centerX}
                  y1={st.bottom}
                  x2={cdp.centerX}
                  y2={cdp.top}
                  stroke="#666666"
                  strokeWidth="2"
                />
                
                {/* CDP → dCDP (horizontal right) */}
                <line
                  x1={cdp.right}
                  y1={cdp.centerY}
                  x2={dcdp.left}
                  y2={dcdp.centerY}
                  stroke="#666666"
                  strokeWidth="2"
                />
                
                {/* Right column vertical connections */}
                {/* Thomas → Digital Exchange (vertical down) */}
                <line
                  x1={thomas.centerX}
                  y1={thomas.bottom}
                  x2={digitalEx.centerX}
                  y2={digitalEx.top}
                  stroke="#666666"
                  strokeWidth="2"
                />
                
                {/* Digital Exchange → dCDP (vertical down) */}
                <line
                  x1={digitalEx.centerX}
                  y1={digitalEx.bottom}
                  x2={dcdp.centerX}
                  y2={dcdp.top}
                  stroke="#666666"
                  strokeWidth="2"
                />
                
                {/* Digital Exchange → Stablecoin Provider (horizontal right) */}
                <line
                  x1={digitalEx.right}
                  y1={digitalEx.centerY}
                  x2={stablecoin.left}
                  y2={stablecoin.centerY}
                  stroke="#666666"
                  strokeWidth="2"
                />
              </>
            );
          })()}

          {/* Render nodes */}
          {renderNode('traditionalExchanges', NODE_POSITIONS.traditionalExchanges)}
          {renderNode('settlement', NODE_POSITIONS.settlement)}
          {renderNode('cdp', NODE_POSITIONS.cdp)}
          {renderNode('dcdp', NODE_POSITIONS.dcdp)}
          {renderNode('digitalExchange', NODE_POSITIONS.digitalExchange)}
          {renderNode('stablecoinProvider', NODE_POSITIONS.stablecoinProvider)}
          {renderNode('thomas', NODE_POSITIONS.thomas)}
          {renderNode('ap', NODE_POSITIONS.ap)}

          {/* Render particles */}
          <AnimatePresence>{renderParticles()}</AnimatePresence>
        </svg>
      </div>
      {!isConnected && (
        <div className="network-status">Connecting to blockchain...</div>
      )}
    </div>
  );
}

export default NetworkVisualizer;

