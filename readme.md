# EVM Token Creator

Node.js script designed to interact with multiple EVM compatible blockchains. It allows to check native token balances and deploy ERC-20 tokens using a simple Solidity smart contract. 

## Features

- **Balance Checking:** Check the native token balance of your wallets on selected chains.
- **Token Deployment:** Deploy a basic ERC-20 token with randomly generated names and symbols.
- **Optional Token Transfer/Burn:** After deployment, optionally transfer a random percentage of the tokens to the contract address (effectively burning them).
- **Randomization and Delays:** Options to randomize the order of chains and wallets, and to add random delays between actions for better transaction management.

## Note
- Costum delay, costum burn amount, multiple RPC per chain, costume restart time will added later.

## Prerequisites

- Node.js (v14 or higher recommended)

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/recitativonika/evm-token-creator.git
   cd evm-token-creator
   ```

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Prepare Private Keys:**

   - Add your private keys to`priv.txt`file, one per line.

4. **Configure Chains:**

   - Edit the `config.js` file to include the chains you want to interact with. Each chain should have:
     - `name`: Name of the chain.
     - `rpc`: RPC URL.
     - `chainId`: Chain ID.
     - `nativeTokenSymbol`: Symbol of the native token (e.g., ETH, BNB).

   Example:

   ```javascript
   module.exports = [
     {
       name: 'Ethereum',
       rpc: 'https://1rpc.io/eth',
       chainId: 1,
       nativeTokenSymbol: 'ETH'
     },
     // Add more chains as needed
   ];
   ```

## Usage/how to run

1. **Run the Script:**

   ```bash
   node index.js
   ```

2. **Follow the Prompts:**

   - **Select Actions:** Choose to check balances, create tokens, or both.
   - **Select Chains:** Choose the chains you want to interact with.
   - **Additional Options:** If creating tokens, you can choose to send/burn tokens after deployment, randomize chain and wallet order, and add random delays.

## Smart Contract

The script deploys a basic ERC-20 token contract with the following features:

- Standard functions: `transfer`, `approve`, `transferFrom`.
- Constructor parameters: `_name`, `_symbol`, `_initialSupply`.
- The contract is compiled at runtime using the `solc` compiler.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Disclaimer

This script is for educational purposes only. Use it at your own risk.
