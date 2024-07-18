const path = require('path');
const fs = require('fs').promises;
const config = require('./config');
const moment = require('moment-timezone');
const { dumpxls } = require('./report');
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

function printCurlRequest(url, headers) {
  let curlCommand = `curl -X GET "${url}"`;
  for (const [key, value] of Object.entries(headers)) {
    curlCommand += ` -H "${key}: ${value}"`;
  }
  console.log('CURL Request:', curlCommand);
}

async function getStockBars(symbol, timeframe = '30Min', limit = 5000, adjustment = 'raw', feed = 'sip', dumpxlss = false) {
  const headers = {
    accept: 'application/json',
    'APCA-API-KEY-ID': config.ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': config.ALPACA_SECRET_KEY
  };

  const startDate = moment.tz("America/New_York").subtract(3, 'months').startOf('day').add(9, 'hours').add(30, 'minutes').format('YYYY-MM-DDTHH:mm:ss') + '-04:00';
  const endDate = moment.tz("America/New_York").subtract(1, 'days').startOf('day').add(16, 'hours').format('YYYY-MM-DDTHH:mm:ss') + '-04:00';
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
        limit: limit,
        adjustment: adjustment,
        feed: feed,
        sort: 'asc'
      };
      if (pageToken) {
        params.page_token = pageToken;
      }
      url.search = new URLSearchParams(params).toString();

      // Print curl request for url with headers
      // printCurlRequest(url, headers);

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

    // Aggregate 30-minute bars into desired 4-hour bars
    const aggregatedBars = aggregateBars(allBars);

    await writeCache(cacheFile, { bars: aggregatedBars });

    if (dumpxlss === true) {
      await dumpxls(aggregatedBars, 'temp/debug-dump-'+symbol);
    }

    return aggregatedBars;
  } catch (error) {
    console.error(`Error fetching bars for ${symbol}:`, error);
    return [];
  }
}

function aggregateBars(bars) {
  const segments = [
    { start: "09:30", end: "13:30" },
    { start: "13:30", end: "16:00" }
  ];
  
  let aggregatedBars = [];
  let currentSegment = null;
  let aggregatedBar = null;

  bars.forEach(bar => {
    const barTime = moment(bar.t, "YYYY-MM-DDTHH:mm:ssZ").tz("America/New_York").format("HH:mm");

    if (currentSegment && barTime >= currentSegment.end) {
      aggregatedBars.push(aggregatedBar);
      currentSegment = null;
      aggregatedBar = null;
    }

    if (!currentSegment || barTime >= currentSegment.start) {
      currentSegment = segments.find(segment => barTime >= segment.start && barTime < segment.end);
      if (currentSegment) {
        aggregatedBar = {
          o: bar.o,
          h: bar.h,
          l: bar.l,
          c: bar.c,
          v: bar.v,
          t: bar.t // This will be overwritten with the segment start time
        };
        aggregatedBar.t = moment(aggregatedBar.t).startOf('day').hour(parseInt(currentSegment.start.split(':')[0])).minute(parseInt(currentSegment.start.split(':')[1])).second(0).format("YYYY-MM-DDTHH:mm:ssZ");
      }
    } else {
      aggregatedBar.h = Math.max(aggregatedBar.h, bar.h);
      aggregatedBar.l = Math.min(aggregatedBar.l, bar.l);
      aggregatedBar.c = bar.c;
      aggregatedBar.v += bar.v;
    }
  });

  if (aggregatedBar) {
    aggregatedBars.push(aggregatedBar);
  }

  return aggregatedBars;
}

module.exports = { getStocks, getStockBars };
