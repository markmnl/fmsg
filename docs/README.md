# fmsg.org site source

This directory holds **website-only** sources for https://fmsg.org:

| Path | Purpose |
|------|---------|
| `index.md`, `white-paper.md`, `show-hn.md` | Pages that are not canonical protocol docs |
| `stylesheets/` | Custom CSS layered on Material for MkDocs |
| `overrides/` | Small Material theme template overrides |
| `img/favicon.ico` | Site favicon |
| `CNAME` | Custom domain `fmsg.org` (copied into the build artifact) |
| `build-site.sh` | Stages root specs + this tree, runs MkDocs, checks links |
| `check-site.py` | Fails the build if generated HTML points at missing local files |
| `requirements.txt` | `mkdocs` + `mkdocs-material` pins |

Canonical protocol documents stay at the repository root (`SPECIFICATION.md`,
`STANDARDS.md`, `standards/*.md`, …). The build script copies them into a
temporary `.pages-source/` tree for MkDocs.

## Local preview

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r docs/requirements.txt
./docs/build-site.sh          # production build + link check → _site/
./docs/build-site.sh serve    # live-reload at http://127.0.0.1:8000/
```

`serve` stages sources then runs `mkdocs serve`. After you edit root-level
canonical files (`SPECIFICATION.md`, `standards/*.md`, …), run
`./docs/build-site.sh serve` again (or re-run the script’s staging by calling
`build`) so `.pages-source/` picks up the changes.

## GitHub Pages publishing (important)

The site is published by **GitHub Actions** (`.github/workflows/pages.yml`), which
builds MkDocs into `_site` and deploys that artifact.

**Repository setting required (one-time):**

1. Open the repository **Settings → Pages**
2. Under **Build and deployment → Source**, choose **GitHub Actions**
   (not “Deploy from a branch”)

If Source remains **Deploy from a branch** with the `/docs` folder, GitHub’s
legacy Jekyll publisher serves only the raw files in `docs/` (so links like
`/SPECIFICATION/` 404). That legacy workflow can also race and overwrite a
successful Actions deployment.

After switching to **GitHub Actions**, re-run the **Deploy fmsg.org** workflow
(or push to `main`). Confirm https://fmsg.org/SPECIFICATION/ returns 200 and
shows the Material left-hand navigation.
