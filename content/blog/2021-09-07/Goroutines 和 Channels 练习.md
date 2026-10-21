---
title: "[Go] Goroutines 和 Channels 练习"
description: "收集六个 Go 并发练习，涵盖奇偶分流、多协程写入通道、生成器、斐波那契数列、执行顺序和 WaitGroup 检查点同步。"
lead: ""
date: 2021-09-07T07:00:14Z
lastmod: 2026-10-22T00:06:41+08:00
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/1624364114/"
---

适用环境：各个 `package main` 代码块是独立程序，分别保存为 `main.go`，在 Go 1.23.3、Windows/amd64 运行 `go run main.go` 验证。所有示例均有结束条件；除明确给出的数值集合外，不保证 goroutine 间的输出顺序。

1. 查找奇数和偶数

   ```go
   /*
   查找奇数和偶数

   下面的程序启动了两个 Goroutine。这两个 Goroutine 现在并发运行。我们创建了两个无缓冲通道，并将它们作为参数传递给 goroutines，其中包含通道接收到的值。
   */
   package main

   import "sync"

   func main() {
       nums := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 0}
       chOdd := make(chan int)
       chEven := make(chan int)
       var wg sync.WaitGroup

       wg.Add(2)
       go func() {
           defer wg.Done()
           odd(chOdd)
       }()
       go func() {
           defer wg.Done()
           even(chEven)
       }()

       for _, v := range nums {
           if v%2 == 0 {
               chEven <- v
           } else {
               chOdd <- v
           }
       }
       close(chOdd)
       close(chEven)
       wg.Wait()
   }

   func even(ch chan int) {
       for v := range ch {
           println("偶数: ", v)
       }
   }

   func odd(ch chan int) {
       for v := range ch {
           println("奇数: ", v)
       }
   }
   ```

2. 启动多个 Goroutines，每个 Goroutine 将值添加到 Channel

   ```go
   /*
   启动多个 Goroutines，每个 Goroutine 将值添加到 Channel

   该程序以 10 个 Goroutines 开始。我们创建了一个ch字符串通道，并通过同时运行 10 个 goroutine 将数据写入该通道。箭头相对于通道的方向指定是发送还是接收数据。指向ch的箭头指定我们正在写入通道ch。从ch向外指向的箭头指定我们正在从通道ch读取。
   */
   package main

   import (
       "fmt"
       "strconv"
   )

   func main() {
       ch := make(chan string)

       for i := 0; i < 10; i++ {
           go func(i int) {
               for j := 0; j < 10; j++ {
                   ch <- "Goroutine: " + strconv.Itoa(i)
               }
           }(i)
       }

       for k := 1; k <= 100; k++ {
           fmt.Println(k, <-ch)
       }
   }
   ```

3. 从通道发送和接收值

   ```go
   /*
   从通道发送和接收值
   主要功能有生成器和接收器两个函数。我们创建一个c int 通道并从生成器函数返回它。在匿名 goroutine 中运行的 for 循环将值写入通道c。
   */
   package main

   import "fmt"

   func main() {
       c := generator()
       receiver(c)
   }

   func receiver(c <-chan int) {
       for v := range c {
           fmt.Println(v)
       }
   }

   func generator() <-chan int {
       ch := make(chan int)
       go func() {
           for i := 0; i < 10; i++ {
               ch <- i
           }
           close(ch)
       }()
       return ch
   }

   ```

4. 读取斐波那契数列并将其写入通道

   ```go
   /*
   读取斐波那契数列并将其写入通道
   main 函数有两个无缓冲通道ch和quit。在 fibonacci 函数内部，select语句会阻塞，直到它的一种情况准备就绪。
   */
   package main

   import "fmt"

   func main() {
       ch := make(chan int)
       quit := make(chan bool)
       n := 10

       go func(n int) {
           for i := 0; i < n; i++ {
               fmt.Println(<-ch)
           }
           quit <- false
       }(n)
       fibonacci(ch, quit)
   }

   func fibonacci(ch chan int, quit chan bool) {
       x, y := 0, 1
       for {
           select {
           case ch <- x:
               x, y = y, x+y
           case <-quit:
               fmt.Println("quit")
               return
           }
       }
   }

   ```

5. Goroutines 通道执行顺序

   ```go
   /*
   Goroutines 通道执行顺序
   本例创建四个 goroutine，使用无缓冲通道返回四组求和结果。收到的顺序由调度决定，即使只有两个 goroutine 也不保证固定顺序。结果集合是 80、268、112、296；接收完成后由接收方关闭通道在这里是安全的，因为发送次数已知且全部完成。
   */
   package main

   import "fmt"

   func sum(a []int, c chan int) {
       sum := 0
       for _, v := range a {
           sum += v
       }
       c <- sum
   }

   func main() {
       a := []int{17, 12, 18, 9, 24, 42, 64, 12, 68, 82, 57, 32, 9, 2, 12, 82, 52, 34, 92, 36}

       c := make(chan int)
       for i := 0; i < len(a); i = i + 5 {
           go sum(a[i:i+5], c)
       }
       output := make([]int, 4)
       for i := 0; i < 4; i++ {
           output[i] = <-c
       }
       close(c)

       fmt.Println(output)
   }
   ```

6. 检查点同步图

   ```go
   /*
   检查点同步图示
   检查点同步是一个多任务同步的问题。考虑一个车间，其中有几个工人组装某些机构的细节。当他们每个人完成他的工作时，他们会把细节放在一起。没有商店，所以第一个完成它的部分的工人必须等待其他人才能开始另一个。将细节放在一起是任务在分开路径之前同步自己的检查点。
   */
   package main

   import (
       "log"
       "math/rand"
       "sync"
       "time"
   )

   var (
       partList    = []string{"A", "B", "C", "D"}
       nAssemblies = 3
       wg          sync.WaitGroup
   )

   func main() {
       rand.Seed(time.Now().UnixNano())
       for c := 1; c <= nAssemblies; c++ {
           log.Println("begin assembly cycle", c)
           wg.Add(len(partList))
           for _, part := range partList {
               go worker(part)
           }
           wg.Wait()
           log.Println("assemble. cycle", c, "complete")
       }
   }

   func worker(part string) {
       log.Println(part, "worker begin part")
       time.Sleep(time.Duration(rand.Int63n(1e6)))
       log.Println(part, "worker completes part")
       wg.Done()
   }
   ```

##### 来源: https://www.golangprograms.com/goroutines-and-channels-example.html

验证要点：第 1 个程序应完整输出 10 个数后退出，关闭通道结束 `range`，`WaitGroup` 等待消费者结束；第 2、3、4 个程序分别接收 100、10、10 个值；第 5 个程序仅输出四个和而不附带多余的零；第 6 个程序的每轮 `complete` 必须位于该轮四个 worker 完成之后。`WaitGroup.Add` 在启动对应 goroutine 前调用。参考 [Go 官方 WaitGroup 文档](https://pkg.go.dev/sync@go1.23.3#WaitGroup)和[通道语义](https://go.dev/ref/spec#Channel_types)。
