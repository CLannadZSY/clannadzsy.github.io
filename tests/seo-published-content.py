"""Check removal of theme examples while retaining published blogs and authors.

Usage: python tests/seo-published-content.py public --base-url https://clannad.icu/
"""

import argparse
from html.parser import HTMLParser
from pathlib import Path
import posixpath
import re
import sys
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET


REMOVED_PAGES = {
    '/docs/',
    '/docs/help/',
    '/docs/prologue/',
    '/docs/help/faq/',
    '/docs/help/how-to-update/',
    '/docs/help/troubleshooting/',
    '/docs/prologue/introduction/',
    '/docs/prologue/quick-start/',
    '/docs/prologue/commands/',
    '/contributors/henk-verlinde/',
}
REMOVED_SITEMAPS = {
    '/docs/sitemap.xml',
    '/docs/help/sitemap.xml',
    '/docs/prologue/sitemap.xml',
}
REMOVED_FEEDS = {
    '/docs/index.xml',
    '/docs/help/index.xml',
    '/docs/prologue/index.xml',
    '/contributors/henk-verlinde/index.xml',
}
# These existing public article URLs must survive cleanup; new posts are allowed.
REQUIRED_BLOG_PATHS = {
    f'/blog/{slug}/' for slug in (
        '3262080571', '532834567', '429417542', '3082362680', '1190727728',
        '3231606058', '1539748842', '3640029440', '630506263', '2494707647',
        '4217449500', '3160062725', '1213148850', '1624364114', '218469985',
        '4229706688', '1110384130', '3239669741', '1745614505', '3380200713',
        '612516780', '404388560', '452409391', '4119532816', '2414890336',
        '2243409341', '3716962172', '2726440838', 'hello-world',
    )
}
AUTHOR_PATH = '/contributors/clannadzsy/'
REQUIRED_PAGES = {'/', '/blog/', '/tools/', '/contributors/', AUTHOR_PATH}
TEMPLATE_AUTHOR_TEXT = re.compile(
    r'henk[\s-]*verlinde|\bthe\s+doks\s+contributors\b|\bcreator\s+of\s+hyas\b',
    re.IGNORECASE,
)


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.article_links = []
        self.article_text = []
        self.metadata_text = []
        self.article_depth = 0
        self.inactive = []
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        # Anchors in inert templates or textarea examples are not page links.
        if self.inactive and self.inactive[-1] == 'textarea':
            return
        if tag in ('script', 'style', 'template', 'textarea'):
            self.inactive.append(tag)
        if self.inactive:
            return
        if tag == 'article':
            self.article_depth += 1
        if tag == 'title':
            self.in_title = True
        if tag == 'meta':
            key = attrs.get('name') or attrs.get('property')
            if key in ('description', 'og:title', 'og:description', 'twitter:title', 'twitter:description'):
                self.metadata_text.append(attrs.get('content') or '')
        if tag == 'a' and 'href' in attrs:
            self.links.append(attrs['href'] or '')
            if self.article_depth:
                self.article_links.append(attrs['href'] or '')

    def handle_endtag(self, tag):
        if self.inactive:
            if tag == self.inactive[-1]:
                self.inactive.pop()
            return
        if tag == 'article':
            self.article_depth = max(0, self.article_depth - 1)
        if tag == 'title':
            self.in_title = False

    def handle_data(self, text):
        if self.inactive:
            return
        if self.article_depth:
            self.article_text.append(text)
        if self.in_title:
            self.metadata_text.append(text)


def validate(output, base_url):
    output = output.resolve()
    base_url = base_url.rstrip('/') + '/'
    base = urlsplit(base_url)
    if base.scheme not in ('http', 'https') or not base.hostname or base.query or base.fragment:
        raise ValueError('--base-url must be an absolute HTTP or HTTPS base URL')
    prefix = base.path.rstrip('/')
    host = base.hostname.casefold().removeprefix('www.')
    internal_hosts = {host, 'www.' + host}
    errors = []

    def route(value, page_url=base_url):
        try:
            parts = urlsplit(urljoin(page_url, (value or '').strip().replace('\\', '/')))
        except ValueError:
            return None
        if parts.scheme not in ('http', 'https') or (parts.hostname or '').casefold() not in internal_hosts:
            return None
        path = '/' + posixpath.normpath(unquote(parts.path)).lstrip('/')
        if prefix and path != prefix and not path.startswith(prefix + '/'):
            return None
        path = path[len(prefix):] or '/'
        if path.endswith('/index.html'):
            path = path[:-len('index.html')]
        if not posixpath.splitext(path)[1]:
            path = path.rstrip('/') + '/'
        return path

    def file_for(path):
        relative = path.lstrip('/')
        target = output / relative
        return target / 'index.html' if path.endswith('/') else target

    for path in sorted(REMOVED_PAGES | REMOVED_SITEMAPS | REMOVED_FEEDS):
        if file_for(path).exists():
            errors.append(f'Removed route is still generated: {path}')
    for path in sorted(REQUIRED_PAGES):
        if not file_for(path).is_file():
            errors.append(f'Required public page is missing: {path}')

    sitemap_files = sorted(output.rglob('sitemap.xml'))
    if not (output / 'sitemap.xml').is_file():
        errors.append('Root Sitemap is missing')
    root_routes = set()
    blog_routes = []
    forbidden = REMOVED_PAGES | REMOVED_SITEMAPS | REMOVED_FEEDS
    for sitemap in sitemap_files:
        label = sitemap.relative_to(output).as_posix()
        try:
            root = ET.parse(sitemap).getroot()
        except ET.ParseError as error:
            errors.append(f'{label}: invalid XML: {error}')
            continue
        locs = [node.text or '' for node in root.findall('.//{*}loc')]
        targets = locs + [node.get('href', '') for node in root.findall('.//{http://www.w3.org/1999/xhtml}link')]
        for value in targets:
            if route(value) in forbidden:
                errors.append(f'{label}: removed route remains in Sitemap: {value}')
        if sitemap == output / 'sitemap.xml':
            root_routes = {route(value) for value in locs}
        if sitemap == output / 'blog/sitemap.xml':
            blog_routes = [route(value) for value in locs]

    if not blog_routes:
        errors.append('Blog Sitemap is missing or empty')
    elif None in blog_routes or any(not path.startswith('/blog/') or path == '/blog/' for path in blog_routes if path):
        errors.append('Blog Sitemap contains a URL outside the blog article collection')
    if len(blog_routes) != len(set(blog_routes)):
        errors.append('Blog Sitemap contains duplicate article URLs')
    missing = REQUIRED_BLOG_PATHS - set(blog_routes)
    if missing:
        errors.append(f'Existing blog URLs disappeared: {sorted(missing)}')
    missing = (REQUIRED_PAGES | REQUIRED_BLOG_PATHS) - root_routes
    if missing:
        errors.append(f'Required URLs missing from root Sitemap: {sorted(missing)}')

    pages = {}
    html_files = sorted(output.rglob('*.html'))
    for file in html_files:
        relative = file.relative_to(output).as_posix()
        page_url = urljoin(base_url, relative)
        page = Page()
        page.feed(file.read_text(encoding='utf-8'))
        pages[route(page_url)] = page
        for value in page.links:
            if route(value, page_url) in forbidden:
                errors.append(f'{relative}: active link points to a removed route: {value}')

    for path in ('/contributors/', AUTHOR_PATH):
        page = pages.get(path)
        if page is None:
            continue  # The missing page is reported above.
        text = ' '.join(page.article_text + page.metadata_text)
        if TEMPLATE_AUTHOR_TEXT.search(text):
            errors.append(f'{path}: sample author or Doks contributor template text remains')
        if 'clannadzsy' not in ' '.join(page.article_text).casefold():
            errors.append(f'{path}: real author name is missing from page content')

    directory = pages.get('/contributors/')
    if directory and AUTHOR_PATH not in {route(value, urljoin(base_url, 'contributors/')) for value in directory.article_links}:
        errors.append('Contributor directory no longer links to the real author archive')
    author = pages.get(AUTHOR_PATH)
    if author:
        archive_links = {route(value, urljoin(base_url, AUTHOR_PATH.lstrip('/'))) for value in author.article_links}
        missing = set(blog_routes) - archive_links
        if missing:
            errors.append(f'Author archive lost blog links: {sorted(missing, key=str)}')
    for path in sorted(set(blog_routes), key=str):
        if path is None:
            continue
        page = pages.get(path)
        if page is None:
            errors.append(f'Blog article is not generated: {path}')
        elif AUTHOR_PATH not in {route(value, urljoin(base_url, path.lstrip('/'))) for value in page.article_links}:
            errors.append(f'{path}: real author link is missing from the article')

    return errors, len(html_files), len(set(blog_routes))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', nargs='?', type=Path, default=Path('public'))
    parser.add_argument('--base-url', default='https://clannad.icu/')
    args = parser.parse_args()
    try:
        errors, pages, blogs = validate(args.output, args.base_url)
    except ValueError as error:
        parser.error(str(error))
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(f'Published content checks passed: {len(REMOVED_PAGES)} example routes removed; '
          f'{pages} HTML pages checked; {blogs} blog URLs and real author archive retained.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
