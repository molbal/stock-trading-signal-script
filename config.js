require('dotenv').config();

const config = {
  ALPACA_API_KEY: process.env.ALPACA_API_KEY,
  ALPACA_SECRET_KEY: process.env.ALPACA_SECRET_KEY,
  BASE_URL: process.env.BASE_URL,
  DATA_URL: process.env.DATA_URL,
  CACHE_DIR: process.env.CACHE_DIR,
  CACHE_EXPIRATION_HOURS: process.env.CACHE_EXPIRATION_HOURS,
  MAX_WAIT_TIME_MS: process.env.MAX_WAIT_TIME_MS,
};

module.exports = config;
