#!/usr/bin/env sh
set -eu

repository_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_dir="$repository_dir/.pages-source"
site_dir="$repository_dir/_site"

rm -rf -- "$source_dir" "$site_dir"
mkdir -p "$source_dir/standards"

# Keep the website-specific pages in docs/ and stage the canonical documents
# beside them. The generated copies exist only for the duration of the build.
cp "$repository_dir"/docs/*.md "$source_dir"/
cp -R "$repository_dir/docs/stylesheets" "$source_dir/stylesheets"
cp -R "$repository_dir/docs/img" "$source_dir/img"
cp "$repository_dir/docs/CNAME" "$source_dir/CNAME"
cp "$repository_dir"/docs/*.png "$source_dir"/

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
  "$source_dir/STANDARDS.md"
sed -i 's|src="fmsg-docker-|src="../fmsg-docker-|g' \
  "$source_dir/show-hn.md"

python -m mkdocs build --strict --config-file "$repository_dir/mkdocs.yml"
python "$repository_dir/docs/check-site.py" "$site_dir"
