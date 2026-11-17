"""House-rule checks: python3 tools/tests/house_rules.py SITE_FOLDER [APP_FOLDER ...]
Serves a built site (node tools/cli.js site ...) over http and checks each app against the house rules that code can test:
  rule 1  no requests to other sites, while the app loads and while every visible button is pressed
  rule 4  every browser-storage key starts with one of the app's prefixes
  rule 6  nothing wider than a 380 px phone, and touch targets at least 44 x 44 px
  rule 7  every control and picture has an accessible name, and the page declares its language
  and no console errors at phone and desktop sizes, in light and dark mode.
Runs are repeatable: Math.random is replaced by a fixed-seed generator, and buttons are pressed in page order.
Known problems can be waived in house-rules.json. Each waiver gives a reason and an expiry date, and for counted
problems the most it covers, so it never hides a new one. Writes tools/tests/out/house-rules.json.
Needs Python with Playwright and Chromium, like phones.py."""
import datetime, functools, http.server, json, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
SITE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
CFG = json.load(open(os.path.join(HERE, 'house-rules.json'), encoding='utf-8'))
APPS = {(a.get('folder') or a.get('code', '').lower()): a for a in json.load(open(os.path.join(SITE, 'site.json'), encoding='utf-8'))['apps']}
TARGETS = sys.argv[2:] or list(APPS)
TODAY = datetime.date.today().isoformat()
WAIVERS = {w['id']: w for w in CFG.get('waivers', [])}
results = []

def check(cid, problems, what):
    n = len(problems); w = WAIVERS.get(cid); note = ''
    if not n:
        status = 'ok'
        if w: note = ' (its waiver is no longer needed)'
    elif w and w['expires'] >= TODAY and n <= w.get('max', n):
        status = 'WAIVED'; note = f" (waived until {w['expires']}: {w['reason']})"
    else:
        status = 'FAIL'
        if w and w['expires'] < TODAY: note = f" (waiver expired {w['expires']})"
        elif w: note = f" (waiver covers {w['max']}, found {n})"
    print(f'  {status:<6} {cid}: {what}' + (f' [{n}]' if n else '') + note)
    for p in problems[:6]: print('           - ' + p)
    if n > 6: print(f'           ... and {n - 6} more')
    results.append({'id': cid, 'status': status, 'what': what, 'count': n, 'problems': problems})

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=SITE)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{port}/'
LOCAL = (BASE, 'data:', 'blob:', 'about:')

# Same random numbers every run, and a record of every storage key the page writes.
INIT = """(() => {
  let s = 42; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__keys = []; const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { window.__keys.push(String(k)); return set.call(this, k, v); };
})();"""
DESCRIBE = """el => { const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 24);
  return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList[0] ? '.' + el.classList[0] : '') + (t ? ` "${t}"` : ''); }"""
LAYOUT = """() => { const describe = %s; const W = document.documentElement.clientWidth;
  const over = document.documentElement.scrollWidth - W, wide = [];
  if (over > 0) for (const el of document.querySelectorAll('body *')) {
    if (!el.checkVisibility()) continue; const r = el.getBoundingClientRect();
    const p = el.parentElement && el.parentElement.getBoundingClientRect();
    if (r.width && r.right > W + 1 && !(p && p.right > W + 1)) wide.push(describe(el) + ` reaches ${Math.round(r.right)} px`);
  }
  const small = [], sel = 'button, select, textarea, input:not([type=hidden]), summary, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio]';
  for (const el of document.querySelectorAll(sel)) {
    if (!el.checkVisibility()) continue; let r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if ((el.type === 'checkbox' || el.type === 'radio') && el.closest('label')) r = el.closest('label').getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) small.push(describe(el) + ` is ${Math.round(r.width)} x ${Math.round(r.height)}`);
  }
  return { over, wide, small, lang: document.documentElement.lang }; }""" % DESCRIBE
NAMED_ROLES = {'button', 'checkbox', 'combobox', 'textbox', 'searchbox', 'slider', 'spinbutton', 'radio', 'link',
               'switch', 'menuitem', 'tab', 'listbox', 'image', 'img'}

def open_app(br, folder, w, h, scheme):
    ctx = br.new_context(viewport={'width': w, 'height': h}, color_scheme=scheme, accept_downloads=True)
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE.rstrip('/'))
    ctx.add_init_script(INIT); pg = ctx.new_page(); errs = []; reqs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'service' not in m.text.lower() else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.dismiss())
    pg.on('filechooser', lambda f: None)
    ctx.on('request', lambda r: reqs.append(r.url))
    pg.goto(BASE + folder + '/'); pg.wait_for_timeout(600)
    return ctx, pg, errs, reqs

def unnamed_controls(ctx, pg):
    cdp = ctx.new_cdp_session(pg); out = []
    for n in cdp.send('Accessibility.getFullAXTree')['nodes']:
        role = (n.get('role') or {}).get('value'); name = str((n.get('name') or {}).get('value', '')).strip()
        if n.get('ignored') or role not in NAMED_ROLES or name: continue
        desc = role
        if n.get('backendDOMNodeId'):
            node = cdp.send('DOM.describeNode', {'backendNodeId': n['backendDOMNodeId']})['node']
            attrs = dict(zip(node.get('attributes', [])[::2], node.get('attributes', [])[1::2]))
            desc = f"{role}: {node['nodeName'].lower()}" + (f"#{attrs['id']}" if attrs.get('id') else '') + (f".{attrs['class'].split()[0]}" if attrs.get('class') else '')
        out.append(desc)
    return out

def press_buttons(pg, folder, limit=80):
    pressed = 0
    for i in range(limit):
        btns = pg.locator('button:visible:not([disabled])')
        if i >= btns.count(): break
        try: btns.nth(i).click(timeout=800, no_wait_after=True); pg.wait_for_timeout(80); pressed += 1
        except Exception: pass
        if not pg.url.startswith(BASE + folder + '/'):  # a button left the app; come back and carry on
            pg.goto(BASE + folder + '/'); pg.wait_for_timeout(400)
    return pressed

with sync_playwright() as p:
    br = p.chromium.launch()
    for folder in TARGETS:
        app = APPS[folder]; code = (app.get('code') or folder).upper()
        prefixes = CFG.get('storage_prefixes', {}).get(folder) or [code.lower() + ':']
        print(f'== {folder} ({code})')
        load_errs = []
        for w, h, scheme, label in [(380, 844, 'light', 'phone'), (380, 844, 'dark', 'phone, dark'), (1280, 900, 'light', 'desktop'), (1280, 900, 'dark', 'desktop, dark')]:
            ctx, pg, errs, reqs = open_app(br, folder, w, h, scheme)
            load_errs += [f'{label}: {e[:160]}' for e in errs]
            if label == 'phone':
                lay = pg.evaluate(LAYOUT)
                check(f'{folder}/r6-fits-380', [f"page is {lay['over']} px wider than the screen"] + lay['wide'] if lay['over'] > 0 else [], 'nothing wider than a 380 px phone')
                check(f'{folder}/r6-touch-44', lay['small'], 'touch targets at least 44 x 44 px')
                check(f'{folder}/r7-names', unnamed_controls(ctx, pg), 'every control and picture has an accessible name')
                check(f'{folder}/r7-lang', [] if lay['lang'] else ['<html> has no lang attribute'], 'the page declares its language')
                pg.screenshot(path=os.path.join(OUT, f'house-{folder}-phone.png'))
                n0 = len(errs); pressed = press_buttons(pg, folder)
                check(f'{folder}/errors-while-pressing', [e[:160] for e in errs[n0:]], f'no console errors while pressing {pressed} buttons')
                check(f'{folder}/r1-no-network', sorted({u[:120] for u in reqs if not u.startswith(LOCAL)}), 'no requests to other sites')
                keys = sorted(set(pg.evaluate('window.__keys') + pg.evaluate('Object.keys(localStorage)') + pg.evaluate('Object.keys(sessionStorage)')))
                check(f'{folder}/r4-storage-prefix', [k for k in keys if not k.startswith(tuple(prefixes))],
                      f"storage keys start with {' or '.join(prefixes)} ({len(keys)} key{'s' if len(keys) != 1 else ''} seen)")
            ctx.close()
        check(f'{folder}/errors-on-load', load_errs, 'no console errors on load, phone and desktop, light and dark')
    br.close()
srv.shutdown()
for wid in WAIVERS:
    if wid.split('/')[0] in TARGETS and wid not in {r['id'] for r in results}: print(f'  note   waiver {wid} matches no check')
json.dump({'date': TODAY, 'site': SITE, 'apps': TARGETS, 'results': results}, open(os.path.join(OUT, 'house-rules.json'), 'w'), indent=1)
fails = [r for r in results if r['status'] == 'FAIL']; waived = [r for r in results if r['status'] == 'WAIVED']
print('\n' + (f'{len(fails)} checks failed.' if fails else 'All checks passed.') + (f' {len(waived)} waived.' if waived else ''))
sys.exit(1 if fails else 0)
