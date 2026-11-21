import {
  DeveloperError,
  Frozen,
  TimeConstants,
  clone,
  defined,
  getTimestamp,
} from "@cesium/core";
import EasingFunction from "../Core/EasingFunction.js";
import { Tween as TweenJS } from "@tweenjs/tween.js";

/**
 * 动画过渡是一种使用 {@link EasingFunction} 插值两个对象属性的动画。通过
 * 使用 {@link Scene#tweens} 和 {@link TweenCollection#add} 及相关添加函数来创建。
 *
 * @alias Tween
 * @constructor
 *
 * @private
 */
function Tween(
  tweens,
  tweenjs,
  startObject,
  stopObject,
  duration,
  delay,
  easingFunction,
  update,
  complete,
  cancel,
) {
  this._tweens = tweens;
  this._tweenjs = tweenjs;

  this._startObject = clone(startObject);
  this._stopObject = clone(stopObject);

  this._duration = duration;
  this._delay = delay;
  this._easingFunction = easingFunction;

  this._update = update;
  this._complete = complete;

  /**
   * 如果动画过渡被取消，可以调用此回调，原因可能是调用了 {@link Tween#cancelTween}
   * 或动画过渡从集合中移除。
   *
   * @type {TweenCollection.TweenCancelledCallback}
   */
  this.cancel = cancel;

  /**
   * @private
   */
  this.needsStart = true;
}

Object.defineProperties(Tween.prototype, {
  /**
   * 包含动画过渡初始值的属性对象。该对象的属性在动画过程中会发生变化。
   * @memberof Tween.prototype
   *
   * @type {object}
   * @readonly
   */
  startObject: {
    get: function () {
      return this._startObject;
    },
  },

  /**
   * 包含动画过渡最终值的属性对象。
   * @memberof Tween.prototype
   *
   * @type {object}
   * @readonly
   */
  stopObject: {
    get: function () {
      return this._stopObject;
    },
  },

  /**
   * 动画过渡的持续时间，以秒为单位。当动画停止时，动画过渡会自动从集合中移除。
   * @memberof Tween.prototype
   *
   * @type {number}
   * @readonly
   */
  duration: {
    get: function () {
      return this._duration;
    },
  },

  /**
   * 动画开始之前所需的延迟时间，以秒为单位。
   * @memberof Tween.prototype
   *
   * @type {number}
   * @readonly
   */
  delay: {
    get: function () {
      return this._delay;
    },
  },

  /**
   * 决定动画的曲线。
   * @memberof Tween.prototype
   *
   * @type {EasingFunction}
   * @readonly
   */
  easingFunction: {
    get: function () {
      return this._easingFunction;
    },
  },

  /**
   * 在每次动画更新时调用的回调（通常与渲染帧相关）。
   * @memberof Tween.prototype
   *
   * @type {TweenCollection.TweenUpdateCallback}
   * @readonly
   */
  update: {
    get: function () {
      return this._update;
    },
  },

  /**
   * 动画过渡完成时的回调。
   * @memberof Tween.prototype
   *
   * @type {TweenCollection.TweenCompleteCallback}
   * @readonly
   */
  complete: {
    get: function () {
      return this._complete;
    },
  },

  /**
   * @memberof Tween.prototype
   *
   * @private
   */
  tweenjs: {
    get: function () {
      return this._tweenjs;
    },
  },
});

/**
 * 如果存在 {@link Tween#cancel} 回调，则调用该回调来取消动画过渡。此操作
 * 如果动画过渡已完成或已被取消，则无效。
 */
Tween.prototype.cancelTween = function () {
  this._tweens.remove(this);
};

/**
 * 用于动画化属性的动画过渡集合。通常通过 {@link Scene#tweens} 访问。
 *
 * @alias TweenCollection
 * @constructor
 *
 * @private
 */
function TweenCollection() {
  this._tweens = [];
}

Object.defineProperties(TweenCollection.prototype, {
  /**
   * 集合中动画过渡的数量。
   * @memberof TweenCollection.prototype
   *
   * @type {number}
   * @readonly
   */
  length: {
    get: function () {
      return this._tweens.length;
    },
  },
});

/**
 * 创建用于在两个属性集之间动画化的过渡。该过渡在下次调用 {@link TweenCollection#update} 时开始动画。
 * 当 {@link Viewer} 或 {@link CesiumWidget} 渲染场景时，此行为是隐式的。
 *
 * @param {object} [options] 包含以下属性的对象：
 * @param {object} options.startObject 包含动画过渡初始值的属性对象。该对象的属性在动画过程中会发生变化。
 * @param {object} options.stopObject 包含动画过渡最终值的属性对象。
 * @param {number} options.duration 动画过渡的持续时间，以秒为单位。当动画停止时，动画过渡会自动从集合中移除。
 * @param {number} [options.delay=0.0] 动画开始之前所需的延迟时间，以秒为单位。
 * @param {EasingFunction} [options.easingFunction=EasingFunction.LINEAR_NONE] 决定动画的曲线。
 * @param {TweenCollection.TweenUpdateCallback} [options.update] 在每次动画更新时调用的回调（通常与渲染帧相关）。
 * @param {TweenCollection.TweenCompleteCallback} [options.complete] 动画过渡完成时的回调。
 * @param {TweenCollection.TweenCancelledCallback} [options.cancel] 如果动画过渡被取消，原因可能是调用了 {@link Tween#cancelTween} 或从集合中移除，则调用此回调。
 * @returns {Tween} The 动画过渡。
 *
 * @exception {DeveloperError} options.duration 必须为正数。
 */
TweenCollection.prototype.add = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(options.startObject) || !defined(options.stopObject)) {
    throw new DeveloperError(
      "options.startObject and options.stopObject are required.",
    );
  }

  if (!defined(options.duration) || options.duration < 0.0) {
    throw new DeveloperError(
      "options.duration is required and must be positive.",
    );
  }
  //>>includeEnd('debug');

  if (options.duration === 0.0) {
    if (defined(options.complete)) {
      options.complete();
    }
    return new Tween(this);
  }

  const duration = options.duration / TimeConstants.SECONDS_PER_MILLISECOND;
  const delayInSeconds = options.delay ?? 0.0;
  const delay = delayInSeconds / TimeConstants.SECONDS_PER_MILLISECOND;
  const easingFunction = options.easingFunction ?? EasingFunction.LINEAR_NONE;

  const value = options.startObject;
  const tweenjs = new TweenJS(value);
  tweenjs.to(clone(options.stopObject), duration);
  tweenjs.delay(delay);
  tweenjs.easing(easingFunction);
  if (defined(options.update)) {
    tweenjs.onUpdate(function () {
      options.update(value);
    });
  }
  tweenjs.onComplete(options.complete ?? null);
  tweenjs.repeat(options._repeat ?? 0.0);

  const tween = new Tween(
    this,
    tweenjs,
    options.startObject,
    options.stopObject,
    options.duration,
    delayInSeconds,
    easingFunction,
    options.update,
    options.complete,
    options.cancel,
  );
  this._tweens.push(tween);
  return tween;
};

/**
 * 创建用于动画化给定对象上标量属性的过渡。该过渡在下次调用 {@link TweenCollection#update} 时开始动画。
 * 当 {@link Viewer} 或 {@link CesiumWidget} 渲染场景时，此属性为隐式状态。
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {object} options.object 包含需要动画化的属性的对象。
 * @param {string} options.property 需要动画化的属性名称。
 * @param {number} options.startValue 初始值。
 * @param {number} options.stopValue 最终值。
 * @param {number} [options.duration=3.0] 过渡的持续时间，以秒为单位。当过渡停止时，该过渡会自动从集合中移除。
 * @param {number} [options.delay=0.0] 过渡开始动画化的延迟时间，以秒为单位。
 * @param {EasingFunction} [options.easingFunction=EasingFunction.LINEAR_NONE] 决定动画的曲线。
 * @param {TweenCollection.TweenUpdateCallback} [options.update] 每次动画更新时调用的回调（通常与渲染帧相关）。
 * @param {TweenCollection.TweenCompleteCallback} [options.complete] 过渡完成动画化后调用的回调。
 * @param {TweenCollection.TweenCancelledCallback} [options.cancel] 如果由于 {@link Tween#cancelTween} 被调用或过渡从集合中移除而取消，则调用此回调。
 * @returns {Tween} The 过渡。
 *
 * @exception {DeveloperError} options.object 必须具有指定的属性。
 * @exception {DeveloperError} options.duration 必须为正数。
 */
TweenCollection.prototype.addProperty = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const object = options.object;
  const property = options.property;
  const startValue = options.startValue;
  const stopValue = options.stopValue;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(object) || !defined(options.property)) {
    throw new DeveloperError(
      "options.object and options.property are required.",
    );
  }
  if (!defined(object[property])) {
    throw new DeveloperError(
      "options.object must have the specified property.",
    );
  }
  if (!defined(startValue) || !defined(stopValue)) {
    throw new DeveloperError(
      "options.startValue and options.stopValue are required.",
    );
  }
  //>>includeEnd('debug');

  function update(value) {
    object[property] = value.value;
  }

  return this.add({
    startObject: {
      value: startValue,
    },
    stopObject: {
      value: stopValue,
    },
    duration: options.duration ?? 3.0,
    delay: options.delay,
    easingFunction: options.easingFunction,
    update: update,
    complete: options.complete,
    cancel: options.cancel,
    _repeat: options._repeat,
  });
};

/**
 * 创建一个过渡，用于动画化 {@link Material} 上所有颜色统一体的 alpha 值。该过渡在下次调用 {@link TweenCollection#update} 时开始动画化。
 * 当 {@link Viewer} 或 {@link CesiumWidget} 渲染场景时，此属性为隐式状态。
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Material} options.material 需要动画化的材质。
 * @param {number} [options.startValue=0.0] 初始 alpha 值。
 * @param {number} [options.stopValue=1.0] 最终 alpha 值。
 * @param {number} [options.duration=3.0] 过渡的持续时间，以秒为单位。当过渡停止时，该过渡会自动从集合中移除。
 * @param {number} [options.delay=0.0] 过渡开始动画化的延迟时间，以秒为单位。
 * @param {EasingFunction} [options.easingFunction=EasingFunction.LINEAR_NONE] 决定动画的曲线。
 * @param {TweenCollection.TweenUpdateCallback} [options.update] 每次动画更新时调用的回调（通常与渲染帧相关）。
 * @param {TweenCollection.TweenCompleteCallback} [options.complete] 过渡完成动画化后调用的回调。
 * @param {TweenCollection.TweenCancelledCallback} [options.cancel] 如果由于 {@link Tween#cancelTween} 被调用或过渡从集合中移除而取消，则调用此回调。
 * @returns {Tween} The 过渡。
 *
 * @exception {DeveloperError} material 没有包含 alpha 属性的属性。
 * @exception {DeveloperError} options.duration 必须为正数。
 */
TweenCollection.prototype.addAlpha = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const material = options.material;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(material)) {
    throw new DeveloperError("options.material is required.");
  }
  //>>includeEnd('debug');

  const properties = [];

  for (const property in material.uniforms) {
    if (
      material.uniforms.hasOwnProperty(property) &&
      defined(material.uniforms[property]) &&
      defined(material.uniforms[property].alpha)
    ) {
      properties.push(property);
    }
  }

  //>>includeStart('debug', pragmas.debug);
  if (properties.length === 0) {
    throw new DeveloperError(
      "material has no properties with alpha components.",
    );
  }
  //>>includeEnd('debug');

  function update(value) {
    const length = properties.length;
    for (let i = 0; i < length; ++i) {
      material.uniforms[properties[i]].alpha = value.alpha;
    }
  }

  return this.add({
    startObject: {
      alpha: options.startValue ?? 0.0, // Default to fade in
    },
    stopObject: {
      alpha: options.stopValue ?? 1.0,
    },
    duration: options.duration ?? 3.0,
    delay: options.delay,
    easingFunction: options.easingFunction,
    update: update,
    complete: options.complete,
    cancel: options.cancel,
  });
};

/**
 * 创建一个过渡，用于动画化 {@link Material} 的偏移统一体。该过渡在下次调用 {@link TweenCollection#update} 时开始动画化。
 * 当 {@link Viewer} 或 {@link CesiumWidget} 渲染场景时，此属性为隐式状态。
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {Material} options.material 需要动画化的材质。
 * @param {number} options.startValue 初始 alpha 值。
 * @param {number} options.stopValue 最终 alpha 值。
 * @param {number} [options.duration=3.0] 过渡的持续时间，以秒为单位。当过渡停止时，该过渡会自动从集合中移除。
 * @param {number} [options.delay=0.0] 过渡开始动画化的延迟时间，以秒为单位。
 * @param {EasingFunction} [options.easingFunction=EasingFunction.LINEAR_NONE] 决定动画的曲线。
 * @param {TweenCollection.TweenUpdateCallback} [options.update] 在每次动画更新时调用的回调（通常与渲染帧相关）。
 * @param {TweenCollection.TweenCancelledCallback} [options.cancel] 如果过渡被取消，无论是通过调用 {@link Tween#cancelTween} 还是从集合中移除该过渡，则调用此回调。
 * @returns {Tween} The 过渡。
 *
 * @exception {DeveloperError} material.uniforms 必须具有 offset 属性。
 * @exception {DeveloperError} options.duration 必须为正数。
 */
TweenCollection.prototype.addOffsetIncrement = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const material = options.material;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(material)) {
    throw new DeveloperError("material is required.");
  }
  if (!defined(material.uniforms.offset)) {
    throw new DeveloperError("material.uniforms must have an offset property.");
  }
  //>>includeEnd('debug');

  const uniforms = material.uniforms;
  return this.addProperty({
    object: uniforms,
    property: "offset",
    startValue: uniforms.offset,
    stopValue: uniforms.offset + 1,
    duration: options.duration,
    delay: options.delay,
    easingFunction: options.easingFunction,
    update: options.update,
    cancel: options.cancel,
    _repeat: Infinity,
  });
};

/**
 * 从集合中移除一个过渡。
 * <p>
 * 如果过渡有 {@link Tween#cancel} 回调，则调用该回调。
 * </p>
 *
 * @param {Tween} tween 要移除的过渡。
 * @returns {boolean} <code>true</code> 如果过渡被移除，返回 <code>true</code>；如果未在集合中找到过渡，返回 <code>false</code>。
 */
TweenCollection.prototype.remove = function (tween) {
  if (!defined(tween)) {
    return false;
  }

  const index = this._tweens.indexOf(tween);
  if (index !== -1) {
    tween.tweenjs.stop();
    if (defined(tween.cancel)) {
      tween.cancel();
    }
    this._tweens.splice(index, 1);
    return true;
  }

  return false;
};

/**
 * 从集合中移除所有过渡。
 * <p>
 * 对于具有 {@link Tween#cancel} 回调的每个过渡，调用该回调。
 * </p>
 */
TweenCollection.prototype.removeAll = function () {
  const tweens = this._tweens;

  for (let i = 0; i < tweens.length; ++i) {
    const tween = tweens[i];
    tween.tweenjs.stop();
    if (defined(tween.cancel)) {
      tween.cancel();
    }
  }
  tweens.length = 0;
};

/**
 * 判断此集合是否包含指定的过渡。
 *
 * @param {Tween} tween 要检查的过渡。
 * @returns {boolean} <code>true</code> 如果此集合包含该过渡，返回 <code>true</code>，否则返回 <code>false</code>。
 */
TweenCollection.prototype.contains = function (tween) {
  return defined(tween) && this._tweens.indexOf(tween) !== -1;
};

/**
 * 返回集合中指定索引处的过渡。索引从零开始，随着过渡的添加而递增。移除一个过渡会将其后的所有过渡向左移动，并改变它们的索引。此函数常用于遍历集合中的所有过渡。
 * 过渡的零基索引。
 * 指定索引处的过渡。
 * // 输出集合中所有过渡的持续时间。
 *
 * @param {number} index const tweens = scene.tweens;
 * @returns {Tween} The const length = tweens.length;
 *
 * @example
 * for (let i = 0; i < length; ++i) {
 * console.log(tweens.get(i).duration);
 * 将集合中的过渡更新到指定时间。当过渡完成时，它从集合中移除。
 * 以秒为单位的时间。默认情况下，过渡与系统时钟同步。
 * 当过渡完成时执行的函数。
 * }
 */
TweenCollection.prototype.get = function (index) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(index)) {
    throw new DeveloperError("index is required.");
  }
  //>>includeEnd('debug');

  return this._tweens[index];
};

/**
 * 当过渡更新时执行的函数。
 * 当过渡被取消时执行的函数。
 *
 * @param {number} [time=getTimestamp()] The time in seconds.  By default tweens are synced to the system clock.
 */
TweenCollection.prototype.update = function (time) {
  const tweens = this._tweens;

  let i = 0;
  time = defined(time)
    ? time / TimeConstants.SECONDS_PER_MILLISECOND
    : getTimestamp();
  while (i < tweens.length) {
    const tween = tweens[i];
    const tweenjs = tween.tweenjs;

    if (tween.needsStart) {
      tween.needsStart = false;
      tweenjs.start(time);
    } else if (tweenjs.update(time)) {
      i++;
    } else {
      // there's a chance that the update callback has side effects that clear the list of tweens and/or adds new tweens
      // if it's the case that the update callback 1) clears all tweens held in the scene, then 2) adds new tweens
      // the splice operation below will not be operating on the original tween, but one of the unprocessed tweens added
      // from the update callback
      if (tweens[i]?.needsStart) {
        continue;
      }
      tweenjs.stop();
      tweens.splice(i, 1);
    }
  }
};

/**
 * A function that will execute when a tween completes.
 * @callback TweenCollection.TweenCompleteCallback
 */

/**
 * A function that will execute when a tween updates.
 * @callback TweenCollection.TweenUpdateCallback
 */

/**
 * A function that will execute when a tween is cancelled.
 * @callback TweenCollection.TweenCancelledCallback
 */
export default TweenCollection;
