---
title: "Wsl2 Linux 子系统的导入与导出"
description: "记录 WSL 2 中 Debian 的导出与异名导入流程，涵盖备份校验、恢复验证、导入发行版默认用户设置，以及核验后可选的旧实例注销。"
lead: ""
date: 2024-11-26T14:58:22Z
lastmod: 2024-11-26T14:58:22Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/3262080571/"
---

适用范围：已能正常运行 Debian 的 Windows 10/11 + WSL 2。下列 `wsl` 命令在 Windows PowerShell 中执行；发行版名称以 `wsl --list --verbose` 为准，路径仅为示例。`/etc/wsl.conf` 的 `[user]` 设置要求 Windows Build 18980 或更高版本，参见 [Microsoft WSL 配置文档](https://learn.microsoft.com/en-us/windows/wsl/wsl-config#user-settings)。本次校订按官方文档核对命令，未进行真实发行版的导入或注销演练。

恢复顺序是：保留原 `Debian`，导出备份，使用新名称 `Debian-Restore` 导入并验证，最后才考虑是否注销旧实例。

1. 查看实例并停止待导出的 Debian

   先保存文件并退出正在运行的程序，停止实例会中断其中的进程。

   ```powershell
   wsl --list --verbose
   wsl --terminate Debian
   ```

   如确实需要停止所有发行版，可以用 `wsl --shutdown`；它会影响其他正在运行的 WSL 实例。本例只停止 Debian。

2. 导出并检查归档

   确保 D 盘有足够空间，且下面的备份文件名未被占用，不要覆盖已有的唯一备份。

   ```powershell
   wsl --export Debian "D:\Debian.tar"
   Get-Item "D:\Debian.tar"
   tar -tf "D:\Debian.tar"
   ```

   确认导出命令成功、文件非空且归档能列出内容；这仍不能代替下一步的实际恢复验证。保留此归档以及原实例，不要先执行 `--unregister`。

3. 导入为一个新实例

   先确认 `Debian-Restore` 未出现在实例列表中，安装目录应为新的空目录，不要指向原实例的数据目录。以下命令显式使用 WSL 2：

   ```powershell
   New-Item -ItemType Directory -Path "D:\WSL\Debian-Restore"
   wsl --import Debian-Restore "D:\WSL\Debian-Restore" "D:\Debian.tar" --version 2
   wsl --list --verbose
   wsl -d Debian-Restore -u root -- cat /etc/os-release
   ```

   预期列表同时保留 `Debian` 和 `Debian-Restore`，新实例的 `VERSION` 为 `2`，且能输出 Debian 的系统信息。命令语法参见 [Microsoft WSL 导入、导出说明](https://learn.microsoft.com/en-us/windows/wsl/basic-commands#export-a-distribution)。

4. 设置导入实例的默认登录用户

   `Debian config --default-user ...` 是发行版启动器的命令，不能用于没有独立启动器的导入实例。改用新实例内部的 `/etc/wsl.conf`。

   将下文的 `yourname` 换成已有的 Linux 用户名，先核对用户存在：

   ```powershell
   wsl -d Debian-Restore -u root -- id yourname
   wsl -d Debian-Restore -u root
   ```

   若该用户不存在，先在这个新 Debian 的 root 终端中创建，例如运行 `adduser yourname`；创建完成后再配置默认用户。编辑新实例内的 `/etc/wsl.conf`，保留原有其他配置，将下列内容合并到唯一的 `[user]` 节：

   ```ini
   [user]
   default=yourname
   ```

   保存后退出 Linux 终端，回到 PowerShell 关闭并重启新实例，使配置生效：

   ```powershell
   wsl --terminate Debian-Restore
   wsl -d Debian-Restore -- whoami
   wsl -d Debian-Restore -- ls -la /home/yourname
   ```

   `whoami` 应输出所设置的用户名。继续核对项目文件、用户权限、所需工具和日常应用是否正常；仅能启动终端不代表恢复已完整验证。

5. 可选：验证完成后处理旧实例

   可以一直保留原 `Debian`。仅在新实例的关键数据、权限和应用均已核验，另有可恢复备份，而且确认不再需要旧实例时，才手动考虑下面的注销命令：

   ```powershell
   # 仅针对确认不再需要的旧 Debian；不要注销 Debian-Restore
   wsl --unregister Debian
   ```

   注销会永久删除该实例关联的数据、软件和配置，无法通过重新安装自动找回；它不是导入新实例的必要步骤，详见[官方注销说明](https://learn.microsoft.com/en-us/windows/wsl/basic-commands#unregister-or-uninstall-a-linux-distribution)。
