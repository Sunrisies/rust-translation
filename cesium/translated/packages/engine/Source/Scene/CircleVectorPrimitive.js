// @ts-check

import { Color } from "@cesium/core";
import VectorPrimitive from "./VectorPrimitive.js";
import BlendOption from "./BlendOption.js";
import renderBufferPointCollection from "./renderBufferPointCollection.js";

/** @import FrameState from "./FrameState.js"; */
/** @import BufferPoint from "./BufferPoint.js"; */
/** @import BufferPointCollection from "./BufferPointCollection.js"; */
/** @import { BufferPointStyleResult } from "./renderBufferPointCollection.js"; */

/**
 * @typedef {object} CircleVectorPrimitiveOptions
 * @property {BufferPointCollection} collection 由向量基本体绘制的点。
 * @property {number|function(BufferPoint): number} [radius=5.0] 每个圆的半径，以像素为单位。
 * @property {Color|function(BufferPoint): Color} [color=Color.WHITE] 每个圆的填充颜色。
 * @property {Color|function(BufferPoint): Color} [outlineColor=Color.BLACK] 每个圆的轮廓颜色。
 * @property {number|function(BufferPoint): number} [outlineWidth=0.0] 每个圆的轮廓宽度，以像素为单位。
 * @property {function(BufferPoint): boolean} [filter] 是否绘制每个点。通过 {@link BufferPrimitive#show} 隐藏的点不会被绘制。
 * @property {BlendOption} [blendOption=BlendOption.TRANSLUCENT] 决定圆如何与场景融合。必须为 {@link BlendOption.OPAQUE} 或 {@link BlendOption.TRANSLUCENT}。
 * @property {boolean} [show=true] 向量基本体是否被绘制。
 * @experimental This 此特性尚未定稿，可能会根据 Cesium 的标准弃用政策发生变化。
 */

/**
 * 将 {@link BufferPointCollection} 中的点绘制为屏幕空间中的圆，具有填充色和轮廓。
 * 每个视觉属性要么为每个点提供一个值，要么是一个回调，
 *
 * 返回给定点的具体值。传递给回调的点在多次调用中会被重复使用，且不应被保留。回调在以下情况下执行：
 * 当添加或更改点时，或者当分配某个属性时，结果会被缓存；修改数据后需调用 {@link VectorPrimitive#makeStyleDirty}。
 * 当任何属性是回调时，其他值也会被缓存，因此像 <code>primitive.color.alpha = 0.5</code> 这样的就地更改也需要调用 {@link VectorPrimitive#makeStyleDirty}。
 * const collection = new Cesium.BufferPointCollection();
 * are cached; call {@link VectorPrimitive#makeStyleDirty} after changing data that
 * viewer.scene.primitives.add(
 * new Cesium.CircleVectorPrimitive({
 * require {@link VectorPrimitive#makeStyleDirty}.</p>
 *
 * @example
 * radius: 8,
 * color: Cesium.Color.ORANGE,
 *
 * outlineColor: Cesium.Color.WHITE,
 * outlineWidth: 2,
 * const properties = [{ population: 12000 }, { population: 450000 }];
 * viewer.scene.primitives.add(
 * new Cesium.CircleVectorPrimitive({
 * collection,
 * radius: (point) => Math.sqrt(properties[point.featureId].population) / 50,
 *   }),
 * );
 *
 * @example
 * color: (point) =>
 *
 * properties[point.featureId].population > 100000
 * ? Cesium.Color.RED
 * : Cesium.Color.GRAY,
 * filter: (point) => properties[point.featureId].population > 1000,
 * feature is not final and is subject to change without Cesium's standard deprecation policy.
 * 决定圆如何与场景融合。必须为
 * {@link BlendOption.OPAQUE} 或 {@link BlendOption.TRANSLUCENT}。
 * 由向量基本体绘制的点。向量基本体并不拥有
 * 该集合；销毁它不会破坏集合本身。
 *   }),
 * );
 *
 * @extends VectorPrimitive
 * @experimental This feature is not final and is subject to change without Cesium's standard deprecation policy.
 */
class CircleVectorPrimitive extends VectorPrimitive {
  /**
   * @param {CircleVectorPrimitiveOptions} options
   */
  constructor(options) {
    super(options);

    this.radius = options.radius ?? 5.0;
    this.color = cloneColor(options.color ?? Color.WHITE);
    this.outlineColor = cloneColor(options.outlineColor ?? Color.BLACK);
    this.outlineWidth = options.outlineWidth ?? 0.0;
    this.filter = options.filter;

    /**
     * Determines how the circles are blended with the scene. Must be
     * {@link BlendOption.OPAQUE} or {@link BlendOption.TRANSLUCENT}.
     * @type {BlendOption}
     * @default BlendOption.TRANSLUCENT
     */
    this.blendOption = options.blendOption ?? BlendOption.TRANSLUCENT;
  }

  /**
   * The points drawn by the vector primitive. The vector primitive does not own
   * the collection; destroying it leaves the collection intact.
   *
   * @type {BufferPointCollection}
   * @readonly
   * @override
   */
  get collection() {
    return /** @type {BufferPointCollection} */ (this._collection);
  }

  /**
   * 每个圆形的半径，以像素为单位。
   * @type {number|function(BufferPoint): number}
   * @default 5.0
   */
  get radius() {
    return this._getStyle("radius");
  }

  set radius(value) {
    this._setStyle("radius", value);
  }

  /**
   * 每个圆形的填充颜色。
   * @type {Color|function(BufferPoint): Color}
   * @default Color.WHITE
   */
  get color() {
    return this._getStyle("color");
  }

  set color(value) {
    this._setStyle("color", value);
  }

  /**
   * 每个圆形的轮廓颜色。
   * @type {Color|function(BufferPoint): Color}
   * @default Color.BLACK
   */
  get outlineColor() {
    return this._getStyle("outlineColor");
  }

  set outlineColor(value) {
    this._setStyle("outlineColor", value);
  }

  /**
   * 每个圆形的轮廓宽度，以像素为单位。
   * @type {number|function(BufferPoint): number}
   * @default 0.0
   */
  get outlineWidth() {
    return this._getStyle("outlineWidth");
  }

  set outlineWidth(value) {
    this._setStyle("outlineWidth", value);
  }

  /**
   * 是否绘制每个点。若未指定，则绘制所有点。点
   * 通过 {@link BufferPrimitive#show} 隐藏的点将不会被绘制。
   * @type {undefined|function(BufferPoint): boolean}
   */
  get filter() {
    return this._getStyle("filter");
  }

  set filter(value) {
    this._setStyle("filter", value);
  }

  /**
   * 将点的视觉属性写入结果中。
   *
   * @param {BufferPoint} point
   * @param {BufferPointStyleResult} result
   * @returns {BufferPointStyleResult}
   * @ignore
   */
  _evaluatePoint(point, result) {
    const filter = this.filter;
    result.show = point.show && (filter === undefined || filter(point));
    result.radius = VectorPrimitive._evaluate(this.radius, point);
    result.color = VectorPrimitive._evaluate(this.color, point);
    result.outlineColor = VectorPrimitive._evaluate(this.outlineColor, point);
    result.outlineWidth = VectorPrimitive._evaluate(this.outlineWidth, point);
    return result;
  }

  /**
   * @param {FrameState} frameState
   * @param {*} renderContext
   * @returns {*}
   * @protected
   * @override
   * @ignore
   */
  _render(frameState, renderContext) {
    return renderBufferPointCollection(
      this.collection,
      frameState,
      renderContext,
      this,
    );
  }
}

/**
 * @template T
 * @param {T} value
 * @returns {T}
 * @ignore
 */
function cloneColor(value) {
  return value instanceof Color ? /** @type {T} */ (Color.clone(value)) : value;
}

export default CircleVectorPrimitive;