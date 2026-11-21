import {Map} from '../Map';
import {Handler} from '../../core/Handler';
import * as DomEvent from '../../dom/DomEvent';
import * as Util from '../../core/Util';
import * as DomUtil from '../../dom/DomUtil';
import Browser from '../../core/Browser';

/*
 * L.Handler.TouchZoom is used by L.Map to add pinch zoom on supported mobile browsers.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @section Touch interaction options
	// @option touchZoom: Boolean|String = *
	// 地图是否支持双指触摸拖拽缩放。如果
	// 传入 `'center'`，则无论
	// 触摸点位于何处，都会缩放到视图中心。该功能适用于支持触摸的网页
	// browsers.
	touchZoom: Browser.touch,

	// @option bounceAtZoomLimits: Boolean = true
	// 若不想地图超出最小/最大缩放范围后回弹，请将此值设为 false
	// 并在捏合缩放时恢复原始状态。
	bounceAtZoomLimits: true
});

export var TouchZoom = Handler.extend({
	addHooks: function () {
		DomUtil.addClass(this._map._container, 'leaflet-touch-zoom');
		DomEvent.on(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	removeHooks: function () {
		DomUtil.removeClass(this._map._container, 'leaflet-touch-zoom');
		DomEvent.off(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	_onTouchStart: function (e) {
		var map = this._map;
		if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this._zooming) { return; }

		var p1 = map.mouseEventToContainerPoint(e.touches[0]),
		    p2 = map.mouseEventToContainerPoint(e.touches[1]);

		this._centerPoint = map.getSize()._divideBy(2);
		this._startLatLng = map.containerPointToLatLng(this._centerPoint);
		if (map.options.touchZoom !== 'center') {
			this._pinchStartLatLng = map.containerPointToLatLng(p1.add(p2)._divideBy(2));
		}

		this._startDist = p1.distanceTo(p2);
		this._startZoom = map.getZoom();

		this._moved = false;
		this._zooming = true;

		map._stop();

		DomEvent.on(document, 'touchmove', this._onTouchMove, this);
		DomEvent.on(document, 'touchend touchcancel', this._onTouchEnd, this);

		DomEvent.preventDefault(e);
	},

	_onTouchMove: function (e) {
		if (!e.touches || e.touches.length !== 2 || !this._zooming) { return; }

		var map = this._map,
		    p1 = map.mouseEventToContainerPoint(e.touches[0]),
		    p2 = map.mouseEventToContainerPoint(e.touches[1]),
		    scale = p1.distanceTo(p2) / this._startDist;

		this._zoom = map.getScaleZoom(scale, this._startZoom);

		if (!map.options.bounceAtZoomLimits && (
			(this._zoom < map.getMinZoom() && scale < 1) ||
			(this._zoom > map.getMaxZoom() && scale > 1))) {
			this._zoom = map._limitZoom(this._zoom);
		}

		if (map.options.touchZoom === 'center') {
			this._center = this._startLatLng;
			if (scale === 1) { return; }
		} else {
			// 获取从捏合位置到中心的偏移量，因此 centerLatLng 即为应用于初始捏合 LatLng 的偏移量。
			var delta = p1._add(p2)._divideBy(2)._subtract(this._centerPoint);
			if (scale === 1 && delta.x === 0 && delta.y === 0) { return; }
			this._center = map.unproject(map.project(this._pinchStartLatLng, this._zoom).subtract(delta), this._zoom);
		}

		if (!this._moved) {
			map._moveStart(true, false);
			this._moved = true;
		}

		Util.cancelAnimFrame(this._animRequest);

		var moveFn = Util.bind(map._move, map, this._center, this._zoom, {pinch: true, round: false}, undefined);
		this._animRequest = Util.requestAnimFrame(moveFn, this, true);

		DomEvent.preventDefault(e);
	},

	_onTouchEnd: function () {
		if (!this._moved || !this._zooming) {
			this._zooming = false;
			return;
		}

		this._zooming = false;
		Util.cancelAnimFrame(this._animRequest);

		DomEvent.off(document, 'touchmove', this._onTouchMove, this);
		DomEvent.off(document, 'touchend touchcancel', this._onTouchEnd, this);

		// 当 zoomSnap 处于关闭状态时，捏合操作仅更新 GridLayers 的层级，此时 zoomSnap 变为 noUpdate。
		if (this._map.options.zoomAnimation) {
			this._map._animateZoom(this._center, this._map._limitZoom(this._zoom), true, this._map.options.zoomSnap);
		} else {
			this._map._resetView(this._center, this._map._limitZoom(this._zoom));
		}
	}
});

// @section Handlers
// @property touchZoom: Handler
// 触摸缩放处理程序。
Map.addInitHook('addHandler', 'touchZoom', TouchZoom);
