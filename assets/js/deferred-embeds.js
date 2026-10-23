(() => {
  const comments = document.querySelectorAll('[data-comments-container]');
  if (!comments.length) return;

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
      observe(comments, loadComments);
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(initialize, { timeout: 1500 });
    else window.setTimeout(initialize, 200);
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
