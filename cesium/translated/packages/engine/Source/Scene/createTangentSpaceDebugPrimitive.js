import {
  ColorGeometryInstanceAttribute,
  DeveloperError,
  Frozen,
  GeometryInstance,
  GeometryPipeline,
  Matrix4,
  defined,
} from "@cesium/core";
import PerInstanceColorAppearance from "./PerInstanceColorAppearance.js";
import Primitive from "./Primitive.js";

/**
 * 创建一个 {@link Primitive} 来可视化常见的向量顶点属性：
 * <code>normal</code>、<code>tangent</code> 和 <code>bitangent</code>。 Normal
 * 为红色；tangent 为绿色；bitangent 为蓝色。如果某个属性不存在，
 * 则不会被绘制。
 *
 * @function
 *
 * @param {object} options 对象具有以下属性：
 * @param {Geometry} options.geometry 带有该属性的 <code>Geometry</code> 实例。
 * @param {number} [options.length=10000.0] 每条线段的长度，单位：米。该值可为负，用于指向相反方向。
 * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] 将几何图形从模型坐标转换为世界坐标的模型矩阵。
 * @returns {Primitive} A 新的带有向量几何数据的 <code>Primitive</code> 实例。
 *
 * @example
 * scene.primitives.add(Cesium.createTangentSpaceDebugPrimitive({
 * geometry : instance.geometry,
 * length : 100000.0,
 * modelMatrix : instance.modelMatrix
 * }));
 */
function createTangentSpaceDebugPrimitive(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const instances = [];
  let geometry = options.geometry;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(geometry)) {
    throw new DeveloperError("options.geometry is required.");
  }
  //>>includeEnd('debug');

  if (!defined(geometry.attributes) || !defined(geometry.primitiveType)) {
    // to create the debug lines, we need the computed attributes.
    // compute them if they are undefined.
    geometry = geometry.constructor.createGeometry(geometry);
  }

  const attributes = geometry.attributes;
  const modelMatrix = Matrix4.clone(options.modelMatrix ?? Matrix4.IDENTITY);
  const length = options.length ?? 10000.0;

  if (defined(attributes.normal)) {
    instances.push(
      new GeometryInstance({
        geometry: GeometryPipeline.createLineSegmentsForVectors(
          geometry,
          "normal",
          length,
        ),
        attributes: {
          color: new ColorGeometryInstanceAttribute(1.0, 0.0, 0.0, 1.0),
        },
        modelMatrix: modelMatrix,
      }),
    );
  }

  if (defined(attributes.tangent)) {
    instances.push(
      new GeometryInstance({
        geometry: GeometryPipeline.createLineSegmentsForVectors(
          geometry,
          "tangent",
          length,
        ),
        attributes: {
          color: new ColorGeometryInstanceAttribute(0.0, 1.0, 0.0, 1.0),
        },
        modelMatrix: modelMatrix,
      }),
    );
  }

  if (defined(attributes.bitangent)) {
    instances.push(
      new GeometryInstance({
        geometry: GeometryPipeline.createLineSegmentsForVectors(
          geometry,
          "bitangent",
          length,
        ),
        attributes: {
          color: new ColorGeometryInstanceAttribute(0.0, 0.0, 1.0, 1.0),
        },
        modelMatrix: modelMatrix,
      }),
    );
  }

  if (instances.length > 0) {
    return new Primitive({
      asynchronous: false,
      geometryInstances: instances,
      appearance: new PerInstanceColorAppearance({
        flat: true,
        translucent: false,
      }),
    });
  }

  return undefined;
}
export default createTangentSpaceDebugPrimitive;
