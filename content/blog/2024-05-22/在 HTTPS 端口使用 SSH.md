---
title: "在 HTTPS 端口使用 SSH"
description: ""
lead: ""
date: 2024-05-22T07:51:17Z
lastmod: 2024-05-22T07:51:17Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/532834567/"
---

在 HTTPS 端口使用 SSH
有时，防火墙会完全拒绝允许 SSH 连接。 如果无法选择使用具有凭据缓存的 HTTPS 克隆，可以尝试使用通过 HTTPS 端口建立的 SSH 连接克隆。 大多数防火墙规则应允许此操作，但代理服务器可能会干扰

GitHub Enterprise Server 用户：目前不支持经 SSH 通过 HTTPS 端口访问 GitHub Enterprise Server。

要测试通过 HTTPS 端口的 SSH 是否可行，请运行以下 SSH 命令：

```bash
$ ssh -T -p 443 git@ssh.github.com
> Hi USERNAME! You've successfully authenticated, but GitHub does not
> provide shell access.
```

注意：端口 443 的主机名为 ssh.，而不是 ``。

如果这样有效，万事大吉！ 否则，可能需要遵循我们的故障排除指南。

现在，若要克隆存储库，可以运行以下命令：

```bash
git clone ssh://git@ssh.:443/YOUR-USERNAME/YOUR-REPOSITORY.git
```

启用通过 HTTPS 的 SSH 连接
如果你能在端口 443 上通过 SSH 连接到 git@ssh.，则可覆盖你的 SSH 设置来强制与 GitHub.com 的任何连接均通过该服务器和端口运行。

要在 SSH 配置文件中设置此行为，请在 ~/.ssh/config 编辑该文件，并添加以下部分：

```bash
Host 
    Hostname ssh.
    Port 443
    User git
```
你可以通过再次连接到 GitHub.com 来测试这是否有效：

```bash
$ ssh -T git@
> Hi USERNAME! You've successfully authenticated, but GitHub does not
> provide shell access.
```

更新已知主机
在切换到端口 443 后第一次与 GitHub 交互时，你可能会收到一条警告消息，指出在 known_hosts 中找不到主机，或者该主机由其他名称找到。

> The authenticity of host '[ssh.github.com]:443 ([140.82.112.36]:443)' can't be established.
> ED25519 key fingerprint is SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU.
> This host key is known by the following other names/addresses:
>     ~/.ssh/known_hosts:32: github.com
> Are you sure you want to continue connecting (yes/no/[fingerprint])?

假设 SSH 指纹与 GitHub 发布的指纹之一匹配，那么可以针对这个问题安全地回答“是”。 有关指纹列表，请参阅“GitHub 的 SSH 密钥指纹”。

来源: [在 HTTPS 端口使用 SSH](https://docs.github.com/zh/authentication/troubleshooting-ssh/using-ssh-over-the-https-port)