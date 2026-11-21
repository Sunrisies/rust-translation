
import {Class} from '../core/Class';
import {Map} from '../map/Map';
import * as Util from '../core/Util';
import * as DomUtil from '../dom/DomUtil';

/*
 * @class Control
 * @aka L.Control
 * @inherits Class
 *
 * L.Control is a base class for implementing map controls. Handles positioning.
 * 所有其他控件都从此类扩展而来。
 */

export var Control = Class.extend({
	// @section
	// @aka Control Options
	options: {
		// @option position: String = 'topright'
		// 控件的位置（地图的一个角点）。可能的值包括 `'topleft'`、
		// `'topright'`, `'bottomleft'` 或 `'bottomright'`
		position: 'topright'
	},

	initialize: function (options) {
		Util.setOptions(this, options);
	},

	/* @section
	 * 扩展自 L.控件 的类将继承以下方法：
	 *
	 * @method getPosition: string
	 * 返回控件的位置。
	 */
	getPosition: function () {
		return this.options.position;
	},

	// @method setPosition(position: string): this
	// 设置控件的位置。
	setPosition: function (position) {
		var map = this._map;

		if (map) {
			map.removeControl(this);
		}

		this.options.position = position;

		if (map) {
			map.addControl(this);
		}

		return this;
	},

	// @method getContainer: HTMLElement
	// 返回包含该控件的 HTMLElement。
	getContainer: function () {
		return this._container;
	},

	// @method addTo(map: Map): this
	// 将控件添加到给定的地图中。
	addTo: function (map) {
		this.remove();
		this._map = map;

		var container = this._container = this.onAdd(map),
		    pos = this.getPosition(),
		    corner = map._controlCorners[pos];

		DomUtil.addClass(container, 'leaflet-control');

		if (pos.indexOf('bottom') !== -1) {
			corner.insertBefore(container, corner.firstChild);
		} else {
			corner.appendChild(container);
		}

		this._map.on('unload', this.remove, this);

		return this;
	},

	// @method remove: this
	// 从当前激活的地图中移除控件。
	remove: function () {
		if (!this._map) {
			return this;
		}

		DomUtil.remove(this._container);

		if (this.onRemove) {
			this.onRemove(this._map);
		}

		this._map.off('unload', this.remove, this);
		this._map = null;

		return this;
	},

	_refocusOnMap: function (e) {
		// 如果存在地图且事件不是键盘事件
		if (this._map && e && e.screenX > 0 && e.screenY > 0) {
			this._map.getContainer().focus();
		}
	}
});

export var control = function (options) {
	return new Control(options);
};

/* @section Extension methods
 * @uninheritable
 *
 * 每个控件都应扩展自 `L.Control` 并（重新）实现以下方法。
 *
 * @method onAdd(map: Map): HTMLElement
 * 应返回控件的容器 DOM 元素，并在相关地图事件上添加监听器。在 [`control.addTo(map)`](#控件-addTo) 中调用。
 *
 * @method onRemove(map: Map)
 * 可选方法。应包含所有清理代码，用于移除在 [`onAdd`](#控件-onadd) 中添加的监听器。在 [`control.remove()`](#控件-remove) 中调用。
 */

/* @namespace Map
 * @section Methods for Layers and Controls
 */
Map.include({
	// @method addControl(control: Control): this
	// 将给定的控件添加到地图中。
	addControl: function (control) {
		control.addTo(this);
		return this;
	},

	// @method removeControl(control: Control): this
	// 从地图中移除给定的控件。
	removeControl: function (control) {
		control.remove();
		return this;
	},

	_initControlPos: function () {
		var corners = this._controlCorners = {},
		    l = 'leaflet-',
		    container = this._controlContainer =
		            DomUtil.create('div', l + 'control-container', this._container);

		function createCorner(vSide, hSide) {
			var className = l + vSide + ' ' + l + hSide;

			corners[vSide + hSide] = DomUtil.create('div', className, container);
		}

		createCorner('top', 'left');
		createCorner('top', 'right');
		createCorner('bottom', 'left');
		createCorner('bottom', 'right');
	},

	_clearControlPos: function () {
		for (var i in this._controlCorners) {
			DomUtil.remove(this._controlCorners[i]);
		}
		DomUtil.remove(this._controlContainer);
		delete this._controlCorners;
		delete this._controlContainer;
	}
});
