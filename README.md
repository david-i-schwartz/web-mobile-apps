# web-mobile-apps
AI-Generated Apps via HTML+JavaScript Files

**Web & Mobile Apps** gives single-file HTML apps live web addresses, so they open on any phone, tablet or computer and can be added to the Home Screen.

Site: https://david-i-schwartz.github.io/web-mobile-apps/

## Apps

### Websites

- [`generator/`](https://david-i-schwartz.github.io/web-mobile-apps/generator/): GEN, HTML App Generator
- [`milspeak/`](https://david-i-schwartz.github.io/web-mobile-apps/milspeak/): MIL, The Civilian's Guide to Milspeak
- [`smils/`](https://david-i-schwartz.github.io/web-mobile-apps/smils/): SMILS, SMILS — Searchable Military Speak
- [`site-shortcuts/`](https://david-i-schwartz.github.io/web-mobile-apps/site-shortcuts/): SITE, Site Shortcuts

### Games

- [`seventh/`](https://david-i-schwartz.github.io/web-mobile-apps/seventh/): SEV, Seventh
- [`one-way/`](https://david-i-schwartz.github.io/web-mobile-apps/one-way/): ONE, One Way
- [`ipar/`](https://david-i-schwartz.github.io/web-mobile-apps/ipar/): IPAR, Image, Preserve, Analyze, Report
- [`five-oclock/`](https://david-i-schwartz.github.io/web-mobile-apps/five-oclock/): SHAVE, Five O'Clock Shadow of the Colossus

### Crafts

- [`fig/`](https://david-i-schwartz.github.io/web-mobile-apps/fig/): FIG, Fusebead Image Generator
- [`big/`](https://david-i-schwartz.github.io/web-mobile-apps/big/): BIG, Brick Image Generator
- [`tig/`](https://david-i-schwartz.github.io/web-mobile-apps/tig/): TIG, Tile Image Generator
- [`iso-lab/`](https://david-i-schwartz.github.io/web-mobile-apps/iso-lab/): PIL, Pegboard Iso Lab
- [`hex-cubes/`](https://david-i-schwartz.github.io/web-mobile-apps/hex-cubes/): HEX, Hex Bead Cubes
- [`iso-designer/`](https://david-i-schwartz.github.io/web-mobile-apps/iso-designer/): ISO, Iso Bead Designer

### Music

- [`jam/`](https://david-i-schwartz.github.io/web-mobile-apps/jam/): JAM, Jam Cutter

### Teaching

- [`torah-tutor/`](https://david-i-schwartz.github.io/web-mobile-apps/torah-tutor/): TORAH, Torah Tutor
- [`torah-teacher/`](https://david-i-schwartz.github.io/web-mobile-apps/torah-teacher/): TTEACH, Torah Tutor Teacher
- [`ipar/`](https://david-i-schwartz.github.io/web-mobile-apps/ipar/): IPAR, Image, Preserve, Analyze, Report

### Administration

- [`year-planner/`](https://david-i-schwartz.github.io/web-mobile-apps/year-planner/): YRP, RIT Department Year Planner

### Home

- [`shopping-list/`](https://david-i-schwartz.github.io/web-mobile-apps/shopping-list/): SHOP, Shopping List

## How it works

- `src/` holds the published copy of each app, one HTML file each. `site.json` lists them.
- `node tools/cli.js site site.json .` builds a folder for each app: the app (`index.html`), Home Screen icons, `manifest.webmanifest`, and `sw.js`, an offline helper so the Home Screen app opens without a connection. It also builds the front page and this README.
- To add, update or remove an app, follow `AGENTS.md`. It's written for any AI assistant or person. The rules every app follows are in `HOUSE-RULES.md`.

## License

The code in this repository is licensed under the GNU General Public License v3.0 (see `LICENSE`). Anything the apps credit to others, such as colour data or trademarks, keeps its own terms.
