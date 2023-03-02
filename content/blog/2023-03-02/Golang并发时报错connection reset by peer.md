---
title: "Golang并发时报错connection Reset by Peer"
description: ""
lead: ""
date: 2023-03-02T01:46:42Z
lastmod: 2023-03-02T01:46:42Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/630506263/"
---

当使用Golang进行并发时，有时可能会遇到`connection reset by peer`的错误。最开始可能会认为这是Golang的HTTP包的问题，但最终在Github中找到了解决方法。

首先，需要知道在操作系统中，打开的文件数、打开的socket数以及正在监听的端口数等统称为句柄数。操作系统对每个用户的句柄数都有默认限制，例如root用户默认限制为4096个句柄数。

因此，当Golang并发时报错`connection reset by peer`时，并不是因为你编写的程序有问题，而是操作系统设置的问题。

为了避免操作系统的文件句柄数限制goroutine的socket并发数量，我们需要增大程序运行时所使用用户的句柄数。如果你的进程使用root用户运行，那么需要增大root用户可打开的句柄数。

增加root用户可打开的文件数的方法如下：

1.  打开`/etc/security/limits.conf`文件：
    
    ```shell
    $ vi /etc/security/limits.conf
    ```
    
2.  在文件末尾添加以下两行：
    
    ```bash
    root - nofile 65535
    root - nproc 30000
    ```
    
3.  让配置生效：
    
    ```bash
    $ sysctl -p
    ```