import {
  Cartesian3,
  Check,
  DeveloperError,
  Frozen,
  Matrix4,
  Quaternion,
  TranslationRotationScale,
  defined,
} from "@cesium/core";
import InstancingPipelineStage from "./InstancingPipelineStage.js";
import ModelMatrixUpdateStage from "./ModelMatrixUpdateStage.js";
import NodeStatisticsPipelineStage from "./NodeStatisticsPipelineStage.js";

/**
 * 作为 {@link ModelSceneGraph} 一部分的节点内存表示。
 *
 * @param {object} options 包含以下选项的对象：
 * @param {ModelComponents.Node} options.node 来自3D模型的对应节点组件。
 * @param {Matrix4} options.transform 该节点的变换，不包括其祖先或子节点的变换。
 * @param {Matrix4} options.transformToRoot 所有祖先节点的变换乘积，不包括该节点自身的变换。
 * @param {ModelSceneGraph} options.sceneGraph 该节点所属的场景图。
 * @param {number[]} options.children 该节点在场景图的运行时节点数组中作为子节点的索引。
 *
 * @alias ModelRuntimeNode
 * @constructor
 *
 * @private
 */
function ModelRuntimeNode(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const node = options.node;
  const transform = options.transform;
  const transformToRoot = options.transformToRoot;
  const sceneGraph = options.sceneGraph;
  const children = options.children;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.node", node);
  Check.typeOf.object("options.transform", transform);
  Check.typeOf.object("options.transformToRoot", transformToRoot);
  Check.typeOf.object("options.sceneGraph", sceneGraph);
  Check.typeOf.object("options.children", children);
  //>>includeEnd('debug');

  this._node = node;
  this._name = node.name;
  this._id = node.index;
  this._sceneGraph = sceneGraph;
  this._children = children;

  this._originalTransform = Matrix4.clone(transform, this._originalTransform);
  this._transform = Matrix4.clone(transform, this._transform);
  this._transformToRoot = Matrix4.clone(transformToRoot, this._transformToRoot);

  this._computedTransform = new Matrix4(); // Computed in initialize()
  this._transformDirty = false;

  // Used for animation
  this._transformParameters = undefined;
  this._morphWeights = [];

  // Will be set by the scene graph after the skins have been created
  this._runtimeSkin = undefined;
  this._computedJointMatrices = [];

  // Set the 'show' flag of the runtime node based on the 'visible'
  // property of the KHR_node_visibility extension.
  // The 'show' flag should only be set to 'false' when the 'visible'
  // flag is set to 'false' EXPLICITLY. Everything else (particularly,
  // 'undefined') should default to 'show=true'.
  let doShow = true;
  const nodeVisibility = node.nodeVisibility;
  if (defined(nodeVisibility)) {
    doShow = nodeVisibility.visible !== false;
  }

  /**
   * 是否显示该节点及其子节点。用户可以通过 {@link ModelNode} 切换此设置。
   * 该节点是否被用户动画化。由对应的 {@link ModelNode} 在用户提供其变换时设置。如果为 true，则节点将忽略模型资源中的动画。
   *
   * @type {boolean}
   * @private
   */
  this.show = doShow;

  /**
   * 该节点是否被用户动画化。由对应的 {@link ModelNode} 在用户提供其变换时设置。如果为 true，则节点将忽略模型资源中的动画。
   * 应用于该节点所有网格基元的管道阶段。
   * 这是一个类数组，每个类都有一个名为<code>process()</code>的静态方法。
   * 属于该节点的网格基元。
   *
   * @type {boolean}
   *
   * @private
   */
  this.userAnimated = false;

  /**
   * 应用于该节点的更新阶段。
   * 实例平移值的分量最小值数组。该值由 InstancingPipelineStage 设置。
   * 实例平移值的分量最大值数组。该值由 InstancingPipelineStage 设置。
   *
   * @type {object[]}
   * @readonly
   *
   * @private
   */
  this.pipelineStages = [];

  /**
   * 包含实例化变换的缓冲区。内存由 Model 管理，只是一个引用。
   *
   * @type {ModelRuntimePrimitive[]}
   * @readonly
   *
   * @private
   */
  this.runtimePrimitives = [];

  /**
   * 包含投影到2D世界坐标的实例化变换的缓冲区。用于2D / CV模式渲染。内存由 Model 管理，只是一个引用。
   *
   * @type {object[]}
   * @readonly
   *
   * @private
   */
  this.updateStages = [];

  /**
   * 如果节点被实例化，则包含节点的实例平移值数组。用于2D / CV模式渲染。内存由 Model 管理，只是一个引用。
   * 如果模型被实例化并投影到2D，参考点是实例平移的最大值和最小值的平均值。2D平移是相对于此点定义的，以避免GPU上的精度问题。
   *
   * @type {Cartesian3}
   *
   * @private
   */
  this.instancingTranslationMin = undefined;

  /**
   * 该值由 InstancingPipelineStage 设置。
   * 该运行时节点所代表的内部节点。
   *
   * @type {Cartesian3}
   *
   * @private
   */
  this.instancingTranslationMax = undefined;

  /**
   * 该节点所属的场景图。
   * 该节点在场景图中的索引。
   *
   * @type {Buffer}
   *
   * @private
   */
  this.instancingTransformsBuffer = undefined;

  /**
   * 该节点的局部空间变换。可以通过对应的 {@link ModelNode} 外部更改，以便进行动画处理。
   * coordinates. Used for rendering in 2D / CV mode. The memory is managed
   * by Model; this is just a reference.
   *
   * @type {Buffer}
   *
   * @private
   */
  this.instancingTransformsBuffer2D = undefined;

  /**
   * A buffer containing the instanced translation values for the node if
   * it is instanced. Used for rendering in 2D / CV mode. The memory is
   * managed by Model; this is just a reference.
   *
   * @type {Buffer}
   *
   * @private
   */
  this.instancingTranslationBuffer2D = undefined;

  /**
   * If the model is instanced and projected to 2D, the reference point is the
   * average of the instancing translation max and min. The 2D translations are
   * defined relative to this point to avoid precision issues on the GPU.
   * <p>
   * This value is set by InstancingPipelineStage.
   * </p>
   *
   * @type {Cartesian3}
   *
   * @private
   */
  this.instancingReferencePoint2D = undefined;

  initialize(this);
}

Object.defineProperties(ModelRuntimeNode.prototype, {
  /**
   * The internal node this runtime node represents.
   *
   * @memberof ModelRuntimeNode.prototype
   * @type {ModelComponents.Node}
   * @readonly
   *
   * @private
   */
  node: {
    get: function () {
      return this._node;
    },
  },
  /**
   * The scene graph this node belongs to.
   *
   * @memberof ModelRuntimeNode.prototype
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
   * The indices of the children of this node in the scene graph.
   *
   * @memberof ModelRuntimeNode.prototype
   * @type {number[]}
   * @readonly
   *
   * @private
   */
  children: {
    get: function () {
      return this._children;
    },
  },

  /**
   * The node's local space transform. This can be changed externally via
   * the corresponding {@link ModelNode}, such that animation can be
   * 由其他源驱动，而非仅通过模型资源中的动画实现。
   *
   * @memberof ModelRuntimeNode.prototype
   * @type {Matrix4}
   *
   * @private
   */
  transform: {
    get: function () {
      return this._transform;
    },
    set: function (value) {
      this._transformDirty = true;
      this._transform = Matrix4.clone(value, this._transform);
    },
  },

  /**
   * 所有节点祖先的变换，不包括当前节点的变换。
   * 从节点本地空间到模型场景图空间的变换。
   *
   * @see ModelRuntimeNode#computedTransform
   *
   * @memberof ModelRuntimeNode.prototype
   * @type {Matrix4}
   * @readonly
   *
   * @private
   */
  transformToRoot: {
    get: function () {
      return this._transformToRoot;
    },
  },

  /**
   * 从节点本地空间到模型场景图空间的变换。
   * 这是 transformToRoot 与 transform 的乘积结果。
   *
   * @memberof ModelRuntimeNode.prototype
   * @type {Matrix4}
   * @readonly
   *
   * @private
   */
  computedTransform: {
    get: function () {
      return this._computedTransform;
    },
  },

  /**
   * 节点在模型中指定的原始变换。
   * 不包括节点祖先的变换。
   *
   * @memberof ModelRuntimeNode.prototype
   * @type {Matrix4}
   * @readonly
   *
   * @private
   */
  originalTransform: {
    get: function () {
      return this._originalTransform;
    },
  },

  /**
   * 节点的本地空间平移。此值用于内部操作，以允许
   * 模型资源中的动画影响节点的属性。
   *
   * 如果节点的变换最初使用模型中的矩阵描述，则此处将返回 undefined。
   * 如果节点使用模型资源中的矩阵定义，则无法设置其平移。
   *
   * @memberof ModelRuntimeNode.prototype
   * @type {Cartesian3}
   *
   * @exception {DeveloperError} The 如果节点使用模型资源中的矩阵定义，则无法设置其旋转。
   *
   * @private
   */
  translation: {
    get: function () {
      return defined(this._transformParameters)
        ? this._transformParameters.translation
        : undefined;
    },
    set: function (value) {
      const transformParameters = this._transformParameters;
      //>>includeStart('debug', pragmas.debug);
      if (!defined(transformParameters)) {
        throw new DeveloperError(
          "The translation of a node cannot be set if it was defined using a matrix in the model.",
        );
      }
      //>>includeEnd('debug');

      const currentTranslation = transformParameters.translation;
      if (Cartesian3.equals(currentTranslation, value)) {
        return;
      }

      transformParameters.translation = Cartesian3.clone(
        value,
        transformParameters.translation,
      );

      updateTransformFromParameters(this, transformParameters);
    },
  },

  /**
   * 节点的本地空间旋转。此值用于内部操作，以允许
   * 模型资源中的动画影响节点的属性。
   *
   * 如果节点的变换最初使用模型中的矩阵描述，则此处将返回 undefined。
   * 如果节点使用模型资源中的矩阵定义，则无法设置其缩放。
   *
   * @memberof ModelRuntimeNode.prototype
   * @type {Quaternion}
   *
   * @exception {DeveloperError} The 如果节点使用模型资源中的矩阵定义，则无法设置其缩放。
   *
   * @private
   */
  rotation: {
    get: function () {
      return defined(this._transformParameters)
        ? this._transformParameters.rotation
        : undefined;
    },
    set: function (value) {
      const transformParameters = this._transformParameters;
      //>>includeStart('debug', pragmas.debug);
      if (!defined(transformParameters)) {
        throw new DeveloperError(
          "The rotation of a node cannot be set if it was defined using a matrix in the model.",
        );
      }
      //>>includeEnd('debug');

      const currentRotation = transformParameters.rotation;
      if (Quaternion.equals(currentRotation, value)) {
        return;
      }

      transformParameters.rotation = Quaternion.clone(
        value,
        transformParameters.rotation,
      );

      updateTransformFromParameters(this, transformParameters);
    },
  },

  /**
   * 节点的本地空间缩放。此值用于内部操作，以允许
   * 模型资源中的动画影响节点的属性。
   *
   * 如果节点的变换最初使用模型中的矩阵描述，则此处将返回 undefined。
   * 如果节点使用模型资源中的矩阵定义，则无法设置其缩放。
   *
   * @memberof ModelRuntimeNode.prototype
   * @type {Cartesian3}
   *
   * @exception {DeveloperError} The 如果节点使用模型资源中的矩阵定义，则无法设置其缩放。
   * @private
   */
  scale: {
    get: function () {
      return defined(this._transformParameters)
        ? this._transformParameters.scale
        : undefined;
    },
    set: function (value) {
      const transformParameters = this._transformParameters;
      //>>includeStart('debug', pragmas.debug);
      if (!defined(transformParameters)) {
        throw new DeveloperError(
          "The scale of a node cannot be set if it was defined using a matrix in the model.",
        );
      }
      //>>includeEnd('debug');
      const currentScale = transformParameters.scale;
      if (Cartesian3.equals(currentScale, value)) {
        return;
      }

      transformParameters.scale = Cartesian3.clone(
        value,
        transformParameters.scale,
      );

      updateTransformFromParameters(this, transformParameters);
    },
  },

  /**
   * 节点的变形权重。此值用于内部操作，以允许
   * 模型资源中的动画影响节点的属性。
   *
   * @memberof ModelRuntimeNode.prototype
   * @type {number[]}
   *
   * @private
   */
  morphWeights: {
    get: function () {
      return this._morphWeights;
    },
    set: function (value) {
      const valueLength = value.length;
      //>>includeStart('debug', pragmas.debug);
      if (this._morphWeights.length !== valueLength) {
        throw new DeveloperError(
          "value must have the same length as the original weights array.",
        );
      }
      //>>includeEnd('debug');
      for (let i = 0; i < valueLength; i++) {
        this._morphWeights[i] = value[i];
      }
    },
  },

  /**
   * 应用于该节点的皮肤（如果存在）。
   *
   * @memberof ModelRuntimeNode.prototype
   * @type {ModelSkin}
   * @readonly
   *
   * @private
   */
  runtimeSkin: {
    get: function () {
      return this._runtimeSkin;
    },
  },

  /**
   * 该节点的计算关节矩阵，由皮肤生成。
   *
   * @memberof ModelRuntimeNode.prototype
   * @type {Matrix4[]}
   * @readonly
   *
   * @private
   */
  computedJointMatrices: {
    get: function () {
      return this._computedJointMatrices;
    },
  },
});

function initialize(runtimeNode) {
  const transform = runtimeNode.transform;
  const transformToRoot = runtimeNode.transformToRoot;
  const computedTransform = runtimeNode._computedTransform;
  runtimeNode._computedTransform = Matrix4.multiply(
    transformToRoot,
    transform,
    computedTransform,
  );

  const node = runtimeNode.node;
  if (!defined(node.matrix)) {
    runtimeNode._transformParameters = new TranslationRotationScale(
      node.translation,
      node.rotation,
      node.scale,
    );
  }

  if (defined(node.morphWeights)) {
    runtimeNode._morphWeights = node.morphWeights.slice();
  }

  // If this node is affected by an articulation from the AGI_articulations
  // extension, add this node to its list of affected nodes.
  const articulationName = node.articulationName;
  if (defined(articulationName)) {
    const sceneGraph = runtimeNode.sceneGraph;
    const runtimeArticulations = sceneGraph._runtimeArticulations;

    const runtimeArticulation = runtimeArticulations[articulationName];
    if (defined(runtimeArticulation)) {
      runtimeArticulation.runtimeNodes.push(runtimeNode);
    }
  }
}

function updateTransformFromParameters(runtimeNode, transformParameters) {
  runtimeNode._transformDirty = true;

  runtimeNode._transform = Matrix4.fromTranslationRotationScale(
    transformParameters,
    runtimeNode._transform,
  );
}

/**
 * 返回指定索引的子节点。
 *
 * @param {number} index 子节点的索引。
 *
 * @returns {ModelRuntimeNode}
 *
 * @example
 * // 遍历运行时节点的所有子节点。
 * for (let i = 0; i < runtimeNode.children.length; i++)
 * {
 * const childNode = runtimeNode.getChild(i);
 * }
 *
 * @private
 */
ModelRuntimeNode.prototype.getChild = function (index) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("index", index);
  if (index < 0 || index >= this.children.length) {
    throw new DeveloperError(
      "index must be greater than or equal to 0 and less than the number of children.",
    );
  }
  //>>includeEnd('debug');

  return this.sceneGraph._runtimeNodes[this.children[index]];
};

/**
 * 配置节点管道阶段。如果需要重新运行管道，再次调用
 * 此方法以确保使用正确的管道阶段顺序。
 * 被使用。
 *
 * @private
 */
ModelRuntimeNode.prototype.configurePipeline = function () {
  const node = this.node;
  const pipelineStages = this.pipelineStages;
  pipelineStages.length = 0;
  const updateStages = this.updateStages;
  updateStages.length = 0;

  if (defined(node.instances)) {
    pipelineStages.push(InstancingPipelineStage);
  }

  pipelineStages.push(NodeStatisticsPipelineStage);

  updateStages.push(ModelMatrixUpdateStage);
};

/**
 * 更新用于渲染和实例化的计算变换。
 *
 * @private
 */
ModelRuntimeNode.prototype.updateComputedTransform = function () {
  this._computedTransform = Matrix4.multiply(
    this._transformToRoot,
    this._transform,
    this._computedTransform,
  );
};

/**
 * 更新该节点的关节矩阵，每个矩阵均按以下方式计算：
 * computedJointMatrix = nodeWorldTransform^(-1) * skinJointMatrix.
 *
 * @private
 */
ModelRuntimeNode.prototype.updateJointMatrices = function () {
  const runtimeSkin = this._runtimeSkin;
  if (!defined(runtimeSkin)) {
    return;
  }

  runtimeSkin.updateJointMatrices();

  const computedJointMatrices = this._computedJointMatrices;
  const skinJointMatrices = runtimeSkin.jointMatrices;
  const length = skinJointMatrices.length;

  for (let i = 0; i < length; i++) {
    if (!defined(computedJointMatrices[i])) {
      computedJointMatrices[i] = new Matrix4();
    }

    const nodeWorldTransform = Matrix4.multiplyTransformation(
      this.transformToRoot,
      this.transform,
      computedJointMatrices[i],
    );

    const inverseNodeWorldTransform = Matrix4.inverseTransformation(
      nodeWorldTransform,
      computedJointMatrices[i],
    );

    computedJointMatrices[i] = Matrix4.multiplyTransformation(
      inverseNodeWorldTransform,
      skinJointMatrices[i],
      computedJointMatrices[i],
    );
  }
};

export default ModelRuntimeNode;
