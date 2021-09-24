---
title: "[Go] 中的陷阱"
description: ""
lead: ""
date: 2021-09-24T03:43:43Z
lastmod: 2021-09-24T03:43:43Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/3160062725/"
---

- 字符串的长度与数量

  ```go
  // Number of Bytes
  package main
  
  import "fmt"
  
  func main() {
  	data := "We♥Go"
  	fmt.Println(len(data))
  }
  
  // 7
  // 在 Go 中，字符串是 UTF-8 编码的，这意味着每个称为 rune 的字符可以是 1 到 4 个字节长。这里，字符 ♥ 占用 3 个字节，因此字符串的总长度为 7。
  ```

  ```go
  // Number of Runes
  package main
  
  import (
  	"fmt"
  	"unicode/utf8"
  )
  
  func main() {
  	data := "We♥Go"
  	fmt.Println(utf8.RuneCountInString(data))
  }
  
  // 5
  // 如果要获取字符串中的字符数量，可以使用 unicode/utf8 包。该 RuneCountInString 功能是返回一个字符串的字符数量
  ```

- 用 nil 初始化变量

  ```go
  package main
  
  import "fmt"
  
  func main() {
  	var data string = nil
  	if data == nil {
  		fmt.Println(data)
  	}
  }
  
  // cannot use nil as type string in assignment
  ```

  `nil` 不是类型而是预定义标识符，不能在赋值中使用它。

  ```go
  package main
  
  import "fmt"
  
  func main() {
  	var data *string = nil
  	if data == nil {
  		fmt.Println(data)
  	}
  }
  
  // <nil>
  // *string 是指向字符串类型值的指针变量的类型。指针的零值是 nil。
  ```

- 浮点数乘法

  ```go
  package main
  
  import "fmt"
  
  func main() {
  	 var m = 1.39
  	 fmt.Println(m * m)
  	 
  	 const n = 1.39
  	 fmt.Println(n * n)
  }
  
  // 1.9320999999999997
  // 1.9321
  ```

- 字符串类型转换

  ```go
  package main
  
  import "fmt"
  
  func main() {
  	 i := 105
  	 s := string(i)
  	 fmt.Println(s)	 
  }
  
  // i
  // 字符串支持从 int 类型转换，这里 string() 将整数视为字符。 105的字符是 i。
  ```

- 整数转字符串

  ```go
  package main
  
  import (
  	"fmt"
  	"strconv"
  )
  
  func main() {
  	i := 105
  	s := strconv.Itoa(i)
  	fmt.Println(s)
  	
  	s = fmt.Sprintf("%d", i)
  	fmt.Println(s)
  }
  
  // 请使用 strconv.Itoa() 或 fmt.Sprintf() 函数。
  ```

  

