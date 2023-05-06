---
title: "提高 Golang 并发编程能力的必备利器：深入学习 sync.Cond 类型"
description: ""
lead: ""
date: 2023-05-06T03:02:01Z
lastmod: 2023-05-06T03:02:01Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/1539748842/"
---

Go 语言的 sync 包提供了一系列同步原语，其中 sync.Cond 就是其中之一。sync.Cond 的作用是在多个 goroutine 之间进行条件变量的同步。本文将深入探讨 sync.Cond 的实现原理和使用方法，帮助大家更好地理解和应用 sync.Cond。
1. sync.Cond 的基本概念
1.1 条件变量
条件变量是一种同步机制，用于在多个 goroutine 之间进行同步。条件变量通常是和互斥锁一起使用的，用于等待某个条件的出现。
在 Go 语言中，条件变量由 sync.Cond 类型实现。它提供了两个主要的方法：Wait 和 Signal/Broadcast。Wait 方法用于等待条件变量的出现，Signal/Broadcast 方法用于通知等待中的 goroutine。
1.2 互斥锁
互斥锁是一种用于控制对共享资源访问的同步机制。它能够保证同一时刻只有一个 goroutine 能够访问共享资源。
在 Go 语言中，互斥锁由 sync.Mutex 类型实现。它提供了两个主要的方法：Lock 和 Unlock。Lock 方法用于加锁，保证同一时刻只有一个 goroutine 能够访问共享资源；Unlock 方法用于解锁，允许其他 goroutine 访问共享资源。
1.3 条件变量的实现原理
条件变量的实现原理基于互斥锁和 goroutine 队列。
假设有一个条件变量 cond，初始时它没有被触发。当一个 goroutine 调用 cond.Wait() 方法时，它会加锁并将自己加入到 cond 的 goroutine 队列中。接着，它会解锁并进入睡眠状态，等待被唤醒。
当另一个 goroutine 调用 cond.Signal() 或者 cond.Broadcast() 方法时，它会重新加锁，并从 cond 的 goroutine 队列中选择一个 goroutine 唤醒。被唤醒的 goroutine 会重新加锁，然后继续执行。
需要注意的是，被唤醒的 goroutine 并不会立即执行，它会等待重新获得锁之后才会继续执行。
2. sync.Cond 的基本用法
2.1 创建 sync.Cond 对象
sync.Cond 对象需要依赖一个 sync.Mutex 或 sync.RWMutex 对象来进行同步和互斥操作。我们可以使用 sync.NewCond 方法来创建一个新的 sync.Cond 对象，该方法接受一个 Mutex 或 RWMutex 对象作为参数，返回一个对应的条件变量对象。
```go
 package main
 ​
 import (
     "fmt"
     "sync"
 )
 ​
 func main() {
     var mu sync.Mutex
     cond := sync.NewCond(&mu)
 ​
     // ...
 }
```

2.2 等待条件变量
sync.Cond 提供了 Wait 方法来等待条件变量的信号。Wait 方法需要在持有 Mutex 或 RWMutex 的情况下进行调用，否则会抛出 panic 异常。
```go
 func (c *Cond) Wait()
```

Wait 方法将当前 goroutine 暂停，等待条件变量的信号。在等待过程中，Mutex 或 RWMutex 将被释放，其他 goroutine 可以获取锁并修改共享变量，但是当前 goroutine 仍然保持在等待队列中，直到收到唤醒信号。当 Wait 方法返回时，Mutex 或 RWMutex 会自动重新被锁定。
下面是一个简单的示例程序，使用 sync.Cond 实现了一个简单的条件等待机制：
```go
 package main
 ​
 import (
     "fmt"
     "sync"
     "time"
 )
 ​
 func main() {
     var mu sync.Mutex
     cond := sync.NewCond(&mu)
     var ready bool
 ​
     // 模拟一个耗时的初始化操作
     go func() {
         time.Sleep(2 * time.Second)
         mu.Lock()
         ready = true
         cond.Signal() // 唤醒等待的 goroutine
         mu.Unlock()
     }()
 ​
     mu.Lock()
     for !ready {
         cond.Wait() // 等待初始化完成信号
     }
     fmt.Println("Initialization completed")
     mu.Unlock()
 }
```

上面的示例程序中，我们通过 sync.Cond 实现了一种等待初始化完成的机制。在初始化完成前，主 goroutine 会等待条件变量的信号，当子 goroutine 完成初始化后，会通过 Signal 方法发送唤醒信号，使得主 goroutine 继续执行。
2.3 唤醒等待的 goroutine
sync.Cond 提供了两种方式来唤醒等待的 goroutine：Signal 和 Broadcast。
2.3.1 Signal 方法
Signal 方法用于唤醒等待队列中的一个 goroutine，使其继续执行。在调用 Signal 方法之前，必须先获得 Mutex 或 RWMutex 的锁。
```go
 func (c *Cond) Signal()
```

Signal 方法会选择等待队列中的一个 goroutine 并唤醒它，如果没有等待的 goroutine，那么 Signal 方法不会产生任何效果。
下面是一个示例程序，演示了如何使用 Signal 方法唤醒等待的 goroutine：
 ```go
package main
 ​
 import (
     "fmt"
     "sync"
     "time"
 )
 ​
 func main() {
     var mu sync.Mutex
     cond := sync.NewCond(&mu)
     var ready bool
 ​
     // 模拟一个耗时的初始化操作
     go func() {
         time.Sleep(2 * time.Second)
         mu.Lock()
         ready = true
         cond.Signal() // 唤醒等待的 goroutine
         mu.Unlock()
     }()
 ​
     mu.Lock()
     for !ready {
         cond.Wait() // 等待初始化完成信号
     }
     fmt.Println("Initialization completed")
     mu.Unlock()
 }
```

在上面的示例程序中，我们通过调用 cond.Signal() 方法来唤醒等待的 goroutine。
2.3.2 Broadcast 方法
Broadcast 方法用于唤醒等待队列中的所有 goroutine，使它们继续执行。在调用 Broadcast 方法之前，必须先获得 Mutex 或 RWMutex 的锁。
```go
func (c *Cond) Broadcast()
```

Broadcast 方法会唤醒等待队列中的所有 goroutine，如果没有等待的 goroutine，那么 Broadcast 方法不会产生任何效果。
下面是一个示例程序，演示了如何使用 Broadcast 方法唤醒等待的 goroutine：
 ```go
package main
 ​
 import (
     "fmt"
     "sync"
     "time"
 )
 ​
 func main() {
     var mu sync.Mutex
     cond := sync.NewCond(&mu)
     var ready bool
 ​
     // 模拟一个耗时的初始化操作
     go func() {
         time.Sleep(2 * time.Second)
         mu.Lock()
         ready = true
         cond.Broadcast() // 唤醒等待的所有 goroutine
         mu.Unlock()
     }()
 ​
     mu.Lock()
     for !ready {
         cond.Wait() // 等待初始化完成信号
     }
     fmt.Println("Initialization completed")
     mu.Unlock()
 }
```

在上面的示例程序中，我们通过调用 cond.Broadcast() 方法来唤醒等待的 goroutine。
3. sync.Cond 的内部实现原理
sync.Cond 的内部实现依赖于一个等待队列，它维护了等待条件变量的 goroutine 的列表，其中每个 goroutine 都有一个阻塞的状态。当条件变量被发出信号时，等待队列中的一个 goroutine 将被唤醒，并从 Wait 方法中返回，同时将重新获得 Mutex 的锁。
下面是 sync.Cond 内部的等待队列结构体定义：
```go
 type wait struct {
     // 等待队列中的 goroutine
     // goroutine 在 cond.Wait() 中被加入队列，在 cond.Signal() 或 cond.Broadcast() 中被唤醒
     // 由于队列是单向链表，因此需要保存 next 指针指向下一个元素
     // 当 goroutine 被唤醒时，会将 wait.done 设置为 true，并唤醒 wait.cond.L 上阻塞的 goroutine
     // goroutine 从 Wait() 方法中返回时，会将 wait.done 设置为 true
     // wait.done 可以保证 goroutine 不会重复地从 cond.Wait() 方法中返回
     // wait.done 可以保证 goroutine 在从 cond.Wait() 方法中返回时，已经持有了 Mutex 的锁
     // wait.done 可以保证 goroutine 在被唤醒之前不会在 cond.Wait() 方法中被重新加入到队列中
     done bool
     // 下一个等待队列元素的指针
     next *wait
     // 条件变量
     cond *Cond
 }
```

sync.Cond 使用 wait 结构体维护了一个等待队列，其中每个元素都代表了一个等待 goroutine。
wait 结构体中的 done 字段用于保证 goroutine 不会重复地从 Wait 方法中返回，next 字段用于链接下一个等待元素。
等待队列的头部和尾部分别使用 wait 结构体的指针 first 和 last 维护。
```go
 type Cond struct {
     // Mutex 保护 condition 变量和等待队列
     L Locker
 ​
     // 等待队列的头部和尾部
     first *wait
     last  *wait
 }
```

```go
sync.Cond 的 Wait 方法实现如下：
 func (c *Cond) Wait() {
     // 将当前 goroutine 加入到等待队列中
     t := new(wait)
     t.cond = c
     c.add(t)
     defer c.remove(t)
 ​
     // 释放锁并进入阻塞状态
     c.L.Unlock()
     for !t.done {
         runtime.Gosched()
     }
     c.L.Lock()
 }
```

在 Wait 方法中，首先创建一个 wait 结构体 t，并将当前 goroutine 加入到等待队列中，然后释放 Mutex 的锁，并进入阻塞状态。
在等待队列中，goroutine 的状态为阻塞，直到被唤醒并从 Wait 方法中返回。
当等待的条件变量满足时，唤醒等待队列中的 goroutine 的操作由 Signal 和 Broadcast 方法来实现。
Signal 方法会唤醒等待队列中的一个 goroutine，而 Broadcast 方法会唤醒所有等待队列中的 goroutine。
```go
 func (c *Cond) Signal() {
     if c.first != nil {
         c.first.wake(true)
     }
 }
 ​
 func (c *Cond) Broadcast() {
     for c.first != nil {
         c.first.wake(true)
     }
 }
```

在 Signal 和 Broadcast 方法中，首先判断等待队列是否为空，如果不为空，则唤醒等待队列中的一个或所有 goroutine，并将它们从阻塞状态中解除。 下面是 wait 结构体的 wake 方法实现：
```go
 func (w *wait) wake(done bool) {
     // 标记 done 字段并解除阻塞状态
     w.done = done
     runtime.NotifyListNotify(&w.cond.L.(*Mutex).notify)
 }
```

在 wake 方法中，首先将 wait.done 设置为 true，然后通过调用 runtime.NotifyListNotify 方法，将等待队列中的 goroutine 从阻塞状态中解除。
这里需要注意的是，在 sync.Cond 的实现中，使用了 Mutex 的 notify 字段来实现 goroutine 的唤醒和阻塞。
当一个 goroutine 调用 Wait 方法时，它会释放 Mutex 的锁，并进入阻塞状态，同时将自己加入到 Mutex 的 notify 队列中。
当一个 goroutine 调用 Signal 或 Broadcast 方法时，它会从 Mutex 的 notify 队列中取出一个或多个 goroutine，并唤醒它们。
这种实现方式与操作系统的线程调度机制类似，可以保证唤醒的 goroutine 在调用 Wait 方法时已经持有了 Mutex 的锁，从而避免了死锁和竞态条件等问题。
这里再补充一下 Mutex 的 notify 字段的定义：
```go
 type Mutex struct {
     state int32
     sema  uint32
     waitm uint32
     notify notifyList
 }
```
```go

notify 字段是一个 notifyList 类型的对象，它定义如下：
 type notifyList struct {
     wait   uint32 // 等待的 goroutine 的数量
     notify uint32 // 唤醒的 goroutine 的数量
     head   *wait  // 等待队列的头部元素
     tail   *wait  // 等待队列的尾部元素
 }
```

notifyList 类型的对象维护了一个等待队列和唤醒队列，其中等待队列用于存放阻塞的 goroutine，唤醒队列用于存放将要被唤醒的 goroutine。
notifyList 类型的对象还维护了等待队列和唤醒队列中 goroutine 的数量。
当一个 goroutine 调用 Wait 方法时，它会将自己加入到等待队列中，并且将 Mutex 的 waitm 字段加一。
当一个 goroutine 调用 Signal 或 Broadcast 方法时，它会从等待队列中取出一个或多个 goroutine，并将它们加入到唤醒队列中。
当一个 goroutine 调用 Unlock 方法时，它会判断唤醒队列中是否有 goroutine 需要唤醒，并将 Mutex 的 sema 字段加一，从而使得下一个 goroutine 获得锁。
4. sync.Cond 的使用方法
sync.Cond 的使用方法通常包括以下步骤：


定义互斥锁和条件变量。
```go
 var mutex sync.Mutex
 var cond = sync.NewCond(&mutex)
```



在生产者和消费者之间使用互斥锁和条件变量进行同步。
```go
 package main
 ​
 import (
     "fmt"
     "math/rand"
     "sync"
     "time"
 )
 ​
 type Queue struct {
     items []int
     size  int
     lock  sync.Mutex
     cond  *sync.Cond
 }
 ​
 func NewQueue(size int) *Queue {
     q := &Queue{
         items: make([]int, 0, size),
         size:  size,
     }
     q.cond = sync.NewCond(&q.lock)
     return q
 }
 ​
 func (q *Queue) Put(item int) {
     q.lock.Lock()
     defer q.lock.Unlock()
 ​
     for len(q.items) == q.size {
         q.cond.Wait()
     }
 ​
     q.items = append(q.items, item)
     fmt.Printf("put item %d, queue len %d\n", item, len(q.items))
 ​
     q.cond.Signal()
 }
 ​
 func (q *Queue) Get() int {
     q.lock.Lock()
     defer q.lock.Unlock()
 ​
     for len(q.items) == 0 {
         q.cond.Wait()
     }
 ​
     item := q.items[0]
     q.items = q.items[1:]
     fmt.Printf("get item %d, queue len %d\n", item, len(q.items))
 ​
     q.cond.Signal()
     return item
 }
 ​
 func Producer(q *Queue, id int) {
     for {
         item := rand.Intn(100)
         q.Put(item)
         time.Sleep(time.Duration(rand.Intn(1000)) * time.Millisecond)
     }
 }
 ​
 func Consumer(q *Queue, id int) {
     for {
         item := q.Get()
         time.Sleep(time.Duration(rand.Intn(1000)) * time.Millisecond)
     }
 }
 ​
 func main() {
     q := NewQueue(5)
     for i := 0; i < 3; i++ {
         go Producer(q, i)
     }
     for i := 0; i < 5; i++ {
         go Consumer(q, i)
     }
     time.Sleep(10 * time.Second)
 }
```

在这个例子中，我们创建了一个 Queue 类型，它包含一个整数数组和一个长度。在 Put 和 Get 方法中，我们使用互斥锁和条件变量进行同步。
在 Producer 和 Consumer 函数中，我们模拟生产者和消费者的行为。生产者会不断地生成随机数，并调用 Put 方法将其放入队列中；消费者会不断地调用 Get 方法从队列中取出数据。
在主函数中，我们创建了多个生产者和消费者 goroutine，它们并发地操作队列。在程序运行过程中，我们可以看到队列的长度会不断地变化，生产者和消费者会交替执行。


5. 总结
sync.Cond 是 Go 语言中非常重要的同步原语之一。它可以帮助我们实现更高级别的同步机制，例如生产者和消费者模型、读写锁等。同时，它也是一个非常复杂的数据结构，需要深入理解其内部实现才能正确地使用它。
在使用 sync.Cond 时，我们需要注意以下几点：

在使用 sync.Cond 前，一定要先创建一个互斥锁。
在调用 Wait 方法前，一定要先获取互斥锁，否则会导致死锁。
在调用 Wait 方法后，当前 goroutine 会被阻塞，直到被唤醒。
在调用 Signal 或 Broadcast 方法后，等待队列中的一个或多个 goroutine 会被唤醒，但不会立即获取互斥锁。因此，在使用 Signal 或 Broadcast 方法时，一定要保证唤醒的 goroutine 不会互相竞争同一个资源。
在调用 Signal 或 Broadcast 方法后，一定要释放互斥锁，否则被唤醒的 goroutine 无法获取到互斥锁，仍然会被阻塞。
在使用 sync.Cond 时，一定要注意竞争条件和数据同步的问题，确保程序的正确性和稳定性。

在本文中，我们介绍了 sync.Cond 的基本用法和内部实现原理，并通过一个实际的生产者和消费者模型的例子，展示了如何使用 sync.Cond 实现高级别的同步机制。
使用 sync.Cond 可以帮助我们实现更高效、更灵活、更安全的并发程序。但同时，也需要我们仔细思考和理解其内部实现，避免出现竞争条件和数据同步的问题，确保程序的正确性和稳定性。
总之，Golang 的 sync.Cond 类型是 Golang 并发编程中非常重要的一个组件，熟练掌握它的使用方法和实现原理，可以有效提升 Golang 并发编程的能力和水平。

### 转载
作者：金刀大菜牙
链接：https://juejin.cn/post/7228755069017309240
来源：稀土掘金
著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。
