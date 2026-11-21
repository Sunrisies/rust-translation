import {
  BoundingSphere,
  Cartesian3,
  Check,
  FixedFrameTransforms,
  Frozen,
  Matrix4,
  addAllToArray,
  defined,
  oneTimeWarning,
} from "@cesium/core";
import SceneMode from "../SceneMode.js";
import SplitDirection from "../SplitDirection.js";
import TilesetPipelineStage from "./TilesetPipelineStage.js";
import AtmospherePipelineStage from "./AtmospherePipelineStage.js";
import ImageBasedLightingPipelineStage from "./ImageBasedLightingPipelineStage.js";
import ModelArticulation from "./ModelArticulation.js";
import ModelColorPipelineStage from "./ModelColorPipelineStage.js";
import ModelClippingPlanesPipelineStage from "./ModelClippingPlanesPipelineStage.js";
import ModelClippingPolygonsPipelineStage from "./ModelClippingPolygonsPipelineStage.js";
import ModelVectorLookupPipelineStage from "./ModelVectorLookupPipelineStage.js";
import ModelNode from "./ModelNode.js";
import ModelRuntimeNode from "./ModelRuntimeNode.js";
import ModelRuntimePrimitive from "./ModelRuntimePrimitive.js";
import ModelSkin from "./ModelSkin.js";
import ModelUtility from "./ModelUtility.js";
import ModelRenderResources from "./ModelRenderResources.js";
import ModelSilhouettePipelineStage from "./ModelSilhouettePipelineStage.js";
import ModelSplitterPipelineStage from "./ModelSplitterPipelineStage.js";
import ModelType from "./ModelType.js";
import NodeRenderResources from "./NodeRenderResources.js";
import PrimitiveRenderResources from "./PrimitiveRenderResources.js";
import ModelDrawCommands from "./ModelDrawCommands.js";

/**
 * 场景图的内存表示形式，对应 {@link Model}。
 *
 * @param {object} options 包含以下选项的对象。
 * @param {Model} options.model 该场景图所属的模型。
 * @param {ModelComponents} options.modelComponents 描述模型的模型组件。
 *
 * @alias ModelSceneGraph
 * @constructor
 *
 * @private
 */
function ModelSceneGraph(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const components = options.modelComponents;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.model", options.model);
  Check.typeOf.object("options.modelComponents", components);
  //>>includeEnd('debug');

  /**
   * 对拥有此场景图的 {@link Model} 的引用。
   *
   * @type {Model}
   * @readonly
   *
   * @private
   */
  this._model = options.model;

  /**
   * 代表 3D 模型文件内容的模型组件。
   *
   * @type {ModelComponents}
   * @readonly
   *
   * @private
   */
  this._components = components;

  /**
   * 在模型中应用的管道阶段。
   *
   * @type {object[]}
   * @readonly
   *
   * @private
   */
  this._pipelineStages = [];

  /**
   * 在模型中应用的更新阶段。
   *
   * @type {object[]}
   * @readonly
   *
   * @private
   */
  this._updateStages = [];

  /**
   * 构成场景图的运行时节点。
   *
   * @type {ModelRuntimeNode[]}
   * @readonly
   *
   * @private
   */
  this._runtimeNodes = [];

  /**
   * 运行时节点数组中根节点的索引。
   *
   * @type {number[]}
   * @readonly
   *
   * @private
   */
  this._rootNodes = [];

  /**
   * 运行时节点数组中蒙皮节点的索引。这些索引指的是
   * 将通过蒙皮进行操作的节点，而不是作为蒙皮关节的节点。
   * 影响场景图中节点的运行时蒙皮。
   *
   * @type {number[]}
   * @readonly
   *
   * @private
   */
  this._skinnedNodes = [];

  /**
   * 影响场景图中节点的运行时蒙皮。
   *
   * @type {ModelSkin[]}
   * @readonly
   *
   * @private
   */
  this._runtimeSkins = [];

  /**
   * 应用于此模型的管道阶段。这
   * 是一个类数组，每个类都有一个名为
   * <code>process()</code> 的静态方法。
   *
   * @type {object[]}
   * @readonly
   *
   * @private
   */
  this.modelPipelineStages = [];

  // The scene graph's bounding sphere is model space, so that
  // the model's bounding sphere can be recomputed when given a
  // new model matrix.
  this._boundingSphere = undefined;

  // The 2D bounding sphere is in world space. This is checked
  // by the draw commands to see if the model is over the IDL,
  // and if so, renders the primitives using extra commands.
  this._boundingSphere2D = undefined;

  this._computedModelMatrix = Matrix4.clone(Matrix4.IDENTITY);
  this._computedModelMatrix2D = Matrix4.clone(Matrix4.IDENTITY);

  this._axisCorrectionMatrix = ModelUtility.getAxisCorrectionMatrix(
    components.upAxis,
    components.forwardAxis,
    new Matrix4(),
  );

  // Store articulations from the AGI_articulations extension
  // by name in a dictionary for easy retrieval.
  this._runtimeArticulations = {};

  initialize(this);
}

Object.defineProperties(ModelSceneGraph.prototype, {
  /**
   * 该场景图所代表的模型组件。
   *
   * @type {ModelComponents}
   * @readonly
   *
   * @private
   */
  components: {
    get: function () {
      return this._components;
    },
  },

  /**
   * 轴校正后的模型矩阵。
   *
   * @type {Matrix4}
   * @readonly
   *
   * @private
   */
  computedModelMatrix: {
    get: function () {
      return this._computedModelMatrix;
    },
  },

  /**
   * 用于在某些模型格式中从 y-up 坐标系校正为
   * Cesium 使用的 z-up 坐标系的矩阵。
   *
   * @type {Matrix4}
   * @readonly
   *
   * @private
   */
  axisCorrectionMatrix: {
    get: function () {
      return this._axisCorrectionMatrix;
    },
  },

  /**
   * 包含场景图中所有基元的边界球，位于模型空间中。
   * 在模型空间中。
   *
   * @type {BoundingSphere}
   * @readonly
   *
   * @private
   */
  boundingSphere: {
    get: function () {
      return this._boundingSphere;
    },
  },
});

function initialize(sceneGraph) {
  const components = sceneGraph._components;
  const scene = components.scene;
  const model = sceneGraph._model;

  // If the model has a height reference that modifies the model matrix,
  // it will be accounted for in updateModelMatrix.
  const modelMatrix = model.modelMatrix;
  computeModelMatrix(sceneGraph, modelMatrix);

  const articulations = components.articulations;
  const articulationsLength = articulations.length;

  const runtimeArticulations = sceneGraph._runtimeArticulations;
  for (let i = 0; i < articulationsLength; i++) {
    const articulation = articulations[i];
    const runtimeArticulation = new ModelArticulation({
      articulation: articulation,
      sceneGraph: sceneGraph,
    });

    const name = runtimeArticulation.name;
    runtimeArticulations[name] = runtimeArticulation;
  }

  const nodes = components.nodes;
  const nodesLength = nodes.length;

  // Initialize this array to be the same size as the nodes array in
  // the model file. This is so the node indices remain the same. However,
  // only nodes reachable from the scene's root node will be populated, the
  // rest will be undefined
  sceneGraph._runtimeNodes = new Array(nodesLength);

  const rootNodes = scene.nodes;
  const rootNodesLength = rootNodes.length;
  const transformToRoot = Matrix4.IDENTITY;
  for (let i = 0; i < rootNodesLength; i++) {
    const rootNode = scene.nodes[i];

    const rootNodeIndex = traverseAndCreateSceneGraph(
      sceneGraph,
      rootNode,
      transformToRoot,
    );

    sceneGraph._rootNodes.push(rootNodeIndex);
  }

  // Handle skins after all runtime nodes are created
  const skins = components.skins;
  const runtimeSkins = sceneGraph._runtimeSkins;

  const skinsLength = skins.length;
  for (let i = 0; i < skinsLength; i++) {
    const skin = skins[i];
    runtimeSkins.push(
      new ModelSkin({
        skin: skin,
        sceneGraph: sceneGraph,
      }),
    );
  }

  const skinnedNodes = sceneGraph._skinnedNodes;
  const skinnedNodesLength = skinnedNodes.length;
  for (let i = 0; i < skinnedNodesLength; i++) {
    const skinnedNodeIndex = skinnedNodes[i];
    const skinnedNode = sceneGraph._runtimeNodes[skinnedNodeIndex];

    // Use the index of the skin in the model components to find
    // the corresponding runtime skin.
    const skin = nodes[skinnedNodeIndex].skin;
    const skinIndex = skin.index;

    skinnedNode._runtimeSkin = runtimeSkins[skinIndex];
    skinnedNode.updateJointMatrices();
  }

  // Ensure articulations are applied with their initial values to their target nodes.
  sceneGraph.applyArticulations();
}

function computeModelMatrix(sceneGraph, modelMatrix) {
  const components = sceneGraph._components;
  const model = sceneGraph._model;

  sceneGraph._computedModelMatrix = Matrix4.multiplyTransformation(
    modelMatrix,
    components.transform,
    sceneGraph._computedModelMatrix,
  );

  sceneGraph._computedModelMatrix = Matrix4.multiplyTransformation(
    sceneGraph._computedModelMatrix,
    sceneGraph._axisCorrectionMatrix,
    sceneGraph._computedModelMatrix,
  );

  sceneGraph._computedModelMatrix = Matrix4.multiplyByUniformScale(
    sceneGraph._computedModelMatrix,
    model.computedScale,
    sceneGraph._computedModelMatrix,
  );
}

const scratchComputedTranslation = new Cartesian3();

function computeModelMatrix2D(sceneGraph, frameState) {
  const computedModelMatrix = sceneGraph._computedModelMatrix;
  const translation = Matrix4.getTranslation(
    computedModelMatrix,
    scratchComputedTranslation,
  );

  if (!Cartesian3.equals(translation, Cartesian3.ZERO)) {
    sceneGraph._computedModelMatrix2D = FixedFrameTransforms.basisTo2D(
      frameState.mapProjection,
      computedModelMatrix,
      sceneGraph._computedModelMatrix2D,
    );
  } else {
    const center = sceneGraph.boundingSphere.center;
    const to2D = FixedFrameTransforms.ellipsoidTo2DModelMatrix(
      frameState.mapProjection,
      center,
      sceneGraph._computedModelMatrix2D,
    );
    sceneGraph._computedModelMatrix2D = Matrix4.multiply(
      to2D,
      computedModelMatrix,
      sceneGraph._computedModelMatrix2D,
    );
  }

  sceneGraph._boundingSphere2D = BoundingSphere.transform(
    sceneGraph._boundingSphere,
    sceneGraph._computedModelMatrix2D,
    sceneGraph._boundingSphere2D,
  );
}

/**
 * 递归遍历场景图中的节点以创建
 * 它们的运行时版本，采用后序深度优先遍历方式。
 *
 * @param {ModelSceneGraph} sceneGraph 场景图
 * @param {ModelComponents.Node} node 当前节点
 * @param {Matrix4} transformToRoot 该节点祖先的变换。
 * @returns {number} The 运行时节点数组中该节点的索引。
 *
 * @private
 */
function traverseAndCreateSceneGraph(sceneGraph, node, transformToRoot) {
  // The indices of the children of this node in the runtimeNodes array.
  const childrenIndices = [];
  const transform = ModelUtility.getNodeTransform(node);

  // Traverse through scene graph.
  const childrenLength = node.children.length;
  for (let i = 0; i < childrenLength; i++) {
    const childNode = node.children[i];
    const childNodeTransformToRoot = Matrix4.multiplyTransformation(
      transformToRoot,
      transform,
      new Matrix4(),
    );

    const childIndex = traverseAndCreateSceneGraph(
      sceneGraph,
      childNode,
      childNodeTransformToRoot,
    );
    childrenIndices.push(childIndex);
  }

  // Process node and mesh primitives.
  const runtimeNode = new ModelRuntimeNode({
    node: node,
    transform: transform,
    transformToRoot: transformToRoot,
    children: childrenIndices,
    sceneGraph: sceneGraph,
  });

  const primitivesLength = node.primitives.length;
  for (let i = 0; i < primitivesLength; i++) {
    runtimeNode.runtimePrimitives.push(
      new ModelRuntimePrimitive({
        primitive: node.primitives[i],
        node: node,
        model: sceneGraph._model,
      }),
    );
  }

  const index = node.index;
  sceneGraph._runtimeNodes[index] = runtimeNode;
  if (defined(node.skin)) {
    sceneGraph._skinnedNodes.push(index);
  }

  // Create and store the public version of the runtime node.
  const name = node.name;
  if (defined(name)) {
    const model = sceneGraph._model;
    const publicNode = new ModelNode(model, runtimeNode);
    if (model._nodesByName.has(name)) {
      oneTimeWarning(
        "gltf-node-names-duplicate",
        `Duplicate node name ("${name}") found in glTF`,
      );
    }
    model._nodesByName.set(name, publicNode);
  }

  return index;
}

const scratchModelPositionMin = new Cartesian3();
const scratchModelPositionMax = new Cartesian3();
const scratchPrimitivePositionMin = new Cartesian3();
const scratchPrimitivePositionMax = new Cartesian3();

/**
 * 为模型中的每个基元生成 {@link ModelDrawCommand}。
 * If the model is used for classification, a {@link ClassificationModelDrawCommand}
 * 一个 {@link ClassificationModelDrawCommand}。
 *
 * @param {FrameState} frameState 当前帧状态。这是为了
 * 按需分配 GPU 资源而需要的。
 *
 * @private
 */
ModelSceneGraph.prototype.buildDrawCommands = function (frameState) {
  const modelRenderResources = this.buildRenderResources(frameState);
  this.computeBoundingVolumes(modelRenderResources);
  this.createDrawCommands(modelRenderResources, frameState);
};

/**
 * 为模型生成 {@link ModelRenderResources}。
 *
 * 这将遍历场景图中的模型、节点和基元，
 * 并执行以下任务：
 *
 * - 通过调用 `configurePipeline`、
 * `runtimeNode.configurePipeline` 和 `runtimePrimitive.configurePipeline`
 * - 创建 `ModelRenderResources`、`NodeRenderResources` 和
 * `PrimitiveRenderResources`
 * - 使用相应的管道处理渲染资源。
 *
 * @param {FrameState} frameState 当前帧状态。这是为了
 * 按需分配 GPU 资源而需要的。
 * @returns {ModelRenderResources} The 模型渲染资源
 *
 * @private
 */
ModelSceneGraph.prototype.buildRenderResources = function (frameState) {
  const model = this._model;
  const modelRenderResources = new ModelRenderResources(model);

  // Reset the memory counts before running the pipeline
  model.statistics.clear();

  this.configurePipeline(frameState);
  const modelPipelineStages = this.modelPipelineStages;

  for (let i = 0; i < modelPipelineStages.length; i++) {
    const modelPipelineStage = modelPipelineStages[i];
    modelPipelineStage.process(modelRenderResources, model, frameState);
  }

  for (let i = 0; i < this._runtimeNodes.length; i++) {
    const runtimeNode = this._runtimeNodes[i];

    // If a node in the model was unreachable from the scene graph, there will
    // be no corresponding runtime node and therefore should be skipped.
    if (!defined(runtimeNode)) {
      continue;
    }

    runtimeNode.configurePipeline();
    const nodePipelineStages = runtimeNode.pipelineStages;

    const nodeRenderResources = new NodeRenderResources(
      modelRenderResources,
      runtimeNode,
    );
    modelRenderResources.nodeRenderResources[i] = nodeRenderResources;

    for (let j = 0; j < nodePipelineStages.length; j++) {
      const nodePipelineStage = nodePipelineStages[j];

      nodePipelineStage.process(
        nodeRenderResources,
        runtimeNode.node,
        frameState,
      );
    }

    for (let j = 0; j < runtimeNode.runtimePrimitives.length; j++) {
      const runtimePrimitive = runtimeNode.runtimePrimitives[j];

      runtimePrimitive.configurePipeline(frameState);
      const primitivePipelineStages = runtimePrimitive.pipelineStages;

      const primitiveRenderResources = new PrimitiveRenderResources(
        nodeRenderResources,
        runtimePrimitive,
      );
      nodeRenderResources.primitiveRenderResources[j] =
        primitiveRenderResources;

      for (let k = 0; k < primitivePipelineStages.length; k++) {
        const primitivePipelineStage = primitivePipelineStages[k];
        primitivePipelineStage.process(
          primitiveRenderResources,
          runtimePrimitive.primitive,
          frameState,
        );
      }
    }
  }
  return modelRenderResources;
};

/**
 * 计算场景图和模型的边界体积。
 *
 * 这将遍历场景图中的模型、节点和基本元素，
 * 并计算边界体积。具体来说，它将计算
 *
 * - this._boundingSphere
 * - model._boundingSphere
 *
 * 后者在以下时间被修改：
 *
 * - model._initialRadius = model._boundingSphere.radius;
 * - model._boundingSphere.radius *= model._clampedScale;
 *
 * 注意：此代码包含一些错误。请参见 https://github.com/CesiumGS/cesium/issues/12108
 *
 * @param {ModelRenderResources} modelRenderResources 模型渲染资源
 *
 * @private
 */
ModelSceneGraph.prototype.computeBoundingVolumes = function (
  modelRenderResources,
) {
  const model = this._model;

  const modelPositionMin = Cartesian3.fromElements(
    Number.MAX_VALUE,
    Number.MAX_VALUE,
    Number.MAX_VALUE,
    scratchModelPositionMin,
  );
  const modelPositionMax = Cartesian3.fromElements(
    -Number.MAX_VALUE,
    -Number.MAX_VALUE,
    -Number.MAX_VALUE,
    scratchModelPositionMax,
  );

  for (let i = 0; i < this._runtimeNodes.length; i++) {
    const runtimeNode = this._runtimeNodes[i];

    // If a node in the model was unreachable from the scene graph, there will
    // be no corresponding runtime node and therefore should be skipped.
    if (!defined(runtimeNode)) {
      continue;
    }

    const nodeRenderResources = modelRenderResources.nodeRenderResources[i];
    const nodeTransform = runtimeNode.computedTransform;
    for (let j = 0; j < runtimeNode.runtimePrimitives.length; j++) {
      const runtimePrimitive = runtimeNode.runtimePrimitives[j];

      const primitiveRenderResources =
        nodeRenderResources.primitiveRenderResources[j];

      runtimePrimitive.boundingSphere = BoundingSphere.clone(
        primitiveRenderResources.boundingSphere,
        new BoundingSphere(),
      );

      const primitivePositionMin = Matrix4.multiplyByPoint(
        nodeTransform,
        primitiveRenderResources.positionMin,
        scratchPrimitivePositionMin,
      );
      const primitivePositionMax = Matrix4.multiplyByPoint(
        nodeTransform,
        primitiveRenderResources.positionMax,
        scratchPrimitivePositionMax,
      );

      Cartesian3.minimumByComponent(
        modelPositionMin,
        primitivePositionMin,
        modelPositionMin,
      );
      Cartesian3.maximumByComponent(
        modelPositionMax,
        primitivePositionMax,
        modelPositionMax,
      );
    }
  }

  this._boundingSphere = BoundingSphere.fromCornerPoints(
    modelPositionMin,
    modelPositionMax,
    new BoundingSphere(),
  );

  this._boundingSphere = BoundingSphere.transformWithoutScale(
    this._boundingSphere,
    this._axisCorrectionMatrix,
    this._boundingSphere,
  );

  this._boundingSphere = BoundingSphere.transform(
    this._boundingSphere,
    this._components.transform,
    this._boundingSphere,
  );

  model._boundingSphere = BoundingSphere.transform(
    this._boundingSphere,
    model.modelMatrix,
    model._boundingSphere,
  );

  model._initialRadius = model._boundingSphere.radius;
  model._boundingSphere.radius *= model._clampedScale;
};

/**
 * 为场景图中的基本元素创建绘制命令。
 *
 * 这将遍历场景图中的模型、节点和基本元素，
 * 并为这些基本元素创建相应的绘制命令，将其存储为 `runtimePrimitive.drawCommand`。
 * 模型渲染资源
 *
 * @param {ModelRenderResources} modelRenderResources 配置模型管道阶段。如果需要重新运行管道，请再次调用此方法以确保使用正确的管道阶段顺序。
 *
 * @private
 */
ModelSceneGraph.prototype.createDrawCommands = function (
  modelRenderResources,
  frameState,
) {
  for (let i = 0; i < this._runtimeNodes.length; i++) {
    const runtimeNode = this._runtimeNodes[i];

    // If a node in the model was unreachable from the scene graph, there will
    // be no corresponding runtime node and therefore should be skipped.
    if (!defined(runtimeNode)) {
      continue;
    }

    const nodeRenderResources = modelRenderResources.nodeRenderResources[i];

    for (let j = 0; j < runtimeNode.runtimePrimitives.length; j++) {
      const runtimePrimitive = runtimeNode.runtimePrimitives[j];

      const primitiveRenderResources =
        nodeRenderResources.primitiveRenderResources[j];

      const drawCommand = ModelDrawCommands.buildModelDrawCommand(
        primitiveRenderResources,
        frameState,
      );
      runtimePrimitive.drawCommand = drawCommand;
    }
  }
};

/**
 * 更新模型中的皮肤和节点的关节矩阵。
 * 在场景图中每个运行时基本元素上执行的回调。
 * 当前遍历步骤的运行时基本元素。
 *
 * @param {FrameState} frameState
 * @private
 */
ModelSceneGraph.prototype.configurePipeline = function (frameState) {
  const modelPipelineStages = this.modelPipelineStages;
  modelPipelineStages.length = 0;

  const model = this._model;
  const fogRenderable = frameState.fog.enabled && frameState.fog.renderable;

  if (defined(model.color)) {
    modelPipelineStages.push(ModelColorPipelineStage);
  }

  // Skip these pipeline stages for classification models.
  if (defined(model.classificationType)) {
    return;
  }

  if (model.imageBasedLighting.enabled) {
    modelPipelineStages.push(ImageBasedLightingPipelineStage);
  }

  if (model.isClippingEnabled()) {
    modelPipelineStages.push(ModelClippingPlanesPipelineStage);
  }

  // Even if a model has a clipping polygon collection, the polygons may not overlap the model geometry,
  // in which case the clipping polygon pipeline stage should not be added.
  const hasClippingPolygonGeometry =
    (model._clippingPolygonData?.polygonRings.length ?? 0) > 0;
  if (model.isClippingPolygonsEnabled() && hasClippingPolygonGeometry) {
    modelPipelineStages.push(ModelClippingPolygonsPipelineStage);
  }

  if (model.hasDrapedVectors()) {
    modelPipelineStages.push(ModelVectorLookupPipelineStage);
  }

  if (model.hasSilhouette(frameState)) {
    modelPipelineStages.push(ModelSilhouettePipelineStage);
  }

  if (
    defined(model.splitDirection) &&
    model.splitDirection !== SplitDirection.NONE
  ) {
    modelPipelineStages.push(ModelSplitterPipelineStage);
  }

  if (ModelType.is3DTiles(model.type)) {
    modelPipelineStages.push(TilesetPipelineStage);
  }

  if (fogRenderable) {
    modelPipelineStages.push(AtmospherePipelineStage);
  }
};

ModelSceneGraph.prototype.update = function (frameState, updateForAnimations) {
  let i, j, k;

  for (i = 0; i < this._runtimeNodes.length; i++) {
    const runtimeNode = this._runtimeNodes[i];

    // If a node in the model was unreachable from the scene graph, there will
    // be no corresponding runtime node and therefore should be skipped.
    if (!defined(runtimeNode)) {
      continue;
    }

    for (j = 0; j < runtimeNode.updateStages.length; j++) {
      const nodeUpdateStage = runtimeNode.updateStages[j];
      nodeUpdateStage.update(runtimeNode, this, frameState);
    }

    const disableAnimations =
      frameState.mode !== SceneMode.SCENE3D && this._model._projectTo2D;
    if (updateForAnimations && !disableAnimations) {
      this.updateJointMatrices();
    }

    for (j = 0; j < runtimeNode.runtimePrimitives.length; j++) {
      const runtimePrimitive = runtimeNode.runtimePrimitives[j];
      for (k = 0; k < runtimePrimitive.updateStages.length; k++) {
        const stage = runtimePrimitive.updateStages[k];
        stage.update(runtimePrimitive, this);
      }
    }
  }
};

ModelSceneGraph.prototype.updateModelMatrix = function (
  modelMatrix,
  frameState,
) {
  computeModelMatrix(this, modelMatrix);
  if (frameState.mode !== SceneMode.SCENE3D) {
    computeModelMatrix2D(this, frameState);
  }

  // Mark all root nodes as dirty. Any and all children will be
  // affected recursively in the update stage.
  const rootNodes = this._rootNodes;
  for (let i = 0; i < rootNodes.length; i++) {
    const node = this._runtimeNodes[rootNodes[i]];
    node._transformDirty = true;
  }
};

/**
 * 传递给回调的附加选项字典；如果回调不需要额外信息，则设为未定义。
 *
 * @private
 */
ModelSceneGraph.prototype.updateJointMatrices = function () {
  const skinnedNodes = this._skinnedNodes;
  const length = skinnedNodes.length;

  for (let i = 0; i < length; i++) {
    const nodeIndex = skinnedNodes[i];
    const runtimeNode = this._runtimeNodes[nodeIndex];
    runtimeNode.updateJointMatrices();
  }
};

/**
 * 递归遍历场景图中的运行时节点，
 * 使用后序深度优先遍历在它们的运行时基本元素上执行回调。
 * @callback traverseSceneGraphCallback
 *
 * @param {ModelRuntimePrimitive} runtimePrimitive 场景图。
 * @param {object} [options] 当前运行时节点。
 *
 * @private
 */

/**
 * 仅遍历可见的节点。
 * 在节点运行时基本元素上执行回调的回调。
 * 如果需要，传递给回调的附加选项字典。
 *
 * @param {ModelSceneGraph} sceneGraph 递归遍历场景图中的所有运行时节点，
 * @param {ModelRuntimeNode} runtimeNode 使用后序深度优先遍历在它们的运行时基本元素上执行回调。
 * @param {boolean} visibleNodesOnly 场景图。
 * @param {traverseSceneGraphCallback} callback 当前运行时节点。
 * @param {object} [callbackOptions] 在节点运行时基本元素上执行的回调。
 *
 * @private
 */
function traverseSceneGraph(
  sceneGraph,
  runtimeNode,
  visibleNodesOnly,
  callback,
  callbackOptions,
) {
  if (visibleNodesOnly && !runtimeNode.show) {
    return;
  }

  const childrenLength = runtimeNode.children.length;
  for (let i = 0; i < childrenLength; i++) {
    const childRuntimeNode = runtimeNode.getChild(i);
    traverseSceneGraph(
      sceneGraph,
      childRuntimeNode,
      visibleNodesOnly,
      callback,
      callbackOptions,
    );
  }

  const runtimePrimitives = runtimeNode.runtimePrimitives;
  const runtimePrimitivesLength = runtimePrimitives.length;
  for (let j = 0; j < runtimePrimitivesLength; j++) {
    const runtimePrimitive = runtimePrimitives[j];
    callback(runtimePrimitive, callbackOptions);
  }
}

function forEachRuntimePrimitive(
  sceneGraph,
  visibleNodesOnly,
  callback,
  callbackOptions,
) {
  const rootNodes = sceneGraph._rootNodes;
  const rootNodesLength = rootNodes.length;
  for (let i = 0; i < rootNodesLength; i++) {
    const rootNodeIndex = rootNodes[i];
    const runtimeNode = sceneGraph._runtimeNodes[rootNodeIndex];
    traverseSceneGraph(
      sceneGraph,
      runtimeNode,
      visibleNodesOnly,
      callback,
      callbackOptions,
    );
  }
}

const scratchBackFaceCullingOptions = {
  backFaceCulling: undefined,
};

/**
 * 遍历所有绘制命令并更改背面剔除设置。
 *
 * @param {boolean} backFaceCulling 背面剔除设置的新值。
 *
 * @private
 */
ModelSceneGraph.prototype.updateBackFaceCulling = function (backFaceCulling) {
  const backFaceCullingOptions = scratchBackFaceCullingOptions;
  backFaceCullingOptions.backFaceCulling = backFaceCulling;
  forEachRuntimePrimitive(
    this,
    false,
    updatePrimitiveBackFaceCulling,
    backFaceCullingOptions,
  );
};

// Callback is defined here to avoid allocating a closure in the render loop
function updatePrimitiveBackFaceCulling(runtimePrimitive, options) {
  const drawCommand = runtimePrimitive.drawCommand;
  drawCommand.backFaceCulling = options.backFaceCulling;
}

const scratchShadowOptions = {
  shadowMode: undefined,
};

/**
 * 遍历所有绘制命令并更改阴影设置。
 *
 * @param {ShadowMode} shadowMode 新的阴影设置。
 *
 * @private
 */
ModelSceneGraph.prototype.updateShadows = function (shadowMode) {
  const shadowOptions = scratchShadowOptions;
  shadowOptions.shadowMode = shadowMode;
  forEachRuntimePrimitive(this, false, updatePrimitiveShadows, shadowOptions);
};

// Callback is defined here to avoid allocating a closure in the render loop
function updatePrimitiveShadows(runtimePrimitive, options) {
  const drawCommand = runtimePrimitive.drawCommand;
  drawCommand.shadows = options.shadowMode;
}

const scratchShowBoundingVolumeOptions = {
  debugShowBoundingVolume: undefined,
};

/**
 * 遍历所有绘制命令并更改是否显示调试边界体积。
 *
 * @param {boolean} debugShowBoundingVolume 显示调试边界体积的新值。
 *
 * @private
 */
ModelSceneGraph.prototype.updateShowBoundingVolume = function (
  debugShowBoundingVolume,
) {
  const showBoundingVolumeOptions = scratchShowBoundingVolumeOptions;
  showBoundingVolumeOptions.debugShowBoundingVolume = debugShowBoundingVolume;

  forEachRuntimePrimitive(
    this,
    false,
    updatePrimitiveShowBoundingVolume,
    showBoundingVolumeOptions,
  );
};

// Callback is defined here to avoid allocating a closure in the render loop
function updatePrimitiveShowBoundingVolume(runtimePrimitive, options) {
  const drawCommand = runtimePrimitive.drawCommand;
  drawCommand.debugShowBoundingVolume = options.debugShowBoundingVolume;
}

const scratchSilhouetteCommands = [];
const scratchEdgeCommands = [];
const scratchPlanarFillIdCommands = [];
const scratchPushDrawCommandOptions = {
  frameState: undefined,
  hasSilhouette: undefined,
};

/**
 * 遍历场景图并将与每个基本元素相关的绘制命令推入帧状态的命令列表。
 * 帧状态。
 *
 * @param {FrameState} frameState 设置关节阶段的当前值。
 *
 * @private
 */
ModelSceneGraph.prototype.pushDrawCommands = function (frameState) {
  // If a model has silhouettes, the commands that draw the silhouettes for
  // each primitive can only be invoked after the entire model has drawn.
  // Otherwise, the silhouette may draw on top of the model. This requires
  // gathering the original commands and the silhouette commands separately.
  const silhouetteCommands = scratchSilhouetteCommands;
  silhouetteCommands.length = 0;

  // Gather edge commands for the edge pass
  const edgeCommands = scratchEdgeCommands;
  edgeCommands.length = 0;

  // Gather planar fill feature-ID pre-pass commands
  const planarFillIdCommands = scratchPlanarFillIdCommands;
  planarFillIdCommands.length = 0;

  // Since this function is called each frame, the options object is
  // preallocated in a scratch variable
  const pushDrawCommandOptions = scratchPushDrawCommandOptions;
  pushDrawCommandOptions.hasSilhouette = this._model.hasSilhouette(frameState);
  pushDrawCommandOptions.frameState = frameState;

  forEachRuntimePrimitive(
    this,
    true,
    pushPrimitiveDrawCommands,
    pushDrawCommandOptions,
  );

  addAllToArray(frameState.commandList, silhouetteCommands);
  addAllToArray(frameState.commandList, edgeCommands);
  addAllToArray(frameState.commandList, planarFillIdCommands);
};

// Callback is defined here to avoid allocating a closure in the render loop
function pushPrimitiveDrawCommands(runtimePrimitive, options) {
  const frameState = options.frameState;
  const hasSilhouette = options.hasSilhouette;

  const passes = frameState.passes;
  const silhouetteCommands = scratchSilhouetteCommands;
  const edgeCommands = scratchEdgeCommands;
  const planarFillIdCommands = scratchPlanarFillIdCommands;
  const primitiveDrawCommand = runtimePrimitive.drawCommand;
  primitiveDrawCommand.pushCommands(frameState, frameState.commandList);

  // Renew the per-frame planar fill request while this primitive renders.
  const material = runtimePrimitive.primitive.material;
  if (defined(material) && defined(material.planarFill)) {
    frameState.planarFillRequested = true;
  }

  // If a model has silhouettes, the commands that draw the silhouettes for
  // each primitive can only be invoked after the entire model has drawn.
  // Otherwise, the silhouette may draw on top of the model. This requires
  // gathering the original commands and the silhouette commands separately.
  if (hasSilhouette && !passes.pick) {
    primitiveDrawCommand.pushSilhouetteCommands(frameState, silhouetteCommands);
  }

  // Add edge commands to the edge pass
  if (defined(primitiveDrawCommand.pushEdgeCommands)) {
    primitiveDrawCommand.pushEdgeCommands(frameState, edgeCommands);
  }

  // Add planar fill feature-ID pre-pass commands
  if (defined(primitiveDrawCommand.pushPlanarFillIdCommands)) {
    primitiveDrawCommand.pushPlanarFillIdCommands(
      frameState,
      planarFillIdCommands,
    );
  }
}

/**
 * 设置关节的关节名称、空间以及阶段名称。
 *
 * @param {string} articulationStageKey 该关节阶段的数值值。
 * @param {number} value The numeric value of this stage of the articulation.
 *
 * @private
 */
ModelSceneGraph.prototype.setArticulationStage = function (
  articulationStageKey,
  value,
) {
  const names = articulationStageKey.split(" ");
  if (names.length !== 2) {
    return;
  }

  const articulationName = names[0];
  const stageName = names[1];

  const runtimeArticulation = this._runtimeArticulations[articulationName];
  if (defined(runtimeArticulation)) {
    runtimeArticulation.setArticulationStage(stageName, value);
  }
};

/**
 * 将任何修改过的关节阶段应用于参与任意关节的每个节点的矩阵上。
 * 请注意，这将覆盖参与节点上的所有 nodeTransformations。
 *
 * @private
 */
ModelSceneGraph.prototype.applyArticulations = function () {
  const runtimeArticulations = this._runtimeArticulations;
  for (const articulationName in runtimeArticulations) {
    if (runtimeArticulations.hasOwnProperty(articulationName)) {
      const articulation = runtimeArticulations[articulationName];
      articulation.apply();
    }
  }
};

export default ModelSceneGraph;