// Unit tests for the TidyCSV core engine. Run: node tests/csv.test.js
'use strict';

const assert = require('assert');
const T = require('../src/csv.js');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error('FAIL: ' + name);
    console.error('  ' + err.message);
    process.exitCode = 1;
  }
}

// --- parse ---

test('parses simple rows', () => {
  assert.deepStrictEqual(T.parse('a,b\n1,2').rows, [['a', 'b'], ['1', '2']]);
});

test('handles CRLF line endings', () => {
  assert.deepStrictEqual(T.parse('a,b\r\n1,2\r\n').rows, [['a', 'b'], ['1', '2']]);
});

test('strips UTF-8 BOM', () => {
  assert.deepStrictEqual(T.parse('﻿a,b\n1,2').rows, [['a', 'b'], ['1', '2']]);
});

test('quoted field with embedded comma', () => {
  assert.deepStrictEqual(T.parse('name,note\n"Smith, Jo",hi').rows, [['name', 'note'], ['Smith, Jo', 'hi']]);
});

test('escaped quotes inside quoted field', () => {
  assert.deepStrictEqual(T.parse('a\n"say ""hi"""').rows, [['a'], ['say "hi"']]);
});

test('newline inside quoted field', () => {
  assert.deepStrictEqual(T.parse('a,b\n"line1\nline2",x').rows, [['a', 'b'], ['line1\nline2', 'x']]);
});

test('empty fields preserved', () => {
  assert.deepStrictEqual(T.parse('a,,c\n,,').rows, [['a', '', 'c'], ['', '', '']]);
});

test('trailing blank lines dropped', () => {
  assert.deepStrictEqual(T.parse('a,b\n1,2\n\n\n').rows, [['a', 'b'], ['1', '2']]);
});

// --- delimiter detection ---

test('detects semicolon delimiter', () => {
  assert.strictEqual(T.parse('a;b;c\n1;2;3').delimiter, ';');
});

test('detects tab delimiter', () => {
  assert.strictEqual(T.parse('a\tb\n1\t2').delimiter, '\t');
});

test('detects pipe delimiter', () => {
  assert.strictEqual(T.parse('a|b|c\n1|2|3').delimiter, '|');
});

test('delimiter inside quotes does not confuse detection', () => {
  assert.strictEqual(T.parse('"a;x",b,c\n1,2,3').delimiter, ',');
});

test('explicit delimiter overrides detection', () => {
  assert.deepStrictEqual(T.parse('a;b', { delimiter: ',' }).rows, [['a;b']]);
});

// --- serialize ---

test('round-trips values needing quotes', () => {
  const rows = [['a,b', 'say "hi"', 'line1\nline2', 'plain']];
  assert.deepStrictEqual(T.parse(T.serialize(rows)).rows, rows);
});

test('serializes with custom delimiter', () => {
  assert.strictEqual(T.serialize([['a', 'b']], { delimiter: ';' }), 'a;b');
});

// --- csvToJson ---

test('csvToJson with headers', () => {
  assert.deepStrictEqual(T.csvToJson('name,age\nAda,36'), [{ name: 'Ada', age: '36' }]);
});

test('csvToJson without headers returns arrays', () => {
  assert.deepStrictEqual(T.csvToJson('1,2\n3,4', { headers: false }), [['1', '2'], ['3', '4']]);
});

test('csvToJson fills missing trailing cells with empty string', () => {
  assert.deepStrictEqual(T.csvToJson('a,b\n1'), [{ a: '1', b: '' }]);
});

test('csvToJson deduplicates repeated headers', () => {
  assert.deepStrictEqual(T.csvToJson('id,id\n1,2'), [{ id: '1', id_2: '2' }]);
});

test('csvToJson names blank headers column_N', () => {
  assert.deepStrictEqual(T.csvToJson('a,,c\n1,2,3'), [{ a: '1', column_2: '2', c: '3' }]);
});

test('csvToJson on empty input returns empty array', () => {
  assert.deepStrictEqual(T.csvToJson(''), []);
});

// --- jsonToCsv ---

test('jsonToCsv from array of objects', () => {
  assert.strictEqual(T.jsonToCsv([{ a: '1', b: '2' }]), 'a,b\n1,2');
});

test('jsonToCsv unions keys across objects preserving order', () => {
  assert.strictEqual(T.jsonToCsv([{ a: 1 }, { b: 2 }]), 'a,b\n1,\n,2');
});

test('jsonToCsv from array of arrays (no header row invented)', () => {
  assert.strictEqual(T.jsonToCsv([[1, 2], [3, 4]]), '1,2\n3,4');
});

test('jsonToCsv accepts a JSON string', () => {
  assert.strictEqual(T.jsonToCsv('[{"x":"y"}]'), 'x\ny');
});

test('jsonToCsv wraps a single object', () => {
  assert.strictEqual(T.jsonToCsv({ a: '1' }), 'a\n1');
});

test('jsonToCsv stringifies nested values', () => {
  assert.strictEqual(T.jsonToCsv([{ a: { b: 1 } }]), 'a\n"{""b"":1}"');
});

test('jsonToCsv quotes fields containing commas', () => {
  assert.strictEqual(T.jsonToCsv([{ a: 'x,y' }]), 'a\n"x,y"');
});

test('jsonToCsv rejects non-object rows', () => {
  assert.throws(() => T.jsonToCsv([1, 2]), /array of objects/);
});

// --- dedupeCsv ---

test('dedupe removes exact duplicate rows, keeps header', () => {
  const r = T.dedupeCsv('a,b\n1,2\n1,2\n3,4');
  assert.strictEqual(r.csv, 'a,b\n1,2\n3,4');
  assert.strictEqual(r.removed, 1);
  assert.strictEqual(r.total, 3);
});

test('dedupe without header treats first row as data', () => {
  const r = T.dedupeCsv('1,2\n1,2', { hasHeader: false });
  assert.strictEqual(r.csv, '1,2');
  assert.strictEqual(r.removed, 1);
});

test('dedupe ignoreCase collapses case variants', () => {
  const r = T.dedupeCsv('a\nFoo\nfoo', { ignoreCase: true });
  assert.strictEqual(r.csv, 'a\nFoo');
  assert.strictEqual(r.removed, 1);
});

test('dedupe trimCells collapses whitespace variants', () => {
  const r = T.dedupeCsv('a,b\n1 ,2\n1,2', { trimCells: true });
  assert.strictEqual(r.csv, 'a,b\n1,2');
  assert.strictEqual(r.removed, 1);
});

test('dedupe preserves detected delimiter in output', () => {
  const r = T.dedupeCsv('a;b\n1;2\n1;2');
  assert.strictEqual(r.csv, 'a;b\n1;2');
});

test('dedupe does not treat similar rows as duplicates', () => {
  const r = T.dedupeCsv('a,b\n1,23\n12,3');
  assert.strictEqual(r.removed, 0);
});

console.log(passed + ' tests passed' + (process.exitCode ? ' (with failures)' : ''));
