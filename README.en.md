# KULILIN Start Page

English | [中文](README.md)

A minimal Chrome new tab page: search, plus up to 7 shortcut sites. Current version: 1.6.6.

Website: [kulilin.com](https://kulilin.com)

## Features

- Switch search engines in the search box (Google, Bing, Baidu, DuckDuckGo, Zhihu, and GitHub)
- A slim dock under the search box holds shortcuts: move the pointer near it to reveal icons, then click **+** to add a site (up to 7)
- Hold an icon to reorder; drag it off the dock, right-click, or press Delete to remove it (undo is available for 6 seconds)
- On a touch screen, tap the dock to expand it, then tap empty space or press Esc to collapse it
- When loaded as an extension, data is stored locally in `chrome.storage` and survives closing the browser

## Install (recommended: as a Chrome extension)

1. Download or clone this repository
2. Open `chrome://extensions` in Chrome
3. Turn on **Developer mode** in the top-right corner
4. Click **Load unpacked** and select this repository folder
5. Press `Ctrl+T` (or `Cmd+T` on macOS) to open a new tab and see the start page

After you update the files, click the extension's reload button on the extensions page, then open a new tab again.

### Other ways to use it

- You can also set it as Chrome's startup page: open `chrome://settings/onStartup`, choose **Open a specific page or set of pages**, and add this folder's `index.html`. To share the same shortcuts between the startup page and new tabs, set startup to **Open the New Tab page** instead.
- Double-clicking `index.html` also works as a regular web page (data is then stored in `localStorage`).

## Usage

- Type in the search box and switch engines as needed
- Move the pointer near the line under the search box to expand your shortcuts
- Click **+** and enter a URL or name to add a site
- Hold and drag an icon to reorder it; drag it off the dock to remove it

See [使用说明.txt](使用说明.txt) for a more detailed (Chinese) description of the dock interactions.

## Privacy

This extension does not upload your searches or shortcuts to the developer's servers. Settings and shortcuts stay on your computer (`chrome.storage` in the extension, or `localStorage` when you open the file directly).

When you add a shortcut, the extension may request the site's icon from that site and from third-party favicon services (such as favicon.im and favicon.cccyun.cc). Icons are cached locally after they are found, and later visits do not repeat the request. This extension does not execute remote code.

## File guide

| File | Purpose |
| --- | --- |
| `index.html` | The page |
| `app.js` | Search and shortcut-dock logic |
| `url.js` | URL parsing (including IDN, IP, and localhost) |
| `manifest.json` | Chrome extension manifest |
| `icons/` | Extension icons |
| `test/` | URL-parsing tests |
| `使用说明.txt` | Longer Chinese usage notes |

## Development

This repository is maintained by [kulilin](https://kulilin.com). Issues and suggestions are welcome.
