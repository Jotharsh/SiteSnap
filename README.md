# SiteSnap

**Live app: <https://jotharsh.github.io/SiteSnap/>**

Take photos on a building site, add a short comment to each, and share a neat, professional **PDF report**. It is a Progressive Web App (PWA): it installs on iPhone, Android, Mac and Windows, and **works fully offline**.

- No account, no server, no tracking. Everything stays on the device.
- Plain HTML, CSS and JavaScript. **No build step**: the folder you see is the app.
- English only. Built for people with low phone skills: big buttons, big text, high contrast for sunlight, plain words.

## What it does

1. **Start a visit.** Project name (the only required field), place, date, and who prepared it.
2. **Add photos.** One big camera button, or choose from the gallery (several at once). Type a comment, or tap the microphone where the browser supports it. Optional labels: Urgent, Needs Fix, Done, Note.
3. **Review.** Numbered list; tap a photo to edit or delete it; "Change order" moves photos up and down.
4. **Make PDF.** Optional overall remarks, choose 1, 2 or 4 photos per page, see **every page** before sharing, then **Share** (where the phone allows) or **Download**.

The report has a cover page (logo, report number `SR-YYYY-NNN`), a summary page (counts per label and overall remarks), the photo pages, and a sign-off page with signature lines. A4 or Letter. Engineering symbols (Ø ≥ ≤ ± ² ³) print correctly.

Everything is saved as you type, so nothing is lost if the battery dies.

---

## Run it on your computer

Browsers only allow installing and offline mode on `https://` sites or on `localhost`. From this folder:

```sh
python3 -m http.server 8080
```

Open <http://localhost:8080>. (Any static file server works.)

To try a long report, open <http://localhost:8080/dev/sample.html>, tap **Add the 40-photo test visit**, then open it in the app and tap **Make PDF**.

## Deploy

It is a folder of static files. Upload the whole folder, unchanged.

### GitHub Pages

1. Put the folder in a GitHub repository (the `index.html` file at the top level).
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose your branch (for example `main`) and the **`/ (root)`** folder, and save.
4. After a minute your app is at `https://YOUR-NAME.github.io/YOUR-REPOSITORY/`.

The app works from a sub-folder like this: its web address settings are relative (`start_url` is `./`), so no changes are needed.

### Netlify

- **Quickest:** go to <https://app.netlify.com/drop> and drag the whole folder onto the page. You get an `https://….netlify.app` address.
- **From Git:** connect your repository, leave the **build command empty**, and set the **publish directory** to `/` (the repository root).

The included `_headers` file makes Netlify (and Cloudflare Pages) always check for a new `sw.js`, so updates arrive promptly. GitHub Pages ignores it; updates there can take up to ten minutes.

### Updating the app after you change anything

Open `sw.js` and change `const VERSION = 'v1';` to `'v2'` (then `'v3'`, and so on). That tells every installed copy to fetch the new files and delete the old ones. If you add a new file, also add its name to the `SHELL` list in `sw.js` so it works offline.

---

## Short guide for the people who will use it

**Install it (once).** It then opens like any other app, even with no signal.
- **iPhone / iPad:** open the address in **Safari**. Tap the **Share** button (square with an arrow), then **Add to Home Screen**.
- **Android:** open it in **Chrome**. Tap **Install** on the message at the top, or the **⋮ menu → Install app**.
- **Windows:** in **Edge** or **Chrome**, click the **install icon** at the right end of the address bar.
- **Mac:** in **Chrome** or **Edge**, click the install icon in the address bar. In **Safari**, choose **File → Add to Dock**.

**Make a report.**
1. Tap **Start new site visit**. Type the project name. Tap **Start visit**.
2. Tap **Take photo**. After each photo, type what you see. Tap **Take next photo** to carry on, or **Done**.
3. Check the list. Tap a photo to change it. Tap **Change order** to move photos.
4. Tap **Make PDF**. Tap **Make PDF** again. Scroll through the pages.
5. Tap **Share** to send it, or **Download** to save it.

**Set up once** (**More → Settings**): your name, job title, company, your logo and your signature, the report colour, and the paper size.

**Keep your work safe.** Visits are saved on your phone only. If you do not use the app for a long time, the browser may clear them. On an important visit tap **More → Back up this visit** and keep the file. To restore it, go to **More → Open a backup file**.

---

## Checks to run before you rely on it

### Lighthouse
Lighthouse no longer has a separate "PWA" score, so check the two parts separately.
- **Scores.** In Chrome: open the app, press **F12 → Lighthouse**, choose **Mobile**, tick Performance, Accessibility, Best Practices and SEO, and run it. Measured on this build: Performance 99, Accessibility 100, Best Practices 100, SEO 100.
- **Installability.** In Chrome DevTools open **Application → Manifest**. There should be no errors or warnings, and the 192, 512 and maskable icons should show. **Application → Service Workers** should show the worker as *activated and running*.
- **Offline.** In **Application → Service Workers** tick **Offline**, reload the page, and use the whole app, including Make PDF.

### On real devices (not yet done: please do this)
The automated checks ran in desktop Chrome and macOS's PDF engine. **Nobody has yet run it on a physical iPhone or Android phone.** Before sending it to the team, on each phone:
- [ ] Install it from the browser, open it from the home screen (no browser bars).
- [ ] Switch to airplane mode, then take photos, comment, and make a PDF.
- [ ] "Take photo" opens the **rear camera**, and photos come out the right way up (try portrait and landscape).
- [ ] **Share** opens the share sheet, and the PDF arrives intact (email it to yourself).
- [ ] Take about 30 photos in one visit and make the PDF. Check it does not run out of memory.
- [ ] The microphone button appears or is hidden sensibly, and the keyboard's own microphone works.
- [ ] Text zoomed up in the phone's accessibility settings still looks right, and everything is readable in bright sun.
- [ ] Back up a visit, delete it, open the backup: the photos and comments return.

## How it is built

```
index.html            the page; the app draws everything else
manifest.webmanifest  install information (name, icons, colours)
sw.js                 the service worker: offline cache, versioned
css/app.css           all styles (colours are CSS variables; light and dark follow the device)
js/                   the app: screens in views/, the PDF engine in pdf/
  db.js               storage (IndexedDB): visits, photos, settings, report numbers
  image.js            photo compression (about 1600 px, JPEG 70%), upright by EXIF
  backup.js           export and import of one visit (imports are strictly checked)
  pdf/layout.js       works out where everything goes on every page
  pdf/render-pdf.js   draws that into the PDF;  render-canvas.js draws the same pages on screen
vendor/               jsPDF (MIT licence), the PDF library
fonts/                Inter Regular and SemiBold (SIL Open Font Licence)
icons/                app icons; source-1024.png is the master
scripts/make-icons.sh makes every icon size from one 1024 px image
dev/sample.html       makes a 40-photo test visit
```

- **Icons.** To change the icon, replace `icons/source-1024.png` (1024×1024, no transparency, no rounded corners, important artwork inside the middle 80%) and run `./scripts/make-icons.sh`. It needs `sips` (built into macOS) or ImageMagick.
- **Storage.** Photos are shrunk when taken, so a 30-photo visit uses a few megabytes, and the PDF stays under about 10 MB.
- **Layout.** The PDF and the on-screen preview are drawn from the same list of instructions, so the preview always matches the file. Three type sizes are used; one accent colour; 18 mm side margins.
- **Long comments.** A comment too long for a small cell moves that photo to its own page; an extremely long one continues on the next page, headed "Observation N (continued)". The photo always stays with the start of its comment.
- **Characters the font lacks** (for example emoji, or Japanese) are removed or shown as `?`, never as empty boxes.

## Good to know

- **Works on:** current Chrome, Edge, Safari and Firefox. Installing is not offered by Firefox on computers.
- **Sharing** needs a browser that can share files (iPhone Safari, Android Chrome, Safari and Edge on computers). Where it cannot, only **Download** appears.
- **Voice typing** uses the browser's speech recognition and needs a connection in most browsers. The button is hidden where it is unsupported.
- **No sync.** Each device keeps its own visits. Move a visit between devices with **Back up** and **Open a backup file**.
- **Browser storage** can be cleared by the browser if the app goes unused for a long time (Safari is strictest). Installing to the home screen and **Settings → Ask the browser to protect my data** help; backups are the real safety net.
- **Photos from the camera roll** keep the time they were taken where the phone provides it.

## Privacy

No accounts, no server, no analytics, no adverts, no outside requests: after the first load the app uses only files stored on the device. A photo, comment or report leaves the device only when *you* tap Share or Download.

## Licences

SiteSnap's own code is MIT licensed (see `LICENSE`). It bundles [jsPDF](https://github.com/parallax/jsPDF) (MIT, `vendor/jspdf.LICENSE.txt`) and the [Inter](https://rsms.me/inter/) font (SIL Open Font Licence 1.1, `fonts/Inter.OFL.txt`).
