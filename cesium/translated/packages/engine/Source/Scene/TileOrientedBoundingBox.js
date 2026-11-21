import {
  BoundingSphere,
  BoxOutlineGeometry,
  Cartesian3,
  Check,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  OrientedBoundingBox,
} from "@cesium/core";
import PerInstanceColorAppearance from "./PerInstanceColorAppearance.js";
import Primitive from "./Primitive.js";

const scratchU = new Cartesian3();
const scratchV = new Cartesian3();
const scratchW = new Cartesian3();
const scratchCartesian = new Cartesian3();

function computeMissingVector(a, b, result) {
  result = Cartesian3.cross(a, b, result);
  const magnitude = Cartesian3.magnitude(result);
  return Cartesian3.multiplyByScalar(
    result,
    CesiumMath.EPSILON7 / magnitude,
    result,
  );
}

function findOrthogonalVector(a, result) {
  const temp = Cartesian3.normalize(a, scratchCartesian);
  const b = Cartesian3.equalsEpsilon(
    temp,
    Cartesian3.UNIT_X,
    CesiumMath.EPSILON6,
  )
    ? Cartesian3.UNIT_Y
    : Cartesian3.UNIT_X;
  return computeMissingVector(a, b, result);
}

function checkHalfAxes(halfAxes) {
  let u = Matrix3.getColumn(halfAxes, 0, scratchU);
  let v = Matrix3.getColumn(halfAxes, 1, scratchV);
  let w = Matrix3.getColumn(halfAxes, 2, scratchW);

  const uZero = Cartesian3.equals(u, Cartesian3.ZERO);
  const vZero = Cartesian3.equals(v, Cartesian3.ZERO);
  const wZero = Cartesian3.equals(w, Cartesian3.ZERO);

  if (!uZero && !vZero && !wZero) {
    return halfAxes;
  }
  if (uZero && vZero && wZero) {
    halfAxes[0] = CesiumMath.EPSILON7;
    halfAxes[4] = CesiumMath.EPSILON7;
    halfAxes[8] = CesiumMath.EPSILON7;
    return halfAxes;
  }
  if (uZero && !vZero && !wZero) {
    u = computeMissingVector(v, w, u);
  } else if (!uZero && vZero && !wZero) {
    v = computeMissingVector(u, w, v);
  } else if (!uZero && !vZero && wZero) {
    w = computeMissingVector(v, u, w);
  } else if (!uZero) {
    v = findOrthogonalVector(u, v);
    w = computeMissingVector(v, u, w);
  } else if (!vZero) {
    u = findOrthogonalVector(v, u);
    w = computeMissingVector(v, u, w);
  } else if (!wZero) {
    u = findOrthogonalVector(w, u);
    v = computeMissingVector(w, u, v);
  }

  Matrix3.setColumn(halfAxes, 0, u, halfAxes);
  Matrix3.setColumn(halfAxes, 1, v, halfAxes);
  Matrix3.setColumn(halfAxes, 2, w, halfAxes);

  return halfAxes;
}

/**
 * 以定向边界框形式指定的瓦片边界体积。
 * @alias TileOrientedBoundingBox
 * @constructor
 *
 * @param {Cartesian3} [center=Cartesian3.ZERO] 框的中心点。
 * @param {Matrix3} [halfAxes=Matrix3.ZERO] 边界框的三个正交半轴。
 * 等价于变换矩阵，用于旋转和缩放一个 2x2x2 立方体。
 * 以原点为中心的立方体。
 *
 * @private
 */
function TileOrientedBoundingBox(center, halfAxes) {
  halfAxes = checkHalfAxes(halfAxes);
  this._orientedBoundingBox = new OrientedBoundingBox(center, halfAxes);
  this._boundingSphere = BoundingSphere.fromOrientedBoundingBox(
    this._orientedBoundingBox,
  );
}

Object.defineProperties(TileOrientedBoundingBox.prototype, {
  /**
   * 底层的边界体积。
   *
   * @memberof TileOrientedBoundingBox.prototype
   *
   * @type {OrientedBoundingBox}
   * @readonly
   */
  boundingVolume: {
    get: function () {
      return this._orientedBoundingBox;
    },
  },
  /**
   * 底层的边界球体。
   *
   * @memberof TileOrientedBoundingBox.prototype
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
 * 计算此边界框与绑定在 frameState 中的相机之间的距离。
 *
 * @param {FrameState} frameState 绑定相机的 frameState。
 * @returns {number} The 相机与边界框之间的距离，单位：米。如果相机在边界体积内，则返回 0。
 */
TileOrientedBoundingBox.prototype.distanceToCamera = function (frameState) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("frameState", frameState);
  //>>includeEnd('debug');
  return Math.sqrt(
    this._orientedBoundingBox.distanceSquaredTo(frameState.camera.positionWC),
  );
};

/**
 * 确定该框位于平面的哪一侧。
 *
 * @param {Plane} plane 需要检测的平面。
 * @returns {Intersect} {@link 如果整个框都在平面的同一侧，则使用 Intersect.INSIDE；
 * 如果整个框都在平面的相反侧，则使用 {@link Intersect.OUTSIDE}；
 * 如果框与平面相交，则使用 {@link Intersect.INTERSECTING}。
 * 如果框与平面相交。
 */
TileOrientedBoundingBox.prototype.intersectPlane = function (plane) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("plane", plane);
  //>>includeEnd('debug');
  return this._orientedBoundingBox.intersectPlane(plane);
};

/**
 * 在瓦片变换后更新边界框。
 *
 * @param {Cartesian3} center 框的中心点。
 * @param {Matrix3} halfAxes 边界框的三个正交半轴。
 * 等价于变换矩阵，用于旋转和缩放一个 2x2x2 立方体。
 * 以原点为中心的立方体。
 */
TileOrientedBoundingBox.prototype.update = function (center, halfAxes) {
  Cartesian3.clone(center, this._orientedBoundingBox.center);
  halfAxes = checkHalfAxes(halfAxes);
  Matrix3.clone(halfAxes, this._orientedBoundingBox.halfAxes);
  BoundingSphere.fromOrientedBoundingBox(
    this._orientedBoundingBox,
    this._boundingSphere,
  );
};

/**
 * 创建显示框轮廓的调试primitive。
 *
 * @param {Color} color primitive网格的期望颜色。
 * @return {Primitive}
 */
TileOrientedBoundingBox.prototype.createDebugVolume = function (color) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("color", color);
  //>>includeEnd('debug');

  const geometry = new BoxOutlineGeometry({
    // Make a 2x2x2 cube
    minimum: new Cartesian3(-1.0, -1.0, -1.0),
    maximum: new Cartesian3(1.0, 1.0, 1.0),
  });
  const modelMatrix = Matrix4.fromRotationTranslation(
    this.boundingVolume.halfAxes,
    this.boundingVolume.center,
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
export default TileOrientedBoundingBox;
