
import {Control} from './Control';
import {Map} from '../map/Map';
import * as DomUtil from '../dom/DomUtil';
import * as DomEvent from '../dom/DomEvent';

/*
 * @class Control.Zoom
 * @aka L.Control.Zoom
 * @inherits Control
 *
 * 一个具有两个按钮的基本缩放控制功能（放大和缩小）。除非将其 [`zoomControl` 选项](#地图-zoomcontrol) 设置为 `false`，否则默认情况下会放置在地图上。继承自 `Control`。
 */

export var Zoom = Control.extend({
	// @section
	// @aka Control.Zoom options
	options: {
		position: 'topleft',

		// @option zoomInText: String = '<span aria-hidden="true">+</span>'
		// “放大”按钮上显示的文本。
		zoomInText: '<span aria-hidden="true">+</span>',

		// @option zoomInTitle: String = 'Zoom in'
		// “放大”按钮上显示的标题。
		zoomInTitle: 'Zoom in',

		// @option zoomOutText: String = '<span aria-hidden="true">&#x2212;</span>'
		// “缩小”按钮上显示的文本。
		zoomOutText: '<span aria-hidden="true">&#x2212;</span>',

		// @option zoomOutTitle: String = 'Zoom out'
		// “缩小”按钮上显示的标题。
		zoomOutTitle: 'Zoom out'
	},

	onAdd: function (map) {
		var zoomName = 'leaflet-control-zoom',
		    container = DomUtil.create('div', zoomName + ' leaflet-bar'),
		    options = this.options;

		this._zoomInButton  = this._createButton(options.zoomInText, options.zoomInTitle,
		        zoomName + '-in',  container, this._zoomIn);
		this._zoomOutButton = this._createButton(options.zoomOutText, options.zoomOutTitle,
		        zoomName + '-out', container, this._zoomOut);

		this._updateDisabled();
		map.on('zoomend zoomlevelschange', this._updateDisabled, this);

		return container;
	},

	onRemove: function (map) {
		map.off('zoomend zoomlevelschange', this._updateDisabled, this);
	},

	disable: function () {
		this._disabled = true;
		this._updateDisabled();
		return this;
	},

	enable: function () {
		this._disabled = false;
		this._updateDisabled();
		return this;
	},

	_zoomIn: function (e) {
		if (!this._disabled && this._map._zoom < this._map.getMaxZoom()) {
			this._map.zoomIn(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
		}
	},

	_zoomOut: function (e) {
		if (!this._disabled && this._map._zoom > this._map.getMinZoom()) {
			this._map.zoomOut(this._map.options.zoomDelta * (e.shiftKey ? 3 : 1));
		}
	},

	_createButton: function (html, title, className, container, fn) {
		var link = DomUtil.create('a', className, container);
		link.innerHTML = html;
		link.href = '#';
		link.title = title;

		/*
		 * 将强制如 VoiceOver 这样的屏幕阅读器将其读作“放大 - 按钮”。
		 */
		link.setAttribute('role', 'button');
		link.setAttribute('aria-label', title);

		DomEvent.disableClickPropagation(link);
		DomEvent.on(link, 'click', DomEvent.stop);
		DomEvent.on(link, 'click', fn, this);
		DomEvent.on(link, 'click', this._refocusOnMap, this);

		return link;
	},

	_updateDisabled: function () {
		var map = this._map,
		    className = 'leaflet-disabled';

		DomUtil.removeClass(this._zoomInButton, className);
		DomUtil.removeClass(this._zoomOutButton, className);
		this._zoomInButton.setAttribute('aria-disabled', 'false');
		this._zoomOutButton.setAttribute('aria-disabled', 'false');

		if (this._disabled || map._zoom === map.getMinZoom()) {
			DomUtil.addClass(this._zoomOutButton, className);
			this._zoomOutButton.setAttribute('aria-disabled', 'true');
		}
		if (this._disabled || map._zoom === map.getMaxZoom()) {
			DomUtil.addClass(this._zoomInButton, className);
			this._zoomInButton.setAttribute('aria-disabled', 'true');
		}
	}
});

// @namespace Map
// @section Control options
// @option zoomControl: Boolean = true
// 是否默认在地图上添加 [缩放控制](#控件-zoom)。
Map.mergeOptions({
	zoomControl: true
});

Map.addInitHook(function () {
	if (this.options.zoomControl) {
		// @section Controls
		// @property zoomControl: Control.Zoom
		// 默认的缩放控制（仅当...时可用）。
		// [`zoomControl` option](#map-zoomcontrol) was `true` when creating the map).
		this.zoomControl = new Zoom();
		this.addControl(this.zoomControl);
	}
});

// @namespace Control.Zoom
// @factory L.control.zoom(options: Control.Zoom options)
// 创建一个缩放控制。
export var zoom = function (options) {
	return new Zoom(options);
};
