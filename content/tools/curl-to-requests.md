---
title: "cURL 转 Python requests"
description: "将常见 cURL 命令转换为 Python requests 代码，支持请求头、Cookie、JSON 请求体和查询参数，提供 GET、POST 示例与使用说明。"
type: "tools"
tool: "curl"
draft: false
---

## 使用方法

1. 粘贴一条以 `curl` 开头的命令，例如浏览器开发者工具 Network 面板中“Copy as cURL”复制的请求。
2. 点击“转换”，在右侧查看生成的 Python requests 代码。
3. 点击“复制”，检查请求地址、请求头、认证和请求体，再放入已安装 `requests` 的 Python 环境中运行。

页面只生成代码，点击“转换”不会向命令中的目标地址发送请求。运行生成的 Python 代码才会发出 HTTP 请求；Requests 的安装和 API 用法见 [官方快速入门](https://requests.readthedocs.io/en/latest/user/quickstart/)。

## 示例：带请求头的 GET

输入：

```bash
curl 'https://example.com/api/messages?limit=2' -H 'Accept: application/json'
```

结果会保留 URL 和 `Accept` 请求头，并生成 `requests.get(...)` 调用。这里的 `example.com` 是示例地址，可替换为你实际需要访问的接口。

## 示例：发送 JSON 的 POST

输入：

```bash
curl 'https://example.com/api/messages' \
  -H 'Content-Type: application/json' \
  --data-raw '{"name":"CLANNAD","favorite":true}' \
  --max-time 10
```

输出：

```python
import requests

url = "https://example.com/api/messages"

headers = {
    "Content-Type": "application/json",
}

payload = {
    "name": "CLANNAD",
    "favorite": True,
}

response = requests.post(
    url,
    headers=headers,
    json=payload,
    timeout=10,
)

print(response.status_code)
print(response.text)
```

JSON 中的 `true` 已转换为 Python 的 `True`；识别为 JSON 的请求体通过 `json=payload` 传入。

## 支持范围与常见问题

- 支持单个请求地址、常见 HTTP 方法、`-H` 请求头、`-b` Cookie 字符串、`-u` 基本认证、常见 `--data` 参数及 `--json`。
- `-G` 搭配数据参数会生成查询参数；`--max-time` 或 `--connect-timeout` 会转换为 Requests 的 `timeout` 参数，两者的实际超时语义并不完全相同。
- 暂不支持 `-F` 文件上传或 `@文件名` 读取请求体。遇到未支持的选项、缺失 URL 或未闭合引号时，会提示错误，需调整命令后再转换。
- 转换覆盖常见用法，不能保证所有 cURL 选项与 Requests 行为完全相同；例如部分显示和传输选项不会出现在输出中。转换后应结合接口要求检查代码。

## 相关工具

[JSON 格式化](/tools/json-formatter/) · [Unix 时间戳转换](/tools/timestamp/) · [返回工具箱](/tools/)
