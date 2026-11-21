// @ts-check

import { Cartesian2, Math as CesiumMath, combine } from "@cesium/core";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import VectorCommon from "../../Shaders/VectorCommon.js";
import ModelVectorLookupStageVS from "../../Shaders/Model/ModelVectorLookupStageVS.js";
import ModelVectorLookupStageFS from "../../Shaders/Model/ModelVectorLookupStageFS.js";

/** @import FrameState from "../FrameState.js"; */
/** @import Model from "./Model.js"; */
/** @import ModelRenderResources from "./ModelRenderResources.js"; */

/**
 * 模型向量查找阶段将向量数据覆盖到模型中，这些数据已通过烘焙处理。
 * 场景的 VectorProvider 根据每帧内容查找纹理，并将其应用于模型表面。
 * 
 *
 * @namespace ModelVectorLookupPipelineStage
 *
 * @private
 */
const ModelVectorLookupPipelineStage = {
  name: "ModelVectorLookupPipelineStage", // Helps with debugging
  process: process,
};

const scratchCameraUv = new Cartesian2();
const scratchRectangleInverseSize = new Cartesian2();

/**
 * 使用已烘焙的向量查找数据处理模型。这会改变渲染资源中的以下部分：
 * 
 *
 * <ul>
 * <li>在两种着色器中添加 HAS_VECTOR_LOOKUP 定义</li>
 * <li>在顶点着色器中添加计算顶点 UV 值的函数，该值位于已烘焙的矩形内</li>
 * <li>在片段着色器中添加共享的向量查找函数和合成函数</li>
 * <li>添加用于已烘焙矩形和查找纹理的统一变量</li>
 * </ul>
 *
 * @param {ModelRenderResources} renderResources 该模型的渲染资源。
 * @param {Model} model 模型本身。
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */
function process(renderResources, model, frameState) {
  const shaderBuilder = renderResources.shaderBuilder;
  const vectorData = model._vectorData;
  const hasPolylines = vectorData.hasPolylines;
  const hasPolygons = vectorData.hasPolygons;

  shaderBuilder.addDefine(
    "HAS_VECTOR_LOOKUP",
    undefined,
    ShaderDestination.BOTH,
  );

  if (hasPolylines) {
    shaderBuilder.addDefine(
      "HAS_VECTOR_POLYLINES",
      undefined,
      ShaderDestination.FRAGMENT,
    );

    if (vectorData.hasMeterWidths) {
      shaderBuilder.addDefine(
        "VECTOR_WIDTH_IN_METERS",
        undefined,
        ShaderDestination.FRAGMENT,
      );
      if (vectorData.hasPixelWidths) {
        shaderBuilder.addDefine(
          "VECTOR_WIDTH_MIXED_UNITS",
          undefined,
          ShaderDestination.FRAGMENT,
        );
      }
    }
  }

  if (hasPolygons) {
    shaderBuilder.addDefine(
      "HAS_VECTOR_POLYGONS",
      undefined,
      ShaderDestination.FRAGMENT,
    );
  }

  shaderBuilder.addUniform(
    "vec2",
    "u_vectorCameraUv",
    ShaderDestination.VERTEX,
  );
  shaderBuilder.addUniform(
    "vec2",
    "u_vectorRectangleInverseSize",
    ShaderDestination.VERTEX,
  );

  shaderBuilder.addVarying("vec2", "v_vectorUv");
  shaderBuilder.addVertexLines(ModelVectorLookupStageVS);
  // VectorCommon declares the lookup texture uniforms and sampling functions
  // shared with the terrain path.
  shaderBuilder.addFragmentLines(VectorCommon);
  shaderBuilder.addFragmentLines(ModelVectorLookupStageFS);

  // A re-bake replaces _vectorData, and its rectangle, without rebuilding draw
  // commands, so the callbacks read the rectangle per call.
  const buildRectangle = vectorData.rectangle;

  const defaultTexture = function () {
    return frameState.context.defaultTexture;
  };

  /** @type {Object<string, Function>} */
  const uniformMap = {
    // The UV coordinates of the camera within the baked rectangle.
    u_vectorCameraUv: function () {
      const rectangle = model._vectorData?.rectangle ?? buildRectangle;
      const carto = frameState.camera.positionCartographic;

      const halfWidth = rectangle.width * 0.5;
      const centerLongitude = rectangle.west + halfWidth;
      const longitudeOffset =
        CesiumMath.negativePiToPi(carto.longitude - centerLongitude) +
        halfWidth;
      return Cartesian2.fromElements(
        longitudeOffset / rectangle.width,
        (carto.latitude - rectangle.south) / rectangle.height,
        scratchCameraUv,
      );
    },
    u_vectorRectangleInverseSize: function () {
      const rectangle = model._vectorData?.rectangle ?? buildRectangle;
      return Cartesian2.fromElements(
        1.0 / rectangle.width,
        1.0 / rectangle.height,
        scratchRectangleInverseSize,
      );
    },
    u_vectorColorTexture: function () {
      return model._vectorData?.colorTexture ?? defaultTexture();
    },
    u_vectorPickColorTexture: function () {
      return model._vectorData?.pickColorTexture ?? defaultTexture();
    },
  };

  if (hasPolylines) {
    uniformMap.u_vectorSegmentTexture = function () {
      return model._vectorData?.polylineSegmentTexture ?? defaultTexture();
    };
    uniformMap.u_vectorWidthTexture = function () {
      return model._vectorData?.widthTexture ?? defaultTexture();
    };
    uniformMap.u_vectorSegmentPrimitiveIndicesTexture = function () {
      return (
        model._vectorData?.polylineSegmentPrimitiveIndicesTexture ??
        defaultTexture()
      );
    };
    uniformMap.u_vectorGridCellIndicesTexture = function () {
      return (
        model._vectorData?.polylineGridCellIndicesTexture ?? defaultTexture()
      );
    };
    uniformMap.u_vectorMetersPerUv = function () {
      return model._vectorData?.metersPerUv ?? Cartesian2.ONE;
    };
  }

  if (hasPolygons) {
    uniformMap.u_vectorPolygonEdgeTexture = function () {
      return model._vectorData?.polygonEdgeTexture ?? defaultTexture();
    };
    uniformMap.u_vectorPolygonEdgePrimitiveIndicesTexture = function () {
      return (
        model._vectorData?.polygonEdgePrimitiveIndicesTexture ??
        defaultTexture()
      );
    };
    uniformMap.u_vectorPolygonGridCellIndicesTexture = function () {
      return (
        model._vectorData?.polygonGridCellIndicesTexture ?? defaultTexture()
      );
    };
  }

  renderResources.uniformMap = /** @type {Object<string, Function>} */ (
    combine(uniformMap, renderResources.uniformMap)
  );
}

export default ModelVectorLookupPipelineStage;
