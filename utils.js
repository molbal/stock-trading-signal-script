const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getStartDate() {
  return new Date().toISOString();
}

async function readCache(file) {
  try {
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function writeCache(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data), 'utf8');
}

function isCacheValid(fileStats, expirationHours) {
  return fileStats && (Date.now() - fileStats.mtimeMs) < expirationHours * 3600000;
}

module.exports = { sleep, getStartDate, readCache, writeCache, isCacheValid };
