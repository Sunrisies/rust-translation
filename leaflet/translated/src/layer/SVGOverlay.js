import {ImageOverlay} from './ImageOverlay';
import * as DomUtil from '../dom/DomUtil';
import * as Util from '../core/Util';

/*
 * @class SVGOverlay
 * @aka L.SVGOverlay
 * @inherits ImageOverlay
 *
 * 用于在地图特定范围内加载、显示并提供对 SVG 文件的 DOM 访问权限。继承自 `ImageOverlay`。
 *
 * SVG 覆盖层使用 [`<svg>`](https://developer.mozilla.org/docs/Web/SVG/Element/svg) 元素。
 *
 * @example
 *
 * ```js
 * var svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
 * svgElement.setAttribute('xmlns', "http://www.w3.org/2000/svg");
 * svgElement.setAttribute('viewBox', "0 0 200 200");
 * svgElement.innerHTML = '<rect width="200" height="200"/><rect x="75" y="23" width="50" height="50" style="fill:red"/><rect x="75" y="123" width="50" height="50" style="fill:#0013ff"/>';
 * var svgElementBounds = [ [ 32, -130 ], [ 13, -100 ] ];
 * L.svgOverlay(svgElement, svgElementBounds).addTo(map);
 * ```
 */

export var SVGOverlay = ImageOverlay.extend({
	_initImage: function () {
		var el = this._image = this._url;

		DomUtil.addClass(el, 'leaflet-image-layer');
		if (this._zoomAnimated) { DomUtil.addClass(el, 'leaflet-zoom-animated'); }
		if (this.options.className) { DomUtil.addClass(el, this.options.className); }

		el.onselectstart = Util.falseFn;
		el.onmousemove = Util.falseFn;
	}

	// @method getElement(): SVGElement
	// 返回 [`SVGElement`](https://developer.mozilla.org/docs/Web/API/SVGElement) 的实例。
	// 被此覆盖层所使用。
});


// @factory L.svgOverlay(svg: String|SVGElement, bounds: LatLngBounds, options?: SVGOverlay options)
// 根据给定的 SVG 元素及其关联的地理范围，实例化一个图像覆盖对象。
// SVG 元素上需要设置 `viewBox` 属性，以便正确缩放。

export function svgOverlay(el, bounds, options) {
	return new SVGOverlay(el, bounds, options);
}
