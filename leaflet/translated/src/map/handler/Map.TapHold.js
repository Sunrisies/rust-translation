import {Map} from '../Map';
import {Handler} from '../../core/Handler';
import * as DomEvent from '../../dom/DomEvent';
import {Point} from '../../geometry/Point';
import * as Util from '../../core/Util';
import Browser from '../../core/Browser';

/*
 * L.Map.TapHold is used to simulate `contextmenu` event on long hold,
 * 否则不会在移动版 Safari 中触发。
 */

var tapHoldDelay = 600;

// @namespace Map
// @section Interaction Options
Map.mergeOptions({
	// @section Touch interaction options
	// @option tapHold: Boolean
	// 启用 `contextmenu` 事件的模拟，默认在移动版 Safari 中为 `true`。
	tapHold: Browser.touchNative && Browser.safari && Browser.mobile,

	// @option tapTolerance: Number = 15
	// 用户在触摸时手指可移动的最大像素数。
	// 才能被视为有效的点击。
	tapTolerance: 15
});

export var TapHold = Handler.extend({
	addHooks: function () {
		DomEvent.on(this._map._container, 'touchstart', this._onDown, this);
	},

	removeHooks: function () {
		DomEvent.off(this._map._container, 'touchstart', this._onDown, this);
	},

	_onDown: function (e) {
		clearTimeout(this._holdTimeout);
		if (e.touches.length !== 1) { return; }

		var first = e.touches[0];
		this._startPos = this._newPos = new Point(first.clientX, first.clientY);

		this._holdTimeout = setTimeout(Util.bind(function () {
			this._cancel();
			if (!this._isTapValid()) { return; }

			// 防止模拟鼠标事件 https://w3c.github.io/touch-events/#mouse-events
			DomEvent.on(document, 'touchend', DomEvent.preventDefault);
			DomEvent.on(document, 'touchend touchcancel', this._cancelClickPrevent);
			this._simulateEvent('contextmenu', first);
		}, this), tapHoldDelay);

		DomEvent.on(document, 'touchend touchcancel contextmenu', this._cancel, this);
		DomEvent.on(document, 'touchmove', this._onMove, this);
	},

	_cancelClickPrevent: function cancelClickPrevent() {
		DomEvent.off(document, 'touchend', DomEvent.preventDefault);
		DomEvent.off(document, 'touchend touchcancel', cancelClickPrevent);
	},

	_cancel: function () {
		clearTimeout(this._holdTimeout);
		DomEvent.off(document, 'touchend touchcancel contextmenu', this._cancel, this);
		DomEvent.off(document, 'touchmove', this._onMove, this);
	},

	_onMove: function (e) {
		var first = e.touches[0];
		this._newPos = new Point(first.clientX, first.clientY);
	},

	_isTapValid: function () {
		return this._newPos.distanceTo(this._startPos) <= this._map.options.tapTolerance;
	},

	_simulateEvent: function (type, e) {
		var simulatedEvent = new MouseEvent(type, {
			bubbles: true,
			cancelable: true,
			view: window,
			// detail: 1,
			screenX: e.screenX,
			screenY: e.screenY,
			clientX: e.clientX,
			clientY: e.clientY,
			// button: 2,
			// buttons: 2
		});

		simulatedEvent._simulated = true;

		e.target.dispatchEvent(simulatedEvent);
	}
});

// @section Handlers
// @property tapHold: Handler
// 用于模拟 `contextmenu` 事件的长点击处理程序（在移动版 Safari 中很有用）。
Map.addInitHook('addHandler', 'tapHold', TapHold);
