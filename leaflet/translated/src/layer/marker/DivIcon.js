import {Icon} from './Icon';
import {toPoint as point} from '../../geometry/Point';
import {empty} from '../../dom/DomUtil';

/*
 * @class DivIcon
 * @aka L.DivIcon
 * @inherits Icon
 *
 * 表示用于标记的轻量级图标，使用简单的 `<div>` 元素而非图片。从 `Icon` 类继承，但忽略 `iconUrl` 和阴影选项。
 * iconAnchor: (点坐标),
 *
 * @example
 * ```js
 * var myIcon = L.divIcon({className: 'my-div-icon'});
 * // you can set .my-div-icon styles in CSS
 *
 * L.marker([50.505, 30.57], {icon: myIcon}).addTo(map);
 * ```
 *
 * By default, it has a 'leaflet-div-icon' CSS class and is styled as a little white square with a shadow.
 */

export var DivIcon = Icon.extend({
	options: {
		// @section
		// @aka DivIcon options
		iconSize: [12, 12], // also can be set through CSS

		// iconAnchor: (Point),
		// popupAnchor: (点坐标),

		// @option html: String|HTMLElement = ''
		// 可在 div 元素中插入的自定义 HTML 代码，默认为空。或者，
		// 作为 `HTMLElement` 的实例。
		html: false,

		// @option bgPos: Point = [0, 0]
		// 背景的可选相对位置，以像素为单位。
		bgPos: null,

		className: 'leaflet-div-icon'
	},

	createIcon: function (oldIcon) {
		var div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div'),
		    options = this.options;

		if (options.html instanceof Element) {
			empty(div);
			div.appendChild(options.html);
		} else {
			div.innerHTML = options.html !== false ? options.html : '';
		}

		if (options.bgPos) {
			var bgPos = point(options.bgPos);
			div.style.backgroundPosition = (-bgPos.x) + 'px ' + (-bgPos.y) + 'px';
		}
		this._setIconStyles(div, 'icon');

		return div;
	},

	createShadow: function () {
		return null;
	}
});

// @factory L.divIcon(options: DivIcon options)
// 根据给定选项创建 `DivIcon` 实例。
export function divIcon(options) {
	return new DivIcon(options);
}
