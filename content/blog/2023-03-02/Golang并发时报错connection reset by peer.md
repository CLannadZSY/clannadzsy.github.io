---
title: "Golang并发时报错connection Reset by Peer"
description: "区分 Go 并发请求中的连接重置与本地文件描述符耗尽，演示错误链分类，并说明 Linux 资源限制排查及验证边界。"
lead: ""
date: 2023-03-02T01:46:42Z
lastmod: 2023-03-02T01:46:42Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/630506263/"
---

Go 并发请求中出现 `connection reset by peer`，说明连接被对端重置；对端也可能是代理、负载均衡器等中间节点。仅凭这段错误文字，无法判定是服务端策略、连接复用、应用行为还是某项资源限制。它不等同于本地文件描述符耗尽，不能直接得出“程序没问题，只需提高系统限制”的结论。

## 先保留完整错误与请求条件

记录操作是拨号、读取还是写入，以及目标地址、并发数、超时、连接复用方式和服务端对应时间的日志。检查响应体是否关闭、客户端是否重复创建、请求是否有界，再做单变量对比。`http.Client` 和 `Transport` 适合复用；成功返回响应时应及时关闭 `resp.Body`，能读到 EOF 并关闭时才有利于连接复用。

参考 [Go 1.23.3 http.Client](https://pkg.go.dev/net/http@go1.23.3#Client)、[Transport](https://pkg.go.dev/net/http@go1.23.3#Transport) 与 [net.OpError](https://pkg.go.dev/net@go1.23.3#OpError)。自动重试还必须考虑请求是否幂等，不能无条件重复有副作用的请求。

## 区分重置与本地资源耗尽

适用环境：下面只演示 Go 标准库错误链的识别方式，在 Go 1.23.3、Windows/amd64 验证；不发起网络请求，也不声称复现了服务器故障。保存为 `main.go`，运行 `go run main.go`。

```go
package main

import (
    "errors"
    "fmt"
    "net"
    "syscall"
)

func main() {
    // 人工构造错误链，验证分类逻辑；实际排查时替换为请求返回的 err。
    reset := &net.OpError{Op: "read", Net: "tcp", Err: syscall.ECONNRESET}
    exhausted := fmt.Errorf("open socket: %w", syscall.EMFILE)
    fmt.Println(errors.Is(reset, syscall.ECONNRESET))
    fmt.Println(errors.Is(exhausted, syscall.EMFILE))

    var operation *net.OpError
    if errors.As(reset, &operation) {
        fmt.Println(operation.Op, operation.Net)
    }
}
```

期望输出为 `true`、`true`、`read tcp`。错误码和包装形式与平台、调用路径有关；例如 Windows 的套接字错误可能使用 Winsock 错误码，应检查真实错误链，不能只匹配本例构造的一个值。`errors.Is`、`errors.As` 的用法见 [Go 官方 errors 文档](https://pkg.go.dev/errors@go1.23.3)。

## Linux 文件描述符限制只是排查分支

原笔记中的 `/etc/security/limits.conf`、`nofile`、`nproc` 只适用于相应的 Linux 登录及服务管理环境。`nofile` 约束文件描述符，`nproc` 是另一项进程/线程相关限制；root 用户的默认值并非所有机器都固定为 4096。

只有实际错误与进程占用情况表明文件描述符不足时，才检查并调整启动该程序的用户或服务限制。交互式 shell 可先用 `ulimit -Sn`、`ulimit -Hn` 查看自身的软硬限制，但服务进程可能由 systemd、容器或其他启动器设置，shell 的值不代表运行中服务的实际限制。

`sysctl -p` 读取的是 sysctl 参数配置，不会把 `limits.conf` 的变更应用到已有进程。修改登录限制通常需要重新建立相应会话，服务需要按其启动器配置并重启，再核对进程的实际限制。不要把提高 `nofile` 当作所有连接重置的通用修复，更不要直接复制针对 root 的无限制配置。

本次只验证上述无网络错误分类程序，未在 Linux 服务或真实远端上验证限制调整；最终原因仍需结合发生故障的客户端、服务端和网络证据判断。
