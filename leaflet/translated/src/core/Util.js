/*
 * @namespace Util
 *
 * 各种由 Leaflet 内部使用的实用函数。
 */

// @function extend(dest: Object, src?: Object): Object
// 将 `src` 对象（或多个对象）的属性合并到 `dest` 对象中，并返回后者。具有 `L.extend` 快捷方式。
export function extend(dest) {
	var i, j, len, src;

	for (j = 1, len = arguments.length; j < len; j++) {
		src = arguments[j];
		for (i in src) {
			dest[i] = src[i];
		}
	}
	return dest;
}

// @function create(proto: Object, properties?: Object): Object
// 对 [Object.create](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/create) 的兼容性填充函数。
export var create = Object.create || (function () {
	function F() {}
	return function (proto) {
		F.prototype = proto;
		return new F();
	};
})();

// @function bind(fn: Function, …): Function
// 返回一个绑定了传递参数的新函数，类似于 [Function.prototype.bind](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Function/bind)。
// 具有 `L.bind()` 快捷方式。
export function bind(fn, obj) {
	var slice = Array.prototype.slice;

	if (fn.bind) {
		return fn.bind.apply(fn, slice.call(arguments, 1));
	}

	var args = slice.call(arguments, 2);

	return function () {
		return fn.apply(obj, args.length ? args.concat(slice.call(arguments)) : arguments);
	};
}

// @property lastId: Number
// 由 [`stamp()`](#util-stamp) 使用的最后一个唯一 ID。
export var lastId = 0;

// @function stamp(obj: Object): Number
// 返回对象的唯一 ID，如果对象没有该 ID，则分配一个。
export function stamp(obj) {
	if (!('_leaflet_id' in obj)) {
		obj['_leaflet_id'] = ++lastId;
	}
	return obj._leaflet_id;
}

// @function throttle(fn: Function, time: Number, context: Object): Function
// 返回一个函数，该函数以给定的作用域 `context` 执行函数 `fn`。
// （使得 `this` 关键字在 `fn` 代码中的指向为 `context`）。该函数
// `fn` 将在给定的 `time` 时间内最多调用一次。参数
// 绑定函数接收到的参数包括绑定函数时传递的任意参数，以及调用绑定函数时传递的任意参数。
// 具有 `L.throttle` 快捷方式。
// Has an `L.throttle` shortcut.
export function throttle(fn, time, context) {
	var lock, args, wrapperFn, later;

	later = function () {
		// 重置锁并如果已排队则调用。
		lock = false;
		if (args) {
			wrapperFn.apply(context, args);
			args = false;
		}
	};

	wrapperFn = function () {
		if (lock) {
			// 过早调用，将任务加入稍后执行队列。
			args = arguments;

		} else {
			// 调用并锁定直到稍后时间。
			fn.apply(context, arguments);
			setTimeout(later, time);
			lock = true;
		}
	};

	return wrapperFn;
}

// @function wrapNum(num: Number, range: Number[], includeMax?: Boolean): Number
// 以某种方式返回数字 `num` 除以 `range` 的余数，使其落在
// `range[0]` 和 `range[1]` 范围内。返回值总是小于
// `range[1]`，除非将 `includeMax` 设置为 `true`。
export function wrapNum(x, range, includeMax) {
	var max = range[1],
	    min = range[0],
	    d = max - min;
	return x === max && includeMax ? x : ((x - min) % d + d) % d + min;
}

// @function falseFn(): Function
// 返回一个始终返回 `false` 的函数。
export function falseFn() { return false; }

// @function formatNum(num: Number, precision?: Number|false): Number
// 以指定的 `precision` 四舍五入后返回数字 `num`。
// 默认的 `precision` 值为 6 位小数。
// 可以将 `false` 传递给跳过任何处理（可用于避免舍入误差）。
export function formatNum(num, precision) {
	if (precision === false) { return num; }
	var pow = Math.pow(10, precision === undefined ? 6 : precision);
	return Math.round(num * pow) / pow;
}

// @function trim(str: String): String
// 对 [String.prototype.trim](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/Trim) 的兼容性填充函数。
export function trim(str) {
	return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
}

// @function splitWords(str: String): String[]
// 清除字符串中的空格并将字符串分割，返回部分数组。
export function splitWords(str) {
	return trim(str).split(/\s+/);
}

// @function setOptions(obj: Object, options: Object): Object
// 将给定属性合并到 `obj` 对象的 `options` 中，并返回结果选项。参见 `Class options`。具有 `L.setOptions` 快捷方式。
export function setOptions(obj, options) {
	if (!Object.prototype.hasOwnProperty.call(obj, 'options')) {
		obj.options = obj.options ? create(obj.options) : {};
	}
	for (var i in options) {
		obj.options[i] = options[i];
	}
	return obj.options;
}

// @function getParamString(obj: Object, existingUrl?: String, uppercase?: Boolean): String
// 将对象转换为参数 URL 字符串，例如 `{a: "foo", b: "bar"}`
// 转换为 `'?a=foo&b=bar'`。如果设置了 `existingUrl`，参数将会
// 被附加在末尾。如果 `uppercase` 为 `true`，参数名称将
// 大写（例如 `'?A=foo&B=bar'`）
export function getParamString(obj, existingUrl, uppercase) {
	var params = [];
	for (var i in obj) {
		params.push(encodeURIComponent(uppercase ? i.toUpperCase() : i) + '=' + encodeURIComponent(obj[i]));
	}
	return ((!existingUrl || existingUrl.indexOf('?') === -1) ? '?' : '&') + params.join('&');
}

var templateRe = /\{ *([\w_ -]+) *\}/g;

// @function template(str: String, data: Object): String
// 简单的模板功能，接受以 `'Hello {a}, {b}'` 形式的模板字符串
// 和一个像 `{a: 'foo', b: 'bar'}` 这样的数据对象，返回计算后的字符串
// `('Hello foo, bar')`。您也可以用函数代替字符串来指定
// 数据值——它们会被计算，并将 `data` 作为参数传递。
export function template(str, data) {
	return str.replace(templateRe, function (str, key) {
		var value = data[key];

		if (value === undefined) {
			throw new Error('No value provided for variable ' + str);

		} else if (typeof value === 'function') {
			value = value(data);
		}
		return value;
	});
}

// @function isArray(obj): Boolean
// [Array.isArray](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray) 的兼容性填充器
export var isArray = Array.isArray || function (obj) {
	return (Object.prototype.toString.call(obj) === '[object Array]');
};

// @function indexOf(array: Array, el: Object): Number
// [Array.prototype.indexOf](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf) 的兼容性填充器
export function indexOf(array, el) {
	for (var i = 0; i < array.length; i++) {
		if (array[i] === el) { return i; }
	}
	return -1;
}

// @property emptyImageUrl: String
// 包含 Base64 编码空 GIF 图像的数据 URI 字符串。
// 作为一种技巧，用于释放WebKit移动设备上未使用图像的内存（通过将图像 `src` 设置为此字符串）。
// 受 https://paulirish.com/2011/requestanimationframe-for-smart-animating/ 的启发
export var emptyImageUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

// inspired by https://paulirish.com/2011/requestanimationframe-for-smart-animating/

function getPrefixed(name) {
	return window['webkit' + name] || window['moz' + name] || window['ms' + name];
}

var lastTime = 0;

// IE 7-8 的回退方案
function timeoutDefer(fn) {
	var time = +new Date(),
	    timeToCall = Math.max(0, 16 - (time - lastTime));

	lastTime = time + timeToCall;
	return window.setTimeout(fn, timeToCall);
}

export var requestFn = window.requestAnimationFrame || getPrefixed('RequestAnimationFrame') || timeoutDefer;
export var cancelFn = window.cancelAnimationFrame || getPrefixed('CancelAnimationFrame') ||
		getPrefixed('CancelRequestAnimationFrame') || function (id) { window.clearTimeout(id); };

// @function requestAnimFrame(fn: Function, context?: Object, immediate?: Boolean): Number
// 在浏览器重新绘制时安排执行 `fn`。如果提供了 `context`，`fn` 与
// 绑定。当设置 `immediate` 为 `true` 时，如果
// 浏览器没有原生支持，
// [`window.requestAnimationFrame`](https://developer.mozilla.org/docs/Web/API/window/requestAnimationFrame),
// 则 `fn` 会被延迟执行。返回一个请求 ID，可用于取消该请求。
export function requestAnimFrame(fn, context, immediate) {
	if (immediate && requestFn === timeoutDefer) {
		fn.call(context);
	} else {
		return requestFn.call(window, bind(fn, context));
	}
}

// @function cancelAnimFrame(id: Number): undefined
// 取消之前的 `requestAnimFrame`。另请参阅 [window.cancelAnimationFrame](https://developer.mozilla.org/docs/Web/API/window/cancelAnimationFrame)。
export function cancelAnimFrame(id) {
	if (id) {
		cancelFn.call(window, id);
	}
}
