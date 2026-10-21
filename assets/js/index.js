/* global FlexSearch */
(function () {
  const suggestions = document.getElementById('suggestions');
  const userinput = document.getElementById('userinput');
  if (!suggestions || !userinput) return;
  let index = null;

  // Keep the crawlable document asset; build its search index only on first use.
  const ensureIndex = () => {
    if (index) return index;
    index = new FlexSearch({
      preset: 'score',
      cache: true,
      doc: {
        id: 'id',
        field: ['title', 'description', 'content'],
        store: ['href', 'title', 'description'],
      },
    });
    const docs = [
      {{ $seen := newScratch -}}
      {{ range $index, $page := (where .Site.Pages "Type" "in" (slice "blog" "tools")) -}}
        {{ if or .IsPage (and (eq .Type "tools") (eq .Kind "section")) -}}
        {{ if not ($seen.Get .RelPermalink) -}}
        {{ $seen.Set .RelPermalink true -}}
        {
          id: {{ $index }},
          href: "{{ .RelPermalink | relURL }}",
          title: {{ .Title | jsonify }},
          description: {{ .Params.description | jsonify }},
          content: {{ .Plain | jsonify }}
        },
        {{ end -}}
        {{ end -}}
      {{ end -}}
    ];
    index.add(docs);
    return index;
  };

  const hideResults = () => { suggestions.classList.add('d-none'); };
  const showResults = () => {
    const query = userinput.value.trim();
    if (!query) {
      suggestions.replaceChildren();
      hideResults();
      return;
    }
    const results = ensureIndex().search(query, 5);
    const fragment = document.createDocumentFragment();
    results.forEach((page) => {
      const entry = document.createElement('div');
      const link = document.createElement('a');
      const title = document.createElement('span');
      const description = document.createElement('span');
      link.href = page.href;
      title.textContent = page.title;
      description.textContent = page.description;
      link.append(title, description);
      entry.append(link);
      fragment.append(entry);
    });
    suggestions.replaceChildren(fragment);
    suggestions.classList.remove('d-none');
  };
  userinput.addEventListener('focus', () => {
    ensureIndex();
    if (userinput.value.trim()) showResults();
  });
  userinput.addEventListener('input', showResults);
  suggestions.addEventListener('click', hideResults);
  document.addEventListener('click', (event) => {
    if (event.target !== userinput && !suggestions.contains(event.target)) hideResults();
  });
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const editing = target && (target.matches('input, textarea, select') || target.isContentEditable);
    if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      userinput.focus();
      return;
    }
    const inSearch = document.activeElement === userinput || suggestions.contains(document.activeElement);
    if (event.key === 'Escape' && inSearch) {
      document.activeElement.blur();
      hideResults();
      return;
    }
    if (!inSearch || suggestions.classList.contains('d-none') || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const links = Array.from(suggestions.querySelectorAll('a'));
    if (!links.length) return;
    const current = links.indexOf(document.activeElement);
    const next = event.key === 'ArrowUp'
      ? Math.max(current - 1, 0)
      : Math.min(current + 1, links.length - 1);
    event.preventDefault();
    links[next].focus();
  });
  // A visitor may focus/type before this deferred asset finishes downloading.
  if (document.activeElement === userinput) {
    ensureIndex();
    if (userinput.value.trim()) showResults();
  }
}());
