/* Study Hub app: routing, views, progress, vault notebook, articles, search.
   URLs are routes: #/page[/id[/section]] (for example #/cases/netflix or #/articles/c10).
   Hash routes work from a local file and on any static host without server rewrites.
   Content comes from data/*.js. Every file except hub.js is optional: views render without it. */
(() => {
  'use strict';

  /* ---------- data ---------- */
  const H = window.HUB || { phases: [], resources: {}, toolGroups: [], labs: [], patterns: {} };
  const TRACKS = window.HUB_TRACKS || [];
  const CASES = window.HUB_CASES || [];
  const TO = window.HUB_TRADEOFFS || { guides: [], tools: {}, patterns: {} };
  const AWS = window.HUB_AWS || { groups: [], guides: [] };
  const FULL_GUIDES = new Map((window.HUB_GUIDES || []).map(g => [g.id, g]));
  const GUIDES = [...(TO.guides || []), ...(AWS.guides || [])].map(g => FULL_GUIDES.get(g.id) || g);
  const DB = window.HUB_DB || { types: [] };
  const DBT = DB.types || [];
  const dbById = new Map(DBT.map(t => [t.id, t]));
  const DEEP = window.HUB_DEEP || [];
  const deepById = new Map(DEEP.map(d => [d.id, d]));
  /* pattern names used elsewhere in the hub that have a deep dive */
  const DEEP_OF = [['Saga', 'saga'], ['Two-phase commit', 'two-phase-commit'], ['Transactional outbox', 'outbox-inbox'], ['Inbox (idempotent consumer)', 'outbox-inbox'], ['Idempotent consumer', 'outbox-inbox'],
    ['Idempotency key', 'idempotency-keys'], ['CQRS', 'cqrs'], ['Event sourcing', 'event-sourcing'], ['Change data capture', 'change-data-capture'], ['Strangler fig', 'strangler-fig'],
    ['Circuit breaker', 'circuit-breaker'], ['Bulkhead', 'circuit-breaker'], ['Retry with backoff and jitter', 'circuit-breaker'], ['Rate limiting', 'rate-limiting'], ['Load shedding', 'load-shedding-backpressure'],
    ['Backpressure', 'load-shedding-backpressure'], ['Leader election', 'leader-election-fencing'], ['Consistent hashing', 'sharding-consistent-hashing'], ['Sharding', 'sharding-consistent-hashing'], ['Cache-aside', 'cache-aside-stampede']]
    .filter(([, id]) => deepById.has(id));
  const deepFor = text => { const t = strip(text).toLowerCase(); const hit = DEEP_OF.find(([n]) => t.includes(n.toLowerCase())); return hit ? deepById.get(hit[1]) : null; };
  const Q = window.VAULT_QUESTIONS || [];
  const CATS = window.VAULT_CATS || [];
  const ANS = window.VAULT_ANSWERS || {};
  const RES = H.resources || {};
  const ICONS = window.HUB_ICONS || {};
  const qById = Object.fromEntries(Q.map(q => [q.id, q]));

  /* ---------- storage ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  const K = { theme: 'sdhub.theme', topics: 'sdhub.topics.v1', vault: 'sdhub.vault.v1', start: 'sdhub.start.v1', hld: 'sdhub.hldview' };
  const done = store.get(K.topics, {});
  const notes = store.get(K.vault, {});
  let storageOk = store.set('sdhub.probe', 1);

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const strip = s => String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const icon = (name, cls = 'size-4') => `<svg class="${cls} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const DIFF = { Fundamental: 'chip-fund', Intermediate: 'chip-inter', Advanced: 'chip-adv' };
  const STATUS = [['todo', 'To do'], ['draft', 'Drafted'], ['sure', 'Confident'], ['again', 'Revisit']];

  /* ---------- routes ---------- */
  const to = (...parts) => `#/${parts.filter(p => p !== undefined && p !== null && p !== '').join('/')}`;
  const phaseKey = p => (p ? `p${p.n}` : '');
  const phaseByKey = k => H.phases.find(p => `p${p.n}` === k);
  const phaseByN = n => H.phases.find(p => p.n === n);
  const topicHome = new Map();
  H.phases.forEach(p => p.topics.forEach(t => topicHome.set(t.id, to('roadmap', phaseKey(p), t.id))));
  ((H.lld && H.lld.steps) || []).forEach(s => topicHome.set(s.id, to('roadmap', 'lld', s.id)));
  TRACKS.forEach(t => t.topics.forEach(x => topicHome.set(x.id, to('tracks', t.id, x.id))));
  const phaseHref = p => (p ? to('roadmap', phaseKey(p)) : to('roadmap'));

  /* ---------- progress ---------- */
  const lldSteps = () => (H.lld && H.lld.steps) || [];
  const countDone = list => list.filter(t => done[t.id]).length;
  const pctOf = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const statusOf = id => {
    const n = notes[id];
    if (!n) return 'todo';
    return n.status || (n.text && n.text.trim() ? 'draft' : 'todo');
  };
  const roadTopics = () => [...H.phases.flatMap(p => p.topics), ...lldSteps()];
  const allTrackTopics = () => TRACKS.flatMap(t => t.topics);
  const trackById = id => TRACKS.find(t => t.id === id);
  const catQs = key => { const c = CATS.find(x => x.key === key); return c ? Q.filter(q => q.category === c.name) : []; };
  const answered = list => list.filter(q => statusOf(q.id) !== 'todo').length;

  function tally(key) {
    const [kind, id] = key.split(':');
    if (kind === 'road') { const l = roadTopics(); return [countDone(l), l.length]; }
    if (kind === 'tracks') { const l = allTrackTopics(); return [countDone(l), l.length]; }
    if (kind === 'vault') return [answered(Q), Q.length];
    if (kind === 'phase') { const p = phaseByKey(id); return p ? [countDone(p.topics), p.topics.length] : [0, 0]; }
    if (kind === 'track') { const t = trackById(id); return t ? [countDone(t.topics), t.topics.length] : [0, 0]; }
    if (kind === 'lld') { const l = lldSteps(); return [countDone(l), l.length]; }
    if (kind === 'cat') { const l = catQs(id); return [answered(l), l.length]; }
    return [0, 0];
  }
  const ringValue = key => { const [a, b] = tally(key); return pctOf(a, b); };
  const currentPhase = () => H.phases.find(p => countDone(p.topics) < p.topics.length) || H.phases[H.phases.length - 1];

  const ring = (key, cls = 'size-10', stroke = 3.4) => {
    const v = ringValue(key);
    return `<svg class="pring ${cls}" viewBox="0 0 36 36" data-ring="${key}" data-done="${v >= 100}" aria-hidden="true"><circle class="pring-track" cx="18" cy="18" r="15.915" stroke-width="${stroke}"/><circle class="pring-fill" cx="18" cy="18" r="15.915" stroke-width="${stroke}" stroke-dasharray="${v} 100" stroke-opacity="${v > 0 ? 1 : 0}" transform="rotate(-90 18 18)"/></svg>`;
  };
  const ringWithPct = (key, size = 'size-14', text = 'text-[0.7rem]') =>
    `<div class="relative grid ${size} shrink-0 place-items-center">${ring(key, `absolute inset-0 ${size}`, 3.2)}<span class="num ${text} font-semibold" data-pct="${key}">${ringValue(key)}%</span></div>`;

  function refreshProgress() {
    $$('[data-ring]').forEach(el => {
      const v = ringValue(el.dataset.ring);
      const f = el.querySelector('.pring-fill');
      f.setAttribute('stroke-dasharray', `${v} 100`);
      f.setAttribute('stroke-opacity', v > 0 ? 1 : 0);
      el.dataset.done = String(v >= 100);
    });
    $$('[data-count]').forEach(el => { const [a, b] = tally(el.dataset.count); el.textContent = `${a}/${b}`; });
    $$('[data-pct]').forEach(el => { el.textContent = `${ringValue(el.dataset.pct)}%`; });
  }

  /* ---------- dates ---------- */
  const DAY = 864e5;
  const startDate = () => {
    const d = new Date(`${store.get(K.start, H.start) || H.start}T00:00:00`);
    return isNaN(d) ? new Date(`${H.start}T00:00:00`) : d;
  };
  const fmtDate = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  function phaseDates() {
    const s = startDate();
    let w = 0;
    const out = {};
    H.phases.forEach(p => {
      const a = new Date(s.getTime() + w * 7 * DAY);
      const b = new Date(s.getTime() + ((w + p.weekends - 1) * 7 + 1) * DAY);
      out[p.id] = `${fmtDate(a)} - ${fmtDate(b)}`;
      w += p.weekends;
    });
    return out;
  }

  /* ---------- building blocks ---------- */
  const resOf = r => (typeof r === 'string' ? RES[r] : r);
  const learn = list => {
    const items = (list || []).map(resOf).filter(Boolean);
    if (!items.length) return '';
    return `<div class="learn"><span class="eyebrow">Learn</span>${items.map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.t)}</a>`).join('')}</div>`;
  };
  const usage = (use, avoid, cost, useLabel = 'Use') => (use || avoid || cost
    ? `<div class="usage">${use ? `<p><span class="k k-use">${useLabel}</span>${use}</p>` : ''}${avoid ? `<p><span class="k k-avoid">Avoid</span>${avoid}</p>` : ''}${cost ? `<p><span class="k k-cost">Trade-off</span>${cost}</p>` : ''}</div>`
    : '');
  const head = (eyebrow, title, lede, extra = '') =>
    `<header class="mb-8 flex flex-col gap-3 sm:mb-10"><p class="eyebrow">${eyebrow}</p><h1 class="title-xl">${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}${extra}</header>`;
  const section = (id, title, sub = '') =>
    `<div class="mt-14 mb-5 flex scroll-mt-24 flex-col gap-1.5 first:mt-0" id="${id}" data-toc="${esc(strip(title))}"><h2 class="title-lg">${title}</h2>${sub ? `<p class="text-sm text-ink-3">${sub}</p>` : ''}</div>`;
  const back = (href, label) => `<a href="${href}" class="mb-6 inline-flex items-center gap-1.5 rounded-lg text-sm text-ink-3 hover:text-accent">${icon('arrow-left', 'size-4')} ${label}</a>`;
  const pager = (prev, next) => `<nav class="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Previous and next">${prev ? `<a href="${prev.href}" class="card card-link flex min-w-0 items-center gap-3 p-4">${icon('chevron-left', 'size-5 text-ink-3')}<span class="min-w-0 flex-1"><span class="block text-xs text-ink-3">Previous</span><span class="block truncate text-sm font-medium">${prev.label}</span></span></a>` : '<span class="hidden sm:block"></span>'}${next ? `<a href="${next.href}" class="card card-link flex min-w-0 items-center justify-end gap-3 p-4 text-right"><span class="min-w-0 flex-1"><span class="block text-xs text-ink-3">Next</span><span class="block truncate text-sm font-medium">${next.label}</span></span>${icon('chevron-right', 'size-5 text-ink-3')}</a>` : ''}</nav>`;
  const rtable = (headers, rows) =>
    `<div class="rt-wrap"><table class="rtable"><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td data-label="${esc(strip(headers[i]))}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const empty = (title, text, href = '#/', label = 'Go home') => `<div class="card flex flex-col items-start gap-3 p-6"><p class="title-md">${title}</p><p class="text-sm text-ink-2">${text}</p><a class="btn btn-sm" href="${href}">${label}</a></div>`;

  function topicHTML(t) {
    return `<div class="topic flex scroll-mt-24 gap-3.5 py-5" id="tp-${t.id}" data-toc="${esc(strip(t.title))}">
      <label class="mt-0.5 cursor-pointer" title="Mark as done"><input type="checkbox" class="sr-only" id="cb-${t.id}" data-topic="${t.id}"${done[t.id] ? ' checked' : ''}><span class="check">${icon('check', 'size-3.5')}</span></label>
      <div class="flex min-w-0 flex-1 flex-col gap-2.5">
        <h3 class="topic-title title-md"><label for="cb-${t.id}" class="cursor-pointer">${esc(t.title)}</label></h3>
        ${t.what ? `<p class="rich text-[0.95rem] leading-relaxed text-ink-2">${t.what}</p>` : ''}
        ${t.points && t.points.length ? `<ul class="points rich">${t.points.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
        ${usage(t.use, t.avoid)}
        ${learn(t.res)}
      </div>
    </div>`;
  }

  /* ---------- diagrams ---------- */
  function svgBox(x, y, w, h, cls, title, sub) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="${cls}"/>` +
      `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 3 : h / 2 + 4)}" text-anchor="middle" class="svg-t svg-ink">${title}</text>` +
      (sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 12}" text-anchor="middle" class="svg-s svg-ink2">${sub}</text>` : '');
  }
  const marker = (id, cls, reverse) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="${reverse ? 'auto-start-reverse' : 'auto'}"><path d="M0,0 L10,5 L0,10 z" class="${cls}"/></marker>`;

  const SAGA_WIDE = `<svg viewBox="0 0 740 252" class="h-auto w-full" role="img" aria-label="A saga with four forward steps. Step 4 fails, so compensations for steps 3, 2 and 1 run in reverse order."><defs>${marker('sw-f', 'mk-f')}${marker('sw-c', 'mk-c')}</defs>
    <text x="16" y="22" class="svg-s svg-ink3">Forward: each step is a local transaction in its own service</text>
    ${svgBox(16, 36, 150, 48, 'svg-ok', '1. Create order', 'status PENDING')}${svgBox(202, 36, 150, 48, 'svg-ok', '2. Reserve stock', 'inventory service')}
    ${svgBox(388, 36, 150, 48, 'svg-ok', '3. Charge card', 'payment service')}${svgBox(574, 36, 150, 48, 'svg-bad', '4. Book courier', 'fails: courier API down')}
    <path d="M166 60 H198" class="svg-fwd" marker-end="url(#sw-f)"/><path d="M352 60 H384" class="svg-fwd" marker-end="url(#sw-f)"/><path d="M538 60 H570" class="svg-fwd" marker-end="url(#sw-f)"/>
    <path d="M649 84 V192 H542" class="svg-comp" marker-end="url(#sw-c)"/>
    <text x="641" y="128" text-anchor="end" class="svg-s svg-ink3">failure triggers</text><text x="641" y="142" text-anchor="end" class="svg-s svg-ink3">compensation</text>
    ${svgBox(388, 168, 150, 48, 'svg-box', 'Refund card', 'undoes step 3')}${svgBox(202, 168, 150, 48, 'svg-box', 'Release stock', 'undoes step 2')}${svgBox(16, 168, 150, 48, 'svg-box', 'Cancel order', 'undoes step 1')}
    <path d="M388 192 H356" class="svg-comp" marker-end="url(#sw-c)"/><path d="M202 192 H170" class="svg-comp" marker-end="url(#sw-c)"/>
    <text x="16" y="242" class="svg-s svg-ink3">Compensate in reverse order. Every undo must be idempotent and retried until it succeeds.</text></svg>`;

  const SAGA_NARROW = `<svg viewBox="0 0 344 330" class="mx-auto h-auto w-full max-w-sm" role="img" aria-label="A saga drawn vertically. Four forward steps on the left; step 4 fails and three compensations run upward on the right."><defs>${marker('sn-f', 'mk-f')}${marker('sn-c', 'mk-c')}</defs>
    <text x="16" y="18" class="svg-m svg-ink3">FORWARD</text><text x="192" y="18" class="svg-m svg-ink3">COMPENSATE</text>
    ${svgBox(16, 28, 136, 44, 'svg-ok', '1. Create order', 'status PENDING')}${svgBox(16, 96, 136, 44, 'svg-ok', '2. Reserve stock', 'inventory service')}
    ${svgBox(16, 164, 136, 44, 'svg-ok', '3. Charge card', 'payment service')}${svgBox(16, 232, 136, 44, 'svg-bad', '4. Book courier', 'fails: API down')}
    <path d="M84 72 V92" class="svg-fwd" marker-end="url(#sn-f)"/><path d="M84 140 V160" class="svg-fwd" marker-end="url(#sn-f)"/><path d="M84 208 V228" class="svg-fwd" marker-end="url(#sn-f)"/>
    ${svgBox(192, 28, 136, 44, 'svg-box', 'Cancel order', 'undoes step 1')}${svgBox(192, 96, 136, 44, 'svg-box', 'Release stock', 'undoes step 2')}${svgBox(192, 164, 136, 44, 'svg-box', 'Refund card', 'undoes step 3')}
    <path d="M152 254 H260 V212" class="svg-comp" marker-end="url(#sn-c)"/><path d="M260 164 V144" class="svg-comp" marker-end="url(#sn-c)"/><path d="M260 96 V76" class="svg-comp" marker-end="url(#sn-c)"/>
    <text x="16" y="302" class="svg-s svg-ink3">Undo in reverse order.</text><text x="16" y="318" class="svg-s svg-ink3">Every undo is idempotent and retried.</text></svg>`;

  const ORCH = `<svg viewBox="0 0 360 228" class="h-auto w-full" role="img" aria-label="Orchestration: one orchestrator sends commands to the order, payment and stock services."><defs>${marker('or-f', 'mk-f')}</defs>
    <text x="16" y="20" class="svg-t svg-ink">Orchestration</text>
    ${svgBox(105, 34, 150, 44, 'svg-acc', 'Orchestrator', 'or a Temporal workflow')}
    ${svgBox(16, 150, 100, 40, 'svg-box', 'Order')}${svgBox(130, 150, 100, 40, 'svg-box', 'Payment')}${svgBox(244, 150, 100, 40, 'svg-box', 'Stock')}
    <path d="M150 78 L70 146" class="svg-fwd" marker-end="url(#or-f)"/><path d="M180 78 V146" class="svg-fwd" marker-end="url(#or-f)"/><path d="M210 78 L290 146" class="svg-fwd" marker-end="url(#or-f)"/>
    <text x="16" y="216" class="svg-s svg-ink3">It sends each command and tracks every reply.</text></svg>`;

  const CHOR = `<svg viewBox="0 0 360 228" class="h-auto w-full" role="img" aria-label="Choreography: the order, payment and stock services publish and subscribe to an event bus."><defs>${marker('ch-f', 'mk-f', true)}</defs>
    <text x="16" y="20" class="svg-t svg-ink">Choreography</text>
    ${svgBox(16, 34, 100, 40, 'svg-box', 'Order')}${svgBox(130, 34, 100, 40, 'svg-box', 'Payment')}${svgBox(244, 34, 100, 40, 'svg-box', 'Stock')}
    ${svgBox(16, 130, 328, 40, 'svg-acc', 'Event bus: an SNS or Kafka topic')}
    <path d="M66 78 V126" class="svg-fwd" marker-start="url(#ch-f)" marker-end="url(#ch-f)"/><path d="M180 78 V126" class="svg-fwd" marker-start="url(#ch-f)" marker-end="url(#ch-f)"/><path d="M294 78 V126" class="svg-fwd" marker-start="url(#ch-f)" marker-end="url(#ch-f)"/>
    <text x="16" y="216" class="svg-s svg-ink3">Each service reacts to events; no one owns the flow.</text></svg>`;

  /* ---------- navigation model ---------- */
  const NAV = [
    { id: 'home', label: 'Home', icon: 'house' },
    { group: 'Learn' },
    { id: 'roadmap', label: 'Roadmap', icon: 'map' },
    { id: 'tracks', label: 'Tracks', icon: 'route' },
    { id: 'labs', label: 'Labs', icon: 'flask-conical' },
    { group: 'Design' },
    { id: 'design', label: 'HLD and LLD', icon: 'layers' },
    { id: 'cases', label: 'Case studies', icon: 'compass' },
    { id: 'tradeoffs', label: 'Trade-offs', icon: 'sliders-horizontal' },
    { id: 'patterns', label: 'Patterns', icon: 'puzzle' },
    { group: 'Reference' },
    { id: 'databases', label: 'Databases', icon: 'database' },
    { id: 'aws', label: 'AWS', icon: 'cloud' },
    { id: 'tools', label: 'Tools', icon: 'wrench' },
    { id: 'resources', label: 'Resources', icon: 'library' },
    { group: 'Practice' },
    { id: 'vault', label: 'Vault notebook', icon: 'notebook-pen' },
    { id: 'articles', label: 'Articles', icon: 'book-open-text' }
  ];
  const TABS = [['home', 'Home', 'house'], ['roadmap', 'Roadmap', 'map'], ['tracks', 'Tracks', 'route'], ['vault', 'Vault', 'notebook-pen']];
  const TAB_OF = { articles: 'vault' };
  const MARK = `<svg viewBox="0 0 32 32" class="size-5" aria-hidden="true"><path d="M7 8h7v5.5H7zM18 8h7v5.5h-7zM10.5 13.5v3.5h11v-3.5M16 17v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><ellipse cx="16" cy="22.5" rx="5" ry="1.8" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  const BRAND = `<span class="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">${MARK}</span><span class="min-w-0 leading-tight"><span class="block font-display text-[1.05rem] font-semibold tracking-tight">Study Hub</span><span class="block truncate text-xs text-ink-3">System design, from scratch</span></span>`;

  const navHTML = () => NAV.filter(n => n.group || !['vault', 'articles'].includes(n.id) || Q.length).map(n => n.group
    ? `<p class="eyebrow mt-4 mb-1 px-3">${n.group}</p>`
    : `<a href="${to(n.id === 'home' ? '' : n.id)}" class="navlink" data-nav="${n.id}">${icon(n.icon)}<span class="flex-1 truncate">${n.label}</span>${n.id === 'vault' ? `<span class="num text-[0.7rem] text-ink-3" data-count="vault">${tally('vault').join('/')}</span>` : ''}</a>`).join('');
  const meter = (key, label) => `<div class="flex items-center gap-3">${ring(key, 'size-8', 4)}<div class="min-w-0 flex-1"><p class="text-xs text-ink-3">${label}</p><p class="num text-sm font-medium" data-count="${key}">${tally(key).join('/')}</p></div></div>`;
  const progressBlock = () => `<div class="panel flex flex-col gap-3 p-3.5">${meter('road', 'Roadmap topics')}${TRACKS.length ? meter('tracks', 'Track topics') : ''}${Q.length ? meter('vault', 'Vault answers') : ''}</div>`;
  const theme = () => store.get(K.theme, '');
  const themeSeg = () => `<div class="seg w-full" role="radiogroup" aria-label="Theme">${[['', 'monitor', 'System'], ['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']].map(([v, i, l]) => `<button type="button" role="radio" class="flex flex-1 items-center justify-center gap-1.5" data-theme-set="${v}" aria-checked="${theme() === v}">${icon(i, 'size-3.5')}<span>${l}</span></button>`).join('')}</div>`;

  function renderChrome() {
    $('#sidebar').innerHTML = `<a href="#/" class="flex items-center gap-2.5 px-1">${BRAND}</a>
      <button type="button" data-action="search" class="flex h-10 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2">${icon('search')}<span class="flex-1 text-left">Search</span><span class="kbd">${isMac ? '⌘K' : 'Ctrl K'}</span></button>
      <nav class="flex flex-col gap-0.5" aria-label="Sections">${navHTML()}</nav>
      <div class="mt-auto flex flex-col gap-3">${progressBlock()}${themeSeg()}</div>`;
    $('#tabbar').innerHTML = `<div class="grid h-16 grid-cols-5">${TABS.filter(t => t[0] !== 'vault' || Q.length).map(([id, l, i]) => `<a href="${to(id === 'home' ? '' : id)}" class="tab" data-tab="${id}">${icon(i, 'size-5')}<span>${l}</span></a>`).join('')}<button type="button" class="tab" data-action="menu">${icon('menu', 'size-5')}<span>More</span></button></div>`;
    $('#drawer').innerHTML = `<div class="flex max-h-[88dvh] flex-col md:h-full md:max-h-none">
      <div class="flex justify-center pt-2.5 md:hidden"><span class="h-1.5 w-10 rounded-full bg-line-strong"></span></div>
      <div class="flex items-center justify-between gap-2 px-4 pt-3 pb-2"><a href="#/" class="flex items-center gap-2.5">${BRAND}</a><button type="button" class="btn btn-ghost btn-icon" data-action="close-drawer" aria-label="Close menu">${icon('x', 'size-5')}</button></div>
      <nav class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-3 pb-3" aria-label="All sections">${navHTML()}</nav>
      <div class="flex flex-col gap-3 border-t border-line p-4">${progressBlock()}${themeSeg()}</div></div>`;
    $$('[data-brand]').forEach(el => { el.innerHTML = BRAND; el.setAttribute('href', '#/'); });
    $$('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon, 'size-5'); });
    paintThemeButtons();
  }

  function setNav(view) {
    const tab = TAB_OF[view] || view;
    $$('[data-nav]').forEach(a => { if (a.dataset.nav === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $$('[data-tab]').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }

  /* ---------- theme ---------- */
  function applyTheme(t) {
    const r = document.documentElement;
    if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
  }
  function paintThemeButtons() {
    const t = theme();
    $$('[data-theme-set]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.themeSet === t)));
    const name = t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'monitor';
    $$('[data-theme-icon]').forEach(b => { b.innerHTML = icon(name, 'size-5'); b.setAttribute('aria-label', `Theme: ${t || 'system'}. Change theme`); });
  }
  function setTheme(t) { store.set(K.theme, t); applyTheme(t); paintThemeButtons(); }

  /* ---------- toast, clipboard, download ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }
  function copyText(text, ok) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let good = false;
      try { good = document.execCommand('copy'); } catch (e) { good = false; }
      ta.remove();
      toast(good ? ok : 'Copy failed. Select the text and copy it by hand.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(ok), fallback);
    else fallback();
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ================= views ================= */

  function viewHome() {
    const cur = currentPhase();
    const next = cur ? cur.topics.find(t => !done[t.id]) : null;
    const dates = phaseDates();
    const obsPhase = H.phases.find(p => /observability/i.test(p.title));
    const prodPhase = H.phases.find(p => /production/i.test(p.title));
    const explore = [
      obsPhase ? [phaseHref(obsPhase), 'activity', 'Monitoring and observability', `Phase ${obsPhase.n}${prodPhase ? ` and ${prodPhase.n}` : ''}: Prometheus, Grafana, tracing, profiling, on-call and incidents.`] : null,
      CASES.length ? [to('cases'), 'compass', 'Case studies', `${CASES.length} real systems: how Netflix, YouTube, WhatsApp and others are built, and why.`] : null,
      GUIDES.length ? [to('tradeoffs'), 'sliders-horizontal', 'Trade-offs', `${GUIDES.length} decision guides: when to use what, and when not to.`] : null,
      TRACKS.length ? [to('tracks'), 'route', 'Tracks', `${TRACKS.map(t => t.short).join(', ')}.`] : null,
      Q.length ? [to('articles'), 'book-open-text', 'Articles', `${Q.length} model answers to read like short articles.`] : null,
      (H.labs || []).length ? [to('labs'), 'flask-conical', 'Labs', `${H.labs.length} hands-on exercises, one per phase.`] : null,
      DBT.length ? [to('databases'), 'database', 'Databases', `${DBT.length} types, from SQL and key-value to columnar, time-series and vector: how each works and when to pick it.`] : null,
      DEEP.length ? [to('patterns', 'deep-dives'), 'puzzle', 'Pattern deep dives', `${DEEP.length} patterns with diagrams and alternatives: saga, outbox, CQRS, circuit breakers and more.`] : null,
      AWS.groups.length ? [to('aws'), 'cloud', 'AWS', `${AWS.groups.reduce((a, g) => a + g.services.length, 0)} services: which one to use when, for what, and when not to.`] : null
    ].filter(Boolean);
    return `${head('Study hub · weekends first, weekdays when you can', 'System design, from scratch to SDE-2',
      'A weekend-paced roadmap from foundations to senior judgment, plus tracks for everything else a strong engineer covers, real case studies, trade-off guides and a notebook of 93 interview questions.')}
    <div class="grid gap-4 md:grid-cols-3">
      ${cur ? `<a href="${(next && topicHome.get(next.id)) || phaseHref(cur)}" class="card card-link flex flex-col gap-5 p-5 sm:p-6 md:col-span-2">
        <div class="flex items-start gap-4">${ringWithPct(`phase:${phaseKey(cur)}`, 'size-16', 'text-sm')}
          <div class="min-w-0 flex-1"><p class="eyebrow">Continue · Phase ${cur.n} · ${dates[cur.id]}</p><h2 class="title-lg mt-1.5">${esc(cur.title)}</h2>
          <p class="mt-2 text-sm text-ink-2">${next ? `Next up: <span class="font-medium text-ink">${esc(next.title)}</span>` : 'Every topic here is done. On to the next phase.'}</p></div></div>
        <span class="btn btn-primary self-start">Continue ${icon('arrow-right')}</span></a>` : ''}
      <div class="card flex flex-col justify-center gap-4 p-5">${meter('road', 'Roadmap topics')}${TRACKS.length ? meter('tracks', 'Track topics') : ''}${Q.length ? meter('vault', 'Vault answers') : ''}</div>
    </div>
    ${section('explore', 'Explore')}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${explore.map(e => `<a href="${e[0]}" class="card card-link flex flex-col gap-2 p-5"><span class="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">${icon(e[1], 'size-4.5')}</span><h3 class="title-md mt-1">${e[2]}</h3><p class="text-sm text-ink-2">${e[3]}</p></a>`).join('')}</div>
    ${section('rhythm', 'Your rhythm')}
    <div class="grid gap-4 md:grid-cols-2">
      <div class="card flex flex-col gap-3 p-5"><h3 class="title-md">Your week</h3><ul class="points">
        <li><strong class="text-ink">Saturday, 3-4 h.</strong> Learn the phase topics. Tick one when you can explain it without notes.</li>
        <li><strong class="text-ink">Sunday, 3-4 h.</strong> Do the lab, then answer two or three vault questions for the phase.</li>
        <li><strong class="text-ink">Weekdays, 30-45 min.</strong> One vault question, one track topic, or one LLD kata step.</li>
        <li><strong class="text-ink">Every fourth weekend.</strong> A mock interview with Claude.</li></ul></div>
      <div class="card flex flex-col gap-3 p-5"><h3 class="title-md">The loop</h3>
        <div class="flex flex-wrap items-center gap-1.5 text-sm font-medium">${['Learn', 'Build', 'Explain', 'Get graded', 'Revisit'].map((s, i) => `${i ? `<span class="text-ink-3">${icon('arrow-right', 'size-3.5')}</span>` : ''}<span class="rounded-full border border-line bg-muted px-3 py-1">${s}</span>`).join('')}</div>
        <p class="text-sm text-ink-2">Explaining is where it sticks: write each vault answer in your own words before you open the model answer, then paste it to Claude to get graded.</p>
        ${Q.length ? `<button type="button" class="btn self-start" data-action="pick-global">${icon('shuffle')} Pick a question for me</button>` : ''}</div>
    </div>
    ${section('ask', 'Ask Claude', 'Copy a prompt and paste it into Claude Code.')}
    <div class="grid gap-2">${(H.prompts || []).map((p, i) => `<div class="card flex items-center gap-3 p-3.5 sm:p-4"><div class="min-w-0 flex-1"><p class="font-mono text-[0.82rem] leading-relaxed text-ink">${esc(p[0])}</p><p class="mt-1 text-xs text-ink-3">${esc(p[1])}</p></div><button type="button" class="btn btn-sm" data-prompt="${i}" aria-label="Copy prompt">${icon('copy', 'size-3.5')}<span class="max-sm:hidden">Copy</span></button></div>`).join('')}</div>
    <p class="mt-6 text-xs text-ink-3">Progress is saved in this browser. The vault notebook can export a backup.</p>`;
  }

  /* ----- roadmap ----- */
  function viewRoadmap(r) {
    if (r.detail === 'lld') return viewLld();
    if (r.detail) { const p = phaseByKey(r.detail); return p ? viewPhase(p) : notFound(); }
    const dates = phaseDates();
    const cur = currentPhase();
    const weeks = H.phases.reduce((a, p) => a + p.weekends, 0);
    const startVal = store.get(K.start, H.start);
    return `${head(`Roadmap · ${H.phases.length} phases · about ${weeks} weekends`, 'The path',
      'The main track runs on weekends and the LLD side track on weekdays. Phases build on each other, but pull observability or ClickHouse forward whenever work needs them.',
      `<div class="flex flex-wrap items-center gap-2 text-sm text-ink-2"><label for="start-date">Plan starts</label><input type="date" id="start-date" class="field h-9 w-auto" value="${esc(startVal)}"><span class="text-ink-3">Dates move with it.</span></div>`)}
      <div class="grid gap-4 md:grid-cols-2">${H.phases.map(p => `<a href="${phaseHref(p)}" class="card card-link flex gap-4 p-5${p === cur ? ' ring-2 ring-accent' : ''}">
        ${ringWithPct(`phase:${phaseKey(p)}`, 'size-12', 'text-[0.66rem]')}
        <div class="min-w-0 flex-1"><p class="eyebrow">Phase ${p.n} · ${plural(p.weekends, 'weekend')} · ${dates[p.id]}</p><h2 class="title-md mt-1">${esc(p.title)}</h2>
          <p class="mt-1.5 line-clamp-2 text-sm text-ink-2">${p.goal}</p>
          <p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3"><span><span class="num" data-count="phase:${phaseKey(p)}">${tally(`phase:${phaseKey(p)}`).join('/')}</span> topics</span>${(p.vault || []).length ? `<span>${plural(p.vault.length, 'vault question')}</span>` : ''}${p === cur ? '<span class="font-medium text-accent">You are here</span>' : ''}</p></div></a>`).join('')}
        ${H.lld ? `<a href="${to('roadmap', 'lld')}" class="card card-link flex gap-4 p-5 md:col-span-2">${ringWithPct('lld', 'size-12', 'text-[0.66rem]')}<div class="min-w-0 flex-1"><p class="eyebrow">Side track · weekdays</p><h2 class="title-md mt-1">Low-level design and machine coding</h2><p class="mt-1.5 line-clamp-2 text-sm text-ink-2">${H.lld.intro}</p></div></a>` : ''}
      </div>`;
  }

  function viewPhase(p) {
    const dates = phaseDates();
    const i = H.phases.indexOf(p);
    const prev = H.phases[i - 1], next = H.phases[i + 1];
    const vq = (p.vault || []).map(id => qById[id]).filter(Boolean);
    return `${back(to('roadmap'), 'Roadmap')}
      <header class="mb-8 flex items-start gap-4 sm:gap-5">${ringWithPct(`phase:${phaseKey(p)}`, 'size-16', 'text-sm')}
        <div class="min-w-0 flex-1"><p class="eyebrow">Phase ${p.n} · ${plural(p.weekends, 'weekend')} · ${dates[p.id]}</p><h1 class="title-xl mt-2">${esc(p.title)}</h1><p class="lede mt-3">${p.goal}</p></div></header>
      <section class="card px-5 sm:px-6"><div class="flex items-center justify-between gap-2 border-b border-line py-4"><h2 class="title-md">Topics</h2><span class="num text-sm text-ink-3"><span data-count="phase:${phaseKey(p)}">${tally(`phase:${phaseKey(p)}`).join('/')}</span> done</span></div>
        <div class="divide-y divide-line">${p.topics.map(topicHTML).join('')}</div></section>
      ${vq.length ? `<section class="card mt-5 scroll-mt-24 p-5 sm:p-6" id="questions" data-toc="Vault questions"><div class="flex flex-wrap items-center justify-between gap-2"><h2 class="title-md">Vault questions for this phase</h2><a class="text-sm text-accent hover:underline" href="${to('articles')}">Read the model answers</a></div>
        <ul class="mt-3 grid gap-2.5">${vq.map(q => `<li class="flex items-baseline gap-2.5 text-sm"><span class="status-dot translate-y-px" data-s="${statusOf(q.id)}"></span><a href="${to('vault', q.id)}" class="min-w-0 hover:text-accent"><span class="num mr-1.5 text-xs text-accent">${q.id}</span>${esc(q.title)}</a></li>`).join('')}</ul></section>` : ''}
      <div class="mt-5 grid gap-4 sm:grid-cols-2"><div class="card flex scroll-mt-24 flex-col gap-2 p-5" id="lab" data-toc="Lab"><p class="eyebrow">Lab</p><p class="rich text-sm leading-relaxed text-ink-2">${p.lab}</p><a class="mt-1 text-sm text-accent hover:underline" href="${to('labs', String(p.n))}">Open in Labs</a></div>
        <div class="card flex scroll-mt-24 flex-col gap-2 p-5" id="done" data-toc="Done when"><p class="eyebrow">Done when</p><p class="text-sm leading-relaxed text-ink-2">${p.done}</p></div></div>
      ${pager(prev ? { href: phaseHref(prev), label: `P${prev.n} · ${esc(prev.title)}` } : null, next ? { href: phaseHref(next), label: `P${next.n} · ${esc(next.title)}` } : (H.lld ? { href: to('roadmap', 'lld'), label: 'LLD side track' } : null))}`;
  }

  function viewLld() {
    const L = H.lld;
    if (!L) return notFound();
    const last = H.phases[H.phases.length - 1];
    return `${back(to('roadmap'), 'Roadmap')}
      <header class="mb-8 flex items-start gap-4 sm:gap-5">${ringWithPct('lld', 'size-16', 'text-sm')}<div class="min-w-0 flex-1"><p class="eyebrow">Side track · weekdays</p><h1 class="title-xl mt-2">Low-level design and machine coding</h1><p class="lede mt-3">${L.intro}</p></div></header>
      <section class="card px-5 sm:px-6"><div class="divide-y divide-line">${L.steps.map(s => topicHTML({ id: s.id, title: s.title, points: s.points, res: s.res })).join('')}</div></section>
      <div class="mt-5 grid gap-4 sm:grid-cols-2"><div class="card scroll-mt-24 p-5" id="katas" data-toc="Katas"><p class="eyebrow">Katas, in this order</p><ol class="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">${L.katas.map(k => `<li>${esc(k)}</li>`).join('')}</ol></div>
        <div class="card scroll-mt-24 p-5" id="rubric" data-toc="Rubric"><p class="eyebrow">How a machine-coding round is scored</p><ol class="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">${L.rubric.map(k => `<li>${esc(k)}</li>`).join('')}</ol></div></div>
      ${pager(last ? { href: phaseHref(last), label: `P${last.n} · ${esc(last.title)}` } : null, null)}`;
  }

  /* ----- tracks ----- */
  function viewTracks(r) {
    if (!TRACKS.length) return head('Tracks', 'Beyond system design', '') + empty('Tracks are not included in this copy', 'Add the data/tracks-*.js files to enable tracks.');
    if (r.detail) { const t = trackById(r.detail); return t ? viewTrack(t) : notFound(); }
    return `${head(`Tracks · ${TRACKS.length} areas · self-paced`, 'Beyond system design',
      'What else a strong engineer covers: security, AI and LLM engineering, testing, language depth, Linux and networking, and career craft. Work through them on weekdays, alongside the roadmap.')}
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${TRACKS.map(t => `<a href="${to('tracks', t.id)}" class="card card-link flex flex-col gap-3 p-5">
        <div class="flex items-center justify-between gap-3"><span class="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">${icon(t.icon, 'size-5')}</span>${ring(`track:${t.id}`, 'size-9', 4)}</div>
        <h2 class="title-md">${esc(t.title)}</h2><p class="line-clamp-3 text-sm text-ink-2">${t.why}</p>
        <p class="num mt-auto text-xs text-ink-3"><span data-count="track:${t.id}">${tally(`track:${t.id}`).join('/')}</span> topics · ${esc(t.cadence)}</p></a>`).join('')}</div>`;
  }

  function viewTrack(t) {
    const i = TRACKS.indexOf(t);
    const prev = TRACKS[i - 1], next = TRACKS[i + 1];
    return `${back(to('tracks'), 'Tracks')}
      <header class="mb-8 flex items-start gap-4 sm:gap-5"><span class="grid size-16 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">${icon(t.icon, 'size-7')}</span>
        <div class="min-w-0 flex-1"><p class="eyebrow">Track · <span data-count="track:${t.id}">${tally(`track:${t.id}`).join('/')}</span> done · ${esc(t.cadence)}</p><h1 class="title-xl mt-2">${esc(t.title)}</h1><p class="lede mt-3">${t.why}</p></div></header>
      <section class="card px-5 sm:px-6"><div class="divide-y divide-line">${t.topics.map(topicHTML).join('')}</div></section>
      <div class="card mt-5 scroll-mt-24 p-5" id="done" data-toc="Done when"><p class="eyebrow">Done when</p><p class="mt-1.5 text-sm text-ink-2">${t.done}</p></div>
      ${pager(prev ? { href: to('tracks', prev.id), label: esc(prev.title) } : null, next ? { href: to('tracks', next.id), label: esc(next.title) } : null)}`;
  }

  /* ----- labs ----- */
  function viewLabs() {
    return `${head(`Labs · ${(H.labs || []).length} hands-on exercises`, 'Learn by breaking things',
      'One lab per phase, sized for a Sunday. Copy the scaffold prompt into Claude Code and it sets the lab up in a <code class="font-mono text-[0.9em]">labs/</code> folder next to this hub.')}
      <div class="grid gap-4 sm:grid-cols-2">${(H.labs || []).map(l => {
        const phase = phaseByN(l.phase);
        return `<article class="card flex scroll-mt-24 flex-col gap-3 p-5" id="lab-${l.phase}" data-toc="${esc(l.title)}">
          <div class="flex items-center justify-between gap-2"><p class="eyebrow">${esc(l.stack)}</p>${phase ? `<a href="${phaseHref(phase)}" class="chip">P${phase.n}</a>` : ''}</div>
          <h2 class="title-md">${esc(l.title)}</h2>
          <ol class="rich list-decimal space-y-1.5 pl-5 text-sm text-ink-2">${l.steps.map(s => `<li>${s}</li>`).join('')}</ol>
          <button type="button" class="btn btn-sm mt-auto self-start" data-copytext="${esc(`Scaffold the Phase ${l.phase} lab (${l.title}) in a labs/ folder next to my study hub, with a README, a docker compose file and starter code.`)}">${icon('copy', 'size-3.5')} Copy scaffold prompt</button></article>`;
      }).join('')}</div>
      ${H.lld ? `${section('katas', 'LLD katas', `One a week on weekdays. The scoring rubric is on the <a class="link" href="${to('roadmap', 'lld')}">LLD side track</a>.`)}
      <ol class="grid gap-2 sm:grid-cols-2">${H.lld.katas.map((k, i) => `<li class="card flex items-center gap-3 p-3.5"><span class="num grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">${i + 1}</span><span class="text-sm">${esc(k)}</span></li>`).join('')}</ol>` : ''}`;
  }

  /* ----- design ----- */
  const timeline = rows => `<ol class="flex flex-col gap-2.5">${rows.map((r, i) => `<li class="card flex gap-4 p-4"><span class="num grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">${i + 1}</span><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><h3 class="title-md">${r[0]}</h3><span class="chip num">${r[1]}</span></div><p class="mt-1.5 text-sm leading-relaxed text-ink-2">${r[2]}</p></div></li>`).join('')}</ol>`;

  function viewDesign() {
    const D = H.design || {};
    return `${head('Two interview rounds, two zoom levels', 'HLD and LLD', 'High-level design picks the boxes and arrows. Low-level design builds one box well. You need both, and they are scored differently.')}
      ${section('d-compare', 'HLD vs LLD')}${rtable(['', 'HLD (high-level design)', 'LLD (low-level design)'], (D.compare || []).map(r => r))}
      ${section('d-hld', 'Running an HLD round', '45 minutes. Time boxes keep you from spending 20 minutes on requirements.')}${timeline(D.hld || [])}
      ${section('d-lld', 'Running a machine-coding round', '90 minutes. Working code beats a beautiful design that does not run.')}${timeline(D.lldSteps || [])}
      <div class="mt-6 rounded-2xl bg-accent-soft p-5 text-[0.95rem] leading-relaxed text-ink">${D.connect || ''} Practise it on the <a class="link" href="${to('roadmap', 'lld')}">LLD side track</a>.</div>
      ${section('d-numbers', 'Numbers to know', 'Orders of magnitude, not exact values. Say them as "roughly".')}${rtable(['What', 'Roughly'], (D.numbers || []).map(r => [r[0], `<code>${r[1]}</code>`]))}`;
  }

  /* ----- case studies ----- */
  function viewCases(r) {
    if (!CASES.length) return head('Case studies', 'How real systems are built', '') + empty('Case studies are not included in this copy', 'Add the data/cases-*.js files to enable case studies.');
    if (r.detail) { const c = CASES.find(x => x.id === r.detail); return c ? viewCase(c) : notFound(); }
    return `${head(`Case studies · ${CASES.length} systems`, 'How real systems are built',
      'Architecture, the decisions behind it and what each one costs, from public engineering write-ups. Each case ends with how to answer it in an interview.')}
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">${CASES.map(x => `<a href="${to('cases', x.id)}" class="card card-link flex flex-col gap-2.5 p-5">
        <p class="eyebrow">${esc(x.kind)}</p><h2 class="title-lg">${esc(x.name)}</h2><p class="text-sm leading-relaxed text-ink-2">${x.tagline}</p>
        <ul class="mt-1 flex flex-col gap-1 text-xs text-ink-3">${(x.scale || []).slice(0, 2).map(s => `<li class="flex gap-2">${icon('activity', 'size-3.5 translate-y-0.5')}<span>${s}</span></li>`).join('')}</ul>
        <span class="mt-auto flex items-center gap-1.5 pt-2 text-sm font-medium text-accent">Read the case ${icon('arrow-right', 'size-4')}</span></a>`).join('')}</div>`;
  }

  const graphData = key => {
    const [kind, id] = String(key).split(':');
    if (kind === 'hld') return (window.HUB_HLD || {})[id] || null;
    const d = kind === 'deep' ? deepById.get(id) : kind === 'db' ? dbById.get(id) : null;
    return d ? d.diagram : null;
  };
  const pathChips = (D, all) => ((D.paths || []).length
    ? `<div class="flex flex-wrap gap-2" role="group" aria-label="Request paths"><button type="button" class="chip" data-hld-path="" aria-pressed="true">${all}</button>${D.paths.map((p, i) => `<button type="button" class="chip" data-hld-path="${i}" aria-pressed="false">${icon('route', 'size-3.5')}${esc(p.name)}</button>`).join('')}</div>`
    : '');
  const pathLayers = (D, path) => {
    if (path.layers) return path.layers;
    const layerOf = new Map(D.layers.flatMap(l => l.items.map(it => [it[0], l.name])));
    return (path.nodes || []).map(n => layerOf.get(n)).filter((l, k, a) => l && l !== a[k - 1]);
  };
  const chipRow = (label, chips) => (chips.length ? `<p class="flex flex-wrap items-center gap-2"><span class="eyebrow mr-1">${label}</span>${chips.join('')}</p>` : '');
  const relatedBlock = ({ guides = [], deeps = [], dbs = [], qs = [] }) => {
    const rows = chipRow('Guides', guides.map(g => `<a class="chip" href="${to('tradeoffs', g.id)}">${esc(strip(g.title))}</a>`)) +
      chipRow('Deep dives', deeps.map(d => `<a class="chip" href="${to('patterns', d.id)}">${esc(strip(d.title))}</a>`)) +
      chipRow('Databases', dbs.map(t => `<a class="chip" href="${to('databases', t.id)}">${esc(t.name)}</a>`)) +
      chipRow('Practice', qs.map(id => `<a class="chip" href="${to('vault', id)}" title="${esc(qById[id].title)}">${id}</a>`));
    return rows ? `${section('related', 'Related')}<div class="flex flex-col gap-3 text-sm">${rows}</div>` : '';
  };
  const sourceRow = s => `<li class="card flex items-start gap-3 p-3.5">${icon('external-link', 'size-4 mt-0.5 text-ink-3')}<div class="min-w-0"><a class="link text-sm font-medium" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.t)}</a><p class="text-xs text-ink-3">${esc(s.by || '')}</p></div></li>`;

  function hldHTML(c) {
    const D = (window.HUB_HLD || {})[c.id];
    if (!D) return '';
    const graph = !!((D.edges || []).length && window.HubGraph);
    const saved = store.get(K.hld, '');
    const mode = graph && (saved ? saved === 'graph' : window.matchMedia('(min-width: 40rem)').matches) ? 'graph' : 'layers';
    return `${section('hld', 'Architecture', graph ? 'Boxes are components; lines are calls, events and data flows. Hover or tap a box to see what it does, why it sits in its layer and what it talks to.' : 'What they use at each layer, and why. Pick a request path to see which layers it touches.')}
      <figure class="card hld p-4 sm:p-6" data-src="hld:${c.id}" data-mode="${mode}">
        <p class="text-[0.95rem] leading-relaxed text-ink-2">${D.summary}</p>
        <div class="mt-4 flex flex-wrap items-center gap-2">${graph ? `<div class="seg mr-1" role="radiogroup" aria-label="Diagram style">${[['graph', 'Graph', 'network'], ['layers', 'Layers', 'layers']].map(([v, l, ic]) => `<button type="button" role="radio" class="flex items-center gap-1.5" data-hld-mode="${v}" aria-checked="${mode === v}">${icon(ic, 'size-3.5')}${l}</button>`).join('')}</div>` : ''}${pathChips(D, 'Everything')}</div>
        <p class="hld-note mt-2 min-h-5 text-sm text-ink-3" aria-live="polite"></p>
        ${graph ? `<div class="graph-box mt-2" data-graph="hld:${c.id}"></div>` : ''}
        <ol class="hld-stack @container mt-2">${D.layers.map((l, i) => `${i ? '<li class="hld-link" aria-hidden="true"><span></span></li>' : ''}<li class="hld-layer" data-layer="${esc(l.name)}"><div class="hld-grid">
          <div class="hld-name"><span class="eyebrow">${esc(l.name)}</span><span class="hld-step num"></span></div>
          <div class="hld-items">${l.items.map(it => `<span class="hld-box" data-item="${esc(strip(it[0]))}"><b>${it[0]}</b><span>${it[1]}</span></span>`).join('')}</div>
          <p class="hld-why"><span class="k">Why</span>${l.why}</p></div></li>`).join('')}</ol>
      </figure>`;
  }

  function showHldPath(fig, idx) {
    const D = fig && graphData(fig.dataset.src);
    if (!D) return;
    const path = idx === '' ? null : (D.paths || [])[+idx];
    $$('[data-hld-path]', fig).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.hldPath === idx)));
    if (path) fig.dataset.path = idx; else delete fig.dataset.path;
    const layers = path ? pathLayers(D, path) : [];
    const items = new Set(path ? (path.nodes || []).map(strip) : []);
    $$('.hld-layer', fig).forEach(li => {
      const steps = layers.map((n, k) => (n === li.dataset.layer ? k + 1 : 0)).filter(Boolean);
      li.classList.toggle('on', steps.length > 0);
      li.classList.toggle('off', !!path && !steps.length);
      $('.hld-step', li).textContent = steps.join(', ');
    });
    $$('.hld-box', fig).forEach(b => b.classList.toggle('on', items.has(b.dataset.item)));
    const note = $('.hld-note', fig);
    if (note) note.innerHTML = path ? path.note : '';
    const box = $('[data-graph]', fig);
    if (box && box._graph) box._graph.setPath(path ? +idx : null);
  }

  function setHldMode(fig, mode) {
    fig.dataset.mode = mode;
    $$('[data-hld-mode]', fig).forEach(b => b.setAttribute('aria-checked', String(b.dataset.hldMode === mode)));
    store.set(K.hld, mode);
  }

  function viewCase(c) {
    const i = CASES.indexOf(c);
    const prev = CASES[i - 1], next = CASES[i + 1];
    const list = arr => `<ul class="points rich">${(arr || []).map(x => `<li>${x}</li>`).join('')}</ul>`;
    return `${back(to('cases'), 'All case studies')}
      ${head(esc(c.kind), esc(c.name), c.tagline, `<div class="flex flex-wrap gap-2">${(c.scale || []).map(s => `<span class="chip h-auto py-1.5 leading-snug whitespace-normal">${s}</span>`).join('')}</div>`)}
      ${hldHTML(c)}
      ${section('flow', 'The main request path')}
      <div class="card p-4 sm:p-5"><div class="flow">${(c.flow || []).map((s, k) => `${k ? `<span class="text-ink-3">${icon('arrow-right', 'size-4')}</span>` : ''}<div class="flow-step"><b>${s[0]}</b><span>${s[1]}</span></div>`).join('')}</div></div>
      ${section('requirements', 'Requirements')}
      <div class="grid gap-3 sm:grid-cols-2"><div class="card p-5"><p class="eyebrow mb-3">Functional</p>${list(c.requirements && c.requirements.functional)}</div><div class="card p-5"><p class="eyebrow mb-3">Non-functional</p>${list(c.requirements && c.requirements.nonFunctional)}</div></div>
      ${section('building-blocks', 'Building blocks')}
      <div class="grid gap-3 sm:grid-cols-2">${(c.components || []).map(x => `<div class="card p-4"><h3 class="title-md">${x.name}</h3><p class="rich mt-1.5 text-sm leading-relaxed text-ink-2">${x.role}</p></div>`).join('')}</div>
      ${section('decisions', 'Key decisions and their trade-offs')}
      <div class="flex flex-col gap-3">${(c.decisions || []).map(d => `<div class="card flex flex-col gap-2.5 p-5"><h3 class="title-md">${d.title}</h3>${usage(d.why, '', d.tradeoff, 'Why')}</div>`).join('')}</div>
      ${c.whenNot ? `<div class="mt-5 rounded-2xl bg-warn-soft p-5"><p class="eyebrow !text-warn">When not to copy this</p><p class="rich mt-1.5 text-[0.95rem] leading-relaxed text-ink">${c.whenNot}</p></div>` : ''}
      ${section('lessons', 'Lessons to steal')}${list(c.lessons)}
      ${c.interview ? `${section('interview', 'In the interview')}
      <div class="card flex flex-col gap-5 p-5 sm:p-6"><p class="font-display text-lg font-semibold">"${c.interview.ask}"</p>
        <div><p class="eyebrow mb-2">A 45-minute plan</p><ol class="rich list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">${(c.interview.plan || []).map(x => `<li>${x}</li>`).join('')}</ol></div>
        <div class="grid gap-4 sm:grid-cols-2"><div><p class="eyebrow mb-2">Deep dives they like</p>${list(c.interview.deepDives)}</div><div><p class="eyebrow mb-2">Traps</p>${list(c.interview.traps)}</div></div></div>` : ''}
      ${section('sources', 'Sources')}
      <ul class="flex flex-col gap-2">${(c.sources || []).map(sourceRow).join('')}</ul>
      ${pager(prev ? { href: to('cases', prev.id), label: esc(prev.name) } : null, next ? { href: to('cases', next.id), label: esc(next.name) } : null)}`;
  }

  /* ----- trade-offs ----- */
  const LETTER = 'ABCD';
  const bullets = arr => `<ul class="points rich">${(arr || []).map(x => `<li>${x}</li>`).join('')}</ul>`;
  const optCard = (o, k) => `<article class="card scroll-mt-24 p-5 sm:p-6" id="opt-${k + 1}" data-toc="${LETTER[k]} · ${esc(strip(o.name))}">
      <div class="flex items-center gap-3"><span class="opt-badge">${LETTER[k]}</span><h2 class="title-lg min-w-0">${o.name}</h2></div>
      ${o.what ? `<p class="rich mt-3 text-[0.97rem] leading-relaxed text-ink-2">${o.what}</p>` : ''}
      ${(o.pros || []).length ? `<div class="mt-4 grid gap-3 sm:grid-cols-2"><div class="rounded-xl bg-good-soft p-4"><p class="eyebrow mb-2 !text-good">Pros</p>${bullets(o.pros)}</div><div class="rounded-xl bg-bad-soft p-4"><p class="eyebrow mb-2 !text-bad">Cons</p>${bullets(o.cons)}</div></div>` : ''}
      <div class="mt-4">${usage(o.pick, o.avoid, o.cost, 'Pick')}</div>
      ${o.example ? `<p class="rich mt-4 rounded-xl bg-muted p-3.5 text-sm leading-relaxed text-ink-2"><span class="eyebrow mr-2">Example</span>${o.example}</p>` : ''}
      ${o.tools ? `<p class="rich mt-3 text-xs leading-relaxed text-ink-3"><span class="font-medium text-ink-2">Tools:</span> ${o.tools}</p>` : ''}</article>`;

  function viewGuide(g) {
    const i = GUIDES.indexOf(g);
    const prev = GUIDES[i - 1], next = GUIDES[i + 1];
    const opts = g.options || [];
    const sc = g.scenario;
    return `${back(to('tradeoffs'), 'All trade-offs')}
      ${head(esc(g.area), g.title, g.question)}
      ${g.summary ? `<div class="rounded-2xl bg-accent-soft p-5 sm:p-6"><p class="eyebrow mb-2 !text-accent">The trade-off</p><p class="rich text-[0.97rem] leading-relaxed text-ink">${g.summary}</p>${g.why ? `<p class="rich mt-3 text-sm leading-relaxed text-ink-2"><strong class="text-ink">Why it matters:</strong> ${g.why}</p>` : ''}</div>` : ''}
      <nav class="mt-5 flex flex-wrap gap-2" aria-label="Options">${opts.map((o, k) => `<a class="chip" href="${to('tradeoffs', g.id, `opt-${k + 1}`)}"><span class="font-semibold text-accent">${LETTER[k]}</span>${esc(strip(o.name))}</a>`).join('')}</nav>
      <div class="mt-5 flex flex-col gap-4">${opts.map(optCard).join('')}</div>
      ${(g.compare || []).length ? `${section('compare', 'Side by side')}${rtable(['', ...opts.map((o, k) => `${LETTER[k]} · ${esc(strip(o.name))}`)], g.compare)}` : ''}
      ${(g.decide || []).length ? `${section('decide', 'How to decide', 'Ask these in order. The first clear answer usually settles it.')}<ol class="flex flex-col gap-2.5">${g.decide.map((d, k) => `<li class="card flex gap-3.5 p-4"><span class="num grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">${k + 1}</span><div class="min-w-0 flex-1"><p class="rich text-sm font-medium text-ink">${d[0]}</p><p class="rich mt-1 text-sm leading-relaxed text-ink-2">${/^\s*(→|yes|no)\b/i.test(strip(d[1])) ? d[1] : `→ ${d[1]}`}</p></div></li>`).join('')}</ol>` : ''}
      ${sc ? `${section('scenario', 'Worked example')}<div class="card p-5 sm:p-6"><h3 class="title-md">${sc.title}</h3><p class="rich mt-2 text-sm leading-relaxed text-ink-2">${sc.setup}</p><ol class="rich mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">${(sc.steps || []).map(x => `<li>${x}</li>`).join('')}</ol><p class="rich mt-4 rounded-xl bg-accent-soft p-3.5 text-sm leading-relaxed text-ink"><strong>Answer:</strong> ${sc.answer}</p></div>` : ''}
      ${section('rule', 'Rule of thumb')}<div class="rich rounded-2xl bg-accent-soft p-5 text-[0.97rem] leading-relaxed text-ink">${g.rule}</div>
      ${(g.signals || []).length ? `<div class="mt-5"><p class="eyebrow mb-2">Signals that should change your mind</p>${bullets(g.signals)}</div>` : ''}
      ${(g.mistakes || []).length ? `${section('mistakes', 'Common mistakes')}${bullets(g.mistakes)}` : ''}
      ${(g.interview || []).length ? `${section('interview', 'In the interview')}<ul class="flex flex-col gap-2">${g.interview.map(q => `<li class="card flex gap-3 p-4">${icon('message-square-text', 'size-4 mt-0.5 text-accent')}<span class="rich min-w-0 text-sm leading-relaxed">${q}</span></li>`).join('')}</ul>` : ''}
      ${relatedBlock({ deeps: (g.deep || []).map(id => deepById.get(id)).filter(Boolean), dbs: (g.db || []).map(id => dbById.get(id)).filter(Boolean), qs: (g.related || []).filter(id => qById[id]) })}
      ${(g.sources || []).length ? `${section('sources', 'Sources')}<ul class="flex flex-col gap-2">${g.sources.map(sourceRow).join('')}</ul>` : ''}
      ${pager(prev ? { href: to('tradeoffs', prev.id), label: esc(strip(prev.title)) } : null, next ? { href: to('tradeoffs', next.id), label: esc(strip(next.title)) } : null)}`;
  }

  function viewTradeoffs(r) {
    if (!GUIDES.length) return head('Trade-offs', 'When to use what', '') + empty('The decision guides are not included in this copy', 'Add data/tradeoffs.js to enable them.');
    if (r.detail) {
      const g = GUIDES.find(x => x.id === r.detail);
      return g ? viewGuide(g) : notFound();
    }
    const areas = [...new Set(GUIDES.map(g => g.area))];
    return `${head(`Trade-offs · ${GUIDES.length} decision guides`, 'When to use what, and when not to',
      'Every choice costs something. Each guide lays out the options, when to pick each one, when to avoid it, and a rule of thumb. Tools and patterns carry their own "avoid" notes too.')}
      <div class="mb-8 flex flex-col gap-3"><label for="to-q" class="sr-only">Filter guides</label><input id="to-q" type="search" class="field max-w-md" placeholder="Filter, for example: cache, kafka, jwt">
        <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Areas"><button type="button" class="chip" data-area="" aria-pressed="true">All</button>${areas.map(a => `<button type="button" class="chip" data-area="${esc(a)}" aria-pressed="false">${esc(a)}</button>`).join('')}</div></div>
      <div class="flex flex-col gap-12">${areas.map(a => `<div class="area-block" data-area-block="${esc(a)}">${section(`area-${slug(a)}`, esc(a))}<div class="grid gap-3 sm:grid-cols-2">${GUIDES.filter(g => g.area === a).map(g => `<a href="${to('tradeoffs', g.id)}" class="card card-link guide flex flex-col gap-2 p-5" data-hay="${esc(strip(`${g.title} ${g.question} ${g.options.map(o => o.name).join(' ')} ${g.area}`).toLowerCase())}">
        <h3 class="title-md">${g.title}</h3><p class="text-sm text-ink-2">${g.question}</p>
        <div class="mt-1 flex flex-wrap gap-1.5">${g.options.map(o => `<span class="chip h-auto py-1 whitespace-normal">${esc(strip(o.name))}</span>`).join('')}</div>
        <p class="mt-auto pt-2 text-xs leading-relaxed text-ink-3"><span class="font-medium text-ink-2">Rule:</span> ${g.rule}</p></a>`).join('')}</div></div>`).join('')}</div>
      <p class="empty-note mt-6 text-sm text-ink-3" hidden>No guides match. Clear the filter.</p>`;
  }

  /* ----- patterns ----- */
  function patternNames() {
    const gof = (H.patterns && H.patterns.gof ? H.patterns.gof.flatMap(g => g.items.map(i => i[0])) : []);
    return [...new Set([...gof, ...Object.keys(TO.patterns || {})])];
  }

  const FAMILY_ORDER = ['Distributed correctness', 'Data', 'Resilience', 'Scale', 'Change and migration'];
  const deepCard = d => `<a href="${to('patterns', d.id)}" class="card card-link flex flex-col gap-2 p-5"><h3 class="title-md">${d.title}</h3><p class="text-sm leading-relaxed text-ink-2">${d.summary}</p>${(d.alternatives || []).length ? `<p class="mt-auto pt-2 text-xs leading-relaxed text-ink-3"><span class="font-medium text-ink-2">Alternatives:</span> ${d.alternatives.map(a => esc(strip(a[1]))).join(', ')}</p>` : ''}</a>`;
  const deepLink = d => (d ? `<a class="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-accent hover:underline" href="${to('patterns', d.id)}">Deep dive ${icon('arrow-right', 'size-4')}</a>` : '');

  function viewPatterns(r) {
    if (r.detail) { const d = deepById.get(r.detail); return d ? viewDeep(d) : notFound(); }
    const PT = H.patterns || {};
    const gofNames = new Set((PT.gof || []).flatMap(g => g.items.map(i => i[0])));
    const dist = Object.entries(TO.patterns || {}).filter(([n]) => !gofNames.has(n));
    const fams = [...new Set([...FAMILY_ORDER, ...DEEP.map(d => d.family)])].filter(f => DEEP.some(d => d.family === f));
    const reach = row => { const d = deepFor(row[1]); return `<strong class="text-ink">${row[1]}</strong>${d ? `<a class="link ml-2 whitespace-nowrap text-xs font-normal" href="${to('patterns', d.id)}">Deep dive</a>` : ''}`; };
    return `${head('Start from the problem, not the pattern', 'Patterns', 'A pattern is a named, reusable answer to a recurring problem. They come at different zoom levels, from how classes fit together to how whole systems stay correct. If you cannot name the problem, you do not need the pattern.')}
      ${section('families', 'The families')}${rtable(['Level', 'The question it answers', 'Examples', 'Where it shows up'], (PT.families || []).map(r => r))}
      ${DEEP.length ? `${section('deep-dives', `Deep dives · ${DEEP.length}`, 'The patterns interviews probe hardest. Each one covers the problem, how it works, a diagram, variants, alternatives and when to pick them, and the pitfalls.')}
      <div class="flex flex-col gap-8">${fams.map(f => `<div><p class="eyebrow mb-3">${esc(f)}</p><div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">${DEEP.filter(d => d.family === f).map(deepCard).join('')}</div></div>`).join('')}</div>` : ''}
      ${section('finder', 'Pattern finder', 'Which pattern where: find the problem you have, read across.')}
      <label class="sr-only" for="finder-q">Filter problems</label><input id="finder-q" type="search" class="field mb-3 max-w-md" placeholder="Filter, for example: retry, tenant, legacy">
      <div id="finder-table">${rtable(['When you have this problem', 'Reach for', 'Level'], (PT.finder || []).map(r => [r[0], reach(r), `<span class="chip">${r[2]}</span>`]))}</div>
      ${dist.length ? `${section('dist-patterns', 'Architecture and distributed patterns', 'When to reach for each one, and when it is the wrong call.')}
      <div class="grid gap-3 sm:grid-cols-2">${dist.map(([n, v]) => `<div class="card scroll-mt-24 flex flex-col gap-2.5 p-5" id="pat-${slug(n)}"><h3 class="title-md">${esc(n)}</h3>${usage(v.use, v.avoid)}${deepLink(deepFor(n))}</div>`).join('')}</div>` : ''}
      ${section('gof', 'The 23 GoF patterns', 'For LLD rounds. The marked ones come up most; learn those first.')}
      ${(PT.gof || []).map(g => `<p class="eyebrow mt-6 mb-3">${g.group} · ${g.items.length}</p><div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">${g.items.map(it => { const v = (TO.patterns || {})[it[0]] || {}; return `<div class="card scroll-mt-24 flex flex-col gap-2 p-5" id="pat-${slug(it[0])}"><div class="flex items-start justify-between gap-2"><h3 class="title-md">${it[0]}</h3>${it[3] ? '<span class="chip chip-accent">Top 10</span>' : ''}</div><p class="text-sm font-medium text-ink">${it[1]}</p><p class="text-sm text-ink-2">${it[2]}</p>${usage(v.use, v.avoid)}</div>`; }).join('')}</div>`).join('')}
      ${section('solid', 'SOLID in one table')}${rtable(['Principle', 'In practice'], (PT.solid || []).map(r => r))}
      ${section('anti', 'Anti-patterns interviewers poke at')}<ul class="points">${(PT.anti || []).map(a => `<li>${a}</li>`).join('')}</ul>`;
  }

  const sagaFigures = () => `${section('diagram', 'Diagram')}
      <figure class="card p-4 sm:p-5"><div class="@container"><div class="hidden @2xl:block">${SAGA_WIDE}</div><div class="@2xl:hidden">${SAGA_NARROW}</div></div><figcaption class="mt-3 text-xs text-ink-3">An order saga. Step 4 fails, so steps 3, 2 and 1 are undone.</figcaption></figure>
      <div class="@container mt-4"><div class="grid gap-3 @2xl:grid-cols-2"><figure class="card p-4">${ORCH}</figure><figure class="card p-4">${CHOR}</figure></div></div>
      <div class="mt-4">${rtable(['', 'Orchestration', 'Choreography'], [['Who drives', 'A central orchestrator sends commands', 'Each service reacts to events'], ['Seeing the flow', 'In one place', 'Spread across services'], ['Good for', 'Many steps, branches, timeouts', 'Two to four simple steps'], ['Tools', 'Temporal, AWS Step Functions, a saga state table', 'SNS/SQS, Kafka topics']])}</div>`;

  function viewDeep(d) {
    const i = DEEP.indexOf(d);
    const prev = DEEP[i - 1], next = DEEP[i + 1];
    const D = d.diagram;
    const rel = (d.related || []).filter(id => qById[id]);
    const graph = D && (D.layers || []).length && window.HubGraph
      ? `${section('diagram', 'Diagram', `Hover or tap a box to see what it does and what it talks to.${(D.paths || []).length ? ' Pick a path to trace it step by step.' : ''}`)}
        <figure class="card hld p-4 sm:p-6" data-src="deep:${d.id}">${pathChips(D, 'Everything')}<p class="hld-note mt-2 min-h-5 text-sm text-ink-3" aria-live="polite"></p><div class="graph-box mt-2" data-graph="deep:${d.id}"></div></figure>`
      : '';
    return `${back(to('patterns', 'deep-dives'), 'All deep dives')}
      ${head(`Deep dive · ${esc(d.family)}`, d.title, d.summary)}
      ${section('problem', 'The problem')}<p class="rich max-w-3xl text-[0.97rem] leading-relaxed text-ink-2">${d.problem}</p>
      ${section('how', 'How it works')}<ol class="flex flex-col gap-2.5">${(d.how || []).map((s, k) => `<li class="card flex gap-3.5 p-4"><span class="num grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">${k + 1}</span><p class="rich min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-ink-2">${s}</p></li>`).join('')}</ol>
      ${d.id === 'saga' ? sagaFigures() : graph}
      ${d.example ? `<div class="mt-5 rounded-2xl bg-accent-soft p-5"><p class="eyebrow mb-1.5 !text-accent">Example</p><p class="rich text-[0.95rem] leading-relaxed text-ink">${d.example}</p></div>` : ''}
      ${(d.variants || []).length ? `${section('variants', 'Variants')}<div class="grid gap-3 sm:grid-cols-2">${d.variants.map(v => `<div class="card p-5"><h3 class="title-md">${v[0]}</h3><p class="rich mt-1.5 text-sm leading-relaxed text-ink-2">${v[1]}</p></div>`).join('')}</div>` : ''}
      ${(d.alternatives || []).length ? `${section('alternatives', 'Alternatives, and when to pick them instead')}${rtable(['Instead', 'Pick it when'], d.alternatives.map(a => [a[0] && deepById.has(a[0]) ? `<a class="link" href="${to('patterns', a[0])}">${a[1]}</a>` : a[1], a[2]]))}` : ''}
      ${section('when', 'When to use it, and when not')}<div class="card p-5">${usage(d.use, d.avoid)}</div>
      ${(d.pitfalls || []).length ? `${section('pitfalls', 'Pitfalls')}<ul class="points rich">${d.pitfalls.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
      ${(d.interview || []).length ? `${section('interview', 'In the interview')}<ul class="flex flex-col gap-2">${d.interview.map(q => `<li class="card flex gap-3 p-4">${icon('message-square-text', 'size-4 mt-0.5 text-accent')}<span class="rich min-w-0 text-sm leading-relaxed">${q}</span></li>`).join('')}</ul>` : ''}
      ${rel.length ? `${section('practice', 'Practice in the vault')}<ul class="flex flex-col gap-2">${rel.map(id => `<li><a class="card card-link flex items-center gap-3 p-3.5" href="${to('vault', id)}"><span class="status-dot" data-s="${statusOf(id)}"></span><span class="num w-9 shrink-0 text-xs text-accent">${id}</span><span class="min-w-0 flex-1 text-sm font-medium">${esc(qById[id].title)}</span>${icon('chevron-right', 'size-4 text-ink-3')}</a></li>`).join('')}</ul>` : ''}
      ${(d.sources || []).length ? `${section('sources', 'Sources')}<ul class="flex flex-col gap-2">${d.sources.map(sourceRow).join('')}</ul>` : ''}
      ${pager(prev ? { href: to('patterns', prev.id), label: esc(strip(prev.title)) } : null, next ? { href: to('patterns', next.id), label: esc(strip(next.title)) } : null)}`;
  }

  /* ----- databases ----- */
  const DB_FAMILIES = [['Operational', 'Serve the app: reads and writes by key or by row, in milliseconds'], ['Analytical', 'Answer questions over lots of data: scans, aggregates, history'], ['Specialized', 'Built for one kind of query: text, relationships or similarity']];
  const SAMPLE = [['1', 'u7', 'IN', '120'], ['2', 'u2', 'US', '40'], ['3', 'u7', 'IN', '99'], ['4', 'u9', 'DE', '15']];
  const strip4 = (y, vals, cls) => vals.map((v, i) => `<rect x="${86 + i * 58}" y="${y}" width="54" height="24" rx="5" class="${cls}"/><text x="${113 + i * 58}" y="${y + 16}" text-anchor="middle" class="svg-s svg-ink">${v}</text>`).join('');
  const ROW_STORE = `<svg viewBox="0 0 330 196" class="h-auto w-full" role="img" aria-label="A row store keeps each row together on disk, so a sum over one column still reads all four rows and every field."><text x="16" y="18" class="svg-m svg-ink3">ROW STORE · ONE ROW TOGETHER</text>
    ${SAMPLE.map((r, k) => `<text x="16" y="${50 + k * 32}" class="svg-s svg-ink2">row ${k + 1}</text>${strip4(34 + k * 32, r, 'svg-acc')}`).join('')}
    <text x="16" y="184" class="svg-s svg-ink2">Reads all 4 rows, every field.</text></svg>`;
  const COL_STORE = `<svg viewBox="0 0 330 196" class="h-auto w-full" role="img" aria-label="A column store keeps each column in its own file, so the query reads only the country and amount columns."><text x="16" y="18" class="svg-m svg-ink3">COLUMN STORE · ONE COLUMN TOGETHER</text>
    ${['id', 'user', 'country', 'amount'].map((c, k) => `<text x="16" y="${50 + k * 32}" class="svg-s svg-ink2">${c}</text><g class="${k < 2 ? 'svg-dim' : ''}">${strip4(34 + k * 32, SAMPLE.map(r => r[k]), k < 2 ? 'svg-box' : 'svg-acc')}</g>`).join('')}
    <text x="16" y="184" class="svg-s svg-ink2">Reads 2 of 4 columns; runs like IN, IN compress well.</text></svg>`;

  const dbCard = t => `<a href="${to('databases', t.id)}" class="card card-link flex flex-col gap-2 p-5"><h3 class="title-md">${esc(t.name)}</h3><p class="text-sm leading-relaxed text-ink-2">${t.summary}</p><p class="mt-auto pt-2 text-xs leading-relaxed text-ink-3"><span class="font-medium text-ink-2">Examples:</span> ${t.examples.map(e => esc(strip(e[0]))).join(', ')}</p></a>`;
  const typeLink = id => { const t = dbById.get(id); return t ? `<a class="link font-medium" href="${to('databases', id)}">${esc(t.name)}</a>` : esc(id); };

  function viewDatabases(r) {
    if (!DBT.length) return head('Databases', 'Types of databases', '') + empty('The database guide is not included in this copy', 'Add the data/db-*.js files to enable it.');
    if (r.detail) { const t = dbById.get(r.detail); return t ? viewDb(t) : notFound(); }
    const fams = DB_FAMILIES.filter(f => DBT.some(t => t.family === f[0]));
    const guideLinks = ['sql-vs-nosql', 'oltp-olap-search', 'btree-vs-lsm', 'replication-modes', 'consistency-levels', 'sharding-keys', 'normalize-denormalize', 'id-generation', 'aws-database'].map(id => GUIDES.find(g => g.id === id)).filter(Boolean);
    const p1 = H.phases.find(p => p.topics.some(t => t.id === 'p1-nosql'));
    const dq = Q.filter(q => /^d\d+$/.test(q.id));
    return `${head(`Databases · ${DBT.length} types`, 'Pick the store from the access pattern',
      'Every database is a bet on how data will be written and read. Learn what each type is built for and how it stores data, then match it to the workload. Most real systems run two to four of them.')}
      ${section('types', 'The types', 'Open one for how it works inside, a diagram, data modeling, products, pitfalls and interview questions.')}
      <div class="flex flex-col gap-8">${fams.map(([f, sub]) => `<div><p class="eyebrow">${esc(f)}</p><p class="mt-1 mb-3 text-sm text-ink-3">${sub}</p><div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">${DBT.filter(t => t.family === f).map(dbCard).join('')}</div></div>`).join('')}</div>
      ${section('compare', 'Compare at a glance')}${rtable(['Type', 'Data model', 'Best at', 'Weak at', 'Scales by', 'Consistency'], DBT.map(t => [typeLink(t.id), t.glance.model, t.glance.bestAt, t.glance.weakAt, t.glance.scale, t.glance.consistency]))}
      ${(DB.finder || []).length ? `${section('finder', 'Which database for this workload', 'Find the requirement, read across. Then check the type page for the traps.')}
      <label class="sr-only" for="db-q">Filter workloads</label><input id="db-q" type="search" class="field mb-3 max-w-md" placeholder="Filter, for example: chat, metrics, search">
      <div id="db-finder">${rtable(['Workload', 'Reach for', 'Why'], DB.finder.map(f => [f[0], typeLink(f[1]), f[2]]))}</div>` : ''}
      ${section('row-vs-column', 'Row vs column storage', 'The same table, two layouts. This one choice decides whether a database is good at transactions or at analytics.')}
      <figure class="card p-4 sm:p-5"><p class="text-sm text-ink-2">Query: <code class="font-mono text-[0.85em]">SELECT sum(amount) FROM orders WHERE country = 'IN'</code></p>
        <div class="@container mt-3"><div class="grid gap-4 @2xl:grid-cols-2"><div class="panel p-3">${ROW_STORE}</div><div class="panel p-3">${COL_STORE}</div></div></div>
        <figcaption class="mt-3 text-sm leading-relaxed text-ink-2">A point lookup flips the result: <code class="font-mono text-[0.85em]">SELECT * FROM orders WHERE id = 3</code> reads one row in a row store but touches every column file in a column store. Row stores (Postgres, MySQL) suit OLTP; column stores (ClickHouse, Redshift, BigQuery) suit OLAP. Wide-column stores like Cassandra are row stores grouped by partition, not column stores.</figcaption></figure>
      ${(DB.indexes || []).length ? `${section('indexes', 'Index types', `How a store finds data without scanning everything. Storage engines compared: <a class="link" href="${to('tradeoffs', 'btree-vs-lsm')}">B-tree vs LSM-tree</a>.`)}${rtable(['Index', 'How it works', 'Good for', 'Used by'], DB.indexes.map(x => [x[0], x[1], x[2], x[3]]))}` : ''}
      ${(DB.confusions || []).length ? `${section('confusions', 'Confusions interviewers probe')}<div class="grid gap-3 sm:grid-cols-2">${DB.confusions.map(c => `<div class="card flex flex-col gap-2 p-5"><p class="rich text-sm font-medium text-ink"><span class="text-bad">Myth:</span> ${c[0]}</p><p class="rich text-sm leading-relaxed text-ink-2"><span class="font-medium text-good">Reality:</span> ${c[1]}</p></div>`).join('')}</div>` : ''}
      ${DB.polyglot && (DB.polyglot.stores || []).length ? `${section('polyglot', 'One product, many databases', `Example: ${esc(DB.polyglot.system)}. Each need goes to the store built for it.`)}${rtable(['Need', 'Type', 'Product', 'Why'], DB.polyglot.stores.map(x => [x[0], typeLink(x[1]), x[2], x[3]]))}` : ''}
      ${(DB.specialized || []).length ? `${section('specialized', 'Other stores worth knowing')}${rtable(['Store', 'What it is', 'Examples'], DB.specialized.map(x => [x[0], x[1], x[2]]))}` : ''}
      ${section('deeper', 'Go deeper')}
      <div class="grid gap-4 md:grid-cols-2">
        <div class="card p-5"><p class="eyebrow mb-3">Decision guides</p><ul class="flex flex-col gap-2 text-sm">${guideLinks.map(g => `<li><a class="link" href="${to('tradeoffs', g.id)}">${g.title}</a></li>`).join('')}</ul></div>
        <div class="card p-5"><p class="eyebrow mb-3">Practice</p><ul class="flex flex-col gap-2 text-sm">${p1 ? `<li><a class="link" href="${phaseHref(p1)}">Roadmap: P${p1.n} · ${esc(p1.title)}</a></li>` : ''}${dq.map(q => `<li><a class="link" href="${to('vault', q.id)}">${q.id} · ${esc(q.title)}</a></li>`).join('')}</ul></div>
      </div>`;
  }

  function viewDb(t) {
    const i = DBT.indexOf(t);
    const prev = DBT[i - 1], next = DBT[i + 1];
    const D = t.diagram;
    const G = t.glance || {};
    const tile = (k, v) => `<div class="flex flex-col gap-1 bg-surface p-4"><dt class="eyebrow">${k}</dt><dd class="rich text-sm leading-relaxed text-ink">${v || ''}</dd></div>`;
    const guides = (t.guides || []).map(id => GUIDES.find(g => g.id === id)).filter(Boolean);
    const deeps = (t.deep || []).map(id => deepById.get(id)).filter(Boolean);
    const rel = (t.related || []).filter(id => qById[id]);
    return `${back(to('databases'), 'All databases')}
      ${head(`Database type · ${esc(t.family)}`, esc(t.name), t.summary)}
      <dl class="grid gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-[var(--shadow-soft)] sm:grid-cols-2 lg:grid-cols-3">${tile('Data model', G.model)}${tile('You query it with', G.query)}${tile('Best at', G.bestAt)}${tile('Weak at', G.weakAt)}${tile('Scales by', G.scale)}${tile('Consistency', G.consistency)}</dl>
      ${section('how', 'How it stores and finds data')}<ol class="flex flex-col gap-2.5">${(t.how || []).map((s, k) => `<li class="card flex gap-3.5 p-4"><span class="num grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">${k + 1}</span><p class="rich min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-ink-2">${s}</p></li>`).join('')}</ol>
      ${D && (D.layers || []).length && window.HubGraph ? `${section('diagram', 'Inside the engine', `Hover or tap a box to see what it does.${(D.paths || []).length ? ' Pick a path to trace a write or a read.' : ''}`)}
        <figure class="card hld p-4 sm:p-6" data-src="db:${t.id}">${pathChips(D, 'Everything')}<p class="hld-note mt-2 min-h-5 text-sm text-ink-3" aria-live="polite"></p><div class="graph-box mt-2" data-graph="db:${t.id}"></div></figure>` : ''}
      ${(t.modeling || []).length ? `${section('modeling', 'Modeling data in it')}<ul class="points rich">${t.modeling.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
      ${section('strengths', 'Strengths and weaknesses')}
      <div class="grid gap-3 sm:grid-cols-2"><div class="card p-5"><p class="eyebrow mb-3 !text-good">Strengths</p><ul class="points rich">${(t.strengths || []).map(x => `<li>${x}</li>`).join('')}</ul></div><div class="card p-5"><p class="eyebrow mb-3 !text-bad">Weaknesses</p><ul class="points rich">${(t.weaknesses || []).map(x => `<li>${x}</li>`).join('')}</ul></div></div>
      ${section('when', 'When to use it, and when not')}<div class="card p-5">${usage(t.use, t.avoid)}</div>
      ${(t.examples || []).length ? `${section('products', 'Products')}${rtable(['Product', 'Known for', 'Managed options'], t.examples.map(e => [e[0], e[1], e[2] || '<span class="text-ink-3">Self-hosted</span>']))}` : ''}
      ${(t.pitfalls || []).length ? `${section('pitfalls', 'Pitfalls')}<ul class="points rich">${t.pitfalls.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
      ${(t.interview || []).length ? `${section('interview', 'In the interview')}<ul class="flex flex-col gap-2">${t.interview.map(q => `<li class="card flex gap-3 p-4">${icon('message-square-text', 'size-4 mt-0.5 text-accent')}<span class="rich min-w-0 text-sm leading-relaxed">${q}</span></li>`).join('')}</ul>` : ''}
      ${relatedBlock({ guides, deeps, qs: rel })}
      ${(t.sources || []).length ? `${section('sources', 'Sources')}<ul class="flex flex-col gap-2">${t.sources.map(sourceRow).join('')}</ul>` : ''}
      ${pager(prev ? { href: to('databases', prev.id), label: esc(prev.name) } : null, next ? { href: to('databases', next.id), label: esc(next.name) } : null)}`;
  }

  /* ----- AWS ----- */
  function viewAws() {
    if (!AWS.groups.length) return head('AWS', 'Which AWS service, when', '') + empty('The AWS guide is not included in this copy', 'Add the data/aws-*.js files to enable it.');
    const n = AWS.groups.reduce((a, g) => a + g.services.length, 0);
    const awsGuides = GUIDES.filter(g => g.area === 'AWS');
    return `${head(`AWS · ${n} services`, 'Which AWS service, when', 'Every system design building block has a managed AWS answer. For each service: what it is, when to use it, when not to, the traps, and the limits that change your design.')}
      ${AWS.map && AWS.map.length ? `${section('aws-map', 'Building block → AWS service', 'Translate a whiteboard box into the service you would actually run.')}${rtable(['Building block', 'On AWS', 'When'], AWS.map.map(r => [r[0], `<strong class="text-ink">${r[1]}</strong>`, r[2]]))}` : ''}
      ${awsGuides.length ? `${section('aws-guides', 'AWS decision guides', 'The common forks, with when to pick each side.')}<div class="grid gap-3 sm:grid-cols-2">${awsGuides.map(g => `<a href="${to('tradeoffs', g.id)}" class="card card-link flex flex-col gap-2 p-5"><h3 class="title-md">${g.title}</h3><p class="text-sm text-ink-2">${g.question}</p><p class="mt-auto pt-1 text-xs leading-relaxed text-ink-3"><span class="font-medium text-ink-2">Rule:</span> ${g.rule}</p></a>`).join('')}</div>` : ''}
      <label class="sr-only" for="aws-q">Filter services</label><input id="aws-q" type="search" class="field mt-12 mb-8 max-w-md" placeholder="Filter services, for example: queue, cache, secrets">
      <div class="flex flex-col gap-12">${AWS.groups.map(g => `<div class="aws-group">${section(`ag-${slug(g.name)}`, esc(g.name))}<div class="grid gap-3 sm:grid-cols-2">${g.services.map(v => {
        return `<article class="card aws scroll-mt-24 flex flex-col gap-2.5 p-5" id="aws-${slug(v.name)}" data-hay="${esc(`${v.name} ${strip(v.what)} ${strip(v.use)} ${g.name}`.toLowerCase())}">
          <h3 class="title-md">${v.name}</h3><p class="text-sm leading-relaxed text-ink">${v.what}</p>
          ${usage(v.use, v.avoid)}
          ${(v.gotchas || []).length ? `<div><p class="eyebrow mb-1.5 !text-warn">Gotchas</p><ul class="points rich">${v.gotchas.map(x => `<li>${x}</li>`).join('')}</ul></div>` : ''}
          ${(v.limits || []).length ? `<div class="flex flex-wrap gap-1.5">${v.limits.map(x => `<span class="chip h-auto py-1 leading-snug whitespace-normal">${x}</span>`).join('')}</div>` : ''}
          ${learn(v.res)}</article>`;
      }).join('')}</div></div>`).join('')}</div>
      <p class="empty-note mt-6 text-sm text-ink-3" hidden>No services match. Clear the filter.</p>
      ${(AWS.costTraps || []).length ? `${section('aws-costs', 'Cost traps', 'The bills that surprise teams, and what to do instead.')}<div class="grid gap-3">${AWS.costTraps.map(r => `<div class="card flex flex-col gap-1 p-4"><h3 class="title-md">${r[0]}</h3><p class="text-sm leading-relaxed text-ink-2">${r[1]}</p></div>`).join('')}</div>` : ''}
      ${(AWS.pillars || []).length ? `${section('aws-pillars', 'Well-Architected, one line each')}${rtable(['Pillar', 'In plain words'], AWS.pillars.map(r => [r[0], r[1]]))}` : ''}`;
  }

  /* ----- tools ----- */
  function viewTools() {
    const groups = H.toolGroups || [];
    const n = groups.reduce((a, g) => a + g.tools.length, 0);
    return `${head(`Tools · ${n} in plain words`, 'What is X, and when not to use it', `What each tool is, when to reach for it, when to avoid it. The concepts behind them live in the roadmap.`)}
      <label class="sr-only" for="tool-q">Filter tools</label><input id="tool-q" type="search" class="field mb-8 max-w-md" placeholder="Filter, for example: queue, Altinity, traces">
      <div class="flex flex-col gap-12">${groups.map(g => `<div class="tool-group">${section(`tg-${slug(g.name)}`, esc(g.name))}<div class="grid gap-3 sm:grid-cols-2">${g.tools.map(t => {
        const v = Object.assign({ avoid: t.avoid, tradeoff: t.tradeoff }, (TO.tools || {})[t.name] || {});
        return `<article class="card tool scroll-mt-24 flex flex-col gap-2.5 p-5" id="tool-${slug(t.name)}" data-hay="${esc(`${t.name} ${t.what} ${t.use} ${g.name}`.toLowerCase())}">
          <h3 class="title-md">${esc(t.name)}</h3><p class="text-sm leading-relaxed text-ink">${esc(t.what)}</p>
          ${usage(esc(t.use), v.avoid, v.tradeoff)}${learn(t.res)}</article>`;
      }).join('')}</div></div>`).join('')}</div>
      <p class="empty-note mt-6 text-sm text-ink-3" hidden>No tools match. Clear the filter.</p>`;
  }

  /* ----- resources ----- */
  function allResources() {
    const seen = new Set();
    const out = [];
    const push = r => { if (r && r.url && !seen.has(r.url)) { seen.add(r.url); out.push(r); } };
    Object.values(RES).forEach(push);
    TRACKS.forEach(t => t.topics.forEach(x => (x.res || []).forEach(r => push(resOf(r)))));
    return out;
  }

  function viewResources() {
    const groups = (H.resGroups || []).map(g => [g[0], g[1].map(id => RES[id]).filter(Boolean)]);
    const seen = new Set(groups.flatMap(g => g[1].map(r => r.url)));
    TRACKS.forEach(t => {
      const list = [];
      t.topics.forEach(x => (x.res || []).map(resOf).forEach(r => { if (r && !seen.has(r.url)) { seen.add(r.url); list.push(r); } }));
      if (list.length) groups.push([`Track: ${t.short}`, list]);
    });
    const total = groups.reduce((a, g) => a + g[1].length, 0);
    const row = r => `<li class="res flex flex-col gap-1 py-3.5" data-hay="${esc(`${r.t} ${r.by} ${r.why} ${r.type}`.toLowerCase())}"><div class="flex flex-wrap items-baseline gap-x-2 gap-y-1"><a class="link font-medium" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.t)}</a><span class="text-xs text-ink-3">${esc(r.by || '')}</span><span class="num ml-auto text-[0.7rem] text-ink-3">${esc(r.type || '')} · ${r.free === false ? 'paid' : 'free'}</span></div><p class="text-sm text-ink-2">${esc(r.why || '')}</p></li>`;
    return `${head(`Resources · ${total} links`, 'The shelf', 'Free first. Each topic already links the few that matter for it; this page is everything in one place.')}
      <label class="sr-only" for="res-q">Filter resources</label><input id="res-q" type="search" class="field mb-6 max-w-md" placeholder="Filter, for example: kafka, free book, video">
      ${(H.top7 || []).length ? `<div class="card mb-12 scroll-mt-24 p-5 sm:p-6" id="top7" data-toc="If you only do seven"><h2 class="title-md">If you only do seven things</h2><ol class="mt-3 flex flex-col gap-2.5">${H.top7.map((t, i) => `<li class="flex gap-3 text-sm leading-relaxed text-ink-2"><span class="num grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">${i + 1}</span><span>${esc(t)}</span></li>`).join('')}</ol></div>` : ''}
      <div class="flex flex-col gap-12">${groups.map(g => `<div class="res-group">${section(`rg-${slug(g[0])}`, esc(g[0]))}<ul class="card divide-y divide-line px-5">${g[1].map(row).join('')}</ul></div>`).join('')}</div>
      <p class="empty-note mt-6 text-sm text-ink-3" hidden>Nothing matches. Clear the filter.</p>`;
  }

  /* ----- vault notebook ----- */
  const vf = { q: '', cat: '', diff: '', phase: '', status: '', open: false };
  const fmtTime = ts => { const d = new Date(ts); return new Date().toDateString() === d.toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' }); };
  const phaseLabel = n => { const p = phaseByN(n); return `P${n}${p ? ` · ${p.short}` : ''}`; };
  const credit = `<a class="link" href="https://www.puneetpatwari.in/sample-question" target="_blank" rel="noopener">Puneet Patwari's System Design Q&amp;A Vault</a>`;

  function modelHTML(q) {
    const a = ANS[q.id];
    let h = '';
    if (a) {
      h += `<p class="rounded-xl bg-accent-soft p-3.5 text-[0.95rem] leading-relaxed text-ink">${a.tldr}</p><div class="prose-hub">${a.body}</div>`;
      h += `<div><p class="eyebrow mb-2">What the interviewer asks next</p><ol class="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">${a.followups.map(f => `<li>${f}</li>`).join('')}</ol></div>`;
      const rel = (a.related || []).filter(r => qById[r] && r !== q.id);
      if (rel.length) h += `<div class="flex flex-wrap items-center gap-2 text-xs text-ink-3">Related:${rel.map(r => `<a class="chip" href="${to('articles', r)}" title="${esc(qById[r].title)}">${r}</a>`).join('')}</div>`;
    } else h += '<p class="text-sm text-ink-3">This model answer is not included in this copy.</p>';
    if (q.free) h += `<p class="text-sm text-ink-2">Free official answer to compare with: <a class="link" href="${q.free}" target="_blank" rel="noopener">Puneet's version</a></p>`;
    return h;
  }

  function qCard(q) {
    const n = notes[q.id] || {};
    const s = statusOf(q.id);
    return `<article class="card vq scroll-mt-40 p-4 sm:p-5" id="${q.id}" data-q="${q.id}">
      <div class="flex flex-wrap items-center gap-2"><span class="num text-xs font-semibold text-accent">${q.id}</span><span class="chip ${DIFF[q.difficulty] || ''}">${q.difficulty}</span><a class="chip" href="${phaseHref(phaseByN(q.phase))}" title="Where this sits in the roadmap">${esc(phaseLabel(q.phase))}</a><span class="hidden text-xs text-ink-3 sm:inline">${q.tags.map(esc).join(' · ')}</span></div>
      <h3 class="title-md mt-2.5">${esc(q.title)}</h3>
      <label class="eyebrow mt-4 block" for="ans-${q.id}">Your answer</label>
      <textarea id="ans-${q.id}" class="field mt-2" data-ans="${q.id}" placeholder="Answer it like you would out loud: the core idea, how you would build it, the trade-offs, one example.">${esc(n.text || '')}</textarea>
      <div class="mt-3 flex flex-wrap items-center gap-2"><div class="seg" role="radiogroup" aria-label="Status for ${q.id}">${STATUS.map(([v, l]) => `<button type="button" role="radio" data-set-status="${v}" data-s="${v}" data-qid="${q.id}" aria-checked="${s === v}">${l}</button>`).join('')}</div>
        <button type="button" class="btn btn-sm btn-ghost" data-copy="${q.id}">${icon('copy', 'size-3.5')} Copy for grading</button><span class="ml-auto text-xs text-ink-3" id="sv-${q.id}">${n.updated ? `Saved ${fmtTime(n.updated)}` : ''}</span></div>
      <a class="mt-4 flex items-center gap-2 border-t border-line pt-3 text-sm font-medium text-accent hover:underline" href="${to('articles', q.id)}">${icon('book-open-text', 'size-4')}Model answer${icon('arrow-right', 'size-4')}</a>
    </article>`;
  }

  function viewVault() {
    if (!Q.length) return head('Vault notebook', 'Practice questions', '') + empty('The question files are not included in this copy', 'Add data/vault-questions.js and the answers-w*.js files to enable the notebook.');
    const phaseNums = [...new Set(Q.map(q => q.phase))].sort((a, b) => a - b);
    const opt = (v, l, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(l)}</option>`;
    return `${head(`Vault notebook · ${Q.length} questions`, 'Answer first, then compare',
      `The public question list from ${credit}, with original model answers. Write yours in the box (it saves as you type), then open the model answer to compare, and mark how sure you feel. All model answers are also listed under <a class="link" href="${to('articles')}">Articles</a>.`)}
      <div class="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div class="flex items-center gap-3">${ringWithPct('vault', 'size-12', 'text-[0.68rem]')}<div><p class="text-xs text-ink-3">Answered</p><p class="num font-medium" data-count="vault">${tally('vault').join('/')}</p></div></div>
        <div class="flex gap-5 text-sm"><span><span class="num font-medium" id="st-sure">0</span> <span class="text-ink-3">confident</span></span><span><span class="num font-medium" id="st-again">0</span> <span class="text-ink-3">to revisit</span></span></div>
        <div class="flex flex-wrap gap-1.5 sm:ml-auto"><button type="button" class="btn btn-sm btn-ghost" data-action="export-md">${icon('download', 'size-3.5')} Export .md</button><button type="button" class="btn btn-sm btn-ghost" data-action="export-json">${icon('download', 'size-3.5')} Backup</button><label class="btn btn-sm btn-ghost" for="vault-import">${icon('upload', 'size-3.5')} Restore</label><input type="file" id="vault-import" accept="application/json,.json" class="sr-only"></div>
      </div>
      ${storageOk ? '' : '<p class="mb-4 rounded-xl bg-bad-soft p-3 text-sm text-bad">Browser storage is blocked, so answers will not be kept. Export before you close the page.</p>'}
      <div class="sticky-under-bar z-20 -mx-2 mb-6 bg-canvas/90 px-2 py-2 backdrop-blur-xl lg:py-3"><div class="rounded-2xl border border-line bg-surface p-2.5 shadow-[var(--shadow-soft)]">
        <div class="flex items-center gap-2"><div class="relative min-w-0 flex-1"><span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">${icon('search')}</span><label for="vq-q" class="sr-only">Search questions</label><input id="vq-q" type="search" class="field pl-9" placeholder="Search questions, tags or ids" value="${esc(vf.q)}"></div>
          <button type="button" class="btn md:hidden" data-action="toggle-filters" aria-expanded="${vf.open}" aria-controls="vq-filters">${icon('sliders-horizontal')}<span class="max-[380px]:sr-only">Filters</span></button>
          <button type="button" class="btn btn-primary" data-action="pick">${icon('shuffle')}<span class="max-sm:sr-only">Pick one</span></button></div>
        <div id="vq-filters" class="${vf.open ? 'grid' : 'hidden'} mt-2 grid-cols-2 gap-2 md:grid md:grid-cols-4">
          <label class="sr-only" for="vq-cat">Category</label><select id="vq-cat" class="field">${opt('', 'All categories', vf.cat)}${CATS.map(c => opt(c.key, c.name, vf.cat)).join('')}</select>
          <label class="sr-only" for="vq-diff">Level</label><select id="vq-diff" class="field">${opt('', 'All levels', vf.diff)}${Object.keys(DIFF).map(d => opt(d, d, vf.diff)).join('')}</select>
          <label class="sr-only" for="vq-phase">Phase</label><select id="vq-phase" class="field">${opt('', 'All phases', vf.phase)}${phaseNums.map(n => opt(n, phaseLabel(n), vf.phase)).join('')}</select>
          <label class="sr-only" for="vq-status">Status</label><select id="vq-status" class="field">${opt('', 'Any status', vf.status)}${STATUS.map(([v, l]) => opt(v, l, vf.status)).join('')}</select></div>
      </div></div>
      ${CATS.map(c => { const qs = Q.filter(q => q.category === c.name); return `<section class="vq-cat mt-10 scroll-mt-40 first-of-type:mt-0" id="cat-${c.key}" data-toc="${esc(c.name)}" data-toc-ring="cat:${c.key}"><div class="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 class="title-lg">${esc(c.name)}</h2><span class="num text-sm text-ink-3"><span data-count="cat:${c.key}">${tally(`cat:${c.key}`).join('/')}</span> answered</span></div><div class="flex flex-col gap-4">${qs.map(qCard).join('')}</div></section>`; }).join('')}
      <p class="empty-note mt-8 text-sm text-ink-3" hidden>No questions match these filters. Clear the search or pick another filter.</p>`;
  }

  /* ----- articles ----- */
  function viewArticles(r) {
    if (!Q.length) return head('Articles', 'Model answers', '') + empty('The question files are not included in this copy', 'Add data/vault-questions.js and the answers-w*.js files to enable articles.');
    if (r.detail) return viewArticle(r.detail);
    return `${head(`Articles · ${Q.length} model answers`, 'Read the answers',
      `Original write-ups for every question in ${credit}. Try answering in the <a class="link" href="${to('vault')}">notebook</a> first; read here when you want the full explanation.`)}
      <label class="sr-only" for="art-q">Filter articles</label><input id="art-q" type="search" class="field mb-6 max-w-md" placeholder="Filter, for example: cache, kafka, c10">
      ${CATS.map(c => { const qs = Q.filter(q => q.category === c.name); return `<section class="art-cat mt-10 scroll-mt-24 first-of-type:mt-0" id="cat-${c.key}" data-toc="${esc(c.name)}"><h2 class="title-lg mb-4">${esc(c.name)}</h2><ul class="card divide-y divide-line overflow-hidden">${qs.map(q => `<li class="art" data-hay="${esc(`${q.id} ${q.title} ${q.tags.join(' ')}`.toLowerCase())}"><a href="${to('articles', q.id)}" class="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted sm:px-5"><span class="status-dot" data-s="${statusOf(q.id)}" title="Your answer: ${statusOf(q.id)}"></span><span class="num w-9 shrink-0 text-xs text-accent">${q.id}</span><span class="min-w-0 flex-1 text-sm font-medium">${esc(q.title)}</span><span class="chip ${DIFF[q.difficulty] || ''} max-sm:hidden">${q.difficulty}</span>${icon('chevron-right', 'size-4 text-ink-3')}</a></li>`).join('')}</ul></section>`; }).join('')}
      <p class="empty-note mt-8 text-sm text-ink-3" hidden>No articles match. Clear the filter.</p>`;
  }

  function viewArticle(id) {
    const q = qById[id];
    if (!q) return notFound();
    const i = Q.indexOf(q);
    const prev = Q[i - 1], next = Q[i + 1];
    const mine = notes[id] && notes[id].text && notes[id].text.trim();
    const fromVault = navStack[navStack.length - 2] === 'vault/';
    return `<article class="mx-auto max-w-3xl">
      ${fromVault ? back(to('vault', q.id), 'Back to your answer') : back(to('articles'), 'All articles')}
      <p class="eyebrow">${esc(q.category)} · ${q.difficulty} · ${q.id}</p>
      <h1 class="title-xl mt-3">${esc(q.title)}</h1>
      <div class="mt-4 flex flex-wrap items-center gap-2">${q.tags.map(t => `<span class="chip">${esc(t)}</span>`).join('')}<a class="btn btn-sm sm:ml-auto" href="${to('vault', q.id)}">${icon('notebook-pen', 'size-3.5')} ${mine ? 'Edit your answer' : 'Answer it in the notebook'}</a></div>
      <div class="mt-8 flex flex-col gap-5" data-article-body>${modelHTML(q)}</div>
      ${mine ? `<div class="card mt-8 p-5"><p class="eyebrow mb-2">Your answer</p><p class="text-sm leading-relaxed whitespace-pre-line text-ink-2">${esc(notes[id].text)}</p></div>` : ''}
      <p class="mt-8 text-xs text-ink-3">Question from ${credit}. The answer above is original.</p>
      ${pager(prev ? { href: to('articles', prev.id), label: `${prev.id} · ${esc(prev.title)}` } : null, next ? { href: to('articles', next.id), label: `${next.id} · ${esc(next.title)}` } : null)}
    </article>`;
  }

  function notFound() {
    return `${head('Not found', 'That page does not exist', 'The link may be old, or the content may not be part of this copy.')}${empty('Try search instead', `Press ${isMac ? '⌘K' : 'Ctrl K'} and type what you were looking for.`)}`;
  }

  /* ---------- vault behavior ---------- */
  function vaultStats() {
    const c = { sure: 0, again: 0 };
    Q.forEach(q => { const s = statusOf(q.id); if (c[s] != null) c[s]++; });
    const a = $('#st-sure'), b = $('#st-again');
    if (a) a.textContent = c.sure;
    if (b) b.textContent = c.again;
  }

  function applyVaultFilters() {
    const term = vf.q.trim().toLowerCase();
    let shown = 0;
    Q.forEach(q => {
      const el = document.getElementById(q.id);
      if (!el) return;
      const catKey = (CATS.find(c => c.name === q.category) || {}).key;
      const hay = `${q.id} ${q.title} ${q.tags.join(' ')} ${q.category}`.toLowerCase();
      const ok = (!term || hay.includes(term)) && (!vf.cat || catKey === vf.cat) && (!vf.diff || q.difficulty === vf.diff) && (vf.phase === '' || String(q.phase) === String(vf.phase)) && (!vf.status || statusOf(q.id) === vf.status);
      el.hidden = !ok;
      if (ok) shown++;
    });
    $$('.vq-cat').forEach(s => { s.hidden = !s.querySelector('.vq:not([hidden])'); });
    const e = $('#view .empty-note');
    if (e) e.hidden = shown > 0;
  }

  function saveNote(id, patch) {
    notes[id] = Object.assign({}, notes[id] || {}, patch, { updated: Date.now() });
    storageOk = store.set(K.vault, notes);
    const sv = document.getElementById(`sv-${id}`);
    if (sv) sv.textContent = storageOk ? `Saved ${fmtTime(notes[id].updated)}` : 'Not saved: storage blocked';
    const s = statusOf(id);
    $$(`[data-qid="${id}"]`).forEach(b => b.setAttribute('aria-checked', String(b.dataset.setStatus === s)));
    refreshProgress();
    vaultStats();
  }

  const autosize = ta => { if (!CSS.supports('field-sizing', 'content')) { ta.style.height = 'auto'; ta.style.height = `${Math.max(120, ta.scrollHeight + 2)}px`; } };

  function pickQuestion(scopeVisible) {
    const pool0 = Q.filter(q => (!scopeVisible || !(document.getElementById(q.id) || {}).hidden));
    let pool = pool0.filter(q => statusOf(q.id) === 'todo');
    if (!pool.length) pool = pool0.filter(q => statusOf(q.id) === 'again');
    if (!pool.length) { toast('Nothing left to pick with these filters. Nice work.'); return; }
    const q = pool[Math.floor(Math.random() * pool.length)];
    go(to('vault', q.id));
    setTimeout(() => { const ta = document.getElementById(`ans-${q.id}`); if (ta) ta.focus({ preventScroll: true }); }, 500);
  }

  /* ---------- tables written as plain HTML (answers) become responsive ---------- */
  function enhanceTables(root) {
    $$('table:not(.rtable)', root).forEach(t => {
      let heads = $$('thead th', t).map(th => th.textContent.trim());
      if (!heads.length) {
        const first = t.querySelector('tr');
        if (first && first.querySelector('th') && !first.querySelector('td')) {
          heads = $$('th', first).map(th => th.textContent.trim());
          const thead = document.createElement('thead');
          thead.appendChild(first);
          t.insertBefore(thead, t.firstChild);
        }
      }
      $$('tr', t).forEach(tr => { if (tr.parentElement.tagName !== 'THEAD') $$('td', tr).forEach((td, i) => { td.dataset.label = heads[i] || ''; }); });
      t.classList.add('rtable');
      const w = document.createElement('div');
      w.className = 'rt-wrap';
      t.replaceWith(w);
      w.appendChild(t);
    });
  }

  /* ================= routing ================= */
  const RENDER = { home: viewHome, roadmap: viewRoadmap, tracks: viewTracks, labs: viewLabs, design: viewDesign, cases: viewCases, tradeoffs: viewTradeoffs, patterns: viewPatterns, databases: viewDatabases, aws: viewAws, tools: viewTools, resources: viewResources, vault: viewVault, articles: viewArticles };
  /* the second segment is a detail page only when it names one; otherwise it is a section on the index (#/articles/cat-d) */
  const IS_DETAIL = {
    roadmap: a => a === 'lld' || !!phaseByKey(a),
    tracks: a => !!trackById(a),
    cases: a => CASES.some(c => c.id === a),
    tradeoffs: a => GUIDES.some(g => g.id === a),
    articles: a => !!qById[a],
    databases: a => dbById.has(a),
    patterns: a => deepById.has(a)
  };
  const TARGET_PREFIX = { aws: ['aws-', 'ag-'], roadmap: ['tp-'], tracks: ['tp-'], tools: ['tool-', 'tg-'], patterns: ['pat-'], labs: ['lab-'], resources: ['rg-'], design: ['d-'], tradeoffs: ['area-'], vault: ['cat-'], articles: ['cat-'] };
  const PATTERN_SECTIONS = ['families', 'deep-dives', 'finder', 'dist-patterns', 'gof', 'solid', 'anti'];

  function parse() {
    const raw = decodeURIComponent(location.hash.slice(1));
    if (!raw || raw === '/') return { view: 'home' };
    if (!raw.startsWith('/')) return { legacy: raw };
    const [page = '', a = '', b = ''] = raw.slice(1).split('/');
    if (!RENDER[page]) return { view: 'notfound' };
    if (a && IS_DETAIL[page] && IS_DETAIL[page](a)) return { view: page, detail: a, target: b || null };
    return { view: page, detail: null, target: a || null };
  }

  /* old links (#roadmap, #ph3, #case-netflix, #read-c10, #c10 ...) keep working */
  function legacyRoute(h) {
    if (['home', 'start'].includes(h)) return to('');
    if (RENDER[h]) return to(h);
    let m;
    if ((m = h.match(/^ph(\d+)$/))) return to('roadmap', `p${m[1]}`);
    if (h === 'lld') return to('roadmap', 'lld');
    if (h.startsWith('tp-')) return topicHome.get(h.slice(3)) || to('roadmap');
    if (h.startsWith('track-')) return to('tracks', h.slice(6));
    if (h.startsWith('case-')) return to('cases', h.slice(5).split('--')[0]);
    if (h.startsWith('to-')) return to('tradeoffs', h.slice(3));
    if (h.startsWith('read-')) return to('articles', h.slice(5));
    if (h.startsWith('pat-') || PATTERN_SECTIONS.includes(h) || deepById.has(h)) return to('patterns', h);
    if (h.startsWith('tool-') || h.startsWith('tg-')) return to('tools', h);
    if (h.startsWith('lab-') || h === 'katas') return to('labs', h);
    if (h.startsWith('rg-') || h === 'top7') return to('resources', h);
    if (h.startsWith('d-')) return to('design', h);
    if (h.startsWith('cat-') || qById[h]) return to('vault', h);
    return to('');
  }

  const TITLES = { databases: 'Databases', aws: 'AWS', home: '', roadmap: 'Roadmap', tracks: 'Tracks', labs: 'Labs', design: 'HLD and LLD', cases: 'Case studies', tradeoffs: 'Trade-offs', patterns: 'Patterns', tools: 'Tools', resources: 'Resources', vault: 'Vault notebook', articles: 'Articles', notfound: 'Not found' };
  function pageTitle(view, r) {
    let detail = '';
    if (r.detail) {
      if (view === 'roadmap') { const p = phaseByKey(r.detail); detail = r.detail === 'lld' ? 'LLD side track' : p ? p.title : ''; }
      else if (view === 'tracks') { const t = trackById(r.detail); detail = t ? t.title : ''; }
      else if (view === 'cases') { const c = CASES.find(x => x.id === r.detail); detail = c ? c.name : ''; }
      else if (view === 'tradeoffs') { const g = GUIDES.find(x => x.id === r.detail); detail = g ? strip(g.title) : ''; }
      else if (view === 'articles') { const q = qById[r.detail]; detail = q ? q.title : ''; }
      else if (view === 'patterns') { const d = deepById.get(r.detail); detail = d ? strip(d.title) : ''; }
      else if (view === 'databases') { const t = dbById.get(r.detail); detail = t ? strip(t.name) : ''; }
    }
    return [detail, TITLES[view], 'System Design Study Hub'].filter(Boolean).join(' · ');
  }

  let currentKey = null;
  const scrollMem = {};
  const navStack = [];
  let spy = null;

  function go(hash) {
    if (location.hash === hash) route(); else location.hash = hash;
  }

  function route() {
    const r = parse();
    if (r.legacy !== undefined) { location.replace(legacyRoute(r.legacy)); return; }
    const view = r.view;
    const key = `${view}/${r.detail || ''}`;
    const fresh = key !== currentKey;
    const isBack = fresh && navStack.length > 1 && navStack[navStack.length - 2] === key;
    if (fresh) {
      if (currentKey) scrollMem[currentKey] = window.scrollY;
      if (isBack) navStack.pop(); else navStack.push(key);
    }
    const run = () => {
      if (fresh) {
        $('#view').innerHTML = view === 'notfound' ? notFound() : RENDER[view](r);
        currentKey = key;
        afterMount(view, r);
      }
      setNav(view);
      if (r.target) focusTarget(view, r.target, fresh);
      else if (fresh) window.scrollTo(0, isBack ? scrollMem[key] || 0 : 0);
    };
    if (fresh && currentKey && document.startViewTransition && !reduceMotion.matches) document.startViewTransition(run);
    else run();
  }

  function afterMount(view, r) {
    document.title = pageTitle(view, r);
    enhanceTables($('#view'));
    if (window.HubGraph) $$('#view [data-graph]').forEach(el => window.HubGraph.mount(el, graphData(el.dataset.graph), { labels: !el.dataset.graph.startsWith('hld:'), why: el.dataset.graph.startsWith('hld:') }));
    if (view === 'vault') {
      $$('#view textarea[data-ans]').forEach(autosize);
      applyVaultFilters();
      vaultStats();
    }
    buildToc(view, r);
  }

  function resolveTarget(view, target) {
    const cands = [target, ...(TARGET_PREFIX[view] || []).map(p => p + target)];
    for (const c of cands) { const el = document.getElementById(c); if (el) return el; }
    return null;
  }

  function focusTarget(view, target, fresh) {
    let el = resolveTarget(view, target);
    if (!el) { if (fresh) window.scrollTo(0, 0); return; }
    if (el.hidden && view === 'vault') {
      Object.assign(vf, { q: '', cat: '', diff: '', phase: '', status: '' });
      $$('#vq-q').forEach(i => { i.value = ''; });
      $$('#vq-filters select').forEach(s => { s.value = ''; });
      applyVaultFilters();
      el = resolveTarget(view, target);
    }
    const parentDetails = el.closest('details');
    if (parentDetails) parentDetails.open = true;
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'start', behavior: fresh || reduceMotion.matches ? 'auto' : 'smooth' });
      if (el.matches('.vq, .topic, .tool, .card') && !reduceMotion.matches) {
        el.animate([{ boxShadow: '0 0 0 3px var(--accent-soft)' }, { boxShadow: '0 0 0 3px transparent' }], { duration: 1600, easing: 'ease-out' });
      }
    });
  }

  function buildToc(view, r) {
    const toc = $('#toc');
    if (spy) { spy.disconnect(); spy = null; }
    const items = $$('#view [data-toc]');
    if (items.length < 2 || view === 'home') { toc.innerHTML = ''; return; }
    const base = to(view, r.detail || '');
    toc.innerHTML = `<p class="eyebrow mb-3 px-3">On this page</p><nav class="flex flex-col" aria-label="On this page">${items.map(el => `<a class="toclink" href="${base}/${el.id}" data-toc-link="${el.id}">${el.dataset.tocRing ? ring(el.dataset.tocRing, 'size-4', 5) : ''}<span class="min-w-0 flex-1 truncate">${el.dataset.toc}</span></a>`).join('')}</nav>`;
    const links = new Map($$('[data-toc-link]', toc).map(a => [a.dataset.tocLink, a]));
    /* active = the last section whose top has passed 30% of the viewport; tall sections stay active until the next one arrives */
    const update = () => {
      const line = window.innerHeight * 0.3;
      let cur = null;
      for (const el of items) {
        if (!el.getClientRects().length) continue;
        if (el.getBoundingClientRect().top > line) break;
        cur = el;
      }
      const id = (cur || items.find(el => el.getClientRects().length) || items[0]).id;
      links.forEach((a, k) => a.classList.toggle('is-active', k === id));
    };
    let queued = false;
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    spy = { disconnect: () => window.removeEventListener('scroll', onScroll) };
    update();
  }

  /* ================= search (Cmd/Ctrl + K) ================= */
  let INDEX = null;
  let sel = 0;
  const TYPE_ORDER = ['Page', 'Phase', 'Track', 'Case study', 'Database', 'Trade-off', 'AWS', 'Article', 'Pattern', 'Tool', 'Topic', 'Question', 'Lab', 'Resource'];
  const TYPE_ICON = { Database: 'database', AWS: 'cloud', Page: 'compass', Phase: 'map', Track: 'route', 'Case study': 'compass', 'Trade-off': 'sliders-horizontal', Article: 'book-open-text', Pattern: 'puzzle', Tool: 'wrench', Topic: 'check', Question: 'notebook-pen', Lab: 'flask-conical', Resource: 'external-link' };
  const norm = s => strip(s).toLowerCase();

  function buildIndex() {
    const items = [];
    const add = (type, title, sub, href, more = '', ext = false) => items.push({ type, title: strip(title), sub: strip(sub), href, ext, t: norm(title), hay: norm(`${title} ${sub} ${more}`) });
    NAV.filter(n => n.id && (!['vault', 'articles'].includes(n.id) || Q.length)).forEach(n => add('Page', n.label, 'Page', to(n.id === 'home' ? '' : n.id)));
    H.phases.forEach(p => {
      add('Phase', `P${p.n} · ${p.title}`, p.goal, phaseHref(p));
      p.topics.forEach(t => add('Topic', t.title, `P${p.n} · ${p.short}`, topicHome.get(t.id), `${t.what || ''} ${(t.points || []).join(' ')}`));
    });
    if (H.lld) add('Phase', 'LLD side track', 'Low-level design and machine coding', to('roadmap', 'lld'));
    lldSteps().forEach(s => add('Topic', s.title, 'LLD side track', topicHome.get(s.id), s.points.join(' ')));
    TRACKS.forEach(t => {
      add('Track', t.title, t.why, to('tracks', t.id));
      t.topics.forEach(x => add('Topic', x.title, `${t.short} track`, topicHome.get(x.id), `${x.what || ''} ${(x.points || []).join(' ')}`));
    });
    CASES.forEach(c => add('Case study', c.name, c.kind, to('cases', c.id), `${c.tagline} ${(c.components || []).map(x => x.name).join(' ')}`));
    DBT.forEach(t => add('Database', t.name, `Database type · ${t.family}`, to('databases', t.id), `${t.summary} ${Object.values(t.glance || {}).join(' ')} ${(t.examples || []).map(e => e[0]).join(' ')} ${t.id}`));
    GUIDES.forEach(g => add('Trade-off', g.title, g.question, to('tradeoffs', g.id), `${g.area} ${g.summary || ''} ${g.options.map(o => `${o.name} ${o.tools || ''}`).join(' ')}`));
    DEEP.forEach(d => add('Pattern', d.title, `Deep dive · ${d.family}`, to('patterns', d.id), `${d.summary} ${DEEP_OF.filter(x => x[1] === d.id).map(x => x[0]).join(' ')} ${(d.alternatives || []).map(a => a[1]).join(' ')}`));
    patternNames().filter(n => !deepFor(n)).forEach(n => add('Pattern', n, 'Patterns', to('patterns', `pat-${slug(n)}`)));
    (H.toolGroups || []).forEach(g => g.tools.forEach(t => add('Tool', t.name, g.name, to('tools', slug(t.name)), t.what)));
    AWS.groups.forEach(g => g.services.forEach(v => add('AWS', v.name, `AWS · ${g.name}`, to('aws', slug(v.name)), `${v.what} ${v.use}`)));
    (H.labs || []).forEach(l => add('Lab', l.title, `Phase ${l.phase} lab`, to('labs', String(l.phase)), l.stack));
    Q.forEach(q => {
      add('Question', q.title, `${q.id} · notebook`, to('vault', q.id), `${q.id} ${q.tags.join(' ')}`);
      if (ANS[q.id]) add('Article', q.title, `${q.id} · model answer`, to('articles', q.id), `${q.id} ${q.tags.join(' ')} ${strip(ANS[q.id].tldr)}`);
    });
    allResources().forEach(r => add('Resource', r.t, r.by || '', r.url, `${r.why || ''} ${r.type || ''}`, true));
    return items;
  }

  function search(qs) {
    const terms = norm(qs).split(/\s+/).filter(Boolean);
    const out = [];
    for (const it of INDEX) {
      let score = 0;
      let ok = true;
      for (const term of terms) {
        if (it.t.startsWith(term)) score += 14;
        else if (it.t.includes(` ${term}`)) score += 9;
        else if (it.t.includes(term)) score += 5;
        else if (it.hay.includes(term)) score += 1;
        else { ok = false; break; }
      }
      if (ok) out.push([score + (12 - TYPE_ORDER.indexOf(it.type)) * 0.3, it]);
    }
    out.sort((a, b) => b[0] - a[0]);
    return out.map(x => x[1]);
  }

  function renderResults(qs) {
    const box = $('#palette-results');
    let groups;
    if (!qs.trim()) {
      const cur = currentPhase();
      const next = cur && cur.topics.find(t => !done[t.id]);
      const quick = cur ? [{ type: 'Phase', title: `Continue: P${cur.n} · ${cur.title}`, sub: next ? `Next: ${strip(next.title)}` : 'Phase done', href: (next && topicHome.get(next.id)) || phaseHref(cur) }] : [];
      groups = [['Continue', quick], ['Go to', INDEX.filter(i => i.type === 'Page')]];
    } else {
      const found = search(qs);
      const by = {};
      found.forEach(it => { (by[it.type] = by[it.type] || []).push(it); });
      groups = [...new Set(found.map(i => i.type))].map(t => [t, by[t].slice(0, t === 'Question' || t === 'Topic' || t === 'Article' ? 6 : 5)]);
    }
    sel = 0;
    const flat = groups.flatMap(g => g[1]);
    if (!flat.length) { box.innerHTML = `<p class="px-3 py-10 text-center text-sm text-ink-3">No matches for "${esc(qs)}".</p>`; return; }
    let k = 0;
    box.innerHTML = groups.filter(g => g[1].length).map(([name, list]) => `<div class="mb-2"><p class="eyebrow px-3 pt-2 pb-1.5">${esc(name)}</p>${list.map(it => {
      const idx = k++;
      return `<a href="${esc(it.href)}" class="result flex items-center gap-3 rounded-xl px-3 py-2.5" role="option" id="res-${idx}" data-idx="${idx}" aria-selected="${idx === 0}"${it.ext ? ' target="_blank" rel="noopener"' : ''}><span class="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-ink-3">${icon(TYPE_ICON[it.type] || 'search', 'size-4')}</span><span class="min-w-0 flex-1"><span class="result-title block truncate text-sm font-medium">${esc(it.title)}</span><span class="block truncate text-xs text-ink-3">${esc(it.sub)}</span></span>${it.ext ? icon('external-link', 'size-3.5 text-ink-3') : ''}</a>`;
    }).join('')}</div>`).join('');
    $('#palette-q').setAttribute('aria-activedescendant', 'res-0');
  }

  function setSel(i) {
    const els = $$('#palette-results .result');
    if (!els.length) return;
    sel = (i + els.length) % els.length;
    els.forEach((e, j) => e.setAttribute('aria-selected', String(j === sel)));
    els[sel].scrollIntoView({ block: 'nearest' });
    $('#palette-q').setAttribute('aria-activedescendant', `res-${sel}`);
  }

  function openPalette() {
    if (!INDEX) INDEX = buildIndex();
    const d = $('#palette');
    if (d.open) return;
    closeDrawer();
    d.showModal();
    const input = $('#palette-q');
    input.value = '';
    renderResults('');
    input.focus();
  }
  function closePalette() { const d = $('#palette'); if (d.open) d.close(); }
  function activate(el) {
    if (!el) return;
    const href = el.getAttribute('href');
    if (el.getAttribute('target') === '_blank') { window.open(href, '_blank', 'noopener'); return; }
    closePalette();
    go(href);
  }

  function openDrawer() { const d = $('#drawer'); if (!d.open) { d.showModal(); d.focus(); } }
  function closeDrawer() { const d = $('#drawer'); if (d.open) d.close(); }

  /* ================= events ================= */
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-action]');
    if (a) {
      const act = a.dataset.action;
      if (act === 'search') { e.preventDefault(); openPalette(); }
      else if (act === 'close-palette') closePalette();
      else if (act === 'menu') openDrawer();
      else if (act === 'close-drawer') closeDrawer();
      else if (act === 'theme') { const t = theme(); setTheme(t === '' ? 'light' : t === 'light' ? 'dark' : ''); toast(`Theme: ${theme() || 'system'}`); }
      else if (act === 'pick') pickQuestion(true);
      else if (act === 'pick-global') pickQuestion(false);
      else if (act === 'toggle-filters') { vf.open = !vf.open; const f = $('#vq-filters'); f.classList.toggle('hidden', !vf.open); f.classList.toggle('grid', vf.open); a.setAttribute('aria-expanded', String(vf.open)); }
      else if (act === 'export-md') exportMd();
      else if (act === 'export-json') { download(`study-hub-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'study-hub', v: 2, exported: new Date().toISOString(), notes, done, start: store.get(K.start, H.start) }, null, 2), 'application/json'); toast('Backup downloaded: answers, ticked topics and your start date.'); }
      return;
    }
    const ts = e.target.closest('[data-theme-set]');
    if (ts) { setTheme(ts.dataset.themeSet); return; }
    const st = e.target.closest('[data-set-status]');
    if (st) { saveNote(st.dataset.qid, { status: st.dataset.setStatus }); return; }
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      const q = qById[cp.dataset.copy];
      const text = ((document.getElementById(`ans-${q.id}`) || {}).value || '').trim();
      if (!text) { toast('Write an answer first, then copy it for grading.'); return; }
      copyText(`Grade my answer like an SDE-2 system design interviewer. Score it out of 10, list what is missing, then ask me one follow-up.\n\nQuestion (${q.id}): ${q.title}\n\nMy answer:\n${text}`, 'Copied. Paste it to Claude to get graded.');
      return;
    }
    const pr = e.target.closest('[data-prompt]');
    if (pr) { copyText(H.prompts[+pr.dataset.prompt][0], 'Prompt copied. Paste it into Claude Code.'); return; }
    const ct = e.target.closest('[data-copytext]');
    if (ct) { copyText(ct.dataset.copytext, 'Prompt copied. Paste it into Claude Code.'); return; }
    const hp = e.target.closest('[data-hld-path]');
    if (hp) { showHldPath(hp.closest('[data-src]'), hp.dataset.hldPath); return; }
    const hm = e.target.closest('[data-hld-mode]');
    if (hm) { setHldMode(hm.closest('[data-src]'), hm.dataset.hldMode); return; }
    const area = e.target.closest('[data-area]');
    if (area) { $$('[data-area]').forEach(b => b.setAttribute('aria-pressed', String(b === area))); filterGuides(); return; }
    const res = e.target.closest('#palette-results .result');
    if (res) { e.preventDefault(); activate(res); return; }
    const link = e.target.closest('#drawer a[href^="#"]');
    if (link) closeDrawer();
  });

  document.addEventListener('change', e => {
    const cb = e.target.closest('input[data-topic]');
    if (cb) {
      if (cb.checked) done[cb.dataset.topic] = true; else delete done[cb.dataset.topic];
      store.set(K.topics, done);
      refreshProgress();
      toast(cb.checked ? 'Marked done. Nice.' : 'Marked not done.');
      return;
    }
    if (e.target.id === 'start-date' && e.target.value) {
      store.set(K.start, e.target.value);
      const y = window.scrollY;
      const r = parse();
      $('#view').innerHTML = viewRoadmap(r);
      afterMount('roadmap', r);
      window.scrollTo(0, y);
      return;
    }
    if (e.target.id === 'vault-import') importBackup(e.target);
    if (e.target.matches('#vq-filters select')) {
      vf.cat = $('#vq-cat').value; vf.diff = $('#vq-diff').value; vf.phase = $('#vq-phase').value; vf.status = $('#vq-status').value;
      applyVaultFilters();
    }
  });

  const saveTimers = {};
  const filterList = (inputSel, itemSel, groupSel) => {
    const input = $(inputSel);
    const term = input ? input.value.trim().toLowerCase() : '';
    $$(`#view ${itemSel}`).forEach(c => { c.hidden = !!term && !c.dataset.hay.includes(term); });
    if (groupSel) $$(`#view ${groupSel}`).forEach(g => { g.hidden = !g.querySelector(`${itemSel}:not([hidden])`); });
    const e = $('#view .empty-note');
    if (e) e.hidden = !!$(`#view ${itemSel}:not([hidden])`);
  };
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.matches('textarea[data-ans]')) {
      autosize(t);
      const id = t.dataset.ans;
      clearTimeout(saveTimers[id]);
      saveTimers[id] = setTimeout(() => {
        const patch = { text: t.value };
        const cur = statusOf(id);
        if (cur === 'todo' && t.value.trim()) patch.status = 'draft';
        if (!t.value.trim() && cur === 'draft') patch.status = 'todo';
        saveNote(id, patch);
      }, 350);
      return;
    }
    if (t.id === 'vq-q') { vf.q = t.value; applyVaultFilters(); return; }
    if (t.id === 'palette-q') { renderResults(t.value); return; }
    if (t.id === 'db-q') { const term = t.value.trim().toLowerCase(); $$('#db-finder tbody tr').forEach(tr => { tr.hidden = !!term && !tr.textContent.toLowerCase().includes(term); }); return; }
    if (t.id === 'finder-q') { const term = t.value.trim().toLowerCase(); $$('#finder-table tbody tr').forEach(tr => { tr.hidden = !!term && !tr.textContent.toLowerCase().includes(term); }); return; }
    if (t.id === 'tool-q') { filterList('#tool-q', '.tool', '.tool-group'); return; }
    if (t.id === 'res-q') { filterList('#res-q', '.res', '.res-group'); return; }
    if (t.id === 'art-q') { filterList('#art-q', '.art', '.art-cat'); return; }
    if (t.id === 'aws-q') { filterList('#aws-q', '.aws', '.aws-group'); return; }
    if (t.id === 'to-q') filterGuides();
  });


  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if ($('#palette').open) closePalette(); else openPalette(); return; }
    if ($('#palette').open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(sel + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(sel - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); activate($$('#palette-results .result')[sel]); }
    }
  });
  $('#palette').addEventListener('mousemove', e => { const r = e.target.closest('.result'); if (r) { const i = +r.dataset.idx; if (i !== sel) setSel(i); } });
  $$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

  function filterGuides() {
    const input = $('#to-q');
    const term = input ? input.value.trim().toLowerCase() : '';
    const pressed = $('[data-area][aria-pressed="true"]');
    const area = pressed ? pressed.dataset.area : '';
    $$('#view .guide').forEach(g => {
      const block = g.closest('[data-area-block]');
      g.hidden = (!!term && !g.dataset.hay.includes(term)) || (!!area && block.dataset.areaBlock !== area);
    });
    $$('#view [data-area-block]').forEach(b => { b.hidden = !b.querySelector('.guide:not([hidden])'); });
    const e = $('#view .empty-note');
    if (e) e.hidden = !!$('#view .guide:not([hidden])');
  }

  function exportMd() {
    const lines = ['# Vault notebook answers', '', `Exported ${new Date().toLocaleString()}`, ''];
    let n = 0;
    CATS.forEach(c => {
      const qs = Q.filter(q => q.category === c.name && notes[q.id] && notes[q.id].text && notes[q.id].text.trim());
      if (!qs.length) return;
      lines.push(`## ${c.name}`, '');
      qs.forEach(q => { n++; lines.push(`### ${q.id} · ${q.title}`, '', `_${q.difficulty} · status: ${(STATUS.find(s => s[0] === statusOf(q.id)) || [])[1]}_`, '', notes[q.id].text.trim(), ''); });
    });
    if (!n) { toast('No answers yet. Write one first.'); return; }
    download(`vault-answers-${new Date().toISOString().slice(0, 10)}.md`, lines.join('\n'), 'text/markdown');
    toast(`Exported ${n} answers.`);
  }

  function importBackup(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || !['study-hub', 'study-hub-vault'].includes(data.app) || typeof data.notes !== 'object') throw new Error('shape');
        const ids = Object.keys(data.notes).filter(id => qById[id]);
        ids.forEach(id => { notes[id] = data.notes[id]; });
        storageOk = store.set(K.vault, notes);
        if (data.done && typeof data.done === 'object') { Object.keys(data.done).forEach(k => { if (topicHome.has(k)) done[k] = true; }); store.set(K.topics, done); }
        if (data.start) store.set(K.start, data.start);
        currentKey = null;
        route();
        refreshProgress();
        toast(`Restored ${ids.length} answers${data.done ? ` and ${Object.keys(data.done).length} ticked topics` : ''}.`);
      } catch (err) {
        toast('That file is not a vault backup. Pick a file made with "Backup".');
      }
      input.value = '';
    };
    r.readAsText(f);
  }

  /* ================= boot ================= */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  applyTheme(theme());
  renderChrome();
  route();
  window.addEventListener('hashchange', route);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintThemeButtons);
})();
