import { combine, defined } from "@cesium/core";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import ModelSilhouetteStageFS from "../../Shaders/Model/ModelSilhouetteStageFS.js";
import ModelSilhouetteStageVS from "../../Shaders/Model/ModelSilhouetteStageVS.js";

/**
 * 模型轮廓处理阶段负责将轮廓应用于模型。
 *
 * @namespace ModelSilhouettePipelineStage
 *
 * @private
 */
const ModelSilhouettePipelineStage = {
  name: "ModelSilhouettePipelineStage", // Helps with debugging
};

/**
 * 记录已创建的轮廓数量。该值用于
 * 为模板分配参考编号。
 *
 * @type {number}
 * @private
 */
ModelSilhouettePipelineStage.silhouettesLength = 0;

/**
 * 处理模型。这会修改渲染资源的以下部分：
 *
 * <ul>
 * <li>如果模型尚未存在轮廓 ID，则定义该 ID</li>
 * <li>在着色器中添加定义，以表明模型使用轮廓</li>
 * <li>在顶点着色器中添加函数，用于围绕模型生成轮廓</li>
 * <li>在片段着色器中添加函数，用于为轮廓应用颜色</li>
 * <li>向着色器中添加对应轮廓属性的统一变量</li>
 * <li>添加统一变量以区分用于渲染轮廓的绘制命令</li>
 * <li>在渲染资源中设置变量，表示模型是否具有轮廓</li>
 * </ul>
 *
 * <p>
 * 注意，模型必须具有正常属性才能使用轮廓。相关标志
 * 被添加到 GeometryPipelineStage 中的着色器里。
 * </p>
 *
 * @param {ModelRenderResources} renderResources 该模型的渲染资源。
 * @param {Model} model 模型本身。
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */
ModelSilhouettePipelineStage.process = function (
  renderResources,
  model,
  frameState,
) {
  if (!defined(model._silhouetteId)) {
    model._silhouetteId = ++ModelSilhouettePipelineStage.silhouettesLength;
  }

  const shaderBuilder = renderResources.shaderBuilder;
  shaderBuilder.addDefine("HAS_SILHOUETTE", undefined, ShaderDestination.BOTH);

  shaderBuilder.addVertexLines(ModelSilhouetteStageVS);
  shaderBuilder.addFragmentLines(ModelSilhouetteStageFS);

  shaderBuilder.addUniform(
    "vec4",
    "model_silhouetteColor",
    ShaderDestination.FRAGMENT,
  );

  shaderBuilder.addUniform(
    "float",
    "model_silhouetteSize",
    ShaderDestination.VERTEX,
  );

  // Rendering silhouettes requires two draw commands:
  // - First, the model is rendered as normal, writing to the stencil buffer.
  // - Second, the silhouette is drawn, and the stencil buffer is used to cutout
  //   the part that overlaps the regular model.
  //
  // To avoid creating a second shader program to handle silhouettes, a uniform
  // is used to distinguish between the two draw commands. The second command will set
  // this uniform true, such that only it applies the silhouette stage.
  shaderBuilder.addUniform(
    "bool",
    "model_silhouettePass",
    ShaderDestination.BOTH,
  );

  const uniformMap = {
    model_silhouetteColor: function () {
      return model.silhouetteColor;
    },
    model_silhouetteSize: function () {
      return model.silhouetteSize;
    },
    model_silhouettePass: function () {
      // This will be set to true by the draw command that draws the silhouette.
      return false;
    },
  };

  renderResources.uniformMap = combine(uniformMap, renderResources.uniformMap);
  renderResources.hasSilhouette = true;
};

export default ModelSilhouettePipelineStage;
