/* Layered architecture graphs for case studies and pattern deep dives.
   Data: { layers: [{ name, items: [[label, role]], why }], edges: [[from, to, kind, label]], paths: [{ name, nodes, note }] }.
   Each layer is a row. An edge that skips rows gets a bend point in every row it crosses, rows are
   reordered to cut crossings (barycenter sweeps), then placed so edges run as straight as the gaps allow. */
window.HubGraph = (() => {
  'use strict';

  const KINDS = [['sync', 'Request and response'], ['async', 'Event or queue'], ['data', 'Reads and writes'], ['stream', 'Bulk bytes'], ['repl', 'Replication or sync']];
  const KIND_SET = new Set(KINDS.map(k => k[0]));
  const S = { top: 4, labelH: 22, nodeH: 46, padB: 10, gap: 38, pad: 14, sep: 14, dW: 4, dSep: 10, minW: 112, maxW: 176 };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plain = s => String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const r1 = v => Math.round(v * 10) / 10;
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  const live = new Set();
  let uid = 0;

  /* the vertical-tangent cubic between two row ports: y(t) = p + (q - p)(1.5t - 1.5t^2 + t^3), always increasing,
     so the point at a given height comes from bisection */
  const atY = (p, q, y) => {
    let lo = 0, hi = 1;
    for (let k = 0; k < 24; k++) {
      const t = (lo + hi) / 2;
      const yt = p[1] + (q[1] - p[1]) * (1.5 * t - 1.5 * t * t + t * t * t);
      if ((yt < y) === (q[1] > p[1])) lo = t; else hi = t;
    }
    const t = (lo + hi) / 2, u = 1 - t;
    return [p[0] * (u * u * u + 3 * u * u * t) + q[0] * (3 * u * t * t + t * t * t), y];
  };
  const rowTop = r => S.top + r * (S.labelH + S.nodeH + S.padB + S.gap);
  const nodeTop = r => rowTop(r) + S.labelH;
  const nodeBot = r => nodeTop(r) + S.nodeH;

  function build(D) {
    const layers = (D.layers || []).filter(l => l.items && l.items.length);
    const nodes = [], byId = new Map();
    layers.forEach((l, r) => l.items.forEach(it => {
      if (byId.has(it[0])) return;
      const n = { id: it[0], role: it[1] || '', layer: l.name, why: l.why || '', r, real: true, x: 0, ord: 0 };
      nodes.push(n);
      byId.set(n.id, n);
    }));
    const rows = layers.map(() => []);
    nodes.forEach(n => rows[n.r].push(n));
    const edges = [];
    (D.edges || []).forEach(([from, to, kind, label], i) => {
      const a = byId.get(from), b = byId.get(to);
      if (!a || !b || a === b) return;
      const e = { from: a, to: b, kind: KIND_SET.has(kind) ? kind : 'sync', label: label || '', chain: [] };
      edges.push(e);
      if (a.r === b.r) { e.same = true; return; }
      const [u, v] = a.r < b.r ? [a, b] : [b, a];
      e.chain.push(u);
      for (let r = u.r + 1; r < v.r; r++) { const d = { r, real: false, x: 0, ord: 0 }; rows[r].push(d); e.chain.push(d); }
      e.chain.push(v);
    });
    const segs = edges.filter(e => !e.same).flatMap(e => e.chain.slice(1).map((n, k) => [e.chain[k], n]));
    return { layers, nodes, byId, rows, edges, segs, paths: (D.paths || []).filter(p => (p.nodes || []).some(n => byId.has(n))) };
  }

  /* reorder each row by the mean position of its neighbours; keep the order with the fewest crossings */
  function order(M) {
    const up = new Map(), down = new Map();
    M.segs.forEach(([a, b]) => { push(down, a, b); push(up, b, a); });
    const renum = () => M.rows.forEach(row => row.forEach((n, i) => { n.ord = i; }));
    const pos = n => n.ord - (M.rows[n.r].length - 1) / 2;
    const crossings = () => {
      let c = 0;
      for (let i = 0; i < M.segs.length; i++) for (let j = i + 1; j < M.segs.length; j++) {
        const [a, b] = M.segs[i], [p, q] = M.segs[j];
        if (a.r === p.r && (a.ord - p.ord) * (b.ord - q.ord) < 0) c++;
      }
      return c;
    };
    const sweep = (r, nb) => {
      const row = M.rows[r];
      const bc = new Map(row.map(n => { const ns = nb.get(n); return [n, ns ? ns.reduce((s, m) => s + pos(m), 0) / ns.length : pos(n)]; }));
      row.sort((p, q) => bc.get(p) - bc.get(q));
      row.forEach((n, i) => { n.ord = i; });
    };
    renum();
    let best = M.rows.map(r => r.slice()), bestC = crossings();
    for (let it = 0; it < 10 && bestC > 0; it++) {
      for (let r = 1; r < M.rows.length; r++) sweep(r, up);
      for (let r = M.rows.length - 2; r >= 0; r--) sweep(r, down);
      const c = crossings();
      if (c < bestC) { bestC = c; best = M.rows.map(r => r.slice()); }
    }
    M.rows.forEach((row, r) => row.splice(0, row.length, ...best[r]));
    renum();
  }

  /* x positions: pull every node toward its neighbours, then fix overlaps with isotonic regression (pool adjacent violators) */
  function place(M, W) {
    const w = n => (n.real ? W : S.dW);
    const sep = (a, b) => (w(a) + w(b)) / 2 + (a.real && b.real ? S.sep : S.dSep);
    const nb = new Map();
    M.segs.forEach(([a, b]) => { push(nb, a, b); push(nb, b, a); });
    M.rows.forEach(row => {
      let x = 0;
      row.forEach((n, i) => { if (i) x += sep(row[i - 1], n); n.x = x; });
      row.forEach(n => { n.x -= x / 2; });
    });
    const R = M.rows.length;
    for (let it = 0; it < 18; it++) {
      const seq = [...Array(R).keys()];
      if (it % 2) seq.reverse();
      seq.forEach(r => {
        const row = M.rows[r];
        if (!row.length) return;
        const c = [0];
        for (let i = 1; i < row.length; i++) c[i] = c[i - 1] + sep(row[i - 1], row[i]);
        const want = row.map(n => { const ns = nb.get(n); return ns ? ns.reduce((s, m) => s + m.x, 0) / ns.length : NaN; });
        row.forEach((n, i) => {
          if (!Number.isNaN(want[i])) return;
          let j = i - 1;
          while (j >= 0 && Number.isNaN(want[j])) j--;
          if (j >= 0) { want[i] = want[j] + c[i] - c[j]; return; }
          j = i + 1;
          while (j < row.length && Number.isNaN(want[j])) j++;
          want[i] = j < row.length ? want[j] - (c[j] - c[i]) : n.x;
        });
        const blocks = [];
        row.forEach((n, i) => {
          blocks.push({ s: want[i] - c[i], n: 1 });
          while (blocks.length > 1) {
            const b = blocks[blocks.length - 1], a = blocks[blocks.length - 2];
            if (a.s / a.n <= b.s / b.n) break;
            a.s += b.s; a.n += b.n; blocks.pop();
          }
        });
        let i = 0;
        blocks.forEach(b => { const m = b.s / b.n; for (let k = 0; k < b.n; k++, i++) row[i].x = m + c[i]; });
      });
    }
    let lo = Infinity, hi = -Infinity;
    M.rows.forEach(row => row.forEach(n => { lo = Math.min(lo, n.x - w(n) / 2); hi = Math.max(hi, n.x + w(n) / 2); }));
    M.rows.forEach(row => row.forEach(n => { n.x += S.pad - lo; }));
    return hi - lo + 2 * S.pad;
  }

  function fit(M, avail) {
    const most = Math.max(1, ...M.rows.map(row => row.filter(n => n.real).length));
    let W = Math.max(S.minW, Math.min(S.maxW, Math.floor((avail - 2 * S.pad - (most - 1) * S.sep) / most)));
    let width = place(M, W);
    for (let k = 0; k < 4 && width > avail && W > S.minW; k++) {
      W = Math.max(S.minW, Math.floor(W * (avail / width)) - 2);
      width = place(M, W);
    }
    return { W, width };
  }

  /* geometry: ports spread along a node's edge, ordered by where the other end sits */
  function geometry(M, W) {
    const bot = new Map(), top = new Map();
    M.edges.forEach(e => {
      if (e.same) return;
      const c = e.chain;
      push(bot, c[0], { e, other: c[1] });
      push(top, c[c.length - 1], { e, other: c[c.length - 2] });
    });
    const ports = (m, key) => m.forEach((list, n) => {
      list.sort((p, q) => p.other.x - q.other.x);
      const step = list.length > 1 ? Math.min(16, (W * 0.64) / (list.length - 1)) : 0;
      list.forEach((p, k) => { p.e[key] = n.x + (k - (list.length - 1) / 2) * step; });
    });
    ports(bot, 'x0');
    ports(top, 'x1');
    const boxes = M.nodes.map(n => [n.x - W / 2, nodeTop(n.r), n.x + W / 2, nodeBot(n.r)]);
    const taken = [];
    const hit = (b, list) => list.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    M.edges.forEach(e => {
      let pts;
      if (e.same) {
        const dir = Math.sign(e.to.x - e.from.x) || 1;
        const y = nodeBot(e.from.r), h = 22;
        const sx = e.from.x + dir * W * 0.28, ex = e.to.x - dir * W * 0.28;
        e.d = `M${r1(sx)} ${y} C${r1(sx)} ${y + h} ${r1(ex)} ${y + h} ${r1(ex)} ${y + 1}`;
        e.mids = [[(sx + ex) / 2, y + h * 0.75 + 9]];
      } else {
        const c = e.chain;
        pts = [[e.x0, nodeBot(c[0].r)]];
        c.slice(1, -1).forEach(d => { pts.push([d.x, nodeTop(d.r)], [d.x, nodeBot(d.r)]); });
        pts.push([e.x1, nodeTop(c[c.length - 1].r)]);
        if (e.from !== c[0]) pts.reverse();
        e.d = pts.map((p, k) => {
          if (!k) return `M${r1(p[0])} ${r1(p[1])}`;
          const q = pts[k - 1];
          if (Math.abs(q[0] - p[0]) < 0.5) return `L${r1(p[0])} ${r1(p[1])}`;
          const my = (q[1] + p[1]) / 2;
          return `C${r1(q[0])} ${r1(my)} ${r1(p[0])} ${r1(my)} ${r1(p[0])} ${r1(p[1])}`;
        }).join(' ');
        /* label spots: the midpoints of the gaps between rows, middle gap first */
        const gaps = [];
        for (let k = 0; k + 1 < pts.length; k++) if (Math.abs(pts[k][1] - pts[k + 1][1]) > S.nodeH + 2) gaps.push(k);
        const mid = gaps[Math.floor((gaps.length - 1) / 2)];
        gaps.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
        e.mids = gaps.flatMap(k => {
          const p = pts[k], q = pts[k + 1], lo = Math.min(p[1], q[1]) + 9, hi = Math.max(p[1], q[1]) - 9, m = (p[1] + q[1]) / 2;
          return [0, -14, 14, -28, 28].map(dy => m + dy).filter(y => y >= lo && y <= hi).map(y => atY(p, q, y));
        });
      }
      e.lab = null;
      if (!e.label) return;
      const tw = plain(e.label).length * 5.6 + 8, th = 13;
      /* centred on the line first, then beside it (left, right) */
      const spots = [0, -1, 1].flatMap(side => e.mids.map(([x, y]) => { const cx = x + side * (tw / 2 + 5); return [cx - tw / 2, y - th / 2, cx + tw / 2, y + th / 2]; }));
      const spot = spots.find(b => !hit(b, taken) && !hit(b, boxes)) || spots[0];
      taken.push(spot);
      e.lab = [(spot[0] + spot[2]) / 2, spot[3] - 3.5];
    });
  }

  function legend(M) {
    const used = KINDS.filter(([k]) => M.edges.some(e => e.kind === k));
    if (!used.length) return '';
    return `<div class="g-legend">${used.map(([k, t]) => `<span class="g-key"><svg width="30" height="10" aria-hidden="true"><path class="g-line k-${k}" d="M1 5 H29"/></svg>${t}</span>`).join('')}</div>`;
  }

  function tipHTML(M, n, why) {
    const conns = M.edges.filter(e => e.from === n || e.to === n).map(e => {
      const out = e.from === n, o = out ? e.to : e.from;
      return `<li><svg width="22" height="8" aria-hidden="true"><path class="g-line k-${e.kind}" d="M1 4 H21"/></svg><span>${out ? '→' : '←'} ${o.id}${e.label ? ` <span class="g-tip-lab">${esc(plain(e.label))}</span>` : ''}</span></li>`;
    }).join('');
    return `<p class="g-tip-layer">${esc(plain(n.layer))}</p><p class="g-tip-title">${n.id}</p>${n.role ? `<p class="g-tip-role">${n.role}</p>` : ''}${conns ? `<ul class="g-tip-conns">${conns}</ul>` : ''}${why && n.why ? `<p class="g-tip-why"><span class="k">Why this layer</span>${n.why}</p>` : ''}`;
  }

  function mount(box, D, opts = {}) {
    if (!box || !D || !(D.layers || []).length) return null;
    const M = build(D);
    order(M);
    const id = `hg${++uid}`;
    const st = { path: null, pin: null, hover: null, avail: 0 };
    box.innerHTML = `<p class="g-hint">Wider than the screen: scroll sideways${opts.why ? ', or switch to Layers' : ''}.</p><div class="graph-scroll"><div class="graph"${opts.labels ? ' data-labels' : ''}></div></div><div class="g-tip" role="status" hidden></div>${legend(M)}`;
    const scroll = box.querySelector('.graph-scroll'), g = box.querySelector('.graph'), tip = box.querySelector('.g-tip');
    let nodeEls = [], edgeEls = [];

    function render() {
      const avail = scroll.clientWidth;
      if (!avail) return;
      st.avail = avail;
      const { W, width } = fit(M, avail);
      const off = width < avail ? (avail - width) / 2 : 0;
      M.rows.forEach(row => row.forEach(n => { n.x += off; }));
      const full = Math.max(width, avail);
      geometry(M, W);
      const last = M.rows.length - 1;
      const H = nodeBot(last) + S.padB + (M.edges.some(e => e.same && e.from.r === last) ? 34 : 4);
      const markers = KINDS.map(([k]) => `<marker id="${id}-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="g-mk k-${k}"/></marker>`).join('');
      const bands = M.layers.map((l, r) => `<rect class="g-band" x="1" y="${rowTop(r)}" width="${full - 2}" height="${S.labelH + S.nodeH + S.padB}" rx="12"/>`).join('');
      const captions = M.layers.map((l, r) => `<text class="g-band-t" x="${S.pad - 2}" y="${rowTop(r) + 15}">${esc(plain(l.name))}</text>`).join('');
      const lines = M.edges.map((e, k) => `<g class="g-edge" data-e="${k}"><path class="g-line k-${e.kind}" d="${e.d}" marker-end="url(#${id}-${e.kind})"/>${e.lab ? `<text class="g-lab" x="${r1(e.lab[0])}" y="${r1(e.lab[1])}" text-anchor="middle">${esc(plain(e.label))}</text>` : ''}</g>`).join('');
      g.style.width = `${full}px`;
      g.style.height = `${H}px`;
      g.innerHTML = `<svg class="g-svg" width="${full}" height="${H}" viewBox="0 0 ${full} ${H}" aria-hidden="true"><defs>${markers}</defs>${bands}${lines}${captions}</svg>` +
        M.nodes.map((n, k) => `<button type="button" class="gnode" data-n="${k}" aria-pressed="false" style="left:${r1(n.x - W / 2)}px;top:${nodeTop(n.r)}px;width:${W}px;height:${S.nodeH}px" aria-label="${esc(`${plain(n.id)}, ${plain(n.layer)}. ${plain(n.role)}`)}"><span class="gn-in"><b>${n.id}</b>${n.role ? `<span>${n.role}</span>` : ''}</span><i class="g-step" aria-hidden="true"></i></button>`).join('');
      nodeEls = [...g.querySelectorAll('.gnode')];
      edgeEls = [...g.querySelectorAll('.g-edge')];
      const wide = width > avail + 1;
      box.classList.toggle('is-wide', wide);
      if (wide) {
        const real = M.nodes.map(n => n.x);
        scroll.scrollLeft = Math.max(0, real.reduce((a, x) => a + x, 0) / real.length - avail / 2);
      }
      apply();
    }

    function apply() {
      const act = st.hover || st.pin;
      let onN = null, onE = null, steps = null;
      if (act) {
        onN = new Set([act]);
        onE = new Set();
        M.edges.forEach((e, k) => { if (e.from === act || e.to === act) { onE.add(k); onN.add(e.from); onN.add(e.to); } });
      } else if (st.path !== null && M.paths[st.path]) {
        const seq = M.paths[st.path].nodes.map(x => M.byId.get(x)).filter(Boolean);
        onN = new Set(seq);
        onE = new Set();
        steps = new Map();
        seq.forEach((n, k) => {
          push(steps, n, k + 1);
          if (!k) return;
          const p = seq[k - 1];
          const j = M.edges.findIndex(e => (e.from === p && e.to === n) || (e.from === n && e.to === p));
          if (j >= 0) onE.add(j);
        });
      }
      g.toggleAttribute('data-active', !!onN);
      nodeEls.forEach((el, k) => {
        const n = M.nodes[k];
        el.classList.toggle('on', !!onN && onN.has(n));
        el.classList.toggle('off', !!onN && !onN.has(n));
        el.classList.toggle('is-act', n === act);
        el.setAttribute('aria-pressed', String(n === st.pin));
        const s = steps && steps.get(n);
        el.querySelector('.g-step').textContent = s ? s.join(', ') : '';
        el.classList.toggle('has-step', !!s);
      });
      edgeEls.forEach((el, k) => {
        el.classList.toggle('on', !!onE && onE.has(k));
        el.classList.toggle('off', !!onE && !onE.has(k));
      });
      if (act) showTip(act); else tip.hidden = true;
    }

    function showTip(n) {
      const el = nodeEls[M.nodes.indexOf(n)];
      if (!el) return;
      tip.innerHTML = tipHTML(M, n, opts.why !== false);
      tip.hidden = false;
      const br = box.getBoundingClientRect(), nr = el.getBoundingClientRect();
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      const left = Math.max(0, Math.min(nr.left - br.left + nr.width / 2 - tw / 2, br.width - tw));
      let top = nr.bottom - br.top + 8;
      if (nr.bottom + 8 + th > window.innerHeight && nr.top - th - 8 > 0) top = nr.top - br.top - th - 8;
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
    }

    const nodeOf = el => M.nodes[+el.dataset.n];
    g.addEventListener('pointerover', e => {
      const el = e.pointerType === 'mouse' && e.target.closest('.gnode');
      if (el && st.hover !== nodeOf(el)) { st.hover = nodeOf(el); apply(); }
    });
    g.addEventListener('pointerout', e => {
      const el = e.pointerType === 'mouse' && e.target.closest('.gnode');
      if (el && !el.contains(e.relatedTarget)) { st.hover = null; apply(); }
    });
    g.addEventListener('focusin', e => {
      const el = e.target.closest('.gnode');
      if (el && el.matches(':focus-visible')) { st.hover = nodeOf(el); apply(); }
    });
    g.addEventListener('focusout', () => { if (st.hover) { st.hover = null; apply(); } });
    g.addEventListener('click', e => {
      const el = e.target.closest('.gnode');
      const n = el ? nodeOf(el) : null;
      st.pin = n && st.pin !== n ? n : null;
      if (!st.pin) st.hover = null;
      apply();
    });
    box.addEventListener('keydown', e => { if (e.key === 'Escape' && (st.pin || st.hover)) { st.pin = null; st.hover = null; apply(); } });
    scroll.addEventListener('scroll', () => { const act = st.hover || st.pin; if (act) showTip(act); }, { passive: true });

    const api = {
      box,
      setPath(i) { st.path = i === null || i === '' || i === undefined ? null : +i; st.pin = null; st.hover = null; apply(); },
      unpin() { if (st.pin) { st.pin = null; apply(); } }
    };
    const ro = new ResizeObserver(() => {
      if (!box.isConnected) { ro.disconnect(); live.delete(api); return; }
      const w = scroll.clientWidth;
      if (w && Math.abs(w - st.avail) > 4) render();
    });
    ro.observe(scroll);
    render();
    live.add(api);
    box._graph = api;
    return api;
  }

  document.addEventListener('click', e => live.forEach(api => {
    if (!api.box.isConnected) live.delete(api);
    else if (!api.box.contains(e.target)) api.unpin();
  }));

  return { mount, KINDS };
})();
