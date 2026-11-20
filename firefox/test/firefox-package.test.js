"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "../..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

test("根目录 Chrome/Edge 清单保持 1.6.6，且不声明主页", () => {
  const manifest = readJson("manifest.json");
  assert.equal(manifest.version, "1.6.6");
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.chrome_url_overrides, { newtab: "index.html" });
  assert.equal(manifest.chrome_settings_overrides, undefined);
  assert.equal(manifest.browser_specific_settings, undefined);
});

test("Firefox 清单只增加主页，保留新标签页、ID 和原有权限", () => {
  const manifest = readJson("firefox/manifest.json");
  assert.equal(manifest.version, "1.7.0");
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.equal(manifest.optional_permissions, undefined);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.chrome_url_overrides.newtab, "index.html");
  assert.deepEqual(manifest.chrome_settings_overrides, { homepage: "index.html" });
  assert.equal(manifest.browser_specific_settings.gecko.id, "startpage@kulilin.com");
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "115.0");
  assert.deepEqual(
    manifest.browser_specific_settings.gecko.data_collection_permissions.required,
    ["none"]
  );
  assert.equal(manifest.chrome_settings_overrides.search_provider, undefined);
});

test("主页是扩展内的相对地址，并且只会解析成一个页面", () => {
  const homepage = readJson("firefox/manifest.json").chrome_settings_overrides.homepage;
  assert.equal(homepage, "index.html");
  assert.equal(URL.canParse(homepage), false);
  assert.equal(homepage.startsWith("//"), false);

  // Firefox Schemas.sys.mjs homepageUrl() encodes pipes, then resolves
  // the string against the extension manifest URL.
  const encoded = homepage.replace(/\|/g, "%7C");
  const resolved = new URL(encoded, "moz-extension://profile-uuid/manifest.json");
  assert.equal(resolved.href, "moz-extension://profile-uuid/index.html");
  assert.equal(resolved.href.includes("|"), false);
});

test("未签名 Firefox 包只包含共享扩展文件和 Firefox 清单", () => {
  const zipPath = path.join(os.tmpdir(), `kulilin-firefox-${process.pid}.zip`);
  fs.rmSync(zipPath, { force: true });
  execFileSync(process.execPath, ["firefox/build.js"], {
    cwd: repoRoot,
    env: { ...process.env, KULILIN_FIREFOX_ZIP: zipPath },
  });

  const entries = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
    .trim()
    .split("\n")
    .sort();
  assert.deepEqual(entries, [
    "app.js",
    "icons/icon.svg",
    "icons/icon128.png",
    "icons/icon16.png",
    "icons/icon32.png",
    "icons/icon48.png",
    "index.html",
    "manifest.json",
    "url.js",
  ]);
  assert.equal(entries.some(name => name.startsWith("META-INF/")), false);

  const packedManifest = JSON.parse(
    execFileSync("unzip", ["-p", zipPath, "manifest.json"], { encoding: "utf8" })
  );
  assert.equal(packedManifest.version, "1.7.0");
  assert.equal(packedManifest.browser_specific_settings.gecko.id, "startpage@kulilin.com");
  assert.equal(packedManifest.chrome_settings_overrides.homepage, "index.html");
  assert.equal(packedManifest.chrome_url_overrides.newtab, "index.html");

  for (const file of ["app.js", "url.js", "index.html"]) {
    const packed = execFileSync("unzip", ["-p", zipPath, file]);
    const original = fs.readFileSync(path.join(repoRoot, file));
    assert.deepEqual(packed, original, file);
  }

  fs.rmSync(zipPath, { force: true });
});
