const ethers = require('ethers');
const solc = require('solc');
const fs = require('fs').promises;
const inquirer = require('inquirer');
require('dotenv').config();
const { adjectives, animals } = require('unique-names-generator');
const chains = require('./config.js');
const readline = require('readline');

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}
process.stdin.setMaxListeners(20);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
};

const colored = (text, color) => `${color}${text}${colors.reset}`;

const indent = '  ';
const logHeader = (message) => console.log(`${colors.bold}${colors.white}${message}${colors.reset}`);
const logSubHeader = (message) => console.log(`${indent}${colors.bold}${colors.cyan}${message}${colors.reset}`);
const logInfo = (message) => console.log(`${indent}${indent}${colors.blue}${message}${colors.reset}`);
const logSuccess = (message) => console.log(`${indent}${indent}${colors.green}${message}${colors.reset}`);
const logError = (message) => console.error(`${indent}${indent}${colors.red}${message}${colors.reset}`);

function formatError(error) {
  if (typeof error === 'string') return error;

  if (error.code && error.reason) {
    return `${error.code}: ${error.reason}`;
  }

  if (error.error && error.error.message) {
    return error.error.message;
  }

  if (error.body) {
    try {
      const bodyObj = JSON.parse(error.body);
      if (bodyObj.error && bodyObj.error.message) {
        return `RPC Error: ${bodyObj.error.message}`;
      }
    } catch (e) {
      const errorMatch = error.body.match(/"message":"([^"]+)"/);
      if (errorMatch && errorMatch[1]) {
        return `RPC Error: ${errorMatch[1]}`;
      }
    }
  }

  if (error.message && error.message.includes('timeout')) {
    return 'Connection timeout - network may be congested';
  }

  if (error.message) {
    if (error.message.includes('insufficient funds')) {
      return 'Insufficient funds for transaction';
    }
    if (error.message.includes('nonce')) {
      return 'Nonce error: Transaction may be pending or rejected';
    }
    if (error.message.includes('gas')) {
      return 'Gas estimation failed: Transaction may be invalid';
    }
    if (error.message.includes('ACCOUNT_DOES_NOT_EXIST')) {
      return 'Account does not exist or has no funds';
    }

    return error.message.split('\n')[0];
  }

  const errorStr = JSON.stringify(error);
  return errorStr.length > 100 ? errorStr.substring(0, 100) + '...' : errorStr;
}

function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

function randomDelay() {
  const minDelay = 10 * 1000;
  const maxDelay = 3 * 60 * 1000;
  return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatCycleWaitTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  return `${days}d:${remainingHours}h:${remainingMinutes}m:${remainingSeconds}s`;
}

function formatDelayTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;
  return `${minutes}m:${paddedSeconds}s`;
}

async function countdown(delay, message) {
  const endTime = Date.now() + delay;
  const initialMessage = `${message}...`;
  process.stdout.write(`${indent}${indent}${colors.cyan}${initialMessage}${colors.reset}`);
  while (Date.now() < endTime) {
    const remaining = endTime - Date.now();
    const formatted = formatDelayTime(remaining);
    process.stdout.clearLine(0);
    process.stdout.write(`${indent}${indent}${colors.cyan}${initialMessage} Time remaining: ${formatted}\r${colors.reset}`);
    await sleep(1000);
  }
  process.stdout.write('\n');
}

async function waitForTransactionWithTimeout(tx, timeoutMs, initialMessage = 'Waiting for confirmation') {
  const startTime = Date.now();
  const endTime = startTime + timeoutMs;
  let interval;
  const updateConsole = () => {
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`${indent}${indent}${colors.cyan}${initialMessage}... (${remaining} seconds left)${colors.reset}`);
  };
  updateConsole();
  interval = setInterval(updateConsole, 1000);
  try {
    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timeout')), timeoutMs))
    ]);
    clearInterval(interval);
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    logSuccess('Transaction confirmed');
    return receipt;
  } catch (error) {
    clearInterval(interval);
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    if (error.message === 'Transaction timeout') logError('Transaction confirmation timed out');
    else logError(`Error waiting for transaction: ${formatError(error)}`);
    throw error;
  }
}

function generateTokenDetails() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const tokenName = adjective.charAt(0).toUpperCase() + adjective.slice(1) + animal.charAt(0).toUpperCase() + animal.slice(1);
  const symbolLength = Math.random() < 0.5 ? 2 : 3;
  const tokenSymbol = tokenName.substring(0, symbolLength).toUpperCase();
  return { tokenName, tokenSymbol };
}

const contractCode = `
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract RandomToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _initialSupply;
        balanceOf[msg.sender] = _initialSupply;
    }

    function transfer(address to, uint256 value) public returns (bool) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Insufficient allowance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        emit Transfer(from, to, value);
        return true;
    }
}
`;

const input = {
  language: 'Solidity',
  sources: { 'RandomToken.sol': { content: contractCode } },
  settings: { outputSelection: { '*': { '*': ['*'] } } },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors) {
  logError('Compilation errors:');
  output.errors.forEach(error => logError(error.formattedMessage));
  process.exit(1);
}
const contract = output.contracts['RandomToken.sol'].RandomToken;
const abi = contract.abi;
const bytecode = contract.evm.bytecode.object;

async function deployContractForWalletOnChain(privKey, chain, delayOptions, walletNumber, includeSendBurn) {
  const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
  const timeout = 10000;
  try {
    const network = await Promise.race([
      provider.getNetwork(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting network')), timeout))
    ]);
    if (network.chainId !== chain.chainId) {
      logError(`Connected to wrong network for ${chain.name}. Expected chainId ${chain.chainId}, got ${network.chainId}`);
      return;
    }
  } catch (error) {
    logError(error.message === 'Timeout getting network' ? `Timeout connecting to ${chain.name}` : `Error checking chainId for ${chain.name}: ${formatError(error)}`);
    return;
  }

  try {
    const wallet = new ethers.Wallet(privKey, provider);
    const deployerAddress = wallet.address;
    logInfo(`Deployer address: ${colored(deployerAddress, colors.magenta)}`);
    const balance = await provider.getBalance(deployerAddress);
    logInfo(`${chain.name}: ${colored(ethers.utils.formatEther(balance), colors.green)} ${chain.nativeTokenSymbol}`);

    if (balance.isZero()) {
      logError(`No funds available on ${chain.name}. Please fund this address before deploying.`);
      return;
    }

    const { tokenName, tokenSymbol } = generateTokenDetails();
    const minSupply = 1000;
    const maxSupply = 1000000000;
    const randomInt = Math.floor(Math.random() * (maxSupply - minSupply + 1)) + minSupply;
    const initialSupply = ethers.utils.parseUnits(randomInt.toString(), 18);

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const deployPromise = factory.deploy(tokenName, tokenSymbol, initialSupply);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Deployment timeout')), 60000));
    const contract = await Promise.race([deployPromise, timeoutPromise]);
    const deployTx = contract.deployTransaction;
    const deployReceipt = await waitForTransactionWithTimeout(deployTx, 60000, 'Deployment transaction sent, waiting for confirmation');

    logSuccess(`Contract deployed at address: ${colored(contract.address, colors.magenta)}`);
    logInfo(`Token name: ${colored(tokenName, colors.cyan)}, Symbol: ${colored(tokenSymbol, colors.yellow)}, Initial supply: ${colored(randomInt + ' tokens', colors.green)}`);

    if (delayOptions.afterDeployment) {
      const delay = randomDelay();
      await countdown(delay, "Waiting after deployment");
    }

    if (includeSendBurn) {
      const percentage = Math.floor(Math.random() * 7900 + 100);
      const amountToTransfer = initialSupply.mul(percentage).div(10000);
      const tx = await contract.transfer(contract.address, amountToTransfer);
      await waitForTransactionWithTimeout(tx, 60000, 'Transfer transaction sent, waiting for confirmation');
      logSuccess(`Transferred ${colored(ethers.utils.formatUnits(amountToTransfer, 18), colors.green)} tokens to ${colored(contract.address, colors.magenta)}`);
      if (delayOptions.afterTransfer) {
        const delay = randomDelay();
        await countdown(delay, "Waiting after transfer");
      }
    }
  } catch (error) {
    logError(`Error on ${chain.name} for Wallet #${walletNumber}: ${formatError(error)}`);
  }
}

(async () => {
  let privateKeys;
  try {
    const data = await fs.readFile('priv.txt', 'utf8');
    privateKeys = data.split('\n').map(key => key.trim()).filter(key => key.length > 0);
  } catch (error) {
    logError(`Error reading priv.txt: ${formatError(error)}`);
    process.exit(1);
  }
  if (privateKeys.length === 0) {
    logError('No private keys found in priv.txt');
    process.exit(1);
  }
  const totalWallets = privateKeys.length;
  const wallets = privateKeys.map((key, index) => ({ key, originalIndex: index }));

  const promptActions = await inquirer.prompt([{
    type: 'checkbox',
    name: 'actions',
    message: 'What do you want to do?',
    choices: [
      { name: 'Check main/native balance', value: 'checkBalance' },
      { name: 'Create contract/token', value: 'createToken' }
    ],
    pageSize: 10,
    loop: false,
    validate: answer => answer.length < 1 ? 'You must choose at least one action.' : true
  }]);

  const actions = promptActions.actions;

  const promptChains = await inquirer.prompt([{
    type: 'checkbox',
    name: 'selectedChains',
    message: 'Select the chains:',
    choices: chains.map(chain => chain.name),
    pageSize: 20,
    loop: false,
    validate: answer => answer.length < 1 ? 'You must choose at least one chain.' : true
  }]);

  const selectedChains = promptChains.selectedChains;
  const selectedChainConfigs = chains.filter(chain => selectedChains.includes(chain.name));

  let tokenAddresses = {};
  let includeSendBurn = false;
  let delayOptions = {};
  let randomizeChains = false;
  let randomizeWallets = false;

  if (actions.includes('createToken')) {
    const { sendBurnAfterDeployment } = await inquirer.prompt([{
      type: 'confirm',
      name: 'sendBurnAfterDeployment',
      message: 'Do you want to send/burn some tokens after deployment?',
      default: false
    }]);
    includeSendBurn = sendBurnAfterDeployment;

    const { randomizeChainsInput } = await inquirer.prompt([{
      type: 'confirm',
      name: 'randomizeChainsInput',
      message: 'Randomize chain order?',
      default: false
    }]);
    randomizeChains = randomizeChainsInput;

    const { randomizeWalletsInput } = await inquirer.prompt([{
      type: 'confirm',
      name: 'randomizeWalletsInput',
      message: 'Randomize wallet order?',
      default: false
    }]);
    randomizeWallets = randomizeWalletsInput;

    const { addDelays } = await inquirer.prompt([{
      type: 'confirm',
      name: 'addDelays',
      message: 'Add random delays (10s-3m)?',
      default: false
    }]);

    if (addDelays) {
      const delayChoices = [
        { name: 'After each deployment', value: 'afterDeployment' },
        { name: 'After each transfer', value: 'afterTransfer' },
        { name: 'After each chain', value: 'afterChain' },
        { name: 'After each wallet', value: 'afterWallet' }
      ];
      const { selectedDelays } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedDelays',
        message: 'Add random delays (10s-3m) at:',
        choices: delayChoices,
        pageSize: 10,
        loop: false
      }]);
      delayOptions = {
        afterDeployment: selectedDelays.includes('afterDeployment'),
        afterTransfer: selectedDelays.includes('afterTransfer'),
        afterChain: selectedDelays.includes('afterChain'),
        afterWallet: selectedDelays.includes('afterWallet')
      };
    } else {
      delayOptions = {
        afterDeployment: false,
        afterTransfer: false,
        afterChain: false,
        afterWallet: false
      };
    }
  }

  if (actions.includes('sendBurn') && !actions.includes('createToken')) {
    for (const chain of selectedChainConfigs) {
      const { tokenAddress } = await inquirer.prompt([{
        type: 'input',
        name: 'tokenAddress',
        message: `Enter the token contract address on ${chain.name}:`,
        validate: input => ethers.utils.isAddress(input) ? true : 'Invalid address'
      }]);
      tokenAddresses[chain.name] = tokenAddress;
    }
  }

  if (randomizeWallets && actions.includes('createToken')) shuffle(wallets);

  const isPeriodic = actions.includes('createToken');
  while (true) {
    for (const wallet of wallets) {
      const privKey = wallet.key;
      const walletNumber = wallet.originalIndex + 1;
      logHeader(`===== Processing Wallet #${walletNumber} of ${totalWallets} =====`);

      if (actions.includes('checkBalance') && !actions.includes('createToken')) {
        logSubHeader(`----- Checking Native Balances -----`);
        for (const chain of selectedChainConfigs) {
          try {
            const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
            const walletInstance = new ethers.Wallet(privKey, provider);
            const balance = await provider.getBalance(walletInstance.address);
            const formattedBalance = ethers.utils.formatEther(balance);
            console.log(`${indent}${indent}${colored(chain.name, colors.blue)}: ${colored(formattedBalance, colors.green)} ${chain.nativeTokenSymbol}`);
          } catch (error) {
            logError(`Error checking balance on ${chain.name}: ${formatError(error)}`);
          }
        }
      }

      if (actions.includes('createToken')) {
        let chainsToProcess = randomizeChains ? shuffle([...selectedChainConfigs]) : selectedChainConfigs;
        for (const chain of chainsToProcess) {
          logSubHeader(`----- Deploying on ${chain.name} -----`);
          await deployContractForWalletOnChain(privKey, chain, delayOptions, walletNumber, includeSendBurn);
          if (delayOptions.afterChain) {
            const delay = randomDelay();
            await countdown(delay, `Waiting after ${chain.name}`);
          }
        }
        if (delayOptions.afterWallet) {
          const delay = randomDelay();
          await countdown(delay, "Waiting after wallet");
        }
      }

      if (actions.includes('sendBurn') && !actions.includes('createToken')) {
        for (const chain of selectedChainConfigs) {
          const tokenAddress = tokenAddresses[chain.name];
          if (!tokenAddress) continue;
          logSubHeader(`----- Sending/Burning on ${chain.name} -----`);
          try {
            const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
            const walletInstance = new ethers.Wallet(privKey, provider);
            const tokenContract = new ethers.Contract(tokenAddress, abi, walletInstance);
            const balance = await tokenContract.balanceOf(walletInstance.address);
            if (balance.eq(0)) {
              logInfo(`Wallet #${walletNumber} has zero balance, skipping`);
              continue;
            }
            const percentage = Math.floor(Math.random() * 7900 + 100);
            const amountToTransfer = balance.mul(percentage).div(10000);
            try {
              const tx = await tokenContract.transfer(tokenAddress, amountToTransfer);
              await waitForTransactionWithTimeout(tx, 60000);
              logSuccess(`Transferred ${colored(ethers.utils.formatUnits(amountToTransfer, 18), colors.green)} tokens to ${colored(tokenAddress, colors.magenta)}`);
            } catch (error) {
              logError(`Error transferring tokens: ${formatError(error)}`);
            }
          } catch (error) {
            logError(`Error on ${chain.name}: ${formatError(error)}`);
          }
        }
      }
    }

    if (!isPeriodic) break;

    const waitTime = (2 + Math.random()) * 24 * 3600 * 1000;
    const endTime = Date.now() + waitTime;
    while (Date.now() < endTime) {
      const remaining = endTime - Date.now();
      const formatted = formatCycleWaitTime(remaining);
      process.stdout.clearLine(0);
      process.stdout.write(`${indent}${colors.cyan}Next cycle in: ${formatted}\r${colors.reset}`);
      await sleep(1000);
    }
    process.stdout.write('\n');
    logInfo('Starting next cycle...');
  }
})().catch(error => {
  logError(`Unexpected error: ${formatError(error)}`);
  process.exit(1);
});
