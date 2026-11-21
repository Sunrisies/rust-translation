import { Color, ComponentDatatype, defined } from "@cesium/core";
import Buffer from "../../Renderer/Buffer.js";
import BufferUsage from "../../Renderer/BufferUsage.js";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import ModelType from "./ModelType.js";
import ModelUtility from "./ModelUtility.js";

/**
 * 拾取处理阶段负责处理基本体的拾取操作。
 *
 * @namespace PickingPipelineStage
 * @private
 */
const PickingPipelineStage = {
  name: "PickingPipelineStage", // Helps with debugging
};

/**
 * 构建在
 * 捕捉阶段（参见 {@link Scene#snap}）中编写的浮点捕捉数据量的 GLSL 表达式，该表达式从评估值
 * 转换为实体 RGBA8 归一化拾取颜色。
 *
 * 通道布局（RGBA32F 捕捉帧缓冲区）：
 * <ul>
 * <li>R：拾取 ID，通过
 * <code>rgba8UnormToUint32</code> 函数从 RGBA8 拾取颜色转换为 uint32（由 DerivedCommand.createSnapDerivedCommand 注入）。
 * 隐式转换为 float32，实际发生的拾取 ID 数量远多于此值。</li>
 * <li>G：isEdge 标志（0.0/1.0）。<code>isEdge</code> 是 ModelFS.glsl 全局变量，由
 * 在 <code>u_isEdgePass</code> 下由边缘通道片段设置。</li>
 * <li>B：线性眼空间深度（<code>-v_positionEC.z</code>，米）。眼空间是
 * 跨多视锥体全局的，与对数深度编码无关。</li>
 * <li>A：未使用</li>
 * </ul>
 *
 * @param {string} pickId RGBA8 拾取颜色的 GLSL 表达式。
 * @returns {string} The 捕捉数据量的 GLSL 表达式。
 *
 * @private
 */
function snapIdFromPickId(pickId) {
  return `vec4(rgba8UnormToUint32(${pickId}), isEdge ? 1.0 : 0.0, -v_positionEC.z, 0.0)`;
}

/**
 * 处理一个基本体。这修改了渲染资源的以下部分：
 * <ul>
 * <li>为实例化的网格中的顶点着色器中的拾取颜色顶点属性添加属性和变量声明</li>
 * <li>为非实例化网格添加拾取颜色统一变量的声明</li>
 * <li>在启用拾取时添加着色器中的定义</li>
 * <li>在上下文中创建拾取 ID 对象</li>
 * </ul>
 * @param {PrimitiveRenderResources} renderResources 该基本体的渲染资源。
 * @param {ModelComponents.Primitive} primitive 该基本体。
 * @param {FrameState} frameState 帧状态。
 */
PickingPipelineStage.process = function (
  renderResources,
  primitive,
  frameState,
) {
  const context = frameState.context;
  const runtimeNode = renderResources.runtimeNode;
  const shaderBuilder = renderResources.shaderBuilder;
  const model = renderResources.model;
  const instances = runtimeNode.node.instances;

  if (renderResources.hasPropertyTable) {
    processPickTexture(renderResources, primitive, instances, context);
  } else if (defined(instances)) {
    // For instanced meshes, a pick color vertex attribute is used.
    processInstancedPickIds(renderResources, context);
  } else {
    // For non-instanced meshes, a pick color uniform is used.
    const pickObject = buildPickObject(renderResources);

    const pickId = context.createPickId(pickObject);
    model._pipelineResources.push(pickId);
    model._pickIds.push(pickId);

    shaderBuilder.addUniform(
      "vec4",
      "czm_pickColor",
      ShaderDestination.FRAGMENT,
    );

    const uniformMap = renderResources.uniformMap;
    uniformMap.czm_pickColor = function () {
      return pickId.color;
    };

    renderResources.pickId = "czm_pickColor";
    renderResources.snapId = snapIdFromPickId(renderResources.pickId);
  }

  if (!defined(model.classificationType) && model.hasDrapedVectors()) {
    renderResources.pickId = `vectorPickColorOver(${renderResources.pickId})`;
  }
};

/**
 * @private
 */
function buildPickObject(renderResources, instanceId) {
  const model = renderResources.model;

  // Primitives that wrap Model may define the pickObject differently.
  if (defined(model.pickObject)) {
    return model.pickObject;
  }

  const detailPickObject = {
    model: model,
    node: renderResources.runtimeNode,
    primitive: renderResources.runtimePrimitive,
  };

  let pickObject;

  if (ModelType.is3DTiles(model.type)) {
    // For 3D Tiles, the pick object's content and primitive are set to the Cesium3DTileContent that owns the model
    // and the tileset it belongs to, respectively. The detail pick object is returned under the detail key.
    const content = model.content;
    pickObject = {
      content: content,
      primitive: content.tileset,
      detail: detailPickObject,
    };
  } else {
    // For models, the model itself is returned as the primitive, with the detail pick object under the detail key.
    pickObject = {
      primitive: model,
      detail: detailPickObject,
    };
  }

  pickObject.id = model.id;

  if (defined(instanceId)) {
    // For instanced models, an instanceId property is added to the pick object.
    pickObject.instanceId = instanceId;
  }

  return pickObject;
}

function processPickTexture(renderResources, primitive, instances) {
  const model = renderResources.model;
  let featureTableId;
  let featureIdAttribute;
  const featureIdLabel = model.featureIdLabel;
  const instanceFeatureIdLabel = model.instanceFeatureIdLabel;

  if (defined(model.featureTableId)) {
    // Extract the Feature Table ID from the Cesium3DTileContent.
    featureTableId = model.featureTableId;
  } else if (defined(instances)) {
    // Extract the Feature Table ID from the instanced Feature ID attributes.
    featureIdAttribute = ModelUtility.getFeatureIdsByLabel(
      instances.featureIds,
      instanceFeatureIdLabel,
    );
    featureTableId = featureIdAttribute.propertyTableId;
  } else {
    // Extract the Feature Table ID from the primitive Feature ID attributes.
    featureIdAttribute = ModelUtility.getFeatureIdsByLabel(
      primitive.featureIds,
      featureIdLabel,
    );
    featureTableId = featureIdAttribute.propertyTableId;
  }

  const featureTable = model.featureTables[featureTableId];

  const shaderBuilder = renderResources.shaderBuilder;
  shaderBuilder.addUniform(
    "sampler2D",
    "model_pickTexture",
    ShaderDestination.FRAGMENT,
  );

  const batchTexture = featureTable.batchTexture;
  renderResources.uniformMap.model_pickTexture = function () {
    return batchTexture.pickTexture ?? batchTexture.defaultTexture;
  };

  // The feature ID is ignored if it is greater than the number of features.
  renderResources.pickId =
    "((selectedFeature.id < int(model_featuresLength)) ? texture(model_pickTexture, selectedFeature.st) : vec4(0.0))";
  renderResources.snapId = snapIdFromPickId(renderResources.pickId);
}

function processInstancedPickIds(renderResources, context) {
  const instanceCount = renderResources.instanceCount;
  const pickIds = new Array(instanceCount);
  const pickIdsTypedArray = new Uint8Array(instanceCount * 4);

  const model = renderResources.model;

  const pipelineResources = model._pipelineResources;
  for (let i = 0; i < instanceCount; i++) {
    const pickObject = buildPickObject(renderResources, i);

    const pickId = context.createPickId(pickObject);
    pipelineResources.push(pickId);
    pickIds[i] = pickId;

    const pickColor = pickId.color;
    pickIdsTypedArray[i * 4 + 0] = Color.floatToByte(pickColor.red);
    pickIdsTypedArray[i * 4 + 1] = Color.floatToByte(pickColor.green);
    pickIdsTypedArray[i * 4 + 2] = Color.floatToByte(pickColor.blue);
    pickIdsTypedArray[i * 4 + 3] = Color.floatToByte(pickColor.alpha);
  }

  model._pickIds = pickIds;

  const pickIdsBuffer = Buffer.createVertexBuffer({
    context: context,
    typedArray: pickIdsTypedArray,
    usage: BufferUsage.STATIC_DRAW,
  });
  // Destruction of resources allocated by the Model
  // is handled by Model.destroyPipelineResources().
  pickIdsBuffer.vertexArrayDestroyable = false;
  const hasCpuCopy = false;
  model.statistics.addBuffer(pickIdsBuffer, hasCpuCopy);
  pipelineResources.push(pickIdsBuffer);

  const pickIdsVertexAttribute = {
    index: renderResources.attributeIndex++,
    vertexBuffer: pickIdsBuffer,
    componentsPerAttribute: 4,
    componentDatatype: ComponentDatatype.UNSIGNED_BYTE,
    normalize: true,
    offsetInBytes: 0,
    strideInBytes: 0,
    instanceDivisor: 1,
  };

  renderResources.attributes.push(pickIdsVertexAttribute);

  const shaderBuilder = renderResources.shaderBuilder;
  shaderBuilder.addDefine("USE_PICKING", undefined, ShaderDestination.BOTH);
  shaderBuilder.addAttribute("vec4", "a_pickColor");
  shaderBuilder.addVarying("vec4", "v_pickColor");
  renderResources.pickId = "v_pickColor";
  renderResources.snapId = snapIdFromPickId(renderResources.pickId);
}

export default PickingPipelineStage;
