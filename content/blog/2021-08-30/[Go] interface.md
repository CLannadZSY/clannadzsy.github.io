---
title: "[Go] Interface"
description: "通过结构体与方法示例梳理 Go interface 的定义和赋值，介绍 fmt.Stringer、接口参数、类型判断与接口嵌入，理解接口如何承载不同类型的值。"
lead: ""
date: 2021-08-30T01:59:22Z
lastmod: 2026-10-22T00:06:41+08:00
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/4229706688/"
---

#### interface类型

本文使用普通方法接口，示例只依赖标准库。各个完整 `package main` 程序分别保存为 `main.go` 后执行 `go run main.go`；接口嵌入末尾的类型定义是局部片段，不能单独运行。已在 Go 1.23.3、Windows/amd64 验证。

interface 类型定义了一组方法，某个类型的方法集满足接口要求时就实现该接口。`T` 与 `*T` 的方法集不同：本节接收者使用指针，因此示例通过 `*Student`、`*Employee` 赋给接口，不能由可寻址值能直接调用方法推断该值类型满足接口。

```go
package main

import "fmt"

type Human struct {
    name  string
    age   int
    phone string
}

type Student struct {
    Human
    school string
    loan   float32
}

type Employee struct {
    Human
    company string
    money   float32
}

func (h *Human) SayHi() {
    fmt.Printf("Hi, I am %s you can call me on %s\n", h.name, h.phone)
}

func (h *Human) Sing(lyrics string) {
    fmt.Println("La la, la la la, la la la la la...", lyrics)
}

func (h *Human) Guzzle(beerStein string) {
    fmt.Println("Guzzle Guzzle Guzzle...", beerStein)
}

func (e *Employee) SayHi() {
    fmt.Printf("Hi, I am %s, I work at %s. Call me on %s\n", e.name, e.company, e.phone)
}

func (s *Student) BorrowMoney(amount float32) {
    s.loan += amount
}

func (e *Employee) SpendSalary(amount float32) {
    e.money -= amount
}

type Men interface {
    SayHi()
    Sing(lyrics string)
    Guzzle(beerStein string)
}

type Tom interface {
    SayHi()
    Sing(song string)
    BorrowMoney(amount float32)
}

type Jerry interface {
    SayHi()
    Sing(song string)
    SpendSalary(amount float32)
}

func main() {
    var person Men = &Student{Human: Human{name: "Mike", phone: "222-222-XXX"}}
    person.SayHi()
    person.Sing("November rain")
    person.Guzzle("one glass")
}
```

#### interface值

```go
package main

import "fmt"

type Human struct {
    name  string
    age   int
    phone string
}

type Student struct {
    Human
    school string
    loan   float32
}

type Employee struct {
    Human
    company string
    money   float32
}

func (h Human) SayHi() {
    fmt.Printf("Hi, I am %s you can call me on %s\n", h.name, h.phone)
}

func (h Human) Sing(lyrics string) {
    fmt.Println("La la, la la la, la la la la la...", lyrics)
}

func (e Employee) SayHi() {
    fmt.Printf("Hi, I am %s, I work at %s. Call me on %s\n", e.name, e.company, e.phone)
}

type Men interface {
    SayHi()
    Sing(lyrics string)
}

func main() {
    mike := Student{Human{"Mike", 25, "222-222-XXX"}, "MIT", 0.00}
    paul := Student{Human{"Paul", 26, "111-222-XXX"}, "Harvard", 100}
    sam := Employee{Human{"Sam", 36, "444-222-XXX"}, "Golang Inc.", 1000}
    tom := Employee{Human{"Tom", 37, "222-444-XXX"}, "Things Ltd.", 5000}

    var i Men
    i = mike
    fmt.Println("This is Mike, a Student:")
    i.SayHi()
    i.Sing("November rain")

    i = tom
    fmt.Println("This is tom, an Employee")
    i.SayHi()
    i.Sing("born to be wild")

    fmt.Println("Let's use a slice of Men and see what happens")
    x := make([]Men, 3)
    x[0], x[1], x[2] = paul, sam, mike
    for _, value := range x {
        value.SayHi()
    }
}
```

#### interface函数参数

```go
package main

import (
    "fmt"
    "strconv"
)

type Human struct {
    name  string
    age   int
    phone string
}

// 通过这个方法 Human 实现了 fmt.Stringer
func (h Human) String() string {
    return "❰" + h.name + " - " + strconv.Itoa(h.age) + " years -  ✆ " + h.phone + "❱"
}

func main() {
    Bob := Human{"Bob", 39, "000-7777-XXX"}
    fmt.Println("This Human is : ", Bob)
}
```

#### interface变量存储的类型

```go

    package main

    import (
        "fmt"
        "strconv"
    )

    type Element interface{}
    type List [] Element

    type Person struct {
        name string
        age int
    }

    func (p Person) String() string {
        return "(name: " + p.name + " - age: "+strconv.Itoa(p.age)+ " years)"
    }

    func main() {
        list := make(List, 3)
        list[0] = 1
        list[1] = "Hello"
        list[2] = Person{"Dennis", 70}

        for index, element := range list{
            switch value := element.(type) {
                case int:
                    fmt.Printf("list[%d] is an int and its value is %d\n", index, value)
                case string:
                    fmt.Printf("list[%d] is a string and its value is %s\n", index, value)
                case Person:
                    fmt.Printf("list[%d] is a Person and its value is %s\n", index, value)
                default:
                    fmt.Printf("list[%d] is of a different type\n", index)
            }
        }
    }
```

#### 嵌入interface

我们可以看到源码包container/heap里面有这样的一个定义

```go
type Interface interface {
    sort.Interface // 嵌入接口的方法集
    Push(x interface{}) //a Push method to push elements into the heap
    Pop() interface{} //a Pop elements that pops elements from the heap
}
```

嵌入 `sort.Interface` 会包含它的方法集，不是结构体中的嵌入字段；调用者仍需实现 `Len`、`Less`、`Swap` 三个方法：

```go
type Interface interface {
    // Len is the number of elements in the collection.
    Len() int
    // Less returns whether the element with index i should sort
    // before the element with index j.
    Less(i, j int) bool
    // Swap swaps the elements with indexes i and j.
    Swap(i, j int)
}
```

另一个例子就是io包下面的 io.ReadWriter ，它包含了io包下面的Reader和Writer两个interface：

```go
// io.ReadWriter
type ReadWriter interface {
    Reader
    Writer
}
```

验证：四个完整程序分别应输出问候语、不同具体类型的方法调用、`Human.String()` 格式化结果和列表的类型判断结果；可另运行 `go vet main.go` 检查格式化参数。方法集和接口嵌入规则见 [Go 语言规范](https://go.dev/ref/spec#Method_sets)。
