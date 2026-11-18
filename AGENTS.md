# Working on Web & Mobile Apps

Instructions for any AI assistant (Claude, ChatGPT, Gemini, Qwen, Copilot or another) and for people. Follow them when adding, updating or removing an app.

This repository is the public site **Web & Mobile Apps**: https://david-i-schwartz.github.io/web-mobile-apps/
It gives single-file HTML apps a web address, so they open on any phone, tablet or computer and can be added to the Home Screen. GitHub Pages serves the `main` branch as it is.

## Layout

- `src/` holds the published copy of each app: one HTML file per app. The master copies live in the owner's RIT Google Drive, under `Claude Apps`.
- `site.json` lists the apps: which file, which folder, and the name and colour for apps that don't carry a spec.
- `tools/` is the build tool, from HTML App Generator's kit. It needs Node 18 or later and nothing to install.
- `fig/`, `big/` and the other app folders, plus `index.html` (the front page) and `README.md`, are **built**. Never edit them by hand: every build rewrites them.
- `HOUSE-RULES.md` lists the rules every app follows. Read it.
- `LICENSE` is GPL-3.0. Don't change it.

## Add an app

1. **Get the app as one HTML file** that follows `HOUSE-RULES.md`: one file, no outside code, fonts or pictures, no network calls (apart from an optional AI helper the person sets up, as rule 1 allows), and it works in a browser by itself. Open it in a browser and check that the console shows no errors.
2. **Choose a folder name**: lowercase letters, digits and hyphens, for example `milspeak`. This becomes the web address `.../web-mobile-apps/milspeak/`.
3. **Save the file** as `src/<folder>.html`.
4. **Add it to `site.json`**, inside `"apps"`:
   ```json
   {"file": "src/milspeak.html", "folder": "milspeak", "code": "MIL", "name": "Civilian's Guide to Milspeak",
    "tagline": "One plain sentence about what it does.", "accent": "#2E5AAC", "section": "Websites"}
   ```
   - `section`: where the app goes on the front page. Use one of the names in `"sections"` at the top of `site.json`: Websites, Games, Crafts, Teaching or Administration. To show an app in two sections, give a list, such as `["Games", "Teaching"]`. If you aren't sure which fits, ask the owner. An app without a section still builds, but it lands under More Apps and the build prints a note.
   - `code`: 2 to 6 capital letters or digits. It's drawn as beads on the Home Screen icon.
   - `accent`: the app's main colour. If you leave it out, the build uses the page's `--accent` colour, or teal.
   - An app made with HTML App Generator has a spec inside it, so `file` and `folder` are enough.
5. **Build**, from the repository's top folder:
   ```
   node tools/cli.js site site.json .
   ```
   This makes `<folder>/` with `index.html`, the Home Screen icons, `manifest.webmanifest` and `sw.js` (an offline helper). It adds the Home Screen helper to apps that don't have it, and rewrites the front page and `README.md`. The app's own code is not changed.
6. **Check it.** Serve the folder (`python3 -m http.server 8000`) and open `http://localhost:8000/<folder>/` at a phone size (390 px wide) and a desktop size, with no console errors. If Python with Playwright and Chromium is available, also run `python3 tools/tests/phones.py .`. It must end with "All checks passed."
7. **Commit and push to `main`**: the `src/` file, `site.json`, the new folder, `index.html` and `README.md`. Use a short message, such as "Add MIL: Civilian's Guide to Milspeak". The site updates in a minute or two.
8. **Tell the owner** the new address. Remind them that the master copy belongs in RIT Drive, in `Claude Apps / <app's folder>`.

## Update an app

Replace `src/<folder>.html` with the new version. Then build, check, commit and push, as in steps 5 to 7. People who added the app to their Home Screen get the new version the next time they open it online.

## Move an app or change the sections

To move an app, change its `section` in `site.json`. To add, rename or reorder sections, edit `"sections"` (each has a `name` and a one-line `blurb`; the front page shows them in that order) and update the apps that use them. Then build, check, commit and push. Only `index.html` and `README.md` should change.

## Update the generator's core

When HTML App Generator gets a new version, do these steps in one commit:
1. Copy the new kit's `cli.js`, `generate.js`, `web.js`, `core/` and `html/` into `tools/`. The kit is on RIT Drive as `html-app-generator-<version>-kit.zip`. Check that the new kit's `cli.js` and `web.js` still support `"sections"` (the front page sections, added here on 17 Nov 2026); if they don't, keep this repository's versions of those two files and `tests/phones.py`, or the front page goes back to one long list.
2. Put the new generator page in `src/generator.html`.
3. Build. Apps made with the generator are remade on the new core automatically.

## Keep src/, tools/ and the site in step

The built folders must always be exactly what `node tools/cli.js site site.json .` makes from `src/`, `site.json` and `tools/`. So:
- **Never commit built folders without their sources.** If you publish an app, its file goes in `src/` in the same commit.
- **After building, run `git status`.** It should list only the files you meant to change. If other apps' folders changed too, `src/` or `tools/` were out of date. Stop and find out why before you push.

## Remove an app

Delete its entry in `site.json`, its `src/` file and its built folder. Then build, check, commit and push.

## Don't

- Don't edit built files (`index.html`, `README.md`, the app folders). Change `src/` or `site.json`, then build.
- Don't commit notes, plans, personal data, passwords or anything private. This repository is public.
- Don't publish an app the owner marks private, confidential or under a non-disclosure agreement, and don't mention it here either. If you aren't sure an app may be public, ask the owner first.
- Don't add libraries, trackers, analytics or anything that loads from another site.
- Don't remove `tig` (the reference app the tests use), `tools/` or `LICENSE`.

## If you can't push to GitHub

Prepare the HTML file, check it against `HOUSE-RULES.md`, and give it to the owner with the `site.json` entry from step 4. The owner, or an assistant that can reach the repository, then does steps 3 to 8.
