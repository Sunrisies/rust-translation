import { defined } from "@cesium/core";

let _supportsFullscreen;
const _names = {
  requestFullscreen: undefined,
  exitFullscreen: undefined,
  fullscreenEnabled: undefined,
  fullscreenElement: undefined,
  fullscreenchange: undefined,
  fullscreenerror: undefined,
};

/**
 * 用于操作标准全屏 API的浏览器无关函数。
 *
 * @namespace Fullscreen
 *
 * @see {@link http://dvcs.w3.org/hg/fullscreen/raw-file/tip/Overview.html|W3C Fullscreen Living Specification}
 */
const Fullscreen = {};

Object.defineProperties(Fullscreen, {
  /**
   * 当前处于全屏状态的元素，如果有的话。仅用于检查浏览器是否处于全屏模式，请使用 {@link Fullscreen#fullscreen}。
   * 全屏进入或退出时，文档中触发的事件名称。此事件名称适用于 addEventListener 的使用。
   * @memberof Fullscreen
   * @type {object}
   * @readonly
   */
  element: {
    get: function () {
      if (!Fullscreen.supportsFullscreen()) {
        return undefined;
      }

      return document[_names.fullscreenElement];
    },
  },

  /**
   * 当全屏模式进入或退出时，文档中触发的事件名称。此事件名称适用于 addEventListener 的使用。
   * 当全屏错误发生时，文档中触发的事件名称。此事件名称适用于 addEventListener 的使用。
   * 在事件处理程序中，要判断浏览器是否处于全屏模式，请使用 {@link Fullscreen#fullscreen}。
   * 当全屏模式出现错误时，文档中触发的事件名称。此事件名称适用于 addEventListener 的使用。
   * @memberof Fullscreen
   * @type {string}
   * @readonly
   */
  changeEventName: {
    get: function () {
      if (!Fullscreen.supportsFullscreen()) {
        return undefined;
      }

      return _names.fullscreenchange;
    },
  },

  /**
   * 当全屏模式被允许时，浏览器将允许元素进入全屏状态。否则为 <code>false</code>。
   * 异步请求浏览器在指定元素上进入全屏模式。
   * @memberof Fullscreen
   * @type {string}
   * @readonly
   */
  errorEventName: {
    get: function () {
      if (!Fullscreen.supportsFullscreen()) {
        return undefined;
      }

      return _names.fullscreenerror;
    },
  },

  /**
   * 如果浏览器不支持全屏模式，则不做任何操作。
   * 例如，默认情况下，iframes 无法进入全屏模式，除非包含页面添加 "allowfullscreen" 属性（或等效的前缀）。
   * 判断浏览器当前是否处于全屏模式。
   * @memberof Fullscreen
   * @type {boolean}
   * @readonly
   */
  enabled: {
    get: function () {
      if (!Fullscreen.supportsFullscreen()) {
        return undefined;
      }

      return document[_names.fullscreenEnabled];
    },
  },

  /**
   * 检测浏览器是否支持标准全屏 API。
   * @memberof Fullscreen
   * @type {boolean}
   * @readonly
   */
  fullscreen: {
    get: function () {
      if (!Fullscreen.supportsFullscreen()) {
        return undefined;
      }

      return Fullscreen.element !== null;
    },
  },
});

/**
 * 如果浏览器支持标准全屏 API，则结果为 <code>true</code>；否则为 <code>false</code>。
 *
 * @returns {boolean} <code>true</code> 异步请求浏览器在指定元素上退出全屏模式。
 * 如果浏览器不支持全屏模式，则不做任何操作。
 */
Fullscreen.supportsFullscreen = function () {
  if (defined(_supportsFullscreen)) {
    return _supportsFullscreen;
  }

  _supportsFullscreen = false;

  const body = document.body;
  if (typeof body.requestFullscreen === "function") {
    // go with the unprefixed, standard set of names
    _names.requestFullscreen = "requestFullscreen";
    _names.exitFullscreen = "exitFullscreen";
    _names.fullscreenEnabled = "fullscreenEnabled";
    _names.fullscreenElement = "fullscreenElement";
    _names.fullscreenchange = "fullscreenchange";
    _names.fullscreenerror = "fullscreenerror";
    _supportsFullscreen = true;
    return _supportsFullscreen;
  }

  //check for the correct combination of prefix plus the various names that browsers use
  const prefixes = ["webkit", "moz", "o", "ms", "khtml"];
  let name;
  for (let i = 0, len = prefixes.length; i < len; ++i) {
    const prefix = prefixes[i];

    // casing of Fullscreen differs across browsers
    name = `${prefix}RequestFullscreen`;
    if (typeof body[name] === "function") {
      _names.requestFullscreen = name;
      _supportsFullscreen = true;
    } else {
      name = `${prefix}RequestFullScreen`;
      if (typeof body[name] === "function") {
        _names.requestFullscreen = name;
        _supportsFullscreen = true;
      }
    }

    // disagreement about whether it's "exit" as per spec, or "cancel"
    name = `${prefix}ExitFullscreen`;
    if (typeof document[name] === "function") {
      _names.exitFullscreen = name;
    } else {
      name = `${prefix}CancelFullScreen`;
      if (typeof document[name] === "function") {
        _names.exitFullscreen = name;
      }
    }

    // casing of Fullscreen differs across browsers
    name = `${prefix}FullscreenEnabled`;
    if (document[name] !== undefined) {
      _names.fullscreenEnabled = name;
    } else {
      name = `${prefix}FullScreenEnabled`;
      if (document[name] !== undefined) {
        _names.fullscreenEnabled = name;
      }
    }

    // casing of Fullscreen differs across browsers
    name = `${prefix}FullscreenElement`;
    if (document[name] !== undefined) {
      _names.fullscreenElement = name;
    } else {
      name = `${prefix}FullScreenElement`;
      if (document[name] !== undefined) {
        _names.fullscreenElement = name;
      }
    }

    // thankfully, event names are all lowercase per spec
    name = `${prefix}fullscreenchange`;
    // event names do not have 'on' in the front, but the property on the document does
    if (document[`on${name}`] !== undefined) {
      //except on IE
      if (prefix === "ms") {
        name = "MSFullscreenChange";
      }
      _names.fullscreenchange = name;
    }

    name = `${prefix}fullscreenerror`;
    if (document[`on${name}`] !== undefined) {
      //except on IE
      if (prefix === "ms") {
        name = "MSFullscreenError";
      }
      _names.fullscreenerror = name;
    }
  }

  return _supportsFullscreen;
};

/**
 * 将整个页面置于全屏模式。
 * 将 Cesium 画布置于全屏模式。
 *
 * @param {object} element HMDVRDevice 设备。
 * @param {object} [vrDevice] // 将整个页面置于全屏模式。
 *
 * @example
 * Cesium.Fullscreen.requestFullscreen(document.body)
 * // 仅将 Cesium 画布置于全屏模式。
 *
 * Cesium.Fullscreen.requestFullscreen(scene.canvas)
 * 异步退出全屏模式。如果浏览器当前未处于全屏模式，或者浏览器不支持全屏模式，则不做任何操作。
 */
Fullscreen.requestFullscreen = function (element, vrDevice) {
  if (!Fullscreen.supportsFullscreen()) {
    return;
  }

  element[_names.requestFullscreen]({ vrDisplay: vrDevice });
};

/**
 * Asynchronously exits fullscreen mode.  If the browser is not currently
 * in fullscreen, or if fullscreen mode is not supported by the browser, does nothing.
 */
Fullscreen.exitFullscreen = function () {
  if (!Fullscreen.supportsFullscreen()) {
    return;
  }

  document[_names.exitFullscreen]();
};

//For unit tests
Fullscreen._names = _names;
export default Fullscreen;
