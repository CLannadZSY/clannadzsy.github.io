---
title: "List, Tuple, += 问题记录"
date: 2021-04-26T07:15:47Z
lastmod: 2026-10-22T00:06:41+08:00
draft: false
description: "通过嵌套列表与元组中的可变列表示例，记录重复引用、原地加法和下标赋值的差异，并结合 dis 字节码观察 += 引发异常时对象仍被修改的现象。"
lead: ""
weight: 50
contributors: [clannadzsy]
url: "/blog/2414890336/"
---

运行环境：以下示例使用标准库，在 CPython 3.12.14 验证。每个代码块可独立保存为 `demo.py` 后执行 `python demo.py`；其中 `TypeError` 是要观察的预期行为，示例会捕获它以继续打印对象状态。

#### Building Lists of Lists

```python
test_1 = [['1'] * 3 for i in range(3)]
test_2 = [['1'] * 3] * 3

test_1[1][1] = 0
print(test_1)
# [['1', '1', '1'], ['1', 0, '1'], ['1', '1', '1']]

test_2[1][1] = 0
print(test_2)
# [['1', 0, '1'], ['1', 0, '1'], ['1', 0, '1']]

print(test_1[0] is test_1[1], test_2[0] is test_2[1])
# False True
```

列表推导式每次创建一个新的内层列表；`[inner] * 3` 重复的是对同一个内层列表的引用。这里用 `print` 观察结果，而不是把预期结果重新赋值给变量。

### Tuple, +=

```python
a = (1, 2, [3, 4])

try:
    a[2] += [5, 6]
except TypeError as error:
    print(f'TypeError: {error}')
# TypeError: 'tuple' object does not support item assignment

print(a)
# (1, 2, [3, 4, 5, 6])
```

`+=` 对这里的列表先做原地扩展，再尝试把结果写回 `a[2]`。后一步因元组不支持下标赋值而失败，但前一步已修改的列表不会自动恢复；元组不可变也不表示其中引用的列表不可变。这个现象见 [Python 官方 FAQ](https://docs.python.org/3.12/faq/programming.html#why-does-a-tuple-i-item-raise-an-exception-when-the-addition-works)。

直接调用列表方法不需要给元组的槽位重新赋值，不过 `append` 和 `extend` 的结果不同：

```python
a = (1, 2, [3, 4])
a[2].append([5, 6])
print(a)
# (1, 2, [3, 4, [5, 6]])

a = (1, 2, [3, 4])
a[2].extend([5, 6])
print(a)
# (1, 2, [3, 4, 5, 6])
```

`append` 将整个参数作为一个元素加入，`extend` 逐个加入参数中的元素，参见[可变序列操作](https://docs.python.org/3.12/library/stdtypes.html#mutable-sequence-types)。

可以用下面的独立代码查看这两种写法的字节码：

```python
import dis

dis.dis('a[2] += [5, 6]')
print()
dis.dis('a[2].append([5, 6])')
```

在 CPython 3.12 中，第一个反汇编的 `BINARY_OP (+=)` 在 `STORE_SUBSCR` 之前；第二个通过 `CALL` 调用 `append`，没有对元组执行 `STORE_SUBSCR`。`dis.dis` 只反汇编传入的代码，不会执行这两条语句。字节码是 CPython 实现细节，不同版本的指令和偏移量会变化，应以本机 [`dis` 输出](https://docs.python.org/3.12/library/dis.html)为准。
