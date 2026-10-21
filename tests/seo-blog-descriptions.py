"""Validate independent article descriptions in generated or downloaded HTML."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET


class ArticleMetadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}
        self.jsonld = []
        self.capture = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            key = attrs.get('name') or attrs.get('property')
            self.meta.setdefault(key, []).append(attrs.get('content', ''))
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.capture, self.parts = True, []

    def handle_data(self, text):
        if self.capture:
            self.parts.append(text)

    def handle_endtag(self, tag):
        if tag == 'script' and self.capture:
            self.jsonld.append(json.loads(''.join(self.parts)))
            self.capture, self.parts = False, []


def validate(output, base_url):
    output = output.resolve()
    base = urlsplit(base_url)
    root = ET.parse(output / 'blog/sitemap.xml')
    urls = [node.text for node in root.findall('.//{*}loc')]
    assert urls and len(urls) == len(set(urls)), 'Blog Sitemap is empty or has duplicates'
    descriptions = {}
    for url in urls:
        parsed = urlsplit(url)
        assert (parsed.scheme, parsed.netloc) == (base.scheme, base.netloc), url
        assert parsed.path.startswith(base.path), url
        file = (output / unquote(parsed.path[len(base.path):]) / 'index.html').resolve()
        assert file.is_relative_to(output), file
        page = ArticleMetadata()
        page.feed(file.read_text(encoding='utf-8'))

        def single(key):
            values = page.meta.get(key, [])
            assert len(values) == 1 and values[0].strip(), (url, key, values)
            return values[0]

        description = single('description')
        assert description == single('og:description') == single('twitter:description'), url
        assert description != 'CLを書いて、人生を読みます。', url
        assert not any(character in description for character in '\r\n\t'), url
        key = ' '.join(description.split()).casefold()
        assert key not in descriptions, f'Duplicate article description: {url} and {descriptions.get(key)}'
        descriptions[key] = url
        articles = [entry for entry in page.jsonld if entry.get('@type') in ('Article', 'BlogPosting')]
        assert len(articles) == 1 and articles[0].get('description') == description, url
    print(f'Blog description checks passed: {len(urls)} distinct articles; '
          'HTML, Open Graph, Twitter and Article descriptions agree.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', nargs='?', type=Path, default=Path('public'))
    parser.add_argument('--base-url', default='https://clannad.icu/')
    args = parser.parse_args()
    validate(args.output, args.base_url)
