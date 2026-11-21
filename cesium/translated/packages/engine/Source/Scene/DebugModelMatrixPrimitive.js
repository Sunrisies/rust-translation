import {
  ArcType,
  Cartesian3,
  Color,
  Frozen,
  GeometryInstance,
  Matrix4,
  PolylineGeometry,
  defined,
  destroyObject,
} from "@cesium/core";
import PolylineColorAppearance from "./PolylineColorAppearance.js";
import Primitive from "./Primitive.js";

/**
 * 绘制由矩阵定义的参考框架的轴，该矩阵可将坐标转换为世界坐标
 * 即地球的 WGS84 坐标。最典型的例子是
 * 一个 primitive 的 <code>modelMatrix</code>
 * <p>
 * X 轴为红色；Y 轴为绿色；Z 轴为蓝色
 * </p>
 * <p>
 * 此设置仅用于调试，未针对生产环境优化
 * </p>
 *
 * @alias DebugModelMatrixPrimitive
 * @constructor
 *
 * @param {object} [options] 具有以下属性的实体：
 * @param {number} [options.length=10000000.0] 轴的长度，单位：米
 * @param {number} [options.width=2.0] 轴的宽度，单位：像素
 * @param {Matrix4} [options.modelMatrix=Matrix4.IDENTITY] 定义参考框架的 4x4 矩阵，即原点和轴，用于可视化
 * @param {boolean} [options.show=true] 决定该 primitive 是否会被显示
 * @param {object} [options.id] 用户定义的实体，在通过 {@link Scene#pick} 选中实例时返回
 *
 * @example
 * primitives.add(new Cesium.DebugModelMatrixPrimitive({
 * modelMatrix : primitive.modelMatrix,  // 要调试的 primitive
 * length : 100000.0,
 * width : 10.0
 * }));
 */
function DebugModelMatrixPrimitive(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  /**
   * 轴的长度，单位：米
   *
   * @type {number}
   * @default 10000000.0
   */
  this.length = options.length ?? 10000000.0;
  this._length = undefined;

  /**
   * 轴的宽度，单位：像素
   *
   * @type {number}
   * @default 2.0
   */
  this.width = options.width ?? 2.0;
  this._width = undefined;

  /**
   * 决定该 primitive 是否会被显示
   *
   * @type {boolean}
   * @default true
   */
  this.show = options.show ?? true;

  /**
   * 定义参考框架的 4x4 矩阵，即原点和轴，用于可视化
   *
   * @type {Matrix4}
   * @default {@link Matrix4.IDENTITY}
   */
  this.modelMatrix = Matrix4.clone(options.modelMatrix ?? Matrix4.IDENTITY);
  this._modelMatrix = new Matrix4();

  /**
   * 选中 primitive 时返回的自定义值
   *
   * @type {*}
   * @default undefined
   *
   * @see Scene#pick
   */
  this.id = options.id;
  this._id = undefined;

  this._primitive = undefined;
}

/**
 * @private
 */
DebugModelMatrixPrimitive.prototype.update = function (frameState) {
  if (!this.show) {
    return;
  }

  if (
    !defined(this._primitive) ||
    !Matrix4.equals(this._modelMatrix, this.modelMatrix) ||
    this._length !== this.length ||
    this._width !== this.width ||
    this._id !== this.id
  ) {
    this._modelMatrix = Matrix4.clone(this.modelMatrix, this._modelMatrix);
    this._length = this.length;
    this._width = this.width;
    this._id = this.id;

    if (defined(this._primitive)) {
      this._primitive.destroy();
    }

    // Workaround projecting (0, 0, 0)
    if (
      this.modelMatrix[12] === 0.0 &&
      this.modelMatrix[13] === 0.0 &&
      this.modelMatrix[14] === 0.0
    ) {
      this.modelMatrix[14] = 0.01;
    }

    const x = new GeometryInstance({
      geometry: new PolylineGeometry({
        positions: [Cartesian3.ZERO, Cartesian3.UNIT_X],
        width: this.width,
        vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
        colors: [Color.RED, Color.RED],
        arcType: ArcType.NONE,
      }),
      modelMatrix: Matrix4.multiplyByUniformScale(
        this.modelMatrix,
        this.length,
        new Matrix4(),
      ),
      id: this.id,
      pickPrimitive: this,
    });
    const y = new GeometryInstance({
      geometry: new PolylineGeometry({
        positions: [Cartesian3.ZERO, Cartesian3.UNIT_Y],
        width: this.width,
        vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
        colors: [Color.GREEN, Color.GREEN],
        arcType: ArcType.NONE,
      }),
      modelMatrix: Matrix4.multiplyByUniformScale(
        this.modelMatrix,
        this.length,
        new Matrix4(),
      ),
      id: this.id,
      pickPrimitive: this,
    });
    const z = new GeometryInstance({
      geometry: new PolylineGeometry({
        positions: [Cartesian3.ZERO, Cartesian3.UNIT_Z],
        width: this.width,
        vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
        colors: [Color.BLUE, Color.BLUE],
        arcType: ArcType.NONE,
      }),
      modelMatrix: Matrix4.multiplyByUniformScale(
        this.modelMatrix,
        this.length,
        new Matrix4(),
      ),
      id: this.id,
      pickPrimitive: this,
    });

    this._primitive = new Primitive({
      geometryInstances: [x, y, z],
      appearance: new PolylineColorAppearance(),
      asynchronous: false,
    });
  }

  this._primitive.update(frameState);
};

/**
 * 如果此对象被销毁，返回 true；否则返回 false
 * <p>
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常
 * </p>
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，返回 <code>false</code>；否则返回 <code>false</code>
 *
 * @see DebugModelMatrixPrimitive#destroy
 */
DebugModelMatrixPrimitive.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁该对象所持有的 WebGL 资源。销毁对象可以确定性地释放 WebGL 资源，而无需依赖垃圾收集器来销毁该对象
 * 一旦对象被销毁，不应使用它；调用除
 * <p>
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给该对象，如示例中所示
 * 对象被销毁，即调用了 destroy()
 * </p>
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 *
 * @example
 * p = p && p.destroy();
 *
 * @see DebugModelMatrixPrimitive#isDestroyed
 */
DebugModelMatrixPrimitive.prototype.destroy = function () {
  this._primitive = this._primitive && this._primitive.destroy();
  return destroyObject(this);
};
export default DebugModelMatrixPrimitive;
