/*
 * TidyCSV core engine — parse, serialize, convert, dedupe.
 * RFC 4180-compliant CSV parsing with delimiter auto-detection.
 * No dependencies. Runs in the browser (window.TidyCSV) and Node (module.exports).
 */
(function (global) {
  'use strict';

  var DELIMITERS = [',', ';', '\t', '|'];

  function detectDelimiter(text) {
    var firstLine = (text.match(/^[^\r\n]*/) || [''])[0];
    var best = ',';
    var bestCount = 0;
    for (var d = 0; d < DELIMITERS.length; d++) {
      var delim = DELIMITERS[d];
      var count = 0;
      var inQuotes = false;
      for (var i = 0; i < firstLine.length; i++) {
        var ch = firstLine[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === delim && !inQuotes) count++;
      }
      if (count > bestCount) {
        best = delim;
        bestCount = count;
      }
    }
    return best;
  }

  // Returns { rows: string[][], delimiter }
  function parse(text, opts) {
    opts = opts || {};
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM
    var delimiter = opts.delimiter || detectDelimiter(text);
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;

    while (i < text.length) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          field += ch;
          i++;
        }
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        if (ch === '\r' && text[i + 1] === '\n') i++;
        i++;
      } else {
        field += ch;
        i++;
      }
    }
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    // drop trailing blank lines
    while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
      rows.pop();
    }
    return { rows: rows, delimiter: delimiter };
  }

  function serializeField(value, delimiter) {
    var s = value == null ? '' : String(value);
    if (s.indexOf('"') !== -1 || s.indexOf(delimiter) !== -1 || /[\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function serialize(rows, opts) {
    opts = opts || {};
    var delimiter = opts.delimiter || ',';
    var out = [];
    for (var r = 0; r < rows.length; r++) {
      var cells = [];
      for (var c = 0; c < rows[r].length; c++) {
        cells.push(serializeField(rows[r][c], delimiter));
      }
      out.push(cells.join(delimiter));
    }
    return out.join('\n');
  }

  // Ensure unique, non-empty header names: '' -> column_N, dupes -> name_2, name_3...
  function normalizeHeaders(headerRow) {
    var seen = {};
    var headers = [];
    for (var i = 0; i < headerRow.length; i++) {
      var name = String(headerRow[i]).trim() || 'column_' + (i + 1);
      if (seen[name]) {
        seen[name]++;
        name = name + '_' + seen[name];
      }
      seen[name] = seen[name] || 1;
      headers.push(name);
    }
    return headers;
  }

  // CSV text -> array of objects (headers: true) or array of arrays (headers: false)
  function csvToJson(text, opts) {
    opts = opts || {};
    var useHeaders = opts.headers !== false;
    var parsed = parse(text, opts);
    var rows = parsed.rows;
    if (!rows.length) return [];
    if (!useHeaders) return rows;

    var headers = normalizeHeaders(rows[0]);
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        obj[headers[c]] = rows[r][c] !== undefined ? rows[r][c] : '';
      }
      out.push(obj);
    }
    return out;
  }

  function cellValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  // JSON value (array of objects, array of arrays, or single object) -> CSV text
  function jsonToCsv(data, opts) {
    opts = opts || {};
    if (typeof data === 'string') data = JSON.parse(data);
    if (data === null || data === undefined) throw new Error('JSON is empty');
    if (!Array.isArray(data)) data = [data];
    if (!data.length) return '';

    var rows = [];
    if (Array.isArray(data[0])) {
      for (var r = 0; r < data.length; r++) {
        rows.push(data[r].map(cellValue));
      }
    } else {
      // union of keys across all objects, preserving first-seen order
      var headers = [];
      var seen = {};
      for (var i = 0; i < data.length; i++) {
        var item = data[i];
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
          throw new Error('Expected an array of objects (row ' + (i + 1) + ' is not an object)');
        }
        for (var key in item) {
          if (Object.prototype.hasOwnProperty.call(item, key) && !seen[key]) {
            seen[key] = true;
            headers.push(key);
          }
        }
      }
      rows.push(headers);
      for (var j = 0; j < data.length; j++) {
        var row = [];
        for (var h = 0; h < headers.length; h++) {
          row.push(cellValue(data[j][headers[h]]));
        }
        rows.push(row);
      }
    }
    return serialize(rows, opts);
  }

  // Remove duplicate rows. Returns { csv, total, removed, delimiter }
  function dedupeCsv(text, opts) {
    opts = opts || {};
    var hasHeader = opts.hasHeader !== false;
    var ignoreCase = !!opts.ignoreCase;
    var trimCells = !!opts.trimCells;
    var parsed = parse(text, opts);
    var rows = parsed.rows;
    var out = [];
    var seen = {};
    var removed = 0;
    var start = 0;

    if (hasHeader && rows.length) {
      out.push(rows[0]);
      start = 1;
    }
    for (var r = start; r < rows.length; r++) {
      var keyCells = rows[r];
      if (trimCells) keyCells = keyCells.map(function (c) { return c.trim(); });
      var key = JSON.stringify(ignoreCase ? keyCells.map(function (c) { return c.toLowerCase(); }) : keyCells);
      if (seen[key]) {
        removed++;
      } else {
        seen[key] = true;
        out.push(trimCells ? keyCells : rows[r]);
      }
    }
    return {
      csv: serialize(out, { delimiter: parsed.delimiter }),
      total: rows.length - start,
      removed: removed,
      delimiter: parsed.delimiter
    };
  }

  var TidyCSV = {
    detectDelimiter: detectDelimiter,
    parse: parse,
    serialize: serialize,
    csvToJson: csvToJson,
    jsonToCsv: jsonToCsv,
    dedupeCsv: dedupeCsv
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TidyCSV;
  } else {
    global.TidyCSV = TidyCSV;
  }
})(typeof window !== 'undefined' ? window : this);
