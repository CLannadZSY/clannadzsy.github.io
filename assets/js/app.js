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
}
