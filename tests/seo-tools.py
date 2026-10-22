"""Validate crawlable tool pages after a production Hugo build.

Usage: python tests/seo-tools.py public --base-url https://clannad.icu/
"""

import argparse
import ast
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET


TOOLS = {
    '/tools/json-formatter/': 'json',
    '/tools/curl-to-requests/': 'curl',
    '/tools/timestamp/': 'timestamp',
    '/tools/totp/': 'totp',
}
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
JAVASCRIPT_TOKEN = re.compile(
    r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\''
    r'|`(?:\\[\s\S]|[^`\\])*`'
    r'|/\*[\s\S]*?\*/|//[^\r\n]*|[$A-Z_a-z][$\w]*|[^\s]',
)


def text(value):
    return ' '.join(value.split())


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.meta = {}
        self.canonical = []
        self.links = []
        self.scripts = []
        self.panels = []
        self.titles = []
        self.h1 = []
        self.h2 = []
        self.examples = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        inactive = (self.stack[-1]['inactive'] if self.stack else False)
        inactive = inactive or tag in ('script', 'style', 'template', 'textarea')
        hidden = (self.stack[-1]['hidden'] if self.stack else False)
        hidden = hidden or 'hidden' in attrs or (attrs.get('aria-hidden') or '').lower() == 'true'
        hidden = hidden or 'd-none' in (attrs.get('class') or '').split()
        style = (attrs.get('style') or '').lower()
        hidden = hidden or bool(re.search(r'(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b', style))
        panel = attrs.get('data-tool-panel')
        frame = {'tag': tag, 'hidden': hidden, 'inactive': inactive, 'panel': panel}
        inside_panel = panel is not None or any(item['panel'] is not None for item in self.stack)
        if tag == 'meta':
            key = attrs.get('name') or attrs.get('property')
            self.meta.setdefault((key or '').lower(), []).append(attrs.get('content') or '')
        if tag == 'link' and 'canonical' in attrs.get('rel', '').lower().split():
            self.canonical.append(attrs.get('href', ''))
        if tag == 'script' and attrs.get('src'):
            self.scripts.append(attrs['src'])
        if not inactive:
            if panel is not None:
                self.panels.append((panel, not hidden))
            if not hidden:
                if tag == 'a' and 'href' in attrs:
                    self.links.append(attrs['href'] or '')
                if tag in ('title', 'h1') or (tag == 'h2' and not inside_panel):
                    frame['capture'] = tag
                    frame['parts'] = []
                if tag == 'code' and not inside_panel and any(item['tag'] == 'pre' for item in self.stack):
                    frame['capture'] = 'example'
                    frame['parts'] = []
        if tag not in VOID:
            self.stack.append(frame)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index]['tag'] == tag:
                frames, self.stack = self.stack[index:], self.stack[:index]
                for frame in frames:
                    capture = frame.get('capture')
                    if capture:
                        destination = {'title': self.titles, 'h1': self.h1,
                                       'h2': self.h2, 'example': self.examples}[capture]
                        destination.append(text(''.join(frame['parts'])))
                break

    def handle_data(self, value):
        if self.stack and not self.stack[-1]['inactive'] and not self.stack[-1]['hidden']:
            for frame in self.stack:
                if 'capture' in frame:
                    frame['parts'].append(value)


def search_hrefs(source):
    # Match complete strings first so tutorial content containing "href:" is inert.
    tokens = [match.group(0) for match in JAVASCRIPT_TOKEN.finditer(source)]
    tokens = [token for token in tokens if not token.startswith(('//', '/*'))]
    hrefs = []
    for index, token in enumerate(tokens[:-2]):
        if token in ('href', '"href"', "'href'") and tokens[index + 1] == ':':
            value = tokens[index + 2]
            if value.startswith('"'):
                hrefs.append(json.loads(value))
            elif value.startswith("'"):
                hrefs.append(ast.literal_eval(value.replace('\\/', '/')))
            else:
                raise ValueError(f'Search href must be a literal string: {value}')
    return hrefs


def topic_matches(tool, heading):
    heading = heading.casefold()
    if tool == 'json':
        return 'json' in heading and bool(re.search(r'格式|美化|format|pretty', heading))
    if tool == 'curl':
        return 'curl' in heading and 'requests' in heading
    if tool == 'totp':
        return 'totp' in heading and bool(re.search(r'验证码|动态码|otp|code', heading))
    return bool(re.search(r'时间戳|timestamp|unix', heading) and re.search(r'转换|日期|convert|date', heading))


def validate(output, base_url):
    output = output.resolve()
    base_url = base_url.rstrip('/') + '/'
    base = urlsplit(base_url)
    if base.scheme not in ('http', 'https') or not base.netloc or base.query or base.fragment:
        raise ValueError('--base-url must be an absolute HTTP or HTTPS base URL')
    errors = []

    def check(condition, message):
        if not condition:
            errors.append(message)

    def url(path):
        return urljoin(base_url, path.lstrip('/'))

    def file_for(value):
        parsed = urlsplit(value)
        if (parsed.scheme, parsed.netloc) != (base.scheme, base.netloc) or not parsed.path.startswith(base.path):
            raise ValueError(f'URL is outside --base-url: {value}')
        target = (output / unquote(parsed.path[len(base.path):])).resolve()
        if not target.is_relative_to(output):
            raise ValueError(f'URL is outside the output directory: {value}')
        return target / 'index.html' if parsed.path.endswith('/') else target

    def page(path):
        target = file_for(url(path))
        if not target.is_file():
            errors.append(f'{path}: generated page is missing')
            return None
        result = Page()
        result.feed(target.read_text(encoding='utf-8'))
        return result

    expected = {url(path) for path in TOOLS}
    hub_url = url('/tools/')
    pages = {}
    for path, tool in TOOLS.items():
        parsed = page(path)
        if parsed is None:
            continue
        pages[path] = parsed

        def single(key):
            values = parsed.meta.get(key, [])
            check(len(values) == 1 and bool(values[0].strip()), f'{path}: {key} must be nonempty and occur once')
            return values[0] if len(values) == 1 else ''

        check(len(parsed.titles) == 1 and bool(parsed.titles[0]), f'{path}: expected one nonempty Title')
        check(len(parsed.h1) == 1 and bool(parsed.h1[0]), f'{path}: expected one visible H1')
        check(len(parsed.h1) == 1 and topic_matches(tool, parsed.h1[0]), f'{path}: H1 does not describe this tool')
        description = single('description')
        check(description == single('og:description') == single('twitter:description'), f'{path}: description/share descriptions differ')
        check(len(parsed.canonical) == 1 and urljoin(url(path), parsed.canonical[0]) == url(path), f'{path}: canonical does not resolve to its own URL')
        check(urljoin(url(path), single('og:url')) == url(path), f'{path}: og:url does not resolve to its own URL')
        for key in ('robots', 'googlebot', 'bingbot'):
            for value in parsed.meta.get(key, []):
                check(not re.search(r'\b(?:noindex|none)\b', value, re.IGNORECASE), f'{path}: {key} prevents indexing')
        check(parsed.panels == [(tool, True)], f'{path}: only its own visible tool panel may be rendered; found {parsed.panels!r}')
        check(any(parsed.h2), f'{path}: visible static instructions require a H2 outside the tool panel')
        check(any(parsed.examples), f'{path}: visible static instructions require a nonempty pre/code example outside the tool panel')
        links = {urljoin(url(path), value) for value in parsed.links}
        required_links = (expected - {url(path)}) | {hub_url}
        check(required_links.issubset(links), f'{path}: missing real links to toolbox/other tools: {sorted(required_links - links)}')

    for attribute in ('titles', 'h1'):
        values = [text(getattr(parsed, attribute)[0]).casefold() for parsed in pages.values() if len(getattr(parsed, attribute)) == 1]
        check(len(values) == len(set(values)), f'Tool {attribute} values are duplicated')
    descriptions = [text(parsed.meta.get('description', [''])[0]).casefold() for parsed in pages.values()]
    check(len(descriptions) == len(set(descriptions)), 'Tool descriptions are duplicated')
    hub = page('/tools/')
    if hub is not None:
        links = {urljoin(hub_url, value) for value in hub.links}
        check(expected.issubset(links), f'/tools/: missing actual tool entry links: {sorted(expected - links)}')

    blog_urls = set()
    for relative in ('sitemap.xml', 'tools/sitemap.xml', 'blog/sitemap.xml'):
        sitemap = output / relative
        if not sitemap.is_file():
            errors.append(f'{relative}: Sitemap is missing')
            continue
        try:
            root = ET.parse(sitemap).getroot()
            locations = [(node.text or '').strip() for node in root.findall('.//{*}loc')]
            check(len(locations) == len(set(locations)), f'{relative}: duplicate Sitemap URL')
            if relative == 'blog/sitemap.xml':
                blog_urls = set(locations)
            else:
                check(expected.issubset(locations), f'{relative}: missing independent tool URLs: {sorted(expected - set(locations))}')
        except ET.ParseError as error:
            errors.append(f'{relative}: invalid XML: {error}')

    home = page('/')
    search_urls = []
    if home is not None:
        scripts = [urljoin(base_url, source) for source in home.scripts
                   if re.fullmatch(r'index(?:\.min)?(?:\.[^/]+)?\.js', Path(urlsplit(source).path).name)]
        check(len(scripts) == 1, f'Homepage must reference one compiled search index, found {scripts!r}')
        if len(scripts) == 1:
            try:
                source = file_for(scripts[0]).read_text(encoding='utf-8')
                search_urls = [urljoin(base_url, href) for href in search_hrefs(source)]
                required = expected | {hub_url} | blog_urls
                check(len(search_urls) == len(set(search_urls)), 'Compiled search index contains duplicate hrefs')
                check(required.issubset(search_urls), f'Compiled search index lost tool/blog URLs: {sorted(required - set(search_urls))}')
                check(not any('/docs/' in urlsplit(value).path or '/contributors/henk-verlinde/' in urlsplit(value).path
                              for value in search_urls), 'Compiled search index contains removed example pages')
            except (OSError, ValueError, SyntaxError) as error:
                errors.append(f'Cannot inspect compiled search index: {error}')
    return errors, len(pages), len(set(search_urls))


def main():
    sample = r'''const docs=[{href:"/one/",content:`You've seen "href:" here.
Escaped \` and \${example}; href:"/fake/"`},{href:"/two/"}];'''
    assert search_hrefs(sample) == ['/one/', '/two/'], 'Tutorial strings must not hide or fabricate search links'
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', nargs='?', type=Path, default=Path('public'))
    parser.add_argument('--base-url', default='https://clannad.icu/')
    args = parser.parse_args()
    try:
        errors, pages, search_entries = validate(args.output, args.base_url)
    except ValueError as error:
        parser.error(str(error))
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'Tool SEO checks passed: {pages} independent pages; metadata, visible panels, '
          f'static instructions, links, Sitemaps and {search_entries} unique search entries.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
