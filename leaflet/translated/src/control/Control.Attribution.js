
import {Control} from './Control';
import {Map} from '../map/Map';
import * as Util from '../core/Util';
import * as DomEvent from '../dom/DomEvent';
import * as DomUtil from '../dom/DomUtil';
import Browser from '../core/Browser';

var ukrainianFlag = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" class="leaflet-attribution-flag"><path fill="#4C7BE1" d="M0 0h12v4H0z"/><path fill="#FFD500" d="M0 4h12v3H0z"/><path fill="#E0BC00" d="M0 7h12v1H0z"/></svg>';


/*
 * @class Control.Attribution
 * @aka L.Control.Attribution
 * @inherits Control
 *
 * 归因控制功能允许你在地图上通过一个小文本框显示归因数据。默认情况下，该控件会显示在地图上，除非你将其 [`attributionControl` 选项](#地图-attributioncontrol) 设置为 `false`。它会自动从使用 [`getAttribution` 方法](#图层-getattribution) 的图层中获取归因文本。该控件属于 控件 类的扩展。
 */

export var Attribution = Control.extend({
	// @section
	// @aka Control.Attribution options
	options: {
		position: 'bottomright',

		// @option prefix: String|false = 'Leaflet'
		// 显示在归因信息之前的 HTML 文本。传入 `false` 可禁用此功能。
		prefix: '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">' + (Browser.inlineSvg ? ukrainianFlag + ' ' : '') + 'Leaflet</a>'
	},

	initialize: function (options) {
		Util.setOptions(this, options);

		this._attributions = {};
	},

	onAdd: function (map) {
		map.attributionControl = this;
		this._container = DomUtil.create('div', 'leaflet-control-attribution');
		DomEvent.disableClickPropagation(this._container);

		// TODO 代码丑陋，需要重构。
		for (var i in map._layers) {
			if (map._layers[i].getAttribution) {
				this.addAttribution(map._layers[i].getAttribution());
			}
		}

		this._update();

		map.on('layeradd', this._addAttribution, this);

		return this._container;
	},

	onRemove: function (map) {
		map.off('layeradd', this._addAttribution, this);
	},

	_addAttribution: function (ev) {
		if (ev.layer.getAttribution) {
			this.addAttribution(ev.layer.getAttribution());
			ev.layer.once('remove', function () {
				this.removeAttribution(ev.layer.getAttribution());
			}, this);
		}
	},

	// @method setPrefix(prefix: String|false): this
	// 显示在归因信息之前的 HTML 文本。传入 `false` 可禁用此功能。
	setPrefix: function (prefix) {
		this.options.prefix = prefix;
		this._update();
		return this;
	},

	// @method addAttribution(text: String): this
	// 添加归因文本（例如 `'&copy; OpenStreetMap contributors'`）。
	addAttribution: function (text) {
		if (!text) { return this; }

		if (!this._attributions[text]) {
			this._attributions[text] = 0;
		}
		this._attributions[text]++;

		this._update();

		return this;
	},

	// @method removeAttribution(text: String): this
	// 移除归因文本。
	removeAttribution: function (text) {
		if (!text) { return this; }

		if (this._attributions[text]) {
			this._attributions[text]--;
			this._update();
		}

		return this;
	},

	_update: function () {
		if (!this._map) { return; }

		var attribs = [];

		for (var i in this._attributions) {
			if (this._attributions[i]) {
				attribs.push(i);
			}
		}

		var prefixAndAttribs = [];

		if (this.options.prefix) {
			prefixAndAttribs.push(this.options.prefix);
		}
		if (attribs.length) {
			prefixAndAttribs.push(attribs.join(', '));
		}

		this._container.innerHTML = prefixAndAttribs.join(' <span aria-hidden="true">|</span> ');
	}
});

// @namespace Map
// @section Control options
// @option attributionControl: Boolean = true
// 指示默认情况下是否会在地图上添加 [归因控制](#控件-归属信息) 控件。
Map.mergeOptions({
	attributionControl: true
});

Map.addInitHook(function () {
	if (this.options.attributionControl) {
		new Attribution().addTo(this);
	}
});

// @namespace Control.Attribution
// @factory L.control.attribution(options: Control.Attribution options)
// 创建归因控制功能。
export var attribution = function (options) {
	return new Attribution(options);
};
