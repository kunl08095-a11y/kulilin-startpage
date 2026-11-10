/*
 * 地址识别
 * ---------
 * 把搜索框里的输入分成两类：
 *   - 能当网址直接打开 → 返回规范化后的绝对地址（https://…）
 *   - 其余（含空格、不是域名、不认识的协议）→ 返回 null，交给搜索引擎
 *
 * 浏览器和 Node 都能用：浏览器挂到 window.KulilinUrl，Node 走 module.exports，
 * 这样 test/url.test.js 可以直接测，不用模拟 DOM。
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KulilinUrl = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  var SCHEME = /^https?:\/\/\S+$/i;
  var LOCALHOST = /^localhost(:\d{1,5})?(\/[^\s]*)?$/i;
  var IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  var LABEL = /^[\p{L}\p{N}_-]+$/u;
  var TLD = /^(?:\p{L}{2,}|xn--[a-z0-9-]{2,})$/iu;

  /** 让浏览器把中文域名、大写、多余端口等统一成标准写法；非法地址返回 null。 */
  function normalize(href) {
    try {
      return new URL(href).href;
    } catch (e) {
      return null;
    }
  }

  function isIPv4(host) {
    var m = IPV4.exec(host);
    if (!m) return false;
    for (var i = 1; i <= 4; i++) {
      if (Number(m[i]) > 255) return false;
    }
    return true;
  }

  /**
   * 判断是不是「像域名」：至少两段、每段不超过 63 字符、
   * 顶级域是 2 个以上字母或 punycode（xn--…）。
   * 这样 3.14、foo.bar 里的单字母结尾、带下划线以外的怪字符都会被排除。
   */
  function isHost(host) {
    if (!host || host.length > 253) return false;
    var labels = host.split(".");
    if (labels.length < 2) return false;

    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      if (!label || label.length > 63) return false;
      if (label.charAt(0) === "-" || label.charAt(label.length - 1) === "-") return false;
      if (!LABEL.test(label)) return false;
    }

    return TLD.test(labels[labels.length - 1]);
  }

  function asUrl(raw) {
    if (typeof raw !== "string") return null;

    // 中文输入法常见的全角句点也当分隔符
    var value = raw.trim().replace(/[。．｡]/g, ".");
    if (!value || /\s/.test(value)) return null;

    if (SCHEME.test(value)) {
      var absolute = normalize(value);
      return absolute && /^https?:\/\//i.test(absolute) ? absolute : null;
    }

    if (LOCALHOST.test(value)) return normalize("http://" + value);

    // 把 host[:port] 和后面的路径/查询/锚点分开
    var match = /^([^\/?#]+)([\s\S]*)$/.exec(value);
    var authority = match[1];
    var rest = match[2] || "";

    var host = authority;
    var colon = authority.lastIndexOf(":");
    if (colon !== -1) {
      var port = authority.slice(colon + 1);
      if (!/^\d{1,5}$/.test(port) || Number(port) > 65535) return null;
      host = authority.slice(0, colon);
    }

    if (!host || host.indexOf(":") !== -1) return null;
    if (isIPv4(host)) return normalize("http://" + authority + rest);
    if (!isHost(host)) return null;

    return normalize("https://" + authority + rest);
  }

  return { asUrl: asUrl };
});
