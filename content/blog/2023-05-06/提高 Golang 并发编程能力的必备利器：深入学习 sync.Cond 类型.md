---
title: "提高 Golang 并发编程能力的必备利器：深入学习 sync.Cond 类型"
description: "整理 Go sync.Cond 的条件变量用法，介绍 Wait、Signal、Broadcast 与互斥锁的配合，并记录初始化等待和生产者消费者示例。"
lead: ""
date: 2023-05-06T03:02:01Z
lastmod: 2026-10-22T00:06:41+08:00
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/1539748842/"
---

Go 的 `sync.Cond` 用于等待共享状态满足某个条件。条件由程序自己的变量表达，通知只是提醒等待者重新检查变量，并不会保存一份可供以后消费的“信号”。下面保留初始化等待和生产者消费者两个用例，修正原转载中的源码说明与示例。

适用环境：示例仅依赖标准库，在 Go 1.23.3、Windows/amd64 验证。每个 `package main` 代码块分别保存为 `main.go`，在空目录运行 `go run main.go`；程序都能自行结束，不需要访问网络。

## 1. 条件变量与互斥锁

`sync.NewCond` 接收实现 `sync.Locker` 的对象，通常使用 `*sync.Mutex`。读取或修改条件，以及调用 `Wait` 时，必须持有同一把锁。`Cond` 第一次使用后不能复制。

`Wait` 会原子地释放 `cond.L` 并挂起当前 goroutine；被通知后，它会重新取得该锁才返回。调用方必须先加锁，`Wait` 本身不会替调用方完成第一次加锁。若使用 `RWMutex`，必须明确传入的是写锁还是 `RLocker()` 返回的读锁，不能混用加解锁方式；下面统一用 `Mutex`。

### 等待初始化完成

```go
package main

import (
    "fmt"
    "sync"
)

func main() {
    var mu sync.Mutex
    cond := sync.NewCond(&mu)
    ready := false

    go func() {
        // 在这里完成初始化，再在锁内发布状态。
        mu.Lock()
        ready = true
        cond.Signal()
        mu.Unlock()
    }()

    mu.Lock()
    for !ready {
        cond.Wait()
    }
    fmt.Println("Initialization completed")
    mu.Unlock()
}
```

验证：输出 `Initialization completed` 后退出。即使初始化 goroutine 先运行、`Signal` 发生时还没有等待者，主 goroutine 也会因为 `ready` 已为真而直接继续，不会丢失初始化状态。

这里使用 `for`，因为等待者重新取得锁时，其他 goroutine 可能已经再次改变条件。Go 的 `Wait` 不会无缘无故返回；循环检查是为了确认共享条件仍然成立，不能将一次通知等同于条件永久成立。

### Signal 与 Broadcast

- `Signal` 唤醒当前等待的一个 goroutine；没有等待者时不保存通知，也不保证被唤醒者优先取得锁。
- `Broadcast` 唤醒当前所有等待者。它们仍要依次重新取得锁、检查条件。
- 官方 API 允许调用 `Signal`、`Broadcast` 时持有或不持有 `cond.L`；这不等于可以无锁读写条件。本文在锁内修改状态并通知，便于把同步规则放在一起。

如果多个等待者都在等同一个只会从假变真的初始化状态，应使用 `Broadcast`；只 `Signal` 一次可能让其余等待者一直睡眠。对于单次完成事件，关闭一个 channel 往往更简单。

## 2. 实现原理的边界

Go 1.23.3 的 `sync.Cond` 内部有独立的 `notifyList`，`Wait` 大致经过“登记等待票据、解锁、等待通知、重新加锁”几个阶段，通知使用运行时的等待设施，而不是循环调用 `runtime.Gosched` 忙等。

原文给出的 `wait{done,next,cond}`、`Mutex.notify` 和 `runtime.NotifyListNotify` 不是该版本的标准库源码，且读写 `done` 的忙等示例缺少同步，已移除。内部字段与运行时函数是实现细节，应用程序应依赖公开的 `Wait`、`Signal`、`Broadcast` 行为。

可通过已安装工具链的 `go doc sync.Cond` 和 `$GOROOT/src/sync/cond.go` 对照；线上参考 [Go 1.23.3 Cond 文档](https://pkg.go.dev/sync@go1.23.3#Cond)与 [Go 官方 Cond 源码](https://go.dev/src/sync/cond.go)。线上源码会随 Go 版本更新，应以自己的工具链版本为准。

## 3. 有界生产者消费者队列

生产者等待“队列未满”，消费者等待“队列非空”。这两个条件使用同一把互斥锁，分别建立 `notFull` 与 `notEmpty` 两个 `Cond`，避免一个混合等待队列中的 `Signal` 唤醒错误类别的等待者。

下面增加关闭状态：生产者完成后关闭队列，消费者取完剩余项后退出。关闭时广播唤醒两类等待者；生产者数量有限，主 goroutine 使用 `WaitGroup` 等待全部工作结束。

```go
package main

import (
    "fmt"
    "sync"
)

type Queue struct {
    items []int
    size int
    closed bool
    mu sync.Mutex
    notEmpty *sync.Cond
    notFull *sync.Cond
}

func NewQueue(size int) *Queue {
    if size <= 0 {
        panic("queue size must be positive")
    }
    q := &Queue{size: size, items: make([]int, 0, size)}
    q.notEmpty = sync.NewCond(&q.mu)
    q.notFull = sync.NewCond(&q.mu)
    return q
}

func (q *Queue) Put(item int) bool {
    q.mu.Lock()
    defer q.mu.Unlock()
    for len(q.items) == q.size && !q.closed {
        q.notFull.Wait()
    }
    if q.closed {
        return false
    }
    q.items = append(q.items, item)
    q.notEmpty.Signal()
    return true
}

func (q *Queue) Get() (int, bool) {
    q.mu.Lock()
    defer q.mu.Unlock()
    for len(q.items) == 0 && !q.closed {
        q.notEmpty.Wait()
    }
    if len(q.items) == 0 {
        return 0, false
    }
    item := q.items[0]
    q.items = q.items[1:]
    q.notFull.Signal()
    return item, true
}

func (q *Queue) Close() {
    q.mu.Lock()
    q.closed = true
    q.notEmpty.Broadcast()
    q.notFull.Broadcast()
    q.mu.Unlock()
}

func main() {
    q := NewQueue(5)
    var producers, consumers sync.WaitGroup
    var resultMu sync.Mutex
    count, total := 0, 0

    for id := 0; id < 5; id++ {
        consumers.Add(1)
        go func() {
            defer consumers.Done()
            for {
                item, ok := q.Get()
                if !ok {
                    return
                }
                resultMu.Lock()
                count++
                total += item
                resultMu.Unlock()
            }
        }()
    }
    for id := 0; id < 3; id++ {
        producers.Add(1)
        go func(id int) {
            defer producers.Done()
            for n := 0; n < 10; n++ {
                if !q.Put(id*10 + n) {
                    return
                }
            }
        }(id)
    }
    producers.Wait()
    q.Close()
    consumers.Wait()
    fmt.Printf("consumed=%d sum=%d\n", count, total)
}
```

验证：输出 `consumed=30 sum=435` 后退出；消费顺序由调度决定，不保证生产者间的顺序。该队列用于演示条件等待，切片队头移除并非固定内存的环形队列实现。需要取消、超时或不同业务策略时，应另外设计停止协议，不能直接给 `Cond.Wait` 添加一个超时参数。

## 4. 验证与注意事项

两个完整程序分别执行 `go run main.go`。支持 race detector 的平台并安装其所需 C 工具链后，可分别运行 `go run -race main.go`；检测通过也不能代替对条件循环和退出协议的检查。官方说明见 [Data Race Detector](https://go.dev/doc/articles/race_detector.html)。

共享条件始终由关联锁保护；等待使用 `for`；关闭时唤醒可能永久等待的 goroutine；程序退出前等待工作完成。这些是示例的正确性前提，无需依赖运行时队列的具体布局。

### 转载与校订

原作者：金刀大菜牙

原文链接：https://juejin.cn/post/7228755069017309240

来源：稀土掘金。保留原文主题与署名，以上示例和实现说明已按官方 API 校订。原文著作权归原作者所有，商业转载请联系作者获得授权，非商业转载请注明出处。
