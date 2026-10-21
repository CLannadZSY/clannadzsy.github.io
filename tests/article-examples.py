"""Run code extracted from the Python/Go articles; no external services required.

Use CPython 3.12 and Go 1.23.3, install article-examples-requirements.txt, then run
python -B tests/article-examples.py. CI additionally requires --race for sync.Cond.
Heavy external-dependency and platform-specific articles have separate manual checks.
"""

import argparse
from collections import Counter
from importlib.metadata import version
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
import textwrap

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
PYTHON_ARTICLES = [
    '2021-04-14/装饰器的几种写法.md',
    '2021-04-26/List, Tuple, += 问题记录.md',
    '2021-04-27/作为引用的函数参数.md',
    '2021-04-29/Single Dispatch Generic Functions.md',
    '2021-04-29/Python何时执行装饰器.md',
    '2021-05-31/单分派泛函数.md',
    'Interview questions/Python 面试题(1).md',
]
GO_ARTICLES = [
    '2021-08-24/[Go] 字符串拼接性能.md',
    '2021-08-30/[Go] interface.md',
    '2021-08-30/[Go] method.md',
    '2021-09-02/[Go] defer 理解.md',
    '2021-09-07/Goroutines 和 Channels 练习.md',
    '2021-09-24/[Go] 中的陷阱.md',
    '2021-10-12/[Go] 数组, 切片的长度与容量.md',
    '2023-03-02/Golang并发时报错connection reset by peer.md',
    '2023-05-06/提高 Golang 并发编程能力的必备利器：深入学习 sync.Cond 类型.md',
]


def fences(article, language):
    """Dedent list-nested fenced examples without changing the code inside them."""
    result, content, active = [], [], None
    for line in (ROOT / 'content/blog' / article).read_text(encoding='utf-8').splitlines():
        if line.lstrip().startswith('```'):
            if active is None:
                active, content = line.strip()[3:].strip(), []
            else:
                if active == language:
                    result.append(textwrap.dedent('\n'.join(content)) + '\n')
                active = None
        elif active is not None:
            content.append(line)
    assert active is None, f'{article}: unclosed code fence'
    return result


def invoke(command, cwd, env, timeout=90, failure=False):
    result = subprocess.run(command, cwd=cwd, env=env, capture_output=True,
                            encoding='utf-8', errors='replace', timeout=timeout)
    assert (result.returncode != 0) == failure, (
        f'{cwd.name}: {command!r}\n{result.stdout}\n{result.stderr}')
    return result


def check_python(work, env):
    assert sys.implementation.name == 'cpython' and sys.version_info[:2] == (3, 12), (
        'Article bytecode checks require CPython 3.12')
    assert version('schedule') == '1.2.2', 'Install article-examples-requirements.txt'
    examples = [fences(article, 'python') for article in PYTHON_ARTICLES]
    assert [len(items) for items in examples] == [7, 4, 1, 2, 2, 3, 5]
    for article, items in zip(PYTHON_ARTICLES, examples):
        for index, code in enumerate(items, 1):
            compile(code, f'{article}#python-{index}', 'exec')
    runs = 0

    def run(name, code, expected=None, contains=()):
        nonlocal runs
        file = work / (name + '.py')
        file.write_text(code, encoding='utf-8')
        output = invoke([sys.executable, '-B', str(file)], work, env, timeout=12).stdout
        runs += 1
        if expected is not None:
            assert output.strip() == expected, f'{name}: unexpected output {output!r}'
        for value in contains:
            assert value in output, f'{name}: missing {value!r} in {output!r}'
        return output

    expected = [
        '执行了 add 函数\n1 + 2 = 3\nadd 函数执行完成',
        '执行了 add 函数\n1 + 2 = 3\nadd 函数执行完成\n3', None,
        "param='你好'\nhello world",
        '执行了 test 函数\ntest()\ntest 函数执行完成\nNone',
        'DEBUG 日志等级\n执行了 test 函数\ntest()\ntest 函数执行完成\nNone',
        'Decorator 1\nDecorator 2',
    ]
    schedule_runs = 0
    for index, code in enumerate(examples[0]):
        if index == 2:
            code += "\nassert not schedule.get_jobs('decorator-demo')\n"
        output = run(f'decorator-{index}', code, expected[index])
        if index == 2:
            lines = output.splitlines()
            assert 1 <= len(lines) <= 3 and set(lines) == {'hello world'}, output
            schedule_runs = len(lines)  # Polling cadence is not a realtime guarantee.

    list_checks = [
        "assert test_1 == [['1', '1', '1'], ['1', 0, '1'], ['1', '1', '1']]\n"
        "assert test_2 == [['1', 0, '1']] * 3\n"
        'assert test_1[0] is not test_1[1] and test_2[0] is test_2[1]\n',
        'assert a == (1, 2, [3, 4, 5, 6])\n',
        'assert a == (1, 2, [3, 4, 5, 6])\n',
        "ops = [i.opname for i in dis.get_instructions(compile('a[2] += [5, 6]', '<demo>', 'exec'))]\n"
        "assert ops.index('BINARY_OP') < ops.index('STORE_SUBSCR')\n"
        "assert 'STORE_SUBSCR' not in [i.opname for i in dis.get_instructions(compile('a[2].append([5, 6])', '<demo>', 'exec'))]\n",
    ]
    list_outputs = [None, "TypeError: 'tuple' object does not support item assignment\n(1, 2, [3, 4, 5, 6])",
                    '(1, 2, [3, 4, [5, 6]])\n(1, 2, [3, 4, 5, 6])', None]
    for index, code in enumerate(examples[1]):
        run(f'list-tuple-{index}', code + '\n' + list_checks[index], list_outputs[index])
    run('references', examples[2][0] + '\nassert a == [1, 2, 3, 4] and b == [3, 4]\n'
        'assert x == 1 and y == 2\nassert m == (1, 2) and n == (3, 4)\n',
        '3\n1 2\n[1, 2, 3, 4]\n[1, 2, 3, 4] [3, 4]\n(1, 2, 3, 4)\n(1, 2) (3, 4)')
    run('htmlize', '\n'.join(examples[3]), contains=[
        '<pre>True</pre>', '<pre>0.1 (1/10)</pre>', '<pre>0.123456 (1929/15625)</pre>'])
    direct = run('decorator', examples[4][0])
    assert [line.split(' at ')[0] for line in direct.splitlines()][:2] == [
        'running decorator <function f1', 'running decorator <function f2']
    assert direct.endswith('running f1()\nrunning f2()\nrunning f3()\n')
    imported = run('import_demo', examples[4][1] + '\nfirst = list(decorator.decorators)\n'
                   'import decorator\nassert decorator.decorators == first\n')
    assert imported.count('running decorator ') == 2
    assert 'running main()' not in imported and 'running f1()' not in imported
    run('dispatch-basics', examples[5][0] + '\nassert fun.registry[float] is fun.registry[Decimal]\n'
        'assert fun_num is not fun\n', contains=["<class 'decimal.Decimal'> 1.23", 'False', 'dict_keys('])
    run('dispatch-add', '\n'.join(examples[5][1:]), contains=[
        'hello, world', 'Error: 参数类型不同', '不支持的首参数类型: int'])
    expected = ['[6, 6, 6, 6]', '[0, 2, 4, 6]', '[0, 2, 4, 6]',
                "list1 = [10, 'a']\nlist2 = [123]\nlist3 = [10, 'a']",
                "list1 = [10]\nlist2 = [123]\nlist3 = ['a']"]
    for index, code in enumerate(examples[6]):
        if index in (3, 4):
            code += '\nassert list1 is not list2\n'
            code += 'assert list1 is list3\n' if index == 3 else 'assert list1 is not list3\n'
        run(f'interview-{index}', code, expected[index])
    return {'articles': len(examples), 'compiled_fences': sum(map(len, examples)),
            'executed_processes': runs, 'observed_schedule_runs': schedule_runs}


def check_go(work, env, require_race):
    go = shutil.which('go')
    assert go, 'Go 1.23.3 must be installed and available on PATH'
    env = dict(env, GOTOOLCHAIN='local', GOPROXY='off', GOSUMDB='off', GOWORK='off',
               GOMODCACHE=str(work / 'no-module-downloads'), GOFLAGS='')
    go_version = invoke([go, 'version'], work, env).stdout.strip()
    assert re.search(r'\bgo1\.23\.3\b', go_version), go_version
    if require_race:
        assert invoke([go, 'env', 'CGO_ENABLED'], work, env).stdout.strip() == '1', (
            '--race requires CGO_ENABLED=1 and a supported C compiler')
    articles = [fences(article, 'go') for article in GO_ARTICLES]
    assert [len(items) for items in articles] == [4, 7, 2, 1, 6, 7, 1, 1, 2]
    count = stress_runs = race_runs = 0
    concat_check = '''package concat
import ("strings"; "testing")
func TestResults(t *testing.T) {
    fs := []func(int, string) string{plusConcat, sprintfConcat, builderConcat, bufferConcat, byteConcat, preByteConcat, builderGrowConcat}
    for _, n := range []int{0, 1, 7} {
        for _, f := range fs {
            if got := f(n, "Go"); got != strings.Repeat("Go", n) { t.Fatalf("wrong result: %q", got) }
        }
    }
}
'''
    for article_index, items in enumerate(articles):
        cases = ['\n'.join(items)] if article_index == 0 else items
        for block_index, code in enumerate(cases):
            count += 1
            module = work / f'go-{article_index}-{block_index}'
            module.mkdir()
            (module / 'go.mod').write_text('module example.com/article\n\ngo 1.23\n', encoding='utf-8')
            benchmark = article_index == 0
            fragment = article_index == 1 and block_index >= 4
            invalid = article_index == 5 and block_index == 2
            # Add only missing package/import context to the three definition excerpts.
            if fragment:
                contexts = ['import "sort"\n', '',
                            'import "io"\ntype Reader = io.Reader\ntype Writer = io.Writer\n']
                code = 'package article\n' + contexts[block_index - 4] + code
            file = module / ('concat_test.go' if benchmark else 'main.go')
            file.write_text(code, encoding='utf-8')
            binary = module / ('example.exe' if os.name == 'nt' else 'example')
            if benchmark:
                (module / 'result_test.go').write_text(concat_check, encoding='utf-8')
                result = invoke([go, 'test', '-run', 'TestResults', '-bench', '.', '-benchmem',
                                 '-benchtime=1x', '-count=1', '-timeout=30s'], module, env)
            elif fragment:
                result = invoke([go, 'test', '.'], module, env)
            else:
                result = invoke([go, 'build', '-o', str(binary), 'main.go'], module, env, failure=invalid)
                if not invalid:
                    # Bound the actual program, rather than only its go-run parent process.
                    result = invoke([str(binary)], module, env, timeout=10)
            if invalid:
                assert 'nil' in result.stderr, result.stderr
                continue  # This article deliberately demonstrates an invalid string assignment.
            vet = invoke([go, 'vet', '.'], module, env,
                         failure=article_index == 5 and block_index == 5)
            if article_index == 5 and block_index == 5:
                assert 'one rune' in vet.stderr, vet.stderr
            output = (result.stdout + result.stderr).strip()
            if article_index == 1 and not fragment:
                expected = [
                    ['Hi, I am Mike', 'November rain', 'Guzzle Guzzle Guzzle... one glass'],
                    ['Hi, I am Mike', 'Hi, I am Tom, I work at Things Ltd.', 'Hi, I am Paul',
                     'Hi, I am Sam, I work at Golang Inc.'],
                    ['❰Bob - 39 years -  ✆ 000-7777-XXX❱'],
                    ['list[0] is an int and its value is 1', 'list[1] is a string and its value is Hello',
                     'list[2] is a Person and its value is (name: Dennis - age: 70 years)'],
                ]
                assert all(value in output for value in expected[block_index]), output
            elif article_index == 2:
                expected = ['Hi, I am Mark you can call me on 222-222-YYYY',
                            'Hi, I am Sam you can call me on 111-888-XXXX' if block_index == 0 else
                            'Hi, I am Sam, I work at Golang Inc. Call me on 111-888-XXXX']
                assert output.splitlines() == expected, output
            elif article_index == 3:
                assert output.split() == ['1', '1', '1'], output
            elif article_index == 4:
                check_channels(block_index, output)
            elif article_index == 5:
                expected = ['7', '5', None, '<nil>', '1.9320999999999997\n1.9321', 'i', '105\n105']
                assert output == expected[block_index], output
            elif article_index == 6:
                assert output == ('[1 2 3] [9 2 3]\n[9 2]\n[9 8] [9 8 3]\n'
                                  '[9 8 3] [7 8 3 4]\n0 0 true\n0 0 false'), output
            elif article_index == 7:
                assert output == 'true\ntrue\nread tcp', output
            elif article_index == 8:
                expected = 'Initialization completed' if block_index == 0 else 'consumed=30 sum=435'
                assert output == expected, output
                for procs in ('1', '2', '4'):
                    for _ in range(10):
                        actual = invoke([str(binary)], module, dict(env, GOMAXPROCS=procs), timeout=5)
                        assert actual.stdout.strip() == expected, actual.stdout
                        stress_runs += 1
                if require_race:
                    invoke([go, 'build', '-race', '-o', str(binary), '.'], module, env)
                    assert invoke([str(binary)], module, env, timeout=10).stdout.strip() == expected
                    race_runs += 1
    return {'articles': len(articles), 'source_fences': sum(map(len, articles)), 'cases': count,
            'expected_compile_failures': 1, 'definition_fragments_compiled': 3,
            'cond_scheduling_runs': stress_runs, 'race_runs': race_runs,
            'race_status': 'passed' if require_race else 'not run (use --race with CGO)',
            'version': go_version, 'module_downloads': 'disabled'}


def check_channels(index, output):
    lines = output.splitlines()
    if index == 0:
        assert sorted(int(line.split()[-1]) for line in lines) == list(range(10)), output
        assert all(('偶数' in line) == (int(line.split()[-1]) % 2 == 0) for line in lines), output
    elif index == 1:
        assert [int(line.split()[0]) for line in lines] == list(range(1, 101)), output
        assert Counter(int(line.split()[-1]) for line in lines) == Counter({i: 10 for i in range(10)}), output
    elif index == 2:
        assert output.split() == list(map(str, range(10))), output
    elif index == 3:
        assert output.split() == ['0', '1', '1', '2', '3', '5', '8', '13', '21', '34', 'quit'], output
    elif index == 4:
        assert sorted(map(int, output.strip('[]').split())) == [80, 112, 268, 296], output
    else:
        for phrase, count in [('begin assembly cycle', 3), ('worker begin part', 12),
                              ('worker completes part', 12)]:
            assert output.count(phrase) == count, output
        assert len(re.findall(r'assemble\. cycle [123] complete', output)) == 3, output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--race', action='store_true', help='Require Go race checks (needs CGO/C compiler)')
    parser.add_argument('--report', type=Path, help='Optional JSON summary path')
    args = parser.parse_args()
    env = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONDONTWRITEBYTECODE='1')
    with TemporaryDirectory(prefix='article-examples-') as temporary:
        work = Path(temporary)
        report = {'python': check_python(work, env), 'go': check_go(work, env, args.race)}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
