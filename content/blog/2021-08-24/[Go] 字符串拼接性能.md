---
title: "[Go] 字符串拼接性能"
description: "对比 Go 中加号、fmt.Sprintf、strings.Builder、bytes.Buffer 与字节切片的拼接基准测试，讨论预分配容量和内存拷贝对性能的影响。"
lead: ""
date: 2021-08-24T02:39:37Z
lastmod: 2021-08-24T02:39:37Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/3239669741/"
---

#### 1. 字符串高效拼接

适用环境：标准库基准示例在 Go 1.23.3、Windows/amd64 验证。将随机字符串、拼接函数、benchmark 和末尾的 `builderGrowConcat` 四个 Go 代码块合并保存为 `concat_test.go`。在空目录执行 `go mod init example/concat`，再运行 `go test -run '^$' -bench . -benchmem -benchtime=1x -count=1` 做一次有界检查；正式比较可增加运行次数并记录工具链及机器信息。

#### 1.1 为了避免编译器的优化， 首先实现一个生成长度为 n 的随机字符串的函数。

```go
package concat

import (
    "bytes"
    "fmt"
    "math/rand"
    "strings"
    "testing"
)

const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
func randomString(n int) string {
    b := make([]byte, n)
    for i := range b {
        b[i] = letterBytes[rand.Intn(len(letterBytes))]
    }
    return string(b)
}
```

常见的字符串拼接方式， 以下 5 种

```go
// +
func plusConcat(n int, str string) string {
    s := ""
    for i := 0; i < n; i++ {
        s += str
    }
    return s
}

// fmt.Sprintf
func sprintfConcat(n int, str string) string {
    s := ""
    for i := 0; i < n; i++ {
        s = fmt.Sprintf("%s%s", s, str)
    }
    return s
}

// strings.Builder
func builderConcat(n int, str string) string {
    var builder strings.Builder
    for i := 0; i < n; i++ {
        builder.WriteString(str)
    }
    return builder.String()
}

// bytes.Buffer
func bufferConcat(n int, str string) string {
    buf := new(bytes.Buffer)
    for i := 0; i < n; i++ {
        buf.WriteString(str)
    }
    return buf.String()
}

// []byte
func byteConcat(n int, str string) string {
    buf := make([]byte, 0)
    for i := 0; i < n; i++ {
        buf = append(buf, str...)
    }
    return string(buf)
}

// 如果长度是可预知的，那么创建 []byte 时，我们还可以预分配切片的容量(cap)。
func preByteConcat(n int, str string) string {
    buf := make([]byte, 0, n*len(str))
    for i := 0; i < n; i++ {
        buf = append(buf, str...)
    }
    return string(buf)
}
```

#### 1.2 benchmark 性能比拼

每个 benchmark 用例中，生成了一个长度为 10 的字符串，并拼接 1w 次。

```go
var result string // 保留结果，避免只测到可被消除的无用计算。

func benchmark(b *testing.B, f func(int, string) string) {
    var str = randomString(10)
    b.ReportAllocs()
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        result = f(10000, str)
    }
}

func BenchmarkPlusConcat(b *testing.B)    { benchmark(b, plusConcat) }
func BenchmarkSprintfConcat(b *testing.B) { benchmark(b, sprintfConcat) }
func BenchmarkBuilderConcat(b *testing.B) { benchmark(b, builderConcat) }
func BenchmarkBufferConcat(b *testing.B)  { benchmark(b, bufferConcat) }
func BenchmarkByteConcat(b *testing.B)    { benchmark(b, byteConcat) }
func BenchmarkPreByteConcat(b *testing.B) { benchmark(b, preByteConcat) }
func BenchmarkBuilderGrowConcat(b *testing.B) { benchmark(b, builderGrowConcat) }
```

历史测试结果（原记录未注明 Go 版本与内存统计，仅保留为该机器上的一次时间观测）：

```text
goos: windows
goarch: amd64
pkg: example/charpter-1
BenchmarkPlusConcat
BenchmarkPlusConcat-6             18      56304633 ns/op
BenchmarkSprintfConcat
BenchmarkSprintfConcat-6          13      90110408 ns/op
BenchmarkBuilderConcat
BenchmarkBuilderConcat-6       12132         97072 ns/op
BenchmarkBufferConcat
BenchmarkBufferConcat-6        10000        104952 ns/op
BenchmarkByteConcat
BenchmarkByteConcat-6          10000        114187 ns/op
BenchmarkPreByteConcat
BenchmarkPreByteConcat-6       24522         48754 ns/op
PASS
```

上述循环反复累积长字符串时，`+` 和 `fmt.Sprintf` 的历史耗时较高；这不能推广成少量固定字符串相加一定慢。原输出没有 `B/op`、`allocs/op`，无法据此断言内存差多少倍；应使用 `-benchmem` 在相同输入及环境下比较。

预分配 `[]byte` 容量可以避免容量足够时的扩容与旧缓冲区搬迁，但每次 `append` 仍需把输入复制进缓冲区，最终 `string(buf)` 通常还要复制并分配字符串。它不是零拷贝方案，也不能保证在所有版本中都最快或内存最少。

#### 1.3 建议

综合易用性和性能，一般推荐使用 `strings.Builder` 来拼接字符串。

这是 Go 官方对 `strings.Builder` 的解释：

> A Builder is used to efficiently build a string using Write methods. It minimizes memory copying.

`strings.Builder` 也提供了预分配容量的方式 `Grow`，这里使用不同函数名，避免与前面的未预分配版本重复定义：

```go
func builderGrowConcat(n int, str string) string {
    var builder strings.Builder
    builder.Grow(n * len(str))
    for i := 0; i < n; i++ {
        builder.WriteString(str)
    }
    return builder.String()
}
```

`Builder` 可减少额外复制，但实际分配次数与字节数以基准输出为准，不保证恒定减半。`Grow` 的大小需非负且避免整数溢出；非零 `Builder` 不可复制使用。验证时所有函数应产生长度为 `10000*10` 的相同字符串，性能数字之外也要检查结果。参考 [Go 官方 strings.Builder](https://pkg.go.dev/strings@go1.23.3#Builder)与 [testing 基准文档](https://pkg.go.dev/testing@go1.23.3#hdr-Benchmarks)。

### 文章来源

#### [极客兔兔-Go 语言高性能编程](https://geektutu.com/post/hpg-string-concat.html)
