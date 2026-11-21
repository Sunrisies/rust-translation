import {Handler} from '../../core/Handler';
import * as DomUtil from '../../dom/DomUtil';
import {Draggable} from '../../dom/Draggable';
import {toBounds} from '../../geometry/Bounds';
import {toPoint} from '../../geometry/Point';
import {requestAnimFrame, cancelAnimFrame} from '../../core/Util';

/*
 * L.Handler.MarkerDrag is used internally by L.Marker to make the markers draggable.
 */


/* @namespace Marker
 * @section Interaction handlers
 *
 * 交互处理程序是标记实例的属性，允许你在运行时控制交互行为，从而启用或禁用某些功能，例如拖拽（参见 `Handler` 方法）。示例：
 *
 * ```js
 * 标记.dragging.disable();
 * ```
 *
 * @property dragging: Handler
 * 标记拖拽处理程序（支持鼠标和触摸操作）。仅在标记位于地图上时有效（否则设置 [`marker.options.draggable`](#标记-draggable)）。
 */

export var MarkerDrag = Handler.extend({
	initialize: function (marker) {
		this._marker = marker;
	},

	addHooks: function () {
		var icon = this._marker._icon;

		if (!this._draggable) {
			this._draggable = new Draggable(icon, icon, true);
		}

		this._draggable.on({
			dragstart: this._onDragStart,
			predrag: this._onPreDrag,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).enable();

		DomUtil.addClass(icon, 'leaflet-marker-draggable');
	},

	removeHooks: function () {
		this._draggable.off({
			dragstart: this._onDragStart,
			predrag: this._onPreDrag,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).disable();

		if (this._marker._icon) {
			DomUtil.removeClass(this._marker._icon, 'leaflet-marker-draggable');
		}
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	_adjustPan: function (e) {
		var marker = this._marker,
		    map = marker._map,
		    speed = this._marker.options.autoPanSpeed,
		    padding = this._marker.options.autoPanPadding,
		    iconPos = DomUtil.getPosition(marker._icon),
		    bounds = map.getPixelBounds(),
		    origin = map.getPixelOrigin();

		var panBounds = toBounds(
			bounds.min._subtract(origin).add(padding),
			bounds.max._subtract(origin).subtract(padding)
		);

		if (!panBounds.contains(iconPos)) {
			// 计算增量移动量
			var movement = toPoint(
				(Math.max(panBounds.max.x, iconPos.x) - panBounds.max.x) / (bounds.max.x - panBounds.max.x) -
				(Math.min(panBounds.min.x, iconPos.x) - panBounds.min.x) / (bounds.min.x - panBounds.min.x),

				(Math.max(panBounds.max.y, iconPos.y) - panBounds.max.y) / (bounds.max.y - panBounds.max.y) -
				(Math.min(panBounds.min.y, iconPos.y) - panBounds.min.y) / (bounds.min.y - panBounds.min.y)
			).multiplyBy(speed);

			map.panBy(movement, {animate: false});

			this._draggable._newPos._add(movement);
			this._draggable._startPos._add(movement);

			DomUtil.setPosition(marker._icon, this._draggable._newPos);
			this._onDrag(e);

			this._panRequest = requestAnimFrame(this._adjustPan.bind(this, e));
		}
	},

	_onDragStart: function () {
		// @section Dragging events
		// @event dragstart: Event
		// 在用户开始拖拽标记时触发。

		// @event movestart: Event
		// 当标记因拖拽而开始移动时触发。

		this._oldLatLng = this._marker.getLatLng();

		// 使用 ES6 导入方式时，如果未同时导入 `Popup`，则无法设置该属性。
		this._marker.closePopup && this._marker.closePopup();

		this._marker
			.fire('movestart')
			.fire('dragstart');
	},

	_onPreDrag: function (e) {
		if (this._marker.options.autoPan) {
			cancelAnimFrame(this._panRequest);
			this._panRequest = requestAnimFrame(this._adjustPan.bind(this, e));
		}
	},

	_onDrag: function (e) {
		var marker = this._marker,
		    shadow = marker._shadow,
		    iconPos = DomUtil.getPosition(marker._icon),
		    latlng = marker._map.layerPointToLatLng(iconPos);

		// 更新阴影位置
		if (shadow) {
			DomUtil.setPosition(shadow, iconPos);
		}

		marker._latlng = latlng;
		e.latlng = latlng;
		e.oldLatLng = this._oldLatLng;

		// @event drag: Event
		// 在用户拖拽标记期间反复触发。
		marker
		    .fire('move', e)
		    .fire('drag', e);
	},

	_onDragEnd: function (e) {
		// @event dragend: DragEndEvent
		// 当用户停止拖拽标记时触发。

		 cancelAnimFrame(this._panRequest);

		// @event moveend: Event
		// 当标记因拖拽而停止移动时触发。
		delete this._oldLatLng;
		this._marker
		    .fire('moveend')
		    .fire('dragend', e);
	}
});
