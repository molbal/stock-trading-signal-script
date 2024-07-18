const { getStocks, getStockBars } = require('./api');
const { calculateIndicators } = require('./indicators');
const { generateExcelReport, saveDebugReport, dumpxls } = require('./report');
const tdqm = require('tqdm');
const path = require('path');
const fs = require('fs').promises;
const yargs = require('yargs/yargs');
const moment = require('moment');
const { hideBin } = require('yargs/helpers');

async function main() {
  const argv = yargs(hideBin(process.argv)).option('stocks', {
    type: 'string',
    describe: 'Comma-separated list of stock symbols to process',
  }).option('dumpxls', {
    type: 'boolean',
    describe: 'If this flag is set, raw stocks data will be dumped as XLS',
  }).argv;

  try {
    await fs.mkdir('output');
  } catch (e) {
    // Ignore the error if the directory already exists
  }

  let stocks = await getStocks();
  if (argv.stocks) {
    const specifiedStocks = argv.stocks.split(',').map(s => s.trim().toUpperCase());
    stocks = stocks.filter(stock => specifiedStocks.includes(stock.symbol.toUpperCase()));
  }

  const results = [];
  const debug = [];
  console.log('Checking', stocks.length, 'stocks');

  for (const stock of tdqm(stocks)) {
    const bars = await getStockBars(stock.symbol, '30Min', 5000, 'raw', 'sip', argv.dumpxls);

    if (!bars || bars.length < 200) continue;

    const { ema200, macd } = calculateIndicators(bars);
    const currentPrice = bars[bars.length - 1].c;

    const isCurrentPriceAboveEMA200 = currentPrice > 1.03 * ema200[ema200.length - 1];
    const isMACDLessThanSignalDayA = macd[macd.length - 2].MACD < macd[macd.length - 2].signal;
    const isMACDGreaterThanSignalDayB = macd[macd.length - 1].MACD > macd[macd.length - 1].signal;
    const isMACDAndSignalNegative = macd[macd.length - 1].MACD < 0 && macd[macd.length - 1].signal < 0;

    if (argv.dumpxls) {
      const emaPadLength = bars.length - ema200.length;
      const macdPadLength = bars.length - macd.length;
      
      // Create arrays of nulls to pad ema200 and macd
      const emaPadArray = Array(emaPadLength).fill({ index: 'N/A', MACD: 'N/A', signal: 'N/A' });
      const macdPadArray = Array(macdPadLength).fill('N/A');

      // Pad ema200 and macd with nulls
      const paddedEma200 = emaPadArray.concat(ema200);
      const paddedMacd = macdPadArray.concat(macd);

      const dump = bars.map((bar, index) => ({
        "Closing price": bar.c,
        "High price": bar.h,
        "Low price": bar.l,
        "Trade count in the bar": bar.n,
        "Opening price": bar.o,
        "Timestamp": moment(bar.t).format(),
        "Bar volume": bar.v,
        "Bar volume in weighed avg price": bar.vw,
        ema200: paddedEma200[index] || 'unknown',
        macd: paddedMacd[index] ? paddedMacd[index].MACD : 'unknown',
        signal: paddedMacd[index] ? paddedMacd[index].signal : 'unknown'
      }));

      dumpxls(dump, 'output/dump-calculated-' + stock.symbol);
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
