import { defined } from "@cesium/core";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import SelectedFeatureIdStageCommon from "../../Shaders/Model/SelectedFeatureIdStageCommon.js";
import ModelComponents from "../ModelComponents.js";
import ModelUtility from "./ModelUtility.js";

/**
 * 所选特征 ID 管道阶段负责处理
 * 用于样式/选择的特征 ID 集合。
 *
 * @namespace SelectedFeatureIdPipelineStage
 * @private
 */
const SelectedFeatureIdPipelineStage = {
  name: "SelectedFeatureIdPipelineStage", // Helps with debugging

  STRUCT_ID_SELECTED_FEATURE: "SelectedFeature",
  STRUCT_NAME_SELECTED_FEATURE: "SelectedFeature",
};

/**
 * 处理一个基本体。这会修改渲染资源的以下部分：
 * <ul>
 * <li>设置用于样式/选择的特征 ID 属性的 defines</li>
 * <li>在着色器中的 SelectedFeature 结构中添加字段</li>
 * </ul>
 *
 * @param {PrimitiveRenderResources} renderResources 该基本体的渲染资源。
 * @param {ModelComponents.Primitive} primitive 该基本体。
 * @param {FrameState} frameState 帧状态。
 */
SelectedFeatureIdPipelineStage.process = function (
  renderResources,
  primitive,
  frameState,
) {
  const shaderBuilder = renderResources.shaderBuilder;

  renderResources.hasPropertyTable = true;

  const model = renderResources.model;
  const node = renderResources.runtimeNode.node;
  const selectedFeatureIds = getSelectedFeatureIds(model, node, primitive);
  const shaderDestination = selectedFeatureIds.shaderDestination;

  shaderBuilder.addDefine(
    "HAS_SELECTED_FEATURE_ID",
    undefined,
    shaderDestination,
  );

  // Add a define to insert the variable to use.
  // Example: #define SELECTED_FEATURE_ID featureId_1
  // This corresponds to featureIds.featureId_1
  shaderBuilder.addDefine(
    "SELECTED_FEATURE_ID",
    selectedFeatureIds.variableName,
    shaderDestination,
  );

  // Add a define to the shader to distinguish feature ID attributes from
  // textures. This is needed for determining where to filter features
  // by pass type.
  shaderBuilder.addDefine(
    selectedFeatureIds.featureIdDefine,
    undefined,
    shaderDestination,
  );

  updateFeatureStruct(shaderBuilder);

  const nullFeatureId = selectedFeatureIds.featureIds.nullFeatureId;
  const uniformMap = renderResources.uniformMap;
  if (defined(nullFeatureId)) {
    shaderBuilder.addDefine(
      "HAS_NULL_FEATURE_ID",
      undefined,
      shaderDestination,
    );
    shaderBuilder.addUniform("int", "model_nullFeatureId", shaderDestination);
    uniformMap.model_nullFeatureId = function () {
      return nullFeatureId;
    };
  }

  if (selectedFeatureIds.shaderDestination === ShaderDestination.BOTH) {
    shaderBuilder.addVertexLines(SelectedFeatureIdStageCommon);
  }
  shaderBuilder.addFragmentLines(SelectedFeatureIdStageCommon);
};

function getFeatureIdDefine(featureIds) {
  if (featureIds instanceof ModelComponents.FeatureIdTexture) {
    return "HAS_SELECTED_FEATURE_ID_TEXTURE";
  }

  return "HAS_SELECTED_FEATURE_ID_ATTRIBUTE";
}

function getShaderDestination(featureIds) {
  // Feature ID textures are only supported in the fragment shader.
  if (featureIds instanceof ModelComponents.FeatureIdTexture) {
    return ShaderDestination.FRAGMENT;
  }

  return ShaderDestination.BOTH;
}

function getSelectedFeatureIds(model, node, primitive) {
  let variableName;
  let featureIds;
  // Check instances first, as this is the most specific type of
  // feature ID
  if (defined(node.instances)) {
    featureIds = ModelUtility.getFeatureIdsByLabel(
      node.instances.featureIds,
      model.instanceFeatureIdLabel,
    );

    if (defined(featureIds)) {
      // Either label could be used here, but prefer label as it may be more
      // meaningful when debugging
      variableName = featureIds.label ?? featureIds.positionalLabel;
      return {
        featureIds: featureIds,
        variableName: variableName,
        shaderDestination: getShaderDestination(featureIds),
        featureIdDefine: getFeatureIdDefine(featureIds),
      };
    }
  }

  featureIds = ModelUtility.getFeatureIdsByLabel(
    primitive.featureIds,
    model.featureIdLabel,
  );
  // again, prefer label for being more descriptive
  variableName = featureIds.label ?? featureIds.positionalLabel;
  return {
    featureIds: featureIds,
    variableName: variableName,
    shaderDestination: getShaderDestination(featureIds),
    featureIdDefine: getFeatureIdDefine(featureIds),
  };
}

/**
 * 填充着色器中的 "SelectedFeature" 结构，其中包含关于“活动”特征的信息（用于选择/样式）。
 * 该结构总是由 GeometryPipelineStage 添加到着色器中（编译所需）。 SelectedFeature 结构看起来如下：
 * 如下：
 *
 * struct SelectedFeature {
 * int id;
 * vec2 st;
 * vec4 color;
 * }
 *
 * @private
 */
function updateFeatureStruct(shaderBuilder) {
  shaderBuilder.addStructField(
    SelectedFeatureIdPipelineStage.STRUCT_ID_SELECTED_FEATURE,
    "int",
    "id",
  );

  shaderBuilder.addStructField(
    SelectedFeatureIdPipelineStage.STRUCT_ID_SELECTED_FEATURE,
    "vec2",
    "st",
  );

  shaderBuilder.addStructField(
    SelectedFeatureIdPipelineStage.STRUCT_ID_SELECTED_FEATURE,
    "vec4",
    "color",
  );
}

export default SelectedFeatureIdPipelineStage;
