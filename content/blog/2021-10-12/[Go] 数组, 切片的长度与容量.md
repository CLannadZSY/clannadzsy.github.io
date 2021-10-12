---
title: "[Go] 数组, 切片的长度与容量"
description: ""
lead: ""
date: 2021-10-12T07:18:30Z
lastmod: 2021-10-12T07:18:30Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/4217449500/"
---

来源: [Capacity and length of a slice in Go](https://gosamples.dev/capacity-and-length/)



### 数组

数组是具有**`size`**相同值的某个对象的索引集合**`type`**，声明为：

![去数组](https://gosamples.dev/capacity-and-length/go_array.png)

#### 数组的属性

- 数组有固定大小，不能调整大小。切片可以调整大小。
- 数组的类型包括其大小。的`[4]int`数组类型是不同于`[5]int`，并且它们不能相比。
- 初始化一个数组，`var name [size]type`创建一个`size`类型元素的集合，`type`每个元素都是给定的[零值](https://golang.org/ref/spec#The_zero_value)`type`。
- 数组**按值传递**。这意味着当您将一个数组分配给另一个数组时，您将制作其内容的新副本：



### 切片

**var name []type**

![去切片](https://gosamples.dev/capacity-and-length/go_slice.png)



#### 切片的属性

- [`append()`](https://pkg.go.dev/builtin#append)调用函数时，切片会自动调整大小。
- 切片是[不可比较的](https://golang.org/ref/spec#Comparison_operators)，简单的相等比较`a == b`是不可能的。查看[如何比较切片](https://gosamples.dev/compare-slices)。
- 用 初始化切片`var name []type`会创建一个`nil`长度和容量等于 0 且没有底层数组的切片。看看[nil 和 empty slice 有什么区别](http://localhost:1313/empty-vs-nil-slice/)。
- 就像数组（以及 Go 中的所有内容）一样，切片**按值传递**。当分配一个切片到一个新的变量，则`ptr`，`len`以及`cap`被复制，包括`ptr`指针将**指向同一底层数组**。如果修改复制的切片，则会修改相同的共享数组，这将使旧切片和新切片中的所有更改都可见：