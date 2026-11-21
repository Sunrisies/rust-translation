import {Map} from '../Map';
import {Handler} from '../../core/Handler';

/*
 * L.Handler.DoubleClickZoom is used to handle double-click zoom on the map, enabled by default.
 */

// @namespace Map
// @section Interaction Options

Map.mergeOptions({
	// @option doubleClickZoom: Boolean|String = true
	// 该地图是否可以通过双击进行放大，以及
	// 在按住 Shift 键时通过双击进行缩小。如果传入
	// `'center'`，双击缩放将自动缩放到视图中心，与鼠标位置无关。
	// view regardless of where the mouse was.
	doubleClickZoom: true
});

export var DoubleClickZoom = Handler.extend({
	addHooks: function () {
		this._map.on('dblclick', this._onDoubleClick, this);
	},

	removeHooks: function () {
		this._map.off('dblclick', this._onDoubleClick, this);
	},

	_onDoubleClick: function (e) {
		var map = this._map,
		    oldZoom = map.getZoom(),
		    delta = map.options.zoomDelta,
		    zoom = e.originalEvent.shiftKey ? oldZoom - delta : oldZoom + delta;

		if (map.options.doubleClickZoom === 'center') {
			map.setZoom(zoom);
		} else {
			map.setZoomAround(e.containerPoint, zoom);
		}
	}
});

// @section Handlers
//
// 地图属性包含交互处理器，允许你在运行时控制
// 交互行为，从而启用或禁用某些功能，例如拖拽或触摸缩放（参见 `Handler` 方法）。例如：
// as dragging or touch zoom (see `Handler` methods). For example:
//
// ```js
// 地图.doubleClickZoom.disable();
// ```
//
// @property doubleClickZoom: Handler
// 双击缩放处理器。
Map.addInitHook('addHandler', 'doubleClickZoom', DoubleClickZoom);
