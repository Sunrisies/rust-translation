
## 下载 Leaflet 版本

<table>
	<tr>
		<th>版本</th>
		<th>说明</th>
	</tr>
	<tr>
		<td><a href="https://leafletjs-cdn.s3.amazonaws.com/content/leaflet/v1.9.3/leaflet.zip">Leaflet 1.9.3</a></td>
		<td>稳定版，发布于 2022 年 11 月 18 日。</td>
	</tr>
	<tr>
		<td><a href="https://leafletjs-cdn.s3.amazonaws.com/content/leaflet/v1.8.0/leaflet.zip">Leaflet 1.8.0</a></td>
		<td>上一个稳定版，发布于 2022 年 4 月 18 日。</td>
	</tr>
	<tr>
		<td><a href="https://leafletjs-cdn.s3.amazonaws.com/content/leaflet/main/leaflet.zip">Leaflet 2.0-dev</a></td>
		<td>开发中的版本，在 <code>main</code> 分支上开发。</td>
	</tr>
</table>

[查看变更日志](https://github.com/Leaflet/Leaflet/blob/main/CHANGELOG.md)

请注意，主版本可能包含不兼容的更改，
因此在升级时请仔细阅读变更日志。

### 使用 Hosted 版本的 Leaflet

最新的稳定版 Leaflet 已可在多个 CDN 上获取——如需立即使用，
请将以下代码添加到 HTML 代码的 `head` 部分：

    <link rel="stylesheet" href="https://unpkg.com/leaflet@{{ site.latest_leaflet_version}}/dist/leaflet.css" integrity="{{site.integrity_hash_css}}" crossorigin="" />
    <script src="https://unpkg.com/leaflet@{{ site.latest_leaflet_version}}/dist/leaflet.js" integrity="{{site.integrity_hash_uglified}}" crossorigin=""></script>

请注意，在使用 CDN 提供的 Leaflet 时，会包含 [`integrity` 哈希值](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)以确保安全性。

以下免费 CDN 提供 Leaflet 版本：[unpkg](https://unpkg.com/leaflet/dist/)、[cdnjs](https://cdnjs.com/libraries/leaflet)、[jsDelivr](https://www.jsdelivr.com/package/npm/leaflet?path=dist)。

_免责声明：这些服务与 Leaflet 无关；如有疑问或支持需求，请直接联系它们。_

### 使用下载的 Leaflet 版本

从上述链接下载的归档文件中，你会看到四样内容：

- `leaflet.js` - 这是压缩后的 Leaflet JavaScript 代码。
- `leaflet-src.js` - This is the readable, unminified Leaflet JavaScript, which is sometimes helpful for debugging. <small>(integrity="<nobr><tt>{{site.integrity_hash_source}}</tt></nobr>")</small>
- `leaflet.css` - 这是 Leaflet 的样式表文件。
- `images` - 这是一个包含 `leaflet.css` 引用的图像的文件夹，必须与 `leaflet.css` 位于同一目录中。

将下载的归档文件解压到网站目录中，然后将其添加到 HTML 代码的 `head` 部分：

    <link rel="stylesheet" href="/path/to/leaflet.css" />
    <script src="/path/to/leaflet.js"></script>

### 使用 JavaScript 包管理器

如果你使用 [`npm` 包管理器](https://www.npmjs.com/)，可以运行以下命令获取本地版 Leaflet：

    npm install leaflet

你会在 `node_modules/leaflet/dist` 中找到 Leaflet 发布文件的副本。

### Leaflet 源代码

上述下载包仅包含库本身。
如果你希望下载完整的源代码，包括单元测试、调试文件、构建脚本等，
you can <a href="https://github.com/Leaflet/Leaflet/releases">download it</a>
from the <a href="https://github.com/Leaflet/Leaflet">GitHub repository</a>.

### 从源代码构建 Leaflet

Leaflet 构建系统基于 [Node.js](http://nodejs.org) 平台运行，
该平台易于安装，并在所有主要平台上都能良好工作。
以下是设置步骤：

 1. [下载并安装 Node.js](http://nodejs.org)
 2. 在命令行中运行以下命令：

 <pre><code>npm install</code></pre>

现在你已经安装了所有内容，请在 Leaflet 目录内执行 `npm run build` 命令。
这将合并并压缩 Leaflet 源文件，并将构建结果保存到 `dist` 文件夹中。

