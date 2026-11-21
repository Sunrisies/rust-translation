import {Icon} from './Icon';
import * as DomUtil from '../../dom/DomUtil';

/*
 * @miniclass Icon.Default (Icon)
 * @aka L.Icon.Default
 * @section
 *
 * 作为 `Icon` 的一个简单子类，当
 * 未指定图标时，它表示在 `Marker` 中使用的图标。指向 Leaflet 提供的蓝色标记图像
 * releases.
 *
 * 要自定义默认图标，只需更改 `L.Icon.Default.prototype.options` 的属性
 * （即一组 `Icon 选项`）。
 *
 * 如果您想完全替换默认图标，请覆盖
 * `L.Marker.prototype.options.icon` 为您的自定义图标。
 */

export var IconDefault = Icon.extend({

	options: {
		iconUrl:       'marker-icon.png',
		iconRetinaUrl: 'marker-icon-2x.png',
		shadowUrl:     'marker-shadow.png',
		iconSize:    [25, 41],
		iconAnchor:  [12, 41],
		popupAnchor: [1, -34],
		tooltipAnchor: [16, -28],
		shadowSize:  [41, 41]
	},

	_getIconUrl: function (name) {
		if (typeof IconDefault.imagePath !== 'string') {	// Deprecated, backwards-compatibility only
			IconDefault.imagePath = this._detectIconPath();
		}

		// @option imagePath: String
		// `Icon.Default` 会尝试自动检测
		// 蓝色图标图像的位置。如果您以非标准方式放置这些图像，请将此选项设置为正确的路径。
		// way, set this option to point to the right path.
		return (this.options.imagePath || IconDefault.imagePath) + Icon.prototype._getIconUrl.call(this, name);
	},

	_stripUrl: function (path) {	// separate function to use in tests
		var strip = function (str, re, idx) {
			var match = re.exec(str);
			return match && match[idx];
		};
		path = strip(path, /^url\((['"])?(.+)\1\)$/, 2);
		return path && strip(path, /^(.*)marker-icon\.png$/, 1);
	},

	_detectIconPath: function () {
		var el = DomUtil.create('div',  'leaflet-default-icon-path', document.body);
		var path = DomUtil.getStyle(el, 'background-image') ||
		           DomUtil.getStyle(el, 'backgroundImage');	// IE8

		document.body.removeChild(el);
		path = this._stripUrl(path);
		if (path) { return path; }
		var link = document.querySelector('link[href$="leaflet.css"]');
		if (!link) { return ''; }
		return link.href.substring(0, link.href.length - 'leaflet.css'.length - 1);
	}
});
