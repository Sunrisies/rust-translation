import { AttributeType } from "@cesium/core";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import PrimitiveOutlineGenerator from "./PrimitiveOutlineGenerator.js";
import PrimitiveOutlineStageVS from "../../Shaders/Model/PrimitiveOutlineStageVS.js";
import PrimitiveOutlineStageFS from "../../Shaders/Model/PrimitiveOutlineStageFS.js";

/**
 * 原始轮廓管道阶段配置着色器以渲染轮廓
 * 来自 CESIUM_primitive_outline 扩展
 *
 * @namespace PrimitiveOutlinePipelineStage
 *
 * @private
 */
const PrimitiveOutlinePipelineStage = {
  name: "PrimitiveOutlinePipelineStage", // Helps with debugging
};

/**
 * 处理一个原始实体。这会修改渲染资源中的以下部分：
 * 资源：
 * <ul>
 * <li>为轮廓（纹理）坐标声明新属性</li>
 * <li>在光照计算后添加着色器代码以在原始实体上叠加轮廓</li>
 * <li>添加用于显示轮廓和改变其颜色的统一变量</li>
 * </ul>
 * @param {PrimitiveRenderResources} renderResources 原始实体的渲染资源
 * @param {ModelComponents.Primitive} primitive 要渲染的实体
 * @param {FrameState} frameState 帧状态
 * @private
 */
PrimitiveOutlinePipelineStage.process = function (
  renderResources,
  primitive,
  frameState,
) {
  const shaderBuilder = renderResources.shaderBuilder;
  const uniformMap = renderResources.uniformMap;

  shaderBuilder.addDefine(
    "HAS_PRIMITIVE_OUTLINE",
    undefined,
    ShaderDestination.BOTH,
  );

  shaderBuilder.addAttribute("vec3", "a_outlineCoordinates");
  shaderBuilder.addVarying("vec3", "v_outlineCoordinates");

  const outlineCoordinates = primitive.outlineCoordinates;
  const vertexAttribute = {
    index: renderResources.attributeIndex++,
    vertexBuffer: outlineCoordinates.buffer,
    componentsPerAttribute: AttributeType.getNumberOfComponents(
      outlineCoordinates.type,
    ),
    componentDatatype: outlineCoordinates.componentDatatype,
    offsetInBytes: outlineCoordinates.byteOffset,
    strideInBytes: outlineCoordinates.byteStride,
    normalize: outlineCoordinates.normalized,
  };
  renderResources.attributes.push(vertexAttribute);

  shaderBuilder.addUniform(
    "sampler2D",
    "model_outlineTexture",
    ShaderDestination.FRAGMENT,
  );

  // This automatically handles caching the texture on the context
  const outlineTexture = PrimitiveOutlineGenerator.createTexture(
    frameState.context,
  );
  uniformMap.model_outlineTexture = function () {
    return outlineTexture;
  };

  const model = renderResources.model;
  shaderBuilder.addUniform(
    "vec4",
    "model_outlineColor",
    ShaderDestination.FRAGMENT,
  );
  uniformMap.model_outlineColor = function () {
    return model.outlineColor;
  };
  shaderBuilder.addUniform(
    "bool",
    "model_showOutline",
    ShaderDestination.FRAGMENT,
  );
  uniformMap.model_showOutline = function () {
    return model.showOutline;
  };

  shaderBuilder.addVertexLines(PrimitiveOutlineStageVS);
  shaderBuilder.addFragmentLines(PrimitiveOutlineStageFS);
};

export default PrimitiveOutlinePipelineStage;
