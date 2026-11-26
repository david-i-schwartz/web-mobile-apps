# House rules

These are the rules for FIG, BIG, every app made with HTML App Generator, and CIG. Any AI assistant (Claude, ChatGPT, Gemini, Qwen or another) and any person working on these products should follow them. Nothing here depends on one AI.

Rules 1 to 18 are written for single-file HTML apps. A product of another kind follows them too, except where its own section at the end of this file changes one. Each repository's `AGENTS.md` says which section applies to it. This file is the same in every repository that carries it and in RIT Drive `Claude Apps`: change it in one place, then copy it to the others.

## The app

1. **One HTML file.** No server, no build step to run it, no network calls. No outside code, fonts or pictures: everything is inline. One exception: an **optional AI helper** that the person turns on and points at an AI service they choose (a campus AI gateway, a model on their own computer, or a commercial API). The app works fully without it, contacts nothing until the person sets it up, says plainly what it sends and where, and keeps any key in that browser only. Such an app may also look for a settings file in its own folder (for example Mechanics Overlay Lab's `ai-config.json`), so a school can point every copy at one AI.
2. **Works without any AI.** The file runs by itself in any modern browser, on a phone or a computer, with no account and no AI. Hosting inside Claude is a convenience, not a requirement.
3. **No other apps' code or assets.** Don't take code, pictures, fonts or colour lists from other apps or sites unless they are explicitly offered free, and credit them in Credits. Colour data is either made for the app or comes from a source that offers it free.
4. **Everything stays in the browser.** Nothing is uploaded. Storage (localStorage) is best effort, keys start with the app's short name (`fig:`, `big:`), and the app says plainly when the browser isn't keeping work.
5. **Files the person saves** go through `saveFile(name, blob, messageElement)`. It uses the host's download prompt where there is one and an ordinary download everywhere else.
6. **Phone first.** It works at 380 px wide, touch targets are at least 44 px, and nothing needs hover. Light and dark mode both work.
7. **Plain words and access for everyone.** Short, plain interface text. Every control has a label, changes are announced to screen readers, focus is visible, and the keyboard works on the grid.
8. **Old work keeps opening.** Project files and saved settings from earlier versions still open. New fields get defaults, and everything read from a file or from storage is checked and tidied first.
9. **Every version says what changed.** Raise the version, set the date, and add a line to About This Version. Add credits and Learn the Ideas links for new ideas.

10. **One way of laying out the page.** Section headings are in Title Case ("Save and Open", "Learn the Ideas"). Every section with a heading folds up; reference sections start closed. Tapping a heading opens or closes its section, the app remembers how each one was left, and Learn the Ideas, On Your Phone, About This Version and Credits start closed. The help by the grid is one tip in labelled parts (placing cells, Sizing, then Views when the app has views), and a ? beside the zoom buttons opens the same tip, centred on them. A section's ? help starts by saying what the section is or does, in plain words. A view that needs a setting (BIG's Heights needs Relief) says so where it shows and offers to turn it on. Getting a picture in works the same everywhere: one Choose image button at a time (on the grid until there is a picture, then Choose another image in the panel), a paste box beside it because some viewers block file pickers, and picture messages shown under the button. Compare, under the grid, slides the picture over the result.

## Apps made with HTML App Generator

11. **Own code goes only in the APP sections** (APP CSS, APP STAGE, APP PANELS, APP CODE). The core is shared by every app: improve it in the generator's kit, then upgrade the apps.
12. **The spec is the source of truth** for name, version, colours, sizes, changes, credits and learn links. It's the `app-spec` block at the top of the file.

## Testing and publishing

13. **Test before publishing**, on a phone-sized and a desktop-sized window, in light and dark mode, with no console errors. Check: a picture through every step, editing with undo, mark placed, saving and reopening a project file, an older project file, saving a picture and a list, and a reload.
14. **Independent testing.** When it matters, have a different AI from the one that built the app test it, using the generator's test brief. Fix what it finds, or say why not.
15. **Where files live.** Each app has its own folder under `Claude Apps` on the owner's RIT Google Drive. It holds the master app file, its spec, notes, plans and the build kit if there is one. Older versions go in an `Archive` folder inside it.
16. **Phones and tablets use a web address.** iPhones and iPads can't run an app from a file, so the public copies live on GitHub Pages, on the site *Web & Mobile Apps* (repository `web-mobile-apps`), one folder per app, built with the generator's `site` command. That repository is public: apps only, no notes or plans. Each app shows the taps that put it on the Home Screen, and its spec's `homeUrl` points a phone's file preview to the right address.
17. **Keep the site in step.** Publishing a new version of an app (to Drive, a Claude page or anywhere else) isn't finished until the site has it too. Put the new file in the repository's `src/`, rebuild, check and push, as the repository's `AGENTS.md` says. If you can't push to GitHub, hand the file to the owner with a note that the site needs it. A new app goes on the site the same way.
18. **Private stays private.** Nothing the owner marks private, confidential or under a non-disclosure agreement goes on the site, in this repository or anywhere public, not even as a placeholder or a mention. If you aren't sure whether an app may be public, ask the owner before publishing it.

## Networked games

For CIG, the Critical Infrastructure Game (inspired by Jack Voltaic), and any later game where people on different devices play together. Rules 1 to 18 apply, with these changes and additions.

### Changes to rules 1 to 18

- **Rule 1.** The game is still one HTML file, with no outside code, fonts or pictures and no build step to run it. It may also use **one network service of its own: a small relay** that passes moves between devices in the same room. Later, its Builder may also fetch map data from OpenStreetMap. Both follow N2. The optional AI helper still works as rule 1 says.
- **Rule 4.** Saved games, packs and settings stay in the browser. While a room is open, moves pass through the relay, which keeps none of them (N4).
- **Rule 10.** Title Case headings, folding sections and help in labelled parts apply. The grid, Choose image and Compare parts are for picture apps and don't.
- **Rule 13.** Testing also covers rooms (N10).
- **Rules 16 and 17.** The game has its own repository and site instead of *Web & Mobile Apps*. Its `README.md` gives the address. Keep that site in step the same way.

### Added rules

- **N1. Offline first.** Solo play and play around one device never touch the network, and the file still works from a saved copy. If the relay can't be reached, the game says so and offers play around one device.
- **N2. Network only when asked, and said plainly.** Rooms stay off until the host turns them on. Before anything is sent, the game says what goes (moves, nicknames, the room's scenario pack) and where (the relay's address). Everyone who joins sees the same notice. The map fetch works the same way.
- **N3. One relay, ours, small enough to read.** The relay's code lives in the game's repository under the same licence, and one person can read it in a sitting. It runs on the owner's own hosting account. No other services: no analytics, ads, trackers, or code, fonts or pictures loaded from elsewhere, in the game or the relay.
- **N4. The relay keeps nothing.** It passes messages between devices in one room and does nothing else. No accounts, logins or email addresses: players type a nickname. A room is forgotten when it closes or after 2 hours idle. The relay writes no logs of its own, and the About screen says what the hosting service logs by default.
- **N5. The host's device holds the one true game.** The host's rules engine checks every move instead of trusting it as sent. Each device gets only what its player may see, so hidden hands stay hidden.
- **N6. Limits against misuse.** Short room codes that expire, a cap on players per room, size and rate limits on messages. Anything malformed is dropped.
- **N7. Secrets stay out of the repository.** Hosting tokens and keys live in the owner's accounts or in the repository's encrypted secrets, never in code, packs or notes.
- **N8. Real places stay local.** Public packs use made-up places. A pack built from real map data stays on the device that built it unless its owner chooses to share it. It may pass through a room its owner opens, but it never goes on the site or in the repository.
- **N9. Study data needs approval first.** Play logs stay on the device and are exported by hand. Nothing is collected through the relay. A study uses the game only under an approved IRB protocol.
- **N10. Test rooms the way they'll be used.** Before a release: bots playing many games, then real phones on campus Wi-Fi and on a phone hotspot, with one player dropping out and rejoining, and once with the relay switched off.

## Adding a kind of product

A new kind of product (a server tool, a native app, a print-only game) gets its own section like Networked games. Say which products it covers, which of rules 1 to 18 it changes and why, and add only the rules it needs. Don't change rules 1 to 18 for one product.
