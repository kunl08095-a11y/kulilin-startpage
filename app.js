
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
  var magTargetX = null;
  var magTargetY = null;
  var magX = null;
  var magY = null;
  var MAG_DAMP = 0.18;      // 每帧向鼠标追 18%，放大中心因此有减速感
  var P_DAMP = 0.16;        // 接近度同样阻尼推进，靠近/离开都不会硬切
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
  var SINK_GAIN = 2;       // 下沉比接近程度快多少倍完成（0.5 处沉到底）
  var ICON_FROM = 0.35;    // 接近程度超过这里图标才开始淡入

  var MAG_SIGMA = 100;      // 放大影响的范围（px），越大过渡越平缓
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

  var ICON_SOURCES = [
    function (host) { return "https://" + host + "/favicon.ico"; },
    function (host) { return "https://favicon.cccyun.cc/" + host; },
    function (host) { return "https://www.faviconextractor.com/favicon/" + host; }
  ];

  function loadIcon(img, host) {
    var settled = false;

    function finish(url) {
      if (settled) return;
      settled = true;
      img.src = url;
      img.classList.add("loaded");
    }

    function probe(url, wait) {
      var image = new Image();
      var timer = setTimeout(function () {
        image.onload = null;
        image.onerror = null;
        image.src = "";
      }, wait);

      image.referrerPolicy = "no-referrer";
      image.onload = function () {
        clearTimeout(timer);
        finish(url);
      };
      image.onerror = function () {
        clearTimeout(timer);
      };
      image.src = url;
    }

    // 直连站点图标和国内图标服务同时查，谁先回来用谁
    probe(ICON_SOURCES[0](host), 4000);
    probe(ICON_SOURCES[1](host), 4000);

    setTimeout(function () {
      if (!settled) probe(ICON_SOURCES[2](host), 5000);
    }, 1200);

    setTimeout(function () {
      if (settled) return;
      settled = true;
      img.remove();
    }, 7000);
  }

  function loadDockIcons() {
    var imgs = dockItemsEl.querySelectorAll("img[data-host]");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var host = img.dataset.host;
      img.removeAttribute("data-host");
      loadIcon(img, host);
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

  function clamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  function smoothstep(value) {
    var t = clamp01(value);
    return t * t * (3 - 2 * t);
  }

  /** 把接近度设成目标值；真正的画面交给 dockTick 每帧阻尼推进 */
  function applyReveal(progress) {
    pTarget = clamp01(progress);
    startDockTick();
  }

  /** 点横线时立即展开，保证 focus() 时元素已经可见 */
  function revealNow() {
    pTarget = 1;
    pNow = 1;
    setDockOpen(true);
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
      hideDockForm();
      resetMagnifyState();
    }
  }

  function startDockTick() {
    if (!dockTickRaf) dockTickRaf = requestAnimationFrame(dockTick);
  }

  /**
   * 一个循环同时推进三样东西：接近度、放大中心、横线状态。
   * 鼠标停下后会自己收敛、停表，不会空转。
   */
  function dockTick() {
    dockTickRaf = 0;
    var moving = false;

    if (REDUCE_MOTION) {
      pNow = pTarget;
      magX = magTargetX;
      magY = magTargetY;
      layoutDock();
      return;
    }

    var dp = pTarget - pNow;
    if (Math.abs(dp) > 0.0006) {
      pNow += dp * P_DAMP;
      moving = true;
    } else {
      pNow = pTarget;
    }

    if (magTargetX === null) {
      if (magX !== null) {
        magX = null;
        magY = null;
        moving = true;
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

    layoutDock();

    if (moving) dockTickRaf = requestAnimationFrame(dockTick);
  }

  /**
   * 每帧按“接近程度 + 鼠标位置”重排 dock：
   *   1. 接近程度 e 决定图标从横线里长出多少：缩放从 0 到 1、整排从中心向两侧铺开；
   *   2. 鼠标位置决定每个图标放大多少，放大后的图标把邻居推开，左右距离随之变化；
   *   3. “+”（dock-add）和普通图标走同一套计算，一起出现、一起被放大/让位。
   * 只改 transform，不动布局；offsetLeft/offsetWidth 永远是干净的静止值。
   */
  function layoutDock() {
    var e = smoothstep(clamp01((pNow - ICON_FROM) / (1 - ICON_FROM)));
    var sunk = sink(pNow);

    dockWrap.style.setProperty("--sink", sunk.toFixed(3));
    dockWrap.style.setProperty("--reveal", e.toFixed(3));

    lineGrow = e;
    setDockOpen(pNow >= ICON_FROM);

    // 拖动时图标位置由拖动逻辑接管；编辑时 dock 本身隐藏
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
    var mx = magX === null ? null : magX - originX;
    var dy = magY === null ? 0 : Math.max(0, Math.abs(magY - centerY) - dock.offsetHeight / 2);

    var rest = [];
    var restTotal = 0;
    for (var a = 0; a < count; a++) {
      var width = entries[a].offsetWidth || 38;
      rest.push({ el: entries[a], center: entries[a].offsetLeft + width / 2, width: width });
      restTotal += width;
    }
    restTotal += dockGap * (count - 1);

    // 任何时刻「图标排的外宽」和横线一致：刚冒头时先从线的基本长度开始，
    // 图标一边长大一边把整排撑到最终宽度，余量均匀分给图标间距。
    var center = dock.offsetWidth / 2;
    var baseSpan = Math.max(44, Math.min(LINE_BASE, restTotal));
    var span = baseSpan + (restTotal - baseSpan) * e;
    var grow = [];
    var natural = 0;

    for (var b = 0; b < count; b++) {
      // 用按比例铺开后的槽位中心算放大，鼠标在左/右时近的一侧先变大
      var slotCenter = center + (rest[b].center - center) * (span / restTotal);
      var k = 1;
      if (mx !== null) {
        var dist = mx - slotCenter;
        k = 1 + (MAG_MAX - 1) * Math.exp(-(dist * dist + dy * dy) / (2 * MAG_SIGMA * MAG_SIGMA));
      }
      grow.push(k);
      natural += rest[b].width * e * k;
    }

    // 图标总宽超过线长时把线撑开，避免挤成一团；否则把余量均匀分给间距
    if (count > 1) {
      span = Math.max(span, natural + dockGap * (count - 1));
    } else {
      span = Math.max(span, natural);
    }
    refreshLine(span);

    var gap = count > 1 ? (span - natural) / (count - 1) : 0;
    var x = center - span / 2;
    for (var c = 0; c < count; c++) {
      var scale = e * grow[c];
      var tx = x + (rest[c].width * scale) / 2 - rest[c].center;
      entries[c].style.transform = "translateX(" + tx.toFixed(2) + "px) scale(" + scale.toFixed(3) + ")";
      entries[c].style.zIndex = grow[c] > 1.06 ? "3" : "";
      x += rest[c].width * scale + gap;
    }

    dockWrap.style.setProperty("--lift", e > 0.85 && span > restTotal + 0.5 ? "1" : "0");
  }

  /** 鼠标离横线上下 160px 内、左右端点外 160px 内都算“接近” */
  function proximityAt(x, y) {
    var rect = dockWrap.getBoundingClientRect();
    var top = rect.top + rect.height / 2;
    var bottom = top + 60;
    var centerX = rect.left + rect.width / 2;
    var dx = Math.max(0, Math.abs(x - centerX) - rect.width / 2);
    var dy = y < top ? top - y : (y > bottom ? y - bottom : 0);
    var distance = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1 - distance / REVEAL_RADIUS);
  }

  /** 展开程度 → 横线下沉量（0~1），比靠得最近的那一下更早沉到底 */
  function sink(progress) {
    return Math.min(1, progress * SINK_GAIN);
  }

  function updateProximity() {
    proximityRaf = 0;

    if (dragState || dockPinned || dockWrap.classList.contains("editing")) {
      applyReveal(1);
      return;
    }
    if (pointerX === null) return;
    applyReveal(proximityAt(pointerX, pointerY));
  }

  function scheduleProximity() {
    if (proximityRaf) return;
    proximityRaf = requestAnimationFrame(updateProximity);
  }

  function showDockForm() {
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
    if (dockPinned) return;
    if (pointerX === null) applyReveal(0);
    else applyReveal(proximityAt(pointerX, pointerY));
  });

  document.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    pointerX = e.clientX;
    pointerY = e.clientY;
    scheduleProximity();
  });

  document.documentElement.addEventListener("pointerleave", function () {
    pointerX = null;
    resetMagnifyState();
    startDockTick();
    if (dockPinned || dockWrap.classList.contains("editing")) return;
    applyReveal(0);
  });

  window.addEventListener("blur", function () {
    resetMagnifyState();
    startDockTick();
    if (dockPinned || dockWrap.classList.contains("editing")) return;
    applyReveal(0);
  });

  document.addEventListener("pointerdown", function (e) {
    if (dockWrap.contains(e.target)) return;
    dockPinned = false;
    hideDockForm();
    applyReveal(0);
  });

  /* ---------- 放大 + 左右让位（类似 macOS Dock） ---------- */

  function resetMagnifyState() {
    magTargetX = null;
    magTargetY = null;
    magX = null;
    magY = null;
    dockWrap.style.setProperty("--lift", "0");
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

  // 放大和“接近”用同一个判定范围：横线刚开始沉、图标刚冒头时，
  // 鼠标还在下方的接近区里，缩放就已经跟着鼠标位置走了
  function pointerNearDock(x, y) {
    return proximityAt(x, y) > 0;
  }

  // 鼠标位置只作为“放大的目标”，每帧由 dockTick 阻尼追上；
  // dock 还没完全出现时也照样算，图标一冒头就是被鼠标顶大的样子
  document.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch" || dragState) return;

    if (!pointerNearDock(e.clientX, e.clientY)) {
      if (magX !== null || magTargetX !== null) {
        resetMagnifyState();
        startDockTick();
      }
      return;
    }

    magTargetX = e.clientX;
    magTargetY = e.clientY;
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
      applyReveal(0);
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
      extStore.get([DOCK_KEY, STORE_KEY], function (data) {
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
