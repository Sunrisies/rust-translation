import { DeveloperError } from "@cesium/core";

/**
 * 用于裁剪和渲染体素网格的每种形状行为控制项。
 * 此类型描述一个接口，不打算直接实例化。
 *
 * @alias VoxelShape
 * @constructor
 *
 * @see VoxelBoxShape
 * @see VoxelEllipsoidShape
 * @see VoxelCylinderShape
 * @see VoxelShapeType
 *
 * @private
 */
function VoxelShape() {
  DeveloperError.throwInstantiationError();
}

Object.defineProperties(VoxelShape.prototype, {
  /**
   * 包含边界形状的定向边界框。
   *
   * @memberof VoxelShape.prototype
   * @type {OrientedBoundingBox}
   * @readonly
   * @private
   */
  orientedBoundingBox: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 包含边界形状的边界球体。
   *
   * @memberof VoxelShape.prototype
   * @type {BoundingSphere}
   * @readonly
   * @private
   */
  boundingSphere: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 包含边界形状的变换矩阵。
   *
   * @memberof VoxelShape.prototype
   * @type {Matrix4}
   * @readonly
   * @private
   */
  boundTransform: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 忽略边界，仅包含形状的变换矩阵。
   *
   * @memberof VoxelShape.prototype
   * @type {Matrix4}
   * @readonly
   * @private
   */
  shapeTransform: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * @memberof VoxelShape.prototype
   * @type {Object<string, any>}
   * @readonly
   * @private
   */
  shaderUniforms: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * @memberof VoxelShape.prototype
   * @type {Object<string, any>}
   * @readonly
   * @private
   */
  shaderDefines: {
    get: DeveloperError.throwInstantiationError,
  },

  /**
   * 任意射线方向下与形状相交的最大数量。
   * @memberof VoxelShape.prototype
   * @type {number}
   * @readonly
   * @private
   */
  shaderMaximumIntersectionsLength: {
    get: DeveloperError.throwInstantiationError,
  },
});

/**
 * 更新形状的状态。
 * @private
 * @param {Matrix4} modelMatrix 模型矩阵。
 * @param {Cartesian3} minBounds 最小边界。
 * @param {Cartesian3} maxBounds 最大边界。
 * @param {Cartesian3} [clipMinBounds] 最小裁剪边界。
 * @param {Cartesian3} [clipMaxBounds] 最大裁剪边界。
 * @returns {boolean} Whether 形状可见。
 */
VoxelShape.prototype.update = DeveloperError.throwInstantiationError;

/**
 * 更新任何依赖视图的变换。
 * @private
 * @param {FrameState} frameState 帧状态。
 */
VoxelShape.prototype.updateViewTransforms =
  DeveloperError.throwInstantiationError;

/**
 * 将局部坐标转换为形状的 UV 空间。
 * @private
 * @param {Cartesian3} positionLocal 需要转换的局部坐标。
 * @param {Cartesian3} result 存储结果的 Cartesian3 坐标系。
 * @returns {Cartesian3} The 转换后的 UV 坐标。
 */
VoxelShape.prototype.convertLocalToShapeUvSpace =
  DeveloperError.throwInstantiationError;

/**
 * 为指定的瓦片计算定向边界框。
 * @private
 * @param {number} tileLevel 瓦片的层级。
 * @param {number} tileX 瓦片的 x 坐标。
 * @param {number} tileY 瓦片的 y 坐标。
 * @param {number} tileZ 瓦片的 z 坐标。
 * @param {OrientedBoundingBox} result 将包围指定瓦片的定向边界框。
 * @returns {OrientedBoundingBox} The 定向边界框。
 */
VoxelShape.prototype.computeOrientedBoundingBoxForTile =
  DeveloperError.throwInstantiationError;

/**
 * 为指定瓦片内的指定样本计算定向边界框。
 * @private
 * @param {SpatialNode} spatialNode 包含样本的空间节点。
 * @param {Cartesian3} tileDimensions 填充前，瓦片的大小以样本数量表示。
 * @param {Cartesian3} tileUv 瓦片内的样本坐标。
 * @param {OrientedBoundingBox} result 将包围指定样本的定向边界框。
 * @returns {OrientedBoundingBox} The 定向边界框。
 */
VoxelShape.prototype.computeOrientedBoundingBoxForSample =
  DeveloperError.throwInstantiationError;

/**
 * 定义形状的最小边界。其含义可能因形状而异。
 *
 * @type {Cartesian3}
 * @constant
 * @readonly
 *
 * @private
 */
VoxelShape.DefaultMinBounds = DeveloperError.throwInstantiationError;

/**
 * 定义形状的最大边界。其含义也可能因形状而异。
 *
 * @type {Cartesian3}
 * @constant
 * @readonly
 *
 * @private
 */
VoxelShape.DefaultMaxBounds = DeveloperError.throwInstantiationError;

export default VoxelShape;
