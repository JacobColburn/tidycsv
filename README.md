# TidyCSV — local-first CSV tools

Free, single-purpose CSV utilities that run 100% client-side. No accounts, no uploads,
no server: files are processed in the browser with vanilla JS, so they're safe for
customer lists and other sensitive exports.

**Strategy:** this is bet #2 in the tools portfolio (after SlashKeys) — it tests the
Google-search distribution channel. Each tool is its own SEO-targeted page; the pages
share one engine and grow into a cluster over time.

## Tools (v1)

| Page | Target searches |
|---|---|
| `csv-to-json.html` | "csv to json converter", "csv to json no upload" |
| `json-to-csv.html` | "json to csv converter", "json to csv excel" |
| `dedupe-csv.html` | "remove duplicate rows from csv", "dedupe csv online" |

## Architecture

- `src/csv.js` — the engine: RFC 4180 parser (quotes, embedded commas/newlines, BOM,
  CRLF), delimiter auto-detection (`,` `;` tab `|`), serializer, CSV↔JSON, dedupe.
  Zero dependencies; exposes `window.TidyCSV` in the browser and `module.exports` in Node.
- `src/app.js` — shared page wiring (drag-drop, live conversion, copy/download/sample).
  Each page defines `window.TOOL = { run(input, opts), downloadName, sample }`.
- Plain script tags, no ES modules, no build step — pages work from `file://`.

```
node tests/csv.test.js   # engine unit tests
```

## Deploy

Static site — GitHub Pages or Cloudflare Pages, no config needed.

Before going live:
1. Check name/domain availability (tidycsv.com or similar) and update the absolute
   URLs in `sitemap.xml`.
2. Fill in the SlashKeys store link in each page footer.
3. Add analytics (privacy-respecting, e.g. a simple page-view counter) to measure the
   SEO channel — success metric: organic search visits/month.

## Roadmap

- More cluster pages: CSV merge, column picker/reorder, Excel→CSV, CSV→Markdown table
- Batch processing (multiple files) as a Pro feature
- Cross-promo: link from SlashKeys options page
