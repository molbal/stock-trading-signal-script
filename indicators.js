const { EMA, MACD } = require('technicalindicators');

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

module.exports = { calculateIndicators };
