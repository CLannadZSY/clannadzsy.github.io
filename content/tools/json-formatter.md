---
title: "JSON 格式化工具"
description: "在线格式化 JSON、JSON5 和常见 Python Dict，转换为带缩进与语法高亮的标准 JSON，支持复制结果并提示解析错误。"
type: "tools"
tool: "json"
draft: false
---

## 使用方法

1. 将待处理的数据粘贴到“原始 JSON”输入框。
2. 点击“格式化”，在结果区查看两空格缩进和语法高亮后的 JSON。
3. 点击“复制”获取结果；如果输入不完整或语法有误，输入框下方会显示解析错误，修改后可重新格式化。

解析和格式化在浏览器中完成。输入框支持标准 JSON，也支持 JSON5 的单引号、未加引号的标识符键、注释和尾随逗号，语法说明可参阅 [JSON5 官方文档](https://json5.org/)。

## 示例：格式化标准 JSON

输入：

```json
{"name":"CLANNAD","episodes":23,"favorite":true}
```

输出：

```json
{
  "name": "CLANNAD",
  "episodes": 23,
  "favorite": true
}
```

## 示例：常见 Python 字典写法

输入中的 `True`、`False`、`None` 会转换为 JSON 的 `true`、`false`、`null`；数字键会转换为字符串键。

```python
{'name': 'CLANNAD', 'favorite': True, 'note': None, 1: '第一季'}
```

输出：

```json
{
  "1": "第一季",
  "name": "CLANNAD",
  "favorite": true,
  "note": null
}
```

## 适用范围

这里处理的是数据字面量，不会执行 Python 或 JavaScript 表达式，也不支持 Python 的元组、集合和函数调用。格式化会移除注释、统一引号与缩进，并可能调整数字键的顺序。

数字使用 JavaScript 数值精度；需要完整保留的长整数编号应使用字符串。JSON5 中的 `NaN`、`Infinity` 经标准 JSON 序列化会成为 `null`，因此不适合用本工具无损保存这些特殊数值。

## 相关工具

[cURL 转 Python requests](/tools/curl-to-requests/) · [Unix 时间戳转换](/tools/timestamp/) · [返回工具箱](/tools/)
