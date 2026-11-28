"""Phone and tablet checks: python3 tests/phones.py SITE_FOLDER
Serves a built site (node cli.js site ...) over http and opens it as an iPhone, an iPad, iPhone Chrome, an app's built-in
browser on iPhone and Android, Android Chrome (with and without an install prompt), a computer, an app already on the
Home Screen, a file, a page inside another page, and a phone's file preview (no scripts). Chromium stands in for each:
it checks the app's logic and wording, not Safari itself, so a real iPhone and iPad check is still needed."""
import http.server, json, os, re, socketserver, sys, threading, functools, zipfile, io
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
SITE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'web-mobile-apps'))
fails = []
def check(ok, what):
    print(('  ok   ' if ok else '  FAIL ') + what)
    if not ok: fails.append(what)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=SITE)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{port}/'
CFG = os.path.join(SITE, 'site.json')
FOLDERS = [a.get('folder') or a.get('code', '').lower() for a in json.load(open(CFG))['apps']] if os.path.exists(CFG) else ['fig', 'big', 'tig', 'generator']
OTHERS = [f for f in FOLDERS if f != 'tig' and 'id="hh-helper"' in open(os.path.join(SITE, f, 'index.html'), encoding='utf-8').read()]
UA = {
  'iphone': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1',
  'ipad': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15',
  'iphone-27': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1',
  'iphone-18': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  'iphone-chrome': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  'iphone-gmail': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  'android': 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'android-app': 'Mozilla/5.0 (Linux; Android 15; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36',
}
def open_as(br, who, path, w=390, h=844, touch=True, init='', js=True):
    ctx = br.new_context(viewport={'width': w, 'height': h}, user_agent=UA.get(who), has_touch=touch, is_mobile=touch and who != 'ipad', java_script_enabled=js, accept_downloads=True)
    if init: ctx.add_init_script(init)
    pg = ctx.new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'service' not in m.text.lower() else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(path if path.startswith(('http', 'file')) else BASE + path); pg.wait_for_timeout(500)
    return ctx, pg, errs
card = lambda pg: pg.locator('#hh')

with sync_playwright() as p:
    br = p.chromium.launch()
    print('== the front page')
    ctx, pg, errs = open_as(br, 'iphone', '')
    hrefs = pg.eval_on_selector_all('.app', 'els => els.map(e => e.getAttribute("href").replace(/\\/$/, ""))')
    TITLE = (json.load(open(CFG)).get('app') or {}).get('name') or 'Web & Mobile Apps' if os.path.exists(CFG) else 'Web & Mobile Apps'
    check(pg.title() == TITLE and sorted(set(hrefs)) == sorted(FOLDERS), f'front page lists the {len(FOLDERS)} apps')
    icons = pg.eval_on_selector_all('link[rel~="icon"], link[rel="apple-touch-icon"]', 'els => els.map(e => e.getAttribute("href"))')
    check(sorted(icons) == ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png'] and all(open(os.path.join(SITE, f), 'rb').read(4) == b'\x89PNG' for f in icons),
          'the front page has its own Home Screen icon, not an app\'s')
    SECTIONS = [(s if isinstance(s, str) else s.get('name', '')).strip() for s in json.load(open(CFG)).get('sections', [])] if os.path.exists(CFG) else []
    if SECTIONS:
        heads = [h.strip() for h in pg.locator('.sec > h2').all_inner_texts()]
        check(heads == [s for s in SECTIONS if s in heads] and 'More Apps' not in heads, 'sections in order, every app in one: ' + ', '.join(heads))
        jumps = pg.eval_on_selector_all('.jump a', 'els => els.map(e => [e.getAttribute("href"), !!document.querySelector(e.getAttribute("href"))])')
        check(len(jumps) == len(heads) and all(ok for _, ok in jumps), 'each section link at the top goes to its section')
        check(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'nothing sticks out sideways at phone width')
        pg.locator('.jump a').last.click(); pg.wait_for_timeout(300)
        check(pg.url.endswith(jumps[-1][0]), 'tapping a section link jumps to it')
        pg.screenshot(path=os.path.join(OUT, 'site-iphone-front.png'), full_page=True)
        pg.goto(BASE); pg.wait_for_timeout(300)
    ins = pg.locator('#instructions')
    check(ins.count() == 1 and not ins.evaluate('e => e.open'), 'an Instructions button, closed to start')
    ins.locator('summary').first.click(); pg.wait_for_timeout(150); t = ins.inner_text()
    check(ins.evaluate('e => e.open') and pg.evaluate('document.querySelector(\'.dev[data-dev="ios"]\').open') and all(w in t for w in ['Open in Safari', 'Share', 'Add to Home Screen', 'Tap Add']),
          'Instructions opens with the iPhone and iPad steps showing (Open in Safari, Share, Add to Home Screen, Add)')
    pg.screenshot(path=os.path.join(OUT, 'site-iphone-instructions.png'))
    ins.locator('summary').first.click(); pg.locator('.more a[href="#instructions"]').click(); pg.wait_for_timeout(150)
    check(ins.evaluate('e => e.open'), 'the link at the bottom opens Instructions')
    pg.goto(BASE); pg.wait_for_timeout(300)
    first = hrefs[0]
    check(all(pg.evaluate(f"fetch('{f}/icon-192.png').then(r=>r.ok)") for f in FOLDERS), 'every app has its icon')
    for f in FOLDERS:
        m = json.loads(pg.evaluate(f"fetch('{f}/manifest.webmanifest').then(r=>r.text())"))
        check(m['display'] == 'standalone' and m['start_url'] == './' and len(m['icons']) == 3, f'{f}: manifest ' + m['name'])
    pg.locator('.app').first.click(); pg.wait_for_timeout(600)
    check(pg.url.endswith('/' + first + '/'), 'tapping an app opens it')
    pg.screenshot(path=os.path.join(OUT, 'site-iphone-fig.png')); ctx.close()

    HUB = (json.load(open(CFG)).get('app') or None) if os.path.exists(CFG) else None
    TIGV = json.loads(re.search(r'<script type="application/json" id="app-spec">(.*?)</script>', open(os.path.join(SITE, 'tig', 'index.html'), encoding='utf-8').read(), re.S).group(1))['version']
    how = lambda pg: ' '.join(pg.locator('#homeHow').text_content().split())
    if not HUB:
        print('== iPhone Safari (TIG, made by the generator)')
        ctx, pg, errs = open_as(br, 'iphone', 'tig/')
        check(card(pg).is_visible(), 'the Home Screen card shows')
        t = card(pg).inner_text()
        check('Put TIG on your Home Screen' in t and 'Share' in t and 'Add to Home Screen' in t and 'Add' in t, 'it says Share, Add to Home Screen, Add')
        check('Best done before you start' in t, 'it says to do it before starting (the Home Screen app keeps its own copy)')
        pg.screenshot(path=os.path.join(OUT, 'phone-iphone-tig.png'))
        card(pg).locator('[data-hh="later"]').click(); pg.wait_for_timeout(100)
        check(card(pg).count() == 0, 'Not now hides it')
        pg.reload(); pg.wait_for_timeout(500)
        check(card(pg).count() == 0, 'and it stays hidden after a reload')
        check('Share' in pg.locator('#homeHow').text_content(), 'the steps are still under On your phone')
        check(not errs, 'no console errors: ' + '; '.join(errs[:3])); ctx.close()
        print('== iPad (reports itself as a Mac with a touch screen)')
        ctx, pg, errs = open_as(br, 'ipad', 'tig/', 1024, 1366, init="Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5})")
        t = card(pg).inner_text() if card(pg).count() else ''
        check('top right' in t and 'Add to Home Screen' in t, 'iPad steps point to the Share button at the top right')
        pg.screenshot(path=os.path.join(OUT, 'phone-ipad-tig.png')); ctx.close()
        print('== iPhone Chrome')
        ctx, pg, errs = open_as(br, 'iphone-chrome', 'tig/')
        t = card(pg).inner_text(); check('address bar' in t and 'Add to Home Screen' in t, 'Chrome on iPhone: Share is in the address bar or the menu'); ctx.close()
        print('== inside another app on iPhone (for example Gmail)')
        ctx, pg, errs = open_as(br, 'iphone-gmail', 'tig/')
        t = card(pg).inner_text()
        check('inside another app' in t and 'Open in Safari' in t and card(pg).locator('[data-hh="copy"]').count() == 1, 'says to open it in Safari, with Copy link')
        pg.screenshot(path=os.path.join(OUT, 'phone-iphone-inapp-tig.png')); ctx.close()
    else:
        S, N = HUB['short'], HUB['name']
        print(f'== iPhone Safari (TIG), on a site with a launcher ({S})')
        ctx, pg, errs = open_as(br, 'iphone', 'tig/')
        check(card(pg).is_visible(), 'the card shows')
        t = card(pg).inner_text(); go = card(pg).locator('a.hh-go')
        check(f'Get All of {N}' in t and f'Put {S} on your Home Screen' in t and 'No Share button? Open this page in Safari first.' in t, f'it offers {S}: every app behind one icon, and says to use Safari')
        check(go.inner_text() == 'Show Me How' and go.get_attribute('href') == '../install/', 'Show Me How goes to the pictures, by a relative link')
        check(all(card(pg).locator(f'[data-hh="{b}"]').count() == 1 for b in ('done', 'later')), 'it has Already Did It and Not Now')
        r = [b.bounding_box() for b in card(pg).locator('a, button').all()]; check(all(b['height'] >= 43.5 and b['width'] >= 43.5 for b in r), 'its buttons are at least 44 px')
        pg.screenshot(path=os.path.join(OUT, 'phone-iphone-tig.png'))
        t = how(pg)
        check('to the right of the address bar' in t and 'Add to Home Screen' in t and 'Edit Actions' in t and 'Open as Web App' in t and 'Best done before you start' in t,
              'On Your Phone has the steps for this Safari (26: the three dots), Edit Actions and Open as Web App')
        check(pg.locator('#homeHow a[href="../install/"]').count() == 1 and pg.locator('#homeHow a[href="../"]').count() == 1, f'and offers {S} instead, with Show me how')
        check(pg.locator('#homeHow [data-hh="fresh"]').count() == 1, 'On Your Phone has Get the Newest Version')
        card(pg).locator('[data-hh="later"]').click(); pg.wait_for_timeout(100); pg.reload(); pg.wait_for_timeout(500)
        check(card(pg).count() == 0, 'Not Now hides it, also after a reload')
        check(not errs, 'no console errors: ' + '; '.join(errs[:3])); ctx.close()
        ctx, pg, errs = open_as(br, 'iphone', 'tig/')
        card(pg).locator('[data-hh="done"]').click(); pg.wait_for_timeout(100)
        check(pg.evaluate("localStorage.getItem('tig:homeHint')") == 'done', 'Already Did It is remembered for good, under the app\'s own key')
        pg.evaluate("localStorage.setItem('tig:homeHint','done')"); pg.reload(); pg.wait_for_timeout(400); check(card(pg).count() == 0, 'and the card stays away'); ctx.close()
        for ua, want, what in [('iphone-27', 'left end of the address bar', 'Safari 27: the button at the left end of the address bar'),
                               ('iphone-18', 'Tap Share.', 'Safari 18: Share in the bar')]:
            ctx, pg, errs = open_as(br, ua, 'tig/'); check(want in how(pg), what); ctx.close()
        print('== iPad (reports itself as a Mac with a touch screen)')
        ctx, pg, errs = open_as(br, 'ipad', 'tig/', 1024, 1366, init="Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5})")
        t = how(pg); check('top right' in t and 'View More' in t and card(pg).count() == 1 and f'Get All of {N}' in card(pg).inner_text(), f'iPad: Share at the top right, then View More; the card offers {S}')
        pg.screenshot(path=os.path.join(OUT, 'phone-ipad-tig.png')); ctx.close()
        print('== iPhone Chrome')
        ctx, pg, errs = open_as(br, 'iphone-chrome', 'tig/')
        check('address bar' in how(pg) and 'Add to Home Screen' in how(pg), 'Chrome on iPhone: Share is in the address bar or the menu'); ctx.close()
        print('== inside another app on iPhone (for example Gmail)')
        ctx, pg, errs = open_as(br, 'iphone-gmail', 'tig/')
        t = card(pg).inner_text()
        check('open inside another app' in t and 'Open in Safari' in t and card(pg).locator('a.hh-go').count() == 1, 'says to open it in Safari first, with Show Me How')
        check(pg.locator('#homeHow [data-hh="copy"]').count() == 1, 'On Your Phone has Copy link')
        pg.screenshot(path=os.path.join(OUT, 'phone-iphone-inapp-tig.png')); ctx.close()
        print(f'== opened from inside the installed {S}')
        flag = "Object.defineProperty(navigator,'standalone',{get:()=>true});sessionStorage.setItem('dis:in','1');"
        for f in ['tig', 'fig', 'miko']:
            ctx, pg, errs = open_as(br, 'iphone', f + '/', init=flag)
            bar = pg.locator('#hh-bar'); back = bar.locator('a')
            check(bar.is_visible() and back.inner_text() == '‹ ' + S and back.get_attribute('href') == '../' and card(pg).count() == 0, f'{f}: ‹ {S} at the top left, no card')
            r = [b.bounding_box() for b in bar.locator('a, button').all()]; check(all(b['height'] >= 43.5 and b['width'] >= 43.5 for b in r), f'{f}: ‹ {S} and ↻ are at least 44 px')
            if f == 'tig':
                pg.screenshot(path=os.path.join(OUT, 'phone-in-dis-tig.png'))
                bar.locator('button').click(); pg.wait_for_timeout(900)
                check(pg.locator('#hh-toast').count() == 1 and f'TIG is up to date: version {TIGV}.' in pg.locator('#hh-toast').inner_text(), f'↻ reloads, then says TIG is up to date: version {TIGV}')
            if f == 'miko':
                back.click(); pg.wait_for_timeout(500); check(pg.url == BASE, f'‹ {S} goes back to the list')
            check(not errs, f'{f}: no console errors: ' + '; '.join(errs[:3])); ctx.close()
        ctx, pg, errs = open_as(br, 'iphone', 'tig/', init="Object.defineProperty(navigator,'standalone',{get:()=>true});")
        check(pg.locator('#hh-bar').count() == 0, f'installed on its own (not from {S}): no ‹ {S} button, since it would leave the app'); ctx.close()

    print('== Android Chrome')
    ctx, pg, errs = open_as(br, 'android', 'tig/')
    t = card(pg).inner_text(); check('Add to Home screen' in t and 'Install app' in t, 'Android steps without an install prompt')
    pg.evaluate("""()=>{const e=new Event('beforeinstallprompt');window.__asked=0;e.prompt=()=>{window.__asked++};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e)}""")
    pg.wait_for_timeout(100)
    btn = card(pg).locator('[data-hh="install"]'); check(btn.count() == 1 and 'Install TIG' in btn.inner_text(), 'an Install TIG button when Chrome offers to install')
    btn.click(); pg.wait_for_timeout(200)
    check(pg.evaluate('window.__asked') == 1 and card(pg).count() == 0, 'Install asks Chrome, then the card goes away')
    check(not errs, 'no console errors: ' + '; '.join(errs[:3])); ctx.close()

    print('== inside another app on Android')
    ctx, pg, errs = open_as(br, 'android-app', 'tig/')
    check('Open in Chrome' in card(pg).inner_text(), 'says to open it in Chrome'); ctx.close()

    print('== a computer')
    ctx, pg, errs = open_as(br, None, 'tig/', 1280, 900, touch=False)
    check(card(pg).count() == 0, 'no card on a computer')
    how = pg.locator('#homeHow').text_content()
    check('On a phone or tablet, open' in how and 'tig/' in how, 'On your phone gives the address to open on a phone: ' + how[:80]); ctx.close()

    print('== already on the Home Screen')
    ctx, pg, errs = open_as(br, 'iphone', 'tig/', init="Object.defineProperty(navigator,'standalone',{get:()=>true})")
    check(card(pg).count() == 0 and 'is on your Home Screen' in pg.locator('#homeHow').text_content(), 'no card, and it says it is on the Home Screen'); ctx.close()

    print('== opened as a file')
    ctx, pg, errs = open_as(br, 'iphone', 'file://' + os.path.join(SITE, 'tig', 'index.html'))
    how = pg.locator('#homeHow').text_content()
    check(card(pg).count() == 0 and 'as a file' in how and 'https://david-i-schwartz.github.io/web-mobile-apps/tig/' in how, 'no card; it points to the web address'); ctx.close()

    print('== a phone\'s file preview (scripts off)')
    ctx, pg, errs = open_as(br, 'iphone', 'file://' + os.path.join(SITE, 'tig', 'index.html'), js=False)
    check(pg.is_visible('#nojsNote') and not pg.is_visible('main'), 'only the note shows, not a dead app')
    href = pg.locator('#nojsNote a').get_attribute('href'); check(href == 'https://david-i-schwartz.github.io/web-mobile-apps/tig/', 'the note links to the web address: ' + str(href))
    pg.screenshot(path=os.path.join(OUT, 'phone-preview-no-scripts.png')); ctx.close()
    ctx, pg, errs = open_as(br, 'iphone', 'tig/', js=True)
    check(not pg.is_visible('#nojsNote') and pg.is_visible('main'), 'with scripts on, the note is hidden'); ctx.close()

    print('== inside another page (as in Claude or the generator preview)')
    ctx, pg, errs = open_as(br, 'iphone', 'generator/')
    fr = pg.frame_locator('#pv'); pg.wait_for_timeout(800)
    check(fr.locator('#appTitle').count() == 1 and fr.locator('#hh').count() == 0, 'no card inside the preview')
    check(card(pg).count() == 1, 'the generator page itself shows its card')
    # the generator's web folder download
    pg.locator('#hh [data-hh="later"]').click()
    with pg.expect_download() as d: pg.click('#getWeb')
    z = zipfile.ZipFile(io.BytesIO(open(d.value.path(), 'rb').read())); names = sorted(z.namelist())
    check(names == ['tig/apple-touch-icon.png', 'tig/icon-192.png', 'tig/icon-512.png', 'tig/index.html', 'tig/manifest.webmanifest', 'tig/sw.js'], 'web folder zip: ' + ', '.join(names))
    check(z.read('tig/icon-192.png')[:4] == b'\x89PNG' and b'rel="manifest"' in z.read('tig/index.html'), 'icons are PNGs and the page links its manifest')
    check(not errs, 'no console errors: ' + '; '.join(errs[:3])); ctx.close()

    print('== apps the generator didn\'t make still work with the helper added (iPhone)')
    for f in OTHERS:
        ctx, pg, errs = open_as(br, 'iphone', f + '/')
        check(card(pg).is_visible() and 'Put ' in card(pg).inner_text(), f'{f}: the Home Screen card shows')
        check(not errs, f'{f}: no console errors: ' + '; '.join(errs[:3])); ctx.close()
    br.close()
srv.shutdown()
print('\n' + ('All checks passed.' if not fails else f'{len(fails)} checks failed.')); sys.exit(1 if fails else 0)
