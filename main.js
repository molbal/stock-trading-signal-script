const { getStocks, getStockBars } = require('./api');
const { calculateIndicators } = require('./indicators');
const { generateExcelReport, saveDebugReport } = require('./report');
const tdqm = require('tqdm');
const path = require('path');
const fs = require('fs').promises;

async function main() {
  await fs.mkdir('charts', { recursive: true });
  const stocks = await getStocks();
  const results = [];
  const debug = [];
  console.log('Listed', stocks.length, 'stocks');

  for (const stock of tdqm(stocks)) {
    const bars = await getStockBars(stock.symbol);

    if (!bars || bars.length < 200) continue;

    const { ema200, macd } = calculateIndicators(bars);
    const currentPrice = bars[bars.length - 1].c;

    const isCurrentPriceAboveEMA200 = currentPrice > 1.03 * ema200[ema200.length - 1];
    const isMACDLessThanSignalDayA = macd[macd.length - 2].MACD < macd[macd.length - 2].signal;
    const isMACDGreaterThanSignalDayB = macd[macd.length - 1].MACD > macd[macd.length - 1].signal;
    const isMACDAndSignalNegative = macd[macd.length - 1].MACD < 0 && macd[macd.length - 1].signal < 0;

    if (
      isCurrentPriceAboveEMA200 &&
      isMACDLessThanSignalDayA &&
      isMACDGreaterThanSignalDayB &&
      isMACDAndSignalNegative
    ) {
      const result = {
        symbol: stock.symbol,
        name: stock.name,
        currentPrice: currentPrice,
        ema200: ema200[ema200.length - 1],
        macd: macd[macd.length - 1]
      };
      results.push(result);
      console.log('💵💵💵 Signal!', result);
    }
    debug.push({
      isCurrentPriceAboveEMA200: isCurrentPriceAboveEMA200 ? 'true' : 'false',
      isMACDLessThanSignalDayA: isMACDLessThanSignalDayA ? 'true' : 'false',
      isMACDGreaterThanSignalDayB: isMACDGreaterThanSignalDayB ? 'true' : 'false',
      isMACDAndSignalNegative: isMACDAndSignalNegative ? 'true' : 'false',
      symbol: stock.symbol,
      name: stock.name,
      currentPrice: currentPrice,
      ema200: ema200[ema200.length - 1],
      macd: macd[macd.length - 1],
    });
  }

  console.log('Exporting', results.length, 'results to xlsx.');
  await generateExcelReport(results);
  await saveDebugReport(debug);
  console.log('Done. Good luck trading.');
}

main();
