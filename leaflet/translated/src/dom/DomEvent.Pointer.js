import * as DomEvent from './DomEvent';
import Browser from '../core/Browser';
import {falseFn} from '../core/Util';

/*
 * 扩展 L.DomEvent 以在 Internet Explorer 和基于 Windows 的设备上提供触摸支持。
 */

var POINTER_DOWN =   Browser.msPointer ? 'MSPointerDown'   : 'pointerdown';
var POINTER_MOVE =   Browser.msPointer ? 'MSPointerMove'   : 'pointermove';
var POINTER_UP =     Browser.msPointer ? 'MSPointerUp'     : 'pointerup';
var POINTER_CANCEL = Browser.msPointer ? 'MSPointerCancel' : 'pointercancel';
var pEvent = {
	touchstart  : POINTER_DOWN,
	touchmove   : POINTER_MOVE,
	touchend    : POINTER_UP,
	touchcancel : POINTER_CANCEL
};
var handle = {
	touchstart  : _onPointerStart,
	touchmove   : _handlePointer,
	touchend    : _handlePointer,
	touchcancel : _handlePointer
};
var _pointers = {};
var _pointerDocListener = false;

// 为 (ms)pointer 事件提供触摸事件包装器。
// 参考 https://www.w3.org/TR/pointerevents/ https://www.w3.org/Bugs/Public/show_bug.cgi?id=22890

export function addPointerListener(obj, type, handler) {
	if (type === 'touchstart') {
		_addPointerDocListener();
	}
	if (!handle[type]) {
		console.warn('wrong event specified:', type);
		return falseFn;
	}
	handler = handle[type].bind(this, handler);
	obj.addEventListener(pEvent[type], handler, false);
	return handler;
}

export function removePointerListener(obj, type, handler) {
	if (!pEvent[type]) {
		console.warn('wrong event specified:', type);
		return;
	}
	obj.removeEventListener(pEvent[type], handler, false);
}

function _globalPointerDown(e) {
	_pointers[e.pointerId] = e;
}

function _globalPointerMove(e) {
	if (_pointers[e.pointerId]) {
		_pointers[e.pointerId] = e;
	}
}

function _globalPointerUp(e) {
	delete _pointers[e.pointerId];
}

function _addPointerDocListener() {
	// 需要跟踪哪些指针以及有多少处于活动状态，以实现 e.touches 仿真功能。
	if (!_pointerDocListener) {
		// 我们监听文档中的任何拖拽操作，当触摸从屏幕上移开时就会触发这些操作。
		document.addEventListener(POINTER_DOWN, _globalPointerDown, true);
		document.addEventListener(POINTER_MOVE, _globalPointerMove, true);
		document.addEventListener(POINTER_UP, _globalPointerUp, true);
		document.addEventListener(POINTER_CANCEL, _globalPointerUp, true);

		_pointerDocListener = true;
	}
}

function _handlePointer(handler, e) {
	if (e.pointerType === (e.MSPOINTER_TYPE_MOUSE || 'mouse')) { return; }

	e.touches = [];
	for (var i in _pointers) {
		e.touches.push(_pointers[i]);
	}
	e.changedTouches = [e];

	handler(e);
}

function _onPointerStart(handler, e) {
	// IE10 特定：MsTouch 需要调用 preventDefault 方法。参见 #2000
	if (e.MSPOINTER_TYPE_TOUCH && e.pointerType === e.MSPOINTER_TYPE_TOUCH) {
		DomEvent.preventDefault(e);
	}
	_handlePointer(handler, e);
}
