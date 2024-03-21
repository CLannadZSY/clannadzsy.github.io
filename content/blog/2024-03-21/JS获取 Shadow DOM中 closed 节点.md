---
title: "JS获取Shadow DOM中closes 节点"
description: ""
lead: ""
date: 2024-03-21T01:44:00Z
lastmod: 2024-03-21T01:44:00Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/3082362680/"
---

安装 [`油猴`](https://www.tampermonkey.net/) 插件, 在你需要获取的网站, 新建脚本, 填入以下代码, 刷新页面即可

```js
    Element.prototype._attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function () {
        return this._attachShadow({mode:'open'});
    };
```
