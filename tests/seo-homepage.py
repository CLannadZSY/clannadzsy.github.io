"""Validate homepage SEO and share metadata in a production build."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
import struct
from urllib.parse import unquote, urlsplit


class HomepageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}
        self.canonical = []
        self.links = []
        self.titles = []
        self.headings = []
        self.capture = None
        self.text = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            key = attrs.get('name') or attrs.get('property')
            self.meta.setdefault(key, []).append(attrs.get('content', ''))
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical.append(attrs.get('href'))
        if tag == 'a':
            self.links.append(attrs.get('href', ''))
        if tag in ('title', 'h1', 'h2'):
            self.capture, self.text = tag, []

    def handle_data(self, text):
        if self.capture:
            self.text.append(text)

    def handle_endtag(self, tag):
        if tag == self.capture:
            text = ' '.join(''.join(self.text).split())
            if tag == 'title':
                self.titles.append(text)
            else:
                self.headings.append((tag, text))
            self.capture, self.text = None, []


def validate(output, base_url):
    output = output.resolve()
    page = HomepageParser()
    page.feed((output / 'index.html').read_text(encoding='utf-8'))
    assert len(page.titles) == 1 and 'CLannadZSY' in page.titles[0], page.titles
    assert not page.titles[0].rstrip().endswith('-'), page.titles
    h1 = [text for tag, text in page.headings if tag == 'h1']
    assert len(h1) == 1 and h1[0].strip(), h1
    assert page.canonical == [base_url], page.canonical

    def meta(key):
        values = page.meta.get(key, [])
        assert len(values) == 1 and values[0].strip(), (key, values)
        return values[0]

    description = meta('description')
    assert description == meta('og:description') == meta('twitter:description')
    assert page.titles[0] == meta('og:title') == meta('twitter:title')
    assert meta('og:url') == base_url
    assert meta('og:type') == 'website'
    assert meta('og:locale') == 'zh_CN'
    assert meta('twitter:card') == 'summary_large_image'
    assert meta('og:image:alt') == meta('twitter:image:alt')
    image = meta('og:image')
    assert image == meta('twitter:image')
    parsed, base = urlsplit(image), urlsplit(base_url)
    assert (parsed.scheme, parsed.netloc) == (base.scheme, base.netloc), image
    assert parsed.path.startswith(base.path) and '//' not in parsed.path, image
    image_file = (output / unquote(parsed.path[len(base.path):])).resolve()
    assert image_file.is_relative_to(output) and image_file.is_file(), image_file
    image_bytes = image_file.read_bytes()
    assert image_bytes[:8] == b'\x89PNG\r\n\x1a\n', image_file
    dimensions = struct.unpack('>II', image_bytes[16:24])
    assert dimensions == (1200, 630), dimensions
    assert dimensions == (int(meta('og:image:width')), int(meta('og:image:height')))
    assert not any(value == '@' or value == 'https://www.facebook.com/'
                   for values in page.meta.values() for value in values)
    assert not any('Doks' in value or 'Modern Documentation Theme' in value
                   for value in [page.titles[0], description, meta('og:title'), meta('twitter:title')])
    assert [text for tag, text in page.headings if tag == 'h2'] == [
        '悠哉日常大王', '『 』', '来自深渊', 'CL', '四月是你的谎言', '星之梦',
    ]
    paths = {urlsplit(url).path for url in page.links}
    assert base.path + 'blog/' in paths and base.path + 'tools/' in paths, paths
    print(f'Homepage checks passed: title, H1, description, canonical, share metadata, '
          f'{dimensions[0]}x{dimensions[1]} PNG, six anime sections and navigation.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', nargs='?', type=Path, default=Path('public'))
    parser.add_argument('--base-url', default='https://clannad.icu/')
    args = parser.parse_args()
    validate(args.output, args.base_url)
