---
title: "Wsl2 Linux 子系统的导入与导出"
description: ""
lead: ""
date: 2024-11-26T14:58:22Z
lastmod: 2024-11-26T14:58:22Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/3262080571/"
---


1. 关闭 wsl

   ```bash	
   wsl --shutdown
   ```

2. 查看 wsl 信息

   ```bash
   wsl -l -v
     NAME            STATE           VERSION
   * Debian    	  Running         2
   ```

3. 导出

   ```bash
   wsl --export Debian D:\Debian.tar
   ```

4. 注销

   ```bash
   wsl --unregister Debian
   ```

5. 导入

   ```bash
   wsl --import Debian D:\Debian D:\Debian.tar
   ```

6. 设置默认登录用户, 否则默认为 `root` 用户登录

   ```bash
   Debian config --default-user <用户名>
   ```

   
