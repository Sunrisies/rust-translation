import * as DomEvent from './DomEvent';
import * as Util from '../core/Util';
import {Point} from '../geometry/Point';
import Browser from '../core/Browser';

/*
 * @namespace DomUtil
 *
 * 用于操作 [DOM](https://developer.mozilla.org/docs/Web/API/Document_Object_Model) 的实用函数
 * Leaflet 内部使用的树结构
 *
 * 大多数期望或返回 `HTMLElement` 的函数也适用于
 * SVG 元素。唯一区别在于，HTML 中的类指的是 CSS 类，而 SVG 中的类指的是 SVG 中的类
 * in HTML and SVG classes in SVG.
 */


// @property TRANSFORM: String
// 供应商前缀化的变换样式名称（例如 WebKit 的 `'webkitTransform'`）
export var TRANSFORM = testProp(
	['transform', 'webkitTransform', 'OTransform', 'MozTransform', 'msTransform']);

// `webkitTransition` 优先使用，因为某些浏览器版本会移除供应商前缀，此时 `transitionend` 事件不会生效，尤其是 Android 4.1 默认浏览器
// the same for the transitionend event, in particular the Android 4.1 stock browser

// @property TRANSITION: String
// 供应商前缀化的过渡样式名称
export var TRANSITION = testProp(
	['webkitTransition', 'transition', 'OTransition', 'MozTransition', 'msTransition']);

// @property TRANSITION_END: String
// 供应商前缀化的 `transitionend` 事件名称
export var TRANSITION_END =
	TRANSITION === 'webkitTransition' || TRANSITION === 'OTransition' ? TRANSITION + 'End' : 'transitionend';


// @function get(id: String|HTMLElement): HTMLElement
// 根据 DOM id 返回元素，或者如果直接传递了参数，则返回元素本身
// 返回元素特定样式属性的值，
export function get(id) {
	return typeof id === 'string' ? document.getElementById(id) : id;
}

// @function getStyle(el: HTMLElement, styleAttrib: String): String
// Returns the value for a certain style attribute on an element,
// 包括计算值或通过 CSS 设置的值
export function getStyle(el, style) {
	var value = el.style[style] || (el.currentStyle && el.currentStyle[style]);

	if ((!value || value === 'auto') && document.defaultView) {
		var css = document.defaultView.getComputedStyle(el, null);
		value = css ? css[style] : null;
	}
	return value === 'auto' ? null : value;
}

// @function create(tagName: String, className?: String, container?: HTMLElement): HTMLElement
// 使用 `tagName` 创建 HTML 元素，将其类设置为 `className`，并可选地将它附加到 `container` 元素上
export function create(tagName, className, container) {
	var el = document.createElement(tagName);
	el.className = className || '';

	if (container) {
		container.appendChild(el);
	}
	return el;
}

// @function remove(el: HTMLElement)
// 将 `el` 从父元素中移除
export function remove(el) {
	var parent = el.parentNode;
	if (parent) {
		parent.removeChild(el);
	}
}

// @function empty(el: HTMLElement)
// 将 `el` 的所有子元素从 `el` 中移除
export function empty(el) {
	while (el.firstChild) {
		el.removeChild(el.firstChild);
	}
}

// @function toFront(el: HTMLElement)
// 使 `el` 成为其父元素的最后一个子节点，从而在其他子节点之前显示
export function toFront(el) {
	var parent = el.parentNode;
	if (parent && parent.lastChild !== el) {
		parent.appendChild(el);
	}
}

// @function toBack(el: HTMLElement)
// 使 `el` 成为其父元素的第一个子节点，从而在其他子节点之后显示
export function toBack(el) {
	var parent = el.parentNode;
	if (parent && parent.firstChild !== el) {
		parent.insertBefore(el, parent.firstChild);
	}
}

// @function hasClass(el: HTMLElement, name: String): Boolean
// 如果元素的类属性包含 `name`，则返回 `true`
export function hasClass(el, name) {
	if (el.classList !== undefined) {
		return el.classList.contains(name);
	}
	var className = getClass(el);
	return className.length > 0 && new RegExp('(^|\\s)' + name + '(\\s|$)').test(className);
}

// @function addClass(el: HTMLElement, name: String)
// 将 `name` 添加到元素的类属性中
export function addClass(el, name) {
	if (el.classList !== undefined) {
		var classes = Util.splitWords(name);
		for (var i = 0, len = classes.length; i < len; i++) {
			el.classList.add(classes[i]);
		}
	} else if (!hasClass(el, name)) {
		var className = getClass(el);
		setClass(el, (className ? className + ' ' : '') + name);
	}
}

// @function removeClass(el: HTMLElement, name: String)
// 从元素的类属性中移除 `name`
export function removeClass(el, name) {
	if (el.classList !== undefined) {
		el.classList.remove(name);
	} else {
		setClass(el, Util.trim((' ' + getClass(el) + ' ').replace(' ' + name + ' ', ' ')));
	}
}

// @function setClass(el: HTMLElement, name: String)
// 设置元素的类
export function setClass(el, name) {
	if (el.className.baseVal === undefined) {
		el.className = name;
	} else {
		// 对于 SVG 元素的情况
		el.className.baseVal = name;
	}
}

// @function getClass(el: HTMLElement): String
// 返回元素的类
export function getClass(el) {
	// 检查元素是否为 `SVGElementInstance`，并使用相应的 `element`
	// （IE11 中链接的 SVG 元素需要此功能）
	if (el.correspondingElement) {
		el = el.correspondingElement;
	}
	return el.className.baseVal === undefined ? el.className : el.className.baseVal;
}

// @function setOpacity(el: HTMLElement, opacity: Number)
// 设置元素的不透明度（包括旧版 IE 支持）
// `opacity` 必须是一个介于 `0` 和 `1` 之间的数字
export function setOpacity(el, value) {
	if ('opacity' in el.style) {
		el.style.opacity = value;
	} else if ('filter' in el.style) {
		_setOpacityIE(el, value);
	}
}

function _setOpacityIE(el, value) {
	var filter = false,
	    filterName = 'DXImageTransform.Microsoft.Alpha';

	// 如果尝试获取不存在的滤镜，filters collection 会抛出错误
	try {
		filter = el.filters.item(filterName);
	} catch (e) {
		// 如果尚未设置不透明度为 1，则不要将其设置为 1，
		// 因为不需要这样做，且会破坏透明 PNG 图像
		if (value === 1) { return; }
	}

	value = Math.round(value * 100);

	if (filter) {
		filter.Enabled = (value !== 100);
		filter.Opacity = value;
	} else {
		el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
	}
}

// @function testProp(props: String[]): String|false
// 遍历样式名称数组，并返回第一个有效的元素样式名称。 如果未找到这样的名称，
// that is a valid style name for an element. If no such name is found,
// 则返回 false。适用于以 `transform` 开头的供应商前缀样式。
export function testProp(props) {
	var style = document.documentElement.style;

	for (var i = 0; i < props.length; i++) {
		if (props[i] in style) {
			return props[i];
		}
	}
	return false;
}

// @function setTransform(el: HTMLElement, offset: Point, scale?: Number)
// 重置 `el` 的 3D CSS 变换，使其按 `offset` 像素进行平移，
// 并可选按 `scale` 缩放。如果浏览器不支持 3D CSS 变换，则无效。
// browser doesn't support 3D CSS transforms.
export function setTransform(el, offset, scale) {
	var pos = offset || new Point(0, 0);

	el.style[TRANSFORM] =
		(Browser.ie3d ?
			'translate(' + pos.x + 'px,' + pos.y + 'px)' :
			'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)') +
		(scale ? ' scale(' + scale + ')' : '');
}

// @function setPosition(el: HTMLElement, position: Point)
// 将 `el` 的位置设置为 `position` 指定的坐标，
// 根据浏览器使用 CSS translate 或 top/left 定位方式。
// （Leaflet 内部用于定位其图层）。
export function setPosition(el, point) {

	/*eslint-disable */
	el._leaflet_pos = point;
	/* eslint-enable */

	if (Browser.any3d) {
		setTransform(el, point);
	} else {
		el.style.left = point.x + 'px';
		el.style.top = point.y + 'px';
	}
}

// @function getPosition(el: HTMLElement): Point
// 返回之前通过 setPosition 定位的元素坐标。
export function getPosition(el) {
	// 此方法仅用于之前使用 setPosition 定位的元素，
	// 因此缓存位置以提高性能是安全的。

	return el._leaflet_pos || new Point(0, 0);
}

// @function disableTextSelection()
// 防止用户生成 `selectstart` DOM 事件，该事件通常在用户通过文本页面拖拽鼠标时产生。Leaflet 内部使用它来覆盖地图上的任何点击和拖动交互行为。影响整个文档的拖拽交互。
// when the user drags the mouse through a page with text. Used internally
// by Leaflet to override the behaviour of any click-and-drag interaction on
// the 地图. Affects drag interactions on the whole document.

// @function enableTextSelection()
// 取消之前 [`L.DomUtil.disableTextSelection`](#domutil-disabletextselection) 的效果。
export var disableTextSelection;
export var enableTextSelection;
var _userSelect;
if ('onselectstart' in document) {
	disableTextSelection = function () {
		DomEvent.on(window, 'selectstart', DomEvent.preventDefault);
	};
	enableTextSelection = function () {
		DomEvent.off(window, 'selectstart', DomEvent.preventDefault);
	};
} else {
	var userSelectProperty = testProp(
		['userSelect', 'WebkitUserSelect', 'OUserSelect', 'MozUserSelect', 'msUserSelect']);

	disableTextSelection = function () {
		if (userSelectProperty) {
			var style = document.documentElement.style;
			_userSelect = style[userSelectProperty];
			style[userSelectProperty] = 'none';
		}
	};
	enableTextSelection = function () {
		if (userSelectProperty) {
			document.documentElement.style[userSelectProperty] = _userSelect;
			_userSelect = undefined;
		}
	};
}

// @function disableImageDrag()
// 如同 [`L.DomUtil.disableTextSelection`](#domutil-disabletextselection)，但
// 用于 `dragstart` DOM 事件，通常在用户拖拽图像时产生。
export function disableImageDrag() {
	DomEvent.on(window, 'dragstart', DomEvent.preventDefault);
}

// @function enableImageDrag()
// 取消之前 [`L.DomUtil.disableImageDrag`](#domutil-disabletextselection) 的效果。
export function enableImageDrag() {
	DomEvent.off(window, 'dragstart', DomEvent.preventDefault);
}

var _outlineElement, _outlineStyle;
// @function preventOutline(el: HTMLElement)
// 使元素 `el` 的 [轮廓](https://developer.mozilla.org/docs/Web/CSS/outline) 不可见。Leaflet 内部使用它来防止
// of the element `el` invisible. Used internally by Leaflet to prevent
// 可聚焦元素在用户执行拖拽交互时显示轮廓。
// 影响整个文档的拖拽交互。
export function preventOutline(element) {
	while (element.tabIndex === -1) {
		element = element.parentNode;
	}
	if (!element.style) { return; }
	restoreOutline();
	_outlineElement = element;
	_outlineStyle = element.style.outlineStyle;
	element.style.outlineStyle = 'none';
	DomEvent.on(window, 'keydown', restoreOutline);
}

// @function restoreOutline()
// 取消之前 [`L.DomUtil.preventOutline`]() 的效果。
export function restoreOutline() {
	if (!_outlineElement) { return; }
	_outlineElement.style.outlineStyle = _outlineStyle;
	_outlineElement = undefined;
	_outlineStyle = undefined;
	DomEvent.off(window, 'keydown', restoreOutline);
}

// @function getSizedParentNode(el: HTMLElement): HTMLElement
// 查找尺寸（宽度和高度）不为空的最近父节点。
export function getSizedParentNode(element) {
	do {
		element = element.parentNode;
	} while ((!element.offsetWidth || !element.offsetHeight) && element !== document.body);
	return element;
}

// @function getScale(el: HTMLElement): Object
// 计算当前应用于元素的 CSS 缩放比例。
// 返回一个包含 `x` 和 `y` 成员的对象，分别表示水平和垂直缩放比例，
// 以及 `boundingClientRect`，该值来自 [`getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) 的返回值。
export function getScale(element) {
	var rect = element.getBoundingClientRect(); // Read-only in old browsers.

	return {
		x: rect.width / element.offsetWidth || 1,
		y: rect.height / element.offsetHeight || 1,
		boundingClientRect: rect
	};
}
