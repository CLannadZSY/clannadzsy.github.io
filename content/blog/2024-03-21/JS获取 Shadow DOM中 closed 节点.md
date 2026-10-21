---
title: "JS获取Shadow DOM中closes 节点"
description: "记录通过 Tampermonkey 覆盖 attachShadow 的脚本示例，将后续创建的 Shadow DOM 改为 open 模式，便于检查相关节点。"
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
