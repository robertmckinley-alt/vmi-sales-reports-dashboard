/**
 * report2.js
 * Logic for Page 2: 12-Week vs. 12-Week Preroll Performance & Latest 12wk Voids.
 * Exact executive schema match to Report 1 with Selectable Gain & Loss for all stores.
 */

(function () {
  let reportData = null;
  let activeTab = 'compare'; // 'compare' | 'tp1' | 'tp2' | 'voids'
  let activeFilter = 'all';  // 'all' | 'gainers' | 'decliners' | 'new' | 'lost' | 'vmi' | '1wt' | 'chain' | 'retained'
  let searchQuery = '';
  let currentPage = 1;
  let pageSize = 50;
  let sortCol = 'revDiff';
  let sortAsc = false; // Descending by default so top gainers show first

  // Sales Rep filtering state (Sales Reps Only - NO VMI-only reps)
  let selectedRep = '';
  let includeHouse = true;

  // Sales Rep table state
  let repSortCol = 'tp2Ordered';
  let repSortAsc = false;
  let consolidateReps = false;

  // Gainers vs Decliners view
  let gainersViewMode = 'gainers'; // 'gainers' | 'decliners' | 'new' | 'lost'

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
      renderGlSelector();
      populateCategoryDropdown();
      renderKpis();
      renderRepChart();
      renderGainersDeclinersChart();
      renderRepsTable();
      renderClientTableHead();
      renderClientTable();
      renderCategoryVoidsChart();
      renderRepsVoidsChart();
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

    if (voidRepSel) {
      const sortedReps = Array.from(new Set(reportData.clients.map(c => c.salesRep).filter(r => r && r !== 'Unassigned' && r !== '-'))).sort();
      voidRepSel.innerHTML = `<option value="">All Sales Reps</option>`;
      sortedReps.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        voidRepSel.appendChild(opt);
      });
    }
  }

  function setPrerollRepFilter(rep) {
    selectedRep = rep;

    // Update pills
    document.querySelectorAll('#prerollRepPillsContainer .rep-pill').forEach(pill => {
      const pRep = pill.getAttribute('data-prep');
      if (pRep === selectedRep) pill.classList.add('active');
      else pill.classList.remove('active');
    });

    // Synchronize top dropdown
    const topDropdown = document.getElementById('topRepSelect');
    const voidRepSel = document.getElementById('voidsRepSelect');
    if (topDropdown) topDropdown.value = selectedRep;
    if (voidRepSel) voidRepSel.value = selectedRep;

    // Update active badge in header
    const badge = document.getElementById('prerollActiveRepBadge');
    if (badge) {
      badge.textContent = selectedRep ? selectedRep : 'All Sales Reps';
      badge.className = `period-badge ${selectedRep ? 'tp1' : 'tp2'}`;
    }

    currentPage = 1;
    voidPage = 1;
    renderGlSelector();
    renderKpis();
    renderRepChart();
    renderGainersDeclinersChart();
    renderRepsTable();
    renderClientTable();
    renderCategoryVoidsChart();
    renderRepsVoidsChart();
    if (voidMode === 'roster') renderVoidRosterTable();
    else renderVoidMatrixTable();
  }

  function setGlFilter(filterKey) {
    activeFilter = filterKey;
    if (activeFilter === 'gainers' || activeFilter === 'new') {
      sortCol = 'revDiff';
      sortAsc = false;
    } else if (activeFilter === 'decliners' || activeFilter === 'lost') {
      sortCol = 'revDiff';
      sortAsc = true;
    }
    // Update active filter pills
    document.querySelectorAll('[data-cfilter]').forEach(p => {
      if (p.getAttribute('data-cfilter') === activeFilter) p.classList.add('active');
      else p.classList.remove('active');
    });
    currentPage = 1;
    renderGlSelector();
    renderClientTable();
  }

  function renderGlSelector() {
    const grid = document.getElementById('prerollGlGrid');
    const badge = document.getElementById('prerollActiveGlBadge');
    if (!grid) return;

    const scoped = reportData.clients.filter(matchesRepFilter);
    const totalCount = scoped.length;

    let gainCount = 0, gainRev = 0, gainOrd = 0, gainUnt = 0;
    let lossCount = 0, lossRev = 0, lossOrd = 0, lossUnt = 0;
    let newCount = 0, newRev = 0;
    let lostCount = 0, lostRev = 0;
    let retCount = 0, retDiff = 0;

    let totDiff = 0;

    scoped.forEach(c => {
      totDiff += c.revDiff;
      if (c.revDiff > 0) {
        gainCount++;
        gainRev += c.revDiff;
        gainOrd += c.orderDiff;
        gainUnt += c.unitDiff;
      } else if (c.revDiff < 0) {
        lossCount++;
        lossRev += c.revDiff;
        lossOrd += c.orderDiff;
        lossUnt += c.unitDiff;
      }

      if (c.accountStatus === 'NEW') {
        newCount++;
        newRev += c.tp2Ordered;
      } else if (c.accountStatus === 'CHURNED') {
        lostCount++;
        lostRev += c.tp1Ordered;
      } else {
        retCount++;
        retDiff += c.revDiff;
      }
    });

    gainRev = round2(gainRev);
    lossRev = round2(lossRev);
    newRev = round2(newRev);
    lostRev = round2(lostRev);
    totDiff = round2(totDiff);
    retDiff = round2(retDiff);

    if (badge) {
      const labelMap = {
        'all': `All Stores (${totalCount})`,
        'gainers': `Gains — Revenue Up (${gainCount})`,
        'decliners': `Losses — Revenue Down (${lossCount})`,
        'new': `Newly Gained [G] (${newCount})`,
        'lost': `Lost / Dropped [L] (${lostCount})`,
        'retained': `Retained Stores (${retCount})`
      };
      badge.textContent = labelMap[activeFilter] || `All Stores (${totalCount})`;
    }

    const cards = [
      {
        id: 'all',
        label: 'All Stores',
        count: totalCount,
        val: window.VMI.fmtSignedCurrency(totDiff),
        sub: `TP2 vs TP1 Net Revenue Delta`,
        activeClass: activeFilter === 'all' ? 'active' : ''
      },
      {
        id: 'gainers',
        label: 'All Store Gains (+)',
        count: gainCount,
        val: window.VMI.fmtSignedCurrency(gainRev),
        sub: `${window.VMI.fmtSignedInt(gainOrd)} Orders • ${window.VMI.fmtSignedInt(gainUnt)} Units`,
        activeClass: activeFilter === 'gainers' ? 'active gain' : ''
      },
      {
        id: 'decliners',
        label: 'All Store Losses (-)',
        count: lossCount,
        val: window.VMI.fmtSignedCurrency(lossRev),
        sub: `${window.VMI.fmtSignedInt(lossOrd)} Orders • ${window.VMI.fmtSignedInt(lossUnt)} Units`,
        activeClass: activeFilter === 'decliners' ? 'active loss' : ''
      },
      {
        id: 'new',
        label: 'New Accounts [G]',
        count: newCount,
        val: window.VMI.fmtCurrency(newRev),
        sub: `$0 in TP1 → Active in TP2`,
        activeClass: activeFilter === 'new' ? 'active gain' : ''
      },
      {
        id: 'lost',
        label: 'Lost Accounts [L]',
        count: lostCount,
        val: window.VMI.fmtCurrency(lostRev),
        sub: `Active in TP1 → $0 in TP2`,
        activeClass: activeFilter === 'lost' ? 'active loss' : ''
      },
      {
        id: 'retained',
        label: 'Retained Active Stores',
        count: retCount,
        val: window.VMI.fmtSignedCurrency(retDiff),
        sub: `Active in Both Periods`,
        activeClass: activeFilter === 'retained' ? 'active' : ''
      }
    ];

    let html = '';
    cards.forEach(card => {
      html += `
        <div class="gl-card ${card.activeClass}" data-prerollglfilter="${card.id}">
          <div class="gl-card-top">
            <span>${card.label}</span>
            <span class="gl-card-count">${card.count}</span>
          </div>
          <div class="gl-card-val ${card.id === 'gainers' || card.id === 'new' ? 'num-pos' : (card.id === 'decliners' || card.id === 'lost' ? 'num-neg' : '')}">${card.val}</div>
          <div class="gl-card-sub">${card.sub}</div>
        </div>
      `;
    });
    grid.innerHTML = html;
  }

  function renderKpis() {
    let tp1Orders = 0, tp1Rev = 0, tp1Units = 0;
    let tp2Orders = 0, tp2Rev = 0, tp2Units = 0;

    if (!selectedRep) {
      tp1Orders = reportData.tp1Total.orders;
      tp1Rev = reportData.tp1Total.ordered;
      tp1Units = reportData.tp1Total.units;
      tp2Orders = reportData.tp2Total.orders;
      tp2Rev = reportData.tp2Total.ordered;
      tp2Units = reportData.tp2Total.units;
    } else {
      const scoped = reportData.clients.filter(matchesRepFilter);
      scoped.forEach(c => {
        tp1Orders += c.tp1Orders;
        tp1Rev += c.tp1Ordered;
        tp1Units += c.tp1Units;
        tp2Orders += c.tp2Orders;
        tp2Rev += c.tp2Ordered;
        tp2Units += c.tp2Units;
      });
      tp1Rev = round2(tp1Rev);
      tp2Rev = round2(tp2Rev);
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

    // Store Gains vs. Losses Card
    let gCount = 0, lCount = 0, nCount = 0, cCount = 0;
    const scopedClients = reportData.clients.filter(matchesRepFilter);
    scopedClients.forEach(c => {
      if (c.revDiff > 0) gCount++;
      else if (c.revDiff < 0) lCount++;
      if (c.accountStatus === 'NEW') nCount++;
      else if (c.accountStatus === 'CHURNED') cCount++;
    });

    const scopedVoids = reportData.voids.filter(matchesVoidRepFilter);

    const elGain = document.getElementById('kpiPrerollGainersCount');
    const elLoss = document.getElementById('kpiPrerollLosersCount');
    const elNewDropped = document.getElementById('kpiPrerollNewDroppedText');
    const elStoreBadge = document.getElementById('kpiPrerollStoreCountBadge');
    const elVoidsBadge = document.getElementById('kpiPrerollVoidsBadge');

    if (elGain) elGain.textContent = `${gCount} Gainers (+)`;
    if (elLoss) elLoss.textContent = `${lCount} Losers (-)`;
    if (elNewDropped) elNewDropped.textContent = `${nCount} New [G] • ${cCount} Dropped [L]`;
    if (elStoreBadge) elStoreBadge.textContent = `${scopedClients.length} Stores`;
    if (elVoidsBadge) elVoidsBadge.textContent = `${window.VMI.fmtInt(scopedVoids.length)} Voids`;

    // Tab count badges
    const cmpCount = scopedClients.length;
    const tp1Count = (reportData.tp1Clients || []).filter(matchesRepFilter).length;
    const tp2Count = (reportData.tp2Clients || []).filter(matchesRepFilter).length;
    const vCount = scopedVoids.length;

    const bCmp = document.getElementById('badgePrerollCompareCount');
    const bTp1 = document.getElementById('badgePrerollTp1Count');
    const bTp2 = document.getElementById('badgePrerollTp2Count');
    const bVoids = document.getElementById('badgePrerollVoidsCount');

    if (bCmp) bCmp.textContent = window.VMI.fmtInt(cmpCount);
    if (bTp1) bTp1.textContent = window.VMI.fmtInt(tp1Count);
    if (bTp2) bTp2.textContent = window.VMI.fmtInt(tp2Count);
    if (bVoids) bVoids.textContent = window.VMI.fmtInt(vCount);
  }

  function renderRepChart() {
    const container = document.getElementById('prerollRepChartContainer');
    const repsBadge = document.getElementById('prerollRepChartBadge');
    if (!container) return;

    const reps = [...reportData.salesReps].sort((a, b) => b.tp2Ordered - a.tp2Ordered);
    const maxVal = Math.max(...reps.map(r => Math.max(r.tp1Ordered, r.tp2Ordered)), 1);

    if (repsBadge) repsBadge.textContent = `${reps.length} Rep / House Lines`;

    let html = '';
    reps.forEach(r => {
      const tp1Pct = ((r.tp1Ordered / maxVal) * 100).toFixed(1);
      const tp2Pct = ((r.tp2Ordered / maxVal) * 100).toFixed(1);
      const diffClass = r.revDiff >= 0 ? 'num-pos' : 'num-neg';
      const isSelected = selectedRep && (r.rep.toLowerCase() === selectedRep.toLowerCase() || r.baseRep.toLowerCase() === selectedRep.toLowerCase());
      const selectedStyle = isSelected ? 'background: rgba(6, 182, 212, 0.1); border-left: 3px solid var(--cyan-light); padding-left: 4px; border-radius: 4px;' : '';

      html += `
        <div class="chart-row" style="${selectedStyle} cursor: pointer;" data-repclick="${window.VMI.escapeHtml(r.baseRep)}">
          <div class="chart-row-meta">
            <span class="chart-row-label"><strong>${window.VMI.escapeHtml(r.rep)}</strong></span>
            <span class="chart-row-vals">
              <span>TP2: ${window.VMI.fmtCurrency(r.tp2Ordered)}</span>
              <span class="${diffClass}">(${window.VMI.fmtSignedCurrency(r.revDiff)})</span>
            </span>
          </div>
          <div class="bar-track" style="margin-bottom: 2px;">
            <div class="bar-fill tp2" style="width: ${tp2Pct}%;" title="TP2: ${window.VMI.fmtCurrency(r.tp2Ordered)}"></div>
          </div>
          <div class="bar-track">
            <div class="bar-fill tp1" style="width: ${tp1Pct}%;" title="TP1: ${window.VMI.fmtCurrency(r.tp1Ordered)}"></div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    container.querySelectorAll('[data-repclick]').forEach(el => {
      el.addEventListener('click', () => {
        const rep = el.getAttribute('data-repclick');
        setPrerollRepFilter(selectedRep === rep ? '' : rep);
      });
    });
  }

  function renderGainersDeclinersChart() {
    const container = document.getElementById('prerollGainersDeclinersChartContainer');
    if (!container) return;

    const filteredList = reportData.clients.filter(matchesRepFilter);

    let currentList = [];
    if (gainersViewMode === 'gainers') {
      currentList = [...filteredList].filter(c => c.revDiff > 0).sort((a, b) => b.revDiff - a.revDiff).slice(0, 10);
    } else if (gainersViewMode === 'decliners') {
      currentList = [...filteredList].filter(c => c.revDiff < 0).sort((a, b) => a.revDiff - b.revDiff).slice(0, 10);
    } else if (gainersViewMode === 'new') {
      currentList = [...filteredList].filter(c => c.accountStatus === 'NEW').sort((a, b) => b.tp2Ordered - a.tp2Ordered).slice(0, 10);
    } else if (gainersViewMode === 'lost') {
      currentList = [...filteredList].filter(c => c.accountStatus === 'CHURNED').sort((a, b) => b.tp1Ordered - a.tp1Ordered).slice(0, 10);
    }

    const maxAbsVal = Math.max(...currentList.map(c => Math.abs(c.revDiff || (c.accountStatus === 'NEW' ? c.tp2Ordered : c.tp1Ordered))), 1);

    let html = '';
    if (currentList.length === 0) {
      html = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No accounts match current filter.</div>`;
    } else {
      currentList.forEach(c => {
        const val = (gainersViewMode === 'new' && c.revDiff === 0) ? c.tp2Ordered : ((gainersViewMode === 'lost' && c.revDiff === 0) ? -c.tp1Ordered : c.revDiff);
        const pct = ((Math.abs(val) / maxAbsVal) * 100).toFixed(1);
        const isPos = val >= 0;
        const fillClass = isPos ? 'pos' : 'neg';
        const textClass = isPos ? 'num-pos' : 'num-neg';
        html += `
          <div class="chart-row">
            <div class="chart-row-meta">
              <span class="chart-row-label" title="${window.VMI.escapeHtml(c.client)}">${window.VMI.escapeHtml(c.client)}</span>
              <span class="chart-row-vals">
                <span class="${textClass}">${window.VMI.fmtSignedCurrency(val)}</span>
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

  function getProcessedReps() {
    let reps = [...reportData.salesReps];
    if (consolidateReps) {
      const consolidated = {};
      reps.forEach(r => {
        const base = r.baseRep;
        if (!consolidated[base]) {
          consolidated[base] = {
            rep: base,
            baseRep: base,
            role: 'Sales',
            isHouse: false,
            storeCount: 0,
            tp1Orders: 0,
            tp1Ordered: 0,
            tp1Units: 0,
            tp1Aov: 0,
            tp2Orders: 0,
            tp2Ordered: 0,
            tp2Units: 0,
            tp2Aov: 0,
            orderDiff: 0,
            revDiff: 0,
            unitDiff: 0,
            aovDiff: 0
          };
        }
        consolidated[base].storeCount += (r.storeCount || 0);
        consolidated[base].tp1Orders += r.tp1Orders;
        consolidated[base].tp1Ordered += r.tp1Ordered;
        consolidated[base].tp1Units += r.tp1Units;
        consolidated[base].tp2Orders += r.tp2Orders;
        consolidated[base].tp2Ordered += r.tp2Ordered;
        consolidated[base].tp2Units += r.tp2Units;
      });

      reps = Object.values(consolidated).map(c => {
        c.tp1Ordered = round2(c.tp1Ordered);
        c.tp2Ordered = round2(c.tp2Ordered);
        c.tp1Aov = c.tp1Orders ? round2(c.tp1Ordered / c.tp1Orders) : 0;
        c.tp2Aov = c.tp2Orders ? round2(c.tp2Ordered / c.tp2Orders) : 0;
        c.orderDiff = c.tp2Orders - c.tp1Orders;
        c.revDiff = round2(c.tp2Ordered - c.tp1Ordered);
        c.unitDiff = c.tp2Units - c.tp1Units;
        c.aovDiff = round2(c.tp2Aov - c.tp1Aov);
        return c;
      });
    }

    reps.sort((a, b) => {
      let v1 = a[repSortCol];
      let v2 = b[repSortCol];
      if (typeof v1 === 'string') {
        return repSortAsc ? v1.localeCompare(v2) : v2.localeCompare(v1);
      }
      return repSortAsc ? v1 - v2 : v2 - v1;
    });

    return reps;
  }

  function renderRepsTable() {
    const tbody = document.getElementById('prerollRepsTableBody');
    const tfoot = document.getElementById('prerollRepsTableFoot');
    if (!tbody || !tfoot) return;

    const reps = getProcessedReps();

    let bodyHtml = '';
    let totTp1Ord = 0, totTp1Rev = 0, totTp1Unt = 0;
    let totTp2Ord = 0, totTp2Rev = 0, totTp2Unt = 0;

    reps.forEach(r => {
      totTp1Ord += r.tp1Orders;
      totTp1Rev += r.tp1Ordered;
      totTp1Unt += r.tp1Units;
      totTp2Ord += r.tp2Orders;
      totTp2Rev += r.tp2Ordered;
      totTp2Unt += r.tp2Units;

      const orderDiffClass = r.orderDiff >= 0 ? 'num-pos' : 'num-neg';
      const revDiffClass = r.revDiff >= 0 ? 'num-pos' : 'num-neg';
      const unitDiffClass = r.unitDiff >= 0 ? 'num-pos' : 'num-neg';
      const aovDiffClass = r.aovDiff >= 0 ? 'num-pos' : 'num-neg';

      const isSelected = selectedRep && (r.rep.toLowerCase() === selectedRep.toLowerCase() || r.baseRep.toLowerCase() === selectedRep.toLowerCase());
      const selectedRowClass = isSelected ? 'style="background: rgba(6, 182, 212, 0.12);"' : '';

      bodyHtml += `
        <tr ${selectedRowClass}>
          <td>
            <a href="javascript:void(0)" class="rep-table-link" data-repselect="${window.VMI.escapeHtml(r.baseRep)}" style="font-weight: 700; color: var(--text-primary); text-decoration: underline;">
              ${window.VMI.escapeHtml(r.rep)}
            </a>
          </td>
          <td><span class="tag-badge ${r.isHouse ? 'tag-1wt' : 'tag-chain'}">${window.VMI.escapeHtml(r.role)}</span></td>
          <td class="text-right">${window.VMI.fmtInt(r.tp1Orders)}</td>
          <td class="text-right">${window.VMI.fmtCurrency(r.tp1Ordered)}</td>
          <td class="text-right">${window.VMI.fmtInt(r.tp1Units)}</td>
          <td class="text-right">${window.VMI.fmtCurrency(r.tp1Aov)}</td>
          <td class="text-right">${window.VMI.fmtInt(r.tp2Orders)}</td>
          <td class="text-right">${window.VMI.fmtCurrency(r.tp2Ordered)}</td>
          <td class="text-right">${window.VMI.fmtInt(r.tp2Units)}</td>
          <td class="text-right">${window.VMI.fmtCurrency(r.tp2Aov)}</td>
          <td class="text-right ${orderDiffClass}">${window.VMI.fmtSignedInt(r.orderDiff)}</td>
          <td class="text-right ${revDiffClass}">${window.VMI.fmtSignedCurrency(r.revDiff)}</td>
          <td class="text-right ${unitDiffClass}">${window.VMI.fmtSignedInt(r.unitDiff)}</td>
          <td class="text-right ${aovDiffClass}">${window.VMI.fmtSignedCurrency(r.aovDiff)}</td>
        </tr>
      `;
    });
    tbody.innerHTML = bodyHtml;

    tbody.querySelectorAll('[data-repselect]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const rName = el.getAttribute('data-repselect');
        setPrerollRepFilter(selectedRep === rName ? '' : rName);
      });
    });

    totTp1Rev = round2(totTp1Rev);
    totTp2Rev = round2(totTp2Rev);
    const totTp1Aov = totTp1Ord ? round2(totTp1Rev / totTp1Ord) : 0;
    const totTp2Aov = totTp2Ord ? round2(totTp2Rev / totTp2Ord) : 0;
    const totOrdDiff = totTp2Ord - totTp1Ord;
    const totRevDiff = round2(totTp2Rev - totTp1Rev);
    const totUntDiff = totTp2Unt - totTp1Unt;
    const totAovDiff = round2(totTp2Aov - totTp1Aov);

    tfoot.innerHTML = `
      <tr>
        <td><strong>Total Sales Reps:</strong></td>
        <td>${reps.length} lines</td>
        <td class="text-right">${window.VMI.fmtInt(totTp1Ord)}</td>
        <td class="text-right">${window.VMI.fmtCurrency(totTp1Rev)}</td>
        <td class="text-right">${window.VMI.fmtInt(totTp1Unt)}</td>
        <td class="text-right">${window.VMI.fmtCurrency(totTp1Aov)}</td>
        <td class="text-right">${window.VMI.fmtInt(totTp2Ord)}</td>
        <td class="text-right">${window.VMI.fmtCurrency(totTp2Rev)}</td>
        <td class="text-right">${window.VMI.fmtInt(totTp2Unt)}</td>
        <td class="text-right">${window.VMI.fmtCurrency(totTp2Aov)}</td>
        <td class="text-right ${totOrdDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedInt(totOrdDiff)}</td>
        <td class="text-right ${totRevDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedCurrency(totRevDiff)}</td>
        <td class="text-right ${totUntDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedInt(totUntDiff)}</td>
        <td class="text-right ${totAovDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedCurrency(totAovDiff)}</td>
      </tr>
    `;

    document.querySelectorAll('#prerollRepsTable th.sortable').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.getAttribute('data-col') === repSortCol) {
        th.classList.add(repSortAsc ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }

  function renderClientTableHead() {
    const thead = document.getElementById('prerollClientsTableHead');
    if (!thead) return;

    if (activeTab === 'compare') {
      thead.innerHTML = `
        <tr>
          <th class="sortable" data-col="client">Client Name <span class="sort-icon">↕</span></th>
          <th class="sortable" data-col="gl">G/L Status <span class="sort-icon">↕</span></th>
          <th class="sortable" data-col="salesRep">Sales Rep <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="tp1Orders">TP1 Orders <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="tp1Ordered">TP1 Rev <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="tp2Orders">TP2 Orders <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="tp2Ordered">TP2 Rev <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="orderDiff">Order Diff <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="revDiff">Rev Diff <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="unitDiff">Unit Diff <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="aveDiff">Ave Rev Diff <span class="sort-icon">↕</span></th>
        </tr>
      `;
    } else {
      const periodLabel = activeTab === 'tp1' ? 'TP1: 05/11/2026 – 08/02/2026' : 'TP2: 08/03/2026 – 11/29/2026';
      thead.innerHTML = `
        <tr>
          <th class="sortable" data-col="client">Client (${periodLabel}) <span class="sort-icon">↕</span></th>
          <th class="sortable" data-col="salesRep">Sales Rep <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="orders">Total Orders <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="ordered">Total Ordered <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="units">Total Units Ordered <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="aov">Average Order Value <span class="sort-icon">↕</span></th>
        </tr>
      `;
    }

    thead.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-col');
        if (sortCol === col) {
          sortAsc = !sortAsc;
        } else {
          sortCol = col;
          sortAsc = col === 'client' || col === 'salesRep';
        }
        currentPage = 1;
        renderClientTable();
      });
    });
  }

  function getFilteredClientList() {
    let list = [];
    if (activeTab === 'compare') {
      list = reportData.clients;
    } else if (activeTab === 'tp1') {
      list = reportData.tp1Clients || [];
    } else {
      list = reportData.tp2Clients || [];
    }

    let filtered = list.filter(item => {
      // Sales Rep Filter
      if (!matchesRepFilter(item)) return false;

      // Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const clientMatch = item.client.toLowerCase().includes(q);
        const repMatch = item.salesRep && item.salesRep.toLowerCase().includes(q);
        const chainMatch = item.chainCode && item.chainCode.toLowerCase().includes(q);
        if (!clientMatch && !repMatch && !chainMatch) return false;
      }

      // Tag & G/L filter
      if (activeFilter === 'vmi' && !item.isVmi) return false;
      if (activeFilter === '1wt' && !item.is1Wt) return false;
      if (activeFilter === 'chain' && !item.chainCode) return false;
      if (activeFilter === 'gainers') {
        const diff = item.revDiff !== undefined ? item.revDiff : 0;
        if (diff <= 0) return false;
      }
      if (activeFilter === 'decliners') {
        const diff = item.revDiff !== undefined ? item.revDiff : 0;
        if (diff >= 0) return false;
      }
      if (activeFilter === 'new' && item.accountStatus !== 'NEW') return false;
      if (activeFilter === 'lost' && item.accountStatus !== 'CHURNED') return false;
      if (activeFilter === 'retained' && item.accountStatus !== 'RETAINED') return false;

      return true;
    });

    filtered.sort((a, b) => {
      let v1 = a[sortCol];
      let v2 = b[sortCol];
      if (sortCol === 'gl') {
        v1 = a.revDiff !== undefined ? a.revDiff : 0;
        v2 = b.revDiff !== undefined ? b.revDiff : 0;
      }
      if (v1 === undefined) v1 = 0;
      if (v2 === undefined) v2 = 0;
      if (typeof v1 === 'string') {
        return sortAsc ? v1.localeCompare(v2) : v2.localeCompare(v1);
      }
      return sortAsc ? v1 - v2 : v2 - v1;
    });

    return filtered;
  }

  function renderClientTable() {
    const tbody = document.getElementById('prerollClientsTableBody');
    const tfoot = document.getElementById('prerollClientsTableFoot');
    if (!tbody || !tfoot) return;

    const filtered = getFilteredClientList();
    const totalCount = filtered.length;

    let startIdx = 0;
    let endIdx = totalCount;
    if (pageSize !== 'all') {
      const pSize = parseInt(pageSize, 10);
      const maxPages = Math.ceil(totalCount / pSize) || 1;
      if (currentPage > maxPages) currentPage = maxPages;
      if (currentPage < 1) currentPage = 1;
      startIdx = (currentPage - 1) * pSize;
      endIdx = Math.min(startIdx + pSize, totalCount);
    }
    const visibleRows = filtered.slice(startIdx, endIdx);

    updateClientPaginationUI(totalCount, startIdx, endIdx);

    let html = '';
    if (visibleRows.length === 0) {
      const colSpan = activeTab === 'compare' ? 11 : 6;
      html = `<tr><td colspan="${colSpan}" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matching client records found.</td></tr>`;
    } else {
      visibleRows.forEach(r => {
        const badges = window.VMI.renderClientBadges(r);
        const repTag = `<span class="tag-badge tag-rep">${window.VMI.escapeHtml(r.salesRep || 'Unassigned')}</span>`;

        if (activeTab === 'compare') {
          const ordClass = r.orderDiff >= 0 ? 'num-pos' : 'num-neg';
          const revClass = r.revDiff >= 0 ? 'num-pos' : 'num-neg';
          const untClass = r.unitDiff >= 0 ? 'num-pos' : 'num-neg';
          const aovClass = r.aveDiff >= 0 ? 'num-pos' : 'num-neg';

          let mismatchTag = '';
          if (r.clientMismatch) {
            mismatchTag = `<span class="tag-badge tag-mismatch" title="TP1: ${r.tp1Client} ↔ TP2: ${r.tp2Client}">TP1: ${window.VMI.escapeHtml(r.tp1Client)} ↔ TP2: ${window.VMI.escapeHtml(r.tp2Client)}</span>`;
          }

          html += `
            <tr>
              <td>
                <div style="font-weight: 600;">${window.VMI.escapeHtml(r.client)}</div>
                <div>${badges} ${mismatchTag}</div>
              </td>
              <td>${window.VMI.renderGlBadge(r)}</td>
              <td>${repTag}</td>
              <td class="text-right">${window.VMI.fmtInt(r.tp1Orders)}</td>
              <td class="text-right">${window.VMI.fmtCurrency(r.tp1Ordered)}</td>
              <td class="text-right">${window.VMI.fmtInt(r.tp2Orders)}</td>
              <td class="text-right">${window.VMI.fmtCurrency(r.tp2Ordered)}</td>
              <td class="text-right ${ordClass}">${window.VMI.fmtSignedInt(r.orderDiff)}</td>
              <td class="text-right ${revClass}">${window.VMI.fmtSignedCurrency(r.revDiff)}</td>
              <td class="text-right ${untClass}">${window.VMI.fmtSignedInt(r.unitDiff)}</td>
              <td class="text-right ${aovClass}">${window.VMI.fmtSignedCurrency(r.aveDiff)}</td>
            </tr>
          `;
        } else {
          html += `
            <tr>
              <td>
                <div style="font-weight: 600;">${window.VMI.escapeHtml(r.client)}</div>
                <div>${badges}</div>
              </td>
              <td>${repTag}</td>
              <td class="text-right">${window.VMI.fmtInt(r.orders)}</td>
              <td class="text-right">${window.VMI.fmtCurrency(r.ordered)}</td>
              <td class="text-right">${window.VMI.fmtInt(r.units)}</td>
              <td class="text-right">${window.VMI.fmtCurrency(r.aov)}</td>
            </tr>
          `;
        }
      });
    }
    tbody.innerHTML = html;

    // Sticky totals footer
    let fTp1Ord = 0, fTp1Rev = 0, fTp2Ord = 0, fTp2Rev = 0, fUntDiff = 0;
    filtered.forEach(r => {
      if (activeTab === 'compare') {
        fTp1Ord += r.tp1Orders;
        fTp1Rev += r.tp1Ordered;
        fTp2Ord += r.tp2Orders;
        fTp2Rev += r.tp2Ordered;
        fUntDiff += r.unitDiff;
      } else {
        fTp1Ord += r.orders;
        fTp1Rev += r.ordered;
        fUntDiff += r.units;
      }
    });

    fTp1Rev = round2(fTp1Rev);
    fTp2Rev = round2(fTp2Rev);

    if (activeTab === 'compare') {
      const fOrdDiff = fTp2Ord - fTp1Ord;
      const fRevDiff = round2(fTp2Rev - fTp1Rev);
      const fTp1Aov = fTp1Ord ? round2(fTp1Rev / fTp1Ord) : 0;
      const fTp2Aov = fTp2Ord ? round2(fTp2Rev / fTp2Ord) : 0;
      const fAovDiff = round2(fTp2Aov - fTp1Aov);

      const label = (selectedRep || activeFilter !== 'all' || searchQuery) ? `Filtered Total (${totalCount} stores):` : `Total 12 v 12 compare (${totalCount} stores):`;

      tfoot.innerHTML = `
        <tr>
          <td><strong>${label}</strong></td>
          <td>-</td>
          <td>-</td>
          <td class="text-right">${window.VMI.fmtInt(fTp1Ord)}</td>
          <td class="text-right">${window.VMI.fmtCurrency(fTp1Rev)}</td>
          <td class="text-right">${window.VMI.fmtInt(fTp2Ord)}</td>
          <td class="text-right">${window.VMI.fmtCurrency(fTp2Rev)}</td>
          <td class="text-right ${fOrdDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedInt(fOrdDiff)}</td>
          <td class="text-right ${fRevDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedCurrency(fRevDiff)}</td>
          <td class="text-right ${fUntDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedInt(fUntDiff)}</td>
          <td class="text-right ${fAovDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedCurrency(fAovDiff)}</td>
        </tr>
      `;
    } else {
      const fAov = fTp1Ord ? round2(fTp1Rev / fTp1Ord) : 0;
      const label = (selectedRep || activeFilter !== 'all' || searchQuery) ? `Filtered Total (${totalCount} stores):` : `Total (${totalCount} stores):`;
      tfoot.innerHTML = `
        <tr>
          <td><strong>${label}</strong></td>
          <td>-</td>
          <td class="text-right">${window.VMI.fmtInt(fTp1Ord)}</td>
          <td class="text-right">${window.VMI.fmtCurrency(fTp1Rev)}</td>
          <td class="text-right">${window.VMI.fmtInt(fUntDiff)}</td>
          <td class="text-right">${window.VMI.fmtCurrency(fAov)}</td>
        </tr>
      `;
    }

    document.querySelectorAll('#prerollClientsTableHead th.sortable').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.getAttribute('data-col') === sortCol) {
        th.classList.add(sortAsc ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }

  function updateClientPaginationUI(totalCount, startIdx, endIdx) {
    const info = document.getElementById('prerollPaginationInfo');
    const btnContainer = document.getElementById('prerollPaginationButtons');
    if (!info || !btnContainer) return;

    if (totalCount === 0) {
      info.textContent = 'Showing 0 of 0 rows';
      btnContainer.innerHTML = '';
      return;
    }

    info.textContent = `Showing ${startIdx + 1} to ${endIdx} of ${totalCount} rows`;

    if (pageSize === 'all') {
      btnContainer.innerHTML = '';
      return;
    }

    const pSize = parseInt(pageSize, 10);
    const totalPages = Math.ceil(totalCount / pSize);
    let btns = '';

    btns += `<button class="btn btn-secondary" ${currentPage === 1 ? 'disabled style="opacity:0.4;"' : ''} id="btnClientPrev">« Prev</button>`;
    btns += `<span style="padding: 0 0.5rem; font-weight: 600;">Page ${currentPage} of ${totalPages}</span>`;
    btns += `<button class="btn btn-secondary" ${currentPage === totalPages ? 'disabled style="opacity:0.4;"' : ''} id="btnClientNext">Next »</button>`;

    btnContainer.innerHTML = btns;

    const btnPrev = document.getElementById('btnClientPrev');
    const btnNext = document.getElementById('btnClientNext');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          renderClientTable();
        }
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderClientTable();
        }
      });
    }
  }

  // ================= VIEW 2: VOIDS LOGIC =================
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

  function renderCategoryVoidsChart() {
    const container = document.getElementById('categoryVoidsChartContainer');
    if (!container) return;

    const cats = reportData.categoriesSummary;
    const maxVal = Math.max(...cats.map(c => c.storeCount), 1);

    let html = '';
    cats.forEach(c => {
      const pct = ((c.storeCount / maxVal) * 100).toFixed(1);
      html += `
        <div class="chart-row">
          <div class="chart-row-meta">
            <span class="chart-row-label" title="${window.VMI.escapeHtml(c.category)}">${window.VMI.escapeHtml(c.category)}</span>
            <span class="chart-row-vals">
              <span class="num-neg">${c.storeCount} stores</span>
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
    if (!container) return;

    const reps = reportData.repsVoidSummary;
    const maxVal = Math.max(...reps.map(r => r.voidCount), 1);

    let html = '';
    reps.forEach(r => {
      const pct = ((r.voidCount / maxVal) * 100).toFixed(1);
      const isSelected = selectedRep && (r.rep.toLowerCase() === selectedRep.toLowerCase() || r.baseRep.toLowerCase() === selectedRep.toLowerCase());
      const selectedStyle = isSelected ? 'background: rgba(6, 182, 212, 0.1); border-left: 3px solid var(--cyan-light); padding-left: 4px; border-radius: 4px;' : '';

      html += `
        <div class="chart-row" style="${selectedStyle} cursor: pointer;" data-voidrepclick="${window.VMI.escapeHtml(r.baseRep)}">
          <div class="chart-row-meta">
            <span class="chart-row-label"><strong>${window.VMI.escapeHtml(r.rep)}</strong></span>
            <span class="chart-row-vals">
              <span class="num-neg">${r.voidCount} voids</span>
              <span style="color: var(--text-muted); font-size: 0.75rem;">(${r.uniqueStores} stores)</span>
            </span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%; background: var(--amber);"></div>
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
    if (!tbody || !tfoot) return;

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
    if (!thead) return;

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
    if (!tbody || !tfoot) return;

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
        return voidMatrixSortAsc ? sA.localeCompare(sB) : sB.localeCompare(vA);
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
    if (!info || !btnContainer) return;

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
          currentPage = 1;
          renderGlSelector();
          renderKpis();
          renderRepChart();
          renderGainersDeclinersChart();
          renderClientTable();
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

    // G/L Selector Cards
    const glGrid = document.getElementById('prerollGlGrid');
    if (glGrid) {
      glGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.gl-card');
        if (!card) return;
        const filterId = card.getAttribute('data-prerollglfilter');
        setGlFilter(filterId);
      });
    }

    const btnResetGl = document.getElementById('btnPrerollResetGlFilter');
    if (btnResetGl) {
      btnResetGl.addEventListener('click', () => {
        setGlFilter('all');
      });
    }

    // Primary View Tabs (Compare, TP1, TP2, Voids)
    document.querySelectorAll('.tabs-bar .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tabs-bar .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.getAttribute('data-tab');

        const viewClients = document.getElementById('viewClientsSection');
        const viewVoids = document.getElementById('viewVoidsSection');

        if (activeTab === 'voids') {
          if (viewClients) viewClients.style.display = 'none';
          if (viewVoids) viewVoids.style.display = 'block';
          if (voidMode === 'roster') renderVoidRosterTable();
          else renderVoidMatrixTable();
        } else {
          if (viewClients) viewClients.style.display = 'block';
          if (viewVoids) viewVoids.style.display = 'none';
          sortCol = activeTab === 'compare' ? 'revDiff' : 'ordered';
          sortAsc = false;
          currentPage = 1;
          renderClientTableHead();
          renderClientTable();
        }
      });
    });

    // Chart toggles (Gainers, Decliners, New, Lost)
    const btnGainers = document.getElementById('btnGainersToggle');
    const btnDecliners = document.getElementById('btnDeclinersToggle');
    const btnNew = document.getElementById('btnNewToggle');
    const btnLost = document.getElementById('btnLostToggle');
    const chartBtns = [btnGainers, btnDecliners, btnNew, btnLost].filter(Boolean);

    function updateChartBtnStates(activeBtn) {
      chartBtns.forEach(b => {
        if (b === activeBtn) {
          b.classList.add('btn-primary');
          b.classList.remove('btn-secondary');
        } else {
          b.classList.add('btn-secondary');
          b.classList.remove('btn-primary');
        }
      });
    }

    if (btnGainers) {
      btnGainers.addEventListener('click', () => {
        gainersViewMode = 'gainers';
        updateChartBtnStates(btnGainers);
        renderGainersDeclinersChart();
      });
    }
    if (btnDecliners) {
      btnDecliners.addEventListener('click', () => {
        gainersViewMode = 'decliners';
        updateChartBtnStates(btnDecliners);
        renderGainersDeclinersChart();
      });
    }
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        gainersViewMode = 'new';
        updateChartBtnStates(btnNew);
        renderGainersDeclinersChart();
      });
    }
    if (btnLost) {
      btnLost.addEventListener('click', () => {
        gainersViewMode = 'lost';
        updateChartBtnStates(btnLost);
        renderGainersDeclinersChart();
      });
    }

    // Rep Consolidate Checkbox
    const chkConsolidate = document.getElementById('chkPrerollConsolidateReps');
    if (chkConsolidate) {
      chkConsolidate.addEventListener('change', (e) => {
        consolidateReps = e.target.checked;
        renderRepsTable();
      });
    }

    // Rep Table Header Sort
    document.querySelectorAll('#prerollRepsTable th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-col');
        if (repSortCol === col) {
          repSortAsc = !repSortAsc;
        } else {
          repSortCol = col;
          repSortAsc = col === 'rep';
        }
        renderRepsTable();
      });
    });

    // Client Filter Pills
    document.querySelectorAll('[data-cfilter]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('[data-cfilter]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeFilter = pill.getAttribute('data-cfilter');
        if (activeFilter === 'gainers' || activeFilter === 'new') {
          sortCol = 'revDiff';
          sortAsc = false;
        } else if (activeFilter === 'decliners' || activeFilter === 'lost') {
          sortCol = 'revDiff';
          sortAsc = true;
        }
        currentPage = 1;
        renderGlSelector();
        renderClientTable();
      });
    });

    // Client Search
    const prerollSearch = document.getElementById('prerollSearchInput');
    if (prerollSearch) {
      prerollSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        currentPage = 1;
        renderClientTable();
      });
    }

    // Client Page Size
    const prerollPageSize = document.getElementById('prerollPageSizeSelect');
    if (prerollPageSize) {
      prerollPageSize.addEventListener('change', (e) => {
        pageSize = e.target.value;
        currentPage = 1;
        renderClientTable();
      });
    }

    // Void Mode Toggle
    const btnVoidRoster = document.getElementById('btnVoidModeRoster');
    const btnVoidMatrix = document.getElementById('btnVoidModeMatrix');
    if (btnVoidRoster && btnVoidMatrix) {
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
    }

    // Void Search & Filters
    const voidSearch = document.getElementById('voidsSearchInput');
    if (voidSearch) {
      voidSearch.addEventListener('input', (e) => {
        voidSearchQuery = e.target.value.trim();
        voidPage = 1;
        if (voidMode === 'roster') renderVoidRosterTable();
        else renderVoidMatrixTable();
      });
    }

    const voidCatSel = document.getElementById('voidsCategorySelect');
    if (voidCatSel) {
      voidCatSel.addEventListener('change', (e) => {
        voidCategoryFilter = e.target.value;
        voidPage = 1;
        if (voidMode === 'roster') renderVoidRosterTable();
        else renderVoidMatrixTable();
      });
    }

    const voidPageSizeSel = document.getElementById('voidsPageSizeSelect');
    if (voidPageSizeSel) {
      voidPageSizeSel.addEventListener('change', (e) => {
        voidPageSize = e.target.value;
        voidPage = 1;
        if (voidMode === 'roster') renderVoidRosterTable();
        else renderVoidMatrixTable();
      });
    }

    const voidRepSel = document.getElementById('voidsRepSelect');
    if (voidRepSel) {
      voidRepSel.addEventListener('change', (e) => {
        setPrerollRepFilter(e.target.value);
      });
    }

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
    const btnExpClients = document.getElementById('btnExportPrerollClients');
    if (btnExpClients) btnExpClients.addEventListener('click', exportPrerollClientsCsv);

    const btnExpReps = document.getElementById('btnExportPrerollReps');
    if (btnExpReps) btnExpReps.addEventListener('click', exportPrerollRepsCsv);

    const btnExpVoids = document.getElementById('btnExportVoids');
    if (btnExpVoids) btnExpVoids.addEventListener('click', exportVoidsCsv);

    const btnExpActive = document.getElementById('btnExportActiveTable');
    if (btnExpActive) {
      btnExpActive.addEventListener('click', () => {
        if (activeTab === 'voids') exportVoidsCsv();
        else exportPrerollClientsCsv();
      });
    }
  }

  function exportPrerollRepsCsv() {
    const reps = getProcessedReps();
    const headers = [
      'Sales Rep', 'Role', 'TP1 Orders', 'TP1 Revenue', 'TP1 Units', 'TP1 AOV',
      'TP2 Orders', 'TP2 Revenue', 'TP2 Units', 'TP2 AOV',
      'Order Diff', 'Rev Diff', 'Unit Diff', 'AOV Diff'
    ];
    const rows = reps.map(r => [
      r.rep, r.role, r.tp1Orders, r.tp1Ordered, r.tp1Units, r.tp1Aov,
      r.tp2Orders, r.tp2Ordered, r.tp2Units, r.tp2Aov,
      r.orderDiff, r.revDiff, r.unitDiff, r.aovDiff
    ]);
    window.VMI.exportCsv('vmi_preroll_sales_reps.csv', headers, rows);
  }

  function exportPrerollClientsCsv() {
    const list = getFilteredClientList();
    const repPrefix = selectedRep ? `_${selectedRep.replace(/\s+/g, '_')}` : '';
    if (activeTab === 'compare') {
      const headers = [
        'Client', 'G/L Status', 'Account Status', 'Sales Rep', 'Chain Code', 'Is VMI', 'Is 1WT',
        'TP1 Orders', 'TP1 Revenue', 'TP1 Units', 'TP1 AOV',
        'TP2 Orders', 'TP2 Revenue', 'TP2 Units', 'TP2 AOV',
        'Order Diff', 'Rev Diff', 'Unit Diff', 'Ave Rev Diff'
      ];
      const rows = list.map(c => [
        c.client, c.gl || '', c.accountStatus || 'RETAINED', c.salesRep || 'Unassigned', c.chainCode || '', c.isVmi ? 'YES' : 'NO', c.is1Wt ? 'YES' : 'NO',
        c.tp1Orders, c.tp1Ordered, c.tp1Units, c.tp1Aov,
        c.tp2Orders, c.tp2Ordered, c.tp2Units, c.tp2Aov,
        c.orderDiff, c.revDiff, c.unitDiff, c.aveDiff
      ]);
      window.VMI.exportCsv(`vmi_preroll_compare_clients${repPrefix}_${activeFilter}.csv`, headers, rows);
    } else {
      const pName = activeTab === 'tp1' ? 'tp1' : 'tp2';
      const headers = ['Client', 'Sales Rep', 'Chain Code', 'Is VMI', 'Is 1WT', 'Total Orders', 'Total Ordered', 'Total Units', 'Average Order Value'];
      const rows = list.map(c => [
        c.client, c.salesRep || 'Unassigned', c.chainCode || '', c.isVmi ? 'YES' : 'NO', c.is1Wt ? 'YES' : 'NO',
        c.orders, c.ordered, c.units, c.aov
      ]);
      window.VMI.exportCsv(`vmi_preroll_${pName}_clients${repPrefix}.csv`, headers, rows);
    }
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
