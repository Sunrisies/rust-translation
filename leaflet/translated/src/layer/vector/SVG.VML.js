import * as DomUtil from '../../dom/DomUtil';
import * as Util from '../../core/Util';
import {Renderer} from './Renderer';

/*
 * 感谢 Dmitry Baranovsky 和他的 Raphael 库给予我的灵感！
 */


export var vmlCreate = (function () {
	try {
		document.namespaces.add('lvml', 'urn:schemas-microsoft-com:vml');
		return function (name) {
			return document.createElement('<lvml:' + name + ' class="lvml">');
		};
	} catch (e) {
		// 不要从 catch 块中返回 fn，以便 `e` 可以被垃圾回收
		// 请参阅 https://github.com/Leaflet/Leaflet/pull/7279
	}
	return function (name) {
		return document.createElement('<' + name + ' xmlns="urn:schemas-microsoft.com:vml" class="lvml">');
	};
})();


/*
 * @class SVG
 *
 *
 * VML 在 2012 年被废弃了，这意味着 VML 功能仅用于向后兼容，
 * 与旧版本的 Internet Explorer 兼容。
 */

// 混合并重新定义一些 SVG 方法以处理类似但存在差异的 VML 语法
export var vmlMixin = {

	_initContainer: function () {
		this._container = DomUtil.create('div', 'leaflet-vml-container');
	},

	_update: function () {
		if (this._map._animatingZoom) { return; }
		Renderer.prototype._update.call(this);
		this.fire('update');
	},

	_initPath: function (layer) {
		var container = layer._container = vmlCreate('shape');

		DomUtil.addClass(container, 'leaflet-vml-shape ' + (this.options.className || ''));

		container.coordsize = '1 1';

		layer._path = vmlCreate('path');
		container.appendChild(layer._path);

		this._updateStyle(layer);
		this._layers[Util.stamp(layer)] = layer;
	},

	_addPath: function (layer) {
		var container = layer._container;
		this._container.appendChild(container);

		if (layer.options.interactive) {
			layer.addInteractiveTarget(container);
		}
	},

	_removePath: function (layer) {
		var container = layer._container;
		DomUtil.remove(container);
		layer.removeInteractiveTarget(container);
		delete this._layers[Util.stamp(layer)];
	},

	_updateStyle: function (layer) {
		var stroke = layer._stroke,
		    fill = layer._fill,
		    options = layer.options,
		    container = layer._container;

		container.stroked = !!options.stroke;
		container.filled = !!options.fill;

		if (options.stroke) {
			if (!stroke) {
				stroke = layer._stroke = vmlCreate('stroke');
			}
			container.appendChild(stroke);
			stroke.weight = options.weight + 'px';
			stroke.color = options.color;
			stroke.opacity = options.opacity;

			if (options.dashArray) {
				stroke.dashStyle = Util.isArray(options.dashArray) ?
				    options.dashArray.join(' ') :
				    options.dashArray.replace(/( *, *)/g, ' ');
			} else {
				stroke.dashStyle = '';
			}
			stroke.endcap = options.lineCap.replace('butt', 'flat');
			stroke.joinstyle = options.lineJoin;

		} else if (stroke) {
			container.removeChild(stroke);
			layer._stroke = null;
		}

		if (options.fill) {
			if (!fill) {
				fill = layer._fill = vmlCreate('fill');
			}
			container.appendChild(fill);
			fill.color = options.fillColor || options.color;
			fill.opacity = options.fillOpacity;

		} else if (fill) {
			container.removeChild(fill);
			layer._fill = null;
		}
	},

	_updateCircle: function (layer) {
		var p = layer._point.round(),
		    r = Math.round(layer._radius),
		    r2 = Math.round(layer._radiusY || r);

		this._setPath(layer, layer._empty() ? 'M0 0' :
			'AL ' + p.x + ',' + p.y + ' ' + r + ',' + r2 + ' 0,' + (65535 * 360));
	},

	_setPath: function (layer, path) {
		layer._path.v = path;
	},

	_bringToFront: function (layer) {
		DomUtil.toFront(layer._container);
	},

	_bringToBack: function (layer) {
		DomUtil.toBack(layer._container);
	}
};
