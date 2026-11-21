import {
  AttributeType,
  BoundingSphere,
  Cartesian3,
  Cartographic,
  Check,
  Ellipsoid,
  IntersectionTests,
  Matrix4,
  Ray,
  VerticalExaggeration,
  defined,
} from "@cesium/core";
import SceneMode from "../SceneMode.js";
import VertexAttributeSemantic from "../VertexAttributeSemantic.js";
import ModelReader from "./ModelReader.js";
import ModelUtility from "./ModelUtility.js";

const scratchV0 = new Cartesian3();
const scratchV1 = new Cartesian3();
const scratchV2 = new Cartesian3();
const scratchV0_t = new Cartesian3();
const scratchV1_t = new Cartesian3();
const scratchV2_t = new Cartesian3();
const scratchPickCartographic = new Cartographic();
const scratchBoundingSphere = new BoundingSphere();

/**
 * 从给定元素索引处的平面顶点数组中读取 3D 位置。
 *
 * @param {TypedArray} vertices 平面顶点组件数组。
 * @param {number} index 顶点索引（元素索引，而非字节偏移量）。
 * @param {number} elementStride 每个顶点元素中的组件数量。
 * @param {Cartesian3} result 用于存储位置的对象。
 * @returns {Cartesian3} The 修改后的结果参数。
 * @private
 */
function readPosition(vertices, index, elementStride, result) {
  const i = index * elementStride;
  result.x = vertices[i];
  result.y = vertices[i + 1];
  result.z = vertices[i + 2];
  return result;
}

/**
 * 查找光线与渲染后的模型表面的交点。光线必须以世界坐标形式提供。
 *
 * @param {Model} model 要选择的模型。
 * @param {Ray} ray 用于检测相交的射线。
 * @param {FrameState} frameState 帧状态。
 * @param {number} [verticalExaggeration=1.0] 用于放大位置相对于椭球体的高度值的标量。如果值为 1.0，则不会产生效果。
 * @param {number} [relativeHeight=0.0] 位置被放大相对于的椭球体高度。如果值为 0.0，则位置将相对于椭球体表面被放大。
 * @param {Ellipsoid} [ellipsoid=Ellipsoid.default] 被放大的位置所相对的椭球体。
 * @param {Cartesian3|undefined} [result] 交点，或如果未找到则为 <code>undefined</code>。
 * @returns {Cartesian3|undefined} The 交点，或如果未找到则为 <code>undefined</code>。
 *
 * @private
 */
export default function pickModel(
  model,
  ray,
  frameState,
  verticalExaggeration,
  relativeHeight,
  ellipsoid,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("model", model);
  Check.typeOf.object("ray", ray);
  Check.typeOf.object("frameState", frameState);
  //>>includeEnd('debug');

  if (!model._ready || frameState.mode === SceneMode.MORPHING) {
    return;
  }

  let minT = Number.MAX_VALUE;

  ellipsoid = ellipsoid ?? Ellipsoid.default;
  verticalExaggeration = verticalExaggeration ?? 1.0;
  relativeHeight = relativeHeight ?? 0.0;

  const mapProjection =
    frameState.mode !== SceneMode.SCENE3D
      ? frameState.mapProjection
      : undefined;

  ModelReader.forEachPrimitive(
    model,
    { mapProjection: mapProjection },
    function (runtimePrimitive, primitive, instances, computedModelMatrix) {
      // Bounding sphere early-out for non-instanced primitives
      if (defined(runtimePrimitive.boundingSphere) && instances.length === 1) {
        const boundingSphere = BoundingSphere.transform(
          runtimePrimitive.boundingSphere,
          computedModelMatrix,
          scratchBoundingSphere,
        );
        const boundsIntersection = IntersectionTests.raySphere(
          ray,
          boundingSphere,
        );
        if (!defined(boundsIntersection)) {
          return;
        }
      }

      if (!defined(primitive.indices)) {
        // Point clouds
        return;
      }

      let vertices;
      let numPosComponents;
      const positionAttribute = ModelUtility.getAttributeBySemantic(
        primitive,
        VertexAttributeSemantic.POSITION,
      );
      if (defined(positionAttribute)) {
        numPosComponents = AttributeType.getNumberOfComponents(
          positionAttribute.type,
        );
        vertices = ModelReader.readAttributeAsTypedArray(positionAttribute);
      }

      let indices;
      if (defined(primitive.indices)) {
        indices = ModelReader.readIndicesAsTypedArray(primitive.indices);
      }

      if (!defined(indices) || !defined(vertices)) {
        return;
      }

      const indicesLength = indices.length;
      for (let i = 0; i < indicesLength; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        readPosition(vertices, i0, numPosComponents, scratchV0);
        readPosition(vertices, i1, numPosComponents, scratchV1);
        readPosition(vertices, i2, numPosComponents, scratchV2);

        for (const instance of instances) {
          const v0 = Matrix4.multiplyByPoint(
            instance.transform,
            scratchV0,
            scratchV0_t,
          );
          const v1 = Matrix4.multiplyByPoint(
            instance.transform,
            scratchV1,
            scratchV1_t,
          );
          const v2 = Matrix4.multiplyByPoint(
            instance.transform,
            scratchV2,
            scratchV2_t,
          );

          if (verticalExaggeration !== 1.0) {
            VerticalExaggeration.getPosition(
              v0,
              ellipsoid,
              verticalExaggeration,
              relativeHeight,
              v0,
            );
            VerticalExaggeration.getPosition(
              v1,
              ellipsoid,
              verticalExaggeration,
              relativeHeight,
              v1,
            );
            VerticalExaggeration.getPosition(
              v2,
              ellipsoid,
              verticalExaggeration,
              relativeHeight,
              v2,
            );
          }

          const t = IntersectionTests.rayTriangleParametric(
            ray,
            v0,
            v1,
            v2,
            model.backFaceCulling ?? true,
          );

          if (defined(t)) {
            if (t < minT && t >= 0.0) {
              minT = t;
            }
          }
        }
      }
    },
  );

  if (minT === Number.MAX_VALUE) {
    return undefined;
  }

  result = Ray.getPoint(ray, minT, result);
  if (frameState.mode !== SceneMode.SCENE3D) {
    Cartesian3.fromElements(result.y, result.z, result.x, result);

    const projection = frameState.mapProjection;
    const ellipsoid = projection.ellipsoid;

    const cartographic = projection.unproject(result, scratchPickCartographic);
    ellipsoid.cartographicToCartesian(cartographic, result);
  }

  return result;
}
