import * as Util from './Util';

// @class Class
// @aka L.Class

// @section
// @uninheritable

// 感谢 John Resig 和 Dean Edwards 的启发！

export function Class() {}

Class.extend = function (props) {

	// @function extend(props: Object): Function
	// [Extends the current class](#class-inheritance) given the properties to be included.
	// 返回一个 JavaScript 函数，该函数是类构造函数（通过 `new` 调用）。
	var NewClass = function () {

		Util.setOptions(this);

		// 调用构造函数
		if (this.initialize) {
			this.initialize.apply(this, arguments);
		}

		// 调用所有构造函数钩子
		this.callInitHooks();
	};

	var parentProto = NewClass.__super__ = this.prototype;

	var proto = Util.create(parentProto);
	proto.constructor = NewClass;

	NewClass.prototype = proto;

	// 继承父类的静态成员
	for (var i in this) {
		if (Object.prototype.hasOwnProperty.call(this, i) && i !== 'prototype' && i !== '__super__') {
			NewClass[i] = this[i];
		}
	}

	// 将静态属性混入类中
	if (props.statics) {
		Util.extend(NewClass, props.statics);
	}

	// 将包含方法混入原型中
	if (props.includes) {
		checkDeprecatedMixinEvents(props.includes);
		Util.extend.apply(null, [proto].concat(props.includes));
	}

	// 将指定属性混入原型中
	Util.extend(proto, props);
	delete proto.statics;
	delete proto.includes;

	// 合并选项
	if (proto.options) {
		proto.options = parentProto.options ? Util.create(parentProto.options) : {};
		Util.extend(proto.options, props.options);
	}

	proto._initHooks = [];

	// 添加用于调用所有钩子的方法
	proto.callInitHooks = function () {

		if (this._initHooksCalled) { return; }

		if (parentProto.callInitHooks) {
			parentProto.callInitHooks.call(this);
		}

		this._initHooksCalled = true;

		for (var i = 0, len = proto._initHooks.length; i < len; i++) {
			proto._initHooks[i].call(this);
		}
	};

	return NewClass;
};


// @function include(properties: Object): this
// [Includes a mixin](#class-includes) into the current class.
Class.include = function (props) {
	var parentOptions = this.prototype.options;
	Util.extend(this.prototype, props);
	if (props.options) {
		this.prototype.options = parentOptions;
		this.mergeOptions(props.options);
	}
	return this;
};

// @function mergeOptions(options: Object): this
// [Merges `options`](#class-options) into the defaults of the class.
Class.mergeOptions = function (options) {
	Util.extend(this.prototype.options, options);
	return this;
};

// @function addInitHook(fn: Function): this
// 为类添加 [构造函数钩子](#class-constructor-hooks)。
Class.addInitHook = function (fn) { // (Function) || (String, args...)
	var args = Array.prototype.slice.call(arguments, 1);

	var init = typeof fn === 'function' ? fn : function () {
		this[fn].apply(this, args);
	};

	this.prototype._initHooks = this.prototype._initHooks || [];
	this.prototype._initHooks.push(init);
	return this;
};

function checkDeprecatedMixinEvents(includes) {
	/* 全局 L: true */
	if (typeof L === 'undefined' || !L || !L.Mixin) { return; }

	includes = Util.isArray(includes) ? includes : [includes];

	for (var i = 0; i < includes.length; i++) {
		if (includes[i] === L.Mixin.Events) {
			console.warn('Deprecated include of L.Mixin.Events: ' +
				'this property will be removed in future releases, ' +
				'please inherit from L.Evented instead.', new Error().stack);
		}
	}
}
