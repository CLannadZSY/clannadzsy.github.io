---
title: "TOTP 在线验证码生成器"
description: "在浏览器本地生成 TOTP 两步验证动态验证码，兼容 PyOTP 默认的 SHA-1、6 位数字和 30 秒周期，支持自动刷新、倒计时与一键复制，不上传或保存密钥。"
type: "tools"
tool: "totp"
draft: false
---

## TOTP 验证码工具使用方法

1. 将已有的 Base32 密钥粘贴到输入框。密钥默认隐藏，需要核对时可点击“显示密钥”。
2. 工具立即生成当前的 6 位动态验证码，并显示本轮剩余时间。
3. 点击“复制验证码”，将结果粘贴到对应服务的两步验证输入框。
4. 每 30 秒自动更新一次。使用完毕后点击“清空”；离开工具时也会清除页面内的密钥和结果。

输入支持大小写字母、空格和合法的末尾 `=` 补位。工具会忽略空格并统一按 Base32 解码，不接受账号密码、恢复码或整段 Python 代码。

## 与 PyOTP 的兼容方式

此工具使用 HMAC-SHA1 算法、6 位数字和 30 秒周期，对应以下 Python 调用的默认设置：

```python
import pyotp

# 公开测试密钥，仅用于演示，不要用于真实账户。
secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
print(pyotp.TOTP(secret).now())
```

在相同密钥、相同时间步内，网页与 PyOTP 会生成相同的验证码。验证码可能以 `0` 开头，复制时会保留完整的 6 位数字。参数说明见 [PyOTP 官方文档](https://pyauth.github.io/pyotp/_modules/pyotp/totp.html)。

## 公开测试示例

以下示例来自 RFC 6238 的 SHA-1 测试数据，按本工具的 6 位设置保留结果末尾六位：

```text
Base32 密钥：GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
Unix 时间：59 秒（1970-01-01 00:00:59 UTC）
6 位验证码：287082
```

页面始终使用当前设备时间，今天粘贴这段公开密钥时，显示的结果会随当前时间变化，不会固定为 `287082`。该固定时间样例仅用于对照算法测试，相关标准见 [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238.html#appendix-B)。

## 验证码不一致时如何排查

- 确认粘贴的是对应账户的 TOTP 密钥，且内容完整。
- 开启电脑或手机的系统自动校时。TOTP 基于 Unix 时间计算，不需要选择时区，但设备时钟偏差会影响结果。
- 检查目标服务是否使用默认的 SHA-1、6 位、30 秒参数；本工具暂不支持其他算法或自定义周期。
- 倒计时即将结束时，可等下一轮验证码生成后再提交。

## 密钥与隐私

生成过程完全在浏览器内完成，不发送密钥或验证码到服务器，也不写入浏览器存储、URL 或日志。点击复制只会将验证码写入剪贴板。请使用 HTTPS 或 localhost 访问，并在自己信任的设备与浏览器中操作。

TOTP 密钥可以生成后续验证码，应妥善保管。此页用于临时生成验证码，不承担账户备份、密钥托管或登录验证服务。

## 相关工具

[JSON 格式化](/tools/json-formatter/) · [cURL 转 Python requests](/tools/curl-to-requests/) · [Unix 时间戳转换](/tools/timestamp/) · [返回工具箱](/tools/)
