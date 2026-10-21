---
title: "解决 Android 7 及以上的安卓系统模拟器, 无法抓包 https 请求"
description: "整理 Android 7 及以上系统和模拟器进行 HTTPS 抓包的证书配置笔记，涵盖 OpenSSL 证书格式处理、ADB 安装系统证书及 Charles 相关设置。"
lead: ""
date: 2023-05-06T02:09:38Z
lastmod: 2023-05-06T02:09:38Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/3640029440/"
---

Android 7.0+ 上，`targetSdkVersion` 为 24 及以上的应用默认只信任系统 CA，不再默认信任用户安装的 CA；旧 target 的默认策略不同，应用也可以自行配置。因而把 Charles、Fiddler 的 CA 装入“用户证书”后，部分应用仍会拒绝 HTTPS 连接。规则见 [Android 官方 Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)。

本文保留系统 CA 的处理思路，只适用于自己控制的可 root 测试镜像；普通量产设备不保证支持 `adb root`。Android 14 起信任库还涉及 Conscrypt APEX，不能把向旧系统目录复制文件的步骤推广到所有 Android 版本。安装 CA 也不保证绕过应用或网络库自行实现的 TLS pinning。

## 导出并转换代理 CA

从实际使用的抓包代理导出其 CA 证书。`.cer` 后缀并不能证明内容是 DER，要按文件实际格式选择下面一组命令；两组是替代方案。本次仅在 Windows、OpenSSL 1.1.1l 验证格式转换，不是建议继续使用这个旧版本部署生产服务。

### DER 格式证书

```bash
openssl x509 -inform DER -in proxy-ca.cer -subject_hash_old -noout
openssl x509 -inform DER -in proxy-ca.cer -outform PEM -out hash.0
```

### PEM 格式证书

```bash
openssl x509 -inform PEM -in proxy-ca.pem -subject_hash_old -noout
openssl x509 -inform PEM -in proxy-ca.pem -outform PEM -out hash.0
```

把文件名中的 `hash` 换成第一条命令输出的八位哈希值。例如输出 `abcd1234` 时，文件名为 `abcd1234.0`；如果目标目录存在同名文件，先比较证书，不要直接覆盖，不同证书发生名称冲突时需按该信任库规则使用后续序号。

输出应是纯 PEM，不加 `-text`，也不需要手工移动证书文本。可在本地检查其信息：

```bash
openssl x509 -inform PEM -in hash.0 -noout -subject -issuer -fingerprint -sha256
```

确认代理导出的证书与转换后的 SHA-256 指纹相同。`subject_hash_old` 是用于命名的旧 subject 哈希，不是证书的安全指纹。参数说明见 [OpenSSL x509 文档](https://docs.openssl.org/1.1.1/man1/x509/)。

## 旧系统目录：仅限已确认可写的测试镜像

在一些较旧的可 root 测试镜像中，系统 CA 位于 `/system/etc/security/cacerts/`。下面是该前提成立时的操作示意，执行前需自行核对镜像版本、目录及同名文件；不是普通手机的通用步骤：

```bash
adb root
adb remount
adb push hash.0 /system/etc/security/cacerts/hash.0
adb shell chown root:root /system/etc/security/cacerts/hash.0
adb shell chmod 0644 /system/etc/security/cacerts/hash.0
adb reboot
```

这些设备命令未在本次环境执行。若镜像不支持 root、remount 或目录不可写，应停止并查该镜像的说明；不能假设执行 `su` 或随意禁用验证就会成功。新镜像的分区、SELinux 与信任库实现也可能要求不同的安装方式。

[Android 官方 Conscrypt 说明](https://source.android.com/docs/core/ota/modular-system/conscrypt)指出 Android 14 起根信任证书同时存于 Conscrypt APEX 和系统分区，因此仅修改旧路径不构成已验证的 Android 14+ 方案。测试结束后应按测试镜像的恢复方式撤销更改。

## 自有应用可以使用仅调试生效的信任配置

能修改自己 APK 时，可在 debug 变体中声明代理 CA，避免依赖系统目录。把纯 PEM 证书放到 `src/debug/res/raw/proxy_ca.pem`，在 `src/debug/res/xml/debug_network_security_config.xml` 写入：

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <debug-overrides>
        <trust-anchors>
            <certificates src="@raw/proxy_ca" />
        </trust-anchors>
    </debug-overrides>
</network-security-config>
```

在 `src/debug/AndroidManifest.xml` 中引用它；已有网络配置时需结合项目合并，不要覆盖正式版本的配置：

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:networkSecurityConfig="@xml/debug_network_security_config" />
</manifest>
```

`debug-overrides` 仅在应用 `android:debuggable` 为 true 时生效，通常由 debug 构建设置。平台网络安全配置会对使用这些调试信任锚的证书链按其调试规则处理 pinning；这不等同于能绕过任意应用自定义的校验。这里仅静态解析了 XML，未构建 APK、安装证书或在 Android 设备上验证。

## 抓包验证

在 Charles 或 Fiddler 中启用目标域名的 HTTPS/SSL Proxying，确认应用实际经过该代理，并检查握手错误、证书链与目标域名是否匹配。若仍失败，应区分代理连通性、应用信任配置和自定义证书校验，而不是继续手工改写 PEM 文件内容。本次只验证了临时 CA 的 DER/PEM 转换、哈希及证书往返一致性。
