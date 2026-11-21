import { Check, defined } from "@cesium/core";

/**
 * <div class="notice">
 * 使用 {@link Model#getNode} 从已加载的模型中获取节点。请勿直接调用构造函数。
 * </div>
 *
 * 具有可修改变换的模型节点，允许用户定义
 * 自己的动画。虽然模型的资源可能包含针对
 * 节点变换的动画，但此类允许用户外部更改节点的变换。
 * 。这样，动画可以由其他来源驱动，而不仅仅来自模型的资源。
 * 
 *
 * @alias ModelNode
 * @internalConstructor
 * @class
 *
 * @example
 * const node = model.getNode("Hand");
 * node.matrix = Cesium.Matrix4.fromScale(new Cesium.Cartesian3(5.0, 1.0, 1.0), node.matrix);
 *
 * @see Model#getNode
 */
function ModelNode(model, runtimeNode) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("model", model);
  Check.typeOf.object("runtimeNode", runtimeNode);
  //>>includeEnd('debug');

  this._model = model;
  this._runtimeNode = runtimeNode;
}

Object.defineProperties(ModelNode.prototype, {
  /**
   * 此节点的 <code>name</code> 属性值。
   *
   * @memberof ModelNode.prototype
   *
   * @type {string}
   * @readonly
   */
  name: {
    get: function () {
      return this._runtimeNode._name;
    },
  },

  /**
   * 节点在 glTF 中的索引。
   *
   * @memberof ModelNode.prototype
   *
   * @type {number}
   * @readonly
   */
  id: {
    get: function () {
      return this._runtimeNode._id;
    },
  },

  /**
   * 决定此节点及其子节点是否会被显示。
   *
   * @memberof ModelNode.prototype
   * @type {boolean}
   *
   * @default true
   */
  show: {
    get: function () {
      return this._runtimeNode.show;
    },
    set: function (value) {
      this._runtimeNode.show = value;
    },
  },

  /**
   * 节点从其本地坐标到
   * 其父节点的 4x4 矩阵变换。将矩阵设置为 undefined 可恢复
   * 节点的原始变换，并允许节点再次被模型中的任何动画驱动。
   * 。要生效，此属性必须被赋值；
   * <p>
   * 单独设置矩阵的各个元素无效。
   * 从其本地坐标到其父节点的 4x4 矩阵变换，且未应用任何节点变换
   * </p>
   *
   * @memberof ModelNode.prototype
   * @type {Matrix4}
   */
  matrix: {
    get: function () {
      return this._runtimeNode.transform;
    },
    set: function (value) {
      if (defined(value)) {
        this._runtimeNode.transform = value;
        this._runtimeNode.userAnimated = true;
        this._model._userAnimationDirty = true;
      } else {
        this._runtimeNode.transform = this.originalMatrix;
        this._runtimeNode.userAnimated = false;
      }
    },
  },

  /**
   * 或连接关系。
   * </div>
   * or articulations applied.
   *
   * @memberof ModelNode.prototype
   * @type {Matrix4}
   */
  originalMatrix: {
    get: function () {
      return this._runtimeNode.originalTransform;
    },
  },
});

export default ModelNode;
