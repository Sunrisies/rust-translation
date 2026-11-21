import {
  Check,
  Frozen,
  PrimitiveType,
  defined,
  oneTimeWarning,
} from "@cesium/core";
import SceneMode from "../SceneMode.js";
import AlphaPipelineStage from "./AlphaPipelineStage.js";
import BatchTexturePipelineStage from "./BatchTexturePipelineStage.js";
import ClassificationPipelineStage from "./ClassificationPipelineStage.js";
import CPUStylingPipelineStage from "./CPUStylingPipelineStage.js";
import CustomShaderMode from "./CustomShaderMode.js";
import CustomShaderPipelineStage from "./CustomShaderPipelineStage.js";
import DequantizationPipelineStage from "./DequantizationPipelineStage.js";
import EdgeDetectionPipelineStage from "./EdgeDetectionPipelineStage.js";
import EdgeVisibilityPipelineStage from "./EdgeVisibilityPipelineStage.js";
import FeatureIdPipelineStage from "./FeatureIdPipelineStage.js";
import GeometryPipelineStage from "./GeometryPipelineStage.js";
import ImageryPipelineStage from "./ImageryPipelineStage.js";
import LightingPipelineStage from "./LightingPipelineStage.js";
import MaterialPipelineStage from "./MaterialPipelineStage.js";
import MetadataPickingPipelineStage from "./MetadataPickingPipelineStage.js";
import MetadataPipelineStage from "./MetadataPipelineStage.js";
import ModelUtility from "./ModelUtility.js";
import MorphTargetsPipelineStage from "./MorphTargetsPipelineStage.js";
import PickingPipelineStage from "./PickingPipelineStage.js";
import PointCloudStylingPipelineStage from "./PointCloudStylingPipelineStage.js";
import PrimitiveOutlinePipelineStage from "./PrimitiveOutlinePipelineStage.js";
import PrimitiveStatisticsPipelineStage from "./PrimitiveStatisticsPipelineStage.js";
import SceneMode2DPipelineStage from "./SceneMode2DPipelineStage.js";
import SelectedFeatureIdPipelineStage from "./SelectedFeatureIdPipelineStage.js";
import SkinningPipelineStage from "./SkinningPipelineStage.js";
import VerticalExaggerationPipelineStage from "./VerticalExaggerationPipelineStage.js";
import WireframePipelineStage from "./WireframePipelineStage.js";

/**
 * 单个基本体的内存表示，即一个基本体及其对应的网格。
 * 以及对应的网格。
 *
 * @param {object} options 包含以下选项的对象：
 * @param {ModelComponents.Primitive} options.primitive 基本体组件。
 * @param {ModelComponents.Node} options.node 该基本体所属的节点。
 * @param {Model} options.model 该基本体所属的 {@link Model}。
 *
 * @alias ModelRuntimePrimitive
 * @constructor
 *
 * @private
 */
function ModelRuntimePrimitive(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const primitive = options.primitive;
  const node = options.node;
  const model = options.model;
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.primitive", primitive);
  Check.typeOf.object("options.node", node);
  Check.typeOf.object("options.model", model);
  //>>includeEnd('debug');

  /**
   * 与该基本体相关的基本体组件。
   *
   * @type {ModelComponents.Primitive}
   *
   * @private
   */
  this.primitive = primitive;

  /**
   * 该基本体所属节点的引用。
   *
   * @type {ModelComponents.Node}
   *
   * @private
   */
  this.node = node;

  /**
   * 模型的引用。
   *
   * @type {Model}
   *
   * @private
   */
  this.model = model;

  /**
   * 应用于该基本体的管道阶段。这
   * 是一个类数组，每个类都包含一个名为
   * <code>process()</code>的静态方法。
   *
   * @type {object[]}
   * @readonly
   *
   * @private
   */
  this.pipelineStages = [];

  /**
   * 生成的 {@link ModelDrawCommand} 或 {@link ClassificationModelDrawCommand}
   * 与该基本体相关的。
   *
   * @type {ModelDrawCommand|ClassificationModelDrawCommand}
   *
   * @private
   */
  this.drawCommand = undefined;

  /**
   * 该基本体在对象空间中的边界球。
   *
   * @type {BoundingSphere}
   *
   * @private
   */
  this.boundingSphere = undefined;

  /**
   * 该基本体在2D世界空间中的边界球。
   *
   * @type {BoundingSphere}
   *
   * @private
   */
  this.boundingSphere2D = undefined;

  /**
   * 包含投影到2D世界坐标的基本体位置的缓冲区。此数据由SceneMode2DPipelineStage生成，用于
   * 2D / CV模式下的渲染。内存由Model管理；这只是一个引用。
   * 用于分类的顶点批次长度数组。
   * 具有相同特征ID的顶点被组合在一起，每个批次使用不同的绘制命令，以便正确分类其他
   *
   * @type {Buffer}
   *
   * @private
   */
  this.positionBuffer2D = undefined;

  /**
   * 资产。
   * 由ClassificationPipelineStage生成。内存由Model管理；这只是一个引用。
   * 用于分类的顶点批次偏移量数组。
   * 具有相同特征ID的顶点被组合在一起，每个批次使用不同的绘制命令，以便正确分类其他
   * <p>
   * 资产。
   * 由ClassificationPipelineStage生成。内存由Model管理；这只是一个引用。
   * </p>
   *
   * @type {number[]}
   *
   * @private
   */
  this.batchLengths = undefined;

  /**
   * 用于分类的顶点批次偏移量数组。
   * 具有相同特征ID的顶点被组合在一起，每个批次使用不同的绘制命令，以便正确分类其他
   * 资产。
   * 由ClassificationPipelineStage生成。内存由Model管理；这只是一个引用。
   * <p>
   * 应用于该基本体的更新阶段。
   * 配置基本体管道阶段。如果需要重新运行管道，
   * </p>
   *
   * @type {number[]}
   *
   * @private
   */
  this.batchOffsets = undefined;

  /**
   * 再次调用此方法，以确保使用正确的管道阶段顺序。
   *
   * @type {object[]}
   * @readonly
   *
   * @private
   */
  this.updateStages = [];
}

/**
 * 帧状态。
 * call this method again to ensure the correct sequence of pipeline stages are
 * used.
 *
 * @param {FrameState} frameState The frame state.
 *
 * @private
 */
ModelRuntimePrimitive.prototype.configurePipeline = function (frameState) {
  const pipelineStages = this.pipelineStages;
  pipelineStages.length = 0;

  const primitive = this.primitive;
  const node = this.node;
  const model = this.model;

  const customShader = model.customShader;
  const style = model.style;

  const useWebgl2 = frameState.context.webgl2;
  const mode = frameState.mode;
  const use2D =
    mode !== SceneMode.SCENE3D && !frameState.scene3DOnly && model._projectTo2D;
  const hasVerticalExaggeration =
    frameState.verticalExaggeration !== 1.0 && model.hasVerticalExaggeration;

  const hasMorphTargets =
    defined(primitive.morphTargets) && primitive.morphTargets.length > 0;
  const hasSkinning = defined(node.skin);

  // Check whether the model is part of a `Model3DTileContent` that
  // belongs to a tileset that has imagery layers. If this is the
  // case, then the `ImageryPipelineStage` will be required.
  const hasImageryLayers =
    defined(model.imageryLayers) && model.imageryLayers.length > 0;

  const hasCustomShader = defined(customShader);
  const hasCustomFragmentShader =
    hasCustomShader && defined(customShader.fragmentShaderText);
  const materialsEnabled =
    !hasCustomFragmentShader ||
    customShader.mode !== CustomShaderMode.REPLACE_MATERIAL;
  const hasQuantization = ModelUtility.hasQuantizedAttributes(
    primitive.attributes,
  );

  const generateWireframeIndices =
    model.debugWireframe &&
    PrimitiveType.isTriangles(primitive.primitiveType) &&
    // Generating index buffers for wireframes is always possible in WebGL2.
    // However, this will only work in WebGL1 if the model was constructed with
    // enableDebugWireframe set to true.
    (model._enableDebugWireframe || useWebgl2);

  const pointCloudShading = model.pointCloudShading;
  const hasAttenuation =
    defined(pointCloudShading) && pointCloudShading.attenuation;
  const hasPointCloudBackFaceCulling =
    defined(pointCloudShading) && pointCloudShading.backFaceCulling;
  const hasPointCloudStyle =
    primitive.primitiveType === PrimitiveType.POINTS &&
    (defined(style) || hasAttenuation || hasPointCloudBackFaceCulling);

  const hasOutlines =
    model._enableShowOutline && defined(primitive.outlineCoordinates);

  // Edge geometry is built lazily; see updateEdgeGeometryNeeded in Model.js.
  const hasEdgeVisibility =
    defined(primitive.edgeVisibility) && model._edgeGeometryNeeded;

  const featureIdFlags = inspectFeatureIds(model, node, primitive);

  const hasClassification = defined(model.classificationType);

  // Start of pipeline -----------------------------------------------------
  if (use2D) {
    pipelineStages.push(SceneMode2DPipelineStage);
  }

  pipelineStages.push(GeometryPipelineStage);

  if (generateWireframeIndices) {
    pipelineStages.push(WireframePipelineStage);
  }

  if (hasClassification) {
    pipelineStages.push(ClassificationPipelineStage);
  }

  if (hasMorphTargets) {
    pipelineStages.push(MorphTargetsPipelineStage);
  }

  if (hasSkinning) {
    pipelineStages.push(SkinningPipelineStage);
  }

  if (hasPointCloudStyle) {
    pipelineStages.push(PointCloudStylingPipelineStage);
  }

  if (hasQuantization) {
    pipelineStages.push(DequantizationPipelineStage);
  }

  if (hasImageryLayers) {
    if (hasOutlines) {
      oneTimeWarning(
        "outlines-and-draping",
        "Primitive outlines disable imagery draping",
      );
    } else {
      pipelineStages.push(ImageryPipelineStage);
    }
  }

  if (materialsEnabled) {
    pipelineStages.push(MaterialPipelineStage);
  }

  // These stages are always run to ensure structs
  // are declared to avoid compilation errors.
  pipelineStages.push(FeatureIdPipelineStage);
  pipelineStages.push(MetadataPipelineStage);
  pipelineStages.push(MetadataPickingPipelineStage);

  if (featureIdFlags.hasPropertyTable) {
    pipelineStages.push(SelectedFeatureIdPipelineStage);
    pipelineStages.push(BatchTexturePipelineStage);
    pipelineStages.push(CPUStylingPipelineStage);
  }

  if (hasVerticalExaggeration) {
    pipelineStages.push(VerticalExaggerationPipelineStage);
  }

  if (hasCustomShader) {
    pipelineStages.push(CustomShaderPipelineStage);
  }

  pipelineStages.push(LightingPipelineStage);

  if (model.allowPicking) {
    pipelineStages.push(PickingPipelineStage);
  }

  if (hasOutlines) {
    pipelineStages.push(PrimitiveOutlinePipelineStage);
  }

  if (hasEdgeVisibility) {
    pipelineStages.push(EdgeVisibilityPipelineStage);
    pipelineStages.push(EdgeDetectionPipelineStage);
  }

  pipelineStages.push(AlphaPipelineStage);

  pipelineStages.push(PrimitiveStatisticsPipelineStage);

  return;
};

function inspectFeatureIds(model, node, primitive) {
  let featureIds;
  // Check instances first, as this is the most specific type of
  // feature ID
  if (defined(node.instances)) {
    featureIds = ModelUtility.getFeatureIdsByLabel(
      node.instances.featureIds,
      model.instanceFeatureIdLabel,
    );

    if (defined(featureIds)) {
      return {
        hasFeatureIds: true,
        hasPropertyTable: defined(featureIds.propertyTableId),
      };
    }
  }

  featureIds = ModelUtility.getFeatureIdsByLabel(
    primitive.featureIds,
    model.featureIdLabel,
  );
  if (defined(featureIds)) {
    return {
      hasFeatureIds: true,
      hasPropertyTable: defined(featureIds.propertyTableId),
    };
  }

  return {
    hasFeatureIds: false,
    hasPropertyTable: false,
  };
}

export default ModelRuntimePrimitive;
