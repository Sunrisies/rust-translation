import { combine } from "@cesium/core";
import ModelSplitterStageFS from "../../Shaders/Model/ModelSplitterStageFS.js";
import ShaderDestination from "../../Renderer/ShaderDestination.js";

/**
 * 模型分割流水线阶段负责丢弃分割器错误一侧的片段。
 *
 * @namespace ModelSplitterPipelineStage
 *
 * @private
 */
const ModelSplitterPipelineStage = {
  name: "ModelSplitterPipelineStage", // Helps with debugging

  SPLIT_DIRECTION_UNIFORM_NAME: "model_splitDirection",
};

/**
 * 处理模型。这会修改渲染资源的以下部分：
 *
 * <ul>
 * <li>在片段着色器中添加一个定义，以指示模型已被分割</li>
 * <li>在片段着色器中添加一个函数，用于当片段位于分割器错误一侧时将其丢弃</li>
 * <li>添加一个统一变量，表示“splitDirection”（显示模型的屏幕侧）
 *</ul>
 *
 * @param {ModelRenderResources} renderResources 该模型的渲染资源。
 * @param {Model} model 模型本身。
 * @param {FrameState} frameState frameState。
 *
 * @private
 */
ModelSplitterPipelineStage.process = function (
  renderResources,
  model,
  frameState,
) {
  const shaderBuilder = renderResources.shaderBuilder;

  shaderBuilder.addDefine(
    "HAS_MODEL_SPLITTER",
    undefined,
    ShaderDestination.FRAGMENT,
  );
  shaderBuilder.addFragmentLines(ModelSplitterStageFS);

  const stageUniforms = {};

  shaderBuilder.addUniform(
    "float",
    ModelSplitterPipelineStage.SPLIT_DIRECTION_UNIFORM_NAME,
    ShaderDestination.FRAGMENT,
  );
  stageUniforms[ModelSplitterPipelineStage.SPLIT_DIRECTION_UNIFORM_NAME] =
    function () {
      return model.splitDirection;
    };

  renderResources.uniformMap = combine(
    stageUniforms,
    renderResources.uniformMap,
  );
};

export default ModelSplitterPipelineStage;
