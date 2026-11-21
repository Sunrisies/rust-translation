import {
  BoundingSphere,
  Cartesian3,
  Check,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  Math as CesiumMath,
  Matrix4,
  SphereOutlineGeometry,
} from "@cesium/core";
import PerInstanceColorAppearance from "./PerInstanceColorAppearance.js";
import Primitive from "./Primitive.js";

/**
 * 以球体形式指定的瓦片边界框。
 * @alias TileBoundingSphere
 * @constructor
 *
 * @param {Cartesian3} [center=Cartesian3.ZERO] 边界球体的中心。
 * @param {number} [radius=0.0] 边界球体的半径。
 *
 * @private
 */
function TileBoundingSphere(center, radius) {
  if (radius === 0) {
    radius = CesiumMath.EPSILON7;
  }
  this._boundingSphere = new BoundingSphere(center, radius);
}

Object.defineProperties(TileBoundingSphere.prototype, {
  /**
   * 边界球体的中心
   *
   * @memberof TileBoundingSphere.prototype
   *
   * @type {Cartesian3}
   * @readonly
   */
  center: {
    get: function () {
      return this._boundingSphere.center;
    },
  },

  /**
   * 边界球体的半径
   *
   * @memberof TileBoundingSphere.prototype
   *
   * @type {number}
   * @readonly
   */
  radius: {
    get: function () {
      return this._boundingSphere.radius;
    },
  },

  /**
   * 底层的边界框
   *
   * @memberof TileBoundingSphere.prototype
   *
   * @type {object}
   * @readonly
   */
  boundingVolume: {
    get: function () {
      return this._boundingSphere;
    },
  },
  /**
   * 底层的边界球体
   *
   * @memberof TileBoundingSphere.prototype
   *
   * @type {BoundingSphere}
   * @readonly
   */
  boundingSphere: {
    get: function () {
      return this._boundingSphere;
    },
  },
});

/**
 * 计算该边界球体与绑定在 frameState 中的相机之间的距离。
 *
 * @param {FrameState} frameState 绑定相机的 frameState。
 * @returns {number} The 相机与边界球体之间的距离，以米为单位。如果相机在边界框内，则返回 0。
 *
 */
TileBoundingSphere.prototype.distanceToCamera = function (frameState) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("frameState", frameState);
  //>>includeEnd('debug');
  const boundingSphere = this._boundingSphere;
  return Math.max(
    0.0,
    Cartesian3.distance(boundingSphere.center, frameState.camera.positionWC) -
      boundingSphere.radius,
  );
};

/**
 * 确定该球体位于平面的哪一侧。
 *
 * @param {Plane} plane 需要检测的平面。
 * @returns {Intersect} {@link 如果整个球体位于平面的同一侧，则执行 Intersect.INSIDE；
 * 如果整个球体位于平面的相反侧，则执行 Intersect.OUTSIDE；
 * 如果球体与平面相交，则执行 Intersect.INTERSECTING。
 * 如果球体与平面相交。
 */
TileBoundingSphere.prototype.intersectPlane = function (plane) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("plane", plane);
  //>>includeEnd('debug');
  return BoundingSphere.intersectPlane(this._boundingSphere, plane);
};

/**
 * 在瓦片变换后更新边界球体。
 *
 * @param {Cartesian3} center 边界球体的中心。
 * @param {number} radius 边界球体的半径。
 */
TileBoundingSphere.prototype.update = function (center, radius) {
  Cartesian3.clone(center, this._boundingSphere.center);
  this._boundingSphere.radius = radius;
};

/**
 * 创建显示球体轮廓的调试primitive。
 *
 * @param {Color} color primitive 网格的期望颜色
 * @return {Primitive}
 */
TileBoundingSphere.prototype.createDebugVolume = function (color) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("color", color);
  //>>includeEnd('debug');
  const geometry = new SphereOutlineGeometry({
    radius: this.radius,
  });
  const modelMatrix = Matrix4.fromTranslation(
    this.center,
    Matrix4.clone(Matrix4.IDENTITY),
  );
  const instance = new GeometryInstance({
    geometry: geometry,
    id: "outline",
    modelMatrix: modelMatrix,
    attributes: {
      color: ColorGeometryInstanceAttribute.fromColor(color),
    },
  });

  return new Primitive({
    geometryInstances: instance,
    appearance: new PerInstanceColorAppearance({
      translucent: false,
      flat: true,
    }),
    asynchronous: false,
  });
};
export default TileBoundingSphere;
