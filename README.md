# Stock Signal Script

This repository contains a script that interacts with the Alpaca API to fetch stock data, calculate technical indicators (EMA and MACD), and identify potential trading signals based on MACD and EMA conditions. 

## Features

- Fetches a list of active and tradable stocks from the NYSE using the Alpaca API.
- Retrieves historical stock data (bars) for each stock.
- Calculates the 200-period Exponential Moving Average (EMA) and the Moving Average Convergence Divergence (MACD) indicators.
- Identifies stocks that meet specific trading conditions based on the calculated indicators.
- Caches API responses to reduce the number of requests and improve performance.

## Requirements

- Node.js (v14 or later)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/molbal/stock-trading-signal-script.git
    cd stock-trading-signal-script
    ```

2. Install the required dependencies:
    ```bash
    npm install
    ```

3. Copy or rename the `.env.example` file to `.env` and fill in your Alpaca API key and secret
    ```env
    # Alpaca API key for authentication
    ALPACA_API_KEY=

    # Alpaca secret key for authentication
    ALPACA_SECRET_KEY=

    # Base URL for Alpaca API (paper trading environment)
    BASE_URL="https://paper-api.alpaca.markets"

    # URL for Alpaca data API
    DATA_URL="https://data.alpaca.markets"

    # Directory to store cache files
    CACHE_DIR="./temp/"

    # Cache expiration time in hours
    CACHE_EXPIRATION_HOURS=8

    # Keep this delay between sending requests to the API to
    # avoid hitting the rate limit cap. (200req/sec on free tier)
    MAX_WAIT_TIME_MS=310
    ```

4. Run the script:
    ```bash
    node index.js
    ```

## Usage

The script fetches a list of stocks from the Alpaca API, retrieves historical data for each stock, and calculates the EMA and MACD indicators. It then identifies stocks that meet the following conditions:

- Current price is above the 200-period EMA.
- MACD line is above the signal line.
- Signal line is below zero.
- Current price is more than 3% above the 200-period EMA.

Matching stocks are logged to the console with their symbol, name, current price, EMA value, and MACD values.

## License

This project is licensed under the MIT License.