"""Exercise sitemap templates with an isolated multilingual Hugo fixture.

Usage: python tests/seo-sitemap-fixtures.py [--hugo /path/to/hugo]
"""

import argparse
from pathlib import Path
import os
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET


REPO = Path(__file__).resolve().parents[1]
TEMPLATES = (
    'layouts/sitemap.xml',
    'layouts/_default/section.sitemap.xml',
    'layouts/partials/sitemap/urls.xml',
)


def run(hugo):
    with tempfile.TemporaryDirectory(prefix='clannad-sitemap-') as directory:
        site = Path(directory).resolve()
        assert site.is_relative_to(Path(tempfile.gettempdir()).resolve())

        def write(path, text):
            target = site / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text, encoding='utf-8')

        for name in TEMPLATES:
            write(name, (REPO / name).read_text(encoding='utf-8'))
        html = '<html><head><link rel="canonical" href="{{ .Permalink }}"></head><body>{{ .Title }}</body></html>'
        for name in ('layouts/index.html', 'layouts/_default/list.html', 'layouts/_default/single.html'):
            write(name, html)
        write('config.toml', '''baseURL="https://clannad.icu/"
defaultContentLanguage="en"
defaultContentLanguageInSubdir=true
[languages.en]
weight=1
[languages.fr]
weight=2
[outputs]
home=["HTML"]
section=["HTML","SITEMAP"]
[outputFormats.SITEMAP]
mediaType="application/xml"
baseName="sitemap"
isHTML=false
isPlainText=true
noUgly=true
rel="sitemap"
[sitemap]
changefreq="weekly"
priority=0.5
''')

        def page(path, extra=''):
            write('content/' + path, '---\ntitle: Fixture\ndate: 2024-01-01T12:00:00+08:00\n' + extra + '---\nContent.\n')

        for name in (
            '_index.en.md', '_index.fr.md', 'blog/_index.en.md',
            'blog/deep/_index.en.md', 'blog/deep/deeper/_index.en.md',
            'blog/deep/deeper/article.en.md', 'blog/excluded-section/keep.en.md',
            'blog/translated.en.md', 'blog/translated.fr.md',
            'blog/hidden-translation.en.md',
        ):
            page(name)
        page('blog/duplicate-a.en.md', 'url: /shared/\nweight: 3\n')
        page('blog/duplicate-b.en.md', 'url: /shared/\nweight: 4\n')
        # The excluded copy is visited first. It must not suppress the valid copy.
        page('blog/excluded-duplicate.en.md', 'url: /kept-duplicate/\nweight: 1\nsitemap_exclude: true\n')
        page('blog/kept-duplicate.en.md', 'url: /kept-duplicate/\nweight: 2\n')
        for name in ('blog/omit.en.md', 'blog/excluded-section/_index.en.md', 'blog/hidden-translation.fr.md'):
            page(name, 'sitemap_exclude: true\n')

        built = subprocess.run(
            [str(hugo), '--source', str(site), '--environment', 'production'],
            capture_output=True, encoding='utf-8', errors='replace',
        )
        assert built.returncode == 0, (built.stdout, built.stderr)
        command = [sys.executable, str(REPO / 'tests/seo-sitemap.py'), str(site / 'public')]
        checked = subprocess.run(command, capture_output=True, encoding='utf-8', errors='replace')
        assert checked.returncode == 0, (checked.stdout, checked.stderr)
        print(checked.stdout.strip())

        for path in ('en/sitemap.xml', 'en/blog/sitemap.xml'):
            root = ET.parse(site / 'public' / path).getroot()
            urls = [entry.find('{*}loc').text for entry in root.findall('{*}url')]
            entries = {entry.find('{*}loc').text: entry for entry in root.findall('{*}url')}
            assert urls.count('https://clannad.icu/shared/') == 1
            assert urls.count('https://clannad.icu/kept-duplicate/') == 1
            assert not any('/omit/' in url or url.endswith('/excluded-section/') for url in urls)
            assert 'https://clannad.icu/en/blog/excluded-section/keep/' in entries
            nested = entries['https://clannad.icu/en/blog/deep/deeper/article/']
            assert nested.find('{*}lastmod').text == '2024-01-01T12:00:00+08:00'
            assert nested.find('{*}changefreq').text == 'weekly'
            assert nested.find('{*}priority').text == '0.5'
            translated = entries['https://clannad.icu/en/blog/translated/']
            alternates = [link.attrib for link in translated.findall('{http://www.w3.org/1999/xhtml}link')]
            assert {'rel': 'alternate', 'hreflang': 'fr', 'href': 'https://clannad.icu/fr/blog/translated/'} in alternates
            hidden = entries['https://clannad.icu/en/blog/hidden-translation/']
            assert not any(link.get('hreflang') == 'fr' for link in hidden.findall('{http://www.w3.org/1999/xhtml}link'))

        # Also prove that the output validator detects the original classes of error.
        sitemap = site / 'public/en/sitemap.xml'
        xml = sitemap.read_text(encoding='utf-8')
        sitemap.write_text(xml.replace('</urlset>', '<url><loc>/relative/</loc></url><url><loc>https://clannad.icu/shared/</loc></url></urlset>'), encoding='utf-8')
        rejected = subprocess.run(command, capture_output=True, encoding='utf-8', errors='replace')
        assert rejected.returncode == 1 and 'duplicate loc' in rejected.stderr and 'expected origin' in rejected.stderr, rejected.stderr
        print('Fixture checks passed: duplicates, excluded-first collision, nested sections, exclusions, metadata, translations, sitemap index and invalid-output detection.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    executable = 'hugo.exe' if os.name == 'nt' else 'hugo'
    parser.add_argument('--hugo', type=Path, default=REPO / 'node_modules/hugo-bin/vendor' / executable)
    run(parser.parse_args().hugo.resolve())
