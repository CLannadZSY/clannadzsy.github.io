---
title: "[Go] 字符串拼接性能"
description: ""
lead: ""
date: 2021-08-24T02:39:37Z
lastmod: 2021-08-24T02:39:37Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/3239669741/"
---

#### 1. 字符串高效拼接

##### 1.1 为了避免编译器的优化， 首先实现一个生成长度为 n 的随机字符串的函数。

```go
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
##### 1.2 benchmark 性能比拼

每个 benchmark 用例中，生成了一个长度为 10 的字符串，并拼接 1w 次。

```go
func benchmark(b *testing.B, f func(int, string) string) {
	var str = randomString(10)
	for i := 0; i < b.N; i++ {
		f(10000, str)
	}
}

func BenchmarkPlusConcat(b *testing.B)    { benchmark(b, plusConcat) }
func BenchmarkSprintfConcat(b *testing.B) { benchmark(b, sprintfConcat) }
func BenchmarkBuilderConcat(b *testing.B) { benchmark(b, builderConcat) }
func BenchmarkBufferConcat(b *testing.B)  { benchmark(b, bufferConcat) }
func BenchmarkByteConcat(b *testing.B)    { benchmark(b, byteConcat) }
func BenchmarkPreByteConcat(b *testing.B) { benchmark(b, preByteConcat) }
```

测试结果

```go
goos: windows
goarch: amd64
pkg: example/charpter-1
BenchmarkPlusConcat
BenchmarkPlusConcat-6      	      18	  56304633 ns/op
BenchmarkSprintfConcat
BenchmarkSprintfConcat-6   	      13	  90110408 ns/op
BenchmarkBuilderConcat
BenchmarkBuilderConcat-6   	   12132	     97072 ns/op
BenchmarkBufferConcat
BenchmarkBufferConcat-6    	   10000	    104952 ns/op
BenchmarkByteConcat
BenchmarkByteConcat-6      	   10000	    114187 ns/op
BenchmarkPreByteConcat
BenchmarkPreByteConcat-6   	   24522	     48754 ns/op
PASS
```



从基准测试的结果来看，使用 `+` 和 `fmt.Sprintf` 的效率是最低的，和其余的方式相比，性能相差约 1000 倍，而且消耗了超过 1000 倍的内存。当然 `fmt.Sprintf` 通常是用来格式化字符串的，一般不会用来拼接字符串。

`strings.Builder`、`bytes.Buffer` 和 `[]byte` 的性能差距不大，而且消耗的内存也十分接近，性能最好且消耗内存最小的是 `preByteConcat`，这种方式预分配了内存，在字符串拼接的过程中，不需要进行字符串的拷贝，也不需要分配新的内存，因此性能最好，且内存消耗最小。

##### 1.3 建议

综合易用性和性能，一般推荐使用 `strings.Builder` 来拼接字符串。

这是 Go 官方对 `strings.Builder` 的解释：

> A Builder is used to efficiently build a string using Write methods. It minimizes memory copying.

`string.Builder` 也提供了预分配内存的方式 `Grow`：

```go
func builderConcat(n int, str string) string {
	var builder strings.Builder
	builder.Grow(n * len(str))
	for i := 0; i < n; i++ {
		builder.WriteString(str)
	}
	return builder.String()
}
```

与预分配内存的 `[]byte` 相比，因为省去了 `[]byte` 和字符串(string) 之间的转换，内存分配次数还减少了 1 次，内存消耗减半。

### 文章来源
##### [极客兔兔-Go 语言高性能编程](https://geektutu.com/post/hpg-string-concat.html)


