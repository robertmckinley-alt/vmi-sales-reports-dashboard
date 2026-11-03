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

// Test 2: Report 1 Row counts and Sales-Rep-Only validation
it('Report 1 (13v13) has exact client counts and excludes VMI-only reps', () => {
  assert.strictEqual(r1.tp1Clients.length, 399, 'TP1 clients must equal 399');
  assert.strictEqual(r1.tp2Clients.length, 400, 'TP2 clients must equal 400');
  assert.strictEqual(r1.compareClients.length, 412, 'Compare clients (full union) must equal 412');

  const vmiReps = ['Curtis Green', 'Josh Novak', 'Koen McKinley'];
  const r1Reps = r1.salesReps.map(r => r.rep);
  const r1ExcelReps = r1.excelSalesRepsOnly.map(r => r.rep);
  const r2VoidReps = r2.repsVoidSummary.map(r => r.rep);

  vmiReps.forEach(rep => {
    assert(!r1Reps.includes(rep), `r1.salesReps must NOT include VMI-only rep ${rep}`);
    assert(!r1ExcelReps.includes(rep), `r1.excelSalesRepsOnly must NOT include VMI-only rep ${rep}`);
    assert(!r2VoidReps.includes(rep), `r2.repsVoidSummary must NOT include VMI-only rep ${rep}`);
  });
});

// Test 3: Report 1 Totals & Compare Clients Sum
it('Report 1 (13v13) has exact period totals and deltas matching client sums', () => {
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

  // Verify sum of 412 compareClients
  const sumOrdDiff = r1.compareClients.reduce((acc, c) => acc + c.orderDiff, 0);
  const sumRevDiff = r1.compareClients.reduce((acc, c) => acc + c.revDiff, 0);
  const sumUntDiff = r1.compareClients.reduce((acc, c) => acc + c.unitDiff, 0);

  assert.strictEqual(sumOrdDiff, 214, `Sum of compareClients orderDiff must be 214, got ${sumOrdDiff}`);
  assert(Math.abs(sumRevDiff - 400533.22) < 0.05, `Sum of compareClients revDiff must be 400533.22, got ${sumRevDiff}`);
  assert.strictEqual(sumUntDiff, 40499, `Sum of compareClients unitDiff must be 40499, got ${sumUntDiff}`);
});

// Test 4: Report 1 Verified Per-Row Math Accuracy (Including Mountain High Cannabis & Nimbin Pot Shop)
it('Report 1 (13v13) has zero math discrepancies across every single row', () => {
  r1.compareClients.forEach(c => {
    assert.strictEqual(c.orderDiff, c.tp2Orders - c.tp1Orders, `Row ${c.client} orderDiff mismatch`);
    assert(Math.abs(c.revDiff - (c.tp2Ordered - c.tp1Ordered)) < 0.02, `Row ${c.client} revDiff mismatch: ${c.revDiff} vs ${c.tp2Ordered - c.tp1Ordered}`);
    assert.strictEqual(c.unitDiff, c.tp2Units - c.tp1Units, `Row ${c.client} unitDiff mismatch`);
    assert(Math.abs(c.aveRevDiff - (c.tp2Aov - c.tp1Aov)) < 0.02, `Row ${c.client} aveRevDiff mismatch: ${c.aveRevDiff} vs ${c.tp2Aov - c.tp1Aov}`);
    assert(c.salesRep, `Row ${c.client} must have salesRep assigned`);
  });

  // Verify Mountain High Cannabis
  const mhc = r1.compareClients.find(c => c.client === 'Mountain High Cannabis');
  assert(mhc, 'Mountain High Cannabis exists');
  assert.strictEqual(mhc.tp1Orders, 4, 'Mountain High TP1 orders === 4');
  assert.strictEqual(mhc.tp1Ordered, 9667.79, 'Mountain High TP1 ordered === 9667.79');
  assert.strictEqual(mhc.tp2Orders, 4, 'Mountain High TP2 orders === 4');
  assert.strictEqual(mhc.tp2Ordered, 8189.16, 'Mountain High TP2 ordered === 8189.16');
  assert.strictEqual(mhc.orderDiff, 0, 'Mountain High orderDiff === 0');
  assert.strictEqual(mhc.revDiff, -1478.63, 'Mountain High revDiff === -1478.63');
  assert.strictEqual(mhc.unitDiff, -150, 'Mountain High unitDiff === -150');
  assert.strictEqual(mhc.aveRevDiff, -369.66, 'Mountain High aveRevDiff === -369.66');

  // Verify Nimbin Pot Shop
  const nps = r1.compareClients.find(c => c.client === 'Nimbin Pot Shop');
  assert(nps, 'Nimbin Pot Shop exists');
  assert.strictEqual(nps.tp1Orders, 2, 'Nimbin Pot Shop TP1 orders === 2');
  assert.strictEqual(nps.tp1Ordered, 2599.70, 'Nimbin Pot Shop TP1 ordered === 2599.70');
  assert.strictEqual(nps.tp2Orders, 1, 'Nimbin Pot Shop TP2 orders === 1');
  assert.strictEqual(nps.tp2Ordered, 1999.96, 'Nimbin Pot Shop TP2 ordered === 1999.96');
  assert.strictEqual(nps.orderDiff, -1, 'Nimbin Pot Shop orderDiff === -1');
  assert.strictEqual(nps.revDiff, -599.74, 'Nimbin Pot Shop revDiff === -599.74');
  assert.strictEqual(nps.unitDiff, -92, 'Nimbin Pot Shop unitDiff === -92');
  assert.strictEqual(nps.aveRevDiff, 700.11, 'Nimbin Pot Shop aveRevDiff === 700.11');
});

// Test 5: Report 2 Preroll Totals & Client Sums
it('Report 2 (12wk v 12wk) has exact preroll totals matching client sums', () => {
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

  // Verify client rows sum to exact total row
  const sumTp1Ord = r2.clients.reduce((acc, c) => acc + c.tp1Orders, 0);
  const sumTp1Rev = r2.clients.reduce((acc, c) => acc + c.tp1Ordered, 0);
  const sumTp1Unt = r2.clients.reduce((acc, c) => acc + c.tp1Units, 0);

  const sumTp2Ord = r2.clients.reduce((acc, c) => acc + c.tp2Orders, 0);
  const sumTp2Rev = r2.clients.reduce((acc, c) => acc + c.tp2Ordered, 0);
  const sumTp2Unt = r2.clients.reduce((acc, c) => acc + c.tp2Units, 0);

  const sumOrdDiff = r2.clients.reduce((acc, c) => acc + c.orderDiff, 0);
  const sumRevDiff = r2.clients.reduce((acc, c) => acc + c.revDiff, 0);
  const sumUntDiff = r2.clients.reduce((acc, c) => acc + c.unitDiff, 0);

  assert.strictEqual(sumTp1Ord, 2806, `Sum of preroll TP1 orders must be 2806, got ${sumTp1Ord}`);
  assert(Math.abs(sumTp1Rev - 2323107.17) < 0.05, `Sum of preroll TP1 rev must be 2323107.17, got ${sumTp1Rev}`);
  assert.strictEqual(sumTp1Unt, 1016928, `Sum of preroll TP1 units must be 1016928, got ${sumTp1Unt}`);

  assert.strictEqual(sumTp2Ord, 2974, `Sum of preroll TP2 orders must be 2974, got ${sumTp2Ord}`);
  assert(Math.abs(sumTp2Rev - 2193701.82) < 0.05, `Sum of preroll TP2 rev must be 2193701.82, got ${sumTp2Rev}`);
  assert.strictEqual(sumTp2Unt, 980598, `Sum of preroll TP2 units must be 980598, got ${sumTp2Unt}`);

  assert.strictEqual(sumOrdDiff, 168, `Sum of preroll orderDiff must be 168, got ${sumOrdDiff}`);
  assert(Math.abs(sumRevDiff - (-129405.35)) < 0.05, `Sum of preroll revDiff must be -129405.35, got ${sumRevDiff}`);
  assert.strictEqual(sumUntDiff, -36330, `Sum of preroll unitDiff must be -36330, got ${sumUntDiff}`);
});

// Test 6: Report 2 (12wk v 12wk) Gained (14) and Lost (18) Accounts & Specific Stores
it('Report 2 has exact 14 Gained (G) and 18 Lost (L) accounts with exact store joins', () => {
  const gCount = r2.clients.filter(c => c.gl === 'G').length;
  const lCount = r2.clients.filter(c => c.gl === 'L').length;
  assert.strictEqual(gCount, 14, `G count must be 14, got ${gCount}`);
  assert.strictEqual(lCount, 18, `L count must be 18, got ${lCount}`);

  // Hashtag Fremont: active in both periods
  const hFremont = r2.clients.find(c => c.client === '[HTG] Hashtag Fremont - 1WT');
  assert(hFremont, '[HTG] Hashtag Fremont - 1WT exists');
  assert.strictEqual(hFremont.tp1Orders, 2, 'Hashtag Fremont TP1 orders === 2');
  assert.strictEqual(hFremont.tp1Ordered, 692.94, 'Hashtag Fremont TP1 rev === 692.94');
  assert.strictEqual(hFremont.tp2Orders, 1, 'Hashtag Fremont TP2 orders === 1');
  assert.strictEqual(hFremont.tp2Ordered, 220.20, 'Hashtag Fremont TP2 rev === 220.20');
  assert.strictEqual(hFremont.orderDiff, -1, 'Hashtag Fremont orderDiff === -1');
  assert.strictEqual(hFremont.revDiff, -472.74, 'Hashtag Fremont revDiff === -472.74');
  assert.strictEqual(hFremont.unitDiff, -193, 'Hashtag Fremont unitDiff === -193');
  assert.strictEqual(hFremont.gl, null, 'Hashtag Fremont is active in both, gl must be null');

  // Hashtag Everett: Lost in TP2
  const hEverett = r2.clients.find(c => c.client === '[HTG] Hashtag Everett - 1WT');
  assert(hEverett, '[HTG] Hashtag Everett - 1WT exists');
  assert.strictEqual(hEverett.tp1Orders, 1, 'Hashtag Everett TP1 orders === 1');
  assert.strictEqual(hEverett.tp1Ordered, 490.62, 'Hashtag Everett TP1 rev === 490.62');
  assert.strictEqual(hEverett.tp2Orders, 0, 'Hashtag Everett TP2 orders === 0');
  assert.strictEqual(hEverett.gl, 'L', 'Hashtag Everett gl must be L');

  // Cloud 9 Cheney: Gained in TP2
  const c9Cheney = r2.clients.find(c => c.client === '[C9] Cloud 9 - Cheney - VMI - 1WT');
  assert(c9Cheney, '[C9] Cloud 9 - Cheney - VMI - 1WT exists');
  assert.strictEqual(c9Cheney.tp1Orders, 0, 'Cloud 9 Cheney TP1 orders === 0');
  assert.strictEqual(c9Cheney.tp2Orders, 2, 'Cloud 9 Cheney TP2 orders === 2');
  assert.strictEqual(c9Cheney.tp2Ordered, 1467.00, 'Cloud 9 Cheney TP2 rev === 1467.00');
  assert.strictEqual(c9Cheney.gl, 'G', 'Cloud 9 Cheney gl must be G');
});

// Test 7: Report 2 Voids and Categories
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

// Test 8: HTML, Navigation, and Interactive Sales Rep Selectors
it('index.html and preroll-performance.html feature interactive Sales Rep Selectors without VMI reps', () => {
  assert(fs.existsSync(indexHtmlPath), 'index.html exists');
  assert(fs.existsSync(prerollHtmlPath), 'preroll-performance.html exists');
  
  const idx = fs.readFileSync(indexHtmlPath, 'utf8');
  const pr = fs.readFileSync(prerollHtmlPath, 'utf8');
  
  assert(idx.includes('reports-data.js'), 'index.html loads reports-data.js');
  assert(pr.includes('reports-data.js'), 'preroll-performance.html loads reports-data.js');
  
  assert(idx.includes('preroll-performance'), 'index.html links to preroll-performance');
  assert(pr.includes('index.html') || pr.includes('href="/"'), 'preroll-performance.html links to index.html or root');

  // Verify prominent Sales Rep Selector Card on both pages
  assert(idx.includes('rep-selector-card'), 'index.html contains rep-selector-card');
  assert(pr.includes('rep-selector-card'), 'preroll-performance.html contains rep-selector-card');

  // Verify NO VMI-only reps appear in HTML templates
  const vmiReps = ['Curtis Green', 'Josh Novak', 'Koen McKinley'];
  vmiReps.forEach(rep => {
    assert(!idx.includes(rep), `index.html must not include ${rep}`);
    assert(!pr.includes(rep), `preroll-performance.html must not include ${rep}`);
  });
});

// Test 9: Gitignore and Vercel
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
