(() => {
  const adContainers = document.querySelectorAll('[data-ad-container]');
  const comments = document.querySelectorAll('[data-comments-container]');
  if (!adContainers.length && !comments.length) return;

  let adLibrary;
  const loadAdLibrary = () => {
    if (!adLibrary) {
      adLibrary = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7158791715796373';
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', reject, { once: true });
        document.head.appendChild(script);
      });
    }
    return adLibrary;
  };

  const loadAd = (container) => {
    const unit = container.querySelector('.adsbygoogle');
    if (!unit || container.dataset.embedState) return;
    container.dataset.embedState = 'loading';
    loadAdLibrary().then(() => {
      if (!unit.hasAttribute('data-adsbygoogle-status')) {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      }
      container.dataset.embedState = 'loaded';
    }).catch(() => {
      // Keep the reserved space when blocked or unfilled, avoiding another layout shift.
      container.dataset.embedState = 'unavailable';
    });
  };

  const loadComments = (container) => {
    const mount = container.querySelector('[data-comments-mount]');
    if (!mount || container.dataset.embedState) return;
    container.dataset.embedState = 'loading';
    const script = document.createElement('script');
    script.src = 'https://utteranc.es/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('repo', mount.dataset.repo);
    script.setAttribute('issue-term', mount.dataset.issueTerm);
    script.setAttribute('theme', mount.dataset.theme);
    script.addEventListener('load', () => { container.dataset.embedState = 'loaded'; }, { once: true });
    script.addEventListener('error', () => { container.dataset.embedState = 'unavailable'; }, { once: true });
    mount.appendChild(script);
  };

  const observe = (containers, load) => {
    if (!containers.length) return;
    if (!('IntersectionObserver' in window)) {
      containers.forEach(load);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        load(entry.target);
      });
    }, { rootMargin: '300px 0px' });
    containers.forEach((container) => { observer.observe(container); });
  };

  const start = () => {
    const initialize = () => {
      observe(adContainers, loadAd);
      observe(comments, loadComments);
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(initialize, { timeout: 1500 });
    else window.setTimeout(initialize, 200);
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
