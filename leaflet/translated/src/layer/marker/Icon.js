import {Class} from '../../core/Class';
import {setOptions} from '../../core/Util';
import {toPoint as point} from '../../geometry/Point';
import Browser from '../../core/Browser';

/*
 * @class Icon
 * @aka L.Icon
 *
 * 在创建标记时提供的图标。
 *
 * @example
 *
 * ```js
 * var myIcon = L.icon({
 *     iconUrl: 'my-icon.png',
 *     iconRetinaUrl: 'my-icon@2x.png',
 *     iconSize: [38, 95],
 *     iconAnchor: [22, 94],
 *     popupAnchor: [-3, -76],
 *     shadowUrl: 'my-icon-shadow.png',
 *     shadowRetinaUrl: 'my-icon-shadow@2x.png',
 *     shadowSize: [68, 95],
 *     shadowAnchor: [22, 94]
 * });
 *
 * L.marker([50.505, 30.57], {icon: myIcon}).addTo(map);
 * ```
 *
 * `L.Icon.Default` extends `L.Icon` and is the blue icon Leaflet uses for markers by default.
 *
 */

export var Icon = Class.extend({

	/* @section
	 * @aka Icon options
	 *
	 * @option iconUrl: String = null
	 * **(必填)** 图标图像的URL（绝对路径或相对于脚本路径）。
	 *
	 * @option iconRetinaUrl: String = null
	 * 图标图像视网膜屏版本的URL（绝对路径或相对于脚本路径）。用于视网膜屏幕设备。
	 * 图标图像像素大小。
	 *
	 * @option iconSize: Point = null
	 * Size of the icon image in pixels.
	 *
	 * @option iconAnchor: Point = null
	 * 图标的“尖端”坐标（相对于其左上角）。图标将对齐到该位置作为标记的地理位置，默认情况下如果指定了尺寸，也可以通过CSS负边距设置。
	 * will be aligned so that this point is at the 标记's geographical location. Centered
	 * by default if size is specified, also can be set in CSS with negative margins.
	 *
	 * @option popupAnchor: Point = [0, 0]
	 * 弹出窗口打开的起始点坐标，相对于图标锚点。
	 *
	 * @option tooltipAnchor: Point = [0, 0]
	 * 工具提示打开的起始点坐标，相对于图标锚点。
	 *
	 * @option shadowUrl: String = null
	 * 图标阴影图像的URL。如果没有指定，则不会创建阴影图像。
	 *
	 * @option shadowRetinaUrl: String = null
	 *
	 * @option shadowSize: Point = null
	 * 阴影图像像素大小。
	 *
	 * @option shadowAnchor: Point = null
	 * 阴影的“尖端”坐标（相对于其左上角）（如果未指定，则与图标锚点相同）。
	 * as iconAnchor if not specified).
	 *
	 * @option className: String = ''
	 * 分配给图标和阴影图像的自定义类名。默认为空。
	 */

	options: {
		popupAnchor: [0, 0],
		tooltipAnchor: [0, 0],

		// @option crossOrigin: Boolean|String = false
		// 是否将`crossOrigin`属性添加到瓦片中。
		// 如果提供字符串，所有瓦片的`crossOrigin`属性将被设置为该字符串。如果需要访问瓦片像素数据，则需要此设置。
		// 有效字符串值请参考[CORS Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes)。
		crossOrigin: false
	},

	initialize: function (options) {
		setOptions(this, options);
	},

	// @method createIcon(oldIcon?: HTMLElement): HTMLElement
	// 在图标需要显示时内部调用，返回一个根据选项进行样式的`<img>` HTML元素。
	// styled according to the options.
	createIcon: function (oldIcon) {
		return this._createIcon('icon', oldIcon);
	},

	// @method createShadow(oldIcon?: HTMLElement): HTMLElement
	// 作为`createIcon`函数，但针对其下方的阴影。
	createShadow: function (oldIcon) {
		return this._createIcon('shadow', oldIcon);
	},

	_createIcon: function (name, oldIcon) {
		var src = this._getIconUrl(name);

		if (!src) {
			if (name === 'icon') {
				throw new Error('iconUrl not set in Icon options (see the docs).');
			}
			return null;
		}

		var img = this._createImg(src, oldIcon && oldIcon.tagName === 'IMG' ? oldIcon : null);
		this._setIconStyles(img, name);

		if (this.options.crossOrigin || this.options.crossOrigin === '') {
			img.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
		}

		return img;
	},

	_setIconStyles: function (img, name) {
		var options = this.options;
		var sizeOption = options[name + 'Size'];

		if (typeof sizeOption === 'number') {
			sizeOption = [sizeOption, sizeOption];
		}

		var size = point(sizeOption),
		    anchor = point(name === 'shadow' && options.shadowAnchor || options.iconAnchor ||
		            size && size.divideBy(2, true));

		img.className = 'leaflet-marker-' + name + ' ' + (options.className || '');

		if (anchor) {
			img.style.marginLeft = (-anchor.x) + 'px';
			img.style.marginTop  = (-anchor.y) + 'px';
		}

		if (size) {
			img.style.width  = size.x + 'px';
			img.style.height = size.y + 'px';
		}
	},

	_createImg: function (src, el) {
		el = el || document.createElement('img');
		el.src = src;
		return el;
	},

	_getIconUrl: function (name) {
		return Browser.retina && this.options[name + 'RetinaUrl'] || this.options[name + 'Url'];
	}
});


// @factory L.icon(options: Icon options)
// 根据给定的选项创建图标实例。
export function icon(options) {
	return new Icon(options);
}
