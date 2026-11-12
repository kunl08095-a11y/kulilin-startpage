
(function () {
  "use strict";

  var ENGINES = [
    { id: "google", name: "Google",     color: "#4285f4", url: "https://www.google.com/search?q=" },
    { id: "bing",   name: "Bing",       color: "#0f8f8f", url: "https://www.bing.com/search?q=" },
    { id: "baidu",  name: "百度",        color: "#2932e1", url: "https://www.baidu.com/s?wd=" },
    { id: "ddg",    name: "DuckDuckGo", color: "#de5833", url: "https://duckduckgo.com/?q=" },
    { id: "zhihu",  name: "知乎",        color: "#0084ff", url: "https://www.zhihu.com/search?type=content&q=" },
    { id: "github", name: "GitHub",     color: "#6e7681", url: "https://github.com/search?q=" }
  ];

  var STORE_KEY = "kulilin.engine";

  var extStore = null;
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      extStore = chrome.storage.local;
    }
  } catch (e) { /* file:// 或非扩展环境 */ }

  var form = document.getElementById("searchForm");
  var q = document.getElementById("q");
  var btn = document.getElementById("engineBtn");
  var menu = document.getElementById("engineMenu");
  var live = document.getElementById("live");
  var nameEl = btn.querySelector(".engine-name");

  var current = ENGINES[0];
  var isOpen = false;

  /* ---------- 记录上次选择 ---------- */

  function readEngine() {
    try {
      var id = localStorage.getItem(STORE_KEY);
      for (var i = 0; i < ENGINES.length; i++) {
        if (ENGINES[i].id === id) return ENGINES[i];
      }
    } catch (e) { /* 隐私模式 / file:// 下可能不可用 */ }
    return ENGINES[0];
  }

  function saveEngine(engine) {
    try { localStorage.setItem(STORE_KEY, engine.id); } catch (e) { /* 忽略 */ }
    if (extStore) {
      try { var o = {}; o[STORE_KEY] = engine.id; extStore.set(o); } catch (e) {}
    }
  }

  /* ---------- 渲染菜单 ---------- */

  ENGINES.forEach(function (engine) {
    var li = document.createElement("li");
    li.setAttribute("role", "option");
    li.tabIndex = -1;
    li.dataset.id = engine.id;

    var dot = document.createElement("span");
    dot.className = "dot";
    dot.style.setProperty("--engine-color", engine.color);
    dot.setAttribute("aria-hidden", "true");

    var name = document.createElement("span");
    name.textContent = engine.name;

    var check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    check.setAttribute("class", "check");
    check.setAttribute("viewBox", "0 0 24 24");
    check.setAttribute("fill", "none");
    check.setAttribute("aria-hidden", "true");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M20 6 9 17l-5-5");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    check.appendChild(path);

    li.appendChild(dot);
    li.appendChild(name);
    li.appendChild(check);
    menu.appendChild(li);

    li.addEventListener("click", function () {
      selectEngine(engine, true);
      closeMenu(false);
      q.focus();
    });

    li.addEventListener("keydown", onMenuKeydown);
  });

  function selectEngine(engine, announce) {
    current = engine;
    nameEl.textContent = engine.name;
    btn.style.setProperty("--engine-color", engine.color);
    saveEngine(engine);
    syncSelection();
    if (announce) live.textContent = "搜索引擎已切换为 " + engine.name;
  }

  function syncSelection() {
    var items = menu.children;
    for (var i = 0; i < items.length; i++) {
      items[i].setAttribute("aria-selected", items[i].dataset.id === current.id ? "true" : "false");
    }
  }

  /* ---------- 菜单开合 ---------- */

  function openMenu(edge) {
    if (isOpen) return;
    isOpen = true;
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    form.classList.add("is-open");

    var items = Array.prototype.slice.call(menu.children);
    var selected = items.filter(function (li) { return li.dataset.id === current.id; })[0] || items[0];
    var target = edge === "last" ? items[items.length - 1] : edge === "first" ? items[0] : selected;
    target.focus({ preventScroll: true });
  }

  function closeMenu(refocusButton) {
    if (!isOpen) return;
    isOpen = false;
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    form.classList.remove("is-open");
    if (refocusButton) btn.focus({ preventScroll: true });
  }

  btn.addEventListener("click", function () {
    if (isOpen) closeMenu(false);
    else openMenu("selected");
  });

  btn.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(e.key === "ArrowUp" ? "last" : "first");
    }
  });

  function onMenuKeydown(e) {
    var items = Array.prototype.slice.call(menu.children);
    var index = items.indexOf(document.activeElement);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        items[(index + 1) % items.length].focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        items[(index - 1 + items.length) % items.length].focus();
        break;
      case "Home":
        e.preventDefault();
        items[0].focus();
        break;
      case "End":
        e.preventDefault();
        items[items.length - 1].focus();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (index > -1) items[index].click();
        break;
      case "Escape":
        e.preventDefault();
        closeMenu(true);
        break;
      case "Tab":
        e.preventDefault();
        closeMenu(true);
        break;
    }
  }

  document.addEventListener("pointerdown", function (e) {
    if (isOpen && !form.contains(e.target)) closeMenu(false);
  });

  q.addEventListener("focus", function () { closeMenu(false); });

  /* ---------- 搜索 ---------- */

  var composing = false;
  q.addEventListener("compositionstart", function () { composing = true; });
  q.addEventListener("compositionend", function () { composing = false; });

  /**
   * 像网址就直接打开，否则用当前搜索引擎搜索。
   * 判断规则放在 url.js，浏览器和 Node 共用，方便单独测。
   */
  var asUrl = window.KulilinUrl.asUrl;

  function go(newTab) {
    var value = q.value.trim();
    if (!value) { q.focus(); return; }

    var direct = asUrl(value);
    var href = direct || current.url + encodeURIComponent(value);

    if (newTab) window.open(href, "_blank", "noopener,noreferrer");
    else window.location.href = href;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (composing) return;
    go(false);
  });

  form.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.isComposing) return;
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      go(true);
    }
  });

  q.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && q.value) {
      e.preventDefault();
      q.value = "";
    }
  });

  /* ---------- 快捷网站 dock ---------- */

  var DOCK_KEY = "kulilin.dock";
  var DOCK_MAX = 7;

  var dockWrap = document.getElementById("dockWrap");
  var dock = document.getElementById("dock");
  var dockDot = document.getElementById("dockDot");
  var dockItemsEl = document.getElementById("dockItems");
  var dockAdd = document.getElementById("dockAdd");
  var dockForm = document.getElementById("dockAddForm");
  var dockUrl = document.getElementById("dockUrl");
  var dockNote = document.getElementById("dockNote");
  var DOCK_HINT = "回车添加 · 拖动排序，拖出移除";

  var sites = loadSites();
  var dockIsOpen = false;
  var pTarget = 0;          // 目标接近度 0~1
  var pNow = 0;             // 每帧阻尼后的接近度，所有出现动画都由它驱动
  var dockTickRaf = 0;
  var lastTickTs = 0;       // 上一帧的时间戳，用来把限速折算成真正的时间
  var magTargetX = null;
  var magTargetY = null;
  var magX = null;          // 放大中心：指针离开后保留最后位置，供回落用
  var magY = null;
  var magFade = 0;          // 放大强度 0~1：指针离开接近区后缓慢退回 0，图标不硬切
  var magFadeTarget = 0;
  var editMagX = null;      // 点 + 时钉住的放大状态，取消后从这里平滑追上指针
  var editMagY = null;
  var editMagFade = 0;
  var editCatch = null;     // 取消添加后的过渡：{ t0, from*, to* }
  var EDIT_CATCH_MS = 800;  // 过渡时长，配合 1-(1-t)^3，从容不跳

  function easeOutCubic(t) {
    var u = 1 - t;
    return 1 - u * u * u;
  }
  var LINE_PAD = 8;         // 线两端的内边距：图标不贴着线端，线随整排宽度伸缩
  var MAG_DAMP = 0.18;      // 每帧向鼠标追 18%，放大中心因此有减速感
  var MAG_IN_MS = 520;      // 放大进入时长，用 1-(1-t)^3，和横线、图标出现一致
  var MAG_OUT_MS = 520;     // 放大回落同样用递减凸函数
  var pFrom = 0;
  var pAnimTo = 0;
  var pT0 = 0;
  var magFadeFrom = 0;
  var magFadeTo = 0;
  var magFadeT0 = 0;
  var dockGap = 6;
  var REDUCE_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var LINE_BASE = 170;      // 收起时固定的线长：三个图标 + 添加按钮
  var lineBase = LINE_BASE; // 随接近程度连续增长的线长
  var lineExtra = 0;        // 放大让位、拖动时临时加减的宽度
  var lineGrow = 0;         // 接近程度对应的线长增长比例 0~1
  var lastLineW = null;

  var dragState = null;
  var suppressClick = false;
  var DRAG_START = 6;   // 移动超过这个距离才算拖动
  var DROP_OUT = 56;    // 拖到 dock 上下方这个距离外松手 = 移除
  var DROP_EDGE = 72;   // 左右同理

  var REVEAL_RADIUS = 160; // 离横线多远开始响应（px）
  var REVEAL_MS = 520;     // 图标出现/收回时长，用 1-(1-t)^3，和横线上下移动一致
  var SINK_MS = 520;       // 横线上、下移动时长，用 1-(1-t)^3，先快后慢落到终点
  var sinkNow = 0;
  var sinkFrom = 0;
  var sinkTo = 0;
  var sinkT0 = 0;

  var MAG_SIGMA = 60;       // 放大影响的范围（px），越小越集中在指针附近
  var MAG_MAX = 1.4;        // 离鼠标最近时放大到的倍数
  var TOAST_MS = 6000;

  var toast = document.getElementById("toast");
  var toastText = document.getElementById("toastText");
  var toastAction = document.getElementById("toastAction");
  var toastHideTimer = 0;
  var toastRemoveTimer = 0;
  var pendingUndo = null;

  /** 清洗任意来源的站点数组：只留合法网址、去重、限个数 */
  function cleanSites(raw) {
    var clean = [];
    if (!Array.isArray(raw)) return clean;
    for (var i = 0; i < raw.length && clean.length < DOCK_MAX; i++) {
      if (typeof raw[i] !== "string") continue;
      var url = asUrl(raw[i].trim());
      if (url && clean.indexOf(url) === -1) clean.push(url);
    }
    return clean;
  }

  function loadSites() {
    try {
      return cleanSites(JSON.parse(localStorage.getItem(DOCK_KEY) || "[]"));
    } catch (e) {
      return [];
    }
  }

  function saveSites() {
    var json = JSON.stringify(sites);
    try { localStorage.setItem(DOCK_KEY, json); } catch (e) {}
    if (extStore) {
      try { var o = {}; o[DOCK_KEY] = sites; extStore.set(o); } catch (e) {}
    }
  }

  function siteName(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch (e) { return url; }
  }

  function renderDock() {
    dockItemsEl.textContent = "";

    sites.forEach(function (url, index) {
      var slot = document.createElement("div");
      slot.className = "dock-slot";
      slot.style.setProperty("--i", index);

      slot.style.setProperty("--rest", "38px");
      slot.dataset.index = index;

      var link = document.createElement("a");
      link.className = "dock-item";
      link.href = url;
      link.title = siteName(url);
      link.draggable = false;

      var img = document.createElement("img");
      img.alt = "";
      img.width = 22;
      img.height = 22;
      img.referrerPolicy = "no-referrer";
      img.dataset.host = new URL(url).hostname;

      var letter = document.createElement("span");
      letter.className = "dock-letter";
      letter.textContent = siteName(url).charAt(0).toUpperCase();

      link.appendChild(img);
      link.appendChild(letter);

      slot.appendChild(link);
      dockItemsEl.appendChild(slot);
    });

    dockAdd.style.setProperty("--i", sites.length);
    sizeHandle();
    if (dockIsOpen) loadDockIcons();
  }

  /**
   * 横条宽度是唯一的“动画量”：图标的位置和大小每秒 60 帧跟着鼠标走，
   * 横条则用 CSS 过渡去追，变化越大过渡越久，形成非线性呼吸感。
   */
  function updateLineWidth(width) {
    if (lastLineW !== null && Math.abs(width - lastLineW) < 0.3) return;
    lastLineW = width;
    dockWrap.style.setProperty("--line-x", width.toFixed(1) + "px");
  }

  /**
   * 收起时线长跟随图标数量，但最多 170（三个图标 + 按钮）；
   * 展开后允许超过 170，覆盖整排（含放大让位）。
   */
  function refreshLine(widthOverride) {
    if (!sites.length) { updateLineWidth(44); return; }
    if (typeof widthOverride === "number") {
      lineBase = widthOverride;
      updateLineWidth(lineBase);
      return;
    }
    var minW = Math.min(LINE_BASE, dock.offsetWidth);
    var target = Math.max(minW, dock.offsetWidth + lineExtra);
    lineBase = minW + (target - minW) * lineGrow;
    updateLineWidth(lineBase);
  }

  function sizeHandle() {
    dockGap = parseFloat(getComputedStyle(dockItemsEl).columnGap) || 6;
    var hasSites = sites.length > 0;
    // 图标槽位永远是 38px，dock.offsetWidth 就是静止宽度，不会被放大污染
    var full = hasSites ? Math.max(44, dock.offsetWidth) : 44;

    dockWrap.classList.toggle("has-sites", hasSites);
    dockWrap.style.width = full + "px";
    layoutDock();
  }

  var handleRaf = 0;
  window.addEventListener("resize", function () {
    if (handleRaf) return;
    handleRaf = requestAnimationFrame(function () {
      handleRaf = 0;
      sizeHandle();
      updateProximity();
    });
  });

  /* ---------- 图标：多源择优（取尺寸最大的）+ 本地缓存 ---------- */

  // 23px 的格子在 3 倍屏、悬停放大 1.4 倍时要吃到约 97 物理像素，
  // 所以统一按 128×128 处理：缓存里只留这一份，显示时不再临时挑来源
  var ICON_SIZE = 128;
  var ICON_CACHE_KEY = "kulilin.icons";
  var ICON_TTL = 30 * 24 * 60 * 60 * 1000; // 一个月后后台再确认一次
  var ICON_PROBE_MS = 3500;                // 单个来源最多等这么久
  var ICON_SETTLE_MS = 4200;               // 所有来源的总等待上限
  var ICON_MIN_SHARP = 48;                 // 比这更小的源不再二次放大

  var iconCache = readIconCache();
  var iconMissed = {};      // host -> 时间戳：最近没找到图标，十分钟内不再问
  var ICON_MISS_TTL = 10 * 60 * 1000;
  var iconInflight = {};

  function readIconCache() {
    try {
      var raw = JSON.parse(localStorage.getItem(ICON_CACHE_KEY) || "{}");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    } catch (e) { /* 坏数据就当没有 */ }
    return {};
  }

  function writeIconCache() {
    if (extStore) {
      try { var o = {}; o[ICON_CACHE_KEY] = iconCache; extStore.set(o); } catch (e) { }
    }
    try { localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(iconCache)); } catch (e) { }
  }

  function storeIcon(host, entry) {
    iconCache[host] = entry;

    // 换站点换得多了会攒下一堆用不着的图标，超过 60 条就丢最旧的
    var hosts = Object.keys(iconCache);
    if (hosts.length > 60) {
      hosts.sort(function (a, b) { return (iconCache[a].t || 0) - (iconCache[b].t || 0); });
      for (var i = 0; i < hosts.length - 60; i++) delete iconCache[hosts[i]];
    }
    writeIconCache();
  }

  /** 候选来源：站点自己的高清图标优先，第三方服务兜底；
   *  打分 = 像素数 × 权重，大图优先，像素相同时看来源可信度 */
  function iconCandidates(host) {
    return [
      { url: "https://" + host + "/apple-touch-icon.png", rank: 3 },
      { url: "https://" + host + "/apple-touch-icon-precomposed.png", rank: 2 },
      // 找不到图标时它给一张灰色圆圈 SVG 占位图，所以只要位图结果
      { url: "https://favicon.im/" + host, rank: 4, bitmap: true },
      { url: "https://" + host + "/favicon.ico", rank: 2 },
      { url: "https://favicon.cccyun.cc/" + host, rank: 2 }
    ];
  }

  function probeIcon(cand, done) {
    var img = new Image();
    var finished = false;
    var timer = setTimeout(function () { finish(null); }, ICON_PROBE_MS);

    function finish(entry) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      if (!entry) img.src = "";
      done(entry);
    }

    img.referrerPolicy = "no-referrer";
    img.onload = function () {
      var w = img.naturalWidth || 0;
      var h = img.naturalHeight || 0;
      // 只认位图的来源，遇到占位 SVG 就当没找到
      if (!w && cand.bitmap) { finish(null); return; }
      // 只有 viewBox 的 SVG 拿不到固有尺寸，按矢量算：任意尺寸都清晰
      finish({ url: cand.url, w: Math.max(w, h), rank: cand.rank, vector: !w });
    };
    img.onerror = function () { finish(null); };
    img.src = cand.url;
  }

  function iconScore(entry) {
    return (entry.vector ? 512 : entry.w) * entry.rank;
  }

  /** 分数 = 像素数 × 来源可信度，谁高用谁 */
  function pickIcon(list) {
    var best = null;
    for (var i = 0; i < list.length; i++) {
      if (!best || iconScore(list[i]) > iconScore(best)) best = list[i];
    }
    return best;
  }

  function applyIcon(img, entry) {
    if (!entry) return;
    if (entry.miss) {  // 这个站点确实没有能用的图标，退回首字母
      img.removeAttribute("src");
      img.classList.remove("loaded");
      return;
    }
    var src = entry.d || entry.u;
    if (!src) return;
    if (img.getAttribute("src") !== src) img.src = src;
    img.classList.add("loaded");
  }

  /**
   * 找一个 host 的图标：先并行问所有来源，谁先回先显示，
   * 等尺寸明显更大的结果到了再换一次；最后把 128px 版本写进缓存。
   */
  function resolveIcon(host, done) {
    if (iconInflight[host]) { iconInflight[host].push(done); return; }

    var waiters = iconInflight[host] = [done];
    var cands = iconCandidates(host);
    var results = [];
    var shown = null;
    var settled = false;
    var left = cands.length;

    function emit(entry) {
      for (var i = 0; i < waiters.length; i++) waiters[i](entry);
    }

    function offer(entry) {
      if (!entry) return;
      results.push(entry);
      var best = pickIcon(results);
      // 只好一点点就不换，避免图标来回闪
      if (shown && iconScore(best) < iconScore(shown) * 1.5) return;
      shown = best;
      emit(best);
    }

    function settle() {
      if (settled) return;
      settled = true;

      var best = pickIcon(results);
      if (!best) {
        iconMissed[host] = Date.now();
        storeIcon(host, { miss: 1, t: Date.now() });
        emit({ miss: 1 });
        return;
      }

      var entry = { u: best.url, w: best.w, t: Date.now() };
      storeIcon(host, entry);
      emit(entry);

      // 能读到字节就顺手裁成 128px 存下来，之后连网络都不用走
      cacheIconBytes(best, host, function (data, placeholder) {
        if (placeholder) {
          // 第三方服务给的占位图（灰圈），不如显示首字母
          iconMissed[host] = Date.now();
          storeIcon(host, { miss: 1, t: Date.now() });
          emit({ miss: 1 });
          return;
        }
        if (!data) return;
        var hit = iconCache[host] || entry;
        hit.miss = 0;
        hit.d = data;
        hit.t = Date.now();
        storeIcon(host, hit);
        emit(hit);
      });
    }

    for (var i = 0; i < cands.length; i++) {
      (function (cand) {
        probeIcon(cand, function (entry) {
          left--;
          if (settled) {
            // 总等待时间之后才回来的结果也别扔，至少先显示出来
            if (entry && !shown) {
              shown = entry;
              emit(entry);
              storeIcon(host, { u: entry.url, w: entry.w, t: Date.now() });
            }
            return;
          }
          offer(entry);
          if (left === 0) settle();
        });
      })(cands[i]);
    }

    setTimeout(settle, ICON_SETTLE_MS);
  }

  function cacheIconBytes(best, host, done) {
    // 太小的位图就别二次放大，原样用；矢量要转成 128 才耐放大
    if (!best.vector && best.w && best.w < ICON_MIN_SHARP) { done(""); return; }

    // favicon.im 查不到图标时给一张灰圈占位图，得靠像素识别出来
    var strict = best.url.indexOf("favicon.im/") >= 0;
    var proxy = "https://wsrv.nl/?url=" + encodeURIComponent(best.url) +
      "&w=" + ICON_SIZE + "&h=" + ICON_SIZE + "&fit=contain&output=png";

    function viaProxy() {
      fetchBlob(proxy, function (blob) { encodeIcon(blob, done, strict); });
    }

    if (best.vector) { viaProxy(); return; }  // 矢量交给图床光栅化，128px 才够清晰

    // 站点图标大多不带 CORS，直接取失败就借 wsrv 转一次
    fetchBlob(best.url, function (blob) {
      if (blob) encodeIcon(blob, done, strict);
      else viaProxy();
    });
  }

  function fetchBlob(url, done) {
    var opts = { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" };
    try {
      fetch(url, opts).then(function (res) {
        if (!res.ok) { done(null); return; }
        res.blob().then(function (blob) { done(blob); }, function () { done(null); });
      }, function () { done(null); });
    } catch (e) { done(null); }
  }

  /** 第三方服务的占位图通常是「一圈灰 + 大片透明」，
   *  真正的站点图标要么铺满，要么是彩色的 */
  function looksLikePlaceholder(canvas) {
    try {
      var probe = document.createElement("canvas");
      probe.width = probe.height = 32;
      var pctx = probe.getContext("2d");
      pctx.drawImage(canvas, 0, 0, 32, 32);
      var px = pctx.getImageData(0, 0, 32, 32).data;
      var opaque = 0, gray = 0;
      for (var i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 40) continue;
        opaque++;
        var r = px[i], g = px[i + 1], b = px[i + 2];
        if (Math.abs(r - g) < 16 && Math.abs(g - b) < 16) gray++;
      }
      if (!opaque) return true;
      var cover = opaque / 1024;
      return cover > 0.25 && cover < 0.62 && gray / opaque > 0.97;
    } catch (e) { return false; }
  }

  /** 把任意图标压成 128×128 透明背景的 PNG data URL */
  function encodeIcon(blob, done, strict) {
    if (!blob) { done(""); return; }

    var url = "";
    try { url = URL.createObjectURL(blob); } catch (e) { done(""); return; }

    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth || 0;
      var h = img.naturalHeight || 0;
      if (!w || !h) {
        // 矢量放到正方形里重新量，让 viewBox 撑满而不是停在 300×150
        img.width = img.height = ICON_SIZE;
        w = h = ICON_SIZE;
      }

      var canvas = document.createElement("canvas");
      canvas.width = canvas.height = ICON_SIZE;
      var ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      var scale = Math.min(ICON_SIZE / w, ICON_SIZE / h);
      var dw = Math.max(1, Math.round(w * scale));
      var dh = Math.max(1, Math.round(h * scale));
      ctx.drawImage(img, Math.round((ICON_SIZE - dw) / 2), Math.round((ICON_SIZE - dh) / 2), dw, dh);

      var placeholder = strict && looksLikePlaceholder(canvas);
      var data = "";
      try { data = canvas.toDataURL("image/png"); } catch (e) { data = ""; }
      URL.revokeObjectURL(url);
      done(placeholder ? "" : data, placeholder);
    };
    img.onerror = function () { URL.revokeObjectURL(url); done(""); };
    img.src = url;
  }

  function refreshIcon(img, host) {
    resolveIcon(host, function (entry) { if (entry) applyIcon(img, entry); });
  }

  /** 缓存里只有地址、没有图片数据时，后台补一份 128px */
  function upgradeIcon(img, host) {
    var hit = iconCache[host];
    if (!hit || !hit.u || hit.d || hit.miss) return;

    cacheIconBytes({ url: hit.u, w: hit.w || 0, vector: false }, host, function (data, placeholder) {
      if (placeholder) {
        iconMissed[host] = Date.now();
        storeIcon(host, { miss: 1, t: Date.now() });
        applyIcon(img, { miss: 1 });
        return;
      }
      if (!data) return;
      var fresh = iconCache[host];
      if (!fresh || fresh.u !== hit.u) return;
      fresh.d = data;
      fresh.t = Date.now();
      storeIcon(host, fresh);
      img.src = data;
    });
  }

  function paintIcon(img, host) {
    var hit = iconCache[host];
    var stale = !!(hit && hit.t && Date.now() - hit.t > ICON_TTL);

    // 0) 记着"这站没有能用的图标"：直接留首字母，别每次重新问
    if (hit && hit.miss) {
      applyIcon(img, { miss: 1 });
      if (stale) refreshIcon(img, host);
      return;
    }

    // 1) 本地已经有 128px 数据：直接上，一个请求都不发
    if (hit && hit.d) {
      applyIcon(img, hit);
      if (stale) refreshIcon(img, host);
      return;
    }

    // 2) 只记住过地址：先显示，再后台补图片数据
    if (hit && hit.u) {
      applyIcon(img, hit);
      if (stale) refreshIcon(img, host);
      else upgradeIcon(img, host);
      return;
    }

    // 3) 第一次见：联网找；刚问过没结果的先别重复问
    if (iconMissed[host] && Date.now() - iconMissed[host] < ICON_MISS_TTL) return;
    resolveIcon(host, function (entry) { if (entry) applyIcon(img, entry); });
  }

  function loadDockIcons() {
    var imgs = dockItemsEl.querySelectorAll("img[data-host], img[data-icon-host]");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.dataset.host) {
        img.dataset.iconHost = img.dataset.host;
        img.removeAttribute("data-host");
      }
      paintIcon(img, img.dataset.iconHost);
    }
  }

  /* ---------- 拖动排序 / 拖出移除 ---------- */

  function moveSite(from, to) {
    if (from === to) return;
    if (from < 0 || to < 0 || from >= sites.length || to >= sites.length) return;

    var item = sites.splice(from, 1)[0];
    sites.splice(to, 0, item);
    saveSites();

    // 直接搬 DOM 节点，避免重新渲染让图标闪一下
    var slots = useDockSlots();
    var node = slots[from];
    if (from < to) dockItemsEl.insertBefore(node, slots[to].nextSibling);
    else dockItemsEl.insertBefore(node, slots[to]);

    var ordered = useDockSlots();
    for (var i = 0; i < ordered.length; i++) ordered[i].style.setProperty("--i", i);
    dockAdd.style.setProperty("--i", sites.length);
    sizeHandle();
  }

  function useDockSlots() {
    return Array.prototype.slice.call(dockItemsEl.children);
  }

  function beginDrag() {
    // 先把放大状态清掉，否则量到的中心是放大后的位置，排序会偏
    resetMagnify();

    var slots = useDockSlots();
    var rect = dock.getBoundingClientRect();

    dragState.rect = rect;
    dragState.centers = slots.map(function (slot) {
      var box = slot.getBoundingClientRect();
      return box.left + box.width / 2;
    });
    dragState.pitch = slots.length > 1
      ? dragState.centers[1] - dragState.centers[0]
      : slots[0].offsetWidth + 6;
    dragState.slotW = slots[dragState.index].offsetWidth;
    dragState.target = dragState.index;
    dragState.started = true;

    suppressClick = true;
    dragState.slot.classList.add("dragging");
    dockItemsEl.classList.add("reordering");
  }

  function dragTarget(x) {
    var best = dragState.index;
    var bestDist = Infinity;
    for (var i = 0; i < dragState.centers.length; i++) {
      var dist = Math.abs(dragState.centers[i] - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  function dragOutside(x, y) {
    var r = dragState.rect;
    return y < r.top - DROP_OUT || y > r.bottom + DROP_OUT ||
      x < r.left - DROP_EDGE || x > r.right + DROP_EDGE;
  }

  /** 其他图标让出位置，形成要落下的空档 */
  function applyDragShift() {
    var slots = useDockSlots();
    var from = dragState.index;
    var to = dragState.target;

    for (var i = 0; i < slots.length; i++) {
      if (i === from) continue;
      var shift = 0;
      if (from < to && i > from && i <= to) shift = -dragState.pitch;
      else if (to < from && i >= to && i < from) shift = dragState.pitch;
      slots[i].style.transform = shift ? "translateX(" + shift + "px)" : "";
    }
  }

  function finishDrag(action) {
    if (!dragState) return;

    var state = dragState;
    dragState = null;

    try { state.link.releasePointerCapture(state.pointerId); } catch (e) {}

    state.slot.classList.remove("dragging", "outside");
    dockItemsEl.classList.remove("reordering");
    lineExtra = 0;
    // 布局会重新写回所有图标的 transform（包括被拖动的那个），不用手动清
    sizeHandle();

    // 松手后鼠标通常还停在图标上，立刻恢复放大，不等下一次 pointermove
    if (pointerX !== null && pointerNearDock(pointerX, pointerY)) {
      magTargetX = pointerX;
      magTargetY = pointerY;
      startDockTick();
    }

    if (!state.started) return;

    if (action === "remove") {
      removeSite(state.index);
    } else if (action === "drop" && state.target !== state.index) {
      moveSite(state.index, state.target);
      var moved = dockItemsEl.children[state.target];
      if (moved) moved.querySelector(".dock-item").focus({ preventScroll: true });
    } else if (action === "drop") {
      try { state.link.focus({ preventScroll: true }); } catch (e) {}
    }

    // 松手后图标回到原位，横条恢复基础宽度
    sizeHandle();
  }

  dockItemsEl.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    var link = e.target.closest(".dock-item");
    if (!link) return;

    suppressClick = false;
    dragState = {
      link: link,
      slot: link.parentNode,
      index: Array.prototype.indexOf.call(dockItemsEl.children, link.parentNode),
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      threshold: e.pointerType === "touch" ? 10 : DRAG_START,
      target: 0,
      started: false,
      outside: false,
      centers: [],
      pitch: 0,
      rect: null
    };

    try { link.setPointerCapture(e.pointerId); } catch (err) {}
  });

  dockItemsEl.addEventListener("pointermove", function (e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;

    var dx = e.clientX - dragState.startX;
    var dy = e.clientY - dragState.startY;

    if (!dragState.started) {
      if (dx * dx + dy * dy < dragState.threshold * dragState.threshold) return;
      beginDrag();
    }

    dragState.outside = dragOutside(e.clientX, e.clientY);
    dragState.target = dragTarget(e.clientX);

    // 横线随拖出的距离非线性收缩：外移 20px 才明显变短，松手即移除
    var outDist = Math.max(0, dy, Math.abs(dx) - (dragState.pitch * (dragState.centers.length - 1)) / 2);
    var shrink = Math.min(1, Math.pow(outDist / 100, 1.15));
    lineExtra = -dragState.slotW * shrink;
    refreshLine();

    var scale = dragState.outside ? 0.86 : 1.12;
    dragState.slot.style.transform =
      "translate3d(" + dx + "px," + dy + "px,0) scale(" + scale + ")";
    dragState.slot.classList.toggle("outside", dragState.outside);
    applyDragShift();
  });

  dockItemsEl.addEventListener("pointerup", function (e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    var action = "drop";
    if (dragState.started && dragOutside(e.clientX, e.clientY)) action = "remove";
    finishDrag(action);
  });

  dockItemsEl.addEventListener("pointercancel", function (e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    finishDrag("cancel");
  });

  dock.addEventListener("dragstart", function (e) { e.preventDefault(); });

  // 拖动结束后浏览器还会补一个 click，别让它把图标打开
  dockItemsEl.addEventListener("click", function (e) {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  var dockPinned = false;
  var proximityRaf = 0;
  var pointerX = null;
  var pointerY = null;
  var RETRACT_DELAY = 1500; // 鼠标移开后先停这么久，图标和横条再一起收（ms）
  var retractTimer = 0;     // 排队的收回计时器
  var REVEAL_DWELL_MS = 160; // 进入感应区后要停这么久才展开，快速路过不触发
  var revealEnterAt = 0;
  var revealDwellTimer = 0;
  var ENTRANCE_MS = 560;    // 与搜索栏入场时长对齐：结束前不按指针位置展开
  var entranceDone = REDUCE_MOTION;
  var pointerArmed = false; // 入场后指针真正移动过，才允许按接近度展开
  var armX = null;
  var armY = null;
  var ARM_MOVE = 3;         // 至少移动 3px 才算一次新的指针移动

  if (!entranceDone) {
    setTimeout(function () { entranceDone = true; }, ENTRANCE_MS);
  }

  function isDockHeld() {
    return dockPinned || dockWrap.classList.contains("editing");
  }

  function clamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  /** 把接近度设成目标值；真正的画面交给 dockTick 用递减凸函数推进 */
  function applyReveal(progress) {
    var next = clamp01(progress);
    if (next > 0) {
      cancelRetract();  // 鼠标回来了：取消排队
      pTarget = next;
      startDockTick();
      return;
    }
    if (pTarget <= 0 || retractTimer) return; // 已经收了，或者已经在排队
    // 先别动：图标和横条一起在原地待 RETRACT_DELAY，路过的鼠标不会让它闪一下
    retractTimer = setTimeout(function () {
      retractTimer = 0;
      pTarget = 0;
      fadeOutMagnify();
      startDockTick();
    }, RETRACT_DELAY);
  }

  /** 取消排队的收回（鼠标回来、或者明确要收） */
  function cancelRetract() {
    if (!retractTimer) return;
    clearTimeout(retractTimer);
    retractTimer = 0;
  }

  function cancelRevealDwell() {
    revealEnterAt = 0;
    if (!revealDwellTimer) return;
    clearTimeout(revealDwellTimer);
    revealDwellTimer = 0;
  }

  /** 明确要收（Esc、点空白处）：不排队，立刻开始收回 */
  function applyRevealNow(progress) {
    cancelRetract();
    pTarget = clamp01(progress);
    if (pTarget < 1) fadeOutMagnify();
    startDockTick();
  }

  /** 点横线时展开；可见性先打开，尺寸仍交给阻尼循环推进 */
  function revealNow() {
    cancelRetract();  // 点线展开时，别让之前排队的收回再把它关掉
    pTarget = 1;
    setDockOpen(true);
    startDockTick();
    layoutDock();
  }

  function setDockOpen(open) {
    if (open === dockIsOpen) return;
    dockIsOpen = open;
    dockWrap.classList.toggle("open", open);
    dockDot.setAttribute("aria-expanded", open ? "true" : "false");

    if (open) {
      loadDockIcons();
    } else {
      // 编辑态由 Esc / 提交 / 再次点 + 关闭，收回动画不得拆掉输入框
      resetMagnifyState();
    }
  }


  /** 图标开始出现时就用当前指针位置启动放大，和出现动画一起走 */
  function armMagnifyFromPointer() {
    if (dragState || editCatch || dockWrap.classList.contains("editing")) return;
    if (pTarget < 1 || pNow <= 0) return;
    if (pointerX === null || !pointerNearDock(pointerX, pointerY)) return;
    magTargetX = pointerX;
    magTargetY = pointerY;
    magFadeTarget = 1;
  }

  function startDockTick() {
    if (!dockTickRaf) dockTickRaf = requestAnimationFrame(dockTick);
  }

  /**
   * 一个循环同时推进三样东西：接近度、放大中心、横线状态。
   * 鼠标停下后会自己收敛、停表，不会空转。
   */
  function dockTick(ts) {
    dockTickRaf = 0;
    var moving = false;

    var dt = (ts - lastTickTs) / 1000;
    lastTickTs = ts;
    if (!(dt > 0)) dt = 1 / 60;
    else if (dt > 1 / 60) dt = 1 / 60; // 掉帧时宁可慢一点，也不放大成一次跳跃

    if (REDUCE_MOTION) {
      advanceReveal(ts);
      advanceSink(ts);
      armMagnifyFromPointer();
      magX = magTargetX;
      magY = magTargetY;
      advanceMagFade(ts);
      layoutDock();
      return;
    }

    if (advanceReveal(ts)) moving = true;
    if (advanceSink(ts)) moving = true;

    // 展开到位后，鼠标即使停在横线上也要开始放大，不用再等一次 pointermove
    armMagnifyFromPointer();

    if (editCatch) {
      var ct = (ts - editCatch.t0) / EDIT_CATCH_MS;
      if (ct >= 1) {
        magX = editCatch.toX;
        magY = editCatch.toY;
        magFade = editCatch.toFade;
        editCatch = null;
        moving = true;
      } else {
        if (ct < 0) ct = 0;
        var ck = easeOutCubic(ct);
        var fx = editCatch.fromX;
        var fy = editCatch.fromY;
        var tx = editCatch.toX;
        var ty = editCatch.toY;
        magX = fx == null ? tx : (tx == null ? fx : fx + (tx - fx) * ck);
        magY = fy == null ? ty : (ty == null ? fy : fy + (ty - fy) * ck);
        magFade = editCatch.fromFade + (editCatch.toFade - editCatch.fromFade) * ck;
        moving = true;
      }
    } else if (magTargetX === null) {
      // 指针已经离开：不再清空放大中心，只让强度慢慢退回，
      // 图标从当前大小/位置平滑落回，不会一帧之内“啪”地归位
      if (magFade <= 0.0005) {
        if (magX !== null || magY !== null) {
          magX = null;
          magY = null;
          moving = true;
        }
      }
    } else if (magX === null) {
      magX = magTargetX;
      magY = magTargetY;
      moving = true;
    } else {
      var mx = magTargetX - magX;
      var my = magTargetY - magY;
      if (Math.abs(mx) > 0.25 || Math.abs(my) > 0.25) {
        magX += mx * MAG_DAMP;
        magY += my * MAG_DAMP;
        moving = true;
      } else {
        magX = magTargetX;
        magY = magTargetY;
      }
    }

    if (!editCatch && advanceMagFade(ts)) moving = true;

    layoutDock();

    if (moving) dockTickRaf = requestAnimationFrame(dockTick);
  }

  /**
   * 每帧按“展开进度 + 鼠标位置”重排 dock：
   *   1. 展开是开关：靠近就收到 1、离开再收到 0，不按距离连续缩放图标；
   *   2. 收回只用上移和淡出（CSS --reveal），缩放始终不小于 1，避免压扁成点；
   *   3. 图标一开始出现，就按鼠标位置做 macOS 式放大和左右让位。
   * 只改 transform，不动布局；offsetLeft/offsetWidth 永远是干净的静止值。
   */
  function layoutDock() {
    var e = clamp01(pNow);
    var fullyOpen = e >= 0.995;
    var sunk = sinkNow;

    dockWrap.style.setProperty("--sink", sunk.toFixed(3));
    dockWrap.style.setProperty("--reveal", e.toFixed(3));
    // 出现/收回过程中让横线宽度逐帧跟住图标排，别被 CSS 过渡拖出偏差
    dockWrap.classList.toggle("revealing", pNow > 0.0001 && pNow < 0.995);

    lineGrow = e;
    // 编辑态钉住展开，避免收回动画把输入框拆掉
    setDockOpen(pNow > 0.001 || dockPinned || dockWrap.classList.contains("editing"));

    // 拖动时图标位置由拖动逻辑接管；编辑时钉住进入时的放大，不跟着鼠标跳
    if (dragState || dockWrap.classList.contains("editing")) {
      refreshLine();
      return;
    }

    var entries = [];
    for (var i = 0; i < dockItemsEl.children.length; i++) {
      entries.push(dockItemsEl.children[i]);
    }
    entries.push(dockAdd);

    var count = entries.length;
    if (!count) { refreshLine(); return; }

    var wrapRect = dockWrap.getBoundingClientRect();
    var originX = wrapRect.left + (dockWrap.clientWidth - dock.offsetWidth) / 2;
    // 图标从横线里往上浮，算垂直距离时跟着它当前的高度走，鼠标才像真的在图标旁边
    var centerY = wrapRect.top + dock.offsetTop + dock.offsetHeight / 2 + 34 * (1 - e);
    var mx = (e > 0 && magX !== null) ? magX - originX : null;
    var dy = magY === null ? 0 : Math.max(0, Math.abs(magY - centerY) - dock.offsetHeight / 2);

    var rest = [];
    var restTotal = 0;
    for (var a = 0; a < count; a++) {
      var width = entries[a].offsetWidth || 38;
      rest.push({ el: entries[a], center: entries[a].offsetLeft + width / 2, width: width });
      restTotal += width;
    }
    restTotal += dockGap * (count - 1);

    // 横线长度跟着当前放大后的整排走：指针在中间时两侧都放大、线最长；
    // 挪到边上时只有一侧放大，线跟着收短；平时（鼠标不在附近）只跟展开度走。
    var center = dock.offsetWidth / 2;
    var baseSpan = Math.max(44, Math.min(LINE_BASE, restTotal));
    var growSpan = baseSpan + (restTotal - baseSpan) * e;
    var grow = [];
    var natural = 0;

    for (var b = 0; b < count; b++) {
      // 槽位中心按「当前展开宽」铺开，不用最长线宽，放大中心不会跟着外扩
      var slotCenter = center + (rest[b].center - center) * (growSpan / restTotal);
      var k = 1;
      if (mx !== null) {
        var dist = mx - slotCenter;
        // magFade 让放大强度独立于鼠标位置慢慢退回：指针快速甩开后，
        // 图标仍从当前大小平滑缩回原状，邻居也随之缓缓让回
        k = 1 + (MAG_MAX - 1) * Math.exp(-(dist * dist + dy * dy) / (2 * MAG_SIGMA * MAG_SIGMA)) * magFade;
      }
      grow.push(k);
      // 占位按完整图标宽度，不用展开度去缩小，避免图标被压扁
      natural += rest[b].width * k;
    }

    // 两端各留 LINE_PAD：线刚好包住放大后的整排，图标不贴线端
    var minGap = dockGap * (count - 1);
    var openSpan = natural + minGap + LINE_PAD * 2;
    var lineSpan = baseSpan + (Math.max(openSpan, growSpan) - baseSpan) * e;
    refreshLine(lineSpan);

    // 完全展开后才做宽度保护；展开过程中线可以短于图标，由上移和淡出来过渡
    var avail = lineSpan - minGap - LINE_PAD * 2;
    if (fullyOpen && natural > avail && natural > 0.001) {
      var fit = avail / natural;
      for (var b2 = 0; b2 < count; b2++) grow[b2] *= fit;
      natural *= fit;
    }

    // 图标排按自身宽度居中、间距恒定 6px；缩放只用于悬停放大，最低为 1
    var rowSpan = natural + minGap;
    var x = center - rowSpan / 2;
    for (var c = 0; c < count; c++) {
      var scale = grow[c] < 1 ? 1 : grow[c];
      var tx = x + (rest[c].width * scale) / 2 - rest[c].center;
      entries[c].style.transform = "translateX(" + tx.toFixed(2) + "px) scale(" + scale.toFixed(3) + ")";
      entries[c].style.zIndex = grow[c] > 1.06 ? "3" : "";
      x += rest[c].width * scale + dockGap;
    }
  }

  function easeOutProgress(from, to, t0, ts, duration) {
    var span = Math.abs(to - from);
    var dur = duration * (span > 0.001 ? span : 1);
    var t = (ts - t0) / dur;
    if (t >= 1) return to;
    if (t < 0) t = 0;
    return from + (to - from) * easeOutCubic(t);
  }

  /** 图标出现/收回：从当前位置用 1-(1-t)^3 走到目标，中途反向则就地转 */
  function advanceReveal(ts) {
    var want = pTarget > 0 ? 1 : 0;
    if (REDUCE_MOTION) {
      if (pNow === want && pAnimTo === want) return false;
      pNow = pFrom = pAnimTo = want;
      return true;
    }
    if (want !== pAnimTo) {
      pFrom = pNow;
      pAnimTo = want;
      pT0 = ts;
    }
    if (pNow === pAnimTo) return false;
    pNow = easeOutProgress(pFrom, pAnimTo, pT0, ts, REVEAL_MS);
    return true;
  }

  /** 放大强度同样用递减凸函数，进入和回落都从当前位置接着走 */
  function advanceMagFade(ts) {
    var want = magFadeTarget;
    if (REDUCE_MOTION) {
      if (magFade === want && magFadeTo === want) return false;
      magFade = magFadeFrom = magFadeTo = want;
      return true;
    }
    if (want !== magFadeTo) {
      magFadeFrom = magFade;
      magFadeTo = want;
      magFadeT0 = ts;
    }
    if (Math.abs(magFade - magFadeTo) <= 0.0005) {
      magFade = magFadeTo;
      return false;
    }
    var ms = magFadeTo > magFadeFrom ? MAG_IN_MS : MAG_OUT_MS;
    magFade = easeOutProgress(magFadeFrom, magFadeTo, magFadeT0, ts, ms);
    return true;
  }

  /** 鼠标离横线上下 160px 内、左右端点外 160px 内都算“接近” */
  /** 横线上下移动：从当前位置用 1-(1-t)^3 走到目标，中途反向则就地转 */
  function advanceSink(ts) {
    var want = pTarget > 0 ? 1 : 0;
    if (REDUCE_MOTION) {
      if (sinkNow === want && sinkTo === want) return false;
      sinkNow = sinkFrom = sinkTo = want;
      return true;
    }
    if (want !== sinkTo) {
      sinkFrom = sinkNow;
      sinkTo = want;
      sinkT0 = ts;
    }
    if (sinkNow === sinkTo) return false;
    sinkNow = easeOutProgress(sinkFrom, sinkTo, sinkT0, ts, SINK_MS);
    return true;
  }

  function proximityAt(x, y) {
    // 从正上方点搜索框时，指针会先经过搜索框上方的感应区；
    // 搜索框及其正上方都不展开，只有到搜索框下方靠近横线才响应
    if (form) {
      var box = form.getBoundingClientRect();
      if (y <= box.bottom && x >= box.left && x <= box.right) return 0;
    }
    var rect = dockWrap.getBoundingClientRect();
    var top = rect.top + rect.height / 2;
    var bottom = top + 60;
    var centerX = rect.left + rect.width / 2;
    var dx = Math.max(0, Math.abs(x - centerX) - rect.width / 2);
    var dy = y < top ? top - y : (y > bottom ? y - bottom : 0);
    var distance = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1 - distance / REVEAL_RADIUS);
  }

  function updateProximity() {
    proximityRaf = 0;

    if (dragState || isDockHeld()) {
      cancelRevealDwell();
      applyReveal(1);
      return;
    }
    if (pointerX === null) return;
    var near = proximityAt(pointerX, pointerY) > 0;
    // 已经要展开或已经展开：在区内移动立刻保持，不用再等
    if (near && pTarget > 0) {
      cancelRevealDwell();
      applyReveal(1);
      return;
    }
    if (near) {
      if (!revealEnterAt) revealEnterAt = performance.now();
      var waited = performance.now() - revealEnterAt;
      if (waited >= REVEAL_DWELL_MS) {
        cancelRevealDwell();
        applyReveal(1);
        return;
      }
      if (!revealDwellTimer) {
        revealDwellTimer = setTimeout(function () {
          revealDwellTimer = 0;
          scheduleProximity();
        }, REVEAL_DWELL_MS - waited);
      }
      return;
    }
    cancelRevealDwell();
    applyReveal(0);
  }

  function scheduleProximity() {
    if (proximityRaf) return;
    proximityRaf = requestAnimationFrame(updateProximity);
  }

  function showDockForm() {
    cancelRetract();
    pTarget = 1;
    setDockOpen(true);
    editCatch = null;
    editMagX = magX;
    editMagY = magY;
    editMagFade = magFade;
    magTargetX = magX;
    magTargetY = magY;
    magFadeTarget = magFade;
    startDockTick();
    dockWrap.classList.add("editing");
    dockAdd.setAttribute("aria-expanded", "true");
    resetDockNote();
    dockUrl.focus({ preventScroll: true });
  }

  function hideDockForm() {
    if (!dockWrap.classList.contains("editing")) return;
    dockWrap.classList.remove("editing");
    dockAdd.setAttribute("aria-expanded", "false");
    resetDockNote();
    if (dockWrap.contains(document.activeElement)) document.activeElement.blur();
    // 图标还停在点 + 时的放大，用 1-(1-t)^3 在 0.5 秒内追到现在的指针
    magX = editMagX;
    magY = editMagY;
    magFade = editMagFade;
    var toX;
    var toY;
    var toFade;
    if (pointerX !== null && pointerNearDock(pointerX, pointerY) && pNow >= 0.995) {
      if (magX === null) {
        magX = pointerX;
        magY = pointerY;
      }
      toX = pointerX;
      toY = pointerY;
      toFade = 1;
      magTargetX = pointerX;
      magTargetY = pointerY;
      magFadeTarget = 1;
    } else {
      toX = magX;
      toY = magY;
      toFade = 0;
      magTargetX = null;
      magTargetY = null;
      magFadeTarget = 0;
    }
    if (REDUCE_MOTION) {
      magX = toX;
      magY = toY;
      magFade = toFade;
      editCatch = null;
    } else {
      editCatch = {
        t0: performance.now(),
        fromX: magX,
        fromY: magY,
        fromFade: magFade,
        toX: toX,
        toY: toY,
        toFade: toFade
      };
    }
    startDockTick();
  }

  function resetDockNote() {
    dockNote.textContent = DOCK_HINT;
    dockNote.classList.remove("is-error");
    dockUrl.removeAttribute("aria-invalid");
  }

  function dockErrorMsg(message) {
    dockNote.textContent = message;
    dockNote.classList.add("is-error");
    dockUrl.setAttribute("aria-invalid", "true");
    dockForm.classList.remove("invalid");
    void dockForm.offsetWidth;
    dockForm.classList.add("invalid");
  }

  dockForm.addEventListener("animationend", function () {
    dockForm.classList.remove("invalid");
  });

  dockUrl.addEventListener("input", resetDockNote);

  dockForm.addEventListener("submit", function (e) {
    e.preventDefault();

    var value = dockUrl.value.trim();
    if (!value) { dockUrl.focus(); return; }

    var url = asUrl(value);
    if (!url) {
      dockErrorMsg("网址格式不对，例如 github.com");
      return;
    }

    if (sites.indexOf(url) === -1 && sites.length >= DOCK_MAX) {
      dockErrorMsg("最多 " + DOCK_MAX + " 个，先移除一个");
      return;
    }

    if (sites.indexOf(url) === -1) {
      sites.push(url);
      saveSites();
      renderDock();
    }

    dockUrl.value = "";
    hideDockForm();
    dockAdd.focus({ preventScroll: true });
  });

  /* ---------- 撤销提示 ---------- */

  function hideToast() {
    clearTimeout(toastHideTimer);
    clearTimeout(toastRemoveTimer);
    toast.classList.remove("show");
    toastRemoveTimer = setTimeout(function () {
      pendingUndo = null;
      toast.hidden = true;
      if (toast.contains(document.activeElement)) document.activeElement.blur();
    }, 240);
  }

  function showToast(message, undo) {
    clearTimeout(toastHideTimer);
    clearTimeout(toastRemoveTimer);
    pendingUndo = undo;
    toastText.textContent = message;
    toast.hidden = false;
    void toast.offsetWidth; // 先回到隐藏态，展开才有过渡
    toast.classList.add("show");
    toastHideTimer = setTimeout(hideToast, TOAST_MS);
  }

  toastAction.addEventListener("click", function () {
    var undo = pendingUndo;
    if (!undo) return;
    hideToast();
    undo();
    live.textContent = "已恢复快捷网站";
  });

  function removeSite(index) {
    if (index < 0 || index >= sites.length) return;

    var url = sites[index];
    var name = siteName(url);
    var active = document.activeElement;
    var keepFocus = dockItemsEl.contains(active);
    var fromTile = keepFocus && active.classList.contains("dock-item");

    sites.splice(index, 1);
    saveSites();
    renderDock();

    if (keepFocus) {
      var next = fromTile && sites.length
        ? dockItemsEl.children[Math.min(index, sites.length - 1)].querySelector(".dock-item")
        : null;
      (next || dockAdd).focus({ preventScroll: true });
    }

    showToast("已移除 " + name, function () {
      if (sites.indexOf(url) !== -1 || sites.length >= DOCK_MAX) return;
      sites.splice(Math.min(index, sites.length), 0, url);
      saveSites();
      renderDock();
    });
  }

  dockItemsEl.addEventListener("contextmenu", function (e) {
    var link = e.target.closest(".dock-item");
    if (!link) return;
    var index = Array.prototype.indexOf.call(dockItemsEl.children, link.parentNode);
    if (index < 0) return;
    e.preventDefault();
    removeSite(index);
  });

  dockItemsEl.addEventListener("keydown", function (e) {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    var link = e.target.closest(".dock-item");
    if (!link) return;
    e.preventDefault();
    removeSite(Array.prototype.indexOf.call(dockItemsEl.children, link.parentNode));
  });

  dockAdd.addEventListener("click", function () {
    if (dockWrap.classList.contains("editing")) hideDockForm();
    else showDockForm();
  });

  dockDot.addEventListener("click", function () {
    dockPinned = true;
    revealNow();
    var first = dockItemsEl.querySelector(".dock-item");
    (first || dockAdd).focus({ preventScroll: true });
  });

  dockWrap.addEventListener("focusin", function () {
    applyReveal(1);
  });

  dockWrap.addEventListener("focusout", function (e) {
    if (dockWrap.contains(e.relatedTarget)) return;
    if (isDockHeld()) return;
    if (pointerX === null) applyReveal(0);
    else applyReveal(proximityAt(pointerX, pointerY) > 0 ? 1 : 0);
  });

  /** 入场结束前忽略指针位置；结束后还要再真正移动过，才按接近度展开 */
  function trackHoverPointer(e) {
    if (e.pointerType === "touch") return false;
    if (!pointerArmed) {
      if (armX === null || !entranceDone) {
        armX = e.clientX;
        armY = e.clientY;
        return false;
      }
      var dx = e.clientX - armX;
      var dy = e.clientY - armY;
      if (dx * dx + dy * dy < ARM_MOVE * ARM_MOVE) return false;
      pointerArmed = true;
    }
    pointerX = e.clientX;
    pointerY = e.clientY;
    return true;
  }

  document.addEventListener("pointermove", function (e) {
    if (!trackHoverPointer(e)) return;
    scheduleProximity();
  });

  document.documentElement.addEventListener("pointerleave", function () {
    pointerX = null;
    fadeOutMagnify();
    startDockTick();
    if (isDockHeld()) return;
    applyReveal(0);
  });

  window.addEventListener("blur", function () {
    fadeOutMagnify();
    startDockTick();
    if (isDockHeld()) return;
    applyReveal(0);
  });

  document.addEventListener("pointerdown", function (e) {
    if (dockWrap.contains(e.target)) return;
    // 点搜索框不要误关；点旁边空白处只收起胶囊，横线保持当前状态
    if (dockWrap.classList.contains("editing")) {
      if (form && form.contains(e.target)) return;
      pointerX = e.clientX;
      pointerY = e.clientY;
      hideDockForm();
      return;
    }
    dockPinned = false;
    applyRevealNow(0);
  });

  /* ---------- 放大 + 左右让位（类似 macOS Dock） ---------- */

  function resetMagnifyState() {
    magTargetX = null;
    magTargetY = null;
    magX = null;
    magY = null;
    magFade = 0;
    magFadeTarget = 0;
  }

  /**
   * 指针快速离开接近区/页面：不硬清放大中心，只把放大强度交给阻尼退回 0。
   * 这样图标会从当前大小缓慢落回原位，而不是在离开那一帧突然弹回。
   */
  function fadeOutMagnify() {
    if (magTargetX === null && magFadeTarget === 0) return;
    magTargetX = null;
    magTargetY = null;
    magFadeTarget = 0;
  }

  function resetMagnify() {
    resetMagnifyState();

    if (dragState) {
      // 拖动前先量位置：清掉内联位移，量到的才是图标真正停着的地方
      var entries = [];
      for (var i = 0; i < dockItemsEl.children.length; i++) entries.push(dockItemsEl.children[i]);
      entries.push(dockAdd);
      for (var a = 0; a < entries.length; a++) {
        entries[a].style.transform = "";
        entries[a].style.zIndex = "";
      }
      lineExtra = 0;
      refreshLine();
    } else {
      startDockTick();
    }
  }

  function pointerNearDock(x, y) {
    return proximityAt(x, y) > 0;
  }

  // 鼠标位置只作为“放大的目标”，每帧由 dockTick 阻尼追上；
  // 图标一开始出现就放大，和展开同步，不再等完全展开
  document.addEventListener("pointermove", function (e) {
    if (!trackHoverPointer(e) || dragState) return;
    // 编辑时不更新放大目标，取消后由 hideDockForm 从钉住的状态平滑接上
    if (dockWrap.classList.contains("editing") || editCatch) return;

    if (!pointerNearDock(e.clientX, e.clientY) || pTarget < 1 || pNow <= 0) {
      // 快速甩出接近区：放大中心停在最后位置，强度交给阻尼慢慢退回
      if (magTargetX !== null || magFadeTarget !== 0) {
        fadeOutMagnify();
        startDockTick();
      }
      return;
    }

    magTargetX = e.clientX;
    magTargetY = e.clientY;
    magFadeTarget = 1;
    startDockTick();
  });

  document.addEventListener("pointercancel", function () {
    if (dragState) return;
    resetMagnifyState();
    startDockTick();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !dockIsOpen) return;
    if (dragState) {
      finishDrag("cancel");
    } else if (dockWrap.classList.contains("editing")) {
      hideDockForm();
      dockAdd.focus({ preventScroll: true });
    } else {
      if (dockWrap.contains(document.activeElement)) document.activeElement.blur();
      dockPinned = false;
      applyRevealNow(0);
    }
  });

  renderDock();

  /* ---------- 快捷键 / 初始化 ---------- */

  document.addEventListener("keydown", function (e) {
    var tag = document.activeElement && document.activeElement.tagName;
    var typing = tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement && document.activeElement.isContentEditable);

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      closeMenu(false);
      q.focus();
      q.select();
      return;
    }

    if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      q.focus();
    }
  });

  selectEngine(readEngine(), false);

  // 扩展环境：启动后从 chrome.storage 拉一次，关掉浏览器也不会丢
  if (extStore) {
    try {
      extStore.get([DOCK_KEY, STORE_KEY, ICON_CACHE_KEY], function (data) {
        if (!data) return;

        if (!Array.isArray(data[DOCK_KEY]) && sites.length) {
          // 旧版本只存在 localStorage，补写一份到扩展存储
          saveSites();
        } else if (Array.isArray(data[DOCK_KEY])) {
          var clean = cleanSites(data[DOCK_KEY]);
          if (clean.join("\n") !== sites.join("\n")) {
            sites = clean;
            renderDock();
          }
        }

        // localStorage 被清过时，图标缓存还能从扩展存储里捞回来
        if (data[ICON_CACHE_KEY] && typeof data[ICON_CACHE_KEY] === "object") {
          var stored = data[ICON_CACHE_KEY];
          var merged = false;
          for (var host in stored) {
            if (!Object.prototype.hasOwnProperty.call(stored, host)) continue;
            if (!iconCache[host]) { iconCache[host] = stored[host]; merged = true; }
          }
          if (merged) {
            writeIconCache();
            loadDockIcons();
          }
        }

        if (typeof data[STORE_KEY] === "string") {
          for (var i = 0; i < ENGINES.length; i++) {
            if (ENGINES[i].id === data[STORE_KEY]) {
              selectEngine(ENGINES[i], false);
              break;
            }
          }
        }
      });
    } catch (e) { /* 忽略 */ }
  }

  // 触屏设备不强弹键盘
  if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
    q.focus({ preventScroll: true });
  }
})();
