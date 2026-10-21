---
title: "[Go] 数组, 切片的长度与容量"
description: "介绍 Go 数组与切片的声明和基本属性，比较固定大小、长度与容量、值传递，以及切片共享底层数组的行为，附数组和切片结构示意图。"
lead: ""
date: 2021-10-12T07:18:30Z
lastmod: 2021-10-12T07:18:30Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/4217449500/"
---

来源: [Capacity and length of a slice in Go](https://gosamples.dev/capacity-and-length/)。下面补齐声明及共享底层数组的示例，语义以 [Go 语言规范](https://go.dev/ref/spec#Slice_types)为准。

适用环境：仅使用标准库，在 Go 1.23.3、Windows/amd64 验证。完整示例保存为 `main.go` 后运行 `go run main.go`。

### 数组

数组是固定长度、元素类型相同的序列，声明形式为 `var name [size]type`。

![Go 数组示意图](https://gosamples.dev/capacity-and-length/go_array.png)

#### 数组的属性

- 长度是数组类型的一部分，`[4]int` 和 `[5]int` 是不同类型，不能直接相互赋值或比较。
- 未显式初始化的元素为其类型的零值，例如 `var a [4]int` 的四个元素均为 `0`。
- 数组赋值或作为值参数传递会复制数组值。若元素本身是指针等引用性数据，这不是递归的深拷贝。
- 元素类型可比较时，相同类型的数组可用 `==` 比较；切片的比较规则不同。

### 切片

声明形式为 `var name []type`。

![Go 切片示意图](https://gosamples.dev/capacity-and-length/go_slice.png)

#### 切片的属性

- `len(s)` 是当前切片的元素个数，`cap(s)` 是从起点到其底层数组末端可容纳的元素个数。
- `var s []int` 声明一个 nil 切片，长度与容量均为 `0`；`[]int{}` 是非 nil 的空切片，长度与容量也可以为 `0`。切片只能直接与 `nil` 比较，不能使用 `a == b` 比较两个切片。
- 切片赋值会复制切片值，两份切片最初共享底层数组；修改共享范围内的元素会互相可见。
- [`append`](https://pkg.go.dev/builtin#append) 返回新的切片值，必须接收返回结果。容量足够时可能继续使用原数组；容量不足时分配新数组，后续修改不再影响原数组。具体扩容倍数是实现细节。

```go
package main

import "fmt"

func main() {
    a := [3]int{1, 2, 3}
    b := a
    b[0] = 9
    fmt.Println(a, b) // [1 2 3] [9 2 3]

    s := make([]int, 2, 3)
    s[0], s[1] = 1, 2
    shared := s
    shared[0] = 9
    fmt.Println(s) // [9 2]

    grown := append(s, 3) // 原容量为 3，仍能使用同一底层数组。
    grown[1] = 8
    fmt.Println(s, grown) // [9 8] [9 8 3]

    detached := append(grown, 4) // 长度超过原容量，分配新的底层数组。
    detached[0] = 7
    fmt.Println(grown, detached) // [9 8 3] [7 8 3 4]

    var nilSlice []int
    emptySlice := []int{}
    fmt.Println(len(nilSlice), cap(nilSlice), nilSlice == nil) // 0 0 true
    fmt.Println(len(emptySlice), cap(emptySlice), emptySlice == nil) // 0 0 false
}
```

输出应与注释一致。不要根据某一次扩容后的容量推导固定扩容算法；这里仅用“超过原容量”保证示例中最后一次 `append` 必须分配新数组。
