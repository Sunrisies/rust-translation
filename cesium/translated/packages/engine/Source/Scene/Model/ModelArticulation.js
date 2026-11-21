import { Check, Frozen, Matrix4, defined } from "@cesium/core";
import ModelArticulationStage from "./ModelArticulationStage.js";

/**
 * 影响节点中的关节在内存中的表示形式。
 * {@link ModelSceneGraph}。这在模型中由
 * <code>AGI_articulations</code> 扩展定义。
 *
 * @param {object} options 包含以下选项的对象：
 * @param {ModelComponents.Articulation} options.articulation 来自 3D 模型的关节组件。
 * @param {ModelSceneGraph} options.sceneGraph 该关节所属的场景图。
 *
 * @alias ModelArticulation
 * @constructor
 *
 * @private
 */
function ModelArticulation(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const articulation = options.articulation;
  const sceneGraph = options.sceneGraph;
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.articulation", articulation);
  Check.typeOf.object("options.sceneGraph", sceneGraph);
  //>>includeEnd('debug');

  this._articulation = articulation;
  this._sceneGraph = sceneGraph;

  this._name = articulation.name;
  this._runtimeStages = [];
  this._runtimeStagesByName = {};

  // Will be populated as the runtime nodes are created
  this._runtimeNodes = [];

  // Set to true so that the first call to
  // ModelSceneGraph.applyArticulations will work.
  this._dirty = true;

  initialize(this);
}

Object.defineProperties(ModelArticulation.prototype, {
  /**
   * 此运行时关节所代表的内部关节。
   *
   * @memberof ModelArticulation.prototype
   * @type {ModelComponents.Articulation}
   * @readonly
   *
   * @private
   */
  articulation: {
    get: function () {
      return this._articulation;
    },
  },

  /**
   * 该关节所属的场景图。
   *
   * @memberof ModelArticulation.prototype
   * @type {ModelSceneGraph}
   * @readonly
   *
   * @private
   */
  sceneGraph: {
    get: function () {
      return this._sceneGraph;
    },
  },

  /**
   * 该关节的名称。
   *
   * @memberof ModelArticulation.prototype
   * @type {string}
   * @readonly
   *
   * @private
   */
  name: {
    get: function () {
      return this._name;
    },
  },

  /**
   * 属于该关节的运行时阶段。
   *
   * @memberof ModelArticulation.prototype
   * @type {ModelArticulationStage[]}
   * @readonly
   *
   * @private
   */
  runtimeStages: {
    get: function () {
      return this._runtimeStages;
    },
  },

  /**
   * 受该关节影响的运行时节点。
   *
   * @memberof ModelArticulation.prototype
   * @type {ModelRuntimeNode[]}
   * @readonly
   *
   * @private
   */
  runtimeNodes: {
    get: function () {
      return this._runtimeNodes;
    },
  },
});

function initialize(runtimeArticulation) {
  const articulation = runtimeArticulation.articulation;

  const stages = articulation.stages;
  const length = stages.length;

  const runtimeStages = runtimeArticulation._runtimeStages;
  const runtimeStagesByName = runtimeArticulation._runtimeStagesByName;
  for (let i = 0; i < length; i++) {
    const stage = stages[i];
    const runtimeStage = new ModelArticulationStage({
      stage: stage,
      runtimeArticulation: runtimeArticulation,
    });

    // Store the stages in an array to preserve the order in which
    // they appeared in the 3D model.
    runtimeStages.push(runtimeStage);

    // Store the stages in a dictionary for retrieval by name.
    const stageName = stage.name;
    runtimeStagesByName[stageName] = runtimeStage;
  }
}

/**
 * 设置关节阶段的当前值。
 *
 * @param {string} stageName 关节阶段的名称。
 * @param {number} value 该关节阶段的数值。
 *
 * @private
 */
ModelArticulation.prototype.setArticulationStage = function (stageName, value) {
  const stage = this._runtimeStagesByName[stageName];
  if (defined(stage)) {
    stage.currentValue = value;
  }
};

const scratchArticulationMatrix = new Matrix4();
const scratchNodeMatrix = new Matrix4();

/**
 * 将关节阶段的链应用于每个参与关节的节点的变换。这仅在关节中的任何阶段被修改时重新计算节点变换。
 * 如果关节中的任何阶段被修改，则仅进行重新计算。
 * 请注意，这将覆盖参与节点上现有的变换。
 * <p>
 * Note that this will overwrite any existing transformations on participating
 * nodes.
 * </p>
 *
 * @private
 */
ModelArticulation.prototype.apply = function () {
  if (!this._dirty) {
    return;
  }
  this._dirty = false;

  let articulationMatrix = Matrix4.clone(
    Matrix4.IDENTITY,
    scratchArticulationMatrix,
  );

  let i;
  const stages = this._runtimeStages;
  const stagesLength = stages.length;

  // Compute the result of the articulation stages...
  for (i = 0; i < stagesLength; i++) {
    const stage = stages[i];
    articulationMatrix = stage.applyStageToMatrix(articulationMatrix);
  }

  // ...then apply it to the transforms of the affected nodes.
  const nodes = this._runtimeNodes;
  const nodesLength = nodes.length;
  for (i = 0; i < nodesLength; i++) {
    const node = nodes[i];
    const transform = Matrix4.multiplyTransformation(
      node.originalTransform,
      articulationMatrix,
      scratchNodeMatrix,
    );
    node.transform = transform;
  }
};

export default ModelArticulation;
