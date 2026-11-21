
import {Control} from './Control';
import * as DomUtil from '../dom/DomUtil';

/*
 * @class Control.Scale
 * @aka L.Control.Scale
 * @inherits Control
 *
 * 一个简单的比例控制组件，以公制（m/km）和英制（mi/ft）为单位显示当前屏幕中心的比例值。继承自 `Control`。
 *
 * @example
 *
 * ```js
 * L.control.scale().addTo(map);
 * ```
 */

export var Scale = Control.extend({
	// @section
	// @aka Control.Scale options
	options: {
		position: 'bottomleft',

		// @option maxWidth: Number = 100
		// 控件的最大宽度，单位为像素。宽度是动态设定的，以便显示整数值（例如 100、200、500）。
		maxWidth: 100,

		// @option metric: Boolean = True
		// 是否显示公制比例线（m/km）。
		metric: true,

		// @option imperial: Boolean = True
		// 是否显示英制比例线（mi/ft）。
		imperial: true

		// @option updateWhenIdle: Boolean = false
		// 如果为 `true`，则在 [`moveend`](#地图-moveend) 时更新控件，否则始终保持最新状态（在 [`move`](#地图-move) 时更新）。
	},

	onAdd: function (map) {
		var className = 'leaflet-control-scale',
		    container = DomUtil.create('div', className),
		    options = this.options;

		this._addScales(options, className + '-line', container);

		map.on(options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
		map.whenReady(this._update, this);

		return container;
	},

	onRemove: function (map) {
		map.off(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
	},

	_addScales: function (options, className, container) {
		if (options.metric) {
			this._mScale = DomUtil.create('div', className, container);
		}
		if (options.imperial) {
			this._iScale = DomUtil.create('div', className, container);
		}
	},

	_update: function () {
		var map = this._map,
		    y = map.getSize().y / 2;

		var maxMeters = map.distance(
			map.containerPointToLatLng([0, y]),
			map.containerPointToLatLng([this.options.maxWidth, y]));

		this._updateScales(maxMeters);
	},

	_updateScales: function (maxMeters) {
		if (this.options.metric && maxMeters) {
			this._updateMetric(maxMeters);
		}
		if (this.options.imperial && maxMeters) {
			this._updateImperial(maxMeters);
		}
	},

	_updateMetric: function (maxMeters) {
		var meters = this._getRoundNum(maxMeters),
		    label = meters < 1000 ? meters + ' m' : (meters / 1000) + ' km';

		this._updateScale(this._mScale, label, meters / maxMeters);
	},

	_updateImperial: function (maxMeters) {
		var maxFeet = maxMeters * 3.2808399,
		    maxMiles, miles, feet;

		if (maxFeet > 5280) {
			maxMiles = maxFeet / 5280;
			miles = this._getRoundNum(maxMiles);
			this._updateScale(this._iScale, miles + ' mi', miles / maxMiles);

		} else {
			feet = this._getRoundNum(maxFeet);
			this._updateScale(this._iScale, feet + ' ft', feet / maxFeet);
		}
	},

	_updateScale: function (scale, text, ratio) {
		scale.style.width = Math.round(this.options.maxWidth * ratio) + 'px';
		scale.innerHTML = text;
	},

	_getRoundNum: function (num) {
		var pow10 = Math.pow(10, (Math.floor(num) + '').length - 1),
		    d = num / pow10;

		d = d >= 10 ? 10 :
		    d >= 5 ? 5 :
		    d >= 3 ? 3 :
		    d >= 2 ? 2 : 1;

		return pow10 * d;
	}
});


// @factory L.control.scale(options?: Control.Scale options)
// 根据给定选项创建比例控制组件。
export var scale = function (options) {
	return new Scale(options);
};
