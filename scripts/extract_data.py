#!/usr/bin/env python3
"""
scripts/extract_data.py
Deterministic data extraction script for VMI Sales & Preroll Performance Dashboard.
Uses ONLY Python standard library: zipfile, xml.etree.ElementTree, json, re, os.
"""

import os
import sys
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

NS = {'d': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

# Reps to explicitly exclude from Sales Rep selectors, summaries, and lists
VMI_ONLY_REPS = {'Curtis Green', 'Josh Novak', 'Koen McKinley'}

SALES_REPS_ORDER = [
    'Scotland Schieber',
    'Jeremy Schmidt',
    'Ashlea Underwood',
    'Danny Thoren',
    'Caitlin Stoner',
    'Nancy Drinkard WA',
    'Johnny Wilson'
]

def clean_num(val):
    if val is None or val == '':
        return 0.0
    val_str = str(val).replace(',', '').replace('$', '').strip()
    try:
        return float(val_str)
    except Exception:
        return 0.0

def clean_int(val):
    return int(round(clean_num(val)))

def clean_float(val):
    return round(clean_num(val), 2)

def extract_tags(client_name):
    if not client_name:
        return {'isVmi': False, 'is1Wt': False, 'chainCode': None}
    is_vmi = bool(re.search(r'\bVMI\b', client_name, re.IGNORECASE))
    is_1wt = bool(re.search(r'\b1WT\b', client_name, re.IGNORECASE))
    chain_match = re.search(r'^\[([^\]]+)\]', client_name.strip())
    chain_code = chain_match.group(1).strip() if chain_match else None
    return {'isVmi': is_vmi, 'is1Wt': is_1wt, 'chainCode': chain_code}

def read_xlsx_sheets(xlsx_path):
    sheets_data = {}
    with zipfile.ZipFile(xlsx_path, 'r') as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            sst = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in sst.findall('.//d:si', NS):
                t = ''.join([node.text or '' for node in si.iter() if node.tag.endswith('t')])
                shared.append(t)
        
        wb = ET.fromstring(z.read('xl/workbook.xml'))
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rels}
        
        for s in wb.findall('.//d:sheet', NS):
            sheet_name = s.attrib['name']
            rId = s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            target = rel_map[rId]
            if not target.startswith('xl/'):
                target = 'xl/' + target
            sheet_xml = ET.fromstring(z.read(target))
            rows = sheet_xml.findall('.//d:row', NS)
            sheet_rows = []
            for r in rows:
                r_idx = int(r.attrib.get('r', 0))
                row_dict = {}
                for c in r.findall('d:c', NS):
                    c_ref = c.attrib.get('r', '')
                    col_letter = ''.join([ch for ch in c_ref if ch.isalpha()])
                    t = c.attrib.get('t')
                    v = c.find('d:v', NS)
                    val = v.text if v is not None else ''
                    if t == 's' and val:
                        val = shared[int(val)]
                    row_dict[col_letter] = val
                sheet_rows.append((r_idx, row_dict))
            sheets_data[sheet_name] = sheet_rows
    return sheets_data

def load_sales_rep_mappings(base_dir, sheet2_voids_raw=None):
    """
    Load store-to-sales-rep mappings from data/store-sales-reps.json and voids.
    Ensures VMI-only reps (Curtis Green, Josh Novak, Koen McKinley) are excluded.
    """
    rep_map = {}
    json_path = os.path.join(base_dir, 'data', 'store-sales-reps.json')
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            store_reps_json = json.load(f)
            for store, rep in store_reps_json.items():
                store_clean = store.strip()
                rep_clean = rep.strip()
                if rep_clean not in VMI_ONLY_REPS and '(VMI)' not in rep_clean:
                    rep_map[store_clean] = rep_clean

    if sheet2_voids_raw:
        for r_idx, d in sheet2_voids_raw:
            if r_idx < 3:
                continue
            client = (d.get('B') or '').strip()
            rep = (d.get('C') or '').strip()
            if client and rep and rep != '-' and client not in rep_map:
                if rep not in VMI_ONLY_REPS and '(VMI)' not in rep:
                    rep_map[client] = rep

    return rep_map

def resolve_rep_info(rep_name):
    if not rep_name or rep_name == '-' or rep_name in VMI_ONLY_REPS:
        return ('Unassigned', 'Unassigned')
    sales_rep = rep_name.strip()
    base_sales_rep = sales_rep.replace(' - House', '').strip()
    return (sales_rep, base_sales_rep)

def parse_report1(wb13_path, rep_map):
    sheets = read_xlsx_sheets(wb13_path)
    tp1_raw = sheets['TP1 5.4-8.2']
    tp2_raw = sheets['TP2 8.3-11.1']
    cmp_raw = sheets['Sheet2']
    
    # Optional lookup from raw Sheet2 for reference
    sheet2_ref = {}
    for r_idx, d in cmp_raw:
        if 2 <= r_idx <= 404:
            s_name = (d.get('A') or '').strip()
            if s_name:
                sheet2_ref[s_name] = clean_float(d.get('C'))

    # 1. TP1 Clients (rows 2 to 400 - 399 stores)
    tp1_clients = []
    tp1_map = {}
    for r_idx, d in tp1_raw:
        if 2 <= r_idx <= 400:
            name = (d.get('A') or '').strip()
            if not name:
                continue
            orders = clean_int(d.get('B'))
            ordered = clean_float(d.get('C'))
            units = clean_int(d.get('D'))
            aov = clean_float(d.get('E'))
            tags = extract_tags(name)
            rep_raw = rep_map.get(name, 'Unassigned')
            sales_rep, base_sales_rep = resolve_rep_info(rep_raw)

            client_obj = {
                'client': name,
                'salesRep': sales_rep,
                'baseSalesRep': base_sales_rep,
                'orders': orders,
                'ordered': ordered,
                'units': units,
                'aov': aov,
                'isVmi': tags['isVmi'],
                'is1Wt': tags['is1Wt'],
                'chainCode': tags['chainCode']
            }
            tp1_clients.append(client_obj)
            tp1_map[name] = client_obj

    # TP1 Total row (r_idx 401)
    tp1_total_row = next((d for r_idx, d in tp1_raw if r_idx == 401), {})
    tp1_total = {
        'orders': clean_int(tp1_total_row.get('B')),
        'ordered': clean_float(tp1_total_row.get('C')),
        'units': clean_int(tp1_total_row.get('D')),
        'aov': clean_float(tp1_total_row.get('E'))
    }

    # TP1 Sales Reps summary lines (rows 402 to 414)
    tp1_reps_raw = {}
    for r_idx, d in tp1_raw:
        if 402 <= r_idx <= 414:
            raw_name = (d.get('A') or '').strip()
            if not raw_name:
                continue
            clean_name = re.sub(r'\s*\([^)]*\)\s*$', '', raw_name).strip()
            tp1_reps_raw[clean_name] = {
                'rawName': raw_name,
                'orders': clean_int(d.get('B')),
                'ordered': clean_float(d.get('C')),
                'units': clean_int(d.get('D')),
                'aov': clean_float(d.get('E'))
            }

    # 2. TP2 Clients (rows 2 to 401 - 400 stores)
    tp2_clients = []
    tp2_map = {}
    for r_idx, d in tp2_raw:
        if 2 <= r_idx <= 401:
            name = (d.get('A') or '').strip()
            if not name:
                continue
            orders = clean_int(d.get('B'))
            ordered = clean_float(d.get('C'))
            units = clean_int(d.get('D'))
            aov = clean_float(d.get('E'))
            tags = extract_tags(name)
            rep_raw = rep_map.get(name, 'Unassigned')
            sales_rep, base_sales_rep = resolve_rep_info(rep_raw)

            client_obj = {
                'client': name,
                'salesRep': sales_rep,
                'baseSalesRep': base_sales_rep,
                'orders': orders,
                'ordered': ordered,
                'units': units,
                'aov': aov,
                'isVmi': tags['isVmi'],
                'is1Wt': tags['is1Wt'],
                'chainCode': tags['chainCode']
            }
            tp2_clients.append(client_obj)
            tp2_map[name] = client_obj

    # TP2 Total row (r_idx 402)
    tp2_total_row = next((d for r_idx, d in tp2_raw if r_idx == 402), {})
    tp2_total = {
        'orders': clean_int(tp2_total_row.get('B')),
        'ordered': clean_float(tp2_total_row.get('C')),
        'units': clean_int(tp2_total_row.get('D')),
        'aov': clean_float(tp2_total_row.get('E'))
    }

    # TP2 Sales Reps summary lines (rows 403 to 415)
    tp2_reps_raw = {}
    for r_idx, d in tp2_raw:
        if 403 <= r_idx <= 415:
            raw_name = (d.get('A') or '').strip()
            if not raw_name:
                continue
            clean_name = re.sub(r'\s*\([^)]*\)\s*$', '', raw_name).strip()
            tp2_reps_raw[clean_name] = {
                'rawName': raw_name,
                'orders': clean_int(d.get('B')),
                'ordered': clean_float(d.get('C')),
                'units': clean_int(d.get('D')),
                'aov': clean_float(d.get('E'))
            }

    # 3. 13v13 Compare Clients: Exact Name-Matched Union of TP1 (399) and TP2 (400) = 412 clients
    all_client_names = sorted(list(set(tp1_map.keys()) | set(tp2_map.keys())))
    compare_clients = []

    for name in all_client_names:
        t1 = tp1_map.get(name, {'orders': 0, 'ordered': 0.0, 'units': 0, 'aov': 0.0})
        t2 = tp2_map.get(name, {'orders': 0, 'ordered': 0.0, 'units': 0, 'aov': 0.0})

        order_diff = t2['orders'] - t1['orders']
        rev_diff = round(t2['ordered'] - t1['ordered'], 2)
        unit_diff = t2['units'] - t1['units']
        ave_rev_diff = round(t2['aov'] - t1['aov'], 2)

        account_status = 'RETAINED'
        if t1['orders'] == 0 and t2['orders'] > 0:
            account_status = 'NEW'
        elif t1['orders'] > 0 and t2['orders'] == 0:
            account_status = 'CHURNED'

        perf_status = 'GAIN' if rev_diff > 0 else ('LOSS' if rev_diff < 0 else 'FLAT')
        gl = 'G' if rev_diff > 0 else ('L' if rev_diff < 0 else None)

        tags = extract_tags(name)
        rep_raw = rep_map.get(name, 'Unassigned')
        sales_rep, base_sales_rep = resolve_rep_info(rep_raw)

        client_compare_obj = {
            'client': name,
            'salesRep': sales_rep,
            'baseSalesRep': base_sales_rep,
            'orderDiff': order_diff,
            'revDiff': rev_diff,
            'unitDiff': unit_diff,
            'aveRevDiff': ave_rev_diff,
            'gl': gl,
            'accountStatus': account_status,
            'perfStatus': perf_status,
            'isVmi': tags['isVmi'],
            'is1Wt': tags['is1Wt'],
            'chainCode': tags['chainCode'],
            'tp1Orders': t1['orders'],
            'tp1Ordered': t1['ordered'],
            'tp1Units': t1['units'],
            'tp1Aov': t1['aov'],
            'tp2Orders': t2['orders'],
            'tp2Ordered': t2['ordered'],
            'tp2Units': t2['units'],
            'tp2Aov': t2['aov']
        }
        if name in sheet2_ref:
            client_compare_obj['excelSheet2RevDiff'] = sheet2_ref[name]

        compare_clients.append(client_compare_obj)

    # Compare Total (True delta: TP2 - TP1)
    compare_total = {
        'orderDiff': tp2_total['orders'] - tp1_total['orders'],
        'revDiff': round(tp2_total['ordered'] - tp1_total['ordered'], 2),
        'unitDiff': tp2_total['units'] - tp1_total['units'],
        'aveRevDiff': round(tp2_total['aov'] - tp1_total['aov'], 2)
    }

    # Python Self-Check on 412 Union Math
    assert len(compare_clients) == 412, f"Expected 412 compare clients, got {len(compare_clients)}"
    calc_ord_diff = sum(c['orderDiff'] for c in compare_clients)
    calc_rev_diff = round(sum(c['revDiff'] for c in compare_clients), 2)
    calc_unt_diff = sum(c['unitDiff'] for c in compare_clients)
    assert calc_ord_diff == 214, f"Expected orderDiff sum 214, got {calc_ord_diff}"
    assert calc_rev_diff == 400533.22, f"Expected revDiff sum 400533.22, got {calc_rev_diff}"
    assert calc_unt_diff == 40499, f"Expected unitDiff sum 40499, got {calc_unt_diff}"
    assert len([c for c in compare_clients if c['gl'] == 'G']) == 222, f"Expected 222 gainers in R1, got {len([c for c in compare_clients if c['gl'] == 'G'])}"
    assert len([c for c in compare_clients if c['gl'] == 'L']) == 190, f"Expected 190 losers in R1, got {len([c for c in compare_clients if c['gl'] == 'L'])}"
    assert len([c for c in compare_clients if c['accountStatus'] == 'NEW']) == 13, f"Expected 13 new in R1, got {len([c for c in compare_clients if c['accountStatus'] == 'NEW'])}"
    assert len([c for c in compare_clients if c['accountStatus'] == 'CHURNED']) == 12, f"Expected 12 churned in R1, got {len([c for c in compare_clients if c['accountStatus'] == 'CHURNED'])}"

    # 4. Sales Rep Summaries: EXCLUDING VMI-only reps (Curtis Green, Josh Novak, Koen McKinley)
    # A. Store-level full book aggregation from all 412 clients by salesRep
    store_book = {}
    for c in compare_clients:
        rep = c['salesRep']
        if rep in VMI_ONLY_REPS:
            continue
        if rep not in store_book:
            is_house = ' - House' in rep
            base_rep = rep.replace(' - House', '').strip()
            role = 'House' if is_house else ('Unassigned' if rep == 'Unassigned' else 'Sales')
            store_book[rep] = {
                'rep': rep,
                'baseRep': base_rep,
                'isHouse': is_house,
                'role': role,
                'storeCount': 0,
                'tp1Orders': 0,
                'tp1Ordered': 0.0,
                'tp1Units': 0,
                'tp2Orders': 0,
                'tp2Ordered': 0.0,
                'tp2Units': 0,
                'gainedStores': 0,
                'lostStores': 0,
                'newStores': 0,
                'churnedStores': 0,
                'revUpStores': 0,
                'revDownStores': 0
            }
        sb = store_book[rep]
        sb['storeCount'] += 1
        sb['tp1Orders'] += c['tp1Orders']
        sb['tp1Ordered'] += c['tp1Ordered']
        sb['tp1Units'] += c['tp1Units']
        sb['tp2Orders'] += c['tp2Orders']
        sb['tp2Ordered'] += c['tp2Ordered']
        sb['tp2Units'] += c['tp2Units']
        if c['gl'] == 'G':
            sb['gainedStores'] += 1
            sb['revUpStores'] += 1
        elif c['gl'] == 'L':
            sb['lostStores'] += 1
            sb['revDownStores'] += 1
        if c['accountStatus'] == 'NEW':
            sb['newStores'] += 1
        elif c['accountStatus'] == 'CHURNED':
            sb['churnedStores'] += 1

    store_book_reps = []
    for rep, sb in sorted(store_book.items(), key=lambda x: -x[1]['tp2Ordered']):
        sb['tp1Ordered'] = round(sb['tp1Ordered'], 2)
        sb['tp2Ordered'] = round(sb['tp2Ordered'], 2)
        sb['tp1Aov'] = round(sb['tp1Ordered'] / sb['tp1Orders'], 2) if sb['tp1Orders'] else 0.0
        sb['tp2Aov'] = round(sb['tp2Ordered'] / sb['tp2Orders'], 2) if sb['tp2Orders'] else 0.0
        sb['orderDiff'] = sb['tp2Orders'] - sb['tp1Orders']
        sb['revDiff'] = round(sb['tp2Ordered'] - sb['tp1Ordered'], 2)
        sb['unitDiff'] = sb['tp2Units'] - sb['tp1Units']
        sb['aovDiff'] = round(sb['tp2Aov'] - sb['tp1Aov'], 2)
        store_book_reps.append(sb)

    # B. Excel Direct Sales Rep summary rows from 13v13.xlsx (excluding Curtis Green, Josh Novak, Koen McKinley)
    all_excel_rep_names = sorted(list(set(list(tp1_reps_raw.keys()) + list(tp2_reps_raw.keys()))))
    excel_sales_reps_only = []
    for rep in all_excel_rep_names:
        r1 = tp1_reps_raw.get(rep, {'orders': 0, 'ordered': 0.0, 'units': 0, 'aov': 0.0, 'rawName': rep})
        r2 = tp2_reps_raw.get(rep, {'orders': 0, 'ordered': 0.0, 'units': 0, 'aov': 0.0, 'rawName': rep})
        raw_name = r2.get('rawName', '') or r1.get('rawName', '')
        
        # Strictly exclude VMI-only reps
        if rep in VMI_ONLY_REPS or '(VMI)' in raw_name:
            continue
            
        is_house = ' - House' in rep
        base_rep = rep.replace(' - House', '').strip()
        role = 'House' if is_house else 'Sales'

        order_diff = r2['orders'] - r1['orders']
        rev_diff = round(r2['ordered'] - r1['ordered'], 2)
        unit_diff = r2['units'] - r1['units']
        aov_diff = round(r2['aov'] - r1['aov'], 2)

        excel_sales_reps_only.append({
            'rep': rep,
            'isHouse': is_house,
            'baseRep': base_rep,
            'role': role,
            'tp1Orders': r1['orders'],
            'tp1Ordered': r1['ordered'],
            'tp1Units': r1['units'],
            'tp1Aov': r1['aov'],
            'tp2Orders': r2['orders'],
            'tp2Ordered': r2['ordered'],
            'tp2Units': r2['units'],
            'tp2Aov': r2['aov'],
            'orderDiff': order_diff,
            'revDiff': rev_diff,
            'unitDiff': unit_diff,
            'aovDiff': aov_diff
        })

    return {
        'title': '13-Week vs. 13-Week Client & Rep Order Comparison',
        'tp1Period': '05/04/2026 - 08/02/2026',
        'tp2Period': '08/03/2026 - 11/01/2026',
        'tp1Total': tp1_total,
        'tp2Total': tp2_total,
        'compareTotal': compare_total,
        'tp1Clients': tp1_clients,
        'tp2Clients': tp2_clients,
        'compareClients': compare_clients,
        'salesReps': store_book_reps,
        'storeLevelSalesReps': store_book_reps,
        'excelSalesRepsOnly': excel_sales_reps_only,
        'availableSalesReps': SALES_REPS_ORDER
    }

def parse_report2(wb12_path, rep_map):
    sheets = read_xlsx_sheets(wb12_path)
    sheet1_raw = sheets['12wk v 12wk']
    sheet2_raw = sheets['Latest 12wk Voids']

    # 1. Parse Voids Sheet
    voids = []
    category_counter = {}
    cat_rep_map = {}
    rep_void_counter = {}
    rep_stores_map = {}
    client_voids_map = {}

    for r_idx, d in sheet2_raw:
        if r_idx < 3:
            continue
        cat = (d.get('A') or '').strip()
        client = (d.get('B') or '').strip()
        raw_rep = (d.get('C') or '').strip()
        if not cat or not client:
            continue
        
        # Resolve rep, prioritizing store-sales-reps.json and excluding VMI-only reps
        assigned_rep = rep_map.get(client) or raw_rep
        sales_rep, base_sales_rep = resolve_rep_info(assigned_rep)

        tags = extract_tags(client)
        void_entry = {
            'category': cat,
            'client': client,
            'salesRep': sales_rep,
            'baseSalesRep': base_sales_rep,
            'isVmi': tags['isVmi'],
            'is1Wt': tags['is1Wt'],
            'chainCode': tags['chainCode']
        }
        voids.append(void_entry)

        # Track category breakdown
        category_counter[cat] = category_counter.get(cat, 0) + 1
        if cat not in cat_rep_map:
            cat_rep_map[cat] = {}
        if sales_rep and sales_rep != 'Unassigned':
            cat_rep_map[cat][sales_rep] = cat_rep_map[cat].get(sales_rep, 0) + 1

        # Track rep void counts (excluding VMI-only reps)
        if sales_rep and sales_rep != 'Unassigned' and sales_rep not in VMI_ONLY_REPS:
            rep_void_counter[sales_rep] = rep_void_counter.get(sales_rep, 0) + 1
            if sales_rep not in rep_stores_map:
                rep_stores_map[sales_rep] = set()
            rep_stores_map[sales_rep].add(client)

        # Track client -> categories
        if client not in client_voids_map:
            client_voids_map[client] = []
        if cat not in client_voids_map[client]:
            client_voids_map[client].append(cat)

    categories_summary = []
    for cat in sorted(category_counter.keys()):
        categories_summary.append({
            'category': cat,
            'storeCount': category_counter[cat],
            'reps': cat_rep_map.get(cat, {})
        })

    reps_void_summary = []
    for rep, count in sorted(rep_void_counter.items(), key=lambda x: -x[1]):
        if rep not in VMI_ONLY_REPS:
            reps_void_summary.append({
                'rep': rep,
                'baseRep': rep.replace(' - House', '').strip(),
                'voidCount': count,
                'uniqueStores': len(rep_stores_map.get(rep, set()))
            })

    # 2. Parse 12wk v 12wk Client comparison
    # Row 3 is Total
    total_row = next((d for r_idx, d in sheet1_raw if r_idx == 3), {})
    tp1_total = {
        'orders': clean_int(total_row.get('B')),
        'ordered': clean_float(total_row.get('C')),
        'units': clean_int(total_row.get('D')),
        'aov': clean_float(total_row.get('E'))
    }
    tp2_total = {
        'orders': clean_int(total_row.get('G')),
        'ordered': clean_float(total_row.get('H')),
        'units': clean_int(total_row.get('I')),
        'aov': clean_float(total_row.get('J'))
    }
    compare_total = {
        'orderDiff': clean_int(total_row.get('L')),
        'revDiff': clean_float(total_row.get('M')),
        'unitDiff': clean_int(total_row.get('N')),
        'aveDiff': clean_float(total_row.get('O'))
    }

    # 2. Extract active TP1 stores (Cols A-E) and TP2 stores (Cols F-J)
    # Accounting for raw spreadsheet alignment/paste quirks:
    # 1. Row 210 Cloud 9 Cheney accidentally had TP2 numbers pasted into TP1 -> zero out TP1
    # 2. Clutch Cannabis on row-level G entries was raw formula placeholder in Col A
    tp1_preroll_map = {}
    tp2_preroll_map = {}
    seen_stores = []

    for r_idx, d in sheet1_raw:
        if 4 <= r_idx <= 407:
            c1 = (d.get('A') or '').strip()
            c2 = (d.get('F') or '').strip()

            ord1 = clean_int(d.get('B'))
            rev1 = clean_float(d.get('C'))
            unt1 = clean_int(d.get('D'))
            aov1 = clean_float(d.get('E'))

            ord2 = clean_int(d.get('G'))
            rev2 = clean_float(d.get('H'))
            unt2 = clean_int(d.get('I'))
            aov2 = clean_float(d.get('J'))

            # In Col A: when ord1 == 0 and c1 == 'Clutch Cannabis', c1 was a formula placeholder
            if c1 and (ord1 > 0 or c1 != 'Clutch Cannabis'):
                if c1 not in seen_stores:
                    seen_stores.append(c1)
                # Cloud 9 Cheney on row 210: TP2 values accidentally pasted into TP1 -> zero out TP1
                if c1 == '[C9] Cloud 9 - Cheney - VMI - 1WT':
                    tp1_preroll_map[c1] = {'orders': 0, 'ordered': 0.0, 'units': 0, 'aov': 0.0}
                elif ord1 > 0:
                    tp1_preroll_map[c1] = {'orders': ord1, 'ordered': rev1, 'units': unt1, 'aov': aov1}

            if c2:
                if c2 not in seen_stores:
                    seen_stores.append(c2)
                if ord2 > 0:
                    tp2_preroll_map[c2] = {'orders': ord2, 'ordered': rev2, 'units': unt2, 'aov': aov2}

    # 3. Join by exact Client Name across all 404 unique stores
    clients = []
    client_tp2_rev_map = {}
    client_tp2_ord_map = {}

    for name in seen_stores:
        t1 = tp1_preroll_map.get(name, {'orders': 0, 'ordered': 0.0, 'units': 0, 'aov': 0.0})
        t2 = tp2_preroll_map.get(name, {'orders': 0, 'ordered': 0.0, 'units': 0, 'aov': 0.0})

        ord_diff = t2['orders'] - t1['orders']
        rev_diff = round(t2['ordered'] - t1['ordered'], 2)
        unt_diff = t2['units'] - t1['units']
        aov_diff = round(t2['aov'] - t1['aov'], 2)

        account_status = 'RETAINED'
        if t1['orders'] == 0 and t2['orders'] > 0:
            account_status = 'NEW'
        elif t1['orders'] > 0 and t2['orders'] == 0:
            account_status = 'CHURNED'

        perf_status = 'GAIN' if rev_diff > 0 else ('LOSS' if rev_diff < 0 else 'FLAT')
        gl = 'G' if rev_diff > 0 else ('L' if rev_diff < 0 else None)

        tags = extract_tags(name)
        assigned_rep = rep_map.get(name, 'Unassigned')
        sales_rep, base_sales_rep = resolve_rep_info(assigned_rep)
        v_cats = client_voids_map.get(name, [])

        client_tp2_rev_map[name] = t2['ordered']
        client_tp2_ord_map[name] = t2['orders']

        clients.append({
            'client': name,
            'tp1Client': name,
            'tp2Client': name,
            'clientMismatch': False,
            'tp1Orders': t1['orders'],
            'tp1Ordered': t1['ordered'],
            'tp1Units': t1['units'],
            'tp1Aov': t1['aov'],
            'tp2Orders': t2['orders'],
            'tp2Ordered': t2['ordered'],
            'tp2Units': t2['units'],
            'tp2Aov': t2['aov'],
            'gl': gl,
            'accountStatus': account_status,
            'perfStatus': perf_status,
            'orderDiff': ord_diff,
            'revDiff': rev_diff,
            'unitDiff': unt_diff,
            'aveDiff': aov_diff,
            'isVmi': tags['isVmi'],
            'is1Wt': tags['is1Wt'],
            'chainCode': tags['chainCode'],
            'salesRep': sales_rep,
            'baseSalesRep': base_sales_rep,
            'voidCategories': v_cats,
            'voidCount': len(v_cats)
        })

    # Assert exact totals for Report 2
    assert len(clients) == 404, f"Expected 404 preroll clients, got {len(clients)}"
    assert sum(c['tp1Orders'] for c in clients) == 2806, f"TP1 orders sum mismatch: {sum(c['tp1Orders'] for c in clients)}"
    assert round(sum(c['tp1Ordered'] for c in clients), 2) == 2323107.17, f"TP1 ordered sum mismatch: {round(sum(c['tp1Ordered'] for c in clients), 2)}"
    assert sum(c['tp1Units'] for c in clients) == 1016928, f"TP1 units sum mismatch: {sum(c['tp1Units'] for c in clients)}"
    assert sum(c['tp2Orders'] for c in clients) == 2974, f"TP2 orders sum mismatch: {sum(c['tp2Orders'] for c in clients)}"
    assert round(sum(c['tp2Ordered'] for c in clients), 2) == 2193701.82, f"TP2 ordered sum mismatch: {round(sum(c['tp2Ordered'] for c in clients), 2)}"
    assert sum(c['tp2Units'] for c in clients) == 980598, f"TP2 units sum mismatch: {sum(c['tp2Units'] for c in clients)}"
    assert sum(c['orderDiff'] for c in clients) == 168, f"Order diff sum mismatch: {sum(c['orderDiff'] for c in clients)}"
    assert round(sum(c['revDiff'] for c in clients), 2) == -129405.35, f"Rev diff sum mismatch: {round(sum(c['revDiff'] for c in clients), 2)}"
    assert sum(c['unitDiff'] for c in clients) == -36330, f"Unit diff sum mismatch: {sum(c['unitDiff'] for c in clients)}"
    assert len([c for c in clients if c['gl'] == 'G']) == 198, f"Expected 198 gained, got {len([c for c in clients if c['gl'] == 'G'])}"
    assert len([c for c in clients if c['gl'] == 'L']) == 206, f"Expected 206 lost, got {len([c for c in clients if c['gl'] == 'L'])}"
    assert len([c for c in clients if c['accountStatus'] == 'NEW']) == 14, f"Expected 14 new, got {len([c for c in clients if c['accountStatus'] == 'NEW'])}"
    assert len([c for c in clients if c['accountStatus'] == 'CHURNED']) == 18, f"Expected 18 churned, got {len([c for c in clients if c['accountStatus'] == 'CHURNED'])}"

    # Generate TP1 (390 stores) and TP2 (386 stores) active client lists
    tp1_clients = []
    for c in clients:
        if c['tp1Orders'] > 0:
            tp1_clients.append({
                'client': c['client'],
                'salesRep': c['salesRep'],
                'baseSalesRep': c['baseSalesRep'],
                'orders': c['tp1Orders'],
                'ordered': c['tp1Ordered'],
                'units': c['tp1Units'],
                'aov': c['tp1Aov'],
                'isVmi': c['isVmi'],
                'is1Wt': c['is1Wt'],
                'chainCode': c['chainCode'],
                'voidCount': c.get('voidCount', 0),
                'voidCategories': c.get('voidCategories', [])
            })

    tp2_clients = []
    for c in clients:
        if c['tp2Orders'] > 0:
            tp2_clients.append({
                'client': c['client'],
                'salesRep': c['salesRep'],
                'baseSalesRep': c['baseSalesRep'],
                'orders': c['tp2Orders'],
                'ordered': c['tp2Ordered'],
                'units': c['tp2Units'],
                'aov': c['tp2Aov'],
                'isVmi': c['isVmi'],
                'is1Wt': c['is1Wt'],
                'chainCode': c['chainCode'],
                'voidCount': c.get('voidCount', 0),
                'voidCategories': c.get('voidCategories', [])
            })

    assert len(tp1_clients) == 390, f"Expected 390 active TP1 clients, got {len(tp1_clients)}"
    assert sum(c['orders'] for c in tp1_clients) == 2806, f"TP1 orders sum mismatch: {sum(c['orders'] for c in tp1_clients)}"
    assert round(sum(c['ordered'] for c in tp1_clients), 2) == 2323107.17, f"TP1 ordered sum mismatch: {round(sum(c['ordered'] for c in tp1_clients), 2)}"
    assert sum(c['units'] for c in tp1_clients) == 1016928, f"TP1 units sum mismatch: {sum(c['units'] for c in tp1_clients)}"

    assert len(tp2_clients) == 386, f"Expected 386 active TP2 clients, got {len(tp2_clients)}"
    assert sum(c['orders'] for c in tp2_clients) == 2974, f"TP2 orders sum mismatch: {sum(c['orders'] for c in tp2_clients)}"
    assert round(sum(c['ordered'] for c in tp2_clients), 2) == 2193701.82, f"TP2 ordered sum mismatch: {round(sum(c['ordered'] for c in tp2_clients), 2)}"
    assert sum(c['units'] for c in tp2_clients) == 980598, f"TP2 units sum mismatch: {sum(c['units'] for c in tp2_clients)}"

    # Generate Sales Reps Performance Rollup across all 404 Preroll stores
    store_book2 = {}
    for c in clients:
        rep = c['salesRep']
        if rep in VMI_ONLY_REPS:
            continue
        if rep not in store_book2:
            is_house = ' - House' in rep
            base_rep = rep.replace(' - House', '').strip()
            role = 'House' if is_house else ('Unassigned' if rep == 'Unassigned' else 'Sales')
            store_book2[rep] = {
                'rep': rep,
                'baseRep': base_rep,
                'isHouse': is_house,
                'role': role,
                'storeCount': 0,
                'tp1Orders': 0,
                'tp1Ordered': 0.0,
                'tp1Units': 0,
                'tp2Orders': 0,
                'tp2Ordered': 0.0,
                'tp2Units': 0,
                'gainedStores': 0,
                'lostStores': 0,
                'newStores': 0,
                'churnedStores': 0,
                'revUpStores': 0,
                'revDownStores': 0
            }
        sb = store_book2[rep]
        sb['storeCount'] += 1
        sb['tp1Orders'] += c['tp1Orders']
        sb['tp1Ordered'] += c['tp1Ordered']
        sb['tp1Units'] += c['tp1Units']
        sb['tp2Orders'] += c['tp2Orders']
        sb['tp2Ordered'] += c['tp2Ordered']
        sb['tp2Units'] += c['tp2Units']
        if c['gl'] == 'G':
            sb['gainedStores'] += 1
            sb['revUpStores'] += 1
        elif c['gl'] == 'L':
            sb['lostStores'] += 1
            sb['revDownStores'] += 1
        if c['accountStatus'] == 'NEW':
            sb['newStores'] += 1
        elif c['accountStatus'] == 'CHURNED':
            sb['churnedStores'] += 1

    store_book2_reps = []
    for rep, sb in sorted(store_book2.items(), key=lambda x: -x[1]['tp2Ordered']):
        sb['tp1Ordered'] = round(sb['tp1Ordered'], 2)
        sb['tp2Ordered'] = round(sb['tp2Ordered'], 2)
        sb['tp1Aov'] = round(sb['tp1Ordered'] / sb['tp1Orders'], 2) if sb['tp1Orders'] else 0.0
        sb['tp2Aov'] = round(sb['tp2Ordered'] / sb['tp2Orders'], 2) if sb['tp2Orders'] else 0.0
        sb['orderDiff'] = sb['tp2Orders'] - sb['tp1Orders']
        sb['revDiff'] = round(sb['tp2Ordered'] - sb['tp1Ordered'], 2)
        sb['unitDiff'] = sb['tp2Units'] - sb['tp1Units']
        sb['aovDiff'] = round(sb['tp2Aov'] - sb['tp1Aov'], 2)
        store_book2_reps.append(sb)

    assert sum(sb['tp1Orders'] for sb in store_book2_reps) == 2806
    assert round(sum(sb['tp1Ordered'] for sb in store_book2_reps), 2) == 2323107.17
    assert sum(sb['tp1Units'] for sb in store_book2_reps) == 1016928
    assert sum(sb['tp2Orders'] for sb in store_book2_reps) == 2974
    assert round(sum(sb['tp2Ordered'] for sb in store_book2_reps), 2) == 2193701.82
    assert sum(sb['tp2Units'] for sb in store_book2_reps) == 980598

    # Enrich voids with tp2 sales data if available
    for v in voids:
        c_name = v['client']
        v['tp2Ordered'] = client_tp2_rev_map.get(c_name, 0.0)
        v['tp2Orders'] = client_tp2_ord_map.get(c_name, 0)

    return {
        'title': '12-Week vs. 12-Week Preroll Performance & Category Voids',
        'tp1Period': '05/11/2026 - 08/02/2026',
        'tp2Period': '08/03/2026 - 11/29/2026',
        'voidsPeriod': '08/03/2026 - 11/29/2026',
        'tp1Total': tp1_total,
        'tp2Total': tp2_total,
        'compareTotal': compare_total,
        'tp1Clients': tp1_clients,
        'tp2Clients': tp2_clients,
        'clients': clients,
        'compareClients': clients,
        'salesReps': store_book2_reps,
        'storeLevelSalesReps': store_book2_reps,
        'voids': voids,
        'categoriesSummary': categories_summary,
        'repsVoidSummary': reps_void_summary,
        'availableSalesReps': SALES_REPS_ORDER
    }

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    wb13_path = os.path.join(base_dir, 'data', '13v13.xlsx')
    wb12_path = os.path.join(base_dir, 'data', '12wk_v_12wk_preroll_performance.xlsx')

    if not os.path.exists(wb13_path):
        print(f"Error: {wb13_path} not found!", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(wb12_path):
        print(f"Error: {wb12_path} not found!", file=sys.stderr)
        sys.exit(1)

    # 1. Read sheet2 voids raw to enrich sales rep mappings
    wb12_sheets = read_xlsx_sheets(wb12_path)
    sheet2_voids_raw = wb12_sheets.get('Latest 12wk Voids', [])
    rep_map = load_sales_rep_mappings(base_dir, sheet2_voids_raw)
    print(f"Loaded store-to-sales-rep mappings: {len(rep_map)} unique stores mapped.")

    print(f"Extracting 13v13 from: {wb13_path}")
    report1 = parse_report1(wb13_path, rep_map)
    print(f"  Report 1 TP1 Clients: {len(report1['tp1Clients'])}")
    print(f"  Report 1 TP2 Clients: {len(report1['tp2Clients'])}")
    print(f"  Report 1 Compare Clients (Union): {len(report1['compareClients'])}")
    print(f"  Report 1 Sales Reps (Sales Reps Only): {len(report1['salesReps'])}")
    print(f"  Report 1 Excel Direct Sales Reps: {len(report1['excelSalesRepsOnly'])}")

    print(f"Extracting 12wk v 12wk Preroll from: {wb12_path}")
    report2 = parse_report2(wb12_path, rep_map)
    print(f"  Report 2 Clients: {len(report2['clients'])}")
    print(f"  Report 2 Gained: {len([c for c in report2['clients'] if c['gl'] == 'G'])}")
    print(f"  Report 2 Lost: {len([c for c in report2['clients'] if c['gl'] == 'L'])}")
    print(f"  Report 2 Voids: {len(report2['voids'])}")
    print(f"  Report 2 Categories: {len(report2['categoriesSummary'])}")
    print(f"  Report 2 Reps Void Summary (Sales Reps Only): {len(report2['repsVoidSummary'])}")

    full_data = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'report1': report1,
        'report2': report2
    }

    # Write output to data/ and public/data/
    data_dir = os.path.join(base_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    json_path = os.path.join(data_dir, 'reports-data.json')
    js_path = os.path.join(data_dir, 'reports-data.js')

    json_content = json.dumps(full_data, indent=2)
    js_content = f"window.REPORTS_DATA = {json_content};\n"

    with open(json_path, 'w', encoding='utf-8') as f:
        f.write(json_content)
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(js_content)

    print(f"Wrote data to:\n  - {json_path}\n  - {js_path}")

    # Mirror to public/data if public exists
    public_data_dir = os.path.join(base_dir, 'public', 'data')
    os.makedirs(public_data_dir, exist_ok=True)
    with open(os.path.join(public_data_dir, 'reports-data.json'), 'w', encoding='utf-8') as f:
        f.write(json_content)
    with open(os.path.join(public_data_dir, 'reports-data.js'), 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"Mirrored data to public/data/")

if __name__ == '__main__':
    main()
