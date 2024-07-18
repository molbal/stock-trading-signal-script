const XLSX = require('xlsx');
const moment = require('moment');

async function dumpxls(data, filename) {
  
  // Extract keys from the first object
  const keys = Object.keys(data[0]);

  // Initialize the transformed array with the keys
  const transformed = [keys];

  // Append each record as an array of values
  data.forEach(record => {
      const values = keys.map(key => record[key]);
      transformed.push(values);
  });


  const ws = XLSX.utils.aoa_to_sheet(transformed);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dump');
  XLSX.writeFile(wb, filename+".xlsx")
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
  XLSX.writeFile(wb, 'output/matching_stocks-' + moment().format('YYYY-MM-DD') + '.xlsx');
}

async function saveDebugReport(results) {
  const ws_data = [['Symbol', 'Name', 'Current Price', '200-Period EMA', 'MACD', 'Signal', 'isCurrentPriceAboveEMA200', 'isMACDLessThanSignalDayA', 'isMACDGreaterThanSignalDayB', 'isMACDAndSignalNegative']];

  results.forEach(result => {
    ws_data.push([
      result.symbol,
      result.name,
      result.currentPrice,
      result.ema200,
      result.macd.MACD,
      result.macd.signal,
      result.isCurrentPriceAboveEMA200,
      result.isMACDLessThanSignalDayA,
      result.isMACDGreaterThanSignalDayB,
      result.isMACDAndSignalNegative,
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
  XLSX.utils.book_append_sheet(wb, ws, 'Debug Stocks');
  XLSX.writeFile(wb, 'output/debug-report--' + moment().format('YYYY-MM-DD') + '.xlsx');
}

module.exports = { generateExcelReport, saveDebugReport, dumpxls };
