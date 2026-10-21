---
title: "Scrapy 永不停止的爬虫"
description: "展示 Spider 空闲时追加请求、RedisSpider 按分钟等待新任务的示例，涉及 spider_idle 信号、DontCloseSpider 和等待超时后关闭的处理。"
lead: ""
date: 2021-06-01T02:34:55Z
lastmod: 2021-06-01T02:34:55Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/3380200713/"
---

本文讨论通过 `spider_idle` 信号保留爬虫、等待下一批任务的方法。下面将演示限制为有限次数，便于本地验证；长时间运行时仍应设置空闲超时、请求速率和外部停止机制。

## 适用环境

本次示例在 Python 3.12.14、Scrapy 2.11.2、scrapy-redis 0.9.1 下验证，并固定 w3lib 2.2.1、Twisted 24.3.0，避免旧版 Scrapy 与新依赖的接口差异。Redis 队列测试另用 fakeredis 2.32.1，全部使用本地 `data:` 响应或模拟队列，不抓取外部网站。可在独立虚拟环境安装：

```bash
python -m pip install "Scrapy==2.11.2" "scrapy-redis==0.9.1" "w3lib==2.2.1" "Twisted==24.3.0" "fakeredis==2.32.1"
```

Scrapy 的 [`spider_idle` 信号](https://docs.scrapy.org/en/2.11/topics/signals.html#spider-idle)不支持异步处理器，不能在其中使用 `time.sleep(60)` 阻塞事件循环。抛出 `DontCloseSpider` 后，处理器应立即返回；下一次空闲检查会再次触发该信号。通过 `CloseSpider` 可以提供关闭原因。

## 在 Scrapy.Spider 中追加请求

保存为 `idle_spider.py`。这里使用内置的 `data:` 下载处理器生成本地响应，总共处理 3 次后正常结束。`dont_filter=True` 允许示例重复调度同一个 URL。

```python
from scrapy import Request, Spider, signals
from scrapy.crawler import CrawlerProcess
from scrapy.exceptions import DontCloseSpider


class TestSpider(Spider):
    name = 'test'
    start_urls = ['data:text/plain,local-fixture']
    max_requests = 3

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sent = 1  # start_urls 提供第一次请求

    def parse(self, response, **kwargs):
        self.logger.info('local response: %s', response.text)

    def next_request(self):
        self.sent += 1
        request = Request(
            self.start_urls[0], callback=self.parse, dont_filter=True,
        )
        # Scrapy 2.6+ 不再传入 spider=self。
        self.crawler.engine.crawl(request)

    def spider_idle(self):
        if self.sent >= self.max_requests:
            return  # 不再抛出 DontCloseSpider，允许正常关闭
        self.next_request()
        raise DontCloseSpider

    @classmethod
    def from_crawler(cls, crawler, *args, **kwargs):
        spider = super().from_crawler(crawler, *args, **kwargs)
        crawler.signals.connect(spider.spider_idle, signal=signals.spider_idle)
        return spider


if __name__ == '__main__':
    process = CrawlerProcess({
        'LOG_LEVEL': 'INFO',
        'TELNETCONSOLE_ENABLED': False,
        'REQUEST_FINGERPRINTER_IMPLEMENTATION': '2.7',
    })
    crawler = process.create_crawler(TestSpider)
    process.crawl(crawler)
    process.start()
    stats = crawler.stats.get_stats()
    assert stats['downloader/response_count'] == 3
    assert stats['finish_reason'] == 'finished'
    print('local responses: 3; finish reason: finished')
```

运行 `python idle_spider.py`。最后的断言检查实际处理次数及关闭原因；日志中的响应来自本地固定文本，不能据此判断任何网站的抓取结果。

## 在 RedisSpider 中等待新任务

`RedisSpider.start_requests()` 从 Redis 队列读取任务，不能依赖普通 `Spider` 的 `start_urls` 自动产生初始请求。在 scrapy-redis 0.9.1 中，应覆盖 [`make_request_from_data`](https://scrapy-redis.readthedocs.io/en/master/_modules/scrapy_redis/spiders.html)，使用队列里取出的数据生成请求，而不是忽略参数、始终请求 `self.start_urls[0]`。

保存为 `redis_wait_spider.py`。示例约定队列元素为 `{"url": "data:text/plain,first"}` 这样的 JSON 字符串。它只演示从 Redis 获取入口任务，使用 Scrapy 默认调度器；多进程共享调度队列、持久化与去重需另行配置。

```python
import json
import os
from time import monotonic

from scrapy import Request
from scrapy.exceptions import CloseSpider, DontCloseSpider
from scrapy_redis.spiders import RedisSpider


class RedisWaitSpider(RedisSpider):
    name = 'redis_wait'
    redis_key = f'{name}:start_urls'
    poll_interval = 60
    max_idle_seconds = 60 * 60
    custom_settings = {
        'REDIS_URL': os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/0'),
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._clock = monotonic
        self._empty_since = None
        self._next_poll = 0.0

    def make_request_from_data(self, data):
        payload = json.loads(data.decode(self.redis_encoding))
        return Request(payload['url'], callback=self.parse, dont_filter=True)

    def parse(self, response, **kwargs):
        self.logger.info('processed queued URL: %s', response.url)

    def spider_idle(self):
        now = self._clock()
        if now >= self._next_poll:
            requests = list(self.next_requests())
            for request in requests:
                self.crawler.engine.crawl(request)
            self._next_poll = now + self.poll_interval
            if requests:
                self._empty_since = None
            elif self._empty_since is None:
                self._empty_since = now

        if (self._empty_since is not None
                and now - self._empty_since >= self.max_idle_seconds):
            raise CloseSpider('redis_idle_timeout')
        raise DontCloseSpider
```

`RedisSpider.from_crawler()` 已连接此实例的 `spider_idle`，无需重复连接。未到下一次轮询时间时，处理器立即返回；达到轮询时间才读取队列。实际时机还取决于 Scrapy 的空闲检查，因此不是精确的每分钟定时器。这里的超时从首次观察到空队列开始计算，取到新任务后重置。若没有空闲超时，空队列可能使进程一直保留；`time.sleep()` 则会阻塞其他下载和回调。

### 不启动 Redis 服务的有限验证

把下面代码保存为同目录下的 `verify_redis_wait.py`。它使用 fakeredis、模拟的引擎和可推进的时钟，不启动下载器，也不实际等待一小时。

```python
import json
from types import SimpleNamespace
from unittest.mock import patch

import fakeredis
from scrapy.crawler import Crawler
from scrapy.exceptions import CloseSpider, DontCloseSpider
from scrapy.settings import Settings

from redis_wait_spider import RedisWaitSpider

server = fakeredis.FakeStrictRedis()
crawler = Crawler(RedisWaitSpider, Settings())
scheduled = []
crawler.engine = SimpleNamespace(crawl=scheduled.append)
with patch('scrapy_redis.connection.from_settings', return_value=server):
    spider = RedisWaitSpider.from_crawler(crawler)

clock = [0.0]
spider._clock = lambda: clock[0]

server.rpush(spider.redis_key, json.dumps({'url': 'data:text/plain,initial'}))
initial = list(spider.start_requests())
assert [request.url for request in initial] == ['data:text/plain,initial']


def expect_wait():
    try:
        spider.spider_idle()
    except DontCloseSpider:
        return
    raise AssertionError('expected DontCloseSpider')


server.rpush(spider.redis_key, json.dumps({'url': 'data:text/plain,first'}))
expect_wait()
assert [request.url for request in scheduled] == ['data:text/plain,first']

clock[0] = 1.0
server.rpush(spider.redis_key, json.dumps({'url': 'data:text/plain,second'}))
expect_wait()
assert server.llen(spider.redis_key) == 1  # 尚未达到下一轮询时间

clock[0] = 60.0
expect_wait()
assert scheduled[-1].url == 'data:text/plain,second'
assert len(scheduled) == 2

clock[0] = 120.0
expect_wait()  # 首次观察到空队列
clock[0] = 180.0
server.rpush(spider.redis_key, json.dumps({'url': 'data:text/plain,third'}))
expect_wait()
assert scheduled[-1].url == 'data:text/plain,third'
assert spider._empty_since is None  # 新任务重置空闲超时

clock[0] = 240.0
expect_wait()  # 再次从空队列开始计时
clock[0] = 3839.0
expect_wait()
clock[0] = 3840.0
try:
    spider.spider_idle()
except CloseSpider as exc:
    assert exc.reason == 'redis_idle_timeout'
else:
    raise AssertionError('expected idle timeout')
print('queue URLs, polling interval and idle timeout: OK')
```

运行 `python verify_redis_wait.py`，通过后输出 `queue URLs, polling interval and idle timeout: OK`。该检查覆盖初始任务、队列 URL 的使用、轮询间隔、新任务重置计时和超时分支；没有验证真实 Redis 连接、网络故障、分布式调度或外部网站抓取。实际运行前需根据目标服务与项目版本另行验证这些部分。
