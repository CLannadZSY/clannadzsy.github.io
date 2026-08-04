const parseImageList = (input, limit = 100) => {
  const value = input.trim();
  if (!value) throw new Error('请先输入图片链接。');

  let items;
  if (value.startsWith('[')) {
    try {
      items = JSON.parse(value);
    } catch (error) {
      throw new Error(`图片列表 JSON 格式错误：${error.message}`);
    }
    if (!Array.isArray(items)) throw new Error('JSON 内容必须是图片链接数组。');
  } else {
    items = value.split(/\r?\n/);
  }

  const links = items.map((item, index) => {
    if (typeof item !== 'string') throw new Error(`第 ${index + 1} 项必须是字符串。`);
    return item.trim();
  }).filter(Boolean);

  if (!links.length) throw new Error('没有找到有效的图片链接。');

  const urls = links.slice(0, limit).map((link, index) => {
    let url;
    try {
      url = new URL(link);
    } catch (error) {
      throw new Error(`第 ${index + 1} 个图片链接无效。`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`第 ${index + 1} 个图片链接只支持 HTTP 或 HTTPS。`);
    }
    return url.href;
  });

  return { total: links.length, urls };
};

const imageListParser = { parseImageList };

if (typeof window === 'undefined') global.imageListParser = imageListParser;
else window.imageListParser = imageListParser;
