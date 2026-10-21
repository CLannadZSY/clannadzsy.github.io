---
title: "在 HTTPS 端口使用 SSH"
description: "整理 GitHub SSH 连接受限时通过 443 端口连接的配置笔记，涉及连通性测试、仓库克隆、SSH 配置文件与已知主机指纹检查。"
lead: ""
date: 2024-05-22T07:51:17Z
lastmod: 2026-10-22T00:06:41+08:00
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/532834567/"
---

当网络阻断默认的 SSH 22 端口时，可以尝试 GitHub.com 提供的 443 端口 SSH 服务。这里传输的仍是 SSH 协议，使用的主机名是 `ssh.github.com`；它不是把 SSH 请求转换成 HTTPS，强制使用 HTTP 代理的网络仍可能无法连接。

## 适用环境

适用于安装了 Git 和 OpenSSH 客户端的 Linux、macOS 或 Windows，且已经把对应公钥添加到 GitHub 账户。以下命令可在终端或 PowerShell 中执行；Windows OpenSSH 的配置文件通常为 `%USERPROFILE%\.ssh\config`，Linux/macOS 为 `~/.ssh/config`。

本文针对 GitHub.com。GitHub Enterprise Server，以及具有数据驻留功能的 Enterprise Cloud，不应直接套用这个入口；以 [GitHub 当前支持范围](https://docs.github.com/en/authentication/troubleshooting-ssh/using-ssh-over-the-https-port)为准。

## 先测试 443 端口

```bash
ssh -T -p 443 git@ssh.github.com
```

首次连接时，先把主机指纹与 [GitHub 官方指纹列表](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)核对，再决定是否信任。不要通过关闭 `StrictHostKeyChecking` 绕过核验，也不要仅凭 IP 地址判断主机身份。

认证成功时会看到包含下列内容的提示，`USERNAME` 是实际认证的账户名：

```text
You've successfully authenticated, but GitHub does not provide shell access.
```

GitHub 不提供交互式 shell，因此这个测试即使认证成功也可能返回退出码 `1`。连接超时通常需要检查网络、代理或防火墙；`Permission denied (publickey)` 则表示应检查 SSH 密钥和账户授权，不能只靠切换端口解决。

## 显式使用 443 克隆

将 `OWNER` 和 `REPOSITORY` 替换为实际仓库拥有者和名称：

```bash
git clone ssh://git@ssh.github.com:443/OWNER/REPOSITORY.git
```

注意主机名必须完整写为 `ssh.github.com`，而不是 `ssh.` 或端口 443 上的 `github.com`。

## 为 github.com 配置默认入口

编辑已有的 SSH 配置文件，合并以下配置段；不要覆盖文件里的其他主机设置。如果已有匹配 `github.com` 的配置，应检查顺序，避免先出现的选项覆盖预期行为。

```sshconfig
Host github.com
    HostName ssh.github.com
    Port 443
    User git
```

之后可以继续使用常见的 `git@github.com:OWNER/REPOSITORY.git` 地址。

## 验证配置与仓库访问

先检查 OpenSSH 实际解析的配置，这一步不建立网络连接：

```bash
ssh -G github.com
```

输出中应包含 `hostname ssh.github.com`、`port 443` 和 `user git`。再测试认证和仓库读取：

```bash
ssh -T git@github.com
git ls-remote git@github.com:OWNER/REPOSITORY.git HEAD
```

第二条命令应返回仓库 HEAD 的提交 ID 与引用名，且无需创建本地克隆。如果 `ssh` 测试正常但 Git 仍失败，检查 Git 是否通过 `core.sshCommand`、`GIT_SSH_COMMAND` 或另一个 SSH 客户端使用了不同配置。

本次维护使用 Windows OpenSSH 9.5p2 和独立测试配置，核对官方 Ed25519 指纹后启用严格主机检查，成功通过 443 端口认证，并用 `git ls-remote` 读取本站仓库的 HEAD。未修改已有 SSH 配置；这个结果不代表任意网络、代理和账户都能直接连通。
