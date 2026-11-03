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

// Test 6: Report 2 (12wk v 12wk) Gain & Loss Classification, Account Status & Specific Stores
it('Report 2 has exact 198 G and 206 L accounts, 14 New, 18 Churned, and 372 Retained with exact store joins', () => {
  const gCount = r2.clients.filter(c => c.gl === 'G').length;
  const lCount = r2.clients.filter(c => c.gl === 'L').length;
  assert.strictEqual(gCount, 198, `G count must be 198, got ${gCount}`);
  assert.strictEqual(lCount, 206, `L count must be 206, got ${lCount}`);

  const newCount = r2.clients.filter(c => c.accountStatus === 'NEW').length;
  const churnCount = r2.clients.filter(c => c.accountStatus === 'CHURNED').length;
  const retainCount = r2.clients.filter(c => c.accountStatus === 'RETAINED').length;
  assert.strictEqual(newCount, 14, `NEW account status count must be 14, got ${newCount}`);
  assert.strictEqual(churnCount, 18, `CHURNED account status count must be 18, got ${churnCount}`);
  assert.strictEqual(retainCount, 372, `RETAINED account status count must be 372, got ${retainCount}`);

  // Also check Report 1 counts: 222 G, 190 L, 13 NEW, 12 CHURNED, 387 RETAINED
  const r1GCount = r1.compareClients.filter(c => c.gl === 'G').length;
  const r1LCount = r1.compareClients.filter(c => c.gl === 'L').length;
  const r1NewCount = r1.compareClients.filter(c => c.accountStatus === 'NEW').length;
  const r1ChurnCount = r1.compareClients.filter(c => c.accountStatus === 'CHURNED').length;
  const r1RetainCount = r1.compareClients.filter(c => c.accountStatus === 'RETAINED').length;
  assert.strictEqual(r1GCount, 222, `Report 1 G count must be 222, got ${r1GCount}`);
  assert.strictEqual(r1LCount, 190, `Report 1 L count must be 190, got ${r1LCount}`);
  assert.strictEqual(r1NewCount, 13, `Report 1 NEW account status count must be 13, got ${r1NewCount}`);
  assert.strictEqual(r1ChurnCount, 12, `Report 1 CHURNED account status count must be 12, got ${r1ChurnCount}`);
  assert.strictEqual(r1RetainCount, 387, `Report 1 RETAINED account status count must be 387, got ${r1RetainCount}`);

  // Hashtag Fremont: active in both periods, revDiff is negative -> RETAINED, gl === 'L'
  const hFremont = r2.clients.find(c => c.client === '[HTG] Hashtag Fremont - 1WT');
  assert(hFremont, '[HTG] Hashtag Fremont - 1WT exists');
  assert.strictEqual(hFremont.tp1Orders, 2, 'Hashtag Fremont TP1 orders === 2');
  assert.strictEqual(hFremont.tp1Ordered, 692.94, 'Hashtag Fremont TP1 rev === 692.94');
  assert.strictEqual(hFremont.tp2Orders, 1, 'Hashtag Fremont TP2 orders === 1');
  assert.strictEqual(hFremont.tp2Ordered, 220.20, 'Hashtag Fremont TP2 rev === 220.20');
  assert.strictEqual(hFremont.orderDiff, -1, 'Hashtag Fremont orderDiff === -1');
  assert.strictEqual(hFremont.revDiff, -472.74, 'Hashtag Fremont revDiff === -472.74');
  assert.strictEqual(hFremont.unitDiff, -193, 'Hashtag Fremont unitDiff === -193');
  assert.strictEqual(hFremont.gl, 'L', 'Hashtag Fremont revDiff < 0, gl must be L');
  assert.strictEqual(hFremont.accountStatus, 'RETAINED', 'Hashtag Fremont accountStatus must be RETAINED');

  // Hashtag Everett: Lost in TP2 -> CHURNED, gl === 'L'
  const hEverett = r2.clients.find(c => c.client === '[HTG] Hashtag Everett - 1WT');
  assert(hEverett, '[HTG] Hashtag Everett - 1WT exists');
  assert.strictEqual(hEverett.tp1Orders, 1, 'Hashtag Everett TP1 orders === 1');
  assert.strictEqual(hEverett.tp1Ordered, 490.62, 'Hashtag Everett TP1 rev === 490.62');
  assert.strictEqual(hEverett.tp2Orders, 0, 'Hashtag Everett TP2 orders === 0');
  assert.strictEqual(hEverett.gl, 'L', 'Hashtag Everett gl must be L');
  assert.strictEqual(hEverett.accountStatus, 'CHURNED', 'Hashtag Everett accountStatus must be CHURNED');

  // Cloud 9 Cheney: Gained in TP2 -> NEW, gl === 'G'
  const c9Cheney = r2.clients.find(c => c.client === '[C9] Cloud 9 - Cheney - VMI - 1WT');
  assert(c9Cheney, '[C9] Cloud 9 - Cheney - VMI - 1WT exists');
  assert.strictEqual(c9Cheney.tp1Orders, 0, 'Cloud 9 Cheney TP1 orders === 0');
  assert.strictEqual(c9Cheney.tp2Orders, 2, 'Cloud 9 Cheney TP2 orders === 2');
  assert.strictEqual(c9Cheney.tp2Ordered, 1467.00, 'Cloud 9 Cheney TP2 rev === 1467.00');
  assert.strictEqual(c9Cheney.gl, 'G', 'Cloud 9 Cheney gl must be G');
  assert.strictEqual(c9Cheney.accountStatus, 'NEW', 'Cloud 9 Cheney accountStatus must be NEW');
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

// Test 10: QA Item 1 - Report 2 Preroll Rep & Period Data Math Validation
it('Report 2 has exact salesReps (11), tp1Clients (390), tp2Clients (386) balancing to penny', () => {
  assert(Array.isArray(r2.salesReps), 'r2.salesReps is an array');
  assert.strictEqual(r2.salesReps.length, 11, `r2.salesReps has 11 entries, got ${r2.salesReps.length}`);

  assert(Array.isArray(r2.tp1Clients), 'r2.tp1Clients is an array');
  assert.strictEqual(r2.tp1Clients.length, 390, `r2.tp1Clients has 390 entries, got ${r2.tp1Clients.length}`);

  assert(Array.isArray(r2.tp2Clients), 'r2.tp2Clients is an array');
  assert.strictEqual(r2.tp2Clients.length, 386, `r2.tp2Clients has 386 entries, got ${r2.tp2Clients.length}`);

  // Sum of tp1Clients matches tp1Total
  const sumTp1Ord = r2.tp1Clients.reduce((acc, c) => acc + c.orders, 0);
  const sumTp1Rev = r2.tp1Clients.reduce((acc, c) => acc + c.ordered, 0);
  const sumTp1Unt = r2.tp1Clients.reduce((acc, c) => acc + c.units, 0);
  assert.strictEqual(sumTp1Ord, r2.tp1Total.orders, 'TP1 clients sum orders === r2.tp1Total.orders');
  assert(Math.abs(sumTp1Rev - r2.tp1Total.ordered) < 0.05, 'TP1 clients sum rev === r2.tp1Total.ordered');
  assert.strictEqual(sumTp1Unt, r2.tp1Total.units, 'TP1 clients sum units === r2.tp1Total.units');

  // Sum of tp2Clients matches tp2Total
  const sumTp2Ord = r2.tp2Clients.reduce((acc, c) => acc + c.orders, 0);
  const sumTp2Rev = r2.tp2Clients.reduce((acc, c) => acc + c.ordered, 0);
  const sumTp2Unt = r2.tp2Clients.reduce((acc, c) => acc + c.units, 0);
  assert.strictEqual(sumTp2Ord, r2.tp2Total.orders, 'TP2 clients sum orders === r2.tp2Total.orders');
  assert(Math.abs(sumTp2Rev - r2.tp2Total.ordered) < 0.05, 'TP2 clients sum rev === r2.tp2Total.ordered');
  assert.strictEqual(sumTp2Unt, r2.tp2Total.units, 'TP2 clients sum units === r2.tp2Total.units');

  // Sum of salesReps matches totals
  const repTp1Rev = r2.salesReps.reduce((acc, r) => acc + r.tp1Ordered, 0);
  const repTp2Rev = r2.salesReps.reduce((acc, r) => acc + r.tp2Ordered, 0);
  assert(Math.abs(repTp1Rev - r2.tp1Total.ordered) < 0.05, `Rep sum TP1 rev ${repTp1Rev} matches total ${r2.tp1Total.ordered}`);
  assert(Math.abs(repTp2Rev - r2.tp2Total.ordered) < 0.05, `Rep sum TP2 rev ${repTp2Rev} matches total ${r2.tp2Total.ordered}`);
});

// Test 11: QA Items 2 & 3 - Executive UI Schema Parity, G/L Selector Bar & Sortable Columns
it('UI Schema Parity: G/L selector bar, 5 KPI cards, Rep Comparison chart, Top Gainers/Decliners chart, Sales Reps performance table, and Period tabs exist on both pages', () => {
  const cssPath = path.join(rootDir, 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert(css.includes('max-width: 1600px'), 'styles.css has max-width: 1600px for executive widescreen layout');
  assert(css.includes('.gl-selector-card'), 'styles.css defines .gl-selector-card');
  assert(css.includes('.gl-card'), 'styles.css defines .gl-card');
  assert(css.includes('.tag-gl-gain'), 'styles.css defines .tag-gl-gain');
  assert(css.includes('.tag-gl-loss'), 'styles.css defines .tag-gl-loss');

  const idx = fs.readFileSync(indexHtmlPath, 'utf8');
  const pr = fs.readFileSync(prerollHtmlPath, 'utf8');

  // Report 1 checks
  assert(idx.includes('id="rep1GlSelectorCard"'), 'Report 1 has #rep1GlSelectorCard');
  assert(idx.includes('id="kpiCardGl"'), 'Report 1 has 5th KPI card #kpiCardGl');
  assert(idx.includes('id="repChartContainer"'), 'Report 1 has repChartContainer');
  assert(idx.includes('id="gainersDeclinersChartContainer"'), 'Report 1 has gainersDeclinersChartContainer');
  assert(idx.includes('id="btnGainersToggle"'), 'Report 1 has Top Gainers toggle button');
  assert(idx.includes('id="btnDeclinersToggle"'), 'Report 1 has Top Decliners toggle button');
  assert(idx.includes('id="btnNewToggle"'), 'Report 1 has New Accounts toggle button');
  assert(idx.includes('id="btnLostToggle"'), 'Report 1 has Lost Accounts toggle button');
  assert(idx.includes('id="repsTable"'), 'Report 1 has Sales Reps Table');
  assert(idx.includes('id="chkConsolidateReps"'), 'Report 1 has chkConsolidateReps toggle');
  assert(idx.includes('data-tab="compare"'), 'Report 1 has Compare tab');
  assert(idx.includes('data-tab="tp1"'), 'Report 1 has TP1 tab');
  assert(idx.includes('data-tab="tp2"'), 'Report 1 has TP2 tab');

  // Report 2 checks
  assert(pr.includes('id="prerollGlSelectorCard"'), 'Report 2 has #prerollGlSelectorCard');
  assert(pr.includes('id="kpiCardPrerollGl"'), 'Report 2 has 5th KPI card #kpiCardPrerollGl');
  assert(pr.includes('id="prerollRepChartContainer"'), 'Report 2 has prerollRepChartContainer');
  assert(pr.includes('id="prerollGainersDeclinersChartContainer"'), 'Report 2 has prerollGainersDeclinersChartContainer');
  assert(pr.includes('id="btnGainersToggle"'), 'Report 2 has Top Gainers toggle button');
  assert(pr.includes('id="btnDeclinersToggle"'), 'Report 2 has Top Decliners toggle button');
  assert(pr.includes('id="btnNewToggle"'), 'Report 2 has New Accounts toggle button');
  assert(pr.includes('id="btnLostToggle"'), 'Report 2 has Lost Accounts toggle button');
  assert(pr.includes('id="prerollRepsTable"'), 'Report 2 has Preroll Sales Reps Table');
  assert(pr.includes('id="chkPrerollConsolidateReps"'), 'Report 2 has chkPrerollConsolidateReps toggle');
  assert(pr.includes('data-tab="compare"'), 'Report 2 has Compare tab');
  assert(pr.includes('data-tab="tp1"'), 'Report 2 has TP1 tab');
  assert(pr.includes('data-tab="tp2"'), 'Report 2 has TP2 tab');
  assert(pr.includes('data-tab="voids"'), 'Report 2 has Voids tab');
});

// Test 12: Sales Rep Initials, Streamlined Joint Revenue Comparison Tables & Zero Horizontal Cutoff
it('Sales Rep initials, streamlined 7/8-column comparison tables without Orders/AOV, and cache busting are configured', () => {
  // Load app-common.js in simulated window
  const appCommonPath = path.join(rootDir, 'app-common.js');
  const appCommonContent = fs.readFileSync(appCommonPath, 'utf8');
  const windowObj = {};
  const vm = require('vm');
  vm.runInNewContext(appCommonContent, { window: windowObj, console });

  assert(typeof windowObj.VMI.fmtRepInitials === 'function', 'window.VMI.fmtRepInitials is defined');
  assert(typeof windowObj.VMI.renderRepBadge === 'function', 'window.VMI.renderRepBadge is defined');

  const repTests = [
    { input: 'Scotland Schieber', expected: 'SS' },
    { input: 'Scotland Schieber - House', expected: 'SS-H' },
    { input: 'Jeremy Schmidt', expected: 'JS' },
    { input: 'Jeremy Schmidt - House', expected: 'JS-H' },
    { input: 'Ashlea Underwood', expected: 'AU' },
    { input: 'Ashlea Underwood - House', expected: 'AU-H' },
    { input: 'Danny Thoren', expected: 'DT' },
    { input: 'Danny Thoren - House', expected: 'DT-H' },
    { input: 'Caitlin Stoner', expected: 'CS' },
    { input: 'Nancy Drinkard WA', expected: 'ND' },
    { input: 'Johnny Wilson', expected: 'JW' },
    { input: 'Unassigned', expected: '—' },
    { input: '', expected: '—' },
    { input: null, expected: '—' },
    { input: '-', expected: '—' }
  ];

  repTests.forEach(({ input, expected }) => {
    const res = windowObj.VMI.fmtRepInitials(input);
    assert.strictEqual(res, expected, `fmtRepInitials('${input}') must be '${expected}', got '${res}'`);
  });

  const badgeHtml = windowObj.VMI.renderRepBadge('Scotland Schieber');
  assert(badgeHtml.includes('tag-badge tag-rep'), 'renderRepBadge returns tag-badge tag-rep span');
  assert(badgeHtml.includes('SS'), 'renderRepBadge displays rep initials');
  assert(badgeHtml.includes('title="Scotland Schieber"'), 'renderRepBadge has full name tooltip');

  // Verify report1.js joint comparison headers do NOT contain TP1 Orders or Ave Rev Diff
  const r1JsPath = path.join(rootDir, 'report1.js');
  const r1Js = fs.readFileSync(r1JsPath, 'utf8');
  const r1CompareHeadMatch = r1Js.match(/activeTab === 'compare'\) \{[\s\S]*?thead\.innerHTML = `([\s\S]*?)`;/);
  assert(r1CompareHeadMatch, 'Found activeTab === compare head template in report1.js');
  const r1Head = r1CompareHeadMatch[1];
  assert(!r1Head.includes('TP1 Orders'), 'report1.js compare head must NOT include TP1 Orders');
  assert(!r1Head.includes('TP2 Orders'), 'report1.js compare head must NOT include TP2 Orders');
  assert(!r1Head.includes('Order Diff'), 'report1.js compare head must NOT include Order Diff');
  assert(!r1Head.includes('Ave Rev Diff'), 'report1.js compare head must NOT include Ave Rev Diff');
  assert(r1Head.includes('Rev Diff ($)'), 'report1.js compare head must include Rev Diff ($)');
  assert(r1Head.includes('Unit Diff'), 'report1.js compare head must include Unit Diff');

  // Verify report2.js joint comparison headers do NOT contain TP1 Orders or Ave Rev Diff
  const r2JsPath = path.join(rootDir, 'report2.js');
  const r2Js = fs.readFileSync(r2JsPath, 'utf8');
  const r2CompareHeadMatch = r2Js.match(/activeTab === 'compare'\) \{[\s\S]*?thead\.innerHTML = `([\s\S]*?)`;/);
  assert(r2CompareHeadMatch, 'Found activeTab === compare head template in report2.js');
  const r2Head = r2CompareHeadMatch[1];
  assert(!r2Head.includes('TP1 Orders'), 'report2.js compare head must NOT include TP1 Orders');
  assert(!r2Head.includes('TP2 Orders'), 'report2.js compare head must NOT include TP2 Orders');
  assert(!r2Head.includes('Order Diff'), 'report2.js compare head must NOT include Order Diff');
  assert(!r2Head.includes('Ave Rev Diff'), 'report2.js compare head must NOT include Ave Rev Diff');
  assert(r2Head.includes('Rev Diff ($)'), 'report2.js compare head must include Rev Diff ($)');
  assert(r2Head.includes('Unit Diff'), 'report2.js compare head must include Unit Diff');
  assert(r2Head.includes('Category Voids'), 'report2.js compare head must include Category Voids');

  // Verify streamlined 8-column reps tables in index.html and preroll-performance.html
  const idx = fs.readFileSync(indexHtmlPath, 'utf8');
  const pr = fs.readFileSync(prerollHtmlPath, 'utf8');

  assert(idx.includes('<table class="data-table" id="repsTable">'), 'index.html has repsTable');
  assert(!idx.includes('<th class="sortable text-right" data-col="tp1Orders">TP1 Orders'), 'index.html repsTable does not have tp1Orders');
  assert(!idx.includes('<th class="sortable text-right" data-col="aovDiff">AOV Diff'), 'index.html repsTable does not have aovDiff');

  assert(pr.includes('<table class="data-table" id="prerollRepsTable">'), 'preroll-performance.html has prerollRepsTable');
  assert(!pr.includes('<th class="sortable text-right" data-col="tp1Orders">TP1 Orders'), 'preroll-performance.html prerollRepsTable does not have tp1Orders');
  assert(!pr.includes('<th class="sortable text-right" data-col="aovDiff">AOV Diff'), 'preroll-performance.html prerollRepsTable does not have aovDiff');

  // Verify cache-busting v=4 query string
  assert(idx.includes('styles.css?v=4'), 'index.html has styles.css?v=4');
  assert(idx.includes('reports-data.js?v=4'), 'index.html has reports-data.js?v=4');
  assert(idx.includes('app-common.js?v=4'), 'index.html has app-common.js?v=4');
  assert(idx.includes('report1.js?v=4'), 'index.html has report1.js?v=4');

  assert(pr.includes('styles.css?v=4'), 'preroll-performance.html has styles.css?v=4');
  assert(pr.includes('reports-data.js?v=4'), 'preroll-performance.html has reports-data.js?v=4');
  assert(pr.includes('app-common.js?v=4'), 'preroll-performance.html has app-common.js?v=4');
  assert(pr.includes('report2.js?v=4'), 'preroll-performance.html has report2.js?v=4');

  // Verify CSS viewport & wrapping rules
  const cssPath = path.join(rootDir, 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert(css.includes('max-width: 100%'), 'styles.css defines max-width: 100% for container');
  assert(css.includes('table.data-table td:first-child'), 'styles.css defines table.data-table td:first-child');
  assert(css.includes('white-space: normal'), 'styles.css allows wrapping for client column');
});

console.log(`\n========================================`);
console.log(`Test Results: ${passCount} passed, ${failCount} failed.`);
console.log(`========================================\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
