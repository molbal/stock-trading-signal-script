const moment = require('moment');
const path = require('path');
const fs = require('fs').promises;
const config = require('./config');
const { sleep, readCache, writeCache, isCacheValid } = require('./utils');

async function getStocks() {
  const queryParams = new URLSearchParams({
    status: 'active',
    exchange: 'NYSE',
    class: 'us_equity'
  }).toString();

  const url = `${config.BASE_URL}/v2/assets?${queryParams}`;

  const headers = {
    'APCA-API-KEY-ID': config.ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': config.ALPACA_SECRET_KEY
  };

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.filter(stock => stock.tradable && !stock.symbol.includes('/'));
  } catch (error) {
    console.error('Error fetching stocks:', error);
    return [];
  }
}

async function getStockBars(symbol, timeframe = '4H', limit = 1000, adjustment = 'raw', feed = 'sip') {
  const headers = {
    accept: 'application/json',
    'APCA-API-KEY-ID': config.ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': config.ALPACA_SECRET_KEY
  };

  const startDate = moment().subtract(3, 'months').format('YYYY-MM-DD');
  const endDate = moment().subtract(1, 'days').format('YYYY-MM-DD');
  const cacheFile = path.join(config.CACHE_DIR, `${symbol}_${timeframe}_${limit}_${adjustment}_${feed}.json`);

  try {
    const cacheStats = await fs.stat(cacheFile).catch(() => null);

    if (isCacheValid(cacheStats, config.CACHE_EXPIRATION_HOURS)) {
      const cacheData = await readCache(cacheFile);
      if (cacheData) return cacheData.bars;
    }

    let allBars = [];
    let pageToken = null;

    do {
      const startTime = performance.now();
      const url = new URL(`${config.DATA_URL}/v2/stocks/${symbol}/bars`);
      const params = {
        timeframe,
        start: startDate,
        end: endDate,
        limit,
        adjustment,
        feed,
        sort: 'asc'
      };
      if (pageToken) {
        params.page_token = pageToken;
      }
      url.search = new URLSearchParams(params).toString();

      const response = await fetch(url, { headers });
      const endTime = performance.now();
      await sleep(Math.max(0, config.MAX_WAIT_TIME_MS - (endTime - startTime)));

      if (!response.ok) {
        console.error('errtext: ', await response.json());
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      allBars = allBars.concat(data.bars);
      pageToken = data.next_page_token;
    } while (pageToken);

    await writeCache(cacheFile, { bars: allBars });

    return allBars;
  } catch (error) {
    console.error(`Error fetching bars for ${symbol}:`, error);
    return [];
  }
}

module.exports = { getStocks, getStockBars };
