import { DeveloperError } from "@cesium/core";
import VoxelBoxShape from "./VoxelBoxShape.js";
import VoxelCylinderShape from "./VoxelCylinderShape.js";
import VoxelEllipsoidShape from "./VoxelEllipsoidShape.js";

/**
 * 体素形状枚举。该形状决定体素网格在三维空间中的映射方式。
 *
 * @enum {string}
 *
 * @experimental This 此功能尚未最终确定，可能根据 Cesium 的标准弃用政策进行变更。
 */
const VoxelShapeType = {
  /**
   * 箱形形状。
   *
   * @type {string}
   * @constant
   * @private
   */
  BOX: "BOX",
  /**
   * 椭球形状。
   *
   * @type {string}
   * @constant
   * @private
   */
  ELLIPSOID: "ELLIPSOID",
  /**
   * 圆柱形状。
   *
   * @type {string}
   * @constant
   * @private
   */
  CYLINDER: "CYLINDER",
};

/**
 * 获取最小边界。
 * @param {VoxelShapeType} shapeType 体素形状类型。
 * @returns {Cartesian3} The 最小边界。
 */
VoxelShapeType.getMinBounds = function (shapeType) {
  switch (shapeType) {
    case VoxelShapeType.BOX:
      return VoxelBoxShape.DefaultMinBounds;
    case VoxelShapeType.ELLIPSOID:
      return VoxelEllipsoidShape.DefaultMinBounds;
    case VoxelShapeType.CYLINDER:
      return VoxelCylinderShape.DefaultMinBounds;
    //>>includeStart('debug', pragmas.debug);
    default:
      throw new DeveloperError(`Invalid shape type ${shapeType}`);
    //>>includeEnd('debug');
  }
};

/**
 * 获取最大边界。
 * @param {VoxelShapeType} shapeType 体素形状类型。
 * @returns {Cartesian3} The 最大边界。
 */
VoxelShapeType.getMaxBounds = function (shapeType) {
  switch (shapeType) {
    case VoxelShapeType.BOX:
      return VoxelBoxShape.DefaultMaxBounds;
    case VoxelShapeType.ELLIPSOID:
      return VoxelEllipsoidShape.DefaultMaxBounds;
    case VoxelShapeType.CYLINDER:
      return VoxelCylinderShape.DefaultMaxBounds;
    //>>includeStart('debug', pragmas.debug);
    default:
      throw new DeveloperError(`Invalid shape type ${shapeType}`);
    //>>includeEnd('debug');
  }
};

/**
 * 将形状类型转换为可用于创建形状的构造函数。
 * 对象或获取每种形状的属性，如 DefaultMinBounds 和 DefaultMaxBounds。
 * 形状类型。
 *
 * @param {VoxelShapeType} shapeType 形状类型。
 * @returns {Function} The 形状的构造函数。
 *
 * @private
 */
VoxelShapeType.getShapeConstructor = function (shapeType) {
  switch (shapeType) {
    case VoxelShapeType.BOX:
      return VoxelBoxShape;
    case VoxelShapeType.ELLIPSOID:
      return VoxelEllipsoidShape;
    case VoxelShapeType.CYLINDER:
      return VoxelCylinderShape;
    //>>includeStart('debug', pragmas.debug);
    default:
      throw new DeveloperError(`Invalid shape type ${shapeType}`);
    //>>includeEnd('debug');
  }
};

Object.freeze(VoxelShapeType);

export default VoxelShapeType;
