---
title: "解决 Android 7 及以上的安卓系统模拟器, 无法抓包 https 请求"
description: ""
lead: ""
date: 2023-05-06T02:09:38Z
lastmod: 2023-05-06T02:09:38Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/3640029440/"
---

在Android 7及以上版本中，由于系统对证书的限制，使用抓包软件（如Fiddler、Charles）进行HTTPS抓包会遇到困难。下面介绍一种解决方案。

## 生成证书

首先需要将证书生成在本地电脑上，可使用cer或pem格式。然后通过openssl计算证书hash值：

### cer格式证书
```bash
openssl x509 -inform DER -subject_hash_old -in <证书文件.cer>
```

### pem格式证书
```bash
openssl x509 -inform PEM -subject_hash_old -in  <证书文件.pem>
```

然后生成系统预设格式的证书文件（记得加上".0"），如果hash值一样，则另一个设置成.1：

### cer格式
```bash
openssl x509 -inform DER -text -in xxx.cer > hash值.0
```

### pem格式
```bash
openssl x509 -inform PEM -text -in xxx.pem > hash值.0
```

## 安装证书

将证书安装到系统中：

1. 手机连接电脑，使用adb命令将手机连接到电脑。
2. 禁用系统验证：
    ```bash
    adb root
    adb disable-verity
    adb reboot
    adb root
    adb remount
    ```
3. 将证书文件push到手机：
    ```bash
    adb push <证书文件hash.0> /system/etc/security/cacerts/
    ```
4. 重启手机。

如果在adb disable-verity这步出现失败，则需要进行提权：

1. 进入adb shell：
    ```bash
    adb shell
    ```
2. 切换为root用户：
    ```bash
    su
    ```
3. 修改/system分区为可读写模式：
    ```bash
    mount -o rw,remount /system
    ```
4. 进入证书目录：
    ```bash
    cd /system/etc/security/cacerts/
    ```
5. 将分区改为可读写模式：
    ```bash
    mount -o rw,remount /
    ```
6. 修改证书文件：
    ```bash
    vi <证书文件hash.0>
    ```
    将证书内容的`-----BEGIN CERTIFICATE-----`和`-----END CERTIFICATE-----`段落从文件末尾移动到文件开头，然后保存退出。
7. 退出adb shell：
    ```bash
    exit
    ```
8. 重新执行第3步及以后的步骤。

## 修改抓包软件设置

如果在使用Charles进行HTTPS抓包时，发现证书无法生效，需要手动修改.0和.1文件，将证书内容的
`
-----BEGIN CERTIFICATE-----
.
.
.
.
.
.
-----END CERTIFICATE-----
`

段落从文件末尾移动到文件开头。
通过以上操作，就可以在Android 7及以上版本中使用抓包软件进行HTTPS抓包了。


## 参考链接

- [Stack Overflow: adb-remount-permission-denied-but-able-to-access-super-user-in-shell-android](https://stackoverflow.com/questions/13089694/adb-remount-permission-denied-but-able-to-access-super-user-in-shell-android)
- [Stack Overflow: adb-remount-fails-mount-system-not-in-proc-mounts](https://stackoverflow.com/questions/55030788/adb-remount-fails-mount-system-not-in-proc-mounts)