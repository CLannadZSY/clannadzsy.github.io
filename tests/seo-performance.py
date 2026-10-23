"""Check production image, embed and script-loading regressions without a browser."""
import argparse
import base64
from html.parser import HTMLParser
from pathlib import Path
import re
import struct
import sys
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET


ORIGINAL_IMAGES = {
    '/blog/2022-03-25/image-20220325102753803.png',
    '/blog/2022-03-25/image-20220325103055076.png',
    '/blog/2022-03-25/image-20220325110037709.png',
    '/blog/2024-03-17/img/wind_mouse_examples.png',
    '/blog/2024-03-17/img/wind_mouse_high_wind_examples.png',
}
ADSENSE_URL = ('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
               '?client=ca-pub-7158791715796373')


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.scripts, self.images, self.ads, self.units, self.comments, self.mounts = [], [], [], [], [], []
        self.pre = 0
        self.in_head = False
        self.inline_script = None
        self.inline_scripts = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'head':
            self.in_head = True
        if tag == 'script' and not attrs.get('src'):
            self.inline_script = []
        if tag == 'script' and attrs.get('src'):
            attrs['_in_head'] = self.in_head
            self.scripts.append(attrs)
        if tag == 'img':
            self.images.append(attrs)
        if tag == 'pre':
            self.pre += 1
        if 'data-ad-container' in attrs:
            self.ads.append(attrs)
        if tag == 'ins' and 'adsbygoogle' in attrs.get('class', '').split():
            self.units.append(attrs)
        if 'data-comments-container' in attrs:
            self.comments.append(attrs)
        if 'data-comments-mount' in attrs:
            self.mounts.append(attrs)

    def handle_data(self, data):
        if self.inline_script is not None:
            self.inline_script.append(data)

    def handle_endtag(self, tag):
        if tag == 'head':
            self.in_head = False
        if tag == 'script' and self.inline_script is not None:
            self.inline_scripts.append(''.join(self.inline_script))
            self.inline_script = None


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check_page(page, route, base_url):
    base = urlsplit(base_url)
    tools = route.startswith('/tools/')
    blog = route.startswith('/blog/')
    article = blog and route != '/blog/'
    expected_adsense = route not in ('/tools/', '/tools/totp/', '/404.html')
    libraries = [script for script in page.scripts if script['src'] == ADSENSE_URL]
    require(len(libraries) == int(expected_adsense), 'Missing or duplicate head AdSense library')
    names = []
    for script in page.scripts:
        if script['src'] == ADSENSE_URL:
            require(script['_in_head'] and 'async' in script and 'defer' not in script
                    and script.get('crossorigin') == 'anonymous',
                    'AdSense must load once, asynchronously in head, without visibility/idle gating')
            continue
        parsed = urlsplit(urljoin(base_url, script['src']))
        require((parsed.scheme, parsed.netloc) == (base.scheme, base.netloc),
                'Unexpected third-party script outside the AdSense allowlist')
        require('defer' in script and 'async' not in script, 'First-party script must preserve deferred order')
        require(script.get('crossorigin') == 'anonymous', 'Missing SRI crossorigin')
        integrity = script.get('integrity', '')
        require(integrity.startswith('sha512-') and len(base64.b64decode(integrity[7:], validate=True)) == 64,
                'Missing or invalid SHA-512 SRI')
        names.append(Path(parsed.path).name)
    require(len(names) == len(set(names)), 'Duplicate script URL')
    require(sum(name.startswith('core') for name in names) == 1, 'Expected one shared core bundle')
    indexes = [script for script in page.scripts if Path(urlsplit(script['src']).path).name.startswith('index.min.')]
    require(len(indexes) == 1 and indexes[0].get('fetchpriority') == 'low', 'Search asset must remain crawlable with low fetch priority')
    tool_bundles = [name for name in names if name.startswith('tools')]
    require(len(tool_bundles) == (1 if tools else 0), 'Tool code must load only on tool pages')
    require(sum(name.startswith('highlight') for name in names) == (1 if page.pre else 0),
            'Syntax highlighting must match pages with code blocks')
    expected_ad = route == '/' or blog
    require(len(page.ads) == len(page.units) == int(expected_ad), 'Missing or duplicate manual ad placement')
    require(sum(name.startswith('deferred-embeds') for name in names) == int(article),
            'Deferred embed loader must load only on article pages with comments')
    require(sum('window.adsbygoogle' in script for script in page.inline_scripts) == int(expected_ad),
            'Each manual ad must be queued immediately, once')
    for unit in page.units:
        style = unit.get('style', '').replace(' ', '').lower()
        require('display:block' in style and 'height:' not in style, 'Ad unit must retain responsive sizing')
        require(unit.get('data-ad-format') == 'auto' and unit.get('data-full-width-responsive') == 'true',
                'Responsive ad format must not be restricted for performance')
        require(unit.get('data-ad-client') == 'ca-pub-7158791715796373'
                and unit.get('data-ad-slot') == '4686887066', 'Ad identity changed')
    require(len(page.comments) == len(page.mounts) == int(article), 'Article comments placement is missing or duplicated')
    for mount in page.mounts:
        require(mount.get('data-repo') == 'CLannadZSY/clannadzsy.github.io'
                and mount.get('data-issue-term') == 'title' and mount.get('data-theme') == 'github-light',
                'Original comment configuration changed')
    for index, image in enumerate(page.images):
        require('alt' in image and image.get('decoding') == 'async', 'Image alt/async decoding is missing')
        require(image.get('loading') == ('eager' if index == 0 else 'lazy'), 'First image must be eager; later images lazy')
        require(not any(key.startswith('data-src') for key in image), 'Images must work without a JavaScript lazy-loader')
        parsed = urlsplit(urljoin(base_url, image.get('src', '')))
        if parsed.netloc == base.netloc:
            require(int(image.get('width', '0')) > 0 and int(image.get('height', '0')) > 0,
                    'Local image must have intrinsic dimensions')
        if image.get('srcset'):
            require(image.get('sizes'), 'Responsive image needs sizes')


def validate(output, base_url, check_assets):
    output = output.resolve()
    base = urlsplit(base_url)
    urls = [node.text for node in ET.parse(output / 'sitemap.xml').findall('.//{*}loc')]
    require(len(urls) == len(set(urls)) == 38, 'Canonical URL set changed')
    errors, originals, image_count = [], set(), 0

    def local_file(url):
        parsed = urlsplit(urljoin(base_url, url))
        require((parsed.scheme, parsed.netloc) == (base.scheme, base.netloc), 'Expected a local asset')
        file = (output / unquote(parsed.path[len(base.path):])).resolve()
        require(file.is_relative_to(output), 'Asset path escapes output')
        return file

    for url in urls:
        try:
            parsed = urlsplit(url)
            page = Page((local_file(url) / 'index.html').read_text(encoding='utf-8'))
            check_page(page, parsed.path, base_url)
            image_count += len(page.images)
            for image in page.images:
                original = urlsplit(urljoin(url, image['src']))
                if original.netloc != base.netloc:
                    continue
                originals.add(original.path)
                if not check_assets:
                    continue
                data = local_file(original.geturl()).read_bytes()
                require(data[:8] == b'\x89PNG\r\n\x1a\n', 'Expected preserved original PNG')
                width, height = struct.unpack('>II', data[16:24])
                require((width, height) == (int(image['width']), int(image['height'])), 'Image dimensions differ from PNG')
                for candidate in image.get('srcset', '').split(','):
                    if not candidate.strip():
                        continue
                    address, descriptor = candidate.strip().rsplit(' ', 1)
                    require(re.fullmatch(r'[1-9]\d*w', descriptor), 'Malformed srcset width')
                    resized = local_file(urljoin(url, address)).read_bytes()
                    require(resized[:8] == b'\x89PNG\r\n\x1a\n', 'Unexpected derivative format')
                    candidate_width = struct.unpack('>I', resized[16:20])[0]
                    require(candidate_width == int(descriptor[:-1]), 'Wrong srcset intrinsic width')
                    if candidate_width < width:
                        require(len(resized) < len(data), 'Derivative should reduce transfer bytes')
        except (ValueError, OSError, KeyError, TypeError) as error:
            errors.append(f'{url}: {error}')
    try:
        check_page(Page((output / '404.html').read_text(encoding='utf-8')), '/404.html', base_url)
    except (ValueError, OSError) as error:
        errors.append(f'404.html: {error}')
    require(originals == ORIGINAL_IMAGES, f'Original article image set changed: {originals ^ ORIGINAL_IMAGES}')
    require(image_count == 7, f'Expected all seven existing article images, found {image_count}')
    require(not errors, '\n'.join(errors))
    print(f'Performance markup checks passed: {len(urls)} pages, {image_count} original images, '
          f'async AdSense, responsive ad placements and page-specific deferred scripts; asset bytes checked={check_assets}.')


def self_test():
    sri = 'sha512-' + base64.b64encode(bytes(64)).decode()
    script = lambda name: f'<script src="/{name}.min.test.js" integrity="{sri}" crossorigin="anonymous" defer></script>'
    adsense = f'<script async src="{ADSENSE_URL}" crossorigin="anonymous"></script>'
    queue = '<script>(window.adsbygoogle = window.adsbygoogle || []).push({});</script>'
    good = ('<head>' + adsense + '</head>' + script('core')
            + script('index').replace(' defer', ' fetchpriority="low" defer')
            + '<aside data-ad-container><ins class="adsbygoogle" style="display:block" '
            'data-ad-client="ca-pub-7158791715796373" data-ad-slot="4686887066" '
            'data-ad-format="auto" data-full-width-responsive="true"></ins>' + queue + '</aside>')
    check_page(Page(good), '/', 'https://clannad.icu/')
    mutations = [good.replace(' defer', ''), good.replace('display:block', 'display:block;height:100px'), good + script('tools'),
                 good + script('highlight'), good + '<script src="https://utteranc.es/client.js"></script>',
                 good + '<aside data-ad-container></aside>', good.replace('fetchpriority="low"', ''),
                 good.replace('data-ad-format="auto"', ''), good.replace(adsense, ''), good + adsense,
                 good.replace(' async', ' defer'), good.replace(queue, ''), good + queue,
                 good.replace(adsense, '').replace('</head>', '</head>' + adsense)]
    for bad in mutations:
        try:
            check_page(Page(bad), '/', 'https://clannad.icu/')
        except ValueError:
            continue
        raise ValueError('Performance regression fixture was accepted')
    for route in ('/tools/', '/tools/totp/'):
        tool = script('core') + script('tools') + script('index').replace(' defer', ' fetchpriority="low" defer')
        check_page(Page(tool), route, 'https://clannad.icu/')
        try:
            check_page(Page('<head>' + adsense + '</head>' + tool), route, 'https://clannad.icu/')
        except ValueError:
            continue
        raise ValueError('Sensitive tool page allowed third-party AdSense code')
    print(f'Performance fixtures passed: {len(mutations)} script/ad regressions rejected; TOTP isolation preserved.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', nargs='?', type=Path, default=Path('public'))
    parser.add_argument('--base-url', default='https://clannad.icu/')
    parser.add_argument('--check-assets', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    try:
        if args.self_test:
            self_test()
        else:
            validate(args.output, args.base_url, args.check_assets)
    except (ValueError, OSError, ET.ParseError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
