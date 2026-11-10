
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
   */
  function asUrl(value) {
    if (/\s/.test(value)) return null;
    if (/^https?:\/\/\S+$/i.test(value)) return value;
    if (/^localhost(:\d+)?(\/\S*)?$/i.test(value)) return "http://" + value;
    if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/\S*)?$/.test(value)) return "http://" + value;
    if (/^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(value)) return "https://" + value;
    return null;
  }

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
  var DOCK_HINT = "回车添加 · 右键图标可移除";

  var sites = loadSites();
  var dockIsOpen = false;
  var magRaf = 0;
  var magX = null;

  function loadSites() {
    try {
      var raw = JSON.parse(localStorage.getItem(DOCK_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      var clean = [];
      for (var i = 0; i < raw.length && clean.length < DOCK_MAX; i++) {
        if (typeof raw[i] !== "string") continue;
        var url = asUrl(raw[i].trim());
        if (url && clean.indexOf(url) === -1) clean.push(url);
      }
      return clean;
    } catch (e) {
      return [];
    }
  }

  function saveSites() {
    try { localStorage.setItem(DOCK_KEY, JSON.stringify(sites)); } catch (e) {}
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

      var link = document.createElement("a");
      link.className = "dock-item";
      link.href = url;
      link.title = siteName(url);

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

  function sizeHandle() {
    var hasSites = sites.length > 0;
    var width = hasSites ? Math.max(44, dock.offsetWidth) : 44;
    dockWrap.classList.toggle("has-sites", hasSites);
    dockWrap.style.setProperty("--line-w", width + "px");
    dockDot.style.width = width + "px";
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

  var dockPinned = false;
  var proximityRaf = 0;
  var pointerX = null;
  var pointerY = null;

  function applyReveal(progress) {
    var p = Math.max(0, Math.min(1, progress));
    dockWrap.style.setProperty("--reveal", p.toFixed(3));

    var open = p >= 0.8;
    if (open === dockIsOpen) return;

    dockIsOpen = open;
    dockWrap.classList.toggle("open", open);
    dockDot.setAttribute("aria-expanded", open ? "true" : "false");

    if (open) {
      loadDockIcons();
    } else {
      hideDockForm();
      resetMagnify();
    }
  }

  function proximityAt(x, y) {
    var rect = dockWrap.getBoundingClientRect();
    var top = rect.top + rect.height / 2;
    var bottom = top + 60;
    var centerX = rect.left + rect.width / 2;
    var dx = Math.max(0, Math.abs(x - centerX) - rect.width / 2);
    var dy = y < top ? top - y : (y > bottom ? y - bottom : 0);
    var distance = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1 - distance / 40);
  }

  function updateProximity() {
    proximityRaf = 0;

    if (dockPinned || dockWrap.classList.contains("editing")) {
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

  function removeSite(index) {
    if (index < 0 || index >= sites.length) return;
    sites.splice(index, 1);
    saveSites();
    renderDock();
  }

  dockItemsEl.addEventListener("contextmenu", function (e) {
    var link = e.target.closest(".dock-item");
    if (!link) return;
    var index = Array.prototype.indexOf.call(dockItemsEl.children, link.parentNode);
    if (index < 0) return;
    e.preventDefault();
    if (window.confirm("移除 " + siteName(sites[index]) + "？")) removeSite(index);
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

  function applyMagnify(clientX) {
    var els = dock.querySelectorAll(".dock-slot, .dock-add");
    var left = dock.getBoundingClientRect().left;
    var x = clientX - left;

    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.offsetWidth) continue;
      var center = el.offsetLeft + el.offsetWidth / 2;
      var dist = Math.abs(x - center);
      var pull = Math.exp(-(dist * dist) / (2 * 58 * 58));
      el.style.transform = "translateY(" + (-7 * pull).toFixed(2) + "px) scale(" + (1 + 0.5 * pull).toFixed(3) + ")";
      el.style.zIndex = pull > 0.45 ? "3" : "";
    }
  }

  function resetMagnify() {
    magX = null;
    if (magRaf) { cancelAnimationFrame(magRaf); magRaf = 0; }
    var els = dock.querySelectorAll(".dock-slot, .dock-add");
    for (var i = 0; i < els.length; i++) {
      els[i].style.transform = "";
      els[i].style.zIndex = "";
    }
  }

  dock.addEventListener("pointermove", function (e) {
    if (!dockIsOpen) return;
    magX = e.clientX;
    if (magRaf) return;
    magRaf = requestAnimationFrame(function () {
      magRaf = 0;
      if (magX !== null) applyMagnify(magX);
    });
  });

  dock.addEventListener("pointerleave", resetMagnify);
  dock.addEventListener("pointercancel", resetMagnify);

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !dockIsOpen) return;
    if (dockWrap.classList.contains("editing")) {
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

  // 触屏设备不强弹键盘
  if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
    q.focus({ preventScroll: true });
  }
})();
