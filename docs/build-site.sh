#!/usr/bin/env sh
set -eu

repository_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_dir="$repository_dir/.pages-source"
site_dir="$repository_dir/_site"
mode=${1:-build}

stage_sources() {
  rm -rf -- "$source_dir"
  mkdir -p "$source_dir/standards"

  # Keep the website-specific pages in docs/ and stage the canonical documents
  # beside them. The generated copies exist only for the duration of the build.
  # Exclude docs/README.md (maintainer notes, not a site page).
  for md in "$repository_dir"/docs/*.md; do
    case "$(basename -- "$md")" in
      README.md) continue ;;
    esac
    cp "$md" "$source_dir"/
  done
  cp -R "$repository_dir/docs/stylesheets" "$source_dir/stylesheets"
  cp -R "$repository_dir/docs/javascripts" "$source_dir/javascripts"
  cp -R "$repository_dir/docs/img" "$source_dir/img"
  cp "$repository_dir/docs/CNAME" "$source_dir/CNAME"
  # Prevent GitHub Pages from running Jekyll on the uploaded artifact.
  : > "$source_dir/.nojekyll"
  if ls "$repository_dir"/docs/*.png >/dev/null 2>&1; then
    cp "$repository_dir"/docs/*.png "$source_dir"/
  fi

  cp "$repository_dir/SPECIFICATION.md" "$source_dir/SPECIFICATION.md"
  cp "$repository_dir/SPEC.md" "$source_dir/SPEC.md"
  cp "$repository_dir/STANDARDS.md" "$source_dir/STANDARDS.md"
  cp "$repository_dir/IMPLEMENTATIONS.md" "$source_dir/IMPLEMENTATIONS.md"
  cp "$repository_dir/FMSG_WHITE_PAPER.pdf" "$source_dir/FMSG_WHITE_PAPER.pdf"
  cp -R "$repository_dir/pics" "$source_dir/pics"
  cp "$repository_dir"/standards/*.md "$source_dir/standards"/

  # MkDocs rewrites Markdown image links for directory URLs, but deliberately
  # leaves URLs in raw HTML alone. Normalize the few raw image URLs in the staged
  # copies so they continue to refer to the shared assets from generated pages.
  sed -i 's|srcset="pics/|srcset="../pics/|g; s|src="pics/|src="../pics/|g' \
    "$source_dir/SPECIFICATION.md" \
    "$source_dir/STANDARDS.md" \
    "$source_dir/show-hn.md"
  sed -i 's|srcset="fmsg-docker-|srcset="../fmsg-docker-|g; s|src="fmsg-docker-|src="../fmsg-docker-|g' \
    "$source_dir/show-hn.md"
}

stage_sources

case "$mode" in
  build)
    rm -rf -- "$site_dir"
    # Theme overrides live outside docs_dir; Material loads them via custom_dir.
    python -m mkdocs build --strict --config-file "$repository_dir/mkdocs.yml"
    python "$repository_dir/docs/check-site.py" "$site_dir"

    # Ensure CNAME and .nojekyll survive into the published artifact root.
    cp "$source_dir/CNAME" "$site_dir/CNAME"
    : > "$site_dir/.nojekyll"
    ;;
  serve)
    # Live-reload preview. Re-run this script after editing root-level canonical
    # docs so they are re-staged into .pages-source.
    exec python -m mkdocs serve --config-file "$repository_dir/mkdocs.yml"
    ;;
  *)
    echo "usage: $0 [build|serve]" >&2
    exit 2
    ;;
esac
