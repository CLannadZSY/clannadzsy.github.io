---
title: "Python 面试题(1)"
description: "通过示例讨论 Python 闭包的后期绑定和可变默认参数，展示默认参数绑定、functools.partial 及使用 None 作为默认值的处理思路。"
lead: ""
date: 2021-06-02T06:40:12Z
lastmod: 2021-06-02T06:40:12Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/1745614505/"
---

运行环境：以下示例在 CPython 3.12.14 验证，仅使用标准库。每个完整代码块可独立保存为 `demo.py` 并执行 `python demo.py`。第一题的重复结果和第二题的共享列表都是要观察的行为，不是语法错误。

1. 闭包

    ```python
    def multipliers():
        return [lambda x: i * x for i in range(4)]

    print([m(2) for m in multipliers()])
    ```

    正确答案
    [6, 6, 6, 6]

    错误答案
    ~~[0, 2, 4, 6]~~

    原因是闭包的后期绑定（late binding）：这些函数捕获的是同一个外层局部变量 `i`，并在调用时读取它。列表推导式结束后 `i` 为 `3`，所以之后对四个函数分别传入 `2`，都会得到 `3 * 2 = 6`。这也适用于用 `def` 定义的闭包，参见 [Python 官方 FAQ](https://docs.python.org/3.12/faq/programming.html#why-do-lambdas-defined-in-a-loop-with-different-values-all-return-the-same-result)。

    ```python
    # 创建一个闭包，通过使用默认参数立即绑定它的参数
    def multipliers():
        return [lambda x, i=i: i * x for i in range(4)]

    print([m(2) for m in multipliers()])
    # [0, 2, 4, 6]
    ```

    或者使用 `functools.partial` 提前绑定乘法的第一个参数：

    ```python
    from functools import partial
    from operator import mul

    def multipliers():
        return [partial(mul, i) for i in range(4)]

    print([m(2) for m in multipliers()])
    # [0, 2, 4, 6]
    ```

2. 默认参数值是可变的

    ```python
    def extendList(val, list_val=[]):
        list_val.append(val)
        return list_val

    list1 = extendList(10)
    list2 = extendList(123, [])
    list3 = extendList('a')

    print("list1 = %s" % list1)
    print("list2 = %s" % list2)
    print("list3 = %s" % list3)

    # 输出结果
    # list1 = [10, 'a']
    # list2 = [123]
    # list3 = [10, 'a']
    ```

    默认参数表达式在函数定义时求值一次，而不是每次调用时重新求值。没有显式传入列表的 `list1` 和 `list3` 引用同一个默认列表；`list2` 使用显式传入的新列表。使用 `None` 作为默认值，再在函数体内创建列表，可以让省略列表参数的各次调用相互独立，参见[官方函数定义说明](https://docs.python.org/3.12/reference/compound_stmts.html#function-definitions)。

    ```python
    # 修改如下
    def extendList(val, list_val=None):
        if list_val is None:
            list_val = []
        list_val.append(val)
        return list_val

    list1 = extendList(10)
    list2 = extendList(123, [])
    list3 = extendList('a')

    print("list1 = %s" % list1)
    print("list2 = %s" % list2)
    print("list3 = %s" % list3)

    # 输出结果
    # list1 = [10]
    # list2 = [123]
    # list3 = ['a']
    ```
