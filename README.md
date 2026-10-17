# David Dwyer: Engineering Portfolio Website (v2, "CAD workspace" design)

This is the redesigned version of the site (live at https://daviddwyer.org). On David's PC, the pre-redesign version is kept in the `Portfolio Website` folder.

It is still a plain static website (HTML, CSS and JavaScript) with no build step, so it can be hosted free on **GitHub Pages** exactly like before.

```
Portfolio Website v2/
├── index.html                 ← Home: intro splash + the "Welcome" window (About / Projects / Skills / Contact tabs)
├── projects/                  ← one page per project, laid out like an open CAD document
│   ├── torsion-jig.html       ← AME26 torsional rigidity test jig (labels, see-through chassis outline)
│   ├── fsae-brake-pedal.html  ← interactive brake pedal (explode, labels, pedal travel)
│   ├── scorpius.html
│   ├── hawkbot.html
│   ├── go-kart.html
│   └── eagle-scout.html
├── css/style.css              ← all styling (colours and sizes are the variables at the top)
├── js/
│   ├── main.js                ← intro, tabs, project filter, help box, contents tree, lightbox
│   ├── viewer.js              ← the 3D viewport (built on three.js)
│   └── models/                ← one settings file per 3D model
│       ├── torsion-jig.js     ← jig part names, numbered labels, see-through chassis outline
│       ├── brake-pedal.js     ← part names, pedal motion, exploded view, numbered labels
│       ├── scorpius.js
│       └── hawkbot.js
└── assets/
    ├── img/  video/  docs/    ← same images, videos and résumé as before
    ├── models/                ← the .glb 3D models (unchanged)
    └── vendor/three/          ← a copy of three.js r169 (MIT licence), so the site needs no CDN
```

---

## What's on the site

**Home page.** The first visit in a browser session shows a short intro: an engineering drawing sheet where the pedal arm draws itself while the projects "load". It can be skipped by clicking anywhere or pressing Esc, and it doesn't replay when someone comes back to Home. Then the **Welcome** window opens over a blue-grey 3D workspace with the brake pedal slowly turning behind it.

- Tabs: **About**, **Projects** (opens by default), **Skills**, **Contact**. Each tab has its own link: `index.html#about`, `#projects`, `#skills`, `#contact`.
- Projects show as document thumbnails. A filter (All / Formula SAE EV / FTC Robotics / Other) and a name search sit above them. Hovering a project shows its summary and your role in the strip at the bottom of the window.
- The red **Résumé** button is the only red button on the site.

**Everywhere.**
- Top-left **Home** button, plus a breadcrumb (David Dwyer › Projects › …).
- Right edge: Résumé, LinkedIn and email (labels appear on hover).
- Bottom edge: tabs for Welcome and every project, like open documents.
- Phones and tablets: the right edge and bottom tabs are replaced by a bottom bar (Home, Résumé, LinkedIn, Email), and the contents tree becomes a **Sections** drop-down.
- "How to use this site" (the ? button) explains everything in four lines.

**Project pages.** A contents tree on the left (it highlights where you are as you scroll), the 3D view at the top, then the write-up. The text, numbers and images are the same as the original site.

**The brake pedal page.**
- **Click any part** (or a part in the tree, or a **Show** button in the component table) to highlight it and see what it does.
- **Labels** puts the numbered balloons 1–7 on the model, matching the component table and the annotated render.
- **Explode** pulls the assembly apart. **Views** has a 3/4 view, the side view used in the four-position figure, the driver's view and a top view.
- **Pedal travel** (below the 3D view): press **Play**, drag the slider, or pick position 1–4. The pedal rotates about its pivot bolt, the balance bar's bearing slides along the slot and pushes both master cylinders, and the pedal arm pushes the BOTS toggle lever over. Readouts show the pedal angle, how much of the master cylinder stroke is used, and whether the shutdown circuit is open.

---

## Preview it on your computer

Double-clicking `index.html` works for everything except the 3D models, because browsers block 3D files opened straight from disk. To see the 3D, run a small local web server:

- **VS Code:** install the "Live Server" extension, then right-click `index.html` → *Open with Live Server*, **or**
- **Terminal** (in this folder): `python -m http.server 8000`, then open http://localhost:8000

To skip the intro while you're testing, open `index.html?nointro`.

---

## Publishing

The live site is **https://daviddwyer.org**, served by GitHub Pages from the repository **davidd9831/portfolio** (branch `main`, folder `/ (root)`).

- The `CNAME` file in the repository holds the custom domain. Keep it; deleting it takes the site off daviddwyer.org.
- Keep the `.nojekyll` file; it tells GitHub Pages to serve the files exactly as they are.
- To publish changes: upload the changed files on github.com (**Add file → Upload files**), or use GitHub Desktop (copy the files into the cloned repo folder, then **Commit to main → Push origin**). The site updates within a minute or two; press Ctrl+F5 to skip your browser's cached copy.

---

## Common edits

| To change… | Edit… |
|---|---|
| Colours | the variables at the top of `css/style.css` (`--blue`, `--red`, `--vp-top`/`--vp-bottom` for the 3D background) |
| About, Skills, Contact text, project cards | `index.html` |
| A project write-up | the matching file in `projects/` |
| Replace the résumé | overwrite `assets/docs/David-Dwyer-Resume.pdf` (keep the same name) |
| Email or LinkedIn address | search all `.html` files for `davidd22@tamu.edu` or `linkedin.com/in/daviddwyer` and replace |

The title bar, right-edge links, bottom tabs and help text are repeated in every page (there's no build step), so a change to one of them has to be made in all seven HTML files. A "find and replace in files" in VS Code does it in one go.

### Adding a project
1. Copy the closest existing page in `projects/` and rename it.
2. Edit its title bar breadcrumb, contents tree, header, properties box and sections.
3. Add a card for it in `index.html` (copy an existing `<li>` in the project grid and set `data-team` to `fsae`, `ftc` or `other`).
4. Add a tab for it to the bottom tab bar (`<nav class="doctabs">`) in every page, and update the "Next project" link at the end of the page before it.

### Adding a 3D model
1. Export the model as **GLB** (or send Claude a STEP/FBX to convert). Keep it under about 10 MB.
2. Put it in `assets/models/`.
3. Copy `js/models/hawkbot.js` to a new file, change the title and the file name in `url`, and set `up: 'z'` if the model was exported Z-up (Fusion 360 STEP exports usually are).
4. On the project page, add a viewport (copy the `<div class="viewport" id="model" data-viewer="…">` block from `projects/hawkbot.html`) and set `data-viewer` to the new file's name, plus `<script type="module" src="../js/viewer.js"></script>` at the bottom.

### About the brake pedal model and its motion
- The parts are found by the **component names in the CAD export** (for example `Pedal2:1`, `Stop Plate:1`). If you re-export the GLB from a newer version of the assembly, keep the component names the same and everything keeps working.
- The motion values were worked out from the CAD geometry: the pivot at the M8 pivot bolt, the 1 in slot (its full length gives exactly the 1.1 in master cylinder stroke), rest with the bearing at the bottom of the slot, and the hard stop where the pedal first touches the stop plate (30.3° of travel). Lock-up (15°) comes from your write-up and the BOTS trip (21°) from your four-position figure. These numbers are at the top of `js/models/brake-pedal.js` if anything changes.
- The switch maker's model includes a duplicate "DUMMY" toggle body; the viewer hides it so it doesn't stay upright while the real lever is pushed over.

### About the torsion jig model
- `assets/models/torsion-jig.glb` was built from `AME 26 TR Jig Assembly.STEP` (SolidWorks, Oct 17, 2026). It holds **only the jig parts**, grouped into six named bodies: `Platform`, `Rear fixture`, `Rear mock upright faces`, `Front lever beam`, `Front mock upright faces` and `Pivot plate`.
- The team's AME26 car parts in that STEP file (suspension, shocks, steering, pedal box, and the upright and toe-link parts on the front-left mock upright) are **left out on purpose**, because a model on the site can be downloaded by anyone. The chassis frame is replaced by `Chassis outline`: the frame voxelised at 15 mm, blurred and simplified to 7,000 triangles, so it shows where the car sits without its real tube geometry.
- `ghosts: ['Chassis outline']` in `js/models/torsion-jig.js` tells the viewer to draw that body see-through, with no edges and no click selection.
- Measurements quoted on the page come from the CAD: weight posts 1.153 m either side of the pivot, and 1.525 m between the front and rear mock upright faces.
