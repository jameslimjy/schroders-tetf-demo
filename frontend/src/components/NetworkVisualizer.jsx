/**
 * Network Visualizer Component
 * Visual representation of stakeholder network with animated transaction flows
 * Uses SVG and Framer Motion for animations
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBlockchain } from '../hooks/useBlockchain';
import './NetworkVisualizer.css';

// Logo paths - place your logo images in frontend/src/assets/logos/
// The app will work without logos, but they won't be displayed until you add them
// Example: Add thomas-logo.png, ap-logo.png, etc. to the logos folder
const LOGO_BASE_PATH = '/assets/logos/';

// Node positions (relative coordinates, will be scaled to container)
const NODE_POSITIONS = {
  traditionalExchanges: { x: 10, y: 10 },
  settlement: { x: 25, y: 50 },
  cdp: { x: 40, y: 50 },
  dcdp: { x: 60, y: 50 },
  digitalExchange: { x: 75, y: 50 },
  stablecoinProvider: { x: 90, y: 50 },
  thomas: { x: 60, y: 20 },
  ap: { x: 80, y: 80 },
};

// Node configuration with logos and styling
const NODE_CONFIG = {
  traditionalExchanges: {
    label: 'Traditional Exchanges',
    logo: `${LOGO_BASE_PATH}traditional-exchange-logo.png`,
    type: 'institution', // light grey background
    width: 140,
    height: 80,
  },
  settlement: {
    label: 'ST',
    logo: `${LOGO_BASE_PATH}settlement-logo.png`,
    type: 'wallet', // dark blue background
    width: 100,
    height: 70,
  },
  cdp: {
    label: 'CDP',
    logo: `${LOGO_BASE_PATH}cdp-logo.png`,
    type: 'institution',
    width: 100,
    height: 70,
  },
  dcdp: {
    label: 'dCDP',
    logo: `${LOGO_BASE_PATH}dcdp-logo.png`,
    type: 'wallet',
    width: 100,
    height: 70,
  },
  digitalExchange: {
    label: 'Digital Exchange',
    logo: `${LOGO_BASE_PATH}digital-exchange-logo.png`,
    type: 'wallet',
    width: 140,
    height: 80,
  },
  stablecoinProvider: {
    label: 'Stablecoin Provider',
    logo: `${LOGO_BASE_PATH}stablecoin-logo.png`,
    type: 'institution',
    width: 140,
    height: 80,
  },
  thomas: {
    label: 'Thomas',
    logo: `${LOGO_BASE_PATH}thomas-logo.png`,
    type: 'wallet',
    width: 120,
    height: 75,
  },
  ap: {
    label: 'AP',
    logo: `${LOGO_BASE_PATH}ap-logo.png`,
    type: 'wallet',
    width: 100,
    height: 70,
  },
};

function NetworkVisualizer() {
  const { blockNumber, isConnected } = useBlockchain();
  const [activeNodes, setActiveNodes] = useState(new Set());
  const [particles, setParticles] = useState([]);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

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

  // Create particle animation between two nodes
  const createParticle = (fromNode, toNode, color = '#1976d2', type = 'default') => {
    const from = toPixels(NODE_POSITIONS[fromNode].x, NODE_POSITIONS[fromNode].y);
    const to = toPixels(NODE_POSITIONS[toNode].x, NODE_POSITIONS[toNode].y);

    const particle = {
      id: Date.now() + Math.random(),
      from,
      to,
      color,
      type,
    };

    setParticles((prev) => [...prev, particle]);

    // Remove particle after animation completes
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== particle.id));
    }, 2000);
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

    // Colors based on type
    const fillColor = isWallet ? '#1565c0' : '#e0e0e0'; // Dark blue for wallets, light grey for institutions
    const textColor = isWallet ? '#ffffff' : '#333333'; // White text for wallets, dark text for institutions
    const strokeColor = isActive ? '#ff9800' : (isWallet ? '#1976d2' : '#999999');

    return (
      <g key={nodeId}>
        {/* Rectangle node */}
        <motion.rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={8}
          ry={8}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={isActive ? 3 : 2}
          className="network-node"
          animate={{
            scale: isActive ? 1.05 : 1,
            opacity: isActive ? 1 : 0.95,
          }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Logo image (top-left corner) */}
        <image
          x={x + 8}
          y={y + 8}
          width="24"
          height="24"
          href={config.logo}
          className="network-logo"
          opacity={isWallet ? 0.9 : 1}
          onError={(e) => {
            // Hide logo if image fails to load
            e.target.style.display = 'none';
          }}
        />
        
        {/* Stakeholder name (centered in rectangle) */}
        <text
          x={pos.x}
          y={pos.y + 6}
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          fill={textColor}
          className="network-label"
        >
          {config.label}
        </text>
      </g>
    );
  };

  // Render particles (animated dots flowing between nodes)
  const renderParticles = () => {
    return particles.map((particle) => {
      return (
        <motion.circle
          key={particle.id}
          r={4}
          fill={particle.color}
          initial={{ cx: particle.from.x, cy: particle.from.y, opacity: 1 }}
          animate={{ cx: particle.to.x, cy: particle.to.y, opacity: 0 }}
          transition={{ duration: 2, ease: 'easeInOut' }}
        />
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
          className="network-svg"
        >
          {/* Background grid (optional) */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" opacity="0.3" />

          {/* Connection lines */}
          <line
            x1={toPixels(NODE_POSITIONS.traditionalExchanges.x, NODE_POSITIONS.traditionalExchanges.y).x}
            y1={toPixels(NODE_POSITIONS.traditionalExchanges.x, NODE_POSITIONS.traditionalExchanges.y).y}
            x2={toPixels(NODE_POSITIONS.settlement.x, NODE_POSITIONS.settlement.y).x}
            y2={toPixels(NODE_POSITIONS.settlement.x, NODE_POSITIONS.settlement.y).y}
            stroke="#ccc"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          <line
            x1={toPixels(NODE_POSITIONS.settlement.x, NODE_POSITIONS.settlement.y).x}
            y1={toPixels(NODE_POSITIONS.settlement.x, NODE_POSITIONS.settlement.y).y}
            x2={toPixels(NODE_POSITIONS.cdp.x, NODE_POSITIONS.cdp.y).x}
            y2={toPixels(NODE_POSITIONS.cdp.x, NODE_POSITIONS.cdp.y).y}
            stroke="#000"
            strokeWidth="2"
          />
          <line
            x1={toPixels(NODE_POSITIONS.cdp.x, NODE_POSITIONS.cdp.y).x}
            y1={toPixels(NODE_POSITIONS.cdp.x, NODE_POSITIONS.cdp.y).y}
            x2={toPixels(NODE_POSITIONS.dcdp.x, NODE_POSITIONS.dcdp.y).x}
            y2={toPixels(NODE_POSITIONS.dcdp.x, NODE_POSITIONS.dcdp.y).y}
            stroke="#9c27b0"
            strokeWidth="3"
          />
          <line
            x1={toPixels(NODE_POSITIONS.dcdp.x, NODE_POSITIONS.dcdp.y).x}
            y1={toPixels(NODE_POSITIONS.dcdp.x, NODE_POSITIONS.dcdp.y).y}
            x2={toPixels(NODE_POSITIONS.digitalExchange.x, NODE_POSITIONS.digitalExchange.y).x}
            y2={toPixels(NODE_POSITIONS.digitalExchange.x, NODE_POSITIONS.digitalExchange.y).y}
            stroke="#1976d2"
            strokeWidth="2"
          />
          <line
            x1={toPixels(NODE_POSITIONS.stablecoinProvider.x, NODE_POSITIONS.stablecoinProvider.y).x}
            y1={toPixels(NODE_POSITIONS.stablecoinProvider.x, NODE_POSITIONS.stablecoinProvider.y).y}
            x2={toPixels(NODE_POSITIONS.thomas.x, NODE_POSITIONS.thomas.y).x}
            y2={toPixels(NODE_POSITIONS.thomas.x, NODE_POSITIONS.thomas.y).y}
            stroke="#42a5f5"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          <line
            x1={toPixels(NODE_POSITIONS.thomas.x, NODE_POSITIONS.thomas.y).x}
            y1={toPixels(NODE_POSITIONS.thomas.x, NODE_POSITIONS.thomas.y).y}
            x2={toPixels(NODE_POSITIONS.digitalExchange.x, NODE_POSITIONS.digitalExchange.y).x}
            y2={toPixels(NODE_POSITIONS.digitalExchange.x, NODE_POSITIONS.digitalExchange.y).y}
            stroke="#42a5f5"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          <line
            x1={toPixels(NODE_POSITIONS.ap.x, NODE_POSITIONS.ap.y).x}
            y1={toPixels(NODE_POSITIONS.ap.x, NODE_POSITIONS.ap.y).y}
            x2={toPixels(NODE_POSITIONS.digitalExchange.x, NODE_POSITIONS.digitalExchange.y).x}
            y2={toPixels(NODE_POSITIONS.digitalExchange.x, NODE_POSITIONS.digitalExchange.y).y}
            stroke="#42a5f5"
            strokeWidth="2"
            strokeDasharray="5,5"
          />

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

