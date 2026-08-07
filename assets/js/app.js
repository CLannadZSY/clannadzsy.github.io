const jsonTool = document.querySelector('[data-json-tool]');

if (jsonTool) {
  const tabs = jsonTool.querySelectorAll('[data-tool-tab]');
  const panels = jsonTool.querySelectorAll('[data-tool-panel]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle('active', active);
        if (active) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      });
      panels.forEach((panel) => { panel.hidden = panel.dataset.toolPanel !== tab.dataset.toolTab; });
      if (tab.dataset.toolTab === 'proxy') checkProxyService();
    });
  });

  const input = document.getElementById('json-input');
  const output = document.getElementById('json-output');
  const formatButton = document.getElementById('json-format');
  const copyButton = document.getElementById('json-copy');
  const copyLabel = copyButton.querySelector('span');
  const message = document.getElementById('json-message');
  let formatted = '';

  formatButton.addEventListener('click', () => {
    if (!input.value.trim()) {
      formatted = '';
      output.textContent = '';
      copyButton.disabled = true;
      message.textContent = '请先输入 JSON 数据。';
      return;
    }

    try {
      formatted = JSON.stringify(window.parseLooseJson(input.value), null, 2);
      output.className = 'language-json';
      output.textContent = formatted;
      window.hljs.highlightBlock(output);
      copyButton.disabled = false;
      message.textContent = '';
    } catch (error) {
      formatted = '';
      output.textContent = '';
      copyButton.disabled = true;
      message.textContent = `JSON 格式错误：${error.message}`;
    }
  });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      copyLabel.textContent = '已复制';
      setTimeout(() => { copyLabel.textContent = '复制'; }, 1500);
    } catch (error) {
      message.textContent = '复制失败，请手动选择结果复制。';
    }
  });

  const curlInput = document.getElementById('curl-input');
  const curlOutput = document.getElementById('curl-output');
  const convertButton = document.getElementById('curl-convert');
  const curlCopyButton = document.getElementById('curl-copy');
  const curlCopyLabel = curlCopyButton.querySelector('span');
  const curlMessage = document.getElementById('curl-message');
  let requestsCode = '';

  convertButton.addEventListener('click', () => {
    if (!curlInput.value.trim()) {
      requestsCode = '';
      curlOutput.textContent = '';
      curlCopyButton.disabled = true;
      curlMessage.textContent = '请先输入 cURL 命令。';
      return;
    }

    try {
      requestsCode = window.convertCurlToRequests(curlInput.value);
      curlOutput.className = 'language-python';
      curlOutput.textContent = requestsCode;
      window.hljs.highlightBlock(curlOutput);
      curlCopyButton.disabled = false;
      curlMessage.textContent = '';
    } catch (error) {
      requestsCode = '';
      curlOutput.textContent = '';
      curlCopyButton.disabled = true;
      curlMessage.textContent = error.message;
    }
  });

  curlCopyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(requestsCode);
      curlCopyLabel.textContent = '已复制';
      setTimeout(() => { curlCopyLabel.textContent = '复制'; }, 1500);
    } catch (error) {
      curlMessage.textContent = '复制失败，请手动选择结果复制。';
    }
  });

  const passwordTypeButtons = jsonTool.querySelectorAll('[data-password-type]');
  const passwordLengthInput = document.getElementById('password-length');
  const passwordLengthLabel = document.getElementById('password-length-label');
  const passwordLengthValue = document.getElementById('password-length-value');
  const passwordToggles = document.getElementById('password-toggles');
  const passwordNumbers = document.getElementById('password-numbers');
  const passwordSymbols = document.getElementById('password-symbols');
  const passwordOutput = document.getElementById('password-output');
  const passwordCopyButton = document.getElementById('password-copy');
  const passwordRefreshButton = document.getElementById('password-refresh');
  const passwordMessage = document.getElementById('password-message');
  const passwordSettings = {
    random: { label: '字符数', min: 8, max: 64, value: 20 },
    memorable: { label: '单词数', min: 3, max: 8, value: 4 },
    pin: { label: '位数', min: 4, max: 12, value: 6 },
  };
  let passwordType = 'random';
  let generatedPassword = '';

  const generatePassword = () => {
    const length = Number.parseInt(passwordLengthInput.value, 10);

    try {
      if (passwordType === 'random') {
        generatedPassword = window.passwordGenerator.randomPassword(length, passwordNumbers.checked, passwordSymbols.checked);
      } else if (passwordType === 'memorable') {
        generatedPassword = window.passwordGenerator.memorablePassword(length);
      } else {
        generatedPassword = window.passwordGenerator.pin(length);
      }

      passwordOutput.textContent = generatedPassword;
      passwordMessage.textContent = '';
    } catch (error) {
      generatedPassword = '';
      passwordOutput.textContent = '';
      passwordMessage.textContent = error.message;
    }
  };

  const setPasswordType = (type) => {
    passwordSettings[passwordType].value = Number.parseInt(passwordLengthInput.value, 10);
    passwordType = type;
    const settings = passwordSettings[type];

    passwordTypeButtons.forEach((button) => {
      const active = button.dataset.passwordType === type;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    passwordLengthLabel.textContent = settings.label;
    passwordLengthInput.min = settings.min;
    passwordLengthInput.max = settings.max;
    passwordLengthInput.value = settings.value;
    passwordLengthValue.textContent = settings.value;
    passwordToggles.hidden = type !== 'random';
    generatePassword();
  };

  passwordTypeButtons.forEach((button) => {
    button.addEventListener('click', () => { setPasswordType(button.dataset.passwordType); });
  });

  passwordLengthInput.addEventListener('input', () => {
    passwordLengthValue.textContent = passwordLengthInput.value;
    passwordSettings[passwordType].value = Number.parseInt(passwordLengthInput.value, 10);
    generatePassword();
  });

  passwordNumbers.addEventListener('change', generatePassword);
  passwordSymbols.addEventListener('change', generatePassword);
  passwordRefreshButton.addEventListener('click', generatePassword);

  passwordCopyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      passwordCopyButton.textContent = '已复制';
      setTimeout(() => { passwordCopyButton.textContent = '复制密码'; }, 1500);
    } catch (error) {
      passwordMessage.textContent = '复制失败，请手动选择密码复制。';
    }
  });

  generatePassword();

  const imageListInput = document.getElementById('image-list-input');
  const imageListButton = document.getElementById('image-list-show');
  const imageListMessage = document.getElementById('image-list-message');
  const imagePreviewGrid = document.getElementById('image-preview-grid');

  imageListButton.addEventListener('click', () => {
    try {
      const { total, urls } = window.imageListParser.parseImageList(imageListInput.value);
      const fragment = document.createDocumentFragment();

      urls.forEach((url, index) => {
        const item = document.createElement('figure');
        const image = document.createElement('img');
        const caption = document.createElement('figcaption');
        image.src = url;
        image.alt = `第 ${index + 1} 张图片`;
        image.loading = 'lazy';
        image.decoding = 'async';
        caption.textContent = `${index + 1}`;
        item.append(image, caption);
        fragment.append(item);
      });

      imagePreviewGrid.replaceChildren(fragment);
      imageListMessage.classList.add('success');
      imageListMessage.textContent = total > urls.length
        ? `共 ${total} 个链接，仅显示前 ${urls.length} 张。`
        : `已显示 ${urls.length} 张图片。`;
    } catch (error) {
      imagePreviewGrid.replaceChildren();
      imageListMessage.classList.remove('success');
      imageListMessage.textContent = error.message;
    }
  });

  const timestampTool = document.getElementById('timestamp-tool');
  const timestampModeButtons = timestampTool.querySelectorAll('[data-timestamp-mode]');
  const timestampViews = timestampTool.querySelectorAll('[data-timestamp-view]');
  const timestampTimezone = document.getElementById('timestamp-timezone');
  const timestampTimezones = document.getElementById('timestamp-timezones');
  const timestampInput = document.getElementById('timestamp-input');
  const timestampUnit = document.getElementById('timestamp-unit');
  const timestampDetectedUnit = document.getElementById('timestamp-detected-unit');
  const timestampNow = document.getElementById('timestamp-now');
  const timestampDate = document.getElementById('timestamp-date');
  const timestampTime = document.getElementById('timestamp-time');
  const timestampMessage = document.getElementById('timestamp-message');
  const timestampOutputs = {
    seconds: document.getElementById('timestamp-seconds'),
    milliseconds: document.getElementById('timestamp-milliseconds'),
    iso: document.getElementById('timestamp-iso'),
    local: document.getElementById('timestamp-local'),
    relative: document.getElementById('timestamp-relative'),
  };
  const timestampBatchInput = document.getElementById('timestamp-batch-input');
  const timestampBatchMessage = document.getElementById('timestamp-batch-message');
  const timestampBatchClear = document.getElementById('timestamp-batch-clear');
  const timestampBatchConvert = document.getElementById('timestamp-batch-convert');
  const timestampBatchCopy = document.getElementById('timestamp-batch-copy');
  const timestampBatchExport = document.getElementById('timestamp-batch-export');
  const timestampBatchBody = document.getElementById('timestamp-batch-body');
  let timestampSource = 'timestamp';
  let timestampEpoch = Date.now();
  let timestampBatchResults = [];

  const timestampErrorMessage = (error) => (
    error instanceof RangeError ? '请输入有效的 IANA 时区，例如 Asia/Shanghai' : error.message
  );

  const timestampZone = () => timestampTimezone.value.trim() || 'browser';

  const setTimestampMessage = (message = '', warning = false) => {
    timestampMessage.textContent = message;
    timestampMessage.classList.toggle('warning', warning);
  };

  const renderTimestamp = (epochMs, updateTimestamp, warning = '') => {
    const formatted = window.timestampConverter.format(epochMs, timestampZone());
    timestampEpoch = epochMs;
    timestampDate.value = formatted.date;
    timestampTime.value = formatted.time;
    if (updateTimestamp) {
      const milliseconds = timestampUnit.value === 'milliseconds';
      timestampInput.value = milliseconds ? formatted.milliseconds : formatted.seconds;
      timestampDetectedUnit.textContent = `当前单位：${milliseconds ? '毫秒' : '秒'}`;
    }
    timestampOutputs.seconds.textContent = formatted.seconds;
    timestampOutputs.milliseconds.textContent = formatted.milliseconds;
    timestampOutputs.iso.textContent = formatted.iso;
    timestampOutputs.local.textContent = formatted.local;
    timestampOutputs.relative.textContent = window.timestampConverter.relative(epochMs);
    setTimestampMessage(warning, Boolean(warning));
  };

  const renderTimestampInput = () => {
    if (!timestampInput.value.trim()) return;
    try {
      const parsed = window.timestampConverter.parse(timestampInput.value, timestampUnit.value);
      timestampSource = 'timestamp';
      timestampDetectedUnit.textContent = `自动识别：${parsed.unit === 'milliseconds' ? '毫秒' : '秒'}`;
      renderTimestamp(parsed.epochMs, false);
    } catch (error) {
      setTimestampMessage(timestampErrorMessage(error));
    }
  };

  const renderTimestampDate = () => {
    if (!timestampDate.value || !timestampTime.value) return;
    try {
      const parsed = window.timestampConverter.fromLocal(timestampDate.value, timestampTime.value, timestampZone());
      timestampSource = 'datetime';
      renderTimestamp(parsed.epochMs, true, parsed.warning);
    } catch (error) {
      setTimestampMessage(timestampErrorMessage(error));
    }
  };

  window.timestampConverter.timeZones().forEach((timeZone) => {
    const option = document.createElement('option');
    option.value = timeZone;
    timestampTimezones.append(option);
  });
  const browserTimezone = document.createElement('option');
  browserTimezone.value = 'browser';
  browserTimezone.label = '浏览器本地时区';
  timestampTimezones.prepend(browserTimezone);

  timestampModeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      timestampModeButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      timestampViews.forEach((view) => { view.hidden = view.dataset.timestampView !== button.dataset.timestampMode; });
    });
  });

  timestampInput.addEventListener('input', renderTimestampInput);
  timestampDate.addEventListener('input', renderTimestampDate);
  timestampTime.addEventListener('input', renderTimestampDate);
  timestampUnit.addEventListener('change', () => {
    if (timestampSource === 'datetime') renderTimestamp(timestampEpoch, true);
    else renderTimestampInput();
  });
  timestampTimezone.addEventListener('input', () => {
    if (timestampSource === 'datetime') renderTimestampDate();
    else renderTimestampInput();
  });
  timestampNow.addEventListener('click', () => {
    timestampUnit.value = 'auto';
    timestampInput.value = Math.floor(Date.now() / 1000);
    renderTimestampInput();
  });

  timestampTool.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-timestamp-copy]');
    if (!button) return;
    const target = button.dataset.timestampCopy;
    const element = target === 'datetime' ? null : document.getElementById(target);
    const value = target === 'datetime'
      ? `${timestampDate.value} ${timestampTime.value}`
      : element.value || element.textContent;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      const label = button.textContent;
      button.textContent = '已复制';
      setTimeout(() => { button.textContent = label; }, 1200);
    } catch (error) {
      setTimestampMessage('复制失败，请手动复制');
    }
  });

  const parseTimestampBatchLine = (line) => {
    if (/^-?\d+(?:\.\d+)?$/.test(line)) {
      const parsed = window.timestampConverter.parse(line);
      return window.timestampConverter.format(parsed.epochMs, timestampZone()).local;
    }
    const match = /^(\d{4,}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/.exec(line);
    if (!match) throw new Error('格式无效');
    const parsed = window.timestampConverter.fromLocal(match[1], match[2], timestampZone());
    const formatted = window.timestampConverter.format(parsed.epochMs, timestampZone());
    return `${formatted.seconds} s / ${formatted.milliseconds} ms${parsed.warning ? `（${parsed.warning}）` : ''}`;
  };

  const renderTimestampBatch = () => {
    const fragment = document.createDocumentFragment();
    timestampBatchResults.forEach((result) => {
      const row = document.createElement('tr');
      [result.input, result.output || result.error, result.error ? '失败' : '成功'].forEach((value, index) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (index < 2) cell.classList.add('timestamp-table-value');
        if (index === 2) cell.className = result.error ? 'danger' : 'success';
        row.append(cell);
      });
      fragment.append(row);
    });
    if (!timestampBatchResults.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 3;
      cell.className = 'timestamp-table-empty';
      cell.textContent = '输入内容后点击“转换”';
      row.append(cell);
      fragment.append(row);
    }
    timestampBatchBody.replaceChildren(fragment);
    timestampBatchCopy.disabled = !timestampBatchResults.some((result) => !result.error);
    timestampBatchExport.disabled = !timestampBatchResults.length;
  };

  timestampBatchConvert.addEventListener('click', () => {
    const lines = timestampBatchInput.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
      timestampBatchMessage.textContent = '请先输入需要转换的内容';
      return;
    }
    if (lines.length > 500) {
      timestampBatchMessage.textContent = '一次最多转换 500 行';
      return;
    }
    timestampBatchResults = lines.map((line) => {
      try {
        return { input: line, output: parseTimestampBatchLine(line), error: '' };
      } catch (error) {
        return { input: line, output: '', error: timestampErrorMessage(error) };
      }
    });
    const failed = timestampBatchResults.filter((result) => result.error).length;
    timestampBatchMessage.textContent = `已转换 ${lines.length} 行，失败 ${failed} 行`;
    renderTimestampBatch();
  });

  timestampBatchClear.addEventListener('click', () => {
    timestampBatchInput.value = '';
    timestampBatchMessage.textContent = '';
    timestampBatchResults = [];
    renderTimestampBatch();
    timestampBatchInput.focus();
  });

  timestampBatchCopy.addEventListener('click', async () => {
    const value = timestampBatchResults.filter((result) => !result.error).map((result) => result.output).join('\n');
    try {
      await navigator.clipboard.writeText(value);
      timestampBatchCopy.textContent = '已复制';
      setTimeout(() => { timestampBatchCopy.textContent = '复制结果'; }, 1200);
    } catch (error) {
      timestampBatchMessage.textContent = '复制失败，请手动复制';
    }
  });

  timestampBatchExport.addEventListener('click', () => {
    const csv = [['输入', '转换结果', '状态']].concat(timestampBatchResults.map((result) => (
      [result.input, result.output || result.error, result.error ? '失败' : '成功']
    ))).map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `timestamp-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  });

  timestampInput.value = Math.floor(timestampEpoch / 1000);
  renderTimestampInput();
  renderTimestampBatch();

  const proxyApi = 'https://proxy-check.clannad.icu';
  const proxyInput = document.getElementById('proxy-list-input');
  const proxyCount = document.getElementById('proxy-list-count');
  const proxyType = document.getElementById('proxy-type');
  const proxyTimeout = document.getElementById('proxy-timeout');
  const proxyConcurrency = document.getElementById('proxy-concurrency');
  const proxyClear = document.getElementById('proxy-clear');
  const proxyStart = document.getElementById('proxy-start');
  const proxyStartLabel = document.getElementById('proxy-start-label');
  const proxyMessage = document.getElementById('proxy-message');
  const proxyServiceStatus = document.getElementById('proxy-service-status');
  const proxyTotal = document.getElementById('proxy-total');
  const proxySuccess = document.getElementById('proxy-success');
  const proxyFailed = document.getElementById('proxy-failed');
  const proxyResultsBody = document.getElementById('proxy-results-body');
  const proxyCopy = document.getElementById('proxy-copy');
  const proxyExport = document.getElementById('proxy-export');
  const proxyFilters = jsonTool.querySelectorAll('[data-proxy-filter]');
  let proxyResults = [];
  let proxyFilter = 'all';

  const proxyLines = () => proxyInput.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const updateProxyCount = () => {
    proxyCount.textContent = `${proxyLines().length} 条 · 每行一个`;
  };

  const setProxyServiceStatus = (connected) => {
    proxyServiceStatus.classList.toggle('connected', connected);
    proxyServiceStatus.querySelector('span:last-child').textContent = connected
      ? 'Cloudflare 检测服务已连接'
      : 'Cloudflare 检测服务未连接';
  };

  const checkProxyService = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`${proxyApi}/health`, { signal: controller.signal });
      setProxyServiceStatus(response.ok);
      return response.ok;
    } catch (error) {
      setProxyServiceStatus(false);
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  const appendProxyCell = (row, value, className = '') => {
    const cell = document.createElement('td');
    cell.textContent = value;
    if (className) cell.className = className;
    row.append(cell);
    return cell;
  };

  const renderProxyResults = () => {
    const available = proxyResults.filter((result) => result.success);
    const failed = proxyResults.length - available.length;
    const visible = proxyResults.filter((result) => (
      proxyFilter === 'all'
      || (proxyFilter === 'success' && result.success)
      || (proxyFilter === 'failed' && !result.success)
    ));

    proxyTotal.textContent = proxyResults.length;
    proxySuccess.textContent = available.length;
    proxyFailed.textContent = failed;
    proxyCopy.disabled = available.length === 0;
    proxyExport.disabled = proxyResults.length === 0;

    const fragment = document.createDocumentFragment();
    visible.forEach((result) => {
      const row = document.createElement('tr');
      row.className = result.success ? 'proxy-result-success' : 'proxy-result-failed';
      const status = appendProxyCell(row, result.success ? '● 可用' : '● 失败', 'proxy-result-status');
      status.title = result.error || '';
      appendProxyCell(row, result.type || '-');
      appendProxyCell(row, result.proxy, 'proxy-address');
      appendProxyCell(row, result.auth ? '是' : '否');
      appendProxyCell(row, result.success ? `${result.latency_ms} ms` : '-');
      const exitIp = appendProxyCell(row, result.success ? result.exit_ip : (result.error || '-'), result.success ? '' : 'proxy-error');
      exitIp.title = result.error || '';
      fragment.append(row);
    });

    if (!visible.length) {
      const row = document.createElement('tr');
      row.className = 'proxy-empty-row';
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = proxyResults.length ? '当前筛选下没有结果' : '点击“开始验证”查看批量结果';
      row.append(cell);
      fragment.append(row);
    }
    proxyResultsBody.replaceChildren(fragment);
  };

  proxyInput.addEventListener('input', updateProxyCount);

  proxyClear.addEventListener('click', () => {
    proxyInput.value = '';
    proxyResults = [];
    proxyMessage.textContent = '';
    proxyMessage.classList.remove('success');
    updateProxyCount();
    renderProxyResults();
    proxyInput.focus();
  });

  proxyStart.addEventListener('click', async () => {
    const proxies = proxyLines();
    if (!proxies.length) {
      proxyMessage.textContent = '请先输入代理地址。';
      proxyMessage.classList.remove('success');
      return;
    }
    if (proxies.length > 500) {
      proxyMessage.textContent = '一次最多验证 500 个代理。';
      proxyMessage.classList.remove('success');
      return;
    }

    proxyStart.disabled = true;
    proxyStartLabel.textContent = '验证中…';
    proxyMessage.textContent = `正在验证 ${proxies.length} 个代理，请稍候。`;
    proxyMessage.classList.remove('success');

    let serviceReachable = false;
    const checkOne = async (proxy) => {
      try {
        const response = await fetch(`${proxyApi}/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proxy,
            proxy_type: proxyType.value,
            timeout: Number.parseInt(proxyTimeout.value, 10),
          }),
        });
        serviceReachable = true;
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '检测服务返回错误。');
        return data.result;
      } catch (error) {
        return {
          proxy,
          success: false,
          type: '-',
          auth: proxy.includes('@'),
          latency_ms: 0,
          exit_ip: '',
          error: error.message,
        };
      }
    };

    try {
      proxyResults = await window.proxyChecker.mapConcurrent(
        proxies,
        Number.parseInt(proxyConcurrency.value, 10),
        checkOne,
      );
      renderProxyResults();
      setProxyServiceStatus(serviceReachable);
      proxyMessage.classList.toggle('success', serviceReachable);
      proxyMessage.textContent = serviceReachable
        ? `验证完成：${proxyResults.filter((result) => result.success).length} 个可用。`
        : '无法连接 Cloudflare 检测服务，请先部署 Worker。';
    } catch (error) {
      setProxyServiceStatus(false);
      proxyMessage.classList.remove('success');
      proxyMessage.textContent = `无法完成验证：${error.message}`;
    } finally {
      proxyStart.disabled = false;
      proxyStartLabel.textContent = '▷ 开始验证';
    }
  });

  proxyFilters.forEach((button) => {
    button.addEventListener('click', () => {
      proxyFilter = button.dataset.proxyFilter;
      proxyFilters.forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      renderProxyResults();
    });
  });

  proxyCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(proxyResults.filter((result) => result.success).map((result) => result.proxy).join('\n'));
      proxyCopy.textContent = '已复制';
      setTimeout(() => { proxyCopy.textContent = '复制可用'; }, 1500);
    } catch (error) {
      proxyMessage.classList.remove('success');
      proxyMessage.textContent = '复制失败，请手动选择可用代理复制。';
    }
  });

  proxyExport.addEventListener('click', () => {
    const escapeCsv = (value) => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
    const rows = [['状态', '类型', '代理地址', '认证', '延迟(ms)', '出口 IP', '错误']].concat(proxyResults.map((result) => [
      result.success ? '可用' : '失败',
      result.type,
      result.proxy,
      result.auth ? '是' : '否',
      result.success ? result.latency_ms : '',
      result.exit_ip,
      result.error,
    ]));
    const blob = new Blob([`\ufeff${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `proxy-check-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  });

  updateProxyCount();
  renderProxyResults();
  checkProxyService();
}
