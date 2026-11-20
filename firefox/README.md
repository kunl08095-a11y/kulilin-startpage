# Firefox

仓库根目录是 Chrome / Edge 版本，清单仍是 1.6.6。Firefox 包放在这个目录，不替换根目录的 `manifest.json`。

生成未签名安装包：

```bash
node firefox/build.js
```

产物是 `firefox/dist/KULILIN-firefox-1.7.0-unsigned.zip`。附加组件 ID 仍是 `startpage@kulilin.com`，版本是 1.7.0。安装、更新和启动限制见 [使用说明.txt](使用说明.txt)。
