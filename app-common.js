/**
 * app-common.js
 * Common presentation and data utilities for VMI Sales Reports Dashboard.
 */

window.VMI = window.VMI || {};

// Format Currency ($X,XXX.XX)
window.VMI.fmtCurrency = function(val) {
  if (val === null || val === undefined || isNaN(val)) return '$0.00';
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Format Integer (X,XXX)
window.VMI.fmtInt = function(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Math.round(Number(val)).toLocaleString('en-US');
};

// Format Signed Currency (+/-$X,XXX.XX)
window.VMI.fmtSignedCurrency = function(val) {
  if (val === null || val === undefined || isNaN(val)) return '$0.00';
  const num = Number(val);
  const sign = num > 0 ? '+' : num < 0 ? '-' : '';
  return sign + '$' + Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Format Signed Integer (+/-X,XXX)
window.VMI.fmtSignedInt = function(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const num = Number(val);
  const sign = num > 0 ? '+' : '';
  return sign + Math.round(num).toLocaleString('en-US');
};

// Format Percentage
window.VMI.fmtPct = function(pct) {
  if (pct === null || pct === undefined || isNaN(pct)) return '0.00%';
  const num = Number(pct);
  const sign = num > 0 ? '+' : '';
  return sign + num.toFixed(2) + '%';
};

// Render Client Tag Badges
window.VMI.renderClientBadges = function(row) {
  let html = '';
  if (row.chainCode) {
    html += `<span class="tag-badge tag-chain">[${escapeHtml(row.chainCode)}]</span>`;
  }
  if (row.isVmi) {
    html += `<span class="tag-badge tag-vmi">VMI</span>`;
  }
  if (row.is1Wt) {
    html += `<span class="tag-badge tag-1wt">1WT</span>`;
  }
  return html;
};

// Render dedicated G/L Status Badge
window.VMI.renderGlBadge = function(row) {
  if (row.accountStatus === 'NEW') {
    return `<span class="tag-badge tag-gl-new">NEW [G]</span>`;
  } else if (row.accountStatus === 'CHURNED') {
    return `<span class="tag-badge tag-gl-churned">LOST [L]</span>`;
  } else if (row.gl === 'G' || row.perfStatus === 'GAIN' || (row.revDiff !== undefined && row.revDiff > 0)) {
    return `<span class="tag-badge tag-gl-g">GAIN (+)</span>`;
  } else if (row.gl === 'L' || row.perfStatus === 'LOSS' || (row.revDiff !== undefined && row.revDiff < 0)) {
    return `<span class="tag-badge tag-gl-l">LOSS (-)</span>`;
  } else {
    return `<span class="tag-badge" style="background: rgba(148, 163, 184, 0.15); color: var(--text-muted);">FLAT</span>`;
  }
};

// Escape HTML for safety
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.VMI.escapeHtml = escapeHtml;

// Format Sales Rep Initials (e.g. "Scotland Schieber" -> "SS", "Scotland Schieber - House" -> "SS-H")
window.VMI.fmtRepInitials = function(repName) {
  if (!repName || repName === 'Unassigned' || repName === '-' || repName === '—') return '—';
  const isHouse = /-\s*house/i.test(repName);
  const clean = repName
    .replace(/-\s*house/i, '')
    .replace(/\s+WA$/i, '')
    .trim();
  if (!clean) return isHouse ? 'H' : '—';
  if (/^[A-Z]{2,4}$/.test(clean)) return isHouse ? clean + '-H' : clean;
  const words = clean.split(/[\s_-]+/).filter(Boolean);
  const initials = words.map(w => w[0].toUpperCase()).join('');
  return isHouse ? initials + '-H' : initials;
};

// Render Sales Rep Initials Badge with Full Name Tooltip
window.VMI.renderRepBadge = function(repName) {
  const label = repName || 'Unassigned';
  const inits = window.VMI.fmtRepInitials(repName);
  return `<span class="tag-badge tag-rep" title="${escapeHtml(label)}">${escapeHtml(inits)}</span>`;
};

// CSV Exporter
window.VMI.exportCsv = function(filename, headers, rows) {
  let csvContent = '\uFEFF'; // UTF-8 BOM
  csvContent += headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\r\n';
  
  rows.forEach(r => {
    csvContent += r.map(val => {
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',') + '\r\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Data Loader: handles direct window.REPORTS_DATA or fetch fallback
window.VMI.loadData = async function() {
  if (window.REPORTS_DATA) {
    return window.REPORTS_DATA;
  }
  try {
    const res = await fetch('data/reports-data.json');
    if (res.ok) {
      window.REPORTS_DATA = await res.json();
      return window.REPORTS_DATA;
    }
  } catch (e) {
    console.warn('Fetch fallback failed:', e);
  }
  if (window.REPORTS_DATA) return window.REPORTS_DATA;
  throw new Error('Could not load reports-data.json or reports-data.js');
};
