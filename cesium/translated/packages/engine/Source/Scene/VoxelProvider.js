// @ts-check

import { DeveloperError } from "@cesium/core";
/** @import { Cartesian3 } from "@cesium/core"; */
/** @import { Matrix4 } from "@cesium/core"; */
/** @import MetadataComponentType from "./MetadataComponentType.js"; */
/** @import MetadataType from "./MetadataType.js"; */
/** @import { TimeIntervalCollection } from "@cesium/core"; */
/** @import VoxelContent from "./VoxelContent.js"; */
/** @import VoxelShapeType from "./VoxelShapeType.js"; */

/**
 * 提供体素数据。适用于与 {@link VoxelPrimitive} 结合使用。
 * 此类型描述一个接口，不用于直接实例化。
 *
 * @see Cesium3DTilesVoxelProvider
 * @see VoxelPrimitive
 * @see VoxelShapeType
 *
 * @experimental This 该特性尚未定稿，可能根据 Cesium 的标准弃用政策发生变化。
 */
class VoxelProvider {
  constructor() {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 请求特定瓦片的数据。
   *
   * @param {object} [options] 具有以下属性的对象：
   * @param {number} [options.tileLevel=0] 瓦片的层级。
   * @param {number} [options.tileX=0] 瓦片的 X 坐标。
   * @param {number} [options.tileY=0] 瓦片的 Y 坐标。
   * @param {number} [options.tileZ=0] 瓦片的 Z 坐标。
   * @privateparam {number} [options.keyframe=0] 请求的关键帧。
   * @returns {Promise<VoxelContent>|undefined} A 承诺将返回一个包含该瓦片数据的 VoxelContent 对象，如果当前帧无法安排请求，则返回 undefined。
   */
  requestData(options) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 从局部空间到全局空间的变换。
   *
   * @type {Matrix4}
   * @default Matrix4.IDENTITY
   * @readonly
   * @constant
   */
  globalTransform;

  /**
   * 从形状空间到局部空间的变换。
   *
   * @type {Matrix4}
   * @default Matrix4.IDENTITY
   * @readonly
   * @constant
   */
  shapeTransform;

  /**
   * 获取 {@link VoxelShapeType}。
   *
   * @type {VoxelShapeType}
   * @readonly
   * @constant
   */
  shape;

  /**
   * 获取最小边界。
   * 如果未定义，将使用形状的默认最小边界。
   *
   * @type {Cartesian3|undefined}
   * @readonly
   * @constant
   */
  minBounds;

  /**
   * 获取最大边界。
   * 如果未定义，将使用形状的默认最大边界。
   *
   * @type {Cartesian3|undefined}
   * @readonly
   * @constant
   */
  maxBounds;

  /**
   * 获取瓦片每个维度的体素数量。该数值在数据集中的所有瓦片中均相同。
   *
   * @type {Cartesian3}
   * @readonly
   * @constant
   */
  dimensions;

  /**
   * 获取瓦片前的填充体素数量。这可以提高采样瓦片边缘时的渲染质量，但会增加内存占用。
   *
   * @type {Cartesian3}
   * @default Cartesian3.ZERO
   * @readonly
   * @constant
   */
  paddingBefore;

  /**
   * 获取瓦片后的填充体素数量。这也可以提高采样瓦片边缘时的渲染质量，但会增加内存占用。
   *
   * @type {Cartesian3}
   * @default Cartesian3.ZERO
   * @readonly
   * @constant
   */
  paddingAfter;

  /**
   * 获取元数据名称。
   *
   * @type {string[]}
   * @readonly
   * @constant
   */
  names;

  /**
   * 获取元数据类型。
   *
   * @type {MetadataType[]}
   * @readonly
   * @constant
   */
  types;

  /**
   * 获取元数据组件类型。
   *
   * @type {MetadataComponentType[]}
   * @readonly
   * @constant
   */
  componentTypes;

  /**
   * 获取元数据最小值。
   *
   * @type {number[][]|undefined}
   * @readonly
   * @constant
   */
  minimumValues;

  /**
   * 获取元数据最大值。
   *
   * @type {number[][]|undefined}
   * @readonly
   * @constant
   */
  maximumValues;

  /**
   * 此提供器存在的瓦片最大数量。
   * 该值作为提示，用于体素渲染器分配适当的 GPU 内存。
   * 如果不知道该值，则可定义为 undefined。
   *
   * @type {number|undefined}
   * @readonly
   * @constant
   */
  maximumTileCount;

  /**
   * tileset 中可用的瓦片所包含的细节层级数量。
   *
   * @type {number|undefined}
   * @readonly
   * @constant
   */
  availableLevels;

  /**
   * 获取数据集中的关键帧数量。
   *
   * @type {number|undefined}
   * @readonly
   * @constant
   * @private
   */
  keyframeCount;

  /**
   * 获取数据集的 {@link TimeIntervalCollection}，
   * 或者如果未包含时间戳，则返回 undefined。
   *
   * @type {TimeIntervalCollection|undefined}
   * @readonly
   * @constant
   * @private
   */
  timeIntervalCollection;
}

export default VoxelProvider;
