# OpenServAI Goat Agents Setup Guide

## Installation Steps

### 1. Clone the Repository
```sh
git clone <repository-url>
```

### 2. Setup Allora Agent
```sh
cd allora
npm install
```
- Update the `.env` file with the required variables.
```sh
npm run dev
ngrok http 7378
```

### 3. Setup CoinGecko Agent
```sh
cd ..
cd coingecko
npm install
```
- Update the `.env` file with the required variables.
```sh
npm run dev
ngrok http 5000
```

### 4. Setup DexScanner Agent
```sh
cd ..
cd dexscanner
npm install
```
- Update the `.env` file with the required variables.
```sh
npm run dev
ngrok http 5001
```

### 5. Setup RugCheck Agent
```sh
cd ..
cd rugcheck
npm install
```
- Update the `.env` file with the required variables.
```sh
npm run dev
ngrok http 4000
```

---

## Agent Capabilities

### 1. **Allora Agent**
**Agent Name:** BTC and ETH Prediction

**Capabilities:**
- Uses **Allora Network API**
- Predicts **USD value** of Bitcoin and Ethereum
- Supports timeframes of **5 minutes** and **8 hours**

---

### 2. **DexScanner Agent**
**Agent Name:** Goat-DexScanner

**Capabilities:**
- Uses **DexScanner API**
- **Search Pairs of Tokens**
  - Find pairs by query string
  - Get chain, DEX, pair address
  - Base/quote token details (address, name, symbol)
  - Current price in USD & native currency
  - Transactions (buys, sells, timeframes)
  - Volume in USD (various timeframes)
  - Price change percentage (various timeframes)
  - Pair liquidity (USD, base, quote)
  - FDV & Market Cap
- **Get Pair by Chain and Pair-ID**
  - Retrieve complete data of a specific pair
- **Get Token Pairs by Token Address**
  - Find all pairs for a token (requires chain & token address)
  - Shows all DEXs/pairs traded
- **Get multiple pairs per address**
  - Supports up to 30 token addresses
  - Returns an array of pair objects

---

### 3. **CoinGecko Agent**
**Agent Name:** CoinGecko Agent

**Capabilities:** Uses **CoinGecko API** to provide:
- **coingecko_get_trending_coins**: List of currently trending coins (top searches, NFTs, and categories)
- **coingecko_get_coin_prices**: Current prices for specified coins in various currencies
- **coingecko_search_coins**: Searches for coins, categories, and exchanges by name or symbol
- **coingecko_get_coin_price_by_contract_address**: Gets price and market data for a token using its contract address
- **coingecko_get_coin_data**: Comprehensive data for a coin, including market trends, social sentiment, and developer activity
- **coingecko_get_historical_data**: Historical price data for a specific date
- **coingecko_get_ohlc_data**: Open-High-Low-Close (OHLC) market data
- **coingecko_get_trending_coin_categories**: Get trending coins within specific categories
- **coingecko_coin_categories**: List of all coin categories

---

### 4. **RugCheck Agent**
**Agent Name:** Solana RugCheck Specialist

**Capabilities:** Uses **RugCheck API** to provide:
- **get_recently_detected_tokens**: Fetches a list of new tokens that have been recently scanned
- **get_trending_tokens_last_24_hours**: Lists top trending tokens in the last 24 hours
- **get_most_voted_tokens_last_24_hours**: Displays tokens with the most votes (community trust indicator)
- **get_recently_verified_tokens**: Shows the recently verified tokens (good for safer investments)
- **generate_token_report_summary**: Provides a detailed risk assessment report for a token, highlighting potential rug pull indicators

---

## Final Notes
- Ensure **all `.env` files** are properly configured before running each agent.
- Use **ngrok** to expose each service for external API calls.
- Agents can be added to **OpenServ Platform** using the specified names and capabilities above.

Happy coding! 🚀
