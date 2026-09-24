# David Dwyer: Engineering Portfolio Website

This is a static website: plain HTML, CSS, and JavaScript. It needs no build step or framework and costs nothing to host on **GitHub Pages**.

```
Portfolio Website/
├── index.html              ← homepage
├── projects/               ← one page per case study
│   ├── scorpius.html
│   ├── hawkbot.html
│   ├── go-kart.html
│   └── eagle-scout.html
├── css/style.css           ← all styling (colors are at the top)
├── js/main.js              ← menu, image lightbox, 3D model tabs
└── assets/
    ├── img/                ← web-optimized photos and renders (.webp)
    ├── models/             ← compressed 3D models (.glb)
    ├── video/              ← compressed videos (.mp4)
    └── docs/               ← your résumé PDF
```

The `_previews` folder contains contact sheets Claude used to choose images. It isn't part of the site, and `.gitignore` keeps it from being uploaded. You can delete it.

---

## Preview it on your computer

Double-click `index.html` to open it in your browser. The 3D models may not load this way, because browsers block local model files. To see everything, you can:

- In **VS Code**, install the "Live Server" extension, then right-click `index.html` → *Open with Live Server*, **or**
- In a terminal inside this folder, run `python -m http.server 8000` and open http://localhost:8000.

---

## Publish free on GitHub Pages (about 10 minutes)

### 1. Create the repository
1. Sign in at https://github.com (or create a free account).
2. Click **+ → New repository**.
3. Name it **`<your-username>.github.io`**, replacing `<your-username>` with your GitHub username exactly. This name gives the site the clean address `https://<your-username>.github.io`.
   *(If you choose another name, such as `portfolio`, the site will be at `https://<your-username>.github.io/portfolio/`.)*
4. Set it to **Public** and click **Create repository**.

### 2. Upload the files

**Option A, in the browser (easiest):**
1. On the new repo page, click **uploading an existing file**.
2. Open this folder in File Explorer, select **everything inside it** (`index.html`, `projects`, `css`, `js`, `assets`, `.nojekyll`, and the rest) **except `_previews`**, and drag it into the upload area.
3. Click **Commit changes**.

> If the browser upload skips some folders, upload them one at a time. Each file is under GitHub's 25 MB browser limit.

**Option B, with GitHub Desktop (best for future updates):**
1. Install https://desktop.github.com and sign in.
2. **File → Clone repository** and pick your new repo.
3. Copy everything from this folder into the cloned folder, then click **Commit to main → Push origin**.

**Option C, with Git on the command line:**
```bash
cd "Portfolio Website"
git init
git add .
git commit -m "Initial portfolio site"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-username>.github.io.git
git push -u origin main
```

### 3. Turn on Pages
1. In the repo, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**, and click **Save**.
3. Wait 1–2 minutes and refresh. GitHub will show your live URL at the top of that page.

### 4. (Optional) Use your own domain
Buy a domain (for example `daviddwyer.dev`, about $10–15/year), then add it under **Settings → Pages → Custom domain** and follow GitHub's DNS instructions. Check **Enforce HTTPS**.

---

## Common edits

| To change… | Edit… |
|---|---|
| Colors | the `--accent`, `--bg`, and related variables at the top of `css/style.css` |
| Homepage text, stats, and project cards | `index.html` |
| A case study | the matching file in `projects/` |
| Add LinkedIn | in `index.html`, find the `<!-- Add your LinkedIn here` comment and remove the comment markers |
| Replace the résumé | overwrite `assets/docs/David-Dwyer-Resume.pdf` (keep the same name) |

### Adding a new 3D model
1. Export from Onshape or Fusion 360 as **glTF/GLB** (in Onshape: right-click the assembly → Export → GLTF). You can also export STEP/OBJ and convert it in Blender.
2. Keep the file under about 10 MB. To shrink it, you can drag it into https://gltf.report and export with Draco compression.
3. Put it in `assets/models/` and point a `<model-viewer src="...">` tag at it (copy one from `projects/scorpius.html`).

### Adding photos
Phone photos are 3–7 MB each, which is too heavy for a website. Resize them to about 1600 px wide and convert them to WebP (for example with https://squoosh.app) before adding them to `assets/img/`.

After any change, commit and push again (or re-upload the changed file). The live site updates within a minute or two.
