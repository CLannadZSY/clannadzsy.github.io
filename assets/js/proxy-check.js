const mapConcurrent = async (items, limit, task) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

const proxyChecker = { mapConcurrent };

if (typeof window === 'undefined') global.proxyChecker = proxyChecker;
else window.proxyChecker = proxyChecker;
