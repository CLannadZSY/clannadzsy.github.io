"""Validate generated sitemaps after a production Hugo build.

Usage: python tests/seo-sitemap.py public --base-url https://clannad.icu/
"""

import argparse
from html.parser import HTMLParser
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET


class CanonicalParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and 'canonical' in attrs.get('rel', '').split():
            self.urls.append(attrs.get('href'))


def validate(output, base_url):
    output = output.resolve()
    base = urlsplit(base_url)
    if base.scheme not in ('https', 'http') or not base.netloc:
        raise ValueError('--base-url must be an absolute HTTP or HTTPS URL')
    base_path = base.path.rstrip('/') + '/'
    errors = []
    sitemap_files = sorted(output.rglob('sitemap.xml'))
    if not (output / 'sitemap.xml').is_file():
        errors.append('Root sitemap.xml is missing')
    total_urls = 0
    total_alternates = 0
    canonical_cache = {}

    def check_url(url, source, canonical=True):
        parts = urlsplit(url)
        if (parts.scheme, parts.netloc) != (base.scheme, base.netloc):
            errors.append(f'{source}: expected origin {base.scheme}://{base.netloc}, got {url!r}')
            return
        if not parts.path.startswith(base_path) or parts.query or parts.fragment:
            errors.append(f'{source}: URL must be a canonical path within {base_url}: {url!r}')
            return
        if '//' in parts.path:
            errors.append(f'{source}: duplicate path separators in {url!r}')
            return
        relative_path = unquote(parts.path[len(base_path):])
        target = (output / relative_path).resolve()
        if not target.is_relative_to(output):
            errors.append(f'{source}: URL resolves outside the build directory: {url!r}')
            return
        if target.is_dir():
            target = target / 'index.html'
        if not target.is_file():
            errors.append(f'{source}: no generated page for {url!r}: {target}')
            return
        if not canonical:
            return
        if target not in canonical_cache:
            parser = CanonicalParser()
            parser.feed(target.read_text(encoding='utf-8'))
            canonical_cache[target] = parser.urls
        if canonical_cache[target] != [url]:
            errors.append(f'{source}: canonical mismatch for {url!r}: {canonical_cache[target]!r}')

    for path in sitemap_files:
        label = str(path.relative_to(output))
        try:
            root = ET.parse(path).getroot()
        except ET.ParseError as error:
            errors.append(f'{label}: invalid XML: {error}')
            continue
        if root.tag == '{http://www.sitemaps.org/schemas/sitemap/0.9}sitemapindex':
            seen = set()
            for sitemap in root.findall('{*}sitemap'):
                loc = sitemap.find('{*}loc')
                url = (loc.text or '').strip() if loc is not None else ''
                if url in seen:
                    errors.append(f'{label}: duplicate sitemap index loc {url!r}')
                seen.add(url)
                check_url(url, label, canonical=False)
            continue
        if root.tag != '{http://www.sitemaps.org/schemas/sitemap/0.9}urlset':
            errors.append(f'{label}: expected a sitemap urlset or sitemapindex')
            continue
        seen = set()
        for entry in root.findall('{*}url'):
            locs = entry.findall('{*}loc')
            if len(locs) != 1 or not locs[0].text:
                errors.append(f'{label}: every url entry must have exactly one non-empty loc')
                continue
            url = locs[0].text.strip()
            total_urls += 1
            if url in seen:
                errors.append(f'{label}: duplicate loc {url!r}')
            seen.add(url)
            check_url(url, label)
            alternates = set()
            for alternate in entry.findall('{http://www.w3.org/1999/xhtml}link'):
                total_alternates += 1
                href = alternate.get('href', '')
                language = alternate.get('hreflang', '')
                if alternate.get('rel') != 'alternate' or not language:
                    errors.append(f'{label}: alternate requires rel="alternate" and hreflang')
                if (language, href) in alternates:
                    errors.append(f'{label}: duplicate alternate {(language, href)!r}')
                alternates.add((language, href))
                check_url(href, label)

    return errors, len(sitemap_files), total_urls, total_alternates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', nargs='?', type=Path, default=Path('public'))
    parser.add_argument('--base-url', default='https://clannad.icu/')
    args = parser.parse_args()
    errors, files, urls, alternates = validate(args.output, args.base_url)
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(f'Sitemap checks passed: {files} files, {urls} loc entries, {alternates} alternates.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
