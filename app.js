
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
  var magRaf = 0;
  var magTargetX = null;
  var magTargetY = null;
  var magX = null;
  var magY = null;
  var MAG_DAMP = 0.18;      // 每帧向鼠标追 18%，放大中心因此有减速感

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
  var MAG_GAP = 6;          // 图标之间的间隙，放大时保持不变
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
  function refreshLine() {
    if (!sites.length) { updateLineWidth(44); return; }
    var minW = Math.min(LINE_BASE, dock.offsetWidth);
    var target = Math.max(minW, dock.offsetWidth + lineExtra);
    lineBase = minW + (target - minW) * lineGrow;
    updateLineWidth(lineBase);
  }

  function sizeHandle() {
    var hasSites = sites.length > 0;
    // 图标槽位永远是 38px，dock.offsetWidth 就是静止宽度，不会被放大污染
    var full = hasSites ? Math.max(44, dock.offsetWidth) : 44;

    dockWrap.classList.toggle("has-sites", hasSites);
    dockWrap.style.width = full + "px";
    if (!dockIsOpen) lineGrow = 0;
    refreshLine();
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
    sizeHandle();

    var slots = useDockSlots();
    for (var i = 0; i < slots.length; i++) slots[i].style.transform = "";

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

  function applyReveal(progress) {
    var p = Math.max(0, Math.min(1, progress));
    var sunk = sink(p);
    dockWrap.style.setProperty("--sink", sunk.toFixed(3));

    // 横线沉到底后图标才浮现，避免图标压在线上
    var icons = Math.max(0, Math.min(1, (p - ICON_FROM) / (1 - ICON_FROM)));
    dockWrap.style.setProperty("--reveal", icons.toFixed(3));

    // 横线长度和图标同步：图标长多少，线就长多少
    var grow = icons * icons * (3 - 2 * icons);
    lineGrow = grow;
    refreshLine();

    // 约 66px 处开始可交互；图标本身按 --reveal 继续淡入，不再有跳变
    var open = p >= ICON_FROM;
    if (open === dockIsOpen) return;

    dockIsOpen = open;
    dockWrap.classList.toggle("open", open);
    dockDot.setAttribute("aria-expanded", open ? "true" : "false");

    if (open) {
      loadDockIcons();
      // 鼠标一次跳到 dock 上时，先补一次放大目标，别等下一次 pointermove
      if (pointerX !== null) {
        magTargetX = pointerX;
        magTargetY = pointerY;
        if (!magRaf) magRaf = requestAnimationFrame(magStep);
      }
    } else {
      hideDockForm();
      resetMagnify();
    }
  }

  /** 鼠标离横线上下 70px 内、左右端点外 70px 内都算“接近” */
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
    applyReveal(1);
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
    if (dockPinned || dockWrap.classList.contains("editing")) return;
    applyReveal(0);
  });

  window.addEventListener("blur", function () {
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

  function visibleSlots() {
    return Array.prototype.slice.call(dock.querySelectorAll(".dock-slot"));
  }

  /**
   * 只改 transform，不动任何布局宽度：
   *   1. 每个图标按与鼠标的距离做高斯放大，视觉宽度 = 38 * k
   *   2. 整排按“上一个的右沿 + 6px”重新排布，相邻间距恒为 6，永远不会叠住
   *   3. 整排围绕中心对称扩张（左边一半左移、右边一半右移），横条只需居中变宽
   * 因为 offsetLeft/offsetWidth 不受 transform 影响，每一帧读到的都是干净的静止值。
   */
  /** 指数平滑：鼠标急停或甩动时，放大中心慢慢追上，动画自带减速 */
  function magStep() {
    magRaf = 0;
    if (magTargetX === null) return;

    if (magX === null) {
      magX = magTargetX;
      magY = magTargetY;
    } else {
      magX += (magTargetX - magX) * MAG_DAMP;
      magY += (magTargetY - magY) * MAG_DAMP;
    }

    applyMagnify(magX, magY);

    if (Math.abs(magTargetX - magX) > 0.4 || Math.abs(magTargetY - magY) > 0.4) {
      magRaf = requestAnimationFrame(magStep);
    }
  }

  function applyMagnify(clientX, clientY) {
    var slots = visibleSlots();
    if (!slots.length) return;

    var mx = clientX - dock.getBoundingClientRect().left;
    // 用不受抬起动画影响的布局位置算垂直距离，避免“放大→上浮→距离变大”的自反馈
    var cy = dockWrap.getBoundingClientRect().top + dock.offsetTop + dock.offsetHeight / 2;
    var dy = Math.max(0, Math.abs(clientY - cy) - dock.offsetHeight / 2);
    var rest = [];
    var restTotal = 0;

    for (var i = 0; i < slots.length; i++) {
      var left = slots[i].offsetLeft;
      var width = slots[i].offsetWidth || 38;
      rest.push({ left: left, width: width, center: left + width / 2 });
      restTotal += width;
    }
    restTotal += MAG_GAP * (slots.length - 1);

    var k = [];
    var visualTotal = 0;
    for (var a = 0; a < slots.length; a++) {
      var d = mx - rest[a].center;
      k[a] = 1 + (MAG_MAX - 1) * Math.exp(-(d * d + dy * dy) / (2 * MAG_SIGMA * MAG_SIGMA));
      visualTotal += rest[a].width * k[a];
    }
    visualTotal += MAG_GAP * (slots.length - 1);

    var extra = visualTotal - restTotal;
    var pos = rest[0].left - extra / 2;
    var lifted = extra > 0.5;

    for (var b = 0; b < slots.length; b++) {
      var slot = slots[b];
      var w = rest[b].width * k[b];
      var tx = pos - rest[b].left + (w - rest[b].width) / 2;
      slot.style.transform = "translateX(" + tx.toFixed(2) + "px) scale(" + k[b].toFixed(3) + ")";
      slot.style.zIndex = k[b] > 1.06 ? "3" : "";
      pos += w + MAG_GAP;
    }

    // + 按钮跟着让出半格，和最后一个图标保持 6px
    dockAdd.style.transform = lifted ? "translateX(" + (extra / 2).toFixed(2) + "px)" : "";

    // 横条覆盖整排视觉宽度（含 + 按钮）
    lineExtra = Math.round(extra);
    refreshLine();
    dockWrap.style.setProperty("--lift", lifted ? "1" : "0");
  }

  function resetMagnify() {
    magTargetX = null;
    magTargetY = null;
    magX = null;
    magY = null;
    if (magRaf) { cancelAnimationFrame(magRaf); magRaf = 0; }

    var slots = visibleSlots();
    for (var i = 0; i < slots.length; i++) {
      slots[i].style.transform = "";
      slots[i].style.zIndex = "";
    }
    dockAdd.style.transform = "";
    dockWrap.style.setProperty("--lift", "0");
    lineExtra = 0;
    refreshLine();
  }

  // 放大的触发范围比 dock 本身大一圈：鼠标还在图标旁边的空白处时就先动起来，
  // 像那里还摆着几个看不见的图标
  var MAG_REACH_X = 100;
  var MAG_REACH_TOP = 80;
  var MAG_REACH_BOTTOM = 70;

  document.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch" || dragState) return;

    var r = dock.getBoundingClientRect();
    var near = e.clientX > r.left - MAG_REACH_X && e.clientX < r.right + MAG_REACH_X &&
      e.clientY > r.top - MAG_REACH_TOP && e.clientY < r.bottom + MAG_REACH_BOTTOM;

    if (!dockIsOpen || !near) {
      if (magX !== null) resetMagnify();
      return;
    }

    magTargetX = e.clientX;
    magTargetY = e.clientY;
    if (!magRaf) magRaf = requestAnimationFrame(magStep);
  });

  document.addEventListener("pointercancel", function () {
    if (!dragState) resetMagnify();
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
