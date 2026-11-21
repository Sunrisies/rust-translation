import { combine } from "@cesium/core";
import ColorBlendMode from "../ColorBlendMode.js";
import ModelColorStageFS from "../../Shaders/Model/ModelColorStageFS.js";
import Pass from "../../Renderer/Pass.js";
import ShaderDestination from "../../Renderer/ShaderDestination.js";

/**
 * 模型颜色处理阶段负责将静态颜色应用于模型。
 *
 * @namespace ModelColorPipelineStage
 *
 * @private
 */
const ModelColorPipelineStage = {
  name: "ModelColorPipelineStage", // Helps with debugging

  COLOR_UNIFORM_NAME: "model_color",
  COLOR_BLEND_UNIFORM_NAME: "model_colorBlend",
};

/**
 * 处理模型。这会修改渲染资源中的以下部分：
 *
 * <ul>
 * <li>在片段着色器中添加定义，以表明模型具有颜色</li>
 * <li>在片段着色器中添加函数，将颜色应用到模型的基础颜色上</li>
 * <li>为片段着色器添加用于模型颜色和混合属性的统一变量</li>
 * <li>根据模型颜色的半透明程度更新渲染资源中的通道类型</li>
 *</ul>
 *
 * @param {ModelRenderResources} renderResources 该模型的渲染资源。
 * @param {Model} model 模型本身。
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */
ModelColorPipelineStage.process = function (
  renderResources,
  model,
  frameState,
) {
  const shaderBuilder = renderResources.shaderBuilder;

  shaderBuilder.addDefine(
    "HAS_MODEL_COLOR",
    undefined,
    ShaderDestination.FRAGMENT,
  );
  shaderBuilder.addFragmentLines(ModelColorStageFS);

  const stageUniforms = {};

  // Pass the model's color as a uniform. Set the pass type to translucent, if needed.
  const color = model.color;

  if (color.alpha === 0.0 && !model.hasSilhouette(frameState)) {
    renderResources.renderStateOptions.colorMask = {
      red: false,
      green: false,
      blue: false,
      alpha: false,
    };
  }

  if (color.alpha < 1.0) {
    renderResources.alphaOptions.pass = Pass.TRANSLUCENT;
  }

  shaderBuilder.addUniform(
    "vec4",
    ModelColorPipelineStage.COLOR_UNIFORM_NAME,
    ShaderDestination.FRAGMENT,
  );
  stageUniforms[ModelColorPipelineStage.COLOR_UNIFORM_NAME] = function () {
    return model.color;
  };

  // Create a colorBlend from the model's colorBlendMode and colorBlendAmount and pass it as a uniform.
  shaderBuilder.addUniform(
    "float",
    ModelColorPipelineStage.COLOR_BLEND_UNIFORM_NAME,
    ShaderDestination.FRAGMENT,
  );
  stageUniforms[ModelColorPipelineStage.COLOR_BLEND_UNIFORM_NAME] =
    function () {
      return ColorBlendMode.getColorBlend(
        model.colorBlendMode,
        model.colorBlendAmount,
      );
    };

  renderResources.uniformMap = combine(
    stageUniforms,
    renderResources.uniformMap,
  );
};

export default ModelColorPipelineStage;
