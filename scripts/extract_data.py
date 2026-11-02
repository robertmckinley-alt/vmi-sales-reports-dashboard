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

def parse_report1(wb13_path):
    sheets = read_xlsx_sheets(wb13_path)
    tp1_raw = sheets['TP1 5.4-8.2']
    tp2_raw = sheets['TP2 8.3-11.1']
    cmp_raw = sheets['Sheet2']
    
    # 1. TP1 Clients (rows 2 to 400)
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
            client_obj = {
                'client': name,
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

    # TP1 Sales Reps (rows 402 to 414)
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

    # 2. TP2 Clients (rows 2 to 401)
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
            client_obj = {
                'client': name,
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

    # TP2 Sales Reps (rows 403 to 415)
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

    # 3. Sheet2 Compare Clients (rows 2 to 404)
    compare_clients = []
    for r_idx, d in cmp_raw:
        if 2 <= r_idx <= 404:
            name = (d.get('A') or '').strip()
            if not name:
                continue
            order_diff = clean_int(d.get('B'))
            rev_diff = clean_float(d.get('C'))
            unit_diff = clean_int(d.get('D'))
            ave_rev_diff = clean_float(d.get('E'))
            tags = extract_tags(name)
            
            # Lookup baseline values from TP1 & TP2
            t1 = tp1_map.get(name, {})
            t2 = tp2_map.get(name, {})
            
            compare_clients.append({
                'client': name,
                'orderDiff': order_diff,
                'revDiff': rev_diff,
                'unitDiff': unit_diff,
                'aveRevDiff': ave_rev_diff,
                'isVmi': tags['isVmi'],
                'is1Wt': tags['is1Wt'],
                'chainCode': tags['chainCode'],
                'tp1Orders': t1.get('orders', 0),
                'tp1Ordered': t1.get('ordered', 0.0),
                'tp1Units': t1.get('units', 0),
                'tp1Aov': t1.get('aov', 0.0),
                'tp2Orders': t2.get('orders', 0),
                'tp2Ordered': t2.get('ordered', 0.0),
                'tp2Units': t2.get('units', 0),
                'tp2Aov': t2.get('aov', 0.0)
            })

    # Compare Total (row 405)
    cmp_total_row = next((d for r_idx, d in cmp_raw if r_idx == 405), {})
    compare_total = {
        'orderDiff': clean_int(cmp_total_row.get('B')),
        'revDiff': clean_float(cmp_total_row.get('C')),
        'unitDiff': clean_int(cmp_total_row.get('D')),
        'aveRevDiff': clean_float(cmp_total_row.get('E'))
    }

    # 4. Sales Reps Comparison (13 matched reps)
    all_rep_names = sorted(list(set(list(tp1_reps_raw.keys()) + list(tp2_reps_raw.keys()))))
    sales_reps = []
    for rep in all_rep_names:
        r1 = tp1_reps_raw.get(rep, {'orders': 0, 'ordered': 0.0, 'units': 0, 'aov': 0.0, 'rawName': rep})
        r2 = tp2_reps_raw.get(rep, {'orders': 0, 'ordered': 0.0, 'units': 0, 'aov': 0.0, 'rawName': rep})
        is_house = ' - House' in rep
        base_rep = rep.replace(' - House', '').strip()
        
        # Extract role tags
        role_matches = re.findall(r'\(([^)]+)\)', r2.get('rawName', '') or r1.get('rawName', ''))
        role = role_matches[0] if role_matches else ('House' if is_house else 'Sales')
        
        order_diff = r2['orders'] - r1['orders']
        rev_diff = round(r2['ordered'] - r1['ordered'], 2)
        unit_diff = r2['units'] - r1['units']
        aov_diff = round(r2['aov'] - r1['aov'], 2)
        
        sales_reps.append({
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
        'salesReps': sales_reps
    }

def parse_report2(wb12_path):
    sheets = read_xlsx_sheets(wb12_path)
    sheet1_raw = sheets['12wk v 12wk']
    sheet2_raw = sheets['Latest 12wk Voids']

    # 1. Parse Voids Sheet first to enable rep lookup and category indexing
    voids = []
    category_counter = {}
    cat_rep_map = {}
    rep_void_counter = {}
    rep_stores_map = {}
    client_voids_map = {}
    client_rep_map = {}

    for r_idx, d in sheet2_raw:
        if r_idx < 3:
            continue
        cat = (d.get('A') or '').strip()
        client = (d.get('B') or '').strip()
        rep = (d.get('C') or '').strip()
        if not cat or not client:
            continue
        
        tags = extract_tags(client)
        void_entry = {
            'category': cat,
            'client': client,
            'salesRep': rep,
            'isVmi': tags['isVmi'],
            'is1Wt': tags['is1Wt'],
            'chainCode': tags['chainCode']
        }
        voids.append(void_entry)

        # Track category breakdown
        category_counter[cat] = category_counter.get(cat, 0) + 1
        if cat not in cat_rep_map:
            cat_rep_map[cat] = {}
        if rep:
            cat_rep_map[cat][rep] = cat_rep_map[cat].get(rep, 0) + 1

        # Track rep void counts
        if rep and rep != '-':
            rep_void_counter[rep] = rep_void_counter.get(rep, 0) + 1
            if rep not in rep_stores_map:
                rep_stores_map[rep] = set()
            rep_stores_map[rep].add(client)

        # Track client -> categories
        if client not in client_voids_map:
            client_voids_map[client] = []
        if cat not in client_voids_map[client]:
            client_voids_map[client].append(cat)

        # Track client -> rep
        if rep and rep != '-' and client not in client_rep_map:
            client_rep_map[client] = rep

    categories_summary = []
    for cat in sorted(category_counter.keys()):
        categories_summary.append({
            'category': cat,
            'storeCount': category_counter[cat],
            'reps': cat_rep_map.get(cat, {})
        })

    reps_void_summary = []
    for rep, count in sorted(rep_void_counter.items(), key=lambda x: -x[1]):
        reps_void_summary.append({
            'rep': rep,
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

    # Rows 4 to 407 (404 client rows)
    clients = []
    client_tp2_rev_map = {}
    client_tp2_ord_map = {}

    for r_idx, d in sheet1_raw:
        if 4 <= r_idx <= 407:
            tp1_c = (d.get('A') or '').strip()
            tp2_c = (d.get('F') or '').strip()
            tp1_orders = clean_int(d.get('B'))
            tp1_ordered = clean_float(d.get('C'))
            tp1_units = clean_int(d.get('D'))
            tp1_aov = clean_float(d.get('E'))

            tp2_orders = clean_int(d.get('G'))
            tp2_ordered = clean_float(d.get('H'))
            tp2_units = clean_int(d.get('I'))
            tp2_aov = clean_float(d.get('J'))

            gl = (d.get('K') or '').strip()
            if gl not in ('G', 'L'):
                gl = None

            order_diff = clean_int(d.get('L'))
            rev_diff = clean_float(d.get('M'))
            unit_diff = clean_int(d.get('N'))
            ave_diff = clean_float(d.get('O'))

            # Resolve Client Name:
            # Clutch Cannabis formula quirk: if tp1_orders == 0 and tp2_c and tp2_c != tp1_c, use tp2_c
            if tp1_orders == 0 and tp2_c and tp2_c != tp1_c:
                resolved_name = tp2_c
                client_mismatch = True
            else:
                resolved_name = tp1_c if tp1_c else tp2_c
                client_mismatch = False

            tags = extract_tags(resolved_name)
            
            # Lookup rep from voids
            rep = client_rep_map.get(resolved_name) or client_rep_map.get(tp2_c) or client_rep_map.get(tp1_c) or 'Unassigned'
            
            # Lookup void categories
            v_cats = client_voids_map.get(resolved_name) or client_voids_map.get(tp2_c) or client_voids_map.get(tp1_c) or []

            client_tp2_rev_map[resolved_name] = tp2_ordered
            client_tp2_ord_map[resolved_name] = tp2_orders

            clients.append({
                'client': resolved_name,
                'tp1Client': tp1_c,
                'tp2Client': tp2_c,
                'clientMismatch': client_mismatch,
                'tp1Orders': tp1_orders,
                'tp1Ordered': tp1_ordered,
                'tp1Units': tp1_units,
                'tp1Aov': tp1_aov,
                'tp2Orders': tp2_orders,
                'tp2Ordered': tp2_ordered,
                'tp2Units': tp2_units,
                'tp2Aov': tp2_aov,
                'gl': gl,
                'orderDiff': order_diff,
                'revDiff': rev_diff,
                'unitDiff': unit_diff,
                'aveDiff': ave_diff,
                'isVmi': tags['isVmi'],
                'is1Wt': tags['is1Wt'],
                'chainCode': tags['chainCode'],
                'salesRep': rep,
                'voidCategories': v_cats,
                'voidCount': len(v_cats)
            })

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
        'clients': clients,
        'voids': voids,
        'categoriesSummary': categories_summary,
        'repsVoidSummary': reps_void_summary
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

    print(f"Extracting 13v13 from: {wb13_path}")
    report1 = parse_report1(wb13_path)
    print(f"  Report 1 TP1 Clients: {len(report1['tp1Clients'])}")
    print(f"  Report 1 TP2 Clients: {len(report1['tp2Clients'])}")
    print(f"  Report 1 Compare Clients: {len(report1['compareClients'])}")
    print(f"  Report 1 Sales Reps: {len(report1['salesReps'])}")

    print(f"Extracting 12wk v 12wk Preroll from: {wb12_path}")
    report2 = parse_report2(wb12_path)
    print(f"  Report 2 Clients: {len(report2['clients'])}")
    print(f"  Report 2 Gained: {len([c for c in report2['clients'] if c['gl'] == 'G'])}")
    print(f"  Report 2 Lost: {len([c for c in report2['clients'] if c['gl'] == 'L'])}")
    print(f"  Report 2 Voids: {len(report2['voids'])}")
    print(f"  Report 2 Categories: {len(report2['categoriesSummary'])}")

    full_data = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'report1': report1,
        'report2': report2
    }

    # Write output to data/ and optionally public/data/
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

    # Also mirror to public/data if public exists
    public_data_dir = os.path.join(base_dir, 'public', 'data')
    os.makedirs(public_data_dir, exist_ok=True)
    with open(os.path.join(public_data_dir, 'reports-data.json'), 'w', encoding='utf-8') as f:
        f.write(json_content)
    with open(os.path.join(public_data_dir, 'reports-data.js'), 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"Mirrored data to public/data/")

if __name__ == '__main__':
    main()
