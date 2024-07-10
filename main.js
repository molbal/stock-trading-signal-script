const { getStocks, getStockBars } = require('./api');
const { calculateIndicators } = require('./indicators');
const { generateExcelReport, saveDebugReport, dumpxls } = require('./report');
const tdqm = require('tqdm');
const path = require('path');
const fs = require('fs').promises;
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

async function main() {
  const argv = yargs(hideBin(process.argv)).option('stocks', {
    type: 'string',
    describe: 'Comma-separated list of stock symbols to process',
  }).option('dumpxls', {
    type: 'boolean',
    describe: 'If this flag is set, raw stocks data will be dumped as XLS',
  }).argv;


  let stocks = await getStocks();
  if (argv.stocks) {
    const specifiedStocks = argv.stocks.split(',').map(s => s.trim().toUpperCase());
    stocks = stocks.filter(stock => specifiedStocks.includes(stock.symbol.toUpperCase()));
  }

  const results = [];
  const debug = [];
  console.log('Listed', stocks.length, 'stocks');

  for (const stock of tdqm(stocks)) {
    const bars = await getStockBars(stock.symbol, '4H', 1000, 'raw', 'sip', argv.dumpxls || false);

    if (!bars || bars.length < 200) continue;

    const { ema200, macd } = calculateIndicators(bars);
    const currentPrice = bars[bars.length - 1].c;

    const isCurrentPriceAboveEMA200 = currentPrice > 1.03 * ema200[ema200.length - 1];
    const isMACDLessThanSignalDayA = macd[macd.length - 2].MACD < macd[macd.length - 2].signal;
    const isMACDGreaterThanSignalDayB = macd[macd.length - 1].MACD > macd[macd.length - 1].signal;
    const isMACDAndSignalNegative = macd[macd.length - 1].MACD < 0 && macd[macd.length - 1].signal < 0;

    if (argv.dumpxls) {
      console.log(bars.length, macd.length, ema200.length)
      const dump = bars.map((bar, index) => ({
        bar_c: bar.c,
        bar_h: bar.h,
        bar_l: bar.l,
        bar_n: bar.n,
        bar_o: bar.o,
        bar_t: bar.t,
        bar_v: bar.v,
        bar_vw: bar.vw,
        ema200: ema200[index] || 'unknown',
        macd: macd[index] ? macd[index].MACD : 'unknown',
        signal: macd[index] ? macd[index].signal : 'unknown'
      }));

      dumpxls(dump, 'dump-calculated-'+stock.symbol);

    }

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
