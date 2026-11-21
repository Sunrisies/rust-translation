import { Check, Frozen, Matrix4 } from "@cesium/core";

/**
 * 影响 {@link ModelSceneGraph} 中节点的皮肤在内存中的表示形式。
 * 皮肤应在所有 {@link ModelRuntimeNode} 实例化后才会初始化。
 * 由场景图负责。
 *
 * @param {object} options 包含以下选项的对象：
 * @param {ModelComponents.Skin} options.skin 来自 3D 模型的对应皮肤组件。
 * @param {ModelSceneGraph} options.sceneGraph 该皮肤所属的场景图。
 *
 * @alias ModelSkin
 * @constructor
 *
 * @private
 */
function ModelSkin(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.skin", options.skin);
  Check.typeOf.object("options.sceneGraph", options.sceneGraph);
  //>>includeEnd('debug');

  this._sceneGraph = options.sceneGraph;
  const skin = options.skin;

  this._skin = skin;

  this._inverseBindMatrices = undefined;
  this._joints = [];
  this._jointMatrices = [];

  initialize(this);
}

Object.defineProperties(ModelSkin.prototype, {
  /**
   * 此运行时皮肤所代表的内部皮肤。
   *
   * @memberof ModelSkin.prototype
   * @type {ModelComponents.Skin}
   * @readonly
   *
   * @private
   */
  skin: {
    get: function () {
      return this._skin;
    },
  },

  /**
   * 该皮肤所属的场景图。
   *
   * @memberof ModelSkin.prototype
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
   * 皮肤的逆绑定矩阵。
   *
   * @memberof ModelSkin.prototype
   * @type {Matrix4[]}
   * @readonly
   *
   * @private
   */
  inverseBindMatrices: {
    get: function () {
      return this._inverseBindMatrices;
    },
  },

  /**
   * 皮肤的关节点。
   *
   * @memberof ModelSkin.prototype
   * @type {ModelRuntimeNode[]}
   * @readonly
   *
   * @private
   */
  joints: {
    get: function () {
      return this._joints;
    },
  },

  /**
   * 皮肤的关节矩阵，其中每个关节矩阵的计算公式为：
   * jointMatrix = jointWorldTransform * inverseBindMatrix。
   *
   * 引用此皮肤的每个节点都负责将其逆世界变换预乘到关节矩阵中，以便自己使用。
   * 更新皮肤的关节矩阵。
   *
   * @memberof ModelSkin.prototype
   * @type {Matrix4[]}
   * @readonly
   *
   * @private
   */
  jointMatrices: {
    get: function () {
      return this._jointMatrices;
    },
  },
});

function initialize(runtimeSkin) {
  const skin = runtimeSkin.skin;
  const inverseBindMatrices = skin.inverseBindMatrices;
  runtimeSkin._inverseBindMatrices = inverseBindMatrices;

  const joints = skin.joints;
  const length = joints.length;

  const runtimeNodes = runtimeSkin.sceneGraph._runtimeNodes;
  const runtimeJoints = runtimeSkin.joints;
  const runtimeJointMatrices = runtimeSkin._jointMatrices;
  for (let i = 0; i < length; i++) {
    const jointIndex = joints[i].index;
    const runtimeNode = runtimeNodes[jointIndex];
    runtimeJoints.push(runtimeNode);

    const inverseBindMatrix = inverseBindMatrices[i];
    const jointMatrix = computeJointMatrix(
      runtimeNode,
      inverseBindMatrix,
      new Matrix4(),
    );
    runtimeJointMatrices.push(jointMatrix);
  }
}

function computeJointMatrix(joint, inverseBindMatrix, result) {
  const jointWorldTransform = Matrix4.multiplyTransformation(
    joint.transformToRoot,
    joint.transform,
    result,
  );

  result = Matrix4.multiplyTransformation(
    jointWorldTransform,
    inverseBindMatrix,
    result,
  );

  return result;
}

/**
 * Updates the joint matrices for the skin.
 *
 * @private
 */
ModelSkin.prototype.updateJointMatrices = function () {
  const jointMatrices = this._jointMatrices;
  const length = jointMatrices.length;
  for (let i = 0; i < length; i++) {
    const joint = this.joints[i];
    const inverseBindMatrix = this.inverseBindMatrices[i];
    jointMatrices[i] = computeJointMatrix(
      joint,
      inverseBindMatrix,
      jointMatrices[i],
    );
  }
};

export default ModelSkin;
