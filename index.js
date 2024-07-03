const axios = require('axios');
const tdqm = require(`tqdm`);
const moment = require('moment'); // require
const { EMA, MACD } = require('technicalindicators');
const fs = require('fs').promises;
var util = require('util');
const path = require('path');
const XLSX = require('xlsx');


require('dotenv').config()
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY;
const BASE_URL = process.env.BASE_URL;
const DATA_URL = process.env.DATA_URL;
const CACHE_DIR = process.env.CACHE_DIR;
const CACHE_EXPIRATION_HOURS = process.env.CACHE_EXPIRATION_HOURS;
const MAX_WAIT_TIME_MS = process.env.MAX_WAIT_TIME_MS;

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
    return data.filter(stock => stock.tradable && !stock.symbol.includes('/'));
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


async function generateExcelReport(results) {
  const ws_data = [['Symbol', 'Name', 'Current Price', '200-Period EMA', 'MACD', 'Signal']];
  
  results.forEach(result => {
    ws_data.push([
      result.symbol,
      result.name,
      result.currentPrice,
      result.ema200,
      result.macd.MACD,
      result.macd.signal
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // Set column widths
  const columnWidths = [
    { wch: 10 }, // Symbol
    { wch: 25 }, // Name
    { wch: 15 }, // Current Price
    { wch: 20 }, // 200-Period EMA
    { wch: 10 }, // MACD
    { wch: 10 }  // Signal
  ];
  ws['!cols'] = columnWidths;

  // Apply proper formatting
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cell_address = { c: C, r: R };
      const cell_ref = XLSX.utils.encode_cell(cell_address);
      if (!ws[cell_ref]) continue;

      if (R === 0 || C === 0) {
        // Header row and first column formatting
        ws[cell_ref].s = {
          font: { bold: true, sz: 12 },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: 'FFFFCC' } }
        };
      } else if (C === 2 || C === 3) {
        // Currency formatting for "Current Price" and "200-Period EMA"
        ws[cell_ref].z = '$#,##0.00';
        ws[cell_ref].s = {
          alignment: { horizontal: 'right', vertical: 'center' }
        };
      } else if (C >= 4) {
        // Number formatting for "MACD" and "Signal"
        ws[cell_ref].z = '#,##0.00';
        ws[cell_ref].s = {
          alignment: { horizontal: 'right', vertical: 'center' }
        };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Matching Stocks');
  XLSX.writeFile(wb, 'matching_stocks-' + moment().format('YYYY-MM-DD') + '.xlsx');
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
        name: stock.name,
        currentPrice: currentPrice,
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

  console.log('Exporting ', results.length,' results to xlsx.');
  await generateExcelReport(results);
  console.log('Done. Good luck trading.');
}

main();
