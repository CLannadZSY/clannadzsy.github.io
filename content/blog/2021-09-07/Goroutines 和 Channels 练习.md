---
title: "[Go] Goroutines 和 Channels 练习"
description: ""
lead: ""
date: 2021-09-07T07:00:14Z
lastmod: 2021-09-07T07:00:14Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/1624364114/"
---

1. 查找奇数和偶数

   ```go
   /*
   查找奇数和偶数
   
   下面的程序启动了两个 Goroutine。这两个 Goroutine 现在并发运行。我们创建了两个无缓冲通道，并将它们作为参数传递给 goroutines，其中包含通道接收到的值。
   */
   package main
   
   func main() {
   	nums := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 0}
   	chOdd := make(chan int)
   	chEven := make(chan int)
   
   	go odd(chOdd)
   	go even(chEven)
   
   	for _, v := range nums {
   		if v%2 == 0 {
   			chEven <- v
   		} else {
   			chOdd <- v
   		}
   	}
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
   您正在代码中调用 go 例程，并且无法判断例程何时结束以及值将传递到缓冲通道。由于此代码是异步的，因此每当例程完成时，它都会将数据写入通道并在另一端读取。在上面的示例中，您只调用了两个 go 例程，因此行为是确定的，并且在大多数情况下会以某种方式生成相同的输出，但是当您增加 go 例程时，输出将不相同并且顺序将不同，除非您使它是同步的。
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
   	output := make([]int, 5)
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

