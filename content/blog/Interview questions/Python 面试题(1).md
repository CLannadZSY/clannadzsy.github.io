---
title: "Python 面试题(1)"
description: ""
lead: ""
date: 2021-06-02T06:40:12Z
lastmod: 2021-06-02T06:40:12Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/1745614505/"
---

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

    这个的原因是 Python 的闭包的后期绑定导致的 late binding，这意味着在闭包中的变量是在内部函数被调用的时候被查找。所以结果是，当任何 multipliers() 返回的函数被调用，在那时，i 的值是在它被调用时的周围作用域中查找，到那时，无论哪个返回的函数被调用，for 循环都已经完成了，i 最后的值是 3，因此，每个返回的函数 multiplies 的值都是 3。因此一个等于 2 的值被传递进以上代码，它们将返回一个值 6 （比如：3 x 2）。

    ```python
    # 创建一个闭包，通过使用默认参数立即绑定它的参数
    def multipliers():
	    return [lambda x, i=i : i * x for i in range(4)]

    # 或者使用 functools.partial 函数
    from functools import partial
    from operator import mul

    def multipliers():
	    return [partial(mul, i) for i in range(4)]
    ```


2.  默认参数值是可变的

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
    
    新的默认列表仅仅只在函数被定义时创建一次。随后当 extendList 没有被指定的列表参数调用的时候，其使用的是同一个列表。这就是为什么当函数被定义的时候，表达式是用默认参数被计算，而不是它被调用的时候。
    
    ```python
    # 修改如下
    def extendList(val, list_val=None):
        if list_val is None:
    		list_val = []
        list_val.append(val)
    	return list_val
    
    # 输出结果
    # list1 = [10]
    # list2 = [123]
    # list3 = ['a']
    ```

   

