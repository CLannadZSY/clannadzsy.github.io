---
title: "[Go] 中的陷阱"
description: "整理 Go 中容易混淆的行为，比较 UTF-8 字节长度与 rune 数量、nil 的使用、浮点数计算，以及 string 转换和 strconv.Itoa 的区别。"
lead: ""
date: 2021-09-24T03:43:43Z
lastmod: 2021-09-24T03:43:43Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/3160062725/"
---

适用环境：每个完整代码块分别保存为 `main.go`，在 Go 1.23.3、Windows/amd64 验证。标为编译错误的 nil 示例故意展示非法赋值；其余示例可使用 `go run main.go`。浮点打印结果用于观察当前示例，不能作为十进制数精确运算的保证。

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
  // string 是只读字节序列，不保证任意内容都是有效 UTF-8。
  // 本例文字是有效 UTF-8，其中 ♥ 占 3 字节，因此总长度为 7。
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
  // RuneCountInString 统计 Unicode 码点数量，不是用户眼中的字形数量；组合字符和 emoji 可能包含多个码点。
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

  `nil` 是预定义标识符，可以赋给指针、切片、map、channel、函数和接口等支持 nil 的类型；`string` 不属于这些类型，它的零值是 `""`。上面的程序是预期编译失败示例，赋值和比较都不合法。

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

验证：前两个字符串程序分别输出 `7` 与 `5`；合法 nil 指针程序输出 `<nil>`；`string(105)` 输出 `i`，整数格式化两次输出 `105`。`go vet` 可能专门提示整数到字符串的码点转换，这是该反例要区分的行为。参考 [Go 规范：字符串](https://go.dev/ref/spec#String_types)、[转换](https://go.dev/ref/spec#Conversions)与 [utf8.RuneCountInString](https://pkg.go.dev/unicode/utf8@go1.23.3#RuneCountInString)。
