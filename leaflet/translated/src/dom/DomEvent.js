import {Point} from '../geometry/Point';
import * as Util from '../core/Util';
import Browser from '../core/Browser';
import {addPointerListener, removePointerListener} from './DomEvent.Pointer';
import {addDoubleTapListener, removeDoubleTapListener} from './DomEvent.DoubleTap';
import {getScale} from './DomUtil';

/*
 * @namespace DomEvent
 * 用于处理 [DOM 事件](https://developer.mozilla.org/docs/Web/API/Event) 的实用函数，这些事件由 Leaflet 内部使用。
 */

// 受 John Resig、Dean Edwards 和 YUI addEvent 实现的影响。

// @function on(el: HTMLElement, types: String, fn: Function, context?: Object): this
// 为特定 DOM 事件类型添加监听器函数（`fn`）。
// 针对元素 `el`。可以可选指定监听器的上下文（即 `this` 指向的对象）。
// 也可以传递多个
// 用空格分隔的类型（例如 `'click dblclick'`）。

// @alternative
// @function on(el: HTMLElement, eventMap: Object, context?: Object): this
// 添加一组类型/监听器对，例如 `{click: onClick, mousemove: onMouseMove}`。
export function on(obj, types, fn, context) {

	if (types && typeof types === 'object') {
		for (var type in types) {
			addOne(obj, type, types[type], fn);
		}
	} else {
		types = Util.splitWords(types);

		for (var i = 0, len = types.length; i < len; i++) {
			addOne(obj, types[i], fn, context);
		}
	}

	return this;
}

var eventsKey = '_leaflet_events';

// @function off(el: HTMLElement, types: String, fn: Function, context?: Object): this
// 移除之前添加的监听器函数。
// 注意，如果向 `on` 传递了自定义上下文，则必须向 `off` 传递相同的
// 上下文以移除监听器。

// @alternative
// @function off(el: HTMLElement, eventMap: Object, context?: Object): this
// 移除一组类型/监听器对，例如 `{click: onClick, mousemove: onMouseMove}`。

// @alternative
// @function off(el: HTMLElement, types: String): this
// 移除所有之前添加的给定类型的监听器。

// @alternative
// @function off(el: HTMLElement): this
// 从给定的 HTMLElement 中移除所有之前添加的监听器。
export function off(obj, types, fn, context) {

	if (arguments.length === 1) {
		batchRemove(obj);
		delete obj[eventsKey];

	} else if (types && typeof types === 'object') {
		for (var type in types) {
			removeOne(obj, type, types[type], fn);
		}

	} else {
		types = Util.splitWords(types);

		if (arguments.length === 2) {
			batchRemove(obj, function (type) {
				return Util.indexOf(types, type) !== -1;
			});
		} else {
			for (var i = 0, len = types.length; i < len; i++) {
				removeOne(obj, types[i], fn, context);
			}
		}
	}

	return this;
}

function batchRemove(obj, filterFn) {
	for (var id in obj[eventsKey]) {
		var type = id.split(/\d/)[0];
		if (!filterFn || filterFn(type)) {
			removeOne(obj, type, null, null, id);
		}
	}
}

var mouseSubst = {
	mouseenter: 'mouseover',
	mouseleave: 'mouseout',
	wheel: !('onwheel' in window) && 'mousewheel'
};

function addOne(obj, type, fn, context) {
	var id = type + Util.stamp(fn) + (context ? '_' + Util.stamp(context) : '');

	if (obj[eventsKey] && obj[eventsKey][id]) { return this; }

	var handler = function (e) {
		return fn.call(context || obj, e || window.event);
	};

	var originalHandler = handler;

	if (!Browser.touchNative && Browser.pointer && type.indexOf('touch') === 0) {
		// 需要 DomEvent.Pointer.js。
		handler = addPointerListener(obj, type, handler);

	} else if (Browser.touch && (type === 'dblclick')) {
		handler = addDoubleTapListener(obj, handler);

	} else if ('addEventListener' in obj) {

		if (type === 'touchstart' || type === 'touchmove' || type === 'wheel' ||  type === 'mousewheel') {
			obj.addEventListener(mouseSubst[type] || type, handler, Browser.passiveEvents ? {passive: false} : false);

		} else if (type === 'mouseenter' || type === 'mouseleave') {
			handler = function (e) {
				e = e || window.event;
				if (isExternalTarget(obj, e)) {
					originalHandler(e);
				}
			};
			obj.addEventListener(mouseSubst[type], handler, false);

		} else {
			obj.addEventListener(type, originalHandler, false);
		}

	} else {
		obj.attachEvent('on' + type, handler);
	}

	obj[eventsKey] = obj[eventsKey] || {};
	obj[eventsKey][id] = handler;
}

function removeOne(obj, type, fn, context, id) {
	id = id || type + Util.stamp(fn) + (context ? '_' + Util.stamp(context) : '');
	var handler = obj[eventsKey] && obj[eventsKey][id];

	if (!handler) { return this; }

	if (!Browser.touchNative && Browser.pointer && type.indexOf('touch') === 0) {
		removePointerListener(obj, type, handler);

	} else if (Browser.touch && (type === 'dblclick')) {
		removeDoubleTapListener(obj, handler);

	} else if ('removeEventListener' in obj) {

		obj.removeEventListener(mouseSubst[type] || type, handler, false);

	} else {
		obj.detachEvent('on' + type, handler);
	}

	obj[eventsKey][id] = null;
}

// @function stopPropagation(ev: DOMEvent): this
// 阻止给定事件传播到父元素。在监听器函数内部使用：
// ```js
// L.DomEvent.on(div, 'click', function (ev) {
// 	L.DomEvent.stopPropagation(ev);
// });
// ```
export function stopPropagation(e) {

	if (e.stopPropagation) {
		e.stopPropagation();
	} else if (e.originalEvent) {  // In case of Leaflet event.
		e.originalEvent._stopped = true;
	} else {
		e.cancelBubble = true;
	}

	return this;
}

// @function disableScrollPropagation(el: HTMLElement): this
// 为元素的 `'wheel'` 事件（以及浏览器版本）添加 `stopPropagation`。
export function disableScrollPropagation(el) {
	addOne(el, 'wheel', stopPropagation);
	return this;
}

// @function disableClickPropagation(el: HTMLElement): this
// 为元素的 `'click'`、`'dblclick'`、`'contextmenu'`、
// `'mousedown'` 和 `'touchstart'` 事件（以及浏览器版本）添加 `stopPropagation`。
export function disableClickPropagation(el) {
	on(el, 'mousedown touchstart dblclick contextmenu', stopPropagation);
	el['_leaflet_disable_click'] = true;
	return this;
}

// @function preventDefault(ev: DOMEvent): this
// 阻止 DOM 事件 `ev` 的默认行为发生（例如
// 在 a 元素的 href 中点击链接，或提交 `<form>` 时执行 POST 请求并重新加载页面）。
// with page reload when a `<form>` is submitted).
// 在监听器函数内部使用。
export function preventDefault(e) {
	if (e.preventDefault) {
		e.preventDefault();
	} else {
		e.returnValue = false;
	}
	return this;
}

// @function stop(ev: DOMEvent): this
// 同时执行 `stopPropagation` 和 `preventDefault`。
export function stop(e) {
	preventDefault(e);
	stopPropagation(e);
	return this;
}

// @function getPropagationPath(ev: DOMEvent): Array
// [`Event.composedPath()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath) 的兼容性填充器。
// 返回一个包含给定 DOM 事件
// 应传播到的 HTMLElement 数组（如果未被阻止）。
export function getPropagationPath(ev) {
	if (ev.composedPath) {
		return ev.composedPath();
	}

	var path = [];
	var el = ev.target;

	while (el) {
		path.push(el);
		el = el.parentNode;
	}
	return path;
}


// @function getMousePosition(ev: DOMEvent, container?: HTMLElement): Point
// 从 DOM 事件中获取相对于
// `container`（不包括边框）或未指定时为整个页面的标准化鼠标位置。
export function getMousePosition(e, container) {
	if (!container) {
		return new Point(e.clientX, e.clientY);
	}

	var scale = getScale(container),
	    offset = scale.boundingClientRect; // left and top  values are in page scale (like the event clientX/Y)

	return new Point(
		// offset.left/top 值以页面缩放比例表示（如 clientX/Y）。
		// 而 clientLeft/Top（边框宽度）值是原始值（在 CSS 缩放生效之前）。
		(e.clientX - offset.left) / scale.x - container.clientLeft,
		(e.clientY - offset.top) / scale.y - container.clientTop
	);
}


// 除了 Safari 和
// 我们需要所有浏览器将滚动像素翻倍（参见 #7403 和 #4538）。
// 除了 OSX（Mac）—— 3 倍，在 Linux 上运行的 Chrome —— 1 倍。

var wheelPxFactor =
	(Browser.linux && Browser.chrome) ? window.devicePixelRatio :
	Browser.mac ? window.devicePixelRatio * 3 :
	window.devicePixelRatio > 0 ? 2 * window.devicePixelRatio : 1;
// @function getWheelDelta(ev: DOMEvent): Number
// 从 wheel DOM 事件中获取垂直方向的标准化滚轮增量，
// 以滚动的像素数表示（向下滚动时为负数）。
// 没有精确滚动的指针事件被映射为
// 大约 60 像素。
export function getWheelDelta(e) {
	return (Browser.edge) ? e.wheelDeltaY / 2 : // Don't trust window-geometry-based delta
	       (e.deltaY && e.deltaMode === 0) ? -e.deltaY / wheelPxFactor : // Pixels
	       (e.deltaY && e.deltaMode === 1) ? -e.deltaY * 20 : // Lines
	       (e.deltaY && e.deltaMode === 2) ? -e.deltaY * 60 : // Pages
	       (e.deltaX || e.deltaZ) ? 0 :	// Skip horizontal/depth wheel events
	       e.wheelDelta ? (e.wheelDeltaY || e.wheelDelta) / 2 : // Legacy IE pixels
	       (e.detail && Math.abs(e.detail) < 32765) ? -e.detail * 20 : // Legacy Moz lines
	       e.detail ? e.detail / -32765 * 60 : // Legacy Moz pages
	       0;
}

// 检查元素是否真正离开/进入事件目标（针对 mouseenter/mouseleave 事件）。
export function isExternalTarget(el, e) {

	var related = e.relatedTarget;

	if (!related) { return true; }

	try {
		while (related && (related !== el)) {
			related = related.parentNode;
		}
	} catch (err) {
		return false;
	}
	return (related !== el);
}

// @function addListener(…): this
// 与 [`L.DomEvent.on`](#domevent-on) 的别名。
export {on as addListener};

// @function removeListener(…): this
// 与 [`L.DomEvent.off`](#domevent-off) 的别名。
export {off as removeListener};
