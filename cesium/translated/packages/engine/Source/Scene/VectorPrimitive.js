// @ts-check

import { Check, DeveloperError, destroyObject } from "@cesium/core";
import BufferPrimitiveCollection from "./BufferPrimitiveCollection.js";

/** @import FrameState from "./FrameState.js"; */
/** @import BufferPrimitive from "./BufferPrimitive.js"; */

/**
 * @typedef {object} VectorPrimitiveOptions
 * @property {BufferPrimitiveCollection<BufferPrimitive>} collection 由向量控件绘制的原始元素。
 * @property {boolean} [show=true] 是否绘制该向量控件。
 * @experimental This 此特性尚未确定，可能根据 Cesium 的标准弃用政策发生变化。
 */

/**
 * 以特定样式绘制 {@link BufferPrimitiveCollection} 中的原始元素。
 * 由向量控件控制。多个向量控件可以绘制相同的集合。当原始元素被添加到集合中时，它们会被绘制。
 * collection. Vector primitives are drawn when added to
 * {@link Scene#primitives}。
 *
 * @abstract
 * @experimental This 此特性尚未确定，可能根据 Cesium 的标准弃用政策发生变化。
 *
 * @see CircleVectorPrimitive
 */
class VectorPrimitive {
  /**
   * @param {VectorPrimitiveOptions} options
   */
  constructor(options) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.object("options", options);
    Check.typeOf.object("options.collection", options.collection);
    //>>includeEnd('debug');

    /**
     * @type {BufferPrimitiveCollection<BufferPrimitive>}
     * @protected
     * @ignore
     */
    this._collection = options.collection;

    /**
     * 是否绘制该向量控件。
     * @type {boolean}
     * @default true
     */
    this.show = options.show ?? true;

    /**
     * @type {{destroy: Function}|undefined}
     * @protected
     * @ignore
     */
    this._renderContext = undefined;

    /**
     * 视觉属性，每个属性值或每个原始元素的回调函数。
     * @type {Record<string, *>}
     * @protected
     * @ignore
     */
    this._style = {};

    /**
     * @type {boolean}
     * @ignore
     */
    this._hasStyleCallbacks = false;

    /**
     * 每当视觉属性改变时增加计数；渲染器会将其与之前的值进行比较。
     * 决定何时重新评估每个原始元素的回调函数。
     * @type {number}
     * @ignore
     */
    this._styleVersion = 0;
  }

  /**
   * 由向量控件绘制的原始元素。向量控件并不拥有该集合；销毁集合不会破坏其完整性。
   * own the collection; destroying it leaves the collection intact.
   *
   * @type {BufferPrimitiveCollection<BufferPrimitive>}
   * @readonly
   */
  get collection() {
    return this._collection;
  }

  /**
   * 将视觉属性标记为“脏”，因此会重新评估每个原始元素的回调函数。
   * 在下一帧时再次评估。否则，回调函数仅在原始元素发生变化或属性被设置时评估。因此在回调读取的数据发生变化后调用此函数。
   * 如果原始元素发生变化或属性被赋值，则调用此函数。
   * 返回原始元素的视觉属性值，如果是回调函数则调用它。
   */
  makeStyleDirty() {
    this._styleVersion++;
  }

  /**
   * @param {string} name
   * @returns {*}
   * @protected
   * @ignore
   */
  _getStyle(name) {
    return this._style[name];
  }

  /**
   * @param {string} name
   * @param {*} value
   * @protected
   * @ignore
   */
  _setStyle(name, value) {
    this._style[name] = value;
    this._hasStyleCallbacks = Object.values(this._style).some(
      (styleValue) => typeof styleValue === "function",
    );
    this._styleVersion++;
  }

  /**
   * 绘制集合，并在下一次调用时返回渲染上下文。
   * 如果此对象被销毁，则返回 true；否则返回 false。
   *
   * @param {*} value
   * @param {BufferPrimitive} primitive
   * @returns {*}
   * @protected
   * @ignore
   */
  static _evaluate(value, primitive) {
    return typeof value === "function" ? value(primitive) : value;
  }

  /**
   * @param {FrameState} frameState
   * @ignore
   */
  update(frameState) {
    const passes = frameState.passes;
    if (!this.show || !(passes.render || passes.pick)) {
      return;
    }

    // Updates bounds and pick ids without drawing the collection itself.
    BufferPrimitiveCollection.prototype.update.call(
      this._collection,
      frameState,
    );

    this._renderContext = this._render(frameState, this._renderContext);
  }

  /**
   * 绘制集合，并在下一次调用时返回渲染上下文。
   *
   * @param {FrameState} frameState
   * @param {*} renderContext
   * @returns {*}
   * @protected
   * @abstract
   * @ignore
   */
  _render(frameState, renderContext) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 如果此对象被销毁，则返回 true；否则返回 false。
   *
   * @returns {boolean} True if this object was destroyed; otherwise, false.
   */
  isDestroyed() {
    return false;
  }

  /**
   * 销毁向量控件的 GPU 资源。集合本身不会被销毁。
   * 被销毁。
   */
  destroy() {
    this._renderContext?.destroy();
    this._renderContext = undefined;
    return destroyObject(this);
  }
}

export default VectorPrimitive;
