import { Cartesian2, Color, Matrix4, combine } from "@cesium/core";
import ClippingPlaneCollection from "../ClippingPlaneCollection.js";
import ModelClippingPlanesStageFS from "../../Shaders/Model/ModelClippingPlanesStageFS.js";
import ShaderDestination from "../../Renderer/ShaderDestination.js";

/**
 * 模型裁剪平面阶段负责对模型应用裁剪平面。
 *
 * @namespace ModelClippingPlanesPipelineStage
 *
 * @private
 */
const ModelClippingPlanesPipelineStage = {
  name: "ModelClippingPlanesPipelineStage", // Helps with debugging
};

const textureResolutionScratch = new Cartesian2();
const scratchClippingPlanesMatrix = new Matrix4();
const scratchClippingPlanesMatrix2 = new Matrix4();

/**
 * 处理模型。这会修改渲染资源的以下部分：
 *
 * <ul>
 * <li>在片段着色器中添加定义，以表明模型具有裁剪平面</li>
 * <li>为与裁剪平面相关的参数（如平面数量）在片段着色器中添加定义</li>
 * <li>在片段着色器中添加函数，用于将裁剪平面应用于模型的基础颜色</li>
 * <li>为片段着色器添加用于裁剪平面纹理和矩阵的统一变量</li>
 *</ul>
 *
 * @param {ModelRenderResources} renderResources 该模型的渲染资源。
 * @param {Model} model 模型本身。
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */
ModelClippingPlanesPipelineStage.process = function (
  renderResources,
  model,
  frameState,
) {
  const clippingPlanes = model.clippingPlanes;
  const context = frameState.context;
  const shaderBuilder = renderResources.shaderBuilder;

  shaderBuilder.addDefine(
    "HAS_CLIPPING_PLANES",
    undefined,
    ShaderDestination.FRAGMENT,
  );

  shaderBuilder.addDefine(
    "CLIPPING_PLANES_LENGTH",
    clippingPlanes.length,
    ShaderDestination.FRAGMENT,
  );

  if (clippingPlanes.unionClippingRegions) {
    shaderBuilder.addDefine(
      "UNION_CLIPPING_REGIONS",
      undefined,
      ShaderDestination.FRAGMENT,
    );
  }

  if (ClippingPlaneCollection.useFloatTexture(context)) {
    shaderBuilder.addDefine(
      "USE_CLIPPING_PLANES_FLOAT_TEXTURE",
      undefined,
      ShaderDestination.FRAGMENT,
    );
  }

  const textureResolution = ClippingPlaneCollection.getTextureResolution(
    clippingPlanes,
    context,
    textureResolutionScratch,
  );

  shaderBuilder.addDefine(
    "CLIPPING_PLANES_TEXTURE_WIDTH",
    textureResolution.x,
    ShaderDestination.FRAGMENT,
  );

  shaderBuilder.addDefine(
    "CLIPPING_PLANES_TEXTURE_HEIGHT",
    textureResolution.y,
    ShaderDestination.FRAGMENT,
  );

  shaderBuilder.addUniform(
    "sampler2D",
    "model_clippingPlanes",
    ShaderDestination.FRAGMENT,
  );
  shaderBuilder.addUniform(
    "vec4",
    "model_clippingPlanesEdgeStyle",
    ShaderDestination.FRAGMENT,
  );
  shaderBuilder.addUniform(
    "mat4",
    "model_clippingPlanesMatrix",
    ShaderDestination.FRAGMENT,
  );

  shaderBuilder.addFragmentLines(ModelClippingPlanesStageFS);

  const uniformMap = {
    model_clippingPlanes: function () {
      return clippingPlanes.texture;
    },
    model_clippingPlanesEdgeStyle: function () {
      const style = Color.clone(clippingPlanes.edgeColor);
      style.alpha = clippingPlanes.edgeWidth;
      return style;
    },
    model_clippingPlanesMatrix: function () {
      // The clipping planes matrix is factored into a view-dependent and a
      // view-independent part:
      //   inverseTranspose(view3D * reference * clipping)
      //     = transpose(inverseView3D) * inverseTranspose(reference * clipping).
      //
      // The view-dependent part, transpose(inverseView3D), reuses inverseView3D
      // already maintained on UniformState. Since it uses the active view, this is
      // also correct in the shadow cast pass, where inverseView3D is the light's
      // view rather than the camera's. Only a transpose is needed here, no inverse.
      const inverseViewTranspose = Matrix4.transpose(
        context.uniformState.inverseView3D,
        scratchClippingPlanesMatrix,
      );
      // The view-independent part, inverseTranspose(reference * clipping), is
      // computed once per frame in Model.updateReferenceMatrices.
      //
      // This recomputes the same product for every primitive of a model within
      // a pass. If it ever shows up in profiling, see the discussion of
      // alternatives in https://github.com/CesiumGS/cesium/pull/13388.
      return Matrix4.multiply(
        inverseViewTranspose,
        model._clippingPlanesMatrix,
        scratchClippingPlanesMatrix2,
      );
    },
  };

  renderResources.uniformMap = combine(uniformMap, renderResources.uniformMap);
};

export default ModelClippingPlanesPipelineStage;
