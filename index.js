const axios = require('axios');
const tdqm = require(`tqdm`);
const moment = require('moment'); // require
const { EMA, MACD } = require('technicalindicators');
const fs = require('fs').promises;
var util = require('util');
const path = require('path');


require('dotenv').config()
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY;
const BASE_URL = 'https://paper-api.alpaca.markets';
const DATA_URL = 'https://data.alpaca.markets';
const CACHE_DIR = './temp/';
const CACHE_EXPIRATION_HOURS = 8;
const MAX_WAIT_TIME_MS = 333;

async function getStocks() {
  const queryParams = new URLSearchParams({
    status: 'active',
    exchange: 'NYSE',
    class: 'us_equity'
  }).toString();

  const url = `${BASE_URL}/v2/assets?${queryParams}`;
  
  const config = {
    headers: {
      'APCA-API-KEY-ID': ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY
    }
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.filter(stock => stock.tradable);
  } catch (error) {
    console.error('Error fetching stocks:', error);
    return [];
  }
}



async function getStockBars(symbol, timeframe = '4H', limit = 1000, adjustment = 'raw', feed = 'sip') {
  const config = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'APCA-API-KEY-ID': ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY
    }
  };

  const startDate = moment().subtract(3, 'months').format('YYYY-MM-DD');
  const endDate = moment().subtract(1, 'days').format('YYYY-MM-DD');
  const cacheFile = path.join(CACHE_DIR, `${symbol}_${timeframe}_${limit}_${adjustment}_${feed}.json`);

  try {
    const cacheStats = await fs.stat(cacheFile).catch(() => null);

    if (cacheStats && (Date.now() - cacheStats.mtimeMs) < CACHE_EXPIRATION_HOURS * 3600000) {
      const cacheData = await fs.readFile(cacheFile, 'utf8');
      return JSON.parse(cacheData).bars;
    }

    let allBars = [];
    let pageToken = null;

    do {
      const startTime = performance.now();
      const url = new URL(`${DATA_URL}/v2/stocks/${symbol}/bars`);
      const params = {
        timeframe: timeframe,
        start: startDate,
        end: endDate,
        limit: limit,
        adjustment: adjustment,
        feed: feed,
        sort: 'asc'
      };
      if (pageToken) {
        params.page_token = pageToken;
      }
      url.search = new URLSearchParams(params).toString();

      const response = await fetch(url, config);
      const endTime = performance.now();
      await sleep(Math.max(0, MAX_WAIT_TIME_MS - (endTime - startTime)));

      if (!response.ok) {
        console.error('errtext: ', await response.json());
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      allBars = allBars.concat(data.bars);

      pageToken = data.next_page_token;
    } while (pageToken);

    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify({ bars: allBars }), 'utf8');

    return allBars;
  } catch (error) {
    console.error(`Error fetching bars for ${symbol}:`, error);
    return [];
  }
}


// Helper function to get the start date
function getStartDate() {
  // Implement your logic to calculate the start date
  return new Date().toISOString();
}

function calculateIndicators(bars) {
  const closes = bars.map(bar => bar.c);
  const ema200 = EMA.calculate({ period: 200, values: closes });
  const macd = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  return { ema200, macd };
}

async function main() {
  const stocks = await getStocks();
  const results = [];
  console.log('Listed ',stocks.length,' stocks');

  for (const stock of tdqm(stocks)) {
    const bars = await getStockBars(stock.symbol);

    if (!bars || bars.length < 200) continue;

    const { ema200, macd } = calculateIndicators(bars);
    const currentPrice = bars[bars.length - 1].c;
    
    if (
      currentPrice > ema200[ema200.length - 1] &&
      macd[macd.length - 1].MACD > macd[macd.length - 1].signal &&
      macd[macd.length - 1].signal < 0 &&
      currentPrice > 1.03 * ema200[ema200.length - 1]
    ) {
      results.push({
        symbol: stock.symbol,
        currentPrice,
        ema200: ema200[ema200.length - 1],
        macd: macd[macd.length - 1]
      });
      console.log('💵💵💵 Stock signal ',{
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: currentPrice,
        ema200: ema200[ema200.length - 1],
        macd: macd[macd.length - 1]
      })
    }
  }

  console.log('Matching stocks:', results);
}

main();
