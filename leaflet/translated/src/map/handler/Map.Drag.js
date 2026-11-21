import {Map} from '../Map';
import {Handler} from '../../core/Handler';
import {Draggable} from '../../dom/Draggable';
import * as Util from '../../core/Util';
import * as DomUtil from '../../dom/DomUtil';
import {toLatLngBounds as latLngBounds} from '../../geo/LatLngBounds';
import {toBounds} from '../../geometry/Bounds';

/*
 * L.Handler.MapDrag is used to make the map draggable (with panning inertia), enabled by default.
 */

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @option dragging: Boolean = true
	// 地图是否可以通过鼠标或触摸进行拖拽。
	dragging: true,

	// @section Panning Inertia Options
	// @option inertia: Boolean = *
	// 如果启用，地图的平移将具有惯性效果，即
	// 在拖拽过程中，地图会积累动量，并继续沿相同方向移动一段时间。在触摸设备上体验尤为良好。
	// the same direction for some time. Feels especially nice on touch
	// 默认启用。
	inertia: true,

	// @option inertiaDeceleration: Number = 3000
	// 惯性运动减速的速率，单位为像素/秒²。
	inertiaDeceleration: 3400, // px/s^2

	// @option inertiaMaxSpeed: Number = Infinity
	// 惯性运动的最大速度，单位为像素/秒。
	inertiaMaxSpeed: Infinity, // px/s

	// @option easeLinearity: Number = 0.2
	easeLinearity: 0.2,

	// TODO 重构，移至 CRS 处理。
	// @option worldCopyJump: Boolean = false
	// 如果此选项启用，当您将地图拖到另一个“副本”时，地图会跟随移动，
	// 并无缝跳转到原始位置， sehingga 所有叠加层
	// 如标记和矢量图层仍然可见。
	worldCopyJump: false,

	// @option maxBoundsViscosity: Number = 0.0
	// 如果设置了 `maxBounds`，此选项将控制拖拽地图时的边界的实心程度。`0.0` 默认值允许用户以正常速度在边界外拖拽，更高值会
	// are when dragging the 地图 around. The default value of `0.0` allows the
	// 降低在边界外的地图拖拽速度，而 `1.0` 则使边界完全实心，
	// slow down 地图 dragging outside 边界, and `1.0` makes the 边界 fully
	// 防止用户在边界外拖拽。
	maxBoundsViscosity: 0.0
});

export var Drag = Handler.extend({
	addHooks: function () {
		if (!this._draggable) {
			var map = this._map;

			this._draggable = new Draggable(map._mapPane, map._container);

			this._draggable.on({
				dragstart: this._onDragStart,
				drag: this._onDrag,
				dragend: this._onDragEnd
			}, this);

			this._draggable.on('predrag', this._onPreDragLimit, this);
			if (map.options.worldCopyJump) {
				this._draggable.on('predrag', this._onPreDragWrap, this);
				map.on('zoomend', this._onZoomEnd, this);

				map.whenReady(this._onZoomEnd, this);
			}
		}
		DomUtil.addClass(this._map._container, 'leaflet-grab leaflet-touch-drag');
		this._draggable.enable();
		this._positions = [];
		this._times = [];
	},

	removeHooks: function () {
		DomUtil.removeClass(this._map._container, 'leaflet-grab');
		DomUtil.removeClass(this._map._container, 'leaflet-touch-drag');
		this._draggable.disable();
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	moving: function () {
		return this._draggable && this._draggable._moving;
	},

	_onDragStart: function () {
		var map = this._map;

		map._stop();
		if (this._map.options.maxBounds && this._map.options.maxBoundsViscosity) {
			var bounds = latLngBounds(this._map.options.maxBounds);

			this._offsetLimit = toBounds(
				this._map.latLngToContainerPoint(bounds.getNorthWest()).multiplyBy(-1),
				this._map.latLngToContainerPoint(bounds.getSouthEast()).multiplyBy(-1)
					.add(this._map.getSize()));

			this._viscosity = Math.min(1.0, Math.max(0.0, this._map.options.maxBoundsViscosity));
		} else {
			this._offsetLimit = null;
		}

		map
		    .fire('movestart')
		    .fire('dragstart');

		if (map.options.inertia) {
			this._positions = [];
			this._times = [];
		}
	},

	_onDrag: function (e) {
		if (this._map.options.inertia) {
			var time = this._lastTime = +new Date(),
			    pos = this._lastPos = this._draggable._absPos || this._draggable._newPos;

			this._positions.push(pos);
			this._times.push(time);

			this._prunePositions(time);
		}

		this._map
		    .fire('move', e)
		    .fire('drag', e);
	},

	_prunePositions: function (time) {
		while (this._positions.length > 1 && time - this._times[0] > 50) {
			this._positions.shift();
			this._times.shift();
		}
	},

	_onZoomEnd: function () {
		var pxCenter = this._map.getSize().divideBy(2),
		    pxWorldCenter = this._map.latLngToLayerPoint([0, 0]);

		this._initialWorldOffset = pxWorldCenter.subtract(pxCenter).x;
		this._worldWidth = this._map.getPixelWorldBounds().getSize().x;
	},

	_viscousLimit: function (value, threshold) {
		return value - (value - threshold) * this._viscosity;
	},

	_onPreDragLimit: function () {
		if (!this._viscosity || !this._offsetLimit) { return; }

		var offset = this._draggable._newPos.subtract(this._draggable._startPos);

		var limit = this._offsetLimit;
		if (offset.x < limit.min.x) { offset.x = this._viscousLimit(offset.x, limit.min.x); }
		if (offset.y < limit.min.y) { offset.y = this._viscousLimit(offset.y, limit.min.y); }
		if (offset.x > limit.max.x) { offset.x = this._viscousLimit(offset.x, limit.max.x); }
		if (offset.y > limit.max.y) { offset.y = this._viscousLimit(offset.y, limit.max.y); }

		this._draggable._newPos = this._draggable._startPos.add(offset);
	},

	_onPreDragWrap: function () {
		// TODO 重构，以便在缩放后能够调整地图窗格位置。
		var worldWidth = this._worldWidth,
		    halfWidth = Math.round(worldWidth / 2),
		    dx = this._initialWorldOffset,
		    x = this._draggable._newPos.x,
		    newX1 = (x - halfWidth + dx) % worldWidth + halfWidth - dx,
		    newX2 = (x + halfWidth + dx) % worldWidth - halfWidth - dx,
		    newX = Math.abs(newX1 + dx) < Math.abs(newX2 + dx) ? newX1 : newX2;

		this._draggable._absPos = this._draggable._newPos.clone();
		this._draggable._newPos.x = newX;
	},

	_onDragEnd: function (e) {
		var map = this._map,
		    options = map.options,

		    noInertia = !options.inertia || e.noInertia || this._times.length < 2;

		map.fire('dragend', e);

		if (noInertia) {
			map.fire('moveend');

		} else {
			this._prunePositions(+new Date());

			var direction = this._lastPos.subtract(this._positions[0]),
			    duration = (this._lastTime - this._times[0]) / 1000,
			    ease = options.easeLinearity,

			    speedVector = direction.multiplyBy(ease / duration),
			    speed = speedVector.distanceTo([0, 0]),

			    limitedSpeed = Math.min(options.inertiaMaxSpeed, speed),
			    limitedSpeedVector = speedVector.multiplyBy(limitedSpeed / speed),

			    decelerationDuration = limitedSpeed / (options.inertiaDeceleration * ease),
			    offset = limitedSpeedVector.multiplyBy(-decelerationDuration / 2).round();

			if (!offset.x && !offset.y) {
				map.fire('moveend');

			} else {
				offset = map._limitOffset(offset, map.options.maxBounds);

				Util.requestAnimFrame(function () {
					map.panBy(offset, {
						duration: decelerationDuration,
						easeLinearity: ease,
						noMoveStart: true,
						animate: true
					});
				});
			}
		}
	}
});

// @section Handlers
// @property dragging: Handler
// 地图拖拽处理程序（支持鼠标和触摸）。
Map.addInitHook('addHandler', 'dragging', Drag);
