---
title: "Scrapy 永不停止的爬虫"
description: ""
lead: ""
date: 2021-06-01T02:34:55Z
lastmod: 2021-06-01T02:34:55Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/3380200713/"
---



在 `Scrapy.Spider` 中的使用
```python
from scrapy import Request, Spider, signals
from scrapy.exceptions import DontCloseSpider


class TestSpider(Spider):
    name = 'test'

    start_urls = [
        'https://www.baidu.com'
    ]

    def parse(self, response, **kwargs):
        self.logger.info('crawled: %s', response.url)

    def next_request(self):
        req = Request(
            self.start_urls[0],
            callback=self.parse,
            dont_filter=True,
        )
        self.crawler.engine.crawl(req, spider=self)

    def spider_idle(self):
        self.next_request()
        self.logger.info('spider idled.')
        raise DontCloseSpider

    @classmethod
    def from_crawler(cls, crawler, *args, **kwargs):
        spider = super(TestSpider, cls).from_crawler(crawler, *args, **kwargs)
        crawler.signals.connect(spider.spider_idle, signal=signals.spider_idle)
        return spider

```
输出日志
```bash

[scrapy.core.engine] INFO: Spider opened
[scrapy.extensions.logstats] INFO: Crawled 0 pages (at 0 pages/min), scraped 0 items (at 0 items/min)
[scrapy.core.engine] DEBUG: Crawled (200) <GET https://www.baidu.com> (referer: None)
[test] INFO: crawled: https://www.baidu.com
[test] INFO: spider idled.
[scrapy.core.engine] DEBUG: Crawled (200) <GET https://www.baidu.com> (referer: None)
[test] INFO: crawled: https://www.baidu.com
[test] INFO: spider idled.
[scrapy.core.engine] DEBUG: Crawled (200) <GET https://www.baidu.com> (referer: None)
[test] INFO: crawled: https://www.baidu.com
[test] INFO: spider idled.
[scrapy.core.engine] DEBUG: Crawled (200) <GET https://www.baidu.com> (referer: None)
[test] INFO: crawled: https://www.baidu.com
[test] INFO: spider idled.
```


在 `RedisSpider` 中使用
```python
import time
import scrapy
from amz_spider.db_conf import REDIS_URL
from scrapy_redis.spiders import RedisSpider

from scrapy.exceptions import DontCloseSpider, CloseSpider


class TestSpider(RedisSpider):
    name = 'test'

    redis_key = f'{name}:start_urls'

    start_urls = [
        'https://www.baidu.com'
    ]

    custom_settings = {

        'SCHEDULER': 'scrapy_redis.scheduler.Scheduler',
        'DUPEFILTER_CLASS': 'scrapy_redis.dupefilter.RFPDupeFilter',
        'SCHEDULER_PERSIST': False,
        # redis 连接
        'REDIS_URL': REDIS_URL
    }

    wait_count = 0

    def parse(self, response, **kwargs):
        self.logger.info('crawled: %s', response.url)

    def make_requests_from_url(self, d):
        return scrapy.Request(self.start_urls[0], callback=self.parse)

    def spider_idle(self):
        if self.server.exists(self.redis_key):
            # 重置次数
            self.wait_count = 0
            self.schedule_next_requests()
            raise DontCloseSpider
        else:
            # 队列为空, 等待一小时, 每分钟检测一次, 是否有新的任务添加, 如果没有才退出
            if self.wait_count < 60:
                time.sleep(60)
                self.wait_count += 1
                raise DontCloseSpider
            raise CloseSpider

```