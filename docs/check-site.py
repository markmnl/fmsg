#!/usr/bin/env python3
"""Fail when generated HTML refers to a missing local file."""

from __future__ import annotations

import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class LocalReferences(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.values: list[str] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        del tag
        for name, value in attrs:
            if name in {"href", "src", "data"} and value:
                self.values.append(value)


def main() -> int:
    site = Path(sys.argv[1]).resolve()
    missing: list[tuple[Path, str]] = []
    page_count = 0

    for page in site.rglob("*.html"):
        page_count += 1
        parser = LocalReferences()
        parser.feed(page.read_text(encoding="utf-8"))

        for value in parser.values:
            parsed = urlsplit(value)
            if (
                parsed.scheme
                or parsed.netloc
                or value.startswith(("#", "mailto:", "tel:", "javascript:"))
            ):
                continue

            path = unquote(parsed.path)
            target = site / path.lstrip("/") if path.startswith("/") else page.parent / path
            if not path:
                target = page
            if target.is_dir():
                target /= "index.html"

            try:
                target.resolve().relative_to(site)
            except ValueError:
                missing.append((page.relative_to(site), value))
                continue

            if not target.exists():
                missing.append((page.relative_to(site), value))

    for page, value in missing:
        print(f"{page}: missing local reference {value}", file=sys.stderr)

    if missing:
        return 1

    print(f"Validated local references in {page_count} HTML pages")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
