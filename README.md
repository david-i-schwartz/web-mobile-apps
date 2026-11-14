# web-mobile-apps
AI-Generated Apps via HTML+JavaScript Files

**Web & Mobile Apps** gives single-file HTML apps live web addresses, so they open on any phone, tablet or computer and can be added to the Home Screen.

Site: https://david-i-schwartz.github.io/web-mobile-apps/

- `fig/`: FIG, Fusebead Image Generator
- `big/`: BIG, Brick Image Generator
- `tig/`: TIG, Tile Image Generator (an example made with the generator)
- `generator/`: HTML App Generator

Each folder holds the app (`index.html`), its Home Screen icons, `manifest.webmanifest` and `sw.js`. `sw.js` is an offline helper: it keeps a copy so the Home Screen app opens without a connection.

This site is built by HTML App Generator's kit (`node cli.js site site.json folder`). The master copies, specs and notes are kept elsewhere: change the apps there, then rebuild and replace this site.

## License

The code in this repository is licensed under the GNU General Public License v3.0 (see `LICENSE`). Anything the apps credit to others, such as colour data or trademarks, keeps its own terms.
