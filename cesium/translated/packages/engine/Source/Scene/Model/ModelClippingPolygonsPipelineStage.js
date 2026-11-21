import {
  Cartesian2,
  Math as CesiumMath,
  Rectangle,
  combine,
} from "@cesium/core";
import ModelClippingPolygonsStageFS from "../../Shaders/Model/ModelClippingPolygonsStageFS.js";
import ModelClippingPolygonsStageVS from "../../Shaders/Model/ModelClippingPolygonsStageVS.js";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import VectorCommon from "../../Shaders/VectorCommon.js";

/**
 * 模型裁剪平面阶段负责对模型应用裁剪平面。
 *
 * @namespace ModelClippingPolygonsPipelineStage
 *
 * @private
 */
const ModelClippingPolygonsPipelineStage = {
  name: "ModelClippingPolygonsPipelineStage", // Helps with debugging
};

const scratchCameraUv = new Cartesian2();
const scratchRectangleInverseSize = new Cartesian2();
const defaultRectangle = Rectangle.MAX_VALUE;

/**
 * 对模型进行多边形裁剪处理。这会改变渲染资源中的以下部分：
 *
 * <ul>
 * <li>在顶点和片段着色器中添加定义，以表明模型包含裁剪多边形</li>
 * <li>在顶点和片段着色器中添加与裁剪多边形相关的参数定义，例如多边形数量</li>
 * <li>在顶点着色器中添加函数以确定查找 UV 坐标</li>
 * <li>在片段着色器中添加函数以丢弃被裁剪的区域</li>
 * <li>在顶点和片段着色器中添加统一变量，分别用于裁剪范围纹理和裁剪距离</li>
 * <li>在裁剪纹理中添加一个 varying 变量用于查找 UV 坐标</li>
 *</ul>
 *
 * @param {ModelRenderResources} renderResources 该模型的渲染资源。
 * @param {Model} model 模型本身。
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */
ModelClippingPolygonsPipelineStage.process = function (
  renderResources,
  model,
  frameState,
) {
  const clippingPolygons = model.clippingPolygons;
  const shaderBuilder = renderResources.shaderBuilder;

  shaderBuilder.addDefine(
    "ENABLE_CLIPPING_POLYGONS",
    undefined,
    ShaderDestination.BOTH,
  );

  if (clippingPolygons.inverse) {
    shaderBuilder.addDefine(
      "CLIPPING_INVERSE",
      undefined,
      ShaderDestination.FRAGMENT,
    );
  }

  shaderBuilder.addVarying("vec2", "v_clippingUv");

  shaderBuilder.addUniform(
    "vec2",
    "u_clippingCameraUv",
    ShaderDestination.VERTEX,
  );

  shaderBuilder.addUniform(
    "vec2",
    "u_clippingRectangleInverseSize",
    ShaderDestination.VERTEX,
  );

  shaderBuilder.addVertexLines(ModelClippingPolygonsStageVS);
  shaderBuilder.addFragmentLines(VectorCommon);
  shaderBuilder.addFragmentLines(ModelClippingPolygonsStageFS);

  const uniformMap = {
    // The UV coordinates of the eye within the model's clipping rectangle.
    u_clippingCameraUv: function () {
      const rectangle =
        model._clippingPolygonData?.rectangle ?? defaultRectangle;
      const halfWidth = rectangle.width * 0.5;
      const centerLongitude = rectangle.west + halfWidth;
      // The vertex shader adds a delta measured from the eye of the pass being
      // rendered, so read that same eye here rather than the scene camera. They
      // differ whenever the scene is rendered from another point of view, such
      // as when casting shadows.
      const eye = frameState.context.uniformState.eyeCartographic;

      const longitudeOffset =
        CesiumMath.negativePiToPi(eye.x - centerLongitude) + halfWidth;
      return Cartesian2.fromElements(
        longitudeOffset / rectangle.width,
        (eye.y - rectangle.south) / rectangle.height,
        scratchCameraUv,
      );
    },
    u_clippingRectangleInverseSize: function () {
      const rectangle =
        model._clippingPolygonData?.rectangle ?? defaultRectangle;
      return Cartesian2.fromElements(
        1.0 / rectangle.width,
        1.0 / rectangle.height,
        scratchRectangleInverseSize,
      );
    },
    u_clippingEdgeTexture: function () {
      return (
        model._clippingPolygonData?.polygonEdgeTexture ??
        frameState.context.defaultTexture
      );
    },
    u_clippingEdgePrimitiveIndicesTexture: function () {
      return (
        model._clippingPolygonData?.polygonEdgePrimitiveIndicesTexture ??
        frameState.context.defaultTexture
      );
    },
    u_clippingGridCellIndicesTexture: function () {
      return (
        model._clippingPolygonData?.polygonGridCellIndicesTexture ??
        frameState.context.defaultTexture
      );
    },
  };

  renderResources.uniformMap = combine(uniformMap, renderResources.uniformMap);
};

export default ModelClippingPolygonsPipelineStage;
