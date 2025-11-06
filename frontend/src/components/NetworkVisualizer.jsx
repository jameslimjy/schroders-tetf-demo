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
  // Left column (vertical stack)
  // Blocks positioned so vertical lines reach edges without overlap
  // All blocks moved down by ~3% (approximately 20 pixels total) for better positioning
  traditionalExchanges: { x: 15, y: 10 },   // Top-left - moved down by 20px total
  settlement: { x: 15, y: 50 },              // Middle-left (Settlement) - moved down by 20px total
  cdp: { x: 15, y: 90 },                     // Bottom-left - moved down by 20px total
  
  // Right column
  // All blocks moved down by ~3% (approximately 20 pixels total) for better positioning
  thomas: { x: 65, y: 10 },                  // Top-right - moved down by 20px total
  ap: { x: 45, y: 50 },                       // Left of Digital Exchange - moved down by 20px total
  digitalExchange: { x: 65, y: 50 },          // Middle-right-left - moved down by 20px total
  stablecoinProvider: { x: 85, y: 50 },       // Middle-right-right - moved down by 20px total
  dcdp: { x: 65, y: 90 },                     // Bottom-right - moved down by 20px total
};

// Node configuration with logos and styling
const NODE_CONFIG = {
  traditionalExchanges: {
    label: 'Traditional Exchanges',
    logo: `${LOGO_BASE_PATH}traditional-exchange-logo.png`,
    type: 'institution', // light grey background
    width: 150, // Reduced width for less horizontal padding
    height: 105, // Increased height by 15px (from 90 to 105)
  },
  settlement: {
    label: 'Settlement',
    logo: `${LOGO_BASE_PATH}settlement-logo.png`,
    type: 'wallet', // dark blue background
    width: 150, // Same width as Traditional Exchanges
    height: 105, // Increased height by 15px (from 90 to 105)
  },
  cdp: {
    label: 'Depository',
    logo: `${LOGO_BASE_PATH}cdp-logo.png`,
    type: 'institution',
    width: 150, // Same width as Traditional Exchanges
    height: 105, // Increased height by 15px (from 90 to 105)
  },
  dcdp: {
    label: 'Tokenized Depository',
    logo: `${LOGO_BASE_PATH}dcdp-logo.png`,
    type: 'wallet',
    width: 150, // Same width as Traditional Exchanges
    height: 105, // Increased height by 15px (from 90 to 105)
  },
  digitalExchange: {
    label: 'Digital Exchange',
    logo: `${LOGO_BASE_PATH}digital-exchange-logo.png`,
    type: 'wallet',
    width: 150, // Same width as Traditional Exchanges
    height: 105, // Increased height by 15px (from 90 to 105)
  },
  stablecoinProvider: {
    label: 'Stablecoin Provider',
    logo: `${LOGO_BASE_PATH}stablecoin-logo.png`,
    type: 'institution',
    width: 150, // Same width as Traditional Exchanges
    height: 105, // Increased height by 15px (from 90 to 105)
  },
  thomas: {
    label: 'Thomas',
    logo: `${LOGO_BASE_PATH}thomas-logo.png`,
    type: 'wallet',
    width: 150, // Same width as Traditional Exchanges
    height: 105, // Increased height by 15px (from 90 to 105)
  },
  ap: {
    label: 'AP',
    logo: `${LOGO_BASE_PATH}ap-logo.png`,
    type: 'wallet',
    width: 150, // Same width as Traditional Exchanges
    height: 105, // Increased height by 15px (from 90 to 105)
  },
};

function NetworkVisualizer({ animationTrigger }) {
  const { blockNumber, isConnected } = useBlockchain();
  const [activeNodes, setActiveNodes] = useState(new Set());
  const [particles, setParticles] = useState([]);
  const [showSingPassLogo, setShowSingPassLogo] = useState(false); // Control SingPass logo visibility
  const [showDigitalWalletLogo, setShowDigitalWalletLogo] = useState(false); // Control digital wallet logo visibility
  const [showFundManagerLogo, setShowFundManagerLogo] = useState(false); // Control Fund Manager logo visibility
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

  // Helper function to create particles directly from coordinates (for custom paths)
  // Used for multi-segment paths like AP → Fund Manager → Depository
  const createParticleFromCoords = useCallback((from, to, startColor = '#1976d2', endColor = null, type = 'default') => {
    // Use endColor if provided, otherwise use startColor (no color change)
    const finalEndColor = endColor || startColor;
    
    // Validate coordinates
    if (!from || !to || isNaN(from.x) || isNaN(from.y) || isNaN(to.x) || isNaN(to.y)) {
      console.error(`[NetworkVisualizer] Invalid coordinates for particle: from (${from?.x}, ${from?.y}), to (${to?.x}, ${to?.y})`);
      return;
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
      return newParticles;
    });

    // Remove particles after animation completes - reduced timeout for 2x speed
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => 
        p.id !== mainParticle.id && !trailParticles.some(tp => tp.id === p.id)
      ));
    }, 1250); // Reduced from 2500 to 1250 for 2x speed
  }, []); // No dependencies - uses coordinates directly

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

    // Step 5: Add 1.5 second pause after particles reach Stablecoin Provider
    // Particles reach Stablecoin Provider around 1000ms (500ms start + 1000ms travel = 1500ms)
    // Wait 1.5 seconds (1500ms) before starting reverse flow
    
    // Step 6: Stablecoin flow (reverse direction) with bright purple to bright blue gradient
    // Stablecoin Provider to Digital Exchange - bright purple to bright blue (same as tokenize)
    // Delayed by 1.5 seconds (1500ms) from original timing
    setTimeout(() => {
      createParticle('stablecoinProvider', 'digitalExchange', '#aa55ff', '#00aaff', 'stablecoin'); // Bright purple to bright blue
      setTimeout(() => createParticle('stablecoinProvider', 'digitalExchange', '#aa55ff', '#00aaff', 'stablecoin'), 25); // Was 50
      setTimeout(() => createParticle('stablecoinProvider', 'digitalExchange', '#aa55ff', '#00aaff', 'stablecoin'), 50); // Was 100
    }, 3000); // 1500ms (original) + 1500ms (pause) = 3000ms

    // Digital Exchange to Thomas (stablecoin flow continues) - bright blue maintained
    // Delayed by 1.5 seconds (1500ms) from original timing
    setTimeout(() => {
      createParticle('digitalExchange', 'thomas', '#00aaff', '#00aaff', 'stablecoin'); // Bright blue to bright blue
      setTimeout(() => createParticle('digitalExchange', 'thomas', '#00aaff', '#00aaff', 'stablecoin'), 25); // Was 50
      setTimeout(() => createParticle('digitalExchange', 'thomas', '#00aaff', '#00aaff', 'stablecoin'), 50); // Was 100
    }, 3350); // 1850ms (original) + 1500ms (pause) = 3350ms

    // Step 7: Remove glows after animation completes
    // Extended by 1.5 seconds (1500ms) to match the pause and particle delay
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('thomas');
        next.delete('digitalExchange');
        next.delete('stablecoinProvider');
        return next;
      });
    }, 4750); // 3250ms (original) + 1500ms (pause extension) = 4750ms
  };

  // Animation sequence for ETF creation - shows flow: AP → Fund Manager → Depository
  // Uses horizontal/vertical path matching the exact connection lines
  // Similar to onramp animation: particles STOP at Fund Manager, then START from Fund Manager
  // Path: AP left edge → Fund Manager left edge (horizontal, stops at block) → vertical down along block → Fund Manager right edge → Depository right edge (horizontal, starts from block)
  // Fund Manager logo appears between AP and Depository during animation
  // Wrapped in useCallback to ensure it uses latest dimensions
  const playETFAnimation = useCallback(() => {
    console.log('[NetworkVisualizer] Starting ETF Animation with horizontal/vertical path');
    console.log('[NetworkVisualizer] Current dimensions:', dimensions);
    
    // Validate dimensions are available
    if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
      console.error('[NetworkVisualizer] Dimensions not ready, cannot create animation');
      return;
    }
    
    // Step 1: Show Fund Manager logo and connecting lines (phase in)
    setShowFundManagerLogo(true);
    
    // Step 2: Make AP glow first (initiates ETF creation)
    setActiveNodes((prev) => new Set(prev).add('ap'));

    // Step 3: Create particles following horizontal/vertical path
    // Calculate positions exactly matching the connection line rendering code
    setTimeout(() => {
      // Get node bounds to calculate connection points (same as line rendering code)
      const apBounds = getNodeBounds('ap', NODE_POSITIONS.ap);
      const cdpBounds = getNodeBounds('cdp', NODE_POSITIONS.cdp);
      
      if (!apBounds || !cdpBounds) {
        console.error('[NetworkVisualizer] Could not get bounds for AP or CDP nodes');
        console.error('[NetworkVisualizer] AP bounds:', apBounds, 'CDP bounds:', cdpBounds);
        return;
      }
      
      // Calculate Fund Manager position exactly as in line rendering code
      const fundManagerX = (apBounds.centerX + cdpBounds.centerX) / 2;
      const fundManagerY = (apBounds.centerY + cdpBounds.centerY) / 2;
      const boxSize = 65; // Fund Manager box size (increased to prevent text overflow)
      const boxRadius = boxSize / 2;
      
      // Debug logging - verify coordinates are correct
      console.log('[NetworkVisualizer] ETF Animation coordinates:', {
        dimensions,
        apBounds: { 
          left: apBounds.left, 
          right: apBounds.right, 
          centerX: apBounds.centerX,
          centerY: apBounds.centerY 
        },
        fundManager: { x: fundManagerX, y: fundManagerY, boxRadius },
        cdpBounds: { 
          left: cdpBounds.left, 
          centerX: cdpBounds.centerX,
          centerY: cdpBounds.centerY 
        }
      });
      
      // Segment 1: AP left edge → Fund Manager center X (horizontal left)
      // Particles flow from AP and STOP at Fund Manager centerpoint X coordinate (similar to onramp animation)
      // From: ap.left, ap.centerY (matches line segment 1 start)
      // To: fundManagerX, ap.centerY (Fund Manager CENTER X - same Y coordinate ensures horizontal line!)
      const segment1From = { x: apBounds.left, y: apBounds.centerY };
      const segment1To = { x: fundManagerX, y: apBounds.centerY };
      
      // Verify horizontal: Y coordinates must match
      if (Math.abs(segment1From.y - segment1To.y) > 0.1) {
        console.error('[NetworkVisualizer] Segment 1 is not horizontal! Y mismatch:', segment1From.y, 'vs', segment1To.y);
      }
      console.log('[NetworkVisualizer] Segment 1 (horizontal left, AP → Fund Manager center):', segment1From, '→', segment1To, 'Y diff:', Math.abs(segment1From.y - segment1To.y));
      
      // Create particles for horizontal segment - particles STOP at Fund Manager centerpoint X
      createParticleFromCoords(segment1From, segment1To, '#00aaff', '#aa55ff', 'cash');
      setTimeout(() => createParticleFromCoords(segment1From, segment1To, '#00aaff', '#aa55ff', 'cash'), 25);
      setTimeout(() => createParticleFromCoords(segment1From, segment1To, '#00aaff', '#aa55ff', 'cash'), 50);
      
      // Make Fund Manager glow when particles arrive (after horizontal segment completes)
      // Particle travel time is ~1000ms, so Fund Manager glows at ~1000ms
      setTimeout(() => {
        setActiveNodes((prev) => {
          const next = new Set(prev);
          next.add('fundManager');
          return next;
        });
      }, 1000);
      
      // Segment 2: Fund Manager center X → Fund Manager top edge (vertical)
      // Particles flow vertically DOWN and STOP at Fund Manager top edge
      // From: fundManagerX, ap.centerY (Fund Manager center X at AP level - where segment 1 ended)
      // To: fundManagerX, fundManagerY - boxRadius (Fund Manager center X at TOP edge - same X ensures vertical!)
      // Delay this segment to start after horizontal segment completes (like onramp animation)
      setTimeout(() => {
        const segment2From = { x: fundManagerX, y: apBounds.centerY };
        const segment2To = { x: fundManagerX, y: fundManagerY - boxRadius };
        
        // Verify vertical: X coordinates must match
        if (Math.abs(segment2From.x - segment2To.x) > 0.1) {
          console.error('[NetworkVisualizer] Segment 2 is not vertical! X mismatch:', segment2From.x, 'vs', segment2To.x);
        }
        console.log('[NetworkVisualizer] Segment 2 (vertical down, Fund Manager center → top edge):', segment2From, '→', segment2To, 'X diff:', Math.abs(segment2From.x - segment2To.x));
        
        // Create particles for vertical segment - particles STOP at Fund Manager top edge
        createParticleFromCoords(segment2From, segment2To, '#aa55ff', '#aa55ff', 'cash');
        setTimeout(() => createParticleFromCoords(segment2From, segment2To, '#aa55ff', '#aa55ff', 'cash'), 25);
        setTimeout(() => createParticleFromCoords(segment2From, segment2To, '#aa55ff', '#aa55ff', 'cash'), 50);
        
        // Segment 3: Fund Manager bottom edge → Depository right edge
        // Particles START from Fund Manager bottom edge and flow to Depository
        // From: fundManagerX, fundManagerY + boxRadius (Fund Manager center X at BOTTOM edge)
        // This needs to go: vertical down to CDP level, then horizontal right to CDP right edge
        // We'll split this into two sub-segments: vertical then horizontal
        setTimeout(() => {
          // Sub-segment 3a: Fund Manager bottom → CDP level (vertical down)
          const segment3aFrom = { x: fundManagerX, y: fundManagerY + boxRadius };
          const segment3aTo = { x: fundManagerX, y: cdpBounds.centerY - 20 };
          
          // Verify vertical: X coordinates must match
          if (Math.abs(segment3aFrom.x - segment3aTo.x) > 0.1) {
            console.error('[NetworkVisualizer] Segment 3a is not vertical! X mismatch:', segment3aFrom.x, 'vs', segment3aTo.x);
          }
          console.log('[NetworkVisualizer] Segment 3a (vertical down, Fund Manager bottom → CDP level):', segment3aFrom, '→', segment3aTo, 'X diff:', Math.abs(segment3aFrom.x - segment3aTo.x));
          
          // Create particles for vertical sub-segment
          createParticleFromCoords(segment3aFrom, segment3aTo, '#aa55ff', '#aa55ff', 'cash');
          setTimeout(() => createParticleFromCoords(segment3aFrom, segment3aTo, '#aa55ff', '#aa55ff', 'cash'), 25);
          setTimeout(() => createParticleFromCoords(segment3aFrom, segment3aTo, '#aa55ff', '#aa55ff', 'cash'), 50);
          
          // Sub-segment 3b: CDP level → Depository right edge (horizontal right)
          setTimeout(() => {
            const segment3bFrom = { x: fundManagerX, y: cdpBounds.centerY - 20 };
            const segment3bTo = { x: cdpBounds.right, y: cdpBounds.centerY - 20 };
            
            // Verify horizontal: Y coordinates must match
            if (Math.abs(segment3bFrom.y - segment3bTo.y) > 0.1) {
              console.error('[NetworkVisualizer] Segment 3b is not horizontal! Y mismatch:', segment3bFrom.y, 'vs', segment3bTo.y);
            }
            console.log('[NetworkVisualizer] Segment 3b (horizontal right, Fund Manager → Depository right):', segment3bFrom, '→', segment3bTo, 'Y diff:', Math.abs(segment3bFrom.y - segment3bTo.y));
            
            // Create particles for horizontal sub-segment - particles START from Fund Manager (after vertical drop)
            createParticleFromCoords(segment3bFrom, segment3bTo, '#aa55ff', '#aa55ff', 'cash');
            setTimeout(() => createParticleFromCoords(segment3bFrom, segment3bTo, '#aa55ff', '#aa55ff', 'cash'), 25);
            setTimeout(() => createParticleFromCoords(segment3bFrom, segment3bTo, '#aa55ff', '#aa55ff', 'cash'), 50);
            
            // Make Depository glow when particles arrive (after all segments complete)
            setTimeout(() => {
              setActiveNodes((prev) => {
                const next = new Set(prev);
                next.add('cdp');
                return next;
              });
            }, 1000); // 1000ms after segment 3b starts
          }, 1000); // Start segment 3b after segment 3a completes
        }, 1000); // Start segment 3a after segment 2 completes
      }, 1000); // Start segment 2 after segment 1 completes
    }, 200); // Initial delay

    // Step 4: Remove all glows and phase out Fund Manager logo and lines after animation completes
    // Total timing: 200ms (initial) + 1000ms (segment 1) + 1000ms (segment 2) + 1000ms (segment 3a) + 1000ms (segment 3b) = 4200ms
    // Add buffer to 4500ms to match other animations
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('ap');
        next.delete('fundManager');
        next.delete('cdp');
        return next;
      });
      setShowFundManagerLogo(false); // Phase out Fund Manager logo and lines
    }, 4500); // Total animation duration: ~4.5 seconds (extended for 4 segments)
  }, [dimensions]); // Depend on dimensions to ensure latest values are used

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
  // Shows redemption flow: Tokenized Depository → Depository → AP
  // Uses same glow animation as tokenize but flows in reverse direction
  // AP glows at the same time as Tokenized Depository to show redemption initiated
  const playRedeemAnimation = useCallback(() => {
    console.log('[NetworkVisualizer] Playing redeem animation...');
    
    // Step 1: Make dCDP and AP glow simultaneously (both involved in redemption)
    setActiveNodes((prev) => {
      const next = new Set(prev);
      next.add('dcdp');
      next.add('ap'); // AP glows at the same time as Tokenized Depository
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

    // Step 3: Remove all glows after animation completes
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('dcdp');
        next.delete('cdp');
        next.delete('ap');
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

  // Store ETF animation ref for event listener
  const playETFAnimationRef = useRef(null);
  
  useEffect(() => {
    playETFAnimationRef.current = playETFAnimation;
  }, [playETFAnimation]);

  // Listen for ETF creation events to trigger CDP and AP glow animation
  useEffect(() => {
    const handleETFCreated = () => {
      console.log('[NetworkVisualizer] ETF created event received, playing animation...');
      if (playETFAnimationRef.current) {
        playETFAnimationRef.current();
      }
    };

    window.addEventListener('etf-created', handleETFCreated);

    return () => {
      window.removeEventListener('etf-created', handleETFCreated);
    };
  }, []); // Empty dependencies - event listener setup only once

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
  // Shows the flow: Thomas → Digital Exchange → AP (forward), then AP → Digital Exchange → Thomas (reverse)
  // Sequence:
  // 1. Thomas glows first
  // 2. Particles travel: Thomas → Digital Exchange → AP
  // 3. After particles reach AP, pause for 1.5 seconds
  // 4. Reverse flow: AP → Digital Exchange → Thomas
  const playBuyAssetAnimation = useCallback(() => {
    // Step 1: Make Thomas glow (initiates buy)
    setActiveNodes((prev) => new Set(prev).add('thomas'));

    // Step 2: Forward flow - Thomas → Digital Exchange → AP
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

    // Digital Exchange to AP
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('ap');
        return next;
      });
      
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('digitalExchange', 'ap', '#aa55ff', '#aa55ff', 'cash');
      setTimeout(() => createParticleFn('digitalExchange', 'ap', '#aa55ff', '#aa55ff', 'cash'), 25);
      setTimeout(() => createParticleFn('digitalExchange', 'ap', '#aa55ff', '#aa55ff', 'cash'), 50);
    }, 700); // 200ms (initial) + 500ms (particle travel time)

    // Step 3: Add 1.5 second pause after particles reach AP
    // Particles reach AP around 1200ms (700ms start + 500ms delay = 1200ms)
    // Wait 1.5 seconds (1500ms) before starting reverse flow

    // Step 4: Reverse flow - AP → Digital Exchange → Thomas
    // Wait for forward flow to complete (~1.2 seconds) + 1.5 second pause
    setTimeout(() => {
      // AP to Digital Exchange (reverse)
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('ap', 'digitalExchange', '#aa55ff', '#00aaff', 'cash');
      setTimeout(() => createParticleFn('ap', 'digitalExchange', '#aa55ff', '#00aaff', 'cash'), 25);
      setTimeout(() => createParticleFn('ap', 'digitalExchange', '#aa55ff', '#00aaff', 'cash'), 50);
    }, 2700); // 1200ms (forward flow completion) + 1500ms (pause) = 2700ms

    // Digital Exchange to Thomas (reverse)
    setTimeout(() => {
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('digitalExchange', 'thomas', '#00aaff', '#00aaff', 'cash');
      setTimeout(() => createParticleFn('digitalExchange', 'thomas', '#00aaff', '#00aaff', 'cash'), 25);
      setTimeout(() => createParticleFn('digitalExchange', 'thomas', '#00aaff', '#00aaff', 'cash'), 50);
    }, 3200); // 2700ms (previous) + 500ms (particle travel time) = 3200ms

    // Step 5: Remove all glows after animation completes
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('thomas');
        next.delete('digitalExchange');
        next.delete('ap');
        return next;
      });
    }, 5000); // Total animation duration: ~5 seconds (extended for pause)
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
  // Shows the flow: Digital Exchange → Tokenized Depository
  // Sequence:
  // 1. Digital Exchange glows first (wallet creation initiated)
  // 2. Particles travel: Digital Exchange → Tokenized Depository
  // 3. Tokenized Depository glows when wallet is registered
  // 4. Digital wallet logo phases in when particles reach Tokenized Depository
  // 5. Digital wallet logo phases out when animation ends
  const playCreateWalletAnimation = useCallback(() => {
    console.log('[NetworkVisualizer] Playing create wallet animation...');
    
    // Step 1: Make Digital Exchange glow (wallet creation initiated)
    setActiveNodes((prev) => new Set(prev).add('digitalExchange'));

    // Step 2: Forward flow - Digital Exchange → Tokenized Depository
    // Digital Exchange to Tokenized Depository with particles
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('dcdp');
        return next;
      });
      
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('digitalExchange', 'dcdp', '#00aaff', '#aa55ff', 'cash');
      setTimeout(() => createParticleFn('digitalExchange', 'dcdp', '#00aaff', '#aa55ff', 'cash'), 25);
      setTimeout(() => createParticleFn('digitalExchange', 'dcdp', '#00aaff', '#aa55ff', 'cash'), 50);
    }, 200);

    // Step 2b: Phase in digital wallet logo when particles reach Tokenized Depository
    // Particles take ~1000ms to travel (duration: 1 second), so show logo at ~1200ms (200ms delay + 1000ms travel)
    setTimeout(() => {
      setShowDigitalWalletLogo(true);
    }, 1200);

    // Step 3: Remove all glows and phase out digital wallet logo after animation completes
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('digitalExchange');
        next.delete('dcdp');
        return next;
      });
      setShowDigitalWalletLogo(false); // Phase out digital wallet logo
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

  // Animation sequence for Validate KYC operation
  // Shows the flow: Thomas → Digital Exchange (KYC validation process)
  // Sequence:
  // 1. Thomas glows first (initiates KYC validation)
  // 2. SingPass logo phases in
  // 3. Particles travel: Thomas → Digital Exchange
  // 4. Digital Exchange glows when KYC validation completes
  // 5. SingPass logo phases out
  const playValidateKYCAnimation = useCallback(() => {
    console.log('[NetworkVisualizer] Playing validate KYC animation...');
    
    // Step 1: Make Thomas glow (initiates KYC validation) and show SingPass logo
    setActiveNodes((prev) => new Set(prev).add('thomas'));
    setShowSingPassLogo(true); // Phase in SingPass logo

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

    // Step 3: Phase out SingPass logo after 3.3 seconds (extended duration)
    setTimeout(() => {
      setShowSingPassLogo(false);
    }, 3300);

    // Step 4: Remove all glows after animation completes
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('thomas');
        next.delete('digitalExchange');
        return next;
      });
    }, 3500); // Total animation duration: ~3.5 seconds
  }, []);

  // Store validate KYC animation ref for event listener
  const playValidateKYCAnimationRef = useRef(null);
  
  useEffect(() => {
    playValidateKYCAnimationRef.current = playValidateKYCAnimation;
  }, [playValidateKYCAnimation]);

  // Listen for Validate KYC events to trigger Thomas → Digital Exchange animation
  useEffect(() => {
    const handleValidateKYC = () => {
      console.log('[NetworkVisualizer] Validate KYC event received, playing animation...');
      if (playValidateKYCAnimationRef.current) {
        playValidateKYCAnimationRef.current();
      }
    };

    window.addEventListener('validate-kyc-executed', handleValidateKYC);

    return () => {
      window.removeEventListener('validate-kyc-executed', handleValidateKYC);
    };
  }, []); // Empty dependencies - event listener setup only once

  // Animation sequence for List TES3 operation
  // Shows the flow: AP → Digital Exchange (listing process)
  // Sequence:
  // 1. AP glows first (initiates listing)
  // 2. Particles travel: AP → Digital Exchange
  // 3. Digital Exchange glows when listing completes
  const playListTES3Animation = useCallback(() => {
    console.log('[NetworkVisualizer] Playing list TES3 animation...');
    
    // Step 1: Make AP glow (initiates listing)
    setActiveNodes((prev) => new Set(prev).add('ap'));

    // Step 2: Forward flow - AP → Digital Exchange
    // AP to Digital Exchange with particles
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.add('digitalExchange');
        return next;
      });
      
      const createParticleFn = createParticleRef.current || createParticle;
      createParticleFn('ap', 'digitalExchange', '#00aaff', '#aa55ff', 'cash');
      setTimeout(() => createParticleFn('ap', 'digitalExchange', '#00aaff', '#aa55ff', 'cash'), 25);
      setTimeout(() => createParticleFn('ap', 'digitalExchange', '#00aaff', '#aa55ff', 'cash'), 50);
    }, 200);

    // Step 3: Remove all glows after animation completes
    setTimeout(() => {
      setActiveNodes((prev) => {
        const next = new Set(prev);
        next.delete('ap');
        next.delete('digitalExchange');
        return next;
      });
    }, 3500); // Total animation duration: ~3.5 seconds
  }, []);

  // Store list TES3 animation ref for event listener
  const playListTES3AnimationRef = useRef(null);
  
  useEffect(() => {
    playListTES3AnimationRef.current = playListTES3Animation;
  }, [playListTES3Animation]);

  // Listen for List TES3 events to trigger AP → Digital Exchange animation
  useEffect(() => {
    const handleListTES3 = () => {
      console.log('[NetworkVisualizer] List TES3 event received, playing animation...');
      if (playListTES3AnimationRef.current) {
        playListTES3AnimationRef.current();
      }
    };

    window.addEventListener('list-tes3-executed', handleListTES3);

    return () => {
      window.removeEventListener('list-tes3-executed', handleListTES3);
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
        
        {/* White circle background for logo - makes PNG logos more visible */}
        <circle
          cx={pos.x}
          cy={y + 30}
          r="25"
          fill="#ffffff"
          opacity={0.95}
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
        {/* Increased vertical spacing between logo background and text */}
        <text
          x={pos.x}
          y={nodeId === 'traditionalExchanges' || nodeId === 'digitalExchange' || nodeId === 'stablecoinProvider' || nodeId === 'dcdp'
            ? pos.y + 25  // Increased from 15 to 25 for more spacing below logo
            : pos.y + 30}  // Increased from 20 to 30 for more spacing below logo
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
    const etfParticles = particles.filter(p => p.type === 'cash' && (p.id?.includes('etf') || p.id?.includes('ETF')));
    if (tokenizeParticles.length > 0) {
      console.log(`[NetworkVisualizer] Rendering ${tokenizeParticles.length} tokenize particles out of ${particles.length} total`);
    }
    if (etfParticles.length > 0) {
      console.log(`[NetworkVisualizer] Rendering ${etfParticles.length} ETF particles out of ${particles.length} total`);
      // Log first ETF particle coordinates for debugging
      const firstEtf = etfParticles[0];
      if (firstEtf) {
        console.log(`[NetworkVisualizer] First ETF particle: from (${firstEtf.from.x}, ${firstEtf.from.y}) to (${firstEtf.to.x}, ${firstEtf.to.y}), size: ${firstEtf.size}, color: ${firstEtf.startColor}`);
      }
    }
    return particles
      .filter((particle) => {
        // Filter out particles with invalid coordinates
        if (!particle.from || !particle.to) {
          console.error(`[NetworkVisualizer] Particle missing from/to:`, particle);
          return false;
        }
        if (isNaN(particle.from.x) || isNaN(particle.from.y) || isNaN(particle.to.x) || isNaN(particle.to.y)) {
          console.error(`[NetworkVisualizer] Invalid particle coordinates:`, particle);
          return false;
        }
        // Particles pass filtering validation
        return true;
      })
      .map((particle) => {
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
              r={size + 5}
              fill={startColor}
              initial={{ 
                cx: particle.from.x, 
                cy: particle.from.y, 
                opacity: 0.5 
              }}
              animate={{ 
                cx: particle.to.x, 
                cy: particle.to.y, 
                fill: endColor, // Interpolate color from startColor to endColor
                opacity: [0.5, 0.8, 0],
                scale: [1, 1.3, 1.6],
              }}
              transition={{ 
                duration: 1, // Reduced from 2 to 1 for 2x speed
                delay: delay / 1000,
                ease: [0.4, 0, 0.6, 1] // Cubic bezier for acceleration - starts slow, accelerates significantly mid-journey
              }}
              filter="url(#neonGlow)"
              style={{ pointerEvents: 'none' }} // Ensure particles don't interfere with interactions
            />
          )}
          
          {/* Main particle */}
          <motion.circle
            r={size}
            fill={startColor}
            initial={{ 
              cx: particle.from.x, 
              cy: particle.from.y, 
              opacity: Math.max(opacity, 0.9) // Ensure minimum opacity of 0.9 for visibility
            }}
            animate={{ 
              cx: particle.to.x, 
              cy: particle.to.y, 
              fill: endColor, // Interpolate color from startColor to endColor
              opacity: [Math.max(opacity, 0.9), Math.max(opacity * 0.9, 0.8), 0],
              scale: [1, 1.2, 0.9],
            }}
            transition={{ 
              duration: 1, // Reduced from 2 to 1 for 2x speed
              delay: delay / 1000,
              ease: 'easeInOut' 
            }}
            filter={particle.glow ? 'url(#neonGlow)' : 'none'}
            style={{ pointerEvents: 'none' }} // Ensure particles don't interfere with interactions
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
                {/* Traditional Exchanges → ST (vertical down) - connects to block edges */}
                <line
                  x1={tradEx.centerX}
                  y1={tradEx.bottom}
                  x2={st.centerX}
                  y2={st.top}
                  stroke="#666666"
                  strokeWidth="2"
                />
                
                {/* ST → CDP (vertical down) - connects to block edges */}
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
                {/* Thomas → Digital Exchange (vertical down) - connects to block edges */}
                <line
                  x1={thomas.centerX}
                  y1={thomas.bottom}
                  x2={digitalEx.centerX}
                  y2={digitalEx.top}
                  stroke="#666666"
                  strokeWidth="2"
                />
                
                {/* Digital Exchange → dCDP (vertical down) - connects to block edges */}
                <line
                  x1={digitalEx.centerX}
                  y1={digitalEx.bottom}
                  x2={dcdp.centerX}
                  y2={dcdp.top}
                  stroke="#666666"
                  strokeWidth="2"
                />
                
                {/* AP → Digital Exchange (horizontal right) */}
                <line
                  x1={ap.right}
                  y1={ap.centerY}
                  x2={digitalEx.left}
                  y2={digitalEx.centerY}
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
                
                {/* Fund Manager horizontal/vertical connection path */}
                {/* Path: AP left edge → horizontal left → vertical down → Fund Manager → vertical down → horizontal right → Depository right edge */}
                <AnimatePresence>
                  {showFundManagerLogo && ap && cdp && (() => {
                    // Calculate Fund Manager position (diagonally between AP and CDP)
                    const fundManagerX = (ap.centerX + cdp.centerX) / 2;
                    const fundManagerY = (ap.centerY + cdp.centerY) / 2;
                    const boxSize = 65; // Fund Manager box size (increased to prevent text overflow)
                    const boxRadius = boxSize / 2;
                    
                    return (
                      <>
                        {/* Segment 1: AP left edge → horizontal left to Fund Manager X position */}
                        <motion.line
                          x1={ap.left}
                          y1={ap.centerY}
                          x2={fundManagerX}
                          y2={ap.centerY}
                          stroke="#666666"
                          strokeWidth="2"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.5, ease: 'easeInOut' }}
                        />
                        
                        {/* Segment 2: Vertical down to Fund Manager top */}
                        <motion.line
                          x1={fundManagerX}
                          y1={ap.centerY}
                          x2={fundManagerX}
                          y2={fundManagerY - boxRadius}
                          stroke="#666666"
                          strokeWidth="2"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.5, ease: 'easeInOut' }}
                        />
                        
                        {/* Segment 3: Vertical down from Fund Manager bottom */}
                        <motion.line
                          x1={fundManagerX}
                          y1={fundManagerY + boxRadius}
                          x2={fundManagerX}
                          y2={cdp.centerY - 20}
                          stroke="#666666"
                          strokeWidth="2"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.5, ease: 'easeInOut' }}
                        />
                        
                        {/* Segment 4: Horizontal right to Depository right edge (20px higher to avoid overlap) */}
                        <motion.line
                          x1={fundManagerX}
                          y1={cdp.centerY - 20}
                          x2={cdp.right}
                          y2={cdp.centerY - 20}
                          stroke="#666666"
                          strokeWidth="2"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.5, ease: 'easeInOut' }}
                        />
                        
                        {/* Segment 5: Vertical down to Depository center */}
                        <motion.line
                          x1={cdp.right}
                          y1={cdp.centerY - 20}
                          x2={cdp.right}
                          y2={cdp.centerY}
                          stroke="#666666"
                          strokeWidth="2"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.5, ease: 'easeInOut' }}
                        />
                      </>
                    );
                  })()}
                </AnimatePresence>
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
          
          {/* Fund Manager logo with box - appears temporarily during Create ES3 animation */}
          <AnimatePresence>
            {showFundManagerLogo && (() => {
              // Calculate position diagonally between AP and CDP blocks
              const apBounds = getNodeBounds('ap', NODE_POSITIONS.ap);
              const cdpBounds = getNodeBounds('cdp', NODE_POSITIONS.cdp);
              
              if (!apBounds || !cdpBounds) return null;
              
              // Position logo diagonally between AP and CDP (as shown in user's image)
              const logoX = (apBounds.centerX + cdpBounds.centerX) / 2; // Midway between AP and CDP horizontally
              const logoY = (apBounds.centerY + cdpBounds.centerY) / 2; // Midway between AP and CDP vertically
              const logoSize = 30; // Logo size in pixels (half the original 60px)
              const boxPadding = 17.5; // Padding around logo for the box (increased to make box bigger)
              const boxSize = logoSize + boxPadding * 2; // Total box size (65px total - increased for text spacing)
              const isActive = activeNodes.has('fundManager'); // Check if fund manager should glow
              
              return (
                <motion.g
                  key="fund-manager-logo"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                  {/* Box around Fund Manager logo - dark blue background matching other blocks */}
                  <motion.rect
                    x={logoX - boxSize / 2}
                    y={logoY - boxSize / 2}
                    width={boxSize}
                    height={boxSize}
                    rx={8}
                    ry={8}
                    fill="#0f2859" // Dark blue background matching other blocks
                    stroke={isActive ? '#00d4ff' : 'transparent'} // Neon blue glow when active, transparent otherwise
                    strokeWidth={isActive ? 3 : 0}
                    initial={{ opacity: 0.95, scale: 1 }} // Explicit initial values to prevent undefined warning
                    animate={{
                      scale: isActive ? 1.05 : 1,
                      opacity: isActive ? 1 : 0.95,
                    }}
                    transition={{ duration: 0.3 }}
                    filter={isActive ? 'url(#neonGlowStrong)' : 'none'}
                  />
                  
                  {/* Fund Manager logo image - centered in upper part of box */}
                  <image
                    x={logoX - logoSize / 2}
                    y={logoY - logoSize / 2 - 8} // Move logo up by 8px to make room for text
                    width={logoSize}
                    height={logoSize}
                    href={`${LOGO_BASE_PATH}fund-manager.png`}
                    opacity={0.9}
                    onError={(e) => {
                      // Hide logo if image fails to load
                      e.target.style.display = 'none';
                    }}
                  />
                  
                  {/* Fund Manager text - positioned below logo with 2/3 font size */}
                  <text
                    x={logoX}
                    y={logoY + 12} // Position text below the logo, adjusted for larger box (box bottom is at logoY + 32.5px, text extends ~22px down)
                    textAnchor="middle"
                    fontSize="10.67" // 2/3 the font size of other blocks (16px * 2/3 = 10.67px)
                    fontWeight="600"
                    fill="#ffffff" // White text matching other blocks
                    className="network-label" // Same font as other blocks (Inter, sans-serif)
                  >
                    <tspan x={logoX} dy="0">Fund</tspan>
                    <tspan x={logoX} dy="11">Manager</tspan> {/* 11px line height for 10.67px font (scaled proportionally) */}
                  </text>
                </motion.g>
              );
            })()}
          </AnimatePresence>

          {/* SingPass logo - appears during Validate KYC animation */}
          <AnimatePresence>
            {showSingPassLogo && (() => {
              // Calculate position between Thomas and Digital Exchange blocks
              const thomasBounds = getNodeBounds('thomas', NODE_POSITIONS.thomas);
              const digitalExBounds = getNodeBounds('digitalExchange', NODE_POSITIONS.digitalExchange);
              
              if (!thomasBounds || !digitalExBounds) return null;
              
              // Position logo to the right of the vertical line
              // Leftmost portion of logo should be 5 pixels to the right of the line
              const verticalLineX = thomasBounds.centerX; // X position of the vertical line
              const logoSize = 60; // Logo size in pixels
              const logoX = verticalLineX + 5 + (logoSize / 2); // Center X: line + 5px offset + half logo width
              const logoY = (thomasBounds.bottom + digitalExBounds.top) / 2; // Middle point between blocks
              
              return (
                <motion.g
                  key="singpass-logo"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                  {/* SingPass logo image - no white background */}
                  <image
                    x={logoX - logoSize / 2}
                    y={logoY - logoSize / 2}
                    width={logoSize}
                    height={logoSize}
                    href={`${LOGO_BASE_PATH}singpass-logo.png`}
                    opacity={0.9}
                    onError={(e) => {
                      // Hide logo if image fails to load
                      e.target.style.display = 'none';
                    }}
                  />
                </motion.g>
              );
            })()}
          </AnimatePresence>

          {/* Digital wallet logo - appears inside Tokenized Depository block during Create Wallet animation */}
          <AnimatePresence>
            {showDigitalWalletLogo && (() => {
              // Calculate position inside Tokenized Depository block
              const dcdpBounds = getNodeBounds('dcdp', NODE_POSITIONS.dcdp);
              
              if (!dcdpBounds) return null;
              
              // Position logo to the right of the main logo, between logo and right wall
              // Main logo is centered at dcdpBounds.centerX
              // Block width is 150px, so right edge is at dcdpBounds.centerX + 75
              // Main logo takes up ~36px width centered, so it extends from centerX - 18 to centerX + 18
              // Position digital wallet logo further to the right with spacing from main logo
              const mainLogoRightEdge = dcdpBounds.centerX + 18; // Right edge of main logo
              const blockRightEdge = dcdpBounds.centerX + 75; // Right edge of block
              const logoSize = 32; // Digital wallet logo size (smaller than main logo)
              const spacingFromMainLogo = 15; // Spacing between main logo and digital wallet logo
              const logoX = mainLogoRightEdge + spacingFromMainLogo + (logoSize / 2); // Position logo with spacing from main logo
              const logoY = dcdpBounds.top + 30; // Same vertical position as main logo (y + 30)
              
              return (
                <motion.g
                  key="digital-wallet-logo"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                  {/* Digital wallet logo image */}
                  <image
                    x={logoX - logoSize / 2}
                    y={logoY - logoSize / 2}
                    width={logoSize}
                    height={logoSize}
                    href={`${LOGO_BASE_PATH}digital-wallet.png`}
                    opacity={0.9}
                    onError={(e) => {
                      // Hide logo if image fails to load
                      e.target.style.display = 'none';
                    }}
                  />
                </motion.g>
              );
            })()}
          </AnimatePresence>

          {/* Render particles - rendered last to ensure they appear on top */}
          <g style={{ pointerEvents: 'none' }}>
            <AnimatePresence>{renderParticles()}</AnimatePresence>
          </g>
        </svg>
      </div>
      {!isConnected && (
        <div className="network-status">Connecting to blockchain...</div>
      )}
    </div>
  );
}

export default NetworkVisualizer;

