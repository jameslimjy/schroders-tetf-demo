# Backend Overview

The backend implements the smart contracts, deployment tooling, and helper scripts that power the Tokenized ETF demo. All Solidity sources are written for the Foundry toolchain and documented in detail in `BACKEND_README.md`.

## Daily Commands

```bash
# Compile contracts
forge build

# Run the full test suite
forge test

# Format Solidity sources
forge fmt

# Take a gas snapshot before regressions
forge snapshot
```

## Local Blockchain

Use Anvil for local development and testing.

```bash
anvil
```

## Deployment Script

The production deployment script for local demos lives at `script/Deploy.s.sol`. It deploys SGDC, TES3, and dCDP, links their dependencies, and saves the addresses to `deployment-info.json`.

```bash
forge script script/Deploy.s.sol --broadcast \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Further Reading

- `BACKEND_README.md`: End-to-end contract summary, helper scripts, and design decisions
- `../PROJECT_SPECIFICATION.md`: End-to-end storyboard describing all demo phases

Refer to https://book.getfoundry.sh/ for official Foundry documentation. It covers advanced configuration, cheatcodes, debugging tools, and integration patterns used within this project.
