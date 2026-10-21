"""Validate JSON-LD, language and dates in generated or downloaded production HTML.

Usage: python -B tests/seo-structured-data.py public --base-url https://clannad.icu/
Use --source /path/to/content to compare another checkout. --self-test runs fixtures.
Only the standard library is required; no network requests are made.
"""

import argparse
import ast
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from tempfile import TemporaryDirectory
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET


ENGLISH = {'/blog/4119532816/', '/blog/404388560/', '/blog/3231606058/'}
PROFILE = '/contributors/clannadzsy/'
GITHUB = 'https://github.com/CLannadZSY'
ISO_DATETIME = re.compile(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\Z')
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def instant(value):
    require(isinstance(value, str) and ISO_DATETIME.fullmatch(value),
            f'Expected ISO 8601 datetime with UTC offset, got {value!r}')
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def strict_json(value):
    def pairs(items):
        result = {}
        for key, item in items:
            require(key not in result, f'Duplicate JSON key: {key}')
            result[key] = item
        return result

    def constant(value):
        raise ValueError(f'Invalid JSON constant: {value}')

    return json.loads(value, object_pairs_hook=pairs, parse_constant=constant)


def frontmatter(file):
    """Read this site's top-level scalar/inline-list fields, not arbitrary YAML."""
    lines = file.read_text(encoding='utf-8-sig').splitlines()
    require(lines and lines[0] == '---', f'{file}: missing YAML frontmatter')
    values = {}
    for line in lines[1:]:
        if line == '---':
            return values
        match = re.match(r'^([A-Za-z_][\w-]*):\s*(.*?)\s*$', line)
        if not match:
            continue
        key, value = match.groups()
        require(key.lower() not in values, f'{file}: repeated frontmatter key {key}')
        if value.startswith('"'):
            value = json.loads(value)
        elif value.startswith("'"):
            require(value.endswith("'"), f'{file}: unsupported quoted field {key}')
            value = value[1:-1].replace("''", "'")
        elif value.startswith('['):
            try:
                value = ast.literal_eval(value)
            except (ValueError, SyntaxError):
                require(value.endswith(']'), f'{file}: unsupported inline list {key}')
                value = [item.strip().strip('\"\'') for item in value[1:-1].split(',') if item.strip()]
        else:
            value = value.split(' #', 1)[0].strip()
        values[key.lower()] = value
    raise ValueError(f'{file}: unclosed frontmatter')


def source_articles(source):
    result = {}
    for file in sorted((source / 'blog').rglob('*.md')):
        fields = frontmatter(file)
        if file.name == '_index.md' or str(fields.get('draft', 'false')).lower() == 'true':
            continue
        route = '/' + fields.get('url', f'blog/{file.stem}/').strip('/') + '/'
        require(route.startswith('/blog/'), f'{file}: blog URL is outside /blog/')
        language = fields.get('content_language', 'zh-CN')
        require(language in ('en', 'zh-CN'), f'{file}: unsupported content_language {language!r}')
        require(language == ('en' if route in ENGLISH else 'zh-CN'),
                f'{file}: content_language does not match the reviewed article language')
        expected = {'title': fields.get('title'), 'description': fields.get('description'),
                    'published': instant(fields.get('publishdate', fields.get('date'))),
                    'modified': instant(fields.get('lastmod', fields.get('date'))),
                    'language': language, 'contributors': fields.get('contributors')}
        require(expected['title'] and expected['description'], f'{file}: missing title/description')
        require(expected['contributors'] == ['clannadzsy'], f'{file}: unexpected author contract')
        require(route not in result or result[route] == expected,
                f'{file}: duplicate source URL has conflicting metadata: {route}')
        result[route] = expected
    require(result and ENGLISH.issubset(result), 'Source blog collection is empty or lost reviewed English articles')
    author = frontmatter(source / 'contributors/clannadzsy/_index.md')
    require(author.get('title') == 'clannadzsy' and author.get('same_as') == [GITHUB],
            'Real author source must declare clannadzsy and the reviewed GitHub same_as')
    return result


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.languages, self.canonicals, self.scripts, self.times = [], [], [], []
        self.meta, self.parts, self.stack = {}, None, []
        self.feed(html)
        require(self.parts is None, 'Unclosed JSON-LD script')

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        hidden = (self.stack[-1][1] if self.stack else False)
        hidden = hidden or tag in ('script', 'style', 'template', 'textarea') or 'hidden' in attrs
        hidden = hidden or attrs.get('aria-hidden', '').lower() == 'true' or 'd-none' in attrs.get('class', '').split()
        hidden = hidden or bool(re.search(r'(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b',
                                          attrs.get('style', ''), re.I))
        if tag == 'html':
            self.languages.append(attrs.get('lang', ''))
        elif tag == 'meta':
            key = attrs.get('property') or attrs.get('name')
            self.meta.setdefault(key, []).append(attrs.get('content', ''))
        elif tag == 'link' and 'canonical' in attrs.get('rel', '').lower().split():
            self.canonicals.append(attrs.get('href', ''))
        elif tag == 'time' and not hidden:
            self.times.append(attrs.get('datetime', ''))
        elif tag == 'script' and attrs.get('type', '').lower() == 'application/ld+json':
            require(self.parts is None, 'Nested JSON-LD script')
            self.parts = []
        if tag not in VOID:
            self.stack.append((tag, hidden))

    def handle_data(self, value):
        if self.parts is not None:
            self.parts.append(value)

    def handle_endtag(self, tag):
        if tag == 'script' and self.parts is not None:
            document = strict_json(''.join(self.parts))
            require(isinstance(document, dict), 'JSON-LD script must be a top-level object')
            self.scripts.append(document)
            self.parts = None
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                self.stack = self.stack[:index]
                break

    def single(self, key):
        values = self.meta.get(key, [])
        require(len(values) == 1 and bool(values[0].strip()), f'Expected one nonempty {key}: {values!r}')
        return values[0]

    def typed(self, kind):
        return [document for document in self.scripts if document.get('@type') == kind]


def validate(output, base_url, source, now=None):
    output, source = output.resolve(), source.resolve()
    base_url = base_url.rstrip('/') + '/'
    base = urlsplit(base_url)
    require(base.scheme in ('http', 'https') and base.netloc and not base.query and not base.fragment,
            '--base-url must be an absolute HTTP(S) base URL')
    now = now or datetime.now(timezone.utc)
    articles = source_articles(source)
    errors, pages, locations = [], {}, {}

    def url(route):
        return urljoin(base_url, route.lstrip('/'))

    def route(value):
        require(isinstance(value, str), f'Expected absolute canonical URL, got {value!r}')
        parsed = urlsplit(value)
        require((parsed.scheme, parsed.netloc) == (base.scheme, base.netloc)
                and parsed.path.startswith(base.path) and not parsed.query and not parsed.fragment,
                f'Expected absolute canonical URL under {base_url}: {value!r}')
        require('//' not in parsed.path and not any(part in ('.', '..') for part in unquote(parsed.path).split('/')),
                f'Noncanonical path: {value}')
        return '/' + parsed.path[len(base.path):].lstrip('/')

    def page_file(path):
        file = (output / unquote(path).lstrip('/')).resolve()
        require(file.is_relative_to(output), f'HTML path escapes output: {path}')
        return file / 'index.html' if path.endswith('/') else file

    def person(value):
        expected = {'@type': 'Person', '@id': url(PROFILE) + '#person', 'name': 'clannadzsy',
                    'url': url(PROFILE), 'sameAs': [GITHUB]}
        require(isinstance(value, dict) and all(value.get(key) == item for key, item in expected.items()),
                f'Expected real author Person with absolute profile identity, got {value!r}')

    # Parse every HTML document, including 404, so invalid JSON cannot hide off Sitemap.
    html_files = sorted(output.rglob('*.html'))
    require(html_files, 'Output contains no HTML')
    for file in html_files:
        relative = file.relative_to(output).as_posix()
        path = '/' + (relative[:-len('index.html')] if relative.endswith('index.html') else relative)
        try:
            parsed = Page(file.read_text(encoding='utf-8'))
            expected_language = articles.get(path, {}).get('language', 'zh-CN')
            require(len(parsed.languages) == 1 and parsed.languages[0].casefold() == expected_language.casefold(),
                    f'html lang must be {expected_language} (BCP 47 comparison ignores case)')
            for document in parsed.scripts:
                require(document.get('@context') == 'https://schema.org', 'JSON-LD @context must be https://schema.org')
                if 'inLanguage' in document:
                    require(document['inLanguage'] == expected_language, 'JSON-LD inLanguage differs from html lang')
            pages[path] = parsed
        except (ValueError, OSError) as error:
            errors.append(f'{path}: {error}')

    for name in ('sitemap.xml', 'blog/sitemap.xml'):
        try:
            root = ET.parse(output / name).getroot()
            entries = {}
            for node in root.findall('{*}url'):
                path = route(node.findtext('{*}loc'))
                require(path not in entries, f'{name}: duplicate URL {path}')
                entries[path] = node.findtext('{*}lastmod')
            require(entries, f'{name}: empty URL set')
            locations[name] = entries
        except (ValueError, OSError, ET.ParseError) as error:
            errors.append(f'{name}: {error}')
    root_entries = locations.get('sitemap.xml', {})
    require(set(articles) == set(locations.get('blog/sitemap.xml', {})), 'Blog Sitemap does not match source article URLs')
    required = set(articles) | {'/', '/blog/', '/tools/', '/tools/json-formatter/',
                              '/tools/curl-to-requests/', '/tools/timestamp/', '/contributors/', PROFILE}
    require(required.issubset(root_entries), f'Root Sitemap lost pages: {sorted(required - root_entries.keys())}')
    owner = None
    home = pages.get('/')
    if home:
        owners = home.typed('Person')
        if len(owners) == 1:
            owner = owners[0]

    for path in root_entries:
        try:
            require(path in pages, 'Missing or invalid generated HTML')
            page = pages[path]
            require(not page.typed('Organization'), 'Personal site must not retain a template Organization identity')
            require(page.canonicals == [url(path)], f'Canonical must be absolute and self-referential: {page.canonicals!r}')
            require(page.single('og:url') == url(path), 'og:url differs from canonical')
            language = articles.get(path, {}).get('language', 'zh-CN')
            require(page.single('og:locale') == ('en_US' if language == 'en' else 'zh_CN'),
                    'og:locale does not match page language')
            crumbs = page.typed('BreadcrumbList')
            if path == '/':
                require(not crumbs, 'Homepage must not have a self-link BreadcrumbList')
                require(len(page.typed('WebSite')) == 1, 'Homepage needs one WebSite')
                website = page.typed('WebSite')[0]
                require(website.get('url') == base_url and website.get('inLanguage') == 'zh-CN',
                        'Homepage WebSite URL/language is incorrect')
                require(len(page.typed('Person')) == 1, 'Homepage needs one real owner Person')
                person(owner)
            else:
                require(len(crumbs) == 1, 'Expected one BreadcrumbList')
                segments = path.strip('/').split('/')
                ancestors = ['/'] + ['/' + '/'.join(segments[:index]) + '/' for index in range(1, len(segments) + 1)]
                expected = []
                for position, ancestor in enumerate(ancestors, 1):
                    require(ancestor in pages, f'Breadcrumb ancestor page is missing: {ancestor}')
                    name = '首页' if ancestor == '/' else articles.get(ancestor, {}).get('title') or pages[ancestor].single('og:title')
                    expected.append({'@type': 'ListItem', 'position': position, 'name': name, 'item': url(ancestor)})
                require(crumbs[0].get('itemListElement') == expected,
                        f'Breadcrumb positions, titles or canonical items differ: {crumbs[0].get("itemListElement")!r}')

            if path in articles:
                expected = articles[path]
                documents = page.typed('Article')
                require(len(documents) == 1, 'Expected one top-level Article script (no @graph wrapper)')
                article = documents[0]
                require(article.get('headline') == expected['title'] == page.single('og:title'), 'Article headline differs from source/title')
                require(article.get('description') == expected['description'] == page.single('description'), 'Article description differs from source/meta')
                require(article.get('inLanguage') == language, 'Article inLanguage is missing or incorrect')
                require(article.get('mainEntityOfPage') == {'@type': 'WebPage', '@id': url(path)},
                        'Article mainEntityOfPage must identify its absolute canonical URL')
                author = article.get('author')
                require(isinstance(author, list) and len(author) == 1, 'Article author must be an array of real Persons')
                person(author[0])
                person(article.get('publisher'))
                require(author[0] == article['publisher'], 'Article author/publisher Person identities differ')
                require(owner is not None and all(author[0].get(key) == value for key, value in owner.items() if key != '@context'),
                        'Article Person differs from homepage owner')
                published, modified = instant(article.get('datePublished')), instant(article.get('dateModified'))
                require(published <= modified <= now, 'Article dates are reversed or in the future')
                require((published, modified) == (expected['published'], expected['modified']), 'Article dates differ from source frontmatter')
                require(instant(page.single('article:published_time')) == published, 'Open Graph publication date differs')
                require(instant(page.single('article:modified_time')) == modified, 'Open Graph modified date differs')
                visible_dates = [instant(value) for value in page.times]
                require(published in visible_dates and (modified == published or modified in visible_dates),
                        'Visible time datetime must include publication and changed modification dates')
                for name, entries in locations.items():
                    require(instant(entries.get(path)) == modified, f'{name}: lastmod differs from Article dateModified')
            else:
                require(not page.typed('Article'), 'Non-article page must not claim Article')
            profiles = page.typed('ProfilePage')
            if path == PROFILE:
                require(len(profiles) == 1, 'Author archive needs one ProfilePage')
                profile = profiles[0]
                require(profile.get('@id') == url(path) + '#profile' and profile.get('url') == url(path)
                        and profile.get('name') == 'clannadzsy' and profile.get('inLanguage') == 'zh-CN',
                        'ProfilePage identity/name/language is incorrect')
                person(profile.get('mainEntity'))
            elif path != '/':
                require(not profiles and not page.typed('Person'), 'Only homepage/profile may claim the real person as page subject')
        except (ValueError, TypeError) as error:
            errors.append(f'{path}: {error}')
    return errors, {'html_pages': len(html_files), 'canonical_pages': len(root_entries), 'articles': len(articles)}


def self_test():
    """Small generated fixtures exercise good output and targeted SEO regressions."""
    with TemporaryDirectory(prefix='structured-data-fixtures-') as temporary:
        root = Path(temporary)
        source, output = root / 'content', root / 'public'
        source.mkdir()
        output.mkdir()
        base = 'https://example.test/site/'
        stamp, modified = '2021-04-01T12:30:00+08:00', '2022-04-01T12:30:00+08:00'
        names = {'/': 'CL', '/blog/': 'Blogs', '/tools/': '在线工具箱', '/contributors/': '作者', PROFILE: 'clannadzsy'}
        articles = sorted(ENGLISH) + ['/blog/quoted/']
        owner = {'@type': 'Person', '@id': urljoin(base, PROFILE.lstrip('/')) + '#person',
                 'name': 'clannadzsy', 'url': urljoin(base, PROFILE.lstrip('/')), 'sameAs': [GITHUB]}
        author_file = source / 'contributors/clannadzsy/_index.md'
        author_file.parent.mkdir(parents=True)
        author_file.write_text(f'---\ntitle: "clannadzsy"\nsame_as: ["{GITHUB}"]\n---\n', encoding='utf-8')
        (source / 'blog').mkdir()
        for index, path in enumerate(articles):
            names[path] = f'Article {index}: "引号" & <text>'
            language = 'en' if path in ENGLISH else 'zh-CN'
            fields = {'title': names[path], 'description': 'Description with "quotes" & 中文', 'date': stamp,
                      'lastmod': modified, 'url': path, 'content_language': language}
            content = '\n'.join(f'{key}: {json.dumps(value, ensure_ascii=False)}' for key, value in fields.items())
            (source / 'blog' / f'{index}.md').write_text('---\n' + content + '\ncontributors: [clannadzsy]\n---\n', encoding='utf-8')
        for tool in ('json-formatter', 'curl-to-requests', 'timestamp'):
            names[f'/tools/{tool}/'] = tool
        documents = {}
        for path, name in names.items():
            language = 'en' if path in ENGLISH else 'zh-CN'
            data = []
            if path == '/':
                data += [dict(owner), {'@type': 'WebSite', 'url': base, 'inLanguage': 'zh-CN'}]
            else:
                segments = path.strip('/').split('/')
                ancestors = ['/'] + ['/' + '/'.join(segments[:index]) + '/' for index in range(1, len(segments) + 1)]
                data.append({'@type': 'BreadcrumbList', 'itemListElement': [
                    {'@type': 'ListItem', 'position': index, 'name': '首页' if ancestor == '/' else names[ancestor],
                     'item': urljoin(base, ancestor.lstrip('/'))} for index, ancestor in enumerate(ancestors, 1)]})
            if path in articles:
                data.append({'@type': 'Article', 'headline': name, 'description': 'Description with "quotes" & 中文',
                             'inLanguage': language, 'mainEntityOfPage': {'@type': 'WebPage', '@id': urljoin(base, path.lstrip('/'))},
                             'author': [dict(owner)], 'publisher': dict(owner),
                             'datePublished': '2021-04-01T04:30:00Z', 'dateModified': '2022-04-01T04:30:00Z'})
            if path == PROFILE:
                data.append({'@type': 'ProfilePage', '@id': owner['url'] + '#profile', 'url': owner['url'],
                             'name': 'clannadzsy', 'inLanguage': 'zh-CN', 'mainEntity': dict(owner)})
            documents[path] = data

        def write_page(path):
            from html import escape
            language = 'en' if path in ENGLISH else 'zh-CN'
            file = output / path.strip('/') / 'index.html'
            file.parent.mkdir(parents=True, exist_ok=True)
            metas = {'og:url': urljoin(base, path.lstrip('/')), 'og:title': names[path],
                     'og:locale': 'en_US' if language == 'en' else 'zh_CN'}
            if path in articles:
                metas.update({'description': 'Description with "quotes" & 中文',
                              'article:published_time': stamp, 'article:modified_time': modified})
            html = f'<html lang="{language.lower()}"><head><link rel="canonical" href="{metas["og:url"]}">'
            html += ''.join(f'<meta property="{key}" content="{escape(value, quote=True)}">' for key, value in metas.items())
            html += ''.join('<script type="application/ld+json">' + json.dumps(
                dict(document, **{'@context': 'https://schema.org'}), ensure_ascii=False) + '</script>' for document in documents[path])
            html += f'</head><body><time datetime="{stamp}"></time><time datetime="{modified}"></time></body></html>'
            file.write_text(html, encoding='utf-8')
            return file

        for path in names:
            write_page(path)
        for file, paths in [('sitemap.xml', names), ('blog/sitemap.xml', articles)]:
            sitemap = ET.Element('urlset', xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
            for path in paths:
                entry = ET.SubElement(sitemap, 'url')
                ET.SubElement(entry, 'loc').text = urljoin(base, path.lstrip('/'))
                ET.SubElement(entry, 'lastmod').text = modified
            ET.ElementTree(sitemap).write(output / file, encoding='utf-8', xml_declaration=True)
        errors, _ = validate(output, base, source)
        require(not errors, f'Valid fixture rejected: {errors}')
        path = articles[0]
        article = documents[path][-1]
        mutations = [
            (article, 'datePublished', '2021-04-01T12:30:00CET'),
            (article, 'dateModified', '2021-03-01T12:30:00Z'),
            (article, 'dateModified', '2999-04-01T12:30:00Z'),
            (article, 'dateModified', '2023-04-01T12:30:00Z'),
            (article, 'inLanguage', 'zh-CN'),
            (article, 'author', {'@type': 'Organization', 'name': 'Doks'}),
            (article, 'publisher', dict(owner, url=PROFILE)),
            (documents[path][0]['itemListElement'][1], 'position', 3),
            (documents[path][0]['itemListElement'][2], 'name', '123rd'),
            (documents[path][0]['itemListElement'][2], 'item', path),
        ]
        regressions = 0
        for target, key, bad in mutations:
            previous = target[key]
            target[key] = bad
            write_page(path)
            errors, _ = validate(output, base, source)
            require(errors, f'Invalid fixture accepted: {key}={bad!r}')
            regressions += 1
            target[key] = previous
            write_page(path)
        file = write_page(path)
        good = file.read_text(encoding='utf-8')
        for bad in (good.replace('"@type": "Article"', '"@type": "Article", "@type": "Article"'),
                    good.replace('"@type": "Article"', '"@type": NaN'),
                    good.replace('lang="en"', 'lang="zh-CN"'),
                    good.replace('content="en_US"', 'content="zh_CN"'),
                    good.replace(f'<time datetime="{modified}">', f'<time hidden datetime="{modified}">'),
                    good.replace(f'<time datetime="{modified}"></time>', '')):
            file.write_text(bad, encoding='utf-8')
            errors, _ = validate(output, base, source)
            require(errors, 'Malformed/language/time fixture accepted')
            regressions += 1
        file.write_text(good, encoding='utf-8')
        documents['/'].append(documents['/tools/'][0])
        write_page('/')
        errors, _ = validate(output, base, source)
        require(errors, 'Homepage self-link BreadcrumbList accepted')
        regressions += 1
        documents['/'][-1] = {'@type': 'Organization', 'name': 'Doks'}
        write_page('/')
        errors, _ = validate(output, base, source)
        require(errors, 'Template Organization identity accepted')
        regressions += 1
    print(f'Structured-data fixtures passed: valid multilingual/quoted HTML and {regressions} targeted regressions.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', nargs='?', type=Path, default=Path('public'))
    parser.add_argument('--base-url', default='https://clannad.icu/')
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[1] / 'content')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    try:
        if args.self_test:
            self_test()
            return 0
        errors, count = validate(args.output, args.base_url, args.source)
    except (ValueError, OSError, ET.ParseError) as error:
        print(error, file=sys.stderr)
        return 1
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'Structured-data checks passed: {count["html_pages"]} HTML pages; '
          f'{count["canonical_pages"]} canonical pages; {count["articles"]} Articles; '
          'JSON-LD, real Person identity, breadcrumbs, dates and page language agree.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
