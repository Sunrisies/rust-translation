import {Map} from '../Map';
import {Handler} from '../../core/Handler';
import * as DomEvent from '../../dom/DomEvent';
import * as Util from '../../core/Util';

/*
 * L.Handler.ScrollWheelZoom is used by L.Map to enable mouse scroll wheel zoom on the map.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @section Mouse wheel options
	// @option scrollWheelZoom: Boolean|String = true
	// 该地图是否可以通过鼠标滚轮进行缩放。如果传入 `'center'`，
	// 则无论鼠标位于何处，都会缩放到视图中心。
	scrollWheelZoom: true,

	// @option wheelDebounceTime: Number = 40
	// 限制滚轮触发频率（以毫秒为单位）。默认情况下，
	// 用户每 40 毫秒只能通过一次滚轮进行缩放。
	wheelDebounceTime: 40,

	// @option wheelPxPerZoomLevel: Number = 60
	// 多少滚动像素数（由 [L.DomEvent.getWheelDelta](#domevent-getwheeldelta）报告）
	// 表示一个完整的缩放级别变化。较小的数值会使滚轮缩放
	// 更快（反之亦然）。
	wheelPxPerZoomLevel: 60
});

export var ScrollWheelZoom = Handler.extend({
	addHooks: function () {
		DomEvent.on(this._map._container, 'wheel', this._onWheelScroll, this);

		this._delta = 0;
	},

	removeHooks: function () {
		DomEvent.off(this._map._container, 'wheel', this._onWheelScroll, this);
	},

	_onWheelScroll: function (e) {
		var delta = DomEvent.getWheelDelta(e);

		var debounce = this._map.options.wheelDebounceTime;

		this._delta += delta;
		this._lastMousePos = this._map.mouseEventToContainerPoint(e);

		if (!this._startTime) {
			this._startTime = +new Date();
		}

		var left = Math.max(debounce - (+new Date() - this._startTime), 0);

		clearTimeout(this._timer);
		this._timer = setTimeout(Util.bind(this._performZoom, this), left);

		DomEvent.stop(e);
	},

	_performZoom: function () {
		var map = this._map,
		    zoom = map.getZoom(),
		    snap = this._map.options.zoomSnap || 0;

		map._stop(); // stop panning and fly animations if any

		// 使用S形函数将增量映射到 -4..4 范围，该范围基于 -1..1。
		var d2 = this._delta / (this._map.options.wheelPxPerZoomLevel * 4),
		    d3 = 4 * Math.log(2 / (1 + Math.exp(-Math.abs(d2)))) / Math.LN2,
		    d4 = snap ? Math.ceil(d3 / snap) * snap : d3,
		    delta = map._limitZoom(zoom + (this._delta > 0 ? d4 : -d4)) - zoom;

		this._delta = 0;
		this._startTime = null;

		if (!delta) { return; }

		if (map.options.scrollWheelZoom === 'center') {
			map.setZoom(zoom + delta);
		} else {
			map.setZoomAround(this._lastMousePos, zoom + delta);
		}
	}
});

// @section Handlers
// @property scrollWheelZoom: Handler
// 滚动滚轮缩放处理程序。
Map.addInitHook('addHandler', 'scrollWheelZoom', ScrollWheelZoom);
