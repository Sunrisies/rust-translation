import {Class} from './Class';
import * as Util from './Util';

/*
 * @class Evented
 * @aka L.Evented
 * @inherits Class
 *
 * 一组在基于事件的类（如 `Map` 和 `Marker`）之间共享的方法。通常，事件允许在对象发生某些事情时执行某个函数（例如用户点击地图，导致地图触发 `'click'` 事件）。
 *
 * @example
 *
 * ```js
 * map.on('click', function(e) {
 * 	alert(e.latlng);
 * } );
 * ```
 *
 * Leaflet deals with event listeners by reference, so if you want to add a listener and then remove it, define it as a function:
 *
 * ```js
 * function onClick(e) { ... }
 *
 * map.on('click', onClick);
 * map.off('click', onClick);
 * ```
 */

export var Events = {
	/* @method on(type: String, fn: Function, context?: Object): this
	 * 为对象的特定事件类型添加监听器函数（`fn`）。可以可选指定监听器的上下文（即 `this` 关键字指向的对象）。也可以传递多个空格分隔的类型（例如 `'click dblclick'`）。
	 *
	 * @alternative
	 * @method on(eventMap: Object): this
	 * 添加一组类型/监听器对，例如 `{click: onClick, mousemove: onMouseMove}`。
	 */
	on: function (types, fn, context) {

		// 类型可以是一个类型/处理器的映射。
		if (typeof types === 'object') {
			for (var type in types) {
				// 为了性能考虑，这里不处理空格分隔的事件；
				// 这是热门路径，因为 图层 使用 `on(obj)` 语法。
				this._on(type, types[type], fn);
			}

		} else {
			// 类型可以是一个空格分隔的单词字符串。
			types = Util.splitWords(types);

			for (var i = 0, len = types.length; i < len; i++) {
				this._on(types[i], fn, context);
			}
		}

		return this;
	},

	/* @method off(type: String, fn?: Function, context?: Object): this
	 * 移除之前添加的监听器函数。如果未指定函数，则将从对象中移除该特定事件的所有监听器。注意，如果您为 `on` 传递了自定义上下文，则必须为 `off` 传递相同的上下文以移除监听器。
	 *
	 * @alternative
	 * @method off(eventMap: Object): this
	 * 移除一组类型/监听器对。
	 *
	 * @alternative
	 * @method off: this
	 * 移除对象上所有事件的所有监听器。这包括隐式附加的事件。
	 */
	off: function (types, fn, context) {

		if (!arguments.length) {
			// 如果没有参数调用，则清除所有监听器。
			delete this._events;

		} else if (typeof types === 'object') {
			for (var type in types) {
				this._off(type, types[type], fn);
			}

		} else {
			types = Util.splitWords(types);

			var removeAll = arguments.length === 1;
			for (var i = 0, len = types.length; i < len; i++) {
				if (removeAll) {
					this._off(types[i]);
				} else {
					this._off(types[i], fn, context);
				}
			}
		}

		return this;
	},

	// 添加监听器（现在没有语法糖）
	_on: function (type, fn, context, _once) {
		if (typeof fn !== 'function') {
			console.warn('wrong listener type: ' + typeof fn);
			return;
		}

		// 检查 `fn` 是否已经存在。
		if (this._listens(type, fn, context) !== false) {
			return;
		}

		if (context === this) {
			// 占用更少的内存。
			context = undefined;
		}

		var newListener = {fn: fn, ctx: context};
		if (_once) {
			newListener.once = true;
		}

		this._events = this._events || {};
		this._events[type] = this._events[type] || [];
		this._events[type].push(newListener);
	},

	_off: function (type, fn, context) {
		var listeners,
		    i,
		    len;

		if (!this._events) {
			return;
		}

		listeners = this._events[type];
		if (!listeners) {
			return;
		}

		if (arguments.length === 1) { // remove all
			if (this._firingCount) {
				// 将所有被移除的监听器设置为 noop。
				// 因此如果在 `fire` 中执行移除操作，它们不会被调用。
				for (i = 0, len = listeners.length; i < len; i++) {
					listeners[i].fn = Util.falseFn;
				}
			}
			// 如果未指定函数，则清除该类型的所有监听器。
			delete this._events[type];
			return;
		}

		if (typeof fn !== 'function') {
			console.warn('wrong listener type: ' + typeof fn);
			return;
		}

		// 找到 `fn` 并移除它。
		var index = this._listens(type, fn, context);
		if (index !== false) {
			var listener = listeners[index];
			if (this._firingCount) {
				// 将被移除的监听器设置为 noop，这样在 `fire` 中执行移除操作时它不会被调用。
				listener.fn = Util.falseFn;

				/* 复制数组，以防事件被触发。
				this._events[type] = listeners = listeners.slice();
			}
			listeners.splice(index, 1);
		}
	},

	// @method fire(type: String, data?: Object, propagate?: Boolean): this
	// 触发指定类型的事件。可以可选提供数据。
	// 对象——监听器函数的第一个参数将包含其属性。该事件可以可选地传播给父事件。
	// `off` 会覆盖 `l.fn`，因此我们需要将 `fn` 复制到一个变量中。
	fire: function (type, data, propagate) {
		if (!this.listens(type, propagate)) { return this; }

		var event = Util.extend({}, data, {
			type: type,
			target: this,
			sourceTarget: data && data.sourceTarget || this
		});

		if (this._events) {
			var listeners = this._events[type];
			if (listeners) {
				this._firingCount = (this._firingCount + 1) || 1;
				for (var i = 0, len = listeners.length; i < len; i++) {
					var l = listeners[i];
					// off overwrites l.fn, so we need to copy fn to a var
					var fn = l.fn;
					if (l.once) {
						this.off(type, fn, l.ctx);
					}
					fn.call(l.ctx || this, event);
				}

				this._firingCount--;
			}
		}

		if (propagate) {
			// 将事件传播给父事件（通过 `addEventParent` 设置）。
			this._propagateEvent(event);
		}

		return this;
	},

	// @method listens(type: String, propagate?: Boolean): Boolean
	// @method listens(type: String, fn: Function, context?: Object, propagate?: Boolean): Boolean
	// 如果特定事件类型有监听器绑定，则返回 `true`。
	// 验证结果可以选择性地传播，如果父对象有监听器绑定，则返回 `true`。
	listens: function (type, fn, context, propagate) {
		if (typeof type !== 'string') {
			console.warn('"string" type argument expected');
		}

		// 我们不会覆盖输入 `fn` 值，因为需要将其用于传播。
		var _fn = fn;
		if (typeof fn !== 'function') {
			propagate = !!fn;
			_fn = undefined;
			context = undefined;
		}

		var listeners = this._events && this._events[type];
		if (listeners && listeners.length) {
			if (this._listens(type, _fn, context) !== false) {
				return true;
			}
		}

		if (propagate) {
			// 如果事件被传播，也会检查父对象是否有监听器。
			for (var id in this._eventParents) {
				if (this._eventParents[id].listens(type, fn, context, propagate)) { return true; }
			}
		}
		return false;
	},

	// 返回索引（数字）或 `false`。
	_listens: function (type, fn, context) {
		if (!this._events) {
			return false;
		}

		var listeners = this._events[type] || [];
		if (!fn) {
			return !!listeners.length;
		}

		if (context === this) {
			// 内存占用更低。
			context = undefined;
		}

		for (var i = 0, len = listeners.length; i < len; i++) {
			if (listeners[i].fn === fn && listeners[i].ctx === context) {
				return i;
			}
		}
		return false;

	},

	// @method once(…): this
	// 行为类似于 [`on(…)`](#evented-on)，但监听器只会触发一次然后被移除。
	once: function (types, fn, context) {

		// 类型可以是一个类型/处理器的映射表。
		if (typeof types === 'object') {
			for (var type in types) {
				// 为了性能考虑，这里不会处理空格分隔的事件。
				// 这是关键路径，因为 图层 使用 `on(obj)` 语法。
				this._on(type, types[type], fn, true);
			}

		} else {
			// 类型可以是一个空格分隔的单词字符串。
			types = Util.splitWords(types);

			for (var i = 0, len = types.length; i < len; i++) {
				this._on(types[i], fn, context, true);
			}
		}

		return this;
	},

	// @method addEventParent(obj: Evented): this
	// 添加事件父对象——一个 `Evented` 对象，用于接收传播的事件。
	addEventParent: function (obj) {
		this._eventParents = this._eventParents || {};
		this._eventParents[Util.stamp(obj)] = obj;
		return this;
	},

	// @method removeEventParent(obj: Evented): this
	// 移除事件父对象，使其停止接收传播的事件。
	removeEventParent: function (obj) {
		if (this._eventParents) {
			delete this._eventParents[Util.stamp(obj)];
		}
		return this;
	},

	_propagateEvent: function (e) {
		for (var id in this._eventParents) {
			this._eventParents[id].fire(e.type, Util.extend({
				layer: e.target,
				propagatedFrom: e.target
			}, e), true);
		}
	}
};

// 别名；最终应该去掉这些别名。

// @method addEventListener(…): this
// 别名为 [`on(…)`](#evented-on)。
Events.addEventListener = Events.on;

// @method removeEventListener(…): this
// 别名为 [`off(…)`](#evented-off)。

// @method clearAllEventListeners(…): this
// 别名为 [`off()`](#evented-off)。
Events.removeEventListener = Events.clearAllEventListeners = Events.off;

// @method addOneTimeEventListener(…): this
// 别名为 [`once(…)`](#evented-once)。
Events.addOneTimeEventListener = Events.once;

// @method fireEvent(…): this
// 别名为 [`fire(…)`](#evented-fire)。
Events.fireEvent = Events.fire;

// @method hasEventListeners(…): Boolean
// 别名为 [`listens(…)`](#evented-listens)。
Events.hasEventListeners = Events.listens;

export var Evented = Class.extend(Events);
