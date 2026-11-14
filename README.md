# web-mobile-apps
AI-Generated Apps via HTML+JavaScript Files

**Web & Mobile Apps** gives single-file HTML apps live web addresses, so they open on any phone, tablet or computer and can be added to the Home Screen.

Site: https://david-i-schwartz.github.io/web-mobile-apps/

- [`fig/`](https://david-i-schwartz.github.io/web-mobile-apps/fig/): FIG, Fusebead Image Generator
- [`big/`](https://david-i-schwartz.github.io/web-mobile-apps/big/): BIG, Brick Image Generator
- [`tig/`](https://david-i-schwartz.github.io/web-mobile-apps/tig/): TIG, Tile Image Generator
- [`generator/`](https://david-i-schwartz.github.io/web-mobile-apps/generator/): GEN, HTML App Generator

## How it works

- `src/` holds the published copy of each app, one HTML file each. `site.json` lists them.
- `node tools/cli.js site site.json .` builds a folder for each app: the app (`index.html`), Home Screen icons, `manifest.webmanifest`, and `sw.js`, an offline helper so the Home Screen app opens without a connection. It also builds the front page and this README.
- To add, update or remove an app, follow `AGENTS.md`. It's written for any AI assistant or person. The rules every app follows are in `HOUSE-RULES.md`.

## License

The code in this repository is licensed under the GNU General Public License v3.0 (see `LICENSE`). Anything the apps credit to others, such as colour data or trademarks, keeps its own terms.
