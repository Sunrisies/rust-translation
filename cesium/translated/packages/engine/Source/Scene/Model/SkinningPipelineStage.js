import { combine } from "@cesium/core";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import SkinningStageVS from "../../Shaders/Model/SkinningStageVS.js";
import VertexAttributeSemantic from "../VertexAttributeSemantic.js";

/**
 * 蒙皮流程阶段处理蒙皮基体的关节矩阵。
 *
 * @namespace SkinningPipelineStage
 *
 * @private
 */

const SkinningPipelineStage = {
  name: "SkinningPipelineStage", // Helps with debugging

  FUNCTION_ID_GET_SKINNING_MATRIX: "getSkinningMatrix",
  FUNCTION_SIGNATURE_GET_SKINNING_MATRIX: "mat4 getSkinningMatrix()",
};

/**
 * 该流程阶段处理蒙皮基体的关节矩阵，并向着色器添加
 * 相关的函数和统一变量。关节和权重属性
 * 在几何流程阶段被处理。
 *
 * 处理一个基体。此阶段修改渲染资源的以下部分：
 * <ul>
 * <li> 在顶点着色器中添加关节矩阵的统一变量声明</li>
 * <li> 在顶点着色器中添加计算蒙皮矩阵的函数</li>
 * </ul>
 *
 * @param {PrimitiveRenderResources} renderResources 该基体的渲染资源。
 * @param {ModelComponents.Primitive} primitive 该基体。
 * @private
 */
SkinningPipelineStage.process = function (renderResources, primitive) {
  const shaderBuilder = renderResources.shaderBuilder;

  shaderBuilder.addDefine("HAS_SKINNING", undefined, ShaderDestination.VERTEX);
  addGetSkinningMatrixFunction(shaderBuilder, primitive);

  const runtimeNode = renderResources.runtimeNode;
  const jointMatrices = runtimeNode.computedJointMatrices;

  shaderBuilder.addUniform(
    "mat4",
    `u_jointMatrices[${jointMatrices.length}]`,
    ShaderDestination.VERTEX,
  );

  shaderBuilder.addVertexLines(SkinningStageVS);

  const uniformMap = {
    u_jointMatrices: function () {
      return runtimeNode.computedJointMatrices;
    },
  };

  renderResources.uniformMap = combine(uniformMap, renderResources.uniformMap);
};

function getMaximumAttributeSetIndex(primitive) {
  let setIndex = -1;
  const attributes = primitive.attributes;
  const length = attributes.length;
  for (let i = 0; i < length; i++) {
    const attribute = attributes[i];
    const isJointsOrWeights =
      attribute.semantic === VertexAttributeSemantic.JOINTS ||
      attribute.semantic === VertexAttributeSemantic.WEIGHTS;

    if (!isJointsOrWeights) {
      continue;
    }

    setIndex = Math.max(setIndex, attribute.setIndex);
  }

  return setIndex;
}

function addGetSkinningMatrixFunction(shaderBuilder, primitive) {
  shaderBuilder.addFunction(
    SkinningPipelineStage.FUNCTION_ID_GET_SKINNING_MATRIX,
    SkinningPipelineStage.FUNCTION_SIGNATURE_GET_SKINNING_MATRIX,
    ShaderDestination.VERTEX,
  );

  const initialLine = "mat4 skinnedMatrix = mat4(0);";
  shaderBuilder.addFunctionLines(
    SkinningPipelineStage.FUNCTION_ID_GET_SKINNING_MATRIX,
    [initialLine],
  );

  let setIndex;
  let componentIndex;
  const componentStrings = ["x", "y", "z", "w"];
  const maximumSetIndex = getMaximumAttributeSetIndex(primitive);
  for (setIndex = 0; setIndex <= maximumSetIndex; setIndex++) {
    for (componentIndex = 0; componentIndex <= 3; componentIndex++) {
      const component = componentStrings[componentIndex];
      // Example: skinnedMatrix += a_weights_0.x * u_jointMatrices[int(a_joints_0.x)];
      const line = `skinnedMatrix += a_weights_${setIndex}.${component} * u_jointMatrices[int(a_joints_${setIndex}.${component})];`;
      shaderBuilder.addFunctionLines(
        SkinningPipelineStage.FUNCTION_ID_GET_SKINNING_MATRIX,
        [line],
      );
    }
  }

  const returnLine = "return skinnedMatrix;";
  shaderBuilder.addFunctionLines(
    SkinningPipelineStage.FUNCTION_ID_GET_SKINNING_MATRIX,
    [returnLine],
  );
}

export default SkinningPipelineStage;
