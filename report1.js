/**
 * report1.js
 * Logic for Page 1: 13-Week vs. 13-Week Client & Rep Order Comparison.
 * Supports verified math across all 412 union clients and prominent Sales-Rep-only filtering.
 */

(function () {
  let reportData = null;
  let activeTab = 'compare'; // 'compare' | 'tp1' | 'tp2'
  let activeFilter = 'all';  // 'all' | 'vmi' | '1wt' | 'chain' | 'gainers' | 'decliners'
  let searchQuery = '';
  let currentPage = 1;
  let pageSize = 50;
  let sortCol = 'revDiff';
  let sortAsc = false;

  // Sales Rep filtering state (Sales Reps Only - NO VMI-only reps)
  let selectedRep = '';
  let includeHouse = true;

  // Sales Rep table state
  let repSortCol = 'tp2Ordered';
  let repSortAsc = false;
  let consolidateReps = false;

  // Gainers vs Decliners view
  let gainersViewMode = 'gainers'; // 'gainers' | 'decliners'

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      const data = await window.VMI.loadData();
      reportData = data.report1;
      populateRepSelector();
      renderKpis();
      renderRepChart();
      renderGainersDeclinersChart();
      renderRepsTable();
      renderClientTableHead();
      renderClientTable();
      bindEvents();
    } catch (err) {
      console.error('Failed to initialize Report 1:', err);
    }
  }

  // Check if a client record matches the active Sales Rep filter
  function matchesRepFilter(c) {
    if (!selectedRep) return true;
    if (includeHouse) {
      return (c.baseSalesRep && c.baseSalesRep.toLowerCase() === selectedRep.toLowerCase()) ||
             (c.salesRep && c.salesRep.toLowerCase() === selectedRep.toLowerCase());
    } else {
      return c.salesRep && c.salesRep.toLowerCase() === selectedRep.toLowerCase();
    }
  }

  function populateRepSelector() {
    const pillsContainer = document.getElementById('repPillsContainer');
    const dropdown = document.getElementById('repDropdownSelect');
    if (!pillsContainer || !dropdown) return;

    // Available Sales Reps from data (Sales Reps Only)
    const availableReps = reportData.availableSalesReps || [
      'Scotland Schieber',
      'Jeremy Schmidt',
      'Ashlea Underwood',
      'Danny Thoren',
      'Caitlin Stoner',
      'Nancy Drinkard WA',
      'Johnny Wilson'
    ];

    // Compute store counts for each rep
    const counts = {};
    reportData.compareClients.forEach(c => {
      const b = c.baseSalesRep;
      if (b) counts[b] = (counts[b] || 0) + 1;
    });

    // 1. Build pills
    let pillsHtml = `
      <button class="rep-pill ${selectedRep === '' ? 'active' : ''}" data-rep="">
        <span>All Sales Reps</span>
        <span class="rep-pill-count">${reportData.compareClients.length}</span>
      </button>
    `;

    availableReps.forEach(rep => {
      const cnt = counts[rep] || 0;
      pillsHtml += `
        <button class="rep-pill ${selectedRep === rep ? 'active' : ''}" data-rep="${window.VMI.escapeHtml(rep)}">
          <span>${window.VMI.escapeHtml(rep)}</span>
          <span class="rep-pill-count">${cnt}</span>
        </button>
      `;
    });
    pillsContainer.innerHTML = pillsHtml;

    // 2. Build dropdown
    let dropdownHtml = `<option value="">All Sales Reps (Full Company)</option>`;
    dropdownHtml += `<optgroup label="Consolidated Sales Reps (Full Book)">`;
    availableReps.forEach(rep => {
      dropdownHtml += `<option value="${window.VMI.escapeHtml(rep)}">${window.VMI.escapeHtml(rep)} (${counts[rep] || 0} stores)</option>`;
    });
    dropdownHtml += `</optgroup>`;

    // Add exact lines (including House lines)
    const exactLines = new Set();
    reportData.compareClients.forEach(c => {
      if (c.salesRep && c.salesRep !== 'Unassigned') exactLines.add(c.salesRep);
    });
    dropdownHtml += `<optgroup label="Exact Territory / House Lines">`;
    Array.from(exactLines).sort().forEach(line => {
      dropdownHtml += `<option value="${window.VMI.escapeHtml(line)}">${window.VMI.escapeHtml(line)}</option>`;
    });
    dropdownHtml += `</optgroup>`;
    dropdown.innerHTML = dropdownHtml;
  }

  function setRepFilter(rep) {
    selectedRep = rep;

    // Update active pill
    document.querySelectorAll('#repPillsContainer .rep-pill').forEach(pill => {
      const pRep = pill.getAttribute('data-rep');
      if (pRep === selectedRep) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    // Update dropdown
    const dropdown = document.getElementById('repDropdownSelect');
    if (dropdown) dropdown.value = selectedRep;

    // Update badge in selector header
    const badge = document.getElementById('activeRepBadge');
    if (badge) {
      badge.textContent = selectedRep ? selectedRep : 'All Sales Reps';
      badge.className = `period-badge ${selectedRep ? 'tp1' : 'tp2'}`;
    }

    currentPage = 1;
    renderKpis();
    renderRepChart();
    renderGainersDeclinersChart();
    renderRepsTable();
    renderClientTable();
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
      const scoped = reportData.compareClients.filter(matchesRepFilter);
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
    document.getElementById('kpiOrdersTP2').textContent = window.VMI.fmtInt(tp2Orders);
    document.getElementById('kpiOrdersTP1').textContent = window.VMI.fmtInt(tp1Orders);
    document.getElementById('kpiOrdersDelta').textContent = `${window.VMI.fmtSignedInt(orderDiff)} (${window.VMI.fmtPct(ordPct)})`;
    document.getElementById('kpiOrdersDelta').className = `delta-badge ${orderDiff >= 0 ? 'pos' : 'neg'}`;
    document.getElementById('kpiOrdersDiffText').textContent = `${window.VMI.fmtSignedInt(orderDiff)} diff`;

    // Revenue
    const revPct = tp1Rev ? ((tp2Rev - tp1Rev) / tp1Rev) * 100 : 0;
    document.getElementById('kpiRevTP2').textContent = window.VMI.fmtCurrency(tp2Rev);
    document.getElementById('kpiRevTP1').textContent = window.VMI.fmtCurrency(tp1Rev);
    document.getElementById('kpiRevDelta').textContent = `${window.VMI.fmtSignedCurrency(revDiff)} (${window.VMI.fmtPct(revPct)})`;
    document.getElementById('kpiRevDelta').className = `delta-badge ${revDiff >= 0 ? 'pos' : 'neg'}`;
    document.getElementById('kpiRevDiffText').textContent = window.VMI.fmtSignedCurrency(revDiff);

    // Units
    const unitPct = tp1Units ? ((tp2Units - tp1Units) / tp1Units) * 100 : 0;
    document.getElementById('kpiUnitsTP2').textContent = window.VMI.fmtInt(tp2Units);
    document.getElementById('kpiUnitsTP1').textContent = window.VMI.fmtInt(tp1Units);
    document.getElementById('kpiUnitsDelta').textContent = `${window.VMI.fmtSignedInt(unitDiff)} (${window.VMI.fmtPct(unitPct)})`;
    document.getElementById('kpiUnitsDelta').className = `delta-badge ${unitDiff >= 0 ? 'pos' : 'neg'}`;
    document.getElementById('kpiUnitsDiffText').textContent = `${window.VMI.fmtSignedInt(unitDiff)} diff`;

    // AOV
    const aovPct = tp1Aov ? ((tp2Aov - tp1Aov) / tp1Aov) * 100 : 0;
    document.getElementById('kpiAovTP2').textContent = window.VMI.fmtCurrency(tp2Aov);
    document.getElementById('kpiAovTP1').textContent = window.VMI.fmtCurrency(tp1Aov);
    document.getElementById('kpiAovDelta').textContent = `${window.VMI.fmtSignedCurrency(aovDiff)} (${window.VMI.fmtPct(aovPct)})`;
    document.getElementById('kpiAovDelta').className = `delta-badge ${aovDiff >= 0 ? 'pos' : 'neg'}`;
    document.getElementById('kpiAovDiffText').textContent = window.VMI.fmtSignedCurrency(aovDiff);

    // Tab count badges (scoped to selectedRep if active)
    const cmpCount = reportData.compareClients.filter(matchesRepFilter).length;
    const tp1Count = reportData.tp1Clients.filter(matchesRepFilter).length;
    const tp2Count = reportData.tp2Clients.filter(matchesRepFilter).length;

    document.getElementById('badgeCompareCount').textContent = window.VMI.fmtInt(cmpCount);
    document.getElementById('badgeTp1Count').textContent = window.VMI.fmtInt(tp1Count);
    document.getElementById('badgeTp2Count').textContent = window.VMI.fmtInt(tp2Count);
  }

  function renderRepChart() {
    const container = document.getElementById('repChartContainer');
    const reps = [...reportData.salesReps].sort((a, b) => b.tp2Ordered - a.tp2Ordered);
    const maxVal = Math.max(...reps.map(r => Math.max(r.tp1Ordered, r.tp2Ordered)), 1);

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

    // Rep row click to filter
    container.querySelectorAll('[data-repclick]').forEach(el => {
      el.addEventListener('click', () => {
        const rep = el.getAttribute('data-repclick');
        setRepFilter(selectedRep === rep ? '' : rep);
      });
    });
  }

  function renderGainersDeclinersChart() {
    const container = document.getElementById('gainersDeclinersChartContainer');
    const filteredList = reportData.compareClients.filter(matchesRepFilter);
    const sorted = [...filteredList].sort((a, b) => b.revDiff - a.revDiff);
    const gainers = sorted.slice(0, 10);
    const decliners = sorted.slice(-10).reverse();

    const currentList = gainersViewMode === 'gainers' ? gainers : decliners;
    const maxAbsVal = Math.max(...currentList.map(c => Math.abs(c.revDiff)), 1);

    let html = '';
    if (currentList.length === 0) {
      html = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No accounts match current filter.</div>`;
    } else {
      currentList.forEach(c => {
        const pct = ((Math.abs(c.revDiff) / maxAbsVal) * 100).toFixed(1);
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
    const tbody = document.getElementById('repsTableBody');
    const tfoot = document.getElementById('repsTableFoot');
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

    // Attach click to rep name links in table
    tbody.querySelectorAll('[data-repselect]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const rName = el.getAttribute('data-repselect');
        setRepFilter(selectedRep === rName ? '' : rName);
      });
    });

    // TFoot totals
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

    // Highlight active sort header
    document.querySelectorAll('#repsTable th.sortable').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.getAttribute('data-col') === repSortCol) {
        th.classList.add(repSortAsc ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }

  function renderClientTableHead() {
    const thead = document.getElementById('clientsTableHead');
    if (activeTab === 'compare') {
      thead.innerHTML = `
        <tr>
          <th class="sortable" data-col="client">Client Name <span class="sort-icon">↕</span></th>
          <th class="sortable" data-col="salesRep">Sales Rep <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="tp1Orders">TP1 Orders <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="tp1Ordered">TP1 Rev <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="tp2Orders">TP2 Orders <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="tp2Ordered">TP2 Rev <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="orderDiff">Order Diff <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="revDiff">Rev Diff <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="unitDiff">Unit Diff <span class="sort-icon">↕</span></th>
          <th class="sortable text-right" data-col="aveRevDiff">Ave Rev Diff <span class="sort-icon">↕</span></th>
        </tr>
      `;
    } else {
      const periodLabel = activeTab === 'tp1' ? 'TP1: 05/04/2026 – 08/02/2026' : 'TP2: 08/03/2026 – 11/01/2026';
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

    // Attach sort listeners
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
      list = reportData.compareClients;
    } else if (activeTab === 'tp1') {
      list = reportData.tp1Clients;
    } else {
      list = reportData.tp2Clients;
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

      // Tag filter
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

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let v1 = a[sortCol];
      let v2 = b[sortCol];
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
    const tbody = document.getElementById('clientsTableBody');
    const tfoot = document.getElementById('clientsTableFoot');
    const filtered = getFilteredClientList();
    const totalCount = filtered.length;

    // Determine pagination slice
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

    // Update pagination controls
    updatePaginationUI(totalCount, startIdx, endIdx);

    // Render Rows
    let html = '';
    if (visibleRows.length === 0) {
      const colSpan = activeTab === 'compare' ? 10 : 6;
      html = `<tr><td colspan="${colSpan}" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matching client records found.</td></tr>`;
    } else {
      visibleRows.forEach(r => {
        const badges = window.VMI.renderClientBadges(r);
        const repTag = `<span class="tag-badge tag-rep">${window.VMI.escapeHtml(r.salesRep || 'Unassigned')}</span>`;

        if (activeTab === 'compare') {
          const ordClass = r.orderDiff >= 0 ? 'num-pos' : 'num-neg';
          const revClass = r.revDiff >= 0 ? 'num-pos' : 'num-neg';
          const untClass = r.unitDiff >= 0 ? 'num-pos' : 'num-neg';
          const aovClass = r.aveRevDiff >= 0 ? 'num-pos' : 'num-neg';
          html += `
            <tr>
              <td>
                <div style="font-weight: 600;">${window.VMI.escapeHtml(r.client)}</div>
                <div>${badges}</div>
              </td>
              <td>${repTag}</td>
              <td class="text-right">${window.VMI.fmtInt(r.tp1Orders)}</td>
              <td class="text-right">${window.VMI.fmtCurrency(r.tp1Ordered)}</td>
              <td class="text-right">${window.VMI.fmtInt(r.tp2Orders)}</td>
              <td class="text-right">${window.VMI.fmtCurrency(r.tp2Ordered)}</td>
              <td class="text-right ${ordClass}">${window.VMI.fmtSignedInt(r.orderDiff)}</td>
              <td class="text-right ${revClass}">${window.VMI.fmtSignedCurrency(r.revDiff)}</td>
              <td class="text-right ${untClass}">${window.VMI.fmtSignedInt(r.unitDiff)}</td>
              <td class="text-right ${aovClass}">${window.VMI.fmtSignedCurrency(r.aveRevDiff)}</td>
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

    // Render Dynamic TFoot sticky totals from filtered rows
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

      const label = (selectedRep || activeFilter !== 'all' || searchQuery) ? `Filtered Total (${totalCount} stores):` : `Total 13 v 13 compare (${totalCount} stores):`;

      tfoot.innerHTML = `
        <tr>
          <td><strong>${label}</strong></td>
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

    // Update active sort indicator on table header
    document.querySelectorAll('#clientsTableHead th.sortable').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.getAttribute('data-col') === sortCol) {
        th.classList.add(sortAsc ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }

  function updatePaginationUI(totalCount, startIdx, endIdx) {
    const info = document.getElementById('paginationInfo');
    const btnContainer = document.getElementById('paginationButtons');

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

    btns += `<button class="btn btn-secondary" ${currentPage === 1 ? 'disabled style="opacity:0.4;"' : ''} id="btnPrevPage">« Prev</button>`;
    btns += `<span style="padding: 0 0.5rem; font-weight: 600;">Page ${currentPage} of ${totalPages}</span>`;
    btns += `<button class="btn btn-secondary" ${currentPage === totalPages ? 'disabled style="opacity:0.4;"' : ''} id="btnNextPage">Next »</button>`;

    btnContainer.innerHTML = btns;

    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');
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

  function bindEvents() {
    // Sales Rep Selector Pills
    document.getElementById('repPillsContainer').addEventListener('click', (e) => {
      const pill = e.target.closest('.rep-pill');
      if (!pill) return;
      const rep = pill.getAttribute('data-rep');
      setRepFilter(rep);
    });

    // Sales Rep Selector Dropdown
    document.getElementById('repDropdownSelect').addEventListener('change', (e) => {
      setRepFilter(e.target.value);
    });

    // Include House Checkbox
    const chkHouse = document.getElementById('chkIncludeHouse');
    if (chkHouse) {
      chkHouse.addEventListener('change', (e) => {
        includeHouse = e.target.checked;
        if (selectedRep) {
          currentPage = 1;
          renderKpis();
          renderGainersDeclinersChart();
          renderClientTable();
        }
      });
    }

    // Reset Rep Filter Button
    const btnReset = document.getElementById('btnResetRepFilter');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        setRepFilter('');
      });
    }

    // Sub-Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.getAttribute('data-tab');
        sortCol = activeTab === 'compare' ? 'revDiff' : 'ordered';
        sortAsc = false;
        currentPage = 1;
        renderClientTableHead();
        renderClientTable();
      });
    });

    // Tag filter pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeFilter = pill.getAttribute('data-filter');
        currentPage = 1;
        renderClientTable();
      });
    });

    // Search input
    const searchInput = document.getElementById('clientSearchInput');
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      currentPage = 1;
      renderClientTable();
    });

    // Page size select
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    pageSizeSelect.addEventListener('change', (e) => {
      pageSize = e.target.value;
      currentPage = 1;
      renderClientTable();
    });

    // Gainers vs Decliners Toggle
    const btnGainers = document.getElementById('btnGainersToggle');
    const btnDecliners = document.getElementById('btnDeclinersToggle');
    btnGainers.classList.add('btn-primary');
    btnGainers.classList.remove('btn-secondary');

    btnGainers.addEventListener('click', () => {
      gainersViewMode = 'gainers';
      btnGainers.classList.add('btn-primary');
      btnGainers.classList.remove('btn-secondary');
      btnDecliners.classList.add('btn-secondary');
      btnDecliners.classList.remove('btn-primary');
      renderGainersDeclinersChart();
    });

    btnDecliners.addEventListener('click', () => {
      gainersViewMode = 'decliners';
      btnDecliners.classList.add('btn-primary');
      btnDecliners.classList.remove('btn-secondary');
      btnGainers.classList.add('btn-secondary');
      btnGainers.classList.remove('btn-primary');
      renderGainersDeclinersChart();
    });

    // Rep Consolidate Checkbox
    const chkConsolidate = document.getElementById('chkConsolidateReps');
    chkConsolidate.addEventListener('change', (e) => {
      consolidateReps = e.target.checked;
      renderRepsTable();
    });

    // Rep Table Header Sort
    document.querySelectorAll('#repsTable th.sortable').forEach(th => {
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

    // CSV Exports
    document.getElementById('btnExportReps').addEventListener('click', exportRepsCsv);
    document.getElementById('btnExportClients').addEventListener('click', exportClientsCsv);
    document.getElementById('btnExportActiveTable').addEventListener('click', exportClientsCsv);
  }

  function exportRepsCsv() {
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
    window.VMI.exportCsv('vmi_13v13_sales_reps.csv', headers, rows);
  }

  function exportClientsCsv() {
    const list = getFilteredClientList();
    const repPrefix = selectedRep ? `_${selectedRep.replace(/\s+/g, '_')}` : '';
    if (activeTab === 'compare') {
      const headers = [
        'Client', 'Sales Rep', 'Chain Code', 'Is VMI', 'Is 1WT',
        'TP1 Orders', 'TP1 Revenue', 'TP1 Units', 'TP1 AOV',
        'TP2 Orders', 'TP2 Revenue', 'TP2 Units', 'TP2 AOV',
        'Order Diff', 'Rev Diff', 'Unit Diff', 'Ave Rev Diff'
      ];
      const rows = list.map(r => [
        r.client, r.salesRep || 'Unassigned', r.chainCode || '', r.isVmi ? 'YES' : 'NO', r.is1Wt ? 'YES' : 'NO',
        r.tp1Orders, r.tp1Ordered, r.tp1Units, r.tp1Aov,
        r.tp2Orders, r.tp2Ordered, r.tp2Units, r.tp2Aov,
        r.orderDiff, r.revDiff, r.unitDiff, r.aveRevDiff
      ]);
      window.VMI.exportCsv(`vmi_13v13_compare_clients${repPrefix}_${activeFilter}.csv`, headers, rows);
    } else {
      const pName = activeTab === 'tp1' ? 'tp1' : 'tp2';
      const headers = ['Client', 'Sales Rep', 'Chain Code', 'Is VMI', 'Is 1WT', 'Total Orders', 'Total Ordered', 'Total Units', 'Average Order Value'];
      const rows = list.map(r => [
        r.client, r.salesRep || 'Unassigned', r.chainCode || '', r.isVmi ? 'YES' : 'NO', r.is1Wt ? 'YES' : 'NO',
        r.orders, r.ordered, r.units, r.aov
      ]);
      window.VMI.exportCsv(`vmi_13v13_${pName}_clients${repPrefix}.csv`, headers, rows);
    }
  }

  function round2(num) {
    return Math.round(Number(num) * 100) / 100;
  }
})();
