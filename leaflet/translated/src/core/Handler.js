import {Class} from './Class';

/*
	L.Handler is a base class for handler classes that are used internally to inject
	interaction features like dragging to classes like Map and Marker.
*/

// @class Handler
// @aka L.Handler
// 地图交互处理器的抽象类

export var Handler = Class.extend({
	initialize: function (map) {
		this._map = map;
	},

	// @method enable(): this
	// 启用处理器
	enable: function () {
		if (this._enabled) { return this; }

		this._enabled = true;
		this.addHooks();
		return this;
	},

	// @method disable(): this
	// 禁用处理器
	disable: function () {
		if (!this._enabled) { return this; }

		this._enabled = false;
		this.removeHooks();
		return this;
	},

	// @method enabled(): Boolean
	// 如果处理器被启用，则返回 `true`
	enabled: function () {
		return !!this._enabled;
	}

	// @section Extension methods
	// 从 `Handler` 继承的类必须实现以下两个方法：
	// @method addHooks()
	// 当处理器被启用时调用，应添加事件钩子。
	// @method removeHooks()
	// 当处理器被禁用时调用，应移除之前添加的事件钩子。
});

// @section There is static function which can be called without instantiating L.Handler:
// @function addTo(map: Map, name: String): this
// 将新的处理器添加到具有给定名称的地图中。
Handler.addTo = function (map, name) {
	map.addHandler(name, this);
	return this;
};
