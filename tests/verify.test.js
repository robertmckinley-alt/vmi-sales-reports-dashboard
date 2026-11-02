/**
 * tests/verify.test.js
 * Comprehensive automated verification test suite for VMI Sales & Preroll Performance Dashboard.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Starting VMI Sales Reports Dashboard Verification Suite...\n');

let passCount = 0;
let failCount = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

const rootDir = path.resolve(__dirname, '..');
const jsonPath = path.join(rootDir, 'data', 'reports-data.json');
const jsDataPath = path.join(rootDir, 'data', 'reports-data.js');
const indexHtmlPath = path.join(rootDir, 'index.html');
const prerollHtmlPath = path.join(rootDir, 'preroll-performance.html');
const gitignorePath = path.join(rootDir, '.gitignore');
const vercelPath = path.join(rootDir, 'vercel.json');

// Test 1: Data files exist
it('data/reports-data.json and data/reports-data.js exist and are non-empty', () => {
  assert(fs.existsSync(jsonPath), 'reports-data.json exists');
  assert(fs.statSync(jsonPath).size > 10000, 'reports-data.json is non-empty');
  assert(fs.existsSync(jsDataPath), 'reports-data.js exists');
  assert(fs.statSync(jsDataPath).size > 10000, 'reports-data.js is non-empty');
  const jsContent = fs.readFileSync(jsDataPath, 'utf8');
  assert(jsContent.startsWith('window.REPORTS_DATA ='), 'reports-data.js assigns window.REPORTS_DATA');
});

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const r1 = data.report1;
const r2 = data.report2;

// Test 2: Report 1 Row counts
it('Report 1 (13v13) has exact client and rep counts', () => {
  assert.strictEqual(r1.tp1Clients.length, 399, 'TP1 clients must equal 399');
  assert.strictEqual(r1.tp2Clients.length, 400, 'TP2 clients must equal 400');
  assert.strictEqual(r1.compareClients.length, 403, 'Compare clients must equal 403');
  assert.strictEqual(r1.salesReps.length, 13, 'Sales reps must equal 13');
});

// Test 3: Report 1 Totals
it('Report 1 (13v13) has exact period totals and deltas', () => {
  assert.strictEqual(r1.tp1Total.orders, 3428, 'TP1 orders === 3428');
  assert(Math.abs(r1.tp1Total.ordered - 13637917.96) < 0.05, `TP1 ordered === 13637917.96 (got ${r1.tp1Total.ordered})`);
  assert.strictEqual(r1.tp1Total.units, 2706833, 'TP1 units === 2706833');

  assert.strictEqual(r1.tp2Total.orders, 3642, 'TP2 orders === 3642');
  assert(Math.abs(r1.tp2Total.ordered - 14038451.18) < 0.05, `TP2 ordered === 14038451.18 (got ${r1.tp2Total.ordered})`);
  assert.strictEqual(r1.tp2Total.units, 2747332, 'TP2 units === 2747332');

  assert.strictEqual(r1.compareTotal.orderDiff, 214, 'Compare orderDiff === 214');
  assert(Math.abs(r1.compareTotal.revDiff - 400533.22) < 0.05, `Compare revDiff === 400533.22 (got ${r1.compareTotal.revDiff})`);
  assert.strictEqual(r1.compareTotal.unitDiff, 40499, 'Compare unitDiff === 40499');
  assert(Math.abs(r1.compareTotal.aveRevDiff - (-123.79)) < 0.05, `Compare aveRevDiff === -123.79 (got ${r1.compareTotal.aveRevDiff})`);
});

// Test 4: Report 2 Preroll Totals
it('Report 2 (12wk v 12wk) has exact preroll totals and deltas', () => {
  assert.strictEqual(r2.clients.length, 404, 'Report 2 clients must equal 404');
  assert.strictEqual(r2.tp1Total.orders, 2806, 'TP1 orders === 2806');
  assert(Math.abs(r2.tp1Total.ordered - 2323107.17) < 0.05, `TP1 ordered === 2323107.17 (got ${r2.tp1Total.ordered})`);
  assert.strictEqual(r2.tp1Total.units, 1016928, 'TP1 units === 1016928');

  assert.strictEqual(r2.tp2Total.orders, 2974, 'TP2 orders === 2974');
  assert(Math.abs(r2.tp2Total.ordered - 2193701.82) < 0.05, `TP2 ordered === 2193701.82 (got ${r2.tp2Total.ordered})`);
  assert.strictEqual(r2.tp2Total.units, 980598, 'TP2 units === 980598');

  assert.strictEqual(r2.compareTotal.orderDiff, 168, 'Compare orderDiff === 168');
  assert(Math.abs(r2.compareTotal.revDiff - (-129405.35)) < 0.05, `Compare revDiff === -129405.35 (got ${r2.compareTotal.revDiff})`);
  assert.strictEqual(r2.compareTotal.unitDiff, -36330, 'Compare unitDiff === -36330');
  assert(Math.abs(r2.compareTotal.aveDiff - (-90.28)) < 0.05, `Compare aveDiff === -90.28 (got ${r2.compareTotal.aveDiff})`);
});

// Test 5: Report 2 Gained and Lost Accounts
it('Report 2 (12wk v 12wk) has exact 13 Gained (G) and 18 Lost (L) accounts', () => {
  const gCount = r2.clients.filter(c => c.gl === 'G').length;
  const lCount = r2.clients.filter(c => c.gl === 'L').length;
  assert.strictEqual(gCount, 13, `G count must be 13, got ${gCount}`);
  assert.strictEqual(lCount, 18, `L count must be 18, got ${lCount}`);

  // Check resolved names for the Clutch Cannabis quirk
  const gainedWithMismatch = r2.clients.filter(c => c.gl === 'G' && c.clientMismatch);
  assert.strictEqual(gainedWithMismatch.length, 11, `Expected 11 resolved mismatch rows for G, got ${gainedWithMismatch.length}`);
  const hasWesternBud = gainedWithMismatch.some(c => c.client.includes('Western Bud Anacortes'));
  assert(hasWesternBud, 'Western Bud Anacortes was properly resolved from tp2Client');
});

// Test 6: Report 2 Voids and Categories
it('Report 2 has exact 2,287 void entries across 10 categories', () => {
  assert.strictEqual(r2.voids.length, 2287, `Expected 2287 voids, got ${r2.voids.length}`);
  assert.strictEqual(r2.categoriesSummary.length, 10, `Expected 10 categories, got ${r2.categoriesSummary.length}`);
  
  const expectedCats = [
    'Banger Prerolls (10pk)',
    'Banger Prerolls (2pk)',
    'Banger Prerolls (5pk)',
    'Bubble Hash Bangers',
    'Dabstract Infused Prerolls',
    'Firecrackers',
    'Mega Rolls',
    'Prerolls (Single Unit)',
    'Prerolls 28pk',
    'Prerolls Huxton'
  ];
  for (const cat of expectedCats) {
    const found = r2.categoriesSummary.find(c => c.category === cat);
    assert(found, `Category ${cat} must exist in categoriesSummary`);
    assert(found.storeCount > 0, `Category ${cat} must have positive storeCount`);
  }
});

// Test 7: HTML and Navigation
it('index.html and preroll-performance.html exist and link to each other', () => {
  assert(fs.existsSync(indexHtmlPath), 'index.html exists');
  assert(fs.existsSync(prerollHtmlPath), 'preroll-performance.html exists');
  
  const idx = fs.readFileSync(indexHtmlPath, 'utf8');
  const pr = fs.readFileSync(prerollHtmlPath, 'utf8');
  
  assert(idx.includes('reports-data.js'), 'index.html loads reports-data.js');
  assert(pr.includes('reports-data.js'), 'preroll-performance.html loads reports-data.js');
  
  assert(idx.includes('preroll-performance'), 'index.html links to preroll-performance');
  assert(pr.includes('index.html') || pr.includes('href="/"'), 'preroll-performance.html links to index.html or root');
});

// Test 8: Gitignore and Vercel
it('.gitignore and vercel.json are configured correctly', () => {
  assert(fs.existsSync(gitignorePath), '.gitignore exists');
  const gi = fs.readFileSync(gitignorePath, 'utf8');
  assert(gi.includes('node_modules'), '.gitignore ignores node_modules');
  assert(gi.includes('.vercel'), '.gitignore ignores .vercel');
  assert(gi.includes('.env*'), '.gitignore ignores .env*');
  assert(gi.includes('data/raw_user_input.txt'), '.gitignore ignores raw_user_input.txt');

  assert(fs.existsSync(vercelPath), 'vercel.json exists');
  const vj = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  assert(vj.cleanUrls === true, 'vercel.json has cleanUrls === true');
});

console.log(`\n========================================`);
console.log(`Test Results: ${passCount} passed, ${failCount} failed.`);
console.log(`========================================\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
