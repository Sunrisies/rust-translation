import {Renderer} from './Renderer';
import * as DomUtil from '../../dom/DomUtil';
import * as DomEvent from '../../dom/DomEvent';
import Browser from '../../core/Browser';
import {stamp} from '../../core/Util';
import {svgCreate, pointsToPath} from './SVG.Util';
export {pointsToPath};
import {vmlMixin, vmlCreate} from './SVG.VML';

export var create = Browser.vml ? vmlCreate : svgCreate;

/*
 * @class SVG
 * @inherits Renderer
 * @aka L.SVG
 *
 * 允许向量图层使用 [SVG](https://developer.mozilla.org/docs/Web/SVG) 进行显示。
 * 继承 `Renderer` 功能。
 *
 * 由于 [技术限制](https://caniuse.com/svg)，SVG 并不
 * 在所有网页浏览器中均可用，尤其是 Android 2.x 和 3.x 版本。
 *
 * 尽管 IE7 和 IE8 不支持 SVG，但这些浏览器支持
 * [VML](https://en.wikipedia.org/wiki/Vector_Markup_Language)
 * （一种现已废弃的技术），在这种情况下，SVG 渲染器将回退到 VML。
 * 使得点击 SVG 根元素成为可能；我们将在单个路径中将其重置。
 *
 * @example
 *
 * Use SVG by default for all paths in the map:
 *
 * ```js
 * var map = L.map('map', {
 * 	renderer: L.svg()
 * });
 * ```
 *
 * Use a SVG renderer with extra padding for specific vector geometries:
 *
 * ```js
 * var map = L.map('map');
 * var myRenderer = L.svg({ padding: 0.5 });
 * var line = L.polyline( coordinates, { renderer: myRenderer } );
 * var circle = L.circle( center, { renderer: myRenderer } );
 * ```
 */

export var SVG = Renderer.extend({

	_initContainer: function () {
		this._container = create('svg');

		// makes it possible to click through svg root; we'll reset it back in individual paths
		this._container.setAttribute('pointer-events', 'none');

		this._rootGroup = create('g');
		this._container.appendChild(this._rootGroup);
	},

	_destroyContainer: function () {
		DomUtil.remove(this._container);
		DomEvent.off(this._container);
		delete this._container;
		delete this._rootGroup;
		delete this._svgSize;
	},

	_update: function () {
		if (this._map._animatingZoom && this._bounds) { return; }

		Renderer.prototype._update.call(this);

		var b = this._bounds,
		    size = b.getSize(),
		    container = this._container;

		// 如果更改了 svg-container 的大小，则设置其大小。
		if (!this._svgSize || !this._svgSize.equals(size)) {
			this._svgSize = size;
			container.setAttribute('width', size.x);
			container.setAttribute('height', size.y);
		}

		// 移动：更新容器 viewBox，从而无需改变各个图层的坐标。
		DomUtil.setPosition(container, b.min);
		container.setAttribute('viewBox', [b.min.x, b.min.y, size.x, size.y].join(' '));

		this.fire('update');
	},

	// 以下方法由向量图层实现调用。

	_initPath: function (layer) {
		var path = layer._path = create('path');

		// @namespace Path
		// @option className: String = null
		// 在元素上设置的自定义类名。仅适用于 SVG 渲染器。
		if (layer.options.className) {
			DomUtil.addClass(path, layer.options.className);
		}

		if (layer.options.interactive) {
			DomUtil.addClass(path, 'leaflet-interactive');
		}

		this._updateStyle(layer);
		this._layers[stamp(layer)] = layer;
	},

	_addPath: function (layer) {
		if (!this._rootGroup) { this._initContainer(); }
		this._rootGroup.appendChild(layer._path);
		layer.addInteractiveTarget(layer._path);
	},

	_removePath: function (layer) {
		DomUtil.remove(layer._path);
		layer.removeInteractiveTarget(layer._path);
		delete this._layers[stamp(layer)];
	},

	_updatePath: function (layer) {
		layer._project();
		layer._update();
	},

	_updateStyle: function (layer) {
		var path = layer._path,
		    options = layer.options;

		if (!path) { return; }

		if (options.stroke) {
			path.setAttribute('stroke', options.color);
			path.setAttribute('stroke-opacity', options.opacity);
			path.setAttribute('stroke-width', options.weight);
			path.setAttribute('stroke-linecap', options.lineCap);
			path.setAttribute('stroke-linejoin', options.lineJoin);

			if (options.dashArray) {
				path.setAttribute('stroke-dasharray', options.dashArray);
			} else {
				path.removeAttribute('stroke-dasharray');
			}

			if (options.dashOffset) {
				path.setAttribute('stroke-dashoffset', options.dashOffset);
			} else {
				path.removeAttribute('stroke-dashoffset');
			}
		} else {
			path.setAttribute('stroke', 'none');
		}

		if (options.fill) {
			path.setAttribute('fill', options.fillColor || options.color);
			path.setAttribute('fill-opacity', options.fillOpacity);
			path.setAttribute('fill-rule', options.fillRule || 'evenodd');
		} else {
			path.setAttribute('fill', 'none');
		}
	},

	_updatePoly: function (layer, closed) {
		this._setPath(layer, pointsToPath(layer._parts, closed));
	},

	_updateCircle: function (layer) {
		var p = layer._point,
		    r = Math.max(Math.round(layer._radius), 1),
		    r2 = Math.max(Math.round(layer._radiusY), 1) || r,
		    arc = 'a' + r + ',' + r2 + ' 0 1,0 ';

		// 使用两个半弧绘制圆形。
		var d = layer._empty() ? 'M0 0' :
			'M' + (p.x - r) + ',' + p.y +
			arc + (r * 2) + ',0 ' +
			arc + (-r * 2) + ',0 ';

		this._setPath(layer, d);
	},

	_setPath: function (layer, path) {
		layer._path.setAttribute('d', path);
	},

	// SVG 没有 zIndex 概念，因此我们通过改变元素的 DOM 顺序来实现。
	_bringToFront: function (layer) {
		DomUtil.toFront(layer._path);
	},

	_bringToBack: function (layer) {
		DomUtil.toBack(layer._path);
	}
});

if (Browser.vml) {
	SVG.include(vmlMixin);
}

// @namespace SVG
// @factory L.svg(options?: Renderer options)
// 根据给定选项创建 SVG 渲染器。
export function svg(options) {
	return Browser.svg || Browser.vml ? new SVG(options) : null;
}
