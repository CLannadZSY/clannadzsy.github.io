---
title: "[Go] defer 理解"
description: "结合三个命名返回值示例，梳理 Go defer 的后进先出执行顺序，以及闭包引用、参数传值和 return 赋值对最终返回结果的影响。"
lead: ""
date: 2021-09-02T06:22:13Z
lastmod: 2026-10-22T00:06:41+08:00
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/218469985/"
---

#### 什么是 defer

defer 是 Go 语言提供的延迟调用机制：执行到 `defer` 语句时会求值并保存被调用函数及其参数，函数调用推迟到当前函数退出时执行。

多个延迟调用按后进先出（LIFO）的顺序执行；正常返回时，在返回结果赋值之后、函数真正返回调用方之前运行。这里的“栈”是理解执行顺序的比喻，不要求运行时一定采用某种栈布局。

**先进后出的原因是后面定义的函数可能会依赖前面的资源，自然要先执行；否则，如果前面先执行，那后面函数的依赖就没有了**。

#### 踩坑点

使用 defer 最容易采坑的地方是和**带命名返回参数的函数**一起使用时。

defer 语句定义时, 对外部变量的引用有两种方式

1. `函数参数`: 在 defer 定义时就把值传递给 defer, 并缓存起来
2. `闭包引用`: 在 defer 函数被取出调用时根据整个上下文确定当前值

#### 理解 `return` 语句

理解普通返回时，可以用下面的教学伪代码表示“先给返回结果赋值、再执行延迟调用、最后返回调用方”的顺序。它不是 Go 源码或编译器的固定降级实现，不能单独编译：

```text
val = xxx
return
```

而 defer 语句就是在这两条语句之间执行，也就是

```text
val = xxx
deferFunc
return
```

#### 实践检验

适用环境：下面的完整程序在 Go 1.23.3、Windows/amd64 验证。保存为 `main.go`，执行 `go run main.go`，依次输出 `1`、`1`、`1`。`f3` 的延迟调用参数在注册时取到的是初始值 `0`；形参自增不会改变命名返回值 `r`。注释中的“拆分”仅作结果赋值顺序示意。

```go
package main

import "fmt"

func f1() (r int) {
    defer func() {
        r++
    }()
    return 0
}

// 拆分 f1
//func f1() (r int) {
//
//  // 1.赋值
//  r = 0
//
//  // 2.闭包引用，返回值被修改
//  defer func() {
//      r++
//  }()
//
//  // 3.return
//  return
//}

func f2() (r int) {
    t := 1
    defer func() {
        t++
    }()
    return t
}

// 拆分 f2
//func f2() (r int) {
//  t := 1
//  // 1.赋值
//  r = t
//
//  // 2.闭包引用，但是没有修改返回值 r
//  defer func() {
//      t++
//  }()
//
//  // 3.return
//  return
//}

func f3() (r int) {
    defer func(r int) {
        r++
    }(r)
    return 1
}

// 拆分 f3
//func f3() (r int) {
//
//  // 1.执行到 defer 时先求值并保存实参，此时 r 为 0
//  savedArg := r
//
//  // 2.return 语句给命名返回值赋值
//  r = 1
//
//  // 3.示意执行已注册的延迟调用，形参自增不影响返回值 r
//  func(r int) {
//      r++
//  }(savedArg)
//
//  // 4.返回调用方
//  return
//}

func main() {
    fmt.Println(f1())
    fmt.Println(f2())
    fmt.Println(f3())
}
```

行为依据见 [Go 语言规范：defer](https://go.dev/ref/spec#Defer_statements)。闭包共享的是所捕获的变量，并不是注册时自动复制其值；不要将参数求值时机与闭包执行时机混为一谈。
