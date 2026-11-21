// @ts-check

import { DeveloperError } from "@cesium/core";
/** @import Context from "../Renderer/Context.js"; */
/** @import DrawCommand from "../Renderer/DrawCommand.js"; */
/** @import FrameState from "./FrameState.js"; */
/** @import QuadtreeOccluders from "./QuadtreeOccluders.js"; */
/** @import QuadtreePrimitive from "./QuadtreePrimitive.js"; */
/** @import QuadtreeTile from "./QuadtreeTile.js"; */
/** @import TilingScheme from "../Core/TilingScheme.js"; */
/** @import { Visibility } from "@cesium/core"; */

/**
 * 提供用于在椭球体表面或附近显示的通用四叉树瓦片。其设计目的是
 * 与 {@link QuadtreePrimitive} 一起使用。该类型描述了一个接口，并不打算被直接实例化。
 * 直接实例化。
 *
 * @interface
 * @private
 */
class QuadtreeTileProvider {
  /**
   * 获取或设置用于此提供器提供瓦片的 {@link QuadtreePrimitive}。
   * 获取提供器使用的瓦片方案。
   * @type {QuadtreePrimitive}
   */
  quadtree;

  /**
   * 获取提供器使用的瓦片方案。
   * @type {TilingScheme}
   */
  tilingScheme;

  /**
   * 获取几何提供器遇到异步错误时引发的事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   * 接收 {@link TileProviderError} 的实例。
   * 计算四叉树零级层级的默认几何误差。
   * @type {Event}
   */
  errorEvent;

  constructor() {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 用于计算几何误差的瓦片方案。
   *
   * @param {TilingScheme} tilingScheme 计算几何误差所采用的瓦片方案。
   * @returns {number} The 零级层级的最大几何误差，以米为单位。
   */
  static computeDefaultLevelZeroMaximumGeometricError(tilingScheme) {
    return (
      (tilingScheme.ellipsoid.maximumRadius * 2 * Math.PI * 0.25) /
      (65 * tilingScheme.getNumberOfXTilesAtLevel(0))
    );
  }

  /**
   * 在更新周期开始时调用，无论是否渲染新帧，均在 {@link QuadtreeTileProvider#beginUpdate} 之前。
   *
   * @param {Context} context 渲染上下文。
   * @param {FrameState} frameState 帧状态。
   */
  update(context, frameState) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 在更新周期的每个渲染帧开始时调用，在 {@link QuadtreeTileProvider#showTileThisFrame} 之前。
   * 或任何其他函数之前。
   *
   * @param {Context} context 渲染上下文。
   * @param {FrameState} frameState 帧状态。
   * @param {DrawCommand[]} commandList 渲染命令数组。此方法可能将命令推入该数组。
   * 在更新周期的每个渲染帧结束时调用。
   */
  beginUpdate(context, frameState, commandList) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 在 {@link QuadtreeTileProvider#showTileThisFrame} 之后的每个渲染帧结束时调用。
   * 和任何其他函数之后。
   *
   * @param {Context} context 渲染上下文。
   * @param {FrameState} frameState 帧状态。
   * @param {DrawCommand[]} commandList 渲染命令数组。此方法可能将命令推入该数组。
   * 在给定层级中允许的瓦片最大几何误差，以米为单位。
   */
  endUpdate(context, frameState, commandList) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 用于获取最大几何误差的瓦片层级。
   *
   * @see QuadtreeTileProvider#computeDefaultLevelZeroMaximumGeometricError
   *
   * @param {number} level 以米为单位的最大几何误差值。
   * @returns {number} The 最大几何误差值，以米为单位。
   */
  getLevelMaximumGeometricError(level) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 加载或继续加载特定瓦片。此函数将持续调用
   * 直到 {@link QuadtreeTile#state} 不再处于 {@link QuadtreeTileLoadState#LOADING} 状态。
   *
   * @param {Context} context 渲染上下文。
   * @param {FrameState} frameState 帧状态。
   * @param {QuadtreeTile} tile 要加载的瓦片。
   */
  loadTile(context, frameState, tile) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 确定给定瓦片的可见性。该瓦片可能是完全可见、部分可见或完全不可见。可渲染且至少部分可见的瓦片将通过调用
   * {@link QuadtreeTileProvider#showTileThisFrame} 来显示。
   * 被显示。
   *
   * @param {QuadtreeTile} tile 瓦片实例。
   * @param {FrameState} frameState 当前帧的状态信息。
   * @param {QuadtreeOccluders} occluders 可能遮挡该瓦片的对象。
   *
   * @returns {Visibility} The 瓦片的可见性。
   */
  computeTileVisibility(tile, frameState, occluders) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 在此帧中显示指定的瓦片。提供方可以通过向 commandList 添加渲染命令，或采用其他适当方法使瓦片显示出来。除非也在下一帧调用此方法，否则该瓦片不
   * 预期在下一帧也可见。
   * 瓦片实例。
   *
   * @param {QuadtreeTile} tile 渲染上下文。
   * @param {Context} context 当前渲染帧的状态信息。
   * @param {FrameState} frameState 渲染命令列表。此方法可能向该列表添加额外命令。
   * @param {DrawCommand[]} commandList 获取相机到瓦片上最近点的距离。此值用于细节级别选择。
   */
  showTileThisFrame(tile, context, frameState, commandList) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 瓦片实例。
   *
   * @param {QuadtreeTile} tile 当前渲染帧的状态信息。
   * @param {FrameState} frameState 相机到瓦片上最近点的距离，以米为单位。
   *
   * @returns {number} The 如果此对象被销毁，则返回 true；否则返回 false。
   */
  computeDistanceToTile(tile, frameState) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 如果此对象被销毁，则不应使用它；调用除
   * <br /><br />
   * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
   * 以外的函数，则返回 false。
   *
   * @returns {boolean} True 如果此对象被销毁，则不应使用它；调用除
   *
   * @see QuadtreeTileProvider#destroy
   */
  isDestroyed() {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 由此对象持有的 WebGL 资源将被释放。释放对象允许确定性的
   * WebGL 资源释放，而不是依赖垃圾收集器来销毁此对象。
   * <br /><br />
   * 一旦对象被销毁，就不应再使用它；调用除
   * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
   * 将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
   *
   * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
   *
   * @example
   * provider = provider && provider();
   *
   * @see QuadtreeTileProvider#isDestroyed
   */
  destroy() {
    DeveloperError.throwInstantiationError();
  }
}

export default QuadtreeTileProvider;
