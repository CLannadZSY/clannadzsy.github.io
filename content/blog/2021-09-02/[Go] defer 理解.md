---
title: "[Go] defer 理解"
description: ""
lead: ""
date: 2021-09-02T06:22:13Z
lastmod: 2021-09-02T06:22:13Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/218469985/"
---
#### 什么是 defer

defer 是 Go 语言提供的一种用于注册延迟调用的机智, 每一次 defer 都会把函数压入栈中, 当前函数返回前再把延迟函数取出并执行

defer 语句并不会马上执行，而是会进入一个栈，函数 return 前，会按先进后出（FILO）的顺序执行

**先进后出的原因是后面定义的函数可能会依赖前面的资源，自然要先执行；否则，如果前面先执行，那后面函数的依赖就没有了**。



#### 踩坑点

使用 defer 最容易采坑的地方是和**带命名返回参数的函数**一起使用时。

defer 语句定义时, 对外部变量的引用有两种方式

1. `函数参数`: 在 defer 定义时就把值传递给 defer, 并缓存起来
2. `闭包引用`: 在 defer 函数被取出调用时根据整个上下文确定当前值



#### 理解 `return` 语句

return 语句不是原子操作，而是被拆成了两步

```go
val = xxx
return
```

而 defer 语句就是在这两条语句之间执行，也就是

```go
val = xxx
deferFunc
return
```



#### 实践检验

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
//	// 1.赋值
//	r = 0
//
//	// 2.闭包引用，返回值被修改
//	defer func() {
//		r++
//	}()
//
//	// 3.return
//	return
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
//	t := 1
//	// 1.赋值
//	r = t
//
//	// 2.闭包引用，但是没有修改返回值 r
//	defer func() {
//		t++
//	}()
//
//	// 3.return
//	return
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
//	// 1.赋值
//	r = 1
//
//	// 2.r 作为函数参数，不会修改要返回的那个 r 值
//	defer func(r int) {
//		r++
//	}(r)
//
//	// 3.return
//	return
//}

func main() {
	fmt.Println(f1())
	fmt.Println(f2())
	fmt.Println(f3())
}
```

