/**
 * report1.js
 * Logic for Page 1: 13-Week vs. 13-Week Client & Rep Order Comparison.
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

  function renderKpis() {
    const tp1 = reportData.tp1Total;
    const tp2 = reportData.tp2Total;
    const cmp = reportData.compareTotal;

    // Orders
    const ordPct = tp1.orders ? ((tp2.orders - tp1.orders) / tp1.orders) * 100 : 0;
    document.getElementById('kpiOrdersTP2').textContent = window.VMI.fmtInt(tp2.orders);
    document.getElementById('kpiOrdersTP1').textContent = window.VMI.fmtInt(tp1.orders);
    document.getElementById('kpiOrdersDelta').textContent = `${window.VMI.fmtSignedInt(cmp.orderDiff)} (${window.VMI.fmtPct(ordPct)})`;
    document.getElementById('kpiOrdersDelta').className = `delta-badge ${cmp.orderDiff >= 0 ? 'pos' : 'neg'}`;
    document.getElementById('kpiOrdersDiffText').textContent = `${window.VMI.fmtSignedInt(cmp.orderDiff)} diff`;

    // Revenue
    const revPct = tp1.ordered ? ((tp2.ordered - tp1.ordered) / tp1.ordered) * 100 : 0;
    document.getElementById('kpiRevTP2').textContent = window.VMI.fmtCurrency(tp2.ordered);
    document.getElementById('kpiRevTP1').textContent = window.VMI.fmtCurrency(tp1.ordered);
    document.getElementById('kpiRevDelta').textContent = `${window.VMI.fmtSignedCurrency(cmp.revDiff)} (${window.VMI.fmtPct(revPct)})`;
    document.getElementById('kpiRevDelta').className = `delta-badge ${cmp.revDiff >= 0 ? 'pos' : 'neg'}`;
    document.getElementById('kpiRevDiffText').textContent = window.VMI.fmtSignedCurrency(cmp.revDiff);

    // Units
    const unitPct = tp1.units ? ((tp2.units - tp1.units) / tp1.units) * 100 : 0;
    document.getElementById('kpiUnitsTP2').textContent = window.VMI.fmtInt(tp2.units);
    document.getElementById('kpiUnitsTP1').textContent = window.VMI.fmtInt(tp1.units);
    document.getElementById('kpiUnitsDelta').textContent = `${window.VMI.fmtSignedInt(cmp.unitDiff)} (${window.VMI.fmtPct(unitPct)})`;
    document.getElementById('kpiUnitsDelta').className = `delta-badge ${cmp.unitDiff >= 0 ? 'pos' : 'neg'}`;
    document.getElementById('kpiUnitsDiffText').textContent = `${window.VMI.fmtSignedInt(cmp.unitDiff)} diff`;

    // AOV
    const aovPct = tp1.aov ? ((tp2.aov - tp1.aov) / tp1.aov) * 100 : 0;
    document.getElementById('kpiAovTP2').textContent = window.VMI.fmtCurrency(tp2.aov);
    document.getElementById('kpiAovTP1').textContent = window.VMI.fmtCurrency(tp1.aov);
    document.getElementById('kpiAovDelta').textContent = `${window.VMI.fmtSignedCurrency(cmp.aveRevDiff)} (${window.VMI.fmtPct(aovPct)})`;
    document.getElementById('kpiAovDelta').className = `delta-badge ${cmp.aveRevDiff >= 0 ? 'pos' : 'neg'}`;
    document.getElementById('kpiAovDiffText').textContent = window.VMI.fmtSignedCurrency(cmp.aveRevDiff);

    // Tab badges
    document.getElementById('badgeCompareCount').textContent = window.VMI.fmtInt(reportData.compareClients.length);
    document.getElementById('badgeTp1Count').textContent = window.VMI.fmtInt(reportData.tp1Clients.length);
    document.getElementById('badgeTp2Count').textContent = window.VMI.fmtInt(reportData.tp2Clients.length);
  }

  function renderRepChart() {
    const container = document.getElementById('repChartContainer');
    // Sort reps by TP2 ordered descending
    const reps = [...reportData.salesReps].sort((a, b) => b.tp2Ordered - a.tp2Ordered);
    const maxVal = Math.max(...reps.map(r => Math.max(r.tp1Ordered, r.tp2Ordered)), 1);

    let html = '';
    reps.forEach(r => {
      const tp1Pct = ((r.tp1Ordered / maxVal) * 100).toFixed(1);
      const tp2Pct = ((r.tp2Ordered / maxVal) * 100).toFixed(1);
      const diffClass = r.revDiff >= 0 ? 'num-pos' : 'num-neg';
      html += `
        <div class="chart-row">
          <div class="chart-row-meta">
            <span class="chart-row-label">${window.VMI.escapeHtml(r.rep)}</span>
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
  }

  function renderGainersDeclinersChart() {
    const container = document.getElementById('gainersDeclinersChartContainer');
    const sorted = [...reportData.compareClients].sort((a, b) => b.revDiff - a.revDiff);
    const gainers = sorted.slice(0, 10);
    const decliners = sorted.slice(-10).reverse();

    const currentList = gainersViewMode === 'gainers' ? gainers : decliners;
    const maxAbsVal = Math.max(...currentList.map(c => Math.abs(c.revDiff)), 1);

    let html = '';
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
            role: r.role.includes('House') ? 'Sales' : r.role,
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
        consolidated[base].tp1Orders += r.tp1Orders;
        consolidated[base].tp1Ordered += r.tp1Ordered;
        consolidated[base].tp1Units += r.tp1Units;
        consolidated[base].tp2Orders += r.tp2Orders;
        consolidated[base].tp2Ordered += r.tp2Ordered;
        consolidated[base].tp2Units += r.tp2Units;
      });

      reps = Object.values(consolidated).map(c => {
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

      bodyHtml += `
        <tr>
          <td><strong>${window.VMI.escapeHtml(r.rep)}</strong></td>
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

    // TFoot totals
    const totTp1Aov = totTp1Ord ? totTp1Rev / totTp1Ord : 0;
    const totTp2Aov = totTp2Ord ? totTp2Rev / totTp2Ord : 0;
    const totOrdDiff = totTp2Ord - totTp1Ord;
    const totRevDiff = totTp2Rev - totTp1Rev;
    const totUntDiff = totTp2Unt - totTp1Unt;
    const totAovDiff = totTp2Aov - totTp1Aov;

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
          sortAsc = col === 'client';
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
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const clientMatch = item.client.toLowerCase().includes(q);
        const chainMatch = item.chainCode && item.chainCode.toLowerCase().includes(q);
        if (!clientMatch && !chainMatch) return false;
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
      const colSpan = activeTab === 'compare' ? 9 : 5;
      html = `<tr><td colspan="${colSpan}" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matching client records found.</td></tr>`;
    } else {
      visibleRows.forEach(r => {
        const badges = window.VMI.renderClientBadges(r);
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

    // Render TFoot sticky totals
    if (activeTab === 'compare') {
      const cmp = reportData.compareTotal;
      const tp1 = reportData.tp1Total;
      const tp2 = reportData.tp2Total;
      tfoot.innerHTML = `
        <tr>
          <td><strong>Total 13 v 13 compare:</strong></td>
          <td class="text-right">${window.VMI.fmtInt(tp1.orders)}</td>
          <td class="text-right">${window.VMI.fmtCurrency(tp1.ordered)}</td>
          <td class="text-right">${window.VMI.fmtInt(tp2.orders)}</td>
          <td class="text-right">${window.VMI.fmtCurrency(tp2.ordered)}</td>
          <td class="text-right ${cmp.orderDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedInt(cmp.orderDiff)}</td>
          <td class="text-right ${cmp.revDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedCurrency(cmp.revDiff)}</td>
          <td class="text-right ${cmp.unitDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedInt(cmp.unitDiff)}</td>
          <td class="text-right ${cmp.aveRevDiff >= 0 ? 'num-pos' : 'num-neg'}">${window.VMI.fmtSignedCurrency(cmp.aveRevDiff)}</td>
        </tr>
      `;
    } else {
      const tot = activeTab === 'tp1' ? reportData.tp1Total : reportData.tp2Total;
      tfoot.innerHTML = `
        <tr>
          <td><strong>Total:</strong></td>
          <td class="text-right">${window.VMI.fmtInt(tot.orders)}</td>
          <td class="text-right">${window.VMI.fmtCurrency(tot.ordered)}</td>
          <td class="text-right">${window.VMI.fmtInt(tot.units)}</td>
          <td class="text-right">${window.VMI.fmtCurrency(tot.aov)}</td>
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
    if (activeTab === 'compare') {
      const headers = [
        'Client', 'Chain Code', 'Is VMI', 'Is 1WT',
        'TP1 Orders', 'TP1 Revenue', 'TP1 Units', 'TP1 AOV',
        'TP2 Orders', 'TP2 Revenue', 'TP2 Units', 'TP2 AOV',
        'Order Diff', 'Rev Diff', 'Unit Diff', 'Ave Rev Diff'
      ];
      const rows = list.map(r => [
        r.client, r.chainCode || '', r.isVmi ? 'YES' : 'NO', r.is1Wt ? 'YES' : 'NO',
        r.tp1Orders, r.tp1Ordered, r.tp1Units, r.tp1Aov,
        r.tp2Orders, r.tp2Ordered, r.tp2Units, r.tp2Aov,
        r.orderDiff, r.revDiff, r.unitDiff, r.aveRevDiff
      ]);
      window.VMI.exportCsv(`vmi_13v13_compare_clients_${activeFilter}.csv`, headers, rows);
    } else {
      const pName = activeTab === 'tp1' ? 'tp1' : 'tp2';
      const headers = ['Client', 'Chain Code', 'Is VMI', 'Is 1WT', 'Total Orders', 'Total Ordered', 'Total Units', 'Average Order Value'];
      const rows = list.map(r => [
        r.client, r.chainCode || '', r.isVmi ? 'YES' : 'NO', r.is1Wt ? 'YES' : 'NO',
        r.orders, r.ordered, r.units, r.aov
      ]);
      window.VMI.exportCsv(`vmi_13v13_${pName}_clients.csv`, headers, rows);
    }
  }

  function round2(num) {
    return Math.round(Number(num) * 100) / 100;
  }
})();
