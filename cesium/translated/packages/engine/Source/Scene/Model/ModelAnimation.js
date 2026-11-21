import { Event, JulianDate, defined } from "@cesium/core";
import ModelAnimationLoop from "../ModelAnimationLoop.js";
import ModelAnimationState from "../ModelAnimationState.js";
import ModelAnimationChannel from "./ModelAnimationChannel.js";

/**
 * <div class="notice">
 * 通过调用 {@link ModelAnimationCollection#add} 来创建动画。不要直接调用构造函数。
 * </div>
 *
 * 由 glTF 资源生成的活动动画。活动动画是指
 * 正在播放或因被添加到模型的 {@link ModelAnimationCollection} 而计划播放的动画。活动动画
 * being added to a model's {@link ModelAnimationCollection}. An active animation
 * 是动画的一个实例；例如，同一个 glTF 动画可能有多个活动动画，每个都有不同的开始时间。
 * 当 <code>true</code> 时，动画在停止后会被移除。
 *
 * @alias ModelAnimation
 * @internalConstructor
 * @class
 *
 * @see ModelAnimationCollection#add
 */
function ModelAnimation(model, animation, options) {
  this._animation = animation;
  this._name = animation.name;
  this._runtimeChannels = undefined;

  this._startTime = JulianDate.clone(options.startTime);
  this._delay = options.delay ?? 0.0; // in seconds
  this._stopTime = JulianDate.clone(options.stopTime);

  /**
   * 这样比不移除动画更高效，但如果例如时间被反转，动画就不会再次播放。
   * 此动画开始时会触发事件。这可用于
   * 例如，在动画开始时播放声音或启动粒子系统。
   *
   * @type {boolean}
   * @default false
   */
  this.removeOnStop = options.removeOnStop ?? false;
  this._multiplier = options.multiplier ?? 1.0;
  this._reverse = options.reverse ?? false;
  this._loop = options.loop ?? ModelAnimationLoop.NONE;
  this._animationTime = options.animationTime;
  this._prevAnimationDelta = undefined;

  /**
   * 当此动画启动时触发的事件。这可用于
   * 例如，在动画开始时播放声音或启动粒子系统。
   * <p>
   * 在场景渲染后的帧结束时触发此事件。
   * </p>
   *
   * @type {Event}
   * @default new 事件()
   *
   * @example
   * animation.start.addEventListener(function(model, animation) {
   * console.log(`Animation started: ${animation.name}`);
   * });
   */
  this.start = new Event();

  /**
   * 当此动画更新时，每帧都会触发事件。动画的当前时间相对于 glTF 动画时间跨度被
   * 传递给事件，从而可以例如在相对于正在播放的动画的特定时间开始新的动画。
   * 在场景渲染后的帧结束时触发此事件。
   * 事件()
   * <p>
   * animation.update.addEventListener(function(model, animation, time) {
   * </p>
   *
   * @type {Event}
   * @default new console.log(`Animation updated: ${animation.name}. glTF animation time: ${time}`);
   *
   * @example
   * 当此动画停止时触发事件。这可用于
   * 例如，在动画停止时播放声音或启动粒子系统。
   * });
   */
  this.update = new Event();

  /**
   * 在场景渲染后的帧结束时触发此事件。
   * 事件()
   * <p>
   * animation.stop.addEventListener(function(model, animation) {
   * </p>
   *
   * @type {Event}
   * @default new console.log(`Animation stopped: ${animation.name}`);
   *
   * @example
   * glTF 动画。
   * 如果存在，则用于识别模型中此动画的名称。
   * });
   */
  this.stop = new Event();

  this._state = ModelAnimationState.STOPPED;

  // Set during animation update
  this._computedStartTime = undefined;
  this._duration = undefined;

  // To avoid allocations in ModelAnimationCollection.update
  const that = this;
  this._raiseStartEvent = function () {
    that.start.raiseEvent(model, that);
  };
  this._updateEventTime = 0.0;
  this._raiseUpdateEvent = function () {
    that.update.raiseEvent(model, that, that._updateEventTime);
  };
  this._raiseStopEvent = function () {
    that.stop.raiseEvent(model, that);
  };

  this._model = model;

  this._localStartTime = undefined;
  this._localStopTime = undefined;

  initialize(this);
}

Object.defineProperties(ModelAnimation.prototype, {
  /**
   * 此动画的运行时动画通道。
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {ModelComponents.Animation}
   * @readonly
   *
   * @private
   */
  animation: {
    get: function () {
      return this._animation;
    },
  },

  /**
   * 拥有此动画的 {@link Model}。
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {string}
   * @readonly
   */
  name: {
    get: function () {
      return this._name;
    },
  },

  /**
   * 动画在本地时间中的起始点。这是属于此动画的所有关键帧中的最小时间值。
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {ModelAnimationChannel[]}
   * @readonly
   *
   * @private
   */
  runtimeChannels: {
    get: function () {
      return this._runtimeChannels;
    },
  },

  /**
   * The {@link Model} that owns this animation.
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {Model}
   * @readonly
   *
   * @private
   */
  model: {
    get: function () {
      return this._model;
    },
  },

  /**
   * The starting point of the animation in local animation time. This is the minimum
   * time value across all of the keyframes belonging to this animation.
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  localStartTime: {
    get: function () {
      return this._localStartTime;
    },
  },

  /**
   * 局部动画时间中的动画停止点。这是该动画所有关键帧的最大时间值。
   * 属于该动画的所有关键帧中的最大时间值。
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  localStopTime: {
    get: function () {
      return this._localStopTime;
    },
  },

  /**
   * 开始播放此动画的场景时间。当此值为 <code>undefined</code> 时，
   * 动画从下一帧开始播放。
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {JulianDate}
   * @readonly
   *
   * @default undefined
   */
  startTime: {
    get: function () {
      return this._startTime;
    },
  },

  /**
   * 从 {@link ModelAnimation#startTime} 到开始播放的延迟，以秒为单位。
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {number}
   * @readonly
   *
   * @default undefined
   */
  delay: {
    get: function () {
      return this._delay;
    },
  },

  /**
   * 停止播放此动画的场景时间。当此值为 <code>undefined</code> 时，
   * 动画将完整播放，并可能根据
   * {@link ModelAnimation#loop} 重复播放。
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {JulianDate}
   * @readonly
   *
   * @default undefined
   */
  stopTime: {
    get: function () {
      return this._stopTime;
    },
  },

  /**
   * 大于 <code>1.0</code> 的值会增加动画相对于场景时钟速度的播放速度；小于 <code>1.0</code> 的值会降低速度。值为
   * to the scene clock speed; values less than <code>1.0</code> decrease the speed.  A value of
   * <code>1.0</code> 时，动画以 glTF 动画中映射到的场景时钟速度的速度播放。例如，如果场景以 2 倍实时速度播放，两秒的 glTF 动画
   * clock speed.  For example, if the scene is played at 2x real-time, a two-second glTF animation
   * 将在一秒内播放，即使 <code>multiplier</code> 为 <code>1.0</code>。
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {number}
   * @readonly
   *
   * @default 1.0
   */
  multiplier: {
    get: function () {
      return this._multiplier;
    },
  },

  /**
   * 当 <code>true</code> 时，动画反向播放。
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @default false
   */
  reverse: {
    get: function () {
      return this._reverse;
    },
  },

  /**
   * 决定动画是否以及如何循环播放。
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {ModelAnimationLoop}
   * @readonly
   *
   * @default {@link ModelAnimationLoop.NONE}
   */
  loop: {
    get: function () {
      return this._loop;
    },
  },

  /**
   * 如果定义了此值，它将用于计算局部动画时间
   * 而不是场景时间。
   *
   * @memberof ModelAnimation.prototype
   *
   * @type {ModelAnimation.AnimationTimeCallback}
   * @default undefined
   */
  animationTime: {
    get: function () {
      return this._animationTime;
    },
  },
});

function initialize(runtimeAnimation) {
  let localStartTime = Number.MAX_VALUE;
  let localStopTime = -Number.MAX_VALUE;

  const sceneGraph = runtimeAnimation._model.sceneGraph;
  const animation = runtimeAnimation._animation;
  const channels = animation.channels;
  const length = channels.length;

  const runtimeChannels = [];
  for (let i = 0; i < length; i++) {
    const channel = channels[i];
    const target = channel.target;

    // Ignore this channel if the target is invalid, i.e. if the node
    // it references doesn't exist.
    if (!defined(target)) {
      continue;
    }

    const nodeIndex = target.node.index;
    const runtimeNode = sceneGraph._runtimeNodes[nodeIndex];

    const runtimeChannel = new ModelAnimationChannel({
      channel: channel,
      runtimeAnimation: runtimeAnimation,
      runtimeNode: runtimeNode,
    });

    const times = channel.sampler.input;
    localStartTime = Math.min(localStartTime, times[0]);
    localStopTime = Math.max(localStopTime, times[times.length - 1]);

    runtimeChannels.push(runtimeChannel);
  }

  runtimeAnimation._runtimeChannels = runtimeChannels;
  runtimeAnimation._localStartTime = localStartTime;
  runtimeAnimation._localStopTime = localStopTime;
}

/**
 * 评估所有动画通道以推进此动画。
 *
 * @param {number} time 局部动画时间。
 *
 * @private
 */
ModelAnimation.prototype.animate = function (time) {
  const runtimeChannels = this._runtimeChannels;
  const length = runtimeChannels.length;
  for (let i = 0; i < length; i++) {
    runtimeChannels[i].animate(time);
  }
};

/**
 * 用于计算 ModelAnimation 的局部动画时间的函数。
 * @callback ModelAnimation.AnimationTimeCallback
 *
 * @param {number} duration 动画的原始持续时间，以秒为单位。
 * @param {number} seconds 自动画开始以来的秒数，以场景时间为单位。
 * @returns {number} Returns 局部动画时间。
 *
 * @example
 * // 使用实时时间进行模型动画（假设 animateWhilePaused 设置为 true）
 * function animationTime(duration) {
 * return Date.now() / 1000 / duration;
 * }
 *
 * @example
 * // 偏移动画相位，使其在周期中间开始。
 * function animationTime(duration, seconds) {
 * return seconds / duration + 0.5;
 * }
 */
export default ModelAnimation;