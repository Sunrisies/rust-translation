import { defined } from "@cesium/core";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import LightingStageFS from "../../Shaders/Model/LightingStageFS.js";
import LightingModel from "./LightingModel.js";

/**
 * 光照流程阶段负责将材质与光照模型（如基于物理的渲染 PBR 或无光照模式）结合进行渲染。
 * 以进行渲染。这会改变渲染的以下部分：
 * 着色器。
 *
 * @namespace LightingPipelineStage
 *
 * @private
 */
const LightingPipelineStage = {
  name: "LightingPipelineStage", // Helps with debugging
};

/**
 * 处理基本体。这会修改渲染中的以下资源：
 * 资源：
 * <ul>
 * <li>修改着色器以包含光照阶段</li>
 * </ul>
 * @param {PrimitiveRenderResources} renderResources 基本体的渲染资源。
 * @param {ModelComponents.Primitive} primitive 待渲染的基本体。
 *
 * @private
 */
LightingPipelineStage.process = function (renderResources, primitive) {
  const { model, lightingOptions, shaderBuilder } = renderResources;

  if (defined(model.lightColor)) {
    shaderBuilder.addDefine(
      "USE_CUSTOM_LIGHT_COLOR",
      undefined,
      ShaderDestination.FRAGMENT,
    );

    shaderBuilder.addUniform(
      "vec3",
      "model_lightColorHdr",
      ShaderDestination.FRAGMENT,
    );

    const uniformMap = renderResources.uniformMap;
    uniformMap.model_lightColorHdr = function () {
      return model.lightColor;
    };
  }

  // The lighting model is always set by the material. However, custom shaders
  // can override this.
  const { lightingModel } = lightingOptions;

  if (lightingModel === LightingModel.PBR) {
    shaderBuilder.addDefine(
      "LIGHTING_PBR",
      undefined,
      ShaderDestination.FRAGMENT,
    );
  } else {
    shaderBuilder.addDefine(
      "LIGHTING_UNLIT",
      undefined,
      ShaderDestination.FRAGMENT,
    );
  }

  shaderBuilder.addFragmentLines(LightingStageFS);
};

export default LightingPipelineStage;
