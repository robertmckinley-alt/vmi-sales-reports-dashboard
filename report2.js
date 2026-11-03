/**
 * report2.js
 * Logic for Page 2: 12-Week vs. 12-Week Preroll Performance & Latest 12wk Voids.
 * Supports prominent Sales-Rep-only selector, dynamic sticky tfoot totals, and client mismatch badging.
 */

(function () {
  let reportData = null;
  let activeMainView = 'clients'; // 'clients' | 'voids'

  // Sales Rep filtering state (Sales Reps Only - NO VMI-only reps)
  let selectedRep = '';
  let includeHouse = true;

  // Clients view state
  let clientFilter = 'all'; // 'all' | 'gained' | 'lost' | 'vmi' | '1wt' | 'gainers' | 'decliners'
  let clientSearchQuery = '';
  let clientSortCol = 'revDiff';
  let clientSortAsc = true;
  let clientPage = 1;
  let clientPageSize = 50;

  // Preroll Gainers/Decliners toggle
  let prerollGainersMode = 'gainers'; // 'gainers' | 'decliners'
  let glSpotlightMode = 'gained';     // 'gained' | 'lost'

  // Voids view state
  let voidMode = 'roster'; // 'roster' | 'matrix'
  let voidSearchQuery = '';
  let voidCategoryFilter = '';
  let voidRosterSortCol = 'salesRep';
  let voidRosterSortAsc = true;
  let voidMatrixSortCol = 'voidCount';
  let voidMatrixSortAsc = false;
  let voidPage = 1;
  let voidPageSize = 50;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      const data = await window.VMI.loadData();
      reportData = data.report2;
      populateRepSelector();
      populateCategoryDropdown();
      renderKpis();
      renderPrerollGainersChart();
      renderGlSpotlightChart();
      renderCategoryVoidsChart();
      renderRepsVoidsChart();
      renderPrerollClientTable();
      renderVoidRosterTable();
      renderVoidMatrixTableHead();
      renderVoidMatrixTable();
      bindEvents();
    } catch (err) {
      console.error('Failed to initialize Report 2:', err);
    }
  }

  // Check if a client matches the active Sales Rep filter
  function matchesRepFilter(c) {
    if (!selectedRep) return true;
    if (includeHouse) {
      return (c.baseSalesRep && c.baseSalesRep.toLowerCase() === selectedRep.toLowerCase()) ||
             (c.salesRep && c.salesRep.toLowerCase() === selectedRep.toLowerCase());
    } else {
      return c.salesRep && c.salesRep.toLowerCase() === selectedRep.toLowerCase();
    }
  }

  function matchesVoidRepFilter(v) {
    if (!selectedRep) return true;
    if (includeHouse) {
      return (v.baseSalesRep && v.baseSalesRep.toLowerCase() === selectedRep.toLowerCase()) ||
             (v.salesRep && v.salesRep.toLowerCase() === selectedRep.toLowerCase());
    } else {
      return v.salesRep && v.salesRep.toLowerCase() === selectedRep.toLowerCase();
    }
  }

  function populateRepSelector() {
    const pillsContainer = document.getElementById('prerollRepPillsContainer');
    const topDropdown = document.getElementById('topRepSelect');
    const clientRepSel = document.getElementById('prerollRepSelect');
    const voidRepSel = document.getElementById('voidsRepSelect');

    const availableReps = reportData.availableSalesReps || [
      'Scotland Schieber',
      'Jeremy Schmidt',
      'Ashlea Underwood',
      'Danny Thoren',
      'Caitlin Stoner',
      'Nancy Drinkard WA',
      'Johnny Wilson'
    ];

    // Count stores per base rep
    const storeCounts = {};
    reportData.clients.forEach(c => {
      const b = c.baseSalesRep;
      if (b) storeCounts[b] = (storeCounts[b] || 0) + 1;
    });

    // 1. Build Pills
    if (pillsContainer) {
      let pillsHtml = `
        <button class="rep-pill ${selectedRep === '' ? 'active' : ''}" data-prep="">
          <span>All Sales Reps</span>
          <span class="rep-pill-count">${reportData.clients.length}</span>
        </button>
      `;
      availableReps.forEach(rep => {
        const cnt = storeCounts[rep] || 0;
        pillsHtml += `
          <button class="rep-pill ${selectedRep === rep ? 'active' : ''}" data-prep="${window.VMI.escapeHtml(rep)}">
            <span>${window.VMI.escapeHtml(rep)}</span>
            <span class="rep-pill-count">${cnt}</span>
          </button>
        `;
      });
      pillsContainer.innerHTML = pillsHtml;
    }

    // 2. Build Top Dropdown
    if (topDropdown) {
      let dHtml = `<option value="">All Sales Reps (Full Preroll Territory)</option>`;
      dHtml += `<optgroup label="Consolidated Sales Reps (Full Book)">`;
      availableReps.forEach(rep => {
        dHtml += `<option value="${window.VMI.escapeHtml(rep)}">${window.VMI.escapeHtml(rep)} (${storeCounts[rep] || 0} stores)</option>`;
      });
      dHtml += `</optgroup>`;

      // Exact lines
      const exactLines = new Set();
      reportData.clients.forEach(c => {
        if (c.salesRep && c.salesRep !== 'Unassigned' && c.salesRep !== '-') exactLines.add(c.salesRep);
      });
      dHtml += `<optgroup label="Exact Territory / House Lines">`;
      Array.from(exactLines).sort().forEach(line => {
        dHtml += `<option value="${window.VMI.escapeHtml(line)}">${window.VMI.escapeHtml(line)}</option>`;
      });
      dHtml += `</optgroup>`;
      topDropdown.innerHTML = dHtml;
    }

    // 3. Populate existing inline dropdowns
    const sortedReps = Array.from(new Set(reportData.clients.map(c => c.salesRep).filter(r => r && r !== 'Unassigned' && r !== '-'))).sort();
    [clientRepSel, voidRepSel].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = `<option value="">All Sales Reps</option>`;
      sortedReps.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        sel.appendChild(opt);
      });
    });
  }

  function setPrerollRepFilter(rep) {
    selectedRep = rep;

    // Update pills
    document.querySelectorAll('#prerollRepPillsContainer .rep-pill').forEach(pill => {
      const pRep = pill.getAttribute('data-prep');
      if (pRep === selectedRep) pill.classList.add('active');
      else pill.classList.remove('active');
    });

    // Synchronize all dropdowns
    const topDropdown = document.getElementById('topRepSelect');
    const clientRepSel = document.getElementById('prerollRepSelect');
    const voidRepSel = document.getElementById('voidsRepSelect');
    if (topDropdown) topDropdown.value = selectedRep;
    if (clientRepSel) clientRepSel.value = selectedRep;
    if (voidRepSel) voidRepSel.value = selectedRep;

    // Update active badge in header
    const badge = document.getElementById('prerollActiveRepBadge');
    if (badge) {
      badge.textContent = selectedRep ? selectedRep : 'All Sales Reps';
      badge.className = `period-badge ${selectedRep ? 'tp1' : 'tp2'}`;
    }

    clientPage = 1;
    voidPage = 1;
    renderKpis();
    renderPrerollGainersChart();
    renderGlSpotlightChart();
    renderCategoryVoidsChart();
    renderRepsVoidsChart();
    renderPrerollClientTable();
    if (voidMode === 'roster') renderVoidRosterTable();
    else renderVoidMatrixTable();
  }

  function populateCategoryDropdown() {
    const catSel = document.getElementById('voidsCategorySelect');
    if (!catSel) return;
    catSel.innerHTML = `<option value="">All 10 Categories</option>`;
    reportData.categoriesSummary.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.category;
      opt.textContent = `${c.category} (${c.storeCount} stores)`;
      catSel.appendChild(opt);
    });
  }

  function renderKpis() {
    let tp1Orders = 0, tp1Rev = 0, tp1Units = 0;
    let tp2Orders = 0, tp2Rev = 0, tp2Units = 0;
    let gCount = 0, lCount = 0, totalVoids = 0;

    if (!selectedRep) {
      tp1Orders = reportData.tp1Total.orders;
      tp1Rev = reportData.tp1Total.ordered;
      tp1Units = reportData.tp1Total.units;
      tp2Orders = reportData.tp2Total.orders;
      tp2Rev = reportData.tp2Total.ordered;
      tp2Units = reportData.tp2Total.units;
      gCount = reportData.clients.filter(c => c.gl === 'G').length;
      lCount = reportData.clients.filter(c => c.gl === 'L').length;
      totalVoids = reportData.voids.length;
    } else {
      const scopedClients = reportData.clients.filter(matchesRepFilter);
      scopedClients.forEach(c => {
        tp1Orders += c.tp1Orders;
        tp1Rev += c.tp1Ordered;
        tp1Units += c.tp1Units;
        tp2Orders += c.tp2Orders;
        tp2Rev += c.tp2Ordered;
        tp2Units += c.tp2Units;
        if (c.gl === 'G') gCount++;
        if (c.gl === 'L') lCount++;
      });
      tp1Rev = round2(tp1Rev);
      tp2Rev = round2(tp2Rev);

      const scopedVoids = reportData.voids.filter(matchesVoidRepFilter);
      totalVoids = scopedVoids.length;
    }

    const tp1Aov = tp1Orders ? round2(tp1Rev / tp1Orders) : 0;
    const tp2Aov = tp2Orders ? round2(tp2Rev / tp2Orders) : 0;

    const orderDiff = tp2Orders - tp1Orders;
    const revDiff = round2(tp2Rev - tp1Rev);
    const unitDiff = tp2Units - tp1Units;
    const aovDiff = round2(tp2Aov - tp1Aov);

    // Orders
    const ordPct = tp1Orders ? ((tp2Orders - tp1Orders) / tp1Orders) * 100 : 0;
    document.getElementById('kpiPrerollOrdersTP2').textContent = window.VMI.fmtInt(tp2Orders);
    document.getElementById('kpiPrerollOrdersTP1').textContent = window.VMI.fmtInt(tp1Orders);
    document.getElementById('kpiPrerollOrdersDelta').textContent = `${window.VMI.fmtSignedInt(orderDiff)} (${window.VMI.fmtPct(ordPct)})`;
    document.getElementById('kpiPrerollOrdersDelta').className = `delta-badge ${orderDiff >= 0 ? 'pos' : 'neg'}`;
    document.getElementById('kpiPrerollOrdersDiffText').textContent = `${window.VMI.fmtSignedInt(orderDiff)} diff`;

    // Revenue
    const revPct = tp1Rev ? ((tp2Rev - tp1Rev) / tp1Rev) * 100 : 0;
    document.getElementById('kpiPrerollRevTP2').textContent = window.VMI.fmtCurrency(tp2Rev);
    document.getElementById('kpiPrerollRevTP1').textContent = window.VMI.fmtCurrency(tp1Rev);
    document.getElementById('kpiPrerollRevDelta').textContent = `${window.VMI.fmtSignedCurrency(revDiff)} (${window.VMI.fmtPct(revPct)})`;
    document.getElementById('kpiPrerollRevDelta').className = `delta-badge ${revDiff >= 0 ? 'pos' : 'neg'}`;
    document.getElementById('kpiPrerollRevDiffText').textContent = window.VMI.fmtSignedCurrency(revDiff);

    // Units
    const unitPct = tp1Units ? ((tp2Units - tp1Units) / tp1Units) * 100 : 0;
    document.getElementById('kpiPrerollUnitsTP2').textContent = window.VMI.fmtInt(tp2Units);
    document.getElementById('kpiPrerollUnitsTP1').textContent = window.VMI.fmtInt(tp1Units);
    document.getElementById('kpiPrerollUnitsDelta').textContent = `${window.VMI.fmtSignedInt(unitDiff)} (${window.VMI.fmtPct(unitPct)})`;
    document.getElementById('kpiPrerollUnitsDelta').className = `delta-badge ${unitDiff >= 0 ? 'pos' : 'neg'}`;
    document.getElementById('kpiPrerollUnitsDiffText').textContent = `${window.VMI.fmtSignedInt(unitDiff)} diff`;

    // AOV
    const aovPct = tp1Aov ? ((tp2Aov - tp1Aov) / tp1Aov) * 100 : 0;
    document.getElementById('kpiPrerollAovTP2').textContent = window.VMI.fmtCurrency(tp2Aov);
    document.getElementById('kpiPrerollAovTP1').textContent = window.VMI.fmtCurrency(tp1Aov);
    document.getElementById('kpiPrerollAovDelta').textContent = `${window.VMI.fmtSignedCurrency(aovDiff)} (${window.VMI.fmtPct(aovPct)})`;
    document.getElementById('kpiPrerollAovDelta').className = `delta-badge ${aovDiff >= 0 ? 'pos' : 'neg'}`;
    document.getElementById('kpiPrerollAovDiffText').textContent = window.VMI.fmtSignedCurrency(aovDiff);

    // Dynamic Account Dynamics & Voids Card
    const glValueEl = document.querySelector('.kpi-card:nth-child(5) .kpi-value');
    if (glValueEl) {
      glValueEl.innerHTML = `
        <span style="color: var(--emerald-text);">+${gCount} G</span>
        <span style="color: var(--text-muted); font-weight: 400;">/</span>
        <span style="color: var(--rose-text);">-${lCount} L</span>
      `;
    }
    const glBaselineEl = document.querySelector('.kpi-card:nth-child(5) .kpi-baseline');
    if (glBaselineEl) {
      const activeStores = reportData.clients.filter(matchesRepFilter).length;
      glBaselineEl.innerHTML = `
        <span>Total Void Entries: <strong>${window.VMI.fmtInt(totalVoids)}</strong></span>
        <span class="tag-badge tag-vmi">${activeStores} Stores</span>
      `;
    }

    // Badges on view buttons
    const scopedClientCount = reportData.clients.filter(matchesRepFilter).length;
    document.getElementById('badgePrerollClientsCount').textContent = window.VMI.fmtInt(scopedClientCount);
    document.getElementById('badgeVoidsCount').textContent = window.VMI.fmtInt(totalVoids);
  }

  function renderPrerollGainersChart() {
    const container = document.getElementById('prerollGainersChartContainer');
    const filteredList = reportData.clients.filter(matchesRepFilter);
    const sorted = [...filteredList].sort((a, b) => b.revDiff - a.revDiff);
    const gainers = sorted.slice(0, 10);
    const decliners = sorted.slice(-10).reverse();

    const currentList = prerollGainersMode === 'gainers' ? gainers : decliners;
    const maxVal = Math.max(...currentList.map(c => Math.abs(c.revDiff)), 1);

    let html = '';
    if (currentList.length === 0) {
      html = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No stores match current filter.</div>`;
    } else {
      currentList.forEach(c => {
        const pct = ((Math.abs(c.revDiff) / maxVal) * 100).toFixed(1);
        const isPos = c.revDiff >= 0;
        const fillClass = isPos ? 'pos' : 'neg';
        const textClass = isPos ? 'num-pos' : 'num-neg';
        html += `
          <div class="chart-row">
            <div class="chart-row-meta">
              <span class="chart-row-label" title="${window.VMI.escapeHtml(c.client)}">${window.VMI.escapeHtml(c.client)}</span>
              <span class="chart-row-vals">
                <span class="${textClass}">${window.VMI.fmtSignedCurrency(c.revDiff)}</span>
              </span>
            </div>
            <div class="bar-track">
              <div class="bar-fill ${fillClass}" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      });
    }
    container.innerHTML = html;
  }

  function renderGlSpotlightChart() {
    const container = document.getElementById('glSpotlightContainer');
    const filteredList = reportData.clients.filter(matchesRepFilter);
    const gained = filteredList.filter(c => c.gl === 'G').sort((a, b) => b.tp2Ordered - a.tp2Ordered);
    const lost = filteredList.filter(c => c.gl === 'L').sort((a, b) => b.tp1Ordered - a.tp1Ordered);

    const currentList = glSpotlightMode === 'gained' ? gained : lost;
    const maxVal = Math.max(...currentList.map(c => glSpotlightMode === 'gained' ? c.tp2Ordered : c.tp1Ordered), 1);

    let html = '';
    if (currentList.length === 0) {
      html = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No ${glSpotlightMode === 'gained' ? 'acquired' : 'lost'} accounts for active filter.</div>`;
    } else {
      currentList.forEach(c => {
        const val = glSpotlightMode === 'gained' ? c.tp2Ordered : c.tp1Ordered;
        const ords = glSpotlightMode === 'gained' ? c.tp2Orders : c.tp1Orders;
        const pct = ((val / maxVal) * 100).toFixed(1);
        const fillClass = glSpotlightMode === 'gained' ? 'pos' : 'neg';
        const textClass = glSpotlightMode === 'gained' ? 'num-pos' : 'num-neg';
        html += `
          <div class="chart-row">
            <div class="chart-row-meta">
              <span class="chart-row-label" title="${window.VMI.escapeHtml(c.client)}">${window.VMI.escapeHtml(c.client)}</span>
              <span class="chart-row-vals">
                <span>${ords} ords</span>
                <span class="${textClass}">${window.VMI.fmtCurrency(val)}</span>
              </span>
            </div>
            <div class="bar-track">
              <div class="bar-fill ${fillClass}" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      });
    }
    container.innerHTML = html;
  }

  function renderCategoryVoidsChart() {
    const container = document.getElementById('categoryVoidsChartContainer');
    const scopedVoids = reportData.voids.filter(matchesVoidRepFilter);

    // Count voids per category
    const catCounts = {};
    reportData.categoriesSummary.forEach(c => { catCounts[c.category] = 0; });
    scopedVoids.forEach(v => {
      catCounts[v.category] = (catCounts[v.category] || 0) + 1;
    });

    const sorted = Object.entries(catCounts)
      .map(([category, storeCount]) => ({ category, storeCount }))
      .sort((a, b) => b.storeCount - a.storeCount);

    const maxVal = Math.max(...sorted.map(c => c.storeCount), 1);

    let html = '';
    sorted.forEach(c => {
      const pct = ((c.storeCount / maxVal) * 100).toFixed(1);
      html += `
        <div class="chart-row">
          <div class="chart-row-meta">
            <span class="chart-row-label">${window.VMI.escapeHtml(c.category)}</span>
            <span class="chart-row-vals">
              <span class="num-neg">${window.VMI.fmtInt(c.storeCount)} voids</span>
            </span>
          </div>
          <div class="bar-track">
            <div class="bar-fill neg" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  function renderRepsVoidsChart() {
    const container = document.getElementById('repsVoidsChartContainer');
    const sorted = [...reportData.repsVoidSummary].sort((a, b) => b.voidCount - a.voidCount);
    const maxVal = Math.max(...sorted.map(r => r.voidCount), 1);

    let html = '';
    sorted.forEach(r => {
      const pct = ((r.voidCount / maxVal) * 100).toFixed(1);
      const isSelected = selectedRep && (r.rep.toLowerCase() === selectedRep.toLowerCase() || (r.baseRep && r.baseRep.toLowerCase() === selectedRep.toLowerCase()));
      const selectedStyle = isSelected ? 'background: rgba(6, 182, 212, 0.12); border-left: 3px solid var(--cyan-light); padding-left: 4px; border-radius: 4px;' : '';

      html += `
        <div class="chart-row" style="${selectedStyle} cursor: pointer;" data-voidrepclick="${window.VMI.escapeHtml(r.baseRep || r.rep)}">
          <div class="chart-row-meta">
            <span class="chart-row-label"><strong>${window.VMI.escapeHtml(r.rep)}</strong></span>
            <span class="chart-row-vals">
              <span>${r.uniqueStores} stores</span>
              <span style="color: var(--cyan-light); font-weight:700;">${r.voidCount} voids</span>
            </span>
          </div>
          <div class="bar-track">
            <div class="bar-fill tp2" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    container.querySelectorAll('[data-voidrepclick]').forEach(el => {
      el.addEventListener('click', () => {
        const rep = el.getAttribute('data-voidrepclick');
        setPrerollRepFilter(selectedRep === rep ? '' : rep);
      });
    });
  }

  // ================= VIEW 1 CLIENT TABLE LOGIC =================
  function getFilteredPrerollClients() {
    return reportData.clients.filter(c => {
      // Sales Rep Filter
      if (!matchesRepFilter(c)) return false;

      // Search Query
      if (clientSearchQuery) {
        const q = clientSearchQuery.toLowerCase();
        const clientMatch = c.client.toLowerCase().includes(q) || (c.tp1Client && c.tp1Client.toLowerCase().includes(q)) || (c.tp2Client && c.tp2Client.toLowerCase().includes(q));
        const repMatch = c.salesRep && c.salesRep.toLowerCase().includes(q);
        const chainMatch = c.chainCode && c.chainCode.toLowerCase().includes(q);
        if (!clientMatch && !repMatch && !chainMatch) return false;
      }

      // Filter Pill
      if (clientFilter === 'gained' && c.gl !== 'G') return false;
      if (clientFilter === 'lost' && c.gl !== 'L') return false;
      if (clientFilter === 'vmi' && !c.isVmi) return false;
      if (clientFilter === '1wt' && !c.is1Wt) return false;
      if (clientFilter === 'gainers' && c.revDiff <= 0) return false;
      if (clientFilter === 'decliners' && c.revDiff >= 0) return false;

      return true;
    }).sort((a, b) => {
      let v1 = a[clientSortCol];
      let v2 = b[clientSortCol];
      if (v1 === undefined) v1 = 0;
      if (v2 === undefined) v2 = 0;
      if (typeof v1 === 'string') {
        return clientSortAsc ? v1.localeCompare(v2) : v2.localeCompare(v1);
      }
      return clientSortAsc ? v1 - v2 : v2 - v1;
    });
  }

  function renderPrerollClientTable() {
    const tbody = document.getElementById('prerollTableBody');
    const tfoot = document.getElementById('prerollTableFoot');
    const filtered = getFilteredPrerollClients();
    const totalCount = filtered.length;

    let startIdx = 0;
    let endIdx = totalCount;
    if (clientPageSize !== 'all') {
      const pSize = parseInt(clientPageSize, 10);
      const maxPages = Math.ceil(totalCount / pSize) || 1;
      if (clientPage > maxPages) clientPage = maxPages;
      if (clientPage < 1) clientPage = 1;
      startIdx = (clientPage - 1) * pSize;
      endIdx = Math.min(startIdx + pSize, totalCount);
    }
    const visibleRows = filtered.slice(startIdx, endIdx);

    // Update pagination
    updateClientPaginationUI(totalCount, startIdx, endIdx);

    let html = '';
    if (visibleRows.length === 0) {
      html = `<tr><td colspan="15" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matching client records found.</td></tr>`;
    } else {
      visibleRows.forEach(r => {
        const badges = window.VMI.renderClientBadges(r);
        const ordClass = r.orderDiff >= 0 ? 'num-pos' : 'num-neg';
        const revClass = r.revDiff >= 0 ? 'num-pos' : 'num-neg';
        const untClass = r.unitDiff >= 0 ? 'num-pos' : 'num-neg';
        const aovClass = r.aveDiff >= 0 ? 'num-pos' : 'num-neg';

        let mismatchTag = '';
        if (r.clientMismatch) {
          if (r.tp1Orders === 0 && r.tp2Client) {
            mismatchTag = `<span class="tag-badge tag-mismatch" title="Raw Col A held ${r.tp1Client} while Col F held ${r.tp2Client}">Resolved: ${window.VMI.escapeHtml(r.tp2Client)}</span>`;
          } else {
            mismatchTag = `<span class="tag-badge tag-mismatch" title="TP1: ${r.tp1Client} ↔ TP2: ${r.tp2Client}">TP1: ${window.VMI.escapeHtml(r.tp1Client)} ↔ TP2: ${window.VMI.escapeHtml(r.tp2Client)}</span>`;
          }
        }

        html += `
          <tr>
            <td>
              <div style="font-weight: 600;">${window.VMI.escapeHtml(r.client)}</div>
              <div>${badges} ${mismatchTag}</div>
            </td>
            <td><span class="tag-badge tag-rep">${window.VMI.escapeHtml(r.salesRep || 'Unassigned')}</span></td>
            <td class="text-right">${window.VMI.fmtInt(r.tp1Orders)}</td>
            <td class="text-right">${window.VMI.fmtCurrency(r.tp1Ordered)}</td>
            <td class="text-right">${window.VMI.fmtInt(r.tp1Units)}</td>
            <td class="text-right">${window.VMI.fmtCurrency(r.tp1Aov)}</td>
            <td class="text-right">${window.VMI.fmtInt(r.tp2Orders)}</td>
            <td class="text-right">${window.VMI.fmtCurrency(r.tp2Ordered)}</td>
            <td class="text-right">${window.VMI.fmtInt(r.tp2Units)}</td>
            <td class="text-right">${window.VMI.fmtCurrency(r.tp2Aov)}</td>
            <td class="text-right ${ordClass}">${window.VMI.fmtSignedInt(r.orderDiff)}</td>
            <td class="text-right ${revClass}">${window.VMI.fmtSignedCurrency(r.revDiff)}</td>
            <td class="text-right ${untClass}">${window.VMI.fmtSignedInt(r.unitDiff)}</td>
            <td class="text-right ${aovClass}">${window.VMI.fmtSignedCurrency(r.aveDiff)}</td>
            <td class="text-center">
              ${r.voidCount > 0 ? `<span class="matrix-void-badge">${r.voidCount} Voids</span>` : `<span class="matrix-active-badge">Full</span>`}
            </td>
          </tr>
        `;
      });
    }
    tbody.innerHTML = html;

    // Dynamic Sticky TFoot totals
    let fTp1Ord = 0, fTp1Rev = 0, fTp1Unt = 0;
    let fTp2Ord = 0, fTp2Rev = 0, fTp2Unt = 0;
    let fVoids = 0;

    filtered.forEach(r => {
      fTp1Ord += r.tp1Orders;
      fTp1Rev += r.tp1Ordered;
      fTp1Unt += r.tp1Units;
      fTp2Ord += r.tp2Orders;
      fTp2Rev += r.tp2Ordered;
      fTp2Unt += r.tp2Units;
      fVoids += (r.voidCount || 0);
    });

    fTp1Rev = round2(fTp1Rev);
    fTp2Rev = round2(fTp2Rev);
    const fTp1Aov = fTp1Ord ? round2(fTp1Rev / fTp1Ord) : 0;
    const fTp2Aov = fTp2Ord ? round2(fTp2Rev / fTp2Ord) : 0;
    const fOrdDiff = fTp2Ord - fTp1Ord;
    const fRevDiff = round2(fTp2Rev - fTp1Rev);
    const fUntDiff = fTp2Unt - fTp1Unt;
    const fAovDiff = round2(fTp2Aov - fTp1Aov);

    const label = (selectedRep || clientFilter !== 'all' || clientSearchQuery) ? `Filtered Total:` : `Total:`;

    tfoot.innerHTML = `
      <tr>
        <td><strong>${label}</strong></td>
        <td>${totalCount} accounts</td>
        <td class="text-right">${window.VMI.fmtInt(fTp1Ord)}</td>
        <td class="text-right">${window.VMI.fmtCurrency(fTp1Rev)}</td>
        <td class="text-right">${window.VMI.fmtInt(fTp1Unt)}</td>
        <td class="text-right">${window.VMI.fmtCurrency(fTp1Aov)}</td>
        <td class="text-right">${window.VMI.fmtInt(fTp2Ord)}</td>
        <td class="text-right">${window.VMI.fmtCurrency(fTp2Rev)}</td>
        <td class="text-right">${window.VMI.fmtInt(fTp2Unt)}</td>
        <td class="text-right">${window.VMI.fmtCurrency(fTp2Aov)}</td>
        <td class="text-right ${fOrdDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedInt(fOrdDiff)}</td>
        <td class="text-right ${fRevDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedCurrency(fRevDiff)}</td>
        <td class="text-right ${fUntDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedInt(fUntDiff)}</td>
        <td class="text-right ${fAovDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedCurrency(fAovDiff)}</td>
        <td class="text-center"><strong>${window.VMI.fmtInt(fVoids)}</strong></td>
      </tr>
    `;

    // Active sort header
    document.querySelectorAll('#prerollTable th.sortable').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.getAttribute('data-col') === clientSortCol) {
        th.classList.add(clientSortAsc ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }

  function updateClientPaginationUI(totalCount, startIdx, endIdx) {
    const info = document.getElementById('prerollPaginationInfo');
    const btnContainer = document.getElementById('prerollPaginationButtons');

    if (totalCount === 0) {
      info.textContent = 'Showing 0 of 0 rows';
      btnContainer.innerHTML = '';
      return;
    }

    info.textContent = `Showing ${startIdx + 1} to ${endIdx} of ${totalCount} rows`;

    if (clientPageSize === 'all') {
      btnContainer.innerHTML = '';
      return;
    }

    const pSize = parseInt(clientPageSize, 10);
    const totalPages = Math.ceil(totalCount / pSize);
    let btns = '';

    btns += `<button class="btn btn-secondary" ${clientPage === 1 ? 'disabled style="opacity:0.4;"' : ''} id="btnClientPrev">« Prev</button>`;
    btns += `<span style="padding: 0 0.5rem; font-weight: 600;">Page ${clientPage} of ${totalPages}</span>`;
    btns += `<button class="btn btn-secondary" ${clientPage === totalPages ? 'disabled style="opacity:0.4;"' : ''} id="btnClientNext">Next »</button>`;

    btnContainer.innerHTML = btns;

    const btnPrev = document.getElementById('btnClientPrev');
    const btnNext = document.getElementById('btnClientNext');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (clientPage > 1) {
          clientPage--;
          renderPrerollClientTable();
        }
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (clientPage < totalPages) {
          clientPage++;
          renderPrerollClientTable();
        }
      });
    }
  }

  // ================= VIEW 2 VOIDS LOGIC =================
  function getFilteredVoidRoster() {
    return reportData.voids.filter(v => {
      if (!matchesVoidRepFilter(v)) return false;

      if (voidSearchQuery) {
        const q = voidSearchQuery.toLowerCase();
        const clientMatch = v.client.toLowerCase().includes(q);
        const repMatch = v.salesRep && v.salesRep.toLowerCase().includes(q);
        const catMatch = v.category.toLowerCase().includes(q);
        const chainMatch = v.chainCode && v.chainCode.toLowerCase().includes(q);
        if (!clientMatch && !repMatch && !catMatch && !chainMatch) return false;
      }
      if (voidCategoryFilter && v.category !== voidCategoryFilter) return false;
      return true;
    }).sort((a, b) => {
      let v1 = a[voidRosterSortCol];
      let v2 = b[voidRosterSortCol];
      if (v1 === undefined) v1 = 0;
      if (v2 === undefined) v2 = 0;
      if (typeof v1 === 'string') {
        return voidRosterSortAsc ? v1.localeCompare(v2) : v2.localeCompare(v1);
      }
      return voidRosterSortAsc ? v1 - v2 : v2 - v1;
    });
  }

  function renderVoidRosterTable() {
    const tbody = document.getElementById('voidRosterTableBody');
    const tfoot = document.getElementById('voidRosterTableFoot');
    const filtered = getFilteredVoidRoster();
    const totalCount = filtered.length;

    let startIdx = 0;
    let endIdx = totalCount;
    if (voidPageSize !== 'all') {
      const pSize = parseInt(voidPageSize, 10);
      const maxPages = Math.ceil(totalCount / pSize) || 1;
      if (voidPage > maxPages) voidPage = maxPages;
      if (voidPage < 1) voidPage = 1;
      startIdx = (voidPage - 1) * pSize;
      endIdx = Math.min(startIdx + pSize, totalCount);
    }
    const visibleRows = filtered.slice(startIdx, endIdx);

    updateVoidPaginationUI(totalCount, startIdx, endIdx);

    let html = '';
    if (visibleRows.length === 0) {
      html = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matching category void records found.</td></tr>`;
    } else {
      visibleRows.forEach(v => {
        const badges = window.VMI.renderClientBadges(v);
        html += `
          <tr>
            <td><span class="matrix-void-badge">${window.VMI.escapeHtml(v.category)}</span></td>
            <td>
              <div style="font-weight: 600;">${window.VMI.escapeHtml(v.client)}</div>
              <div>${badges}</div>
            </td>
            <td><span class="tag-badge tag-rep">${window.VMI.escapeHtml(v.salesRep || '-')}</span></td>
            <td class="text-right">${window.VMI.fmtInt(v.tp2Orders)}</td>
            <td class="text-right">${window.VMI.fmtCurrency(v.tp2Ordered)}</td>
          </tr>
        `;
      });
    }
    tbody.innerHTML = html;

    tfoot.innerHTML = `
      <tr>
        <td><strong>Total Filtered Voids:</strong></td>
        <td>${totalCount} void entries</td>
        <td>Across territories</td>
        <td class="text-right">-</td>
        <td class="text-right">-</td>
      </tr>
    `;

    document.querySelectorAll('#voidRosterTable th.sortable').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.getAttribute('data-vcol') === voidRosterSortCol) {
        th.classList.add(voidRosterSortAsc ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }

  function renderVoidMatrixTableHead() {
    const thead = document.getElementById('voidMatrixTableHead');
    const categories = reportData.categoriesSummary.map(c => c.category);
    let catHeaders = categories.map(c => `<th class="text-center" style="font-size:0.7rem;">${window.VMI.escapeHtml(c.replace('Prerolls', '').replace('Preroll', '').trim())}</th>`).join('');

    thead.innerHTML = `
      <tr>
        <th class="sortable" data-mcol="client">Store / Client <span class="sort-icon">↕</span></th>
        <th class="sortable" data-mcol="salesRep">Sales Rep <span class="sort-icon">↕</span></th>
        ${catHeaders}
        <th class="sortable text-center" data-mcol="voidCount">Total Voids <span class="sort-icon">↕</span></th>
        <th class="sortable text-right" data-mcol="tp2Ordered">TP2 Preroll Rev <span class="sort-icon">↕</span></th>
      </tr>
    `;
  }

  function renderVoidMatrixTable() {
    const tbody = document.getElementById('voidMatrixTableBody');
    const tfoot = document.getElementById('voidMatrixTableFoot');
    const categories = reportData.categoriesSummary.map(c => c.category);

    const clientMatrix = [];
    reportData.clients.forEach(c => {
      if (!matchesRepFilter(c)) return;

      if (voidSearchQuery) {
        const q = voidSearchQuery.toLowerCase();
        const clientMatch = c.client.toLowerCase().includes(q);
        const repMatch = c.salesRep && c.salesRep.toLowerCase().includes(q);
        if (!clientMatch && !repMatch) return;
      }
      if (voidCategoryFilter && !c.voidCategories.includes(voidCategoryFilter)) return;

      clientMatrix.push(c);
    });

    clientMatrix.sort((a, b) => {
      const valA = a[voidMatrixSortCol];
      const valB = b[voidMatrixSortCol];
      if (typeof valA === 'string' || typeof valB === 'string') {
        const sA = String(valA || '');
        const sB = String(valB || '');
        return voidMatrixSortAsc ? sA.localeCompare(sB) : sB.localeCompare(sA);
      }
      return voidMatrixSortAsc ? (valA - valB) : (valB - valA);
    });

    const totalCount = clientMatrix.length;
    let startIdx = 0;
    let endIdx = totalCount;
    if (voidPageSize !== 'all') {
      const pSize = parseInt(voidPageSize, 10);
      const maxPages = Math.ceil(totalCount / pSize) || 1;
      if (voidPage > maxPages) voidPage = maxPages;
      if (voidPage < 1) voidPage = 1;
      startIdx = (voidPage - 1) * pSize;
      endIdx = Math.min(startIdx + pSize, totalCount);
    }
    const visibleRows = clientMatrix.slice(startIdx, endIdx);

    updateVoidPaginationUI(totalCount, startIdx, endIdx);

    let html = '';
    if (visibleRows.length === 0) {
      html = `<tr><td colspan="${categories.length + 4}" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matching stores found in matrix view.</td></tr>`;
    } else {
      visibleRows.forEach(c => {
        const badges = window.VMI.renderClientBadges(c);
        let catCells = categories.map(cat => {
          const isVoid = c.voidCategories.includes(cat);
          return isVoid
            ? `<td class="text-center"><span class="matrix-void-badge">VOID</span></td>`
            : `<td class="text-center"><span class="matrix-active-badge">✓</span></td>`;
        }).join('');

        html += `
          <tr>
            <td>
              <div style="font-weight: 600;">${window.VMI.escapeHtml(c.client)}</div>
              <div>${badges}</div>
            </td>
            <td><span class="tag-badge tag-rep">${window.VMI.escapeHtml(c.salesRep || 'Unassigned')}</span></td>
            ${catCells}
            <td class="text-center"><strong>${c.voidCount}</strong> / 10</td>
            <td class="text-right">${window.VMI.fmtCurrency(c.tp2Ordered)}</td>
          </tr>
        `;
      });
    }
    tbody.innerHTML = html;

    tfoot.innerHTML = `
      <tr>
        <td><strong>Total:</strong></td>
        <td>${totalCount} stores</td>
        <td colspan="${categories.length}" class="text-center" style="font-size: 0.75rem; color: var(--text-secondary);">10 Preroll Categories Tracked</td>
        <td class="text-center">-</td>
        <td class="text-right">-</td>
      </tr>
    `;

    document.querySelectorAll('#voidMatrixTable th.sortable').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.getAttribute('data-mcol') === voidMatrixSortCol) {
        th.classList.add(voidMatrixSortAsc ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }

  function updateVoidPaginationUI(totalCount, startIdx, endIdx) {
    const info = document.getElementById('voidsPaginationInfo');
    const btnContainer = document.getElementById('voidsPaginationButtons');

    if (totalCount === 0) {
      info.textContent = 'Showing 0 of 0 rows';
      btnContainer.innerHTML = '';
      return;
    }

    info.textContent = `Showing ${startIdx + 1} to ${endIdx} of ${totalCount} rows`;

    if (voidPageSize === 'all') {
      btnContainer.innerHTML = '';
      return;
    }

    const pSize = parseInt(voidPageSize, 10);
    const totalPages = Math.ceil(totalCount / pSize);
    let btns = '';

    btns += `<button class="btn btn-secondary" ${voidPage === 1 ? 'disabled style="opacity:0.4;"' : ''} id="btnVoidPrev">« Prev</button>`;
    btns += `<span style="padding: 0 0.5rem; font-weight: 600;">Page ${voidPage} of ${totalPages}</span>`;
    btns += `<button class="btn btn-secondary" ${voidPage === totalPages ? 'disabled style="opacity:0.4;"' : ''} id="btnVoidNext">Next »</button>`;

    btnContainer.innerHTML = btns;

    const btnPrev = document.getElementById('btnVoidPrev');
    const btnNext = document.getElementById('btnVoidNext');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (voidPage > 1) {
          voidPage--;
          if (voidMode === 'roster') renderVoidRosterTable();
          else renderVoidMatrixTable();
        }
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (voidPage < totalPages) {
          voidPage++;
          if (voidMode === 'roster') renderVoidRosterTable();
          else renderVoidMatrixTable();
        }
      });
    }
  }

  function bindEvents() {
    // Top Sales Rep Selector Pills
    const repPillsContainer = document.getElementById('prerollRepPillsContainer');
    if (repPillsContainer) {
      repPillsContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.rep-pill');
        if (!pill) return;
        const rep = pill.getAttribute('data-prep');
        setPrerollRepFilter(rep);
      });
    }

    // Top Sales Rep Dropdown
    const topRepSelect = document.getElementById('topRepSelect');
    if (topRepSelect) {
      topRepSelect.addEventListener('change', (e) => {
        setPrerollRepFilter(e.target.value);
      });
    }

    // Include House Checkbox
    const chkHouse = document.getElementById('chkPrerollIncludeHouse');
    if (chkHouse) {
      chkHouse.addEventListener('change', (e) => {
        includeHouse = e.target.checked;
        if (selectedRep) {
          clientPage = 1;
          renderKpis();
          renderPrerollGainersChart();
          renderGlSpotlightChart();
          renderPrerollClientTable();
        }
      });
    }

    // Reset Rep Filter Button
    const btnReset = document.getElementById('btnPrerollResetRepFilter');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        setPrerollRepFilter('');
      });
    }

    // Inline Rep Dropdowns (client & void)
    const clientRepSel = document.getElementById('prerollRepSelect');
    if (clientRepSel) {
      clientRepSel.addEventListener('change', (e) => {
        setPrerollRepFilter(e.target.value);
      });
    }

    const voidRepSel = document.getElementById('voidsRepSelect');
    if (voidRepSel) {
      voidRepSel.addEventListener('change', (e) => {
        setPrerollRepFilter(e.target.value);
      });
    }

    // Primary View Tabs
    document.querySelectorAll('.tabs-bar .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs-bar .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeMainView = btn.getAttribute('data-view');
        if (activeMainView === 'clients') {
          document.getElementById('viewClientsSection').style.display = 'block';
          document.getElementById('viewVoidsSection').style.display = 'none';
        } else {
          document.getElementById('viewClientsSection').style.display = 'none';
          document.getElementById('viewVoidsSection').style.display = 'block';
        }
      });
    });

    // Preroll Gainers vs Decliners Toggle
    const btnGainers = document.getElementById('btnPrerollGainersToggle');
    const btnDecliners = document.getElementById('btnPrerollDeclinersToggle');
    btnGainers.addEventListener('click', () => {
      prerollGainersMode = 'gainers';
      btnGainers.classList.add('btn-primary');
      btnGainers.classList.remove('btn-secondary');
      btnDecliners.classList.add('btn-secondary');
      btnDecliners.classList.remove('btn-primary');
      renderPrerollGainersChart();
    });
    btnDecliners.addEventListener('click', () => {
      prerollGainersMode = 'decliners';
      btnDecliners.classList.add('btn-primary');
      btnDecliners.classList.remove('btn-secondary');
      btnGainers.classList.add('btn-secondary');
      btnGainers.classList.remove('btn-primary');
      renderPrerollGainersChart();
    });

    // G/L Spotlight Toggle
    const btnGained = document.getElementById('btnGlGainedToggle');
    const btnLost = document.getElementById('btnGlLostToggle');
    btnGained.addEventListener('click', () => {
      glSpotlightMode = 'gained';
      btnGained.classList.add('btn-primary');
      btnGained.classList.remove('btn-secondary');
      btnLost.classList.add('btn-secondary');
      btnLost.classList.remove('btn-primary');
      renderGlSpotlightChart();
    });
    btnLost.addEventListener('click', () => {
      glSpotlightMode = 'lost';
      btnLost.classList.add('btn-primary');
      btnLost.classList.remove('btn-secondary');
      btnGained.classList.add('btn-secondary');
      btnGained.classList.remove('btn-primary');
      renderGlSpotlightChart();
    });

    // Client Filter Pills
    document.querySelectorAll('[data-cfilter]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('[data-cfilter]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        clientFilter = pill.getAttribute('data-cfilter');
        clientPage = 1;
        renderPrerollClientTable();
      });
    });

    // Client Search
    document.getElementById('prerollSearchInput').addEventListener('input', (e) => {
      clientSearchQuery = e.target.value.trim();
      clientPage = 1;
      renderPrerollClientTable();
    });

    // Client Page Size
    document.getElementById('prerollPageSizeSelect').addEventListener('change', (e) => {
      clientPageSize = e.target.value;
      clientPage = 1;
      renderPrerollClientTable();
    });

    // Client Table Header Sort
    document.querySelectorAll('#prerollTable th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-col');
        if (clientSortCol === col) {
          clientSortAsc = !clientSortAsc;
        } else {
          clientSortCol = col;
          clientSortAsc = col === 'client' || col === 'salesRep';
        }
        renderPrerollClientTable();
      });
    });

    // Void Mode Toggle
    const btnVoidRoster = document.getElementById('btnVoidModeRoster');
    const btnVoidMatrix = document.getElementById('btnVoidModeMatrix');
    btnVoidRoster.addEventListener('click', () => {
      voidMode = 'roster';
      btnVoidRoster.classList.add('btn-primary');
      btnVoidRoster.classList.remove('btn-secondary');
      btnVoidMatrix.classList.add('btn-secondary');
      btnVoidMatrix.classList.remove('btn-primary');
      document.getElementById('voidRosterContainer').style.display = 'block';
      document.getElementById('voidMatrixContainer').style.display = 'none';
      voidPage = 1;
      renderVoidRosterTable();
    });
    btnVoidMatrix.addEventListener('click', () => {
      voidMode = 'matrix';
      btnVoidMatrix.classList.add('btn-primary');
      btnVoidMatrix.classList.remove('btn-secondary');
      btnVoidRoster.classList.add('btn-secondary');
      btnVoidRoster.classList.remove('btn-primary');
      document.getElementById('voidRosterContainer').style.display = 'none';
      document.getElementById('voidMatrixContainer').style.display = 'block';
      voidPage = 1;
      renderVoidMatrixTable();
    });

    // Void Search & Filters
    document.getElementById('voidsSearchInput').addEventListener('input', (e) => {
      voidSearchQuery = e.target.value.trim();
      voidPage = 1;
      if (voidMode === 'roster') renderVoidRosterTable();
      else renderVoidMatrixTable();
    });

    document.getElementById('voidsCategorySelect').addEventListener('change', (e) => {
      voidCategoryFilter = e.target.value;
      voidPage = 1;
      if (voidMode === 'roster') renderVoidRosterTable();
      else renderVoidMatrixTable();
    });

    document.getElementById('voidsPageSizeSelect').addEventListener('change', (e) => {
      voidPageSize = e.target.value;
      voidPage = 1;
      if (voidMode === 'roster') renderVoidRosterTable();
      else renderVoidMatrixTable();
    });

    // Void Roster Table Header Sort
    document.querySelectorAll('#voidRosterTable th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-vcol');
        if (voidRosterSortCol === col) {
          voidRosterSortAsc = !voidRosterSortAsc;
        } else {
          voidRosterSortCol = col;
          voidRosterSortAsc = col === 'category' || col === 'client' || col === 'salesRep';
        }
        renderVoidRosterTable();
      });
    });

    // Void Matrix Table Header Sort
    document.querySelectorAll('#voidMatrixTable th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-mcol');
        if (voidMatrixSortCol === col) {
          voidMatrixSortAsc = !voidMatrixSortAsc;
        } else {
          voidMatrixSortCol = col;
          voidMatrixSortAsc = col === 'client' || col === 'salesRep';
        }
        renderVoidMatrixTable();
      });
    });

    // CSV Exports
    document.getElementById('btnExportPrerollClients').addEventListener('click', exportPrerollClientsCsv);
    document.getElementById('btnExportVoids').addEventListener('click', exportVoidsCsv);
    document.getElementById('btnExportActiveTable').addEventListener('click', () => {
      if (activeMainView === 'clients') exportPrerollClientsCsv();
      else exportVoidsCsv();
    });
  }

  function exportPrerollClientsCsv() {
    const list = getFilteredPrerollClients();
    const repPrefix = selectedRep ? `_${selectedRep.replace(/\s+/g, '_')}` : '';
    const headers = [
      'Client', 'Raw TP1 Client', 'Raw TP2 Client', 'Client Mismatch Resolved', 'G/L Status', 'Sales Rep',
      'TP1 Orders', 'TP1 Revenue', 'TP1 Units', 'TP1 AOV',
      'TP2 Orders', 'TP2 Revenue', 'TP2 Units', 'TP2 AOV',
      'Order Diff', 'Rev Diff', 'Unit Diff', 'AOV Diff', 'Void Categories Count'
    ];
    const rows = list.map(c => [
      c.client, c.tp1Client, c.tp2Client, c.clientMismatch ? 'YES' : 'NO', c.gl || '', c.salesRep,
      c.tp1Orders, c.tp1Ordered, c.tp1Units, c.tp1Aov,
      c.tp2Orders, c.tp2Ordered, c.tp2Units, c.tp2Aov,
      c.orderDiff, c.revDiff, c.unitDiff, c.aveDiff, c.voidCount
    ]);
    window.VMI.exportCsv(`vmi_preroll_client_performance${repPrefix}.csv`, headers, rows);
  }

  function exportVoidsCsv() {
    const repPrefix = selectedRep ? `_${selectedRep.replace(/\s+/g, '_')}` : '';
    if (voidMode === 'roster') {
      const list = getFilteredVoidRoster();
      const headers = ['Product Category', 'Store / Client', 'Sales Rep', 'Chain Code', 'Is VMI', 'Is 1WT', 'TP2 Orders', 'TP2 Revenue'];
      const rows = list.map(v => [
        v.category, v.client, v.salesRep, v.chainCode || '', v.isVmi ? 'YES' : 'NO', v.is1Wt ? 'YES' : 'NO',
        v.tp2Orders, v.tp2Ordered
      ]);
      window.VMI.exportCsv(`vmi_preroll_category_voids_roster${repPrefix}.csv`, headers, rows);
    } else {
      const categories = reportData.categoriesSummary.map(c => c.category);
      const headers = ['Store / Client', 'Sales Rep', ...categories, 'Total Void Categories', 'TP2 Preroll Revenue'];
      const rows = reportData.clients.filter(matchesRepFilter).map(c => [
        c.client, c.salesRep, ...categories.map(cat => c.voidCategories.includes(cat) ? 'VOID' : 'ACTIVE'),
        c.voidCount, c.tp2Ordered
      ]);
      window.VMI.exportCsv(`vmi_preroll_store_category_matrix${repPrefix}.csv`, headers, rows);
    }
  }

  function round2(num) {
    return Math.round(Number(num) * 100) / 100;
  }
})();
