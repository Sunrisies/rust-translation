import * as DomEvent from './DomEvent';

/*
 * 为移动浏览器增加了双击支持，以扩展事件处理代码。
 *
 * 注意：目前大多数浏览器使用原生双击行为，仅有少数例外。
 * （参见 https://github.com/Leaflet/Leaflet/issues/7012#issuecomment-595087386）
 */

function makeDblclick(event) {
	// 在现代浏览器中，`type`属性无法仅被覆盖：
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Getter_only
	var newEvent = {},
	    prop, i;
	for (i in event) {
		prop = event[i];
		newEvent[i] = prop && prop.bind ? prop.bind(event) : prop;
	}
	event = newEvent;
	newEvent.type = 'dblclick';
	newEvent.detail = 2;
	newEvent.isTrusted = false;
	newEvent._simulated = true; // for debug purposes
	return newEvent;
}

var delay = 200;
export function addDoubleTapListener(obj, handler) {
	// 大多数浏览器原生支持双击操作。
	obj.addEventListener('dblclick', handler);

	// 在某些平台上，浏览器对于触摸事件不会使用原生双击行为。
	// 似乎在所有这些情况下，`click`事件的`detail`属性始终为`1`。
	// 因此，我们利用这一特性在不需要时避免不必要的“双击”模拟。
	var last = 0,
	    detail;
	function simDblclick(e) {
		if (e.detail !== 1) {
			detail = e.detail; // keep in sync to avoid false dblclick in some cases
			return;
		}

		if (e.pointerType === 'mouse' ||
			(e.sourceCapabilities && !e.sourceCapabilities.firesTouchEvents)) {

			return;
		}

		// 当点击 <input> 元素时，浏览器会生成一次点击事件。
		// <label> (and vice versa) triggering two clicks in quick succession.
		// 这忽略了带有 `for` 属性的标签上的点击，但忽略其子元素的点击。
		// 该属性（或此类标签的子元素）的点击则被忽略。
		// a <input>.
		var path = DomEvent.getPropagationPath(e);
		if (path.some(function (el) {
			return el instanceof HTMLLabelElement && el.attributes.for;
		}) &&
			!path.some(function (el) {
				return (
					el instanceof HTMLInputElement ||
					el instanceof HTMLSelectElement
				);
			})
		) {
			return;
		}

		var now = Date.now();
		if (now - last <= delay) {
			detail++;
			if (detail === 2) {
				handler(makeDblclick(e));
			}
		} else {
			detail = 1;
		}
		last = now;
	}

	obj.addEventListener('click', simDblclick);

	return {
		dblclick: handler,
		simDblclick: simDblclick
	};
}

export function removeDoubleTapListener(obj, handlers) {
	obj.removeEventListener('dblclick', handlers.dblclick);
	obj.removeEventListener('click', handlers.simDblclick);
}
