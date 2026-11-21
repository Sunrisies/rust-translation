import { AttributeType, combine, defined } from "@cesium/core";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import MorphTargetsStageVS from "../../Shaders/Model/MorphTargetsStageVS.js";
import VertexAttributeSemantic from "../VertexAttributeSemantic.js";

/**
 * 形态目标处理阶段负责处理基体的形态目标和权重。
 *
 * @namespace MorphTargetsPipelineStage
 *
 * @private
 */
const MorphTargetsPipelineStage = {
  name: "MorphTargetsPipelineStage", // Helps with debugging

  FUNCTION_ID_GET_MORPHED_POSITION: "getMorphedPosition",
  FUNCTION_SIGNATURE_GET_MORPHED_POSITION:
    "vec3 getMorphedPosition(in vec3 position)",
  FUNCTION_ID_GET_MORPHED_NORMAL: "getMorphedNormal",
  FUNCTION_SIGNATURE_GET_MORPHED_NORMAL:
    "vec3 getMorphedNormal(in vec3 normal)",
  FUNCTION_ID_GET_MORPHED_TANGENT: "getMorphedTangent",
  FUNCTION_SIGNATURE_GET_MORPHED_TANGENT:
    "vec3 getMorphedTangent(in vec3 tangent)",
};

/**
 * 该处理阶段负责处理基体的形态目标和权重，
 * 并在着色器中添加相关的属性声明和函数。
 *
 * 处理一个基体。此阶段会修改渲染资源中的以下部分：
 * <ul>
 * <li> 在顶点着色器中添加形态目标的属性声明
 * <li> 在顶点着色器中添加形态权重的统一声明
 * <li> 在顶点着色器中添加应用形态的函数
 * </ul>
 *
 * @param {PrimitiveRenderResources} renderResources 该基体的渲染资源。
 * @param {ModelComponents.Primitive} primitive 该基体。
 *
 * @private
 */
MorphTargetsPipelineStage.process = function (renderResources, primitive) {
  const shaderBuilder = renderResources.shaderBuilder;

  shaderBuilder.addDefine(
    "HAS_MORPH_TARGETS",
    undefined,
    ShaderDestination.VERTEX,
  );

  addGetMorphedAttributeFunctionDeclarations(shaderBuilder);

  const morphTargetsLength = primitive.morphTargets.length;
  for (let i = 0; i < morphTargetsLength; i++) {
    const attributes = primitive.morphTargets[i].attributes;

    const attributesLength = attributes.length;
    for (let j = 0; j < attributesLength; j++) {
      const attribute = attributes[j];
      const semantic = attribute.semantic;

      // Cesium only supports morph targets for positions, normals, and tangents
      if (
        semantic !== VertexAttributeSemantic.POSITION &&
        semantic !== VertexAttributeSemantic.NORMAL &&
        semantic !== VertexAttributeSemantic.TANGENT
      ) {
        continue;
      }

      processMorphTargetAttribute(
        renderResources,
        attribute,
        renderResources.attributeIndex,
        i,
      );
      renderResources.attributeIndex++;
    }
  }

  addGetMorphedAttributeFunctionReturns(shaderBuilder);

  const weights = renderResources.runtimeNode.morphWeights;
  const weightsLength = weights.length;
  shaderBuilder.addUniform(
    "float",
    `u_morphWeights[${weightsLength}]`,
    ShaderDestination.VERTEX,
  );

  shaderBuilder.addVertexLines(MorphTargetsStageVS);

  const uniformMap = {
    u_morphWeights: function () {
      return renderResources.runtimeNode.morphWeights;
    },
  };

  renderResources.uniformMap = combine(uniformMap, renderResources.uniformMap);
};

const scratchAttributeInfo = {
  attributeString: undefined,
  functionId: undefined,
};

function processMorphTargetAttribute(
  renderResources,
  attribute,
  attributeIndex,
  morphTargetIndex,
) {
  const shaderBuilder = renderResources.shaderBuilder;

  addMorphTargetAttributeToRenderResources(
    renderResources,
    attribute,
    attributeIndex,
  );

  const attributeInfo = getMorphTargetAttributeInfo(
    attribute,
    scratchAttributeInfo,
  );

  addMorphTargetAttributeDeclarationAndFunctionLine(
    shaderBuilder,
    attributeInfo,
    morphTargetIndex,
  );
}

function addMorphTargetAttributeToRenderResources(
  renderResources,
  attribute,
  attributeIndex,
) {
  const vertexAttribute = {
    index: attributeIndex,
    value: defined(attribute.buffer) ? undefined : attribute.constant,
    vertexBuffer: attribute.buffer,
    componentsPerAttribute: AttributeType.getNumberOfComponents(attribute.type),
    componentDatatype: attribute.componentDatatype,
    offsetInBytes: attribute.byteOffset,
    strideInBytes: attribute.byteStride,
    normalize: attribute.normalized,
  };

  renderResources.attributes.push(vertexAttribute);
}

function getMorphTargetAttributeInfo(attribute, result) {
  const semantic = attribute.semantic;
  switch (semantic) {
    case VertexAttributeSemantic.POSITION:
      result.attributeString = "Position";
      result.functionId =
        MorphTargetsPipelineStage.FUNCTION_ID_GET_MORPHED_POSITION;
      break;
    case VertexAttributeSemantic.NORMAL:
      result.attributeString = "Normal";
      result.functionId =
        MorphTargetsPipelineStage.FUNCTION_ID_GET_MORPHED_NORMAL;
      break;
    case VertexAttributeSemantic.TANGENT:
      result.attributeString = "Tangent";
      result.functionId =
        MorphTargetsPipelineStage.FUNCTION_ID_GET_MORPHED_TANGENT;
      break;
    default:
      break;
  }
  return result;
}

function addMorphTargetAttributeDeclarationAndFunctionLine(
  shaderBuilder,
  attributeInfo,
  morphTargetIndex,
) {
  const attributeString = attributeInfo.attributeString;
  const attributeName = `a_target${attributeString}_${morphTargetIndex}`;
  const line = `morphed${attributeString} += u_morphWeights[${morphTargetIndex}] * a_target${attributeString}_${morphTargetIndex};`;
  shaderBuilder.addAttribute("vec3", attributeName);
  shaderBuilder.addFunctionLines(attributeInfo.functionId, [line]);
}

function addGetMorphedAttributeFunctionDeclarations(shaderBuilder) {
  shaderBuilder.addFunction(
    MorphTargetsPipelineStage.FUNCTION_ID_GET_MORPHED_POSITION,
    MorphTargetsPipelineStage.FUNCTION_SIGNATURE_GET_MORPHED_POSITION,
    ShaderDestination.VERTEX,
  );

  const positionLine = "vec3 morphedPosition = position;";
  shaderBuilder.addFunctionLines(
    MorphTargetsPipelineStage.FUNCTION_ID_GET_MORPHED_POSITION,
    [positionLine],
  );

  shaderBuilder.addFunction(
    MorphTargetsPipelineStage.FUNCTION_ID_GET_MORPHED_NORMAL,
    MorphTargetsPipelineStage.FUNCTION_SIGNATURE_GET_MORPHED_NORMAL,
    ShaderDestination.VERTEX,
  );

  const normalLine = "vec3 morphedNormal = normal;";
  shaderBuilder.addFunctionLines(
    MorphTargetsPipelineStage.FUNCTION_ID_GET_MORPHED_NORMAL,
    [normalLine],
  );

  shaderBuilder.addFunction(
    MorphTargetsPipelineStage.FUNCTION_ID_GET_MORPHED_TANGENT,
    MorphTargetsPipelineStage.FUNCTION_SIGNATURE_GET_MORPHED_TANGENT,
    ShaderDestination.VERTEX,
  );

  const tangentLine = "vec3 morphedTangent = tangent;";
  shaderBuilder.addFunctionLines(
    MorphTargetsPipelineStage.FUNCTION_ID_GET_MORPHED_TANGENT,
    [tangentLine],
  );
}

function addGetMorphedAttributeFunctionReturns(shaderBuilder) {
  const positionLine = "return morphedPosition;";
  shaderBuilder.addFunctionLines(
    MorphTargetsPipelineStage.FUNCTION_ID_GET_MORPHED_POSITION,
    [positionLine],
  );

  const normalLine = "return morphedNormal;";
  shaderBuilder.addFunctionLines(
    MorphTargetsPipelineStage.FUNCTION_ID_GET_MORPHED_NORMAL,
    [normalLine],
  );

  const tangentLine = "return morphedTangent;";
  shaderBuilder.addFunctionLines(
    MorphTargetsPipelineStage.FUNCTION_ID_GET_MORPHED_TANGENT,
    [tangentLine],
  );
}

export default MorphTargetsPipelineStage;
