---
title: "Single Dispatch Generic Functions"
description: ""
lead: ""
date: 2021-04-29T06:25:32Z
lastmod: 2021-04-29T06:25:32Z
draft: false
weight: 50
contributors: [clannadzsy]
url: "/blog/"
---

```python

"""
from Fluent Python 2nd Example 9-19
"""

from functools import singledispatch
from collections import abc
import fractions
import decimal
import html
import numbers


@singledispatch
def htmlize(obj: object) -> str:
    content = html.escape(repr(obj))
    return f'<pre>{content}</pre>'


@htmlize.register
def _(text: str) -> str:
    content = html.escape(text).replace('\n', '<br>\n')
    return f'<p>{content}</p>'


@htmlize.register
def _(seq: abc.Sequence) -> str:
    inner = '</li>\n<li>'.join(htmlize(item) for item in seq)
    return '<ul>\n<li>' + inner + '</li>\n</ul>'


@htmlize.register
def _(n: numbers.Integral) -> str:
    return f'<pre>{n} (0x{n:x})</pre>'


@htmlize.register
def _(n: bool) -> str:
    return f'<pre>{n}</pre>'


@htmlize.register(fractions.Fraction)
def _(x) -> str:
    frac = fractions.Fraction(x)
    return f'<pre>{frac.numerator}/{frac.denominator}</pre>'


@htmlize.register(decimal.Decimal)
@htmlize.register(float)
def _(x) -> str:
    frac = fractions.Fraction(x).limit_denominator()
    return f'<pre>{x} ({frac.numerator}/{frac.denominator})</pre>'


if __name__ == '__main__':
    
    param_list = [
        {1, 2, 3},
        abs,
        'Hello \n World',
        123,
        ['linux', 1, {1, 2, 3}],
        True,
        fractions.Fraction(2, 3),
        0.1,
        decimal.Decimal('0.123456')
    ]
    
    for p in param_list:
        print(p)
        print(htmlize(p))
        print('\n')

# {1, 2, 3}
# <pre>{1, 2, 3}</pre>
# 
# 
# <built-in function abs>
# <pre>&lt;built-in function abs&gt;</pre>
# 
# 
# Hello 
#  World
# <p>Hello <br>
#  World</p>
# 
# 
# 123
# <pre>123 (0x7b)</pre>
# 
# 
# ['linux', 1, {1, 2, 3}]
# <ul>
# <li><p>linux</p></li>
# <li><pre>1 (0x1)</pre></li>
# <li><pre>{1, 2, 3}</pre></li>
# </ul>
# 
# 
# True
# <pre>True</pre>
# 
# 
# 2/3
# <pre>2/3</pre>
# 
# 
# 0.1
# <pre>0.1 (1/10)</pre>
# 
# 
# 0.123456
# <pre>0.123456 (1929/15625)</pre>

```
