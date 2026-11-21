import { DeveloperError } from "@cesium/core";

/**
 * 定义可视化器的接口。可视化器是插件，用于
 * {@link DataSourceDisplay}，以渲染与
 * {@link DataSource} 实例相关的数据。
 * 此对象仅为文档用途而设计，不用于直接实例化。
 * 更新可视化效果至提供的时间。
 * @alias Visualizer
 * @constructor
 *
 * @see BillboardVisualizer
 * @see LabelVisualizer
 * @see ModelVisualizer
 * @see PathVisualizer
 * @see PointVisualizer
 * @see GeometryVisualizer
 */
function Visualizer() {
  DeveloperError.throwInstantiationError();
}

/**
 * 时间。
 * @function
 *
 * @param {JulianDate} time 如果显示已更新到提供的时间，
 *
 * @returns {boolean} True 如果显示已更新到提供的时间，
 * 如果可视化器正在等待异步操作完成才能更新数据，则为 false。
 * 计算包含指定实体产生的可视化的边界球体。
 */
Visualizer.prototype.update = DeveloperError.throwInstantiationError;

/**
 * 边界球体位于场景 globe 的固定框架中。
 * 要计算边界的实体。
 *
 * @param {Entity} entity 存储结果的边界球体。
 * @param {BoundingSphere} result 存储结果的边界球体。
 * @returns {BoundingSphereState} BoundingSphereState.DONE 如果结果包含边界球体，
 * 如果结果仍在计算中，则为 BoundingSphereState.PENDING，或者
 * 如果实体在当前场景中没有可视化，则为 BoundingSphereState.FAILED。
 * @private
 */
Visualizer.prototype.getBoundingSphere = DeveloperError.throwInstantiationError;

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * @function
 *
 * @returns {boolean} True 如果此对象被销毁，则返回 false。
 */
Visualizer.prototype.isDestroyed = DeveloperError.throwInstantiationError;

/**
 * 移除所有可视化效果并清理与此实例相关的所有资源。
 * @function
 */
Visualizer.prototype.destroy = DeveloperError.throwInstantiationError;
export default Visualizer;
