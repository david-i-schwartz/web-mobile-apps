# House rules for single-file HTML apps

These are the rules for FIG, BIG and every app made with HTML App Generator. Any AI assistant (Claude, ChatGPT, Gemini, Qwen or another) and any person working on these apps should follow them. Nothing here depends on one AI.

## The app

1. **One HTML file.** No server, no build step to run it, no network calls. No outside code, fonts or pictures: everything is inline.
2. **Works without any AI.** The file runs by itself in any modern browser, on a phone or a computer, with no account and no AI. Hosting inside Claude is a convenience, not a requirement.
3. **No other apps' code or assets.** Don't take code, pictures, fonts or colour lists from other apps or sites unless they are explicitly offered free, and credit them in Credits. Colour data is either made for the app or comes from a source that offers it free.
4. **Everything stays in the browser.** Nothing is uploaded. Storage (localStorage) is best effort, keys start with the app's short name (`fig:`, `big:`), and the app says plainly when the browser isn't keeping work.
5. **Files the person saves** go through `saveFile(name, blob, messageElement)`. It uses the host's download prompt where there is one and an ordinary download everywhere else.
6. **Phone first.** It works at 380 px wide, touch targets are at least 44 px, and nothing needs hover. Light and dark mode both work.
7. **Plain words and access for everyone.** Short, plain interface text. Every control has a label, changes are announced to screen readers, focus is visible, and the keyboard works on the grid.
8. **Old work keeps opening.** Project files and saved settings from earlier versions still open. New fields get defaults, and everything read from a file or from storage is checked and tidied first.
9. **Every version says what changed.** Raise the version, set the date, and add a line to About This Version. Add credits and Learn the Ideas links for new ideas.

10. **One way of laying out the page.** Section headings are in Title Case ("Save and Open", "Learn the Ideas"). The help by the grid is one tip in labelled parts (placing cells, Sizing, then Views when the app has views), and a ? beside the zoom buttons opens the same tip, centred on them. A section's ? help starts by saying what the section is or does, in plain words. A view that needs a setting (BIG's Heights needs Relief) says so where it shows and offers to turn it on.

## Apps made with HTML App Generator

11. **Own code goes only in the APP sections** (APP CSS, APP STAGE, APP PANELS, APP CODE). The core is shared by every app: improve it in the generator's kit, then upgrade the apps.
12. **The spec is the source of truth** for name, version, colours, sizes, changes, credits and learn links. It's the `app-spec` block at the top of the file.

## Testing and publishing

13. **Test before publishing**, on a phone-sized and a desktop-sized window, in light and dark mode, with no console errors. Check: a picture through every step, editing with undo, mark placed, saving and reopening a project file, an older project file, saving a picture and a list, and a reload.
14. **Independent testing.** When it matters, have a different AI from the one that built the app test it, using the generator's test brief. Fix what it finds, or say why not.
15. **Where files live.** Each app has its own folder under `Claude Apps` on the owner's RIT Google Drive. It holds the master app file, its spec, notes, plans and the build kit if there is one. Older versions go in an `Archive` folder inside it.
16. **Phones and tablets use a web address.** iPhones and iPads can't run an app from a file, so the public copies live on GitHub Pages, on the site *Web & Mobile Apps* (repository `web-mobile-apps`), one folder per app, built with the generator's `site` command. That repository is public: apps only, no notes or plans. Each app shows the taps that put it on the Home Screen, and its spec's `homeUrl` points a phone's file preview to the right address.
17. **Keep the site in step.** Publishing a new version of an app (to Drive, a Claude page or anywhere else) isn't finished until the site has it too. Put the new file in the repository's `src/`, rebuild, check and push, as the repository's `AGENTS.md` says. If you can't push to GitHub, hand the file to the owner with a note that the site needs it. A new app goes on the site the same way.
