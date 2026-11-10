"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { asUrl } = require("../url.js");

const DIRECT = [
  // 输入, 期望打开的地址
  ["github.com", "https://github.com/"],
  ["www.zhihu.com/hot", "https://www.zhihu.com/hot"],
  ["WWW.GitHub.COM", "https://www.github.com/"],
  ["example.com:8080/x?q=1#f", "https://example.com:8080/x?q=1#f"],
  ["1.2.3.4:8080", "http://1.2.3.4:8080/"],
  ["localhost:3000", "http://localhost:3000/"],
  ["localhost", "http://localhost/"],
  ["https://x.com", "https://x.com/"],
  ["HTTP://Example.COM/A", "http://example.com/A"],
  ["  github.com  ", "https://github.com/"],
  // 中文 / IDN 域名
  ["例子.中国", "https://xn--fsqu00a.xn--fiqs8s/"],
  ["例子。中国", "https://xn--fsqu00a.xn--fiqs8s/"], // 中文句号
  ["例子．中国", "https://xn--fsqu00a.xn--fiqs8s/"], // 全角句号
  ["例子.com", "https://xn--fsqu00a.com/"],
  ["https://例子.中国", "https://xn--fsqu00a.xn--fiqs8s/"],
  ["xn--fsqu00a.xn--fiqs8s", "https://xn--fsqu00a.xn--fiqs8s/"],
];

const SEARCH = [
  "hello world",
  "how to fix a bug",
  "",
  "   ",
  "3.14",
  "1.2.3.999",
  "a.b.c.d/e?f=1", // 顶级域只有一个字母
  "例子", // 没有点，不是域名
  "chrome://settings",
  "file:///etc/passwd",
  "javascript:alert(1)",
  "data:text/html,hi",
  "ftp://x.com",
  "http://",
  "user@example.com",
  "example.com:abc",
  "example.com:70000",
  "例子.中国/a b", // 地址里不该有空格
  "-bad.com",
];

test("看起来像网址的输入直接打开", () => {
  for (const [input, expected] of DIRECT) {
    assert.equal(asUrl(input), expected, input);
  }
});

test("其余输入交给搜索引擎", () => {
  for (const input of SEARCH) {
    assert.equal(asUrl(input), null, input);
  }
});

test("非字符串输入不抛错", () => {
  assert.equal(asUrl(null), null);
  assert.equal(asUrl(undefined), null);
  assert.equal(asUrl(42), null);
});

test("输出永远是 http(s) 绝对地址", () => {
  for (const [input] of DIRECT) {
    assert.match(asUrl(input), /^https?:\/\//i, input);
  }
});
