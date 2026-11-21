import { DeveloperError } from "@cesium/core";

/**
 * 定义瓦片的边界框。此类型描述一个接口。
 * 且不应直接实例化。
 *
 * @alias TileBoundingVolume
 * @constructor
 *
 * @see TileBoundingRegion
 * @see TileBoundingSphere
 * @see TileOrientedBoundingBox
 *
 * @private
 */
function TileBoundingVolume() {}

/**
 * 底层的边界框。
 *
 * @type {object}
 * @readonly
 */
TileBoundingVolume.prototype.boundingVolume = undefined;

/**
 * 底层的边界球体。
 *
 * @type {BoundingSphere}
 * @readonly
 */
TileBoundingVolume.prototype.boundingSphere = undefined;

/**
 * 计算瓦片与相机之间的距离。
 *
 * @param {FrameState} frameState 帧状态。
 * @return {number} The 瓦片与相机之间的距离，以米为单位。
 * 如果相机在瓦片内部，则返回 0.0。
 */
TileBoundingVolume.prototype.distanceToCamera = function (frameState) {
  DeveloperError.throwInstantiationError();
};

/**
 * 确定该边界框位于平面的哪一侧。
 *
 * @param {Plane} plane 需要测试的平面。
 * @returns {Intersect} {@link Intersect.INSIDE} if the entire volume is on the side of the plane
 *                      the normal is pointing, {@link Intersect.OUTSIDE} if the entire volume is
 *                      on the opposite side, and {@link Intersect.INTERSECTING} if the volume
 * 创建一种调试primitive，显示瓦片边界框的轮廓。
 */
TileBoundingVolume.prototype.intersectPlane = function (plane) {
  DeveloperError.throwInstantiationError();
};

/**
 * 显示瓦片边界框的轮廓。
 * primitive的网格所需颜色。
 *
 * @param {Color} color The desired color of the primitive's mesh
 * @return {Primitive}
 */
TileBoundingVolume.prototype.createDebugVolume = function (color) {
  DeveloperError.throwInstantiationError();
};
export default TileBoundingVolume;