---
title: "[Go] Method"
description: "用 Human、Student 和 Employee 示例说明 Go 结构体嵌入带来的方法提升，以及外层类型定义同名 SayHi 方法后，方法调用行为如何变化。"
lead: ""
date: 2021-08-30T01:57:38Z
lastmod: 2026-10-22T00:06:41+08:00
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/1110384130/"
---

适用环境：两个完整程序分别保存为 `main.go`，在 Go 1.23.3、Windows/amd64 运行 `go run main.go`。Go 的结构体嵌入提供方法提升（promotion），并非面向对象语言中的类继承。

### 嵌入与方法提升

```go
package main

import "fmt"

type Human struct {
    name string
    age int
    phone string
}

type Student struct {
    Human
    school string
}

type Employee struct {
    Human
    company string
}

func (h *Human) SayHi() {
    fmt.Printf("Hi, I am %s you can call me on %s\n", h.name, h.phone)
}

func main() {
    mark := Student{Human{"Mark", 25, "222-222-YYYY"}, "MIT"}
    sam := Employee{Human{"Sam", 45, "111-888-XXXX"}, "Golang Inc"}

    mark.SayHi()
    sam.SayHi()
}
```

第一个程序中，`mark.SayHi()` 和 `sam.SayHi()` 使用从嵌入字段提升的方法；变量可寻址，调用时可自动取地址匹配 `*Human` 接收者。

### 外层类型的同名方法

```go
package main

import "fmt"

type Human struct {
    name string
    age int
    phone string
}

type Student struct {
    Human
    school string
}

type Employee struct {
    Human
    company string
}

func (h *Human) SayHi() {
    fmt.Printf("Hi, I am %s you can call me on %s\n", h.name, h.phone)
}

// Employee 的同名方法会遮蔽通过嵌入字段提升的 SayHi。
func (e *Employee) SayHi() {
    fmt.Printf("Hi, I am %s, I work at %s. Call me on %s\n", e.name,
        e.company, e.phone) //Yes you can split into 2 lines here.
}

func main() {
    mark := Student{Human{"Mark", 25, "222-222-YYYY"}, "MIT"}
    sam := Employee{Human{"Sam", 45, "111-888-XXXX"}, "Golang Inc"}

    mark.SayHi()
    sam.SayHi()
}
```

第二个程序中，`sam.SayHi()` 调用 `*Employee` 的方法，而 `sam.Human.SayHi()` 仍可显式调用嵌入字段的方法。这里没有动态重写 `Human` 的行为；两次运行应分别看到通用问候和带公司名称的问候。参考 [Go 语言规范：结构体嵌入及提升](https://go.dev/ref/spec#Struct_types)。
