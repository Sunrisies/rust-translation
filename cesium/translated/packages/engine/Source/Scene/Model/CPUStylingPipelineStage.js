import { defined } from "@cesium/core";
import ColorBlendMode from "../ColorBlendMode.js";
import CPUStylingStageVS from "../../Shaders/Model/CPUStylingStageVS.js";
import CPUStylingStageFS from "../../Shaders/Model/CPUStylingStageFS.js";
import ModelColorPipelineStage from "./ModelColorPipelineStage.js";
import Pass from "../../Renderer/Pass.js";
import ShaderDestination from "../../Renderer/ShaderDestination.js";

/**
 * CPU 样式阶段负责确保在运行时应用该功能的颜色。
 * 在运行时应用颜色。
 *
 * @namespace CPUStylingPipelineStage
 *
 * @private
 */
const CPUStylingPipelineStage = {
  name: "CPUStylingPipelineStage", // Helps with debugging
};

/**
 * 处理基本体。这会修改渲染资源中的以下部分：
 * <ul>
 * <li>将样式代码添加到顶点和片段着色器中</li>
 * <li>添加定义以触发阶段的着色器函数</li>
 * <li>添加一个统一变量，包含模型的颜色混合模式和强度</li>
 * </ul>
 *
 * @param {PrimitiveRenderResources} renderResources 该基本体的渲染资源。
 * @param {ModelComponents.Primitive} primitive 该基本体。
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */
CPUStylingPipelineStage.process = function (
  renderResources,
  primitive,
  frameState,
) {
  const model = renderResources.model;
  const shaderBuilder = renderResources.shaderBuilder;

  shaderBuilder.addVertexLines(CPUStylingStageVS);
  shaderBuilder.addFragmentLines(CPUStylingStageFS);
  shaderBuilder.addDefine("USE_CPU_STYLING", undefined, ShaderDestination.BOTH);

  // These uniforms may have already been added by the ModelColorStage
  // if a static color is applied.
  if (!defined(model.color)) {
    shaderBuilder.addUniform(
      "float",
      ModelColorPipelineStage.COLOR_BLEND_UNIFORM_NAME,
      ShaderDestination.FRAGMENT,
    );
    renderResources.uniformMap[
      ModelColorPipelineStage.COLOR_BLEND_UNIFORM_NAME
    ] = function () {
      return ColorBlendMode.getColorBlend(
        model.colorBlendMode,
        model.colorBlendAmount,
      );
    };
  }

  shaderBuilder.addUniform(
    "bool",
    "model_commandTranslucent",
    ShaderDestination.BOTH,
  );
  renderResources.uniformMap.model_commandTranslucent = function () {
    // Always check the current value, because custom shaders may
    // change the value with the translucencyMode parameter
    return renderResources.alphaOptions.pass === Pass.TRANSLUCENT;
  };
};

export default CPUStylingPipelineStage;
