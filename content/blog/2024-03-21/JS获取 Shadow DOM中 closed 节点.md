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

安装 [Tampermonkey](https://www.tampermonkey.net/) 后，可以在自己的测试页面中提前替换 `attachShadow`，将后来经该方法创建的 Shadow Root 改为 `open`，方便调试。

## 执行时机与适用范围

脚本必须在页面调用 `attachShadow` **之前**、并在页面自己的 JavaScript 主执行环境（`MAIN_WORLD`，不是扩展的隔离环境）中运行。`document-start` 只是请求尽早注入；扩展权限、浏览器版本或 CSP 等仍可能影响实际时机和执行环境，不能保证赶在所有页面脚本之前。

下面是 Tampermonkey 4.18+ 的元信息示例。把 `@match` 的 `https://example.com/*` 换成自己要调试的页面范围，确认扩展获得该站点权限，再重新加载测试页。`@sandbox raw` 请求页面执行环境；若实际回退到了其他沙箱，需要先核实执行环境，单纯修改隔离环境的 `Element.prototype` 不会达到这里的目的。

```js
// ==UserScript==
// @name         Shadow DOM open-mode debugging
// @namespace    https://clannad.icu/
// @version      1.0
// @match        https://example.com/*
// @run-at       document-start
// @sandbox      raw
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    const prototype = Element.prototype;
    const marker = Symbol.for('clannadzsy.shadow-open-debug');
    const originalAttachShadow = prototype.attachShadow;
    if (originalAttachShadow[marker]) return;

    function attachShadowForDebug(options) {
        if (options === null || !['object', 'function'].includes(typeof options)) {
            return Reflect.apply(originalAttachShadow, this, arguments);
        }
        // 仅覆盖 mode；其余字段仍从原 options 读取，保留 getter 的接收者。
        const forwarded = new Proxy({}, {
            get: function (_target, key) {
                return key === 'mode' ? 'open' : Reflect.get(options, key, options);
            }
        });
        const args = Array.from(arguments);
        args[0] = forwarded;
        return Reflect.apply(originalAttachShadow, this, args);
    }
    Object.defineProperty(attachShadowForDebug, marker, { value: true });
    prototype.attachShadow = attachShadowForDebug;
}());
```

原方法保存在闭包中，通过 `Reflect.apply` 保留宿主元素的 `this`；重复安装这个脚本不会不断包裹自身。`delegatesFocus`、`slotAssignment` 等参数仍按原值读取，不会因强制 `mode` 而全部丢失。该调试 hook 会改变页面组件的封装行为，其他脚本再次替换该方法时也可能覆盖它。

## 已经创建的 closed root 不会改变

安装之前已经创建的 closed root，其宿主的 `shadowRoot` 仍为 `null`，不能追溯地变成 open。保存原先 `attachShadow` 返回引用的代码仍可能访问那个 root，但本脚本无法凭空恢复已经丢失的引用；声明式 Shadow DOM 等未调用此包装方法的创建路径也不在其作用范围内。

本次在 Chrome 无头浏览器的本地 `about:blank` 测试页验证：先创建的 closed root 保持不可从 `host.shadowRoot` 读取；安装脚本后创建的 root 为 open，能够查询其内部节点，而且 `delegatesFocus: true` 保留。没有向用户实际网页注入脚本，也没有把这个测试当作 Tampermonkey 在所有站点的注入时机保证。

参考 [MDN：attachShadow](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow)、[Tampermonkey：执行时机](https://www.tampermonkey.net/documentation.php?locale=en&q=run_at)与[执行环境](https://www.tampermonkey.net/documentation.php?locale=en&q=sandbox)。
