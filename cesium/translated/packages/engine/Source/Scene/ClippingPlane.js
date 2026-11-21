import { Cartesian3, Check, defined } from "@cesium/core";

/**
 * 用于 {@link ClippingPlaneCollection} 的赫斯曼标准形式平面。
 * 与 {@link Plane} 中的数学函数兼容。
 *
 * @alias ClippingPlane
 * @constructor
 *
 * @param {Cartesian3} normal 平面的法线（已归一化）。
 * @param {number} distance 从原点到平面的最短距离。其符号表示...
 * <code>distance</code> 决定了原点位于平面的哪一侧。如果 <code>distance</code> 为正，则原点位于法线方向的半空间；如果为负，则原点位于与法线相反的半空间；如果为零，则平面通过原点。
 * 从原点到平面的最短距离。其符号表示...
 * <code>distance</code> 决定了原点位于平面的哪一侧。如果 <code>distance</code> 为正，则原点位于法线方向的半空间；如果为负，则原点位于与法线相反的半空间；如果为零，则平面通过原点。
 * 平面的法线。
 */
function ClippingPlane(normal, distance) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("normal", normal);
  Check.typeOf.number("distance", distance);
  //>>includeEnd('debug');

  this._distance = distance;
  this._normal = new UpdateChangedCartesian3(normal, this);
  this.onChangeCallback = undefined;
  this.index = -1; // to be set by ClippingPlaneCollection
}

Object.defineProperties(ClippingPlane.prototype, {
  /**
   * 从平面对象创建裁剪平面。
   * 包含要复制参数的平面。
   * 存储结果的对象。
   * 根据平面参数生成的裁剪平面。
   * 克隆裁剪平面而不改变其所有权。
   *
   * @type {number}
   * @memberof ClippingPlane.prototype
   */
  distance: {
    get: function () {
      return this._distance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');
      if (defined(this.onChangeCallback) && value !== this._distance) {
        this.onChangeCallback(this.index);
      }
      this._distance = value;
    },
  },
  /**
   * 要克隆的裁剪平面。
   *
   * @type {Cartesian3}
   * @memberof ClippingPlane.prototype
   */
  normal: {
    get: function () {
      return this._normal;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.object("value", value);
      //>>includeEnd('debug');
      if (
        defined(this.onChangeCallback) &&
        !Cartesian3.equals(this._normal._cartesian3, value)
      ) {
        this.onChangeCallback(this.index);
      }
      // Set without firing callback again
      Cartesian3.clone(value, this._normal._cartesian3);
    },
  },
});

/**
 * 从平面对象创建裁剪平面。
 *
 * @param {Plane} plane 包含要复制参数的平面。
 * @param {ClippingPlane} [result] 存储克隆参数结果的对象。
 * @returns {ClippingPlane} The 根据平面参数生成的裁剪平面。
 */
ClippingPlane.fromPlane = function (plane, result) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("plane", plane);
  //>>includeEnd('debug');

  if (!defined(result)) {
    result = new ClippingPlane(plane.normal, plane.distance);
  } else {
    result.normal = plane.normal;
    result.distance = plane.distance;
  }
  return result;
};

/**
 * 克隆裁剪平面而不改变其所有权。
 * @param {ClippingPlane} clippingPlane 要克隆的裁剪平面。
 * @param {ClippingPlane} [result] 存储克隆参数结果的对象。
 * @returns {ClippingPlane} a 输入裁剪平面的克隆。
 */
ClippingPlane.clone = function (clippingPlane, result) {
  if (!defined(result)) {
    return new ClippingPlane(clippingPlane.normal, clippingPlane.distance);
  }
  result.normal = clippingPlane.normal;
  result.distance = clippingPlane.distance;
  return result;
};

/**
 * 在 Cartesian3 上的包装器，允许通过“成员中的成员”检测平面的变化，例如：
 *
 * const clippingPlane = new ClippingPlane(...);
 * clippingPlane.normal.z = -1.0;
 *
 * @private
 */
function UpdateChangedCartesian3(normal, clippingPlane) {
  this._clippingPlane = clippingPlane;
  this._cartesian3 = Cartesian3.clone(normal);
}

Object.defineProperties(UpdateChangedCartesian3.prototype, {
  x: {
    get: function () {
      return this._cartesian3.x;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');
      if (
        defined(this._clippingPlane.onChangeCallback) &&
        value !== this._cartesian3.x
      ) {
        this._clippingPlane.onChangeCallback(this._clippingPlane.index);
      }
      this._cartesian3.x = value;
    },
  },
  y: {
    get: function () {
      return this._cartesian3.y;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');
      if (
        defined(this._clippingPlane.onChangeCallback) &&
        value !== this._cartesian3.y
      ) {
        this._clippingPlane.onChangeCallback(this._clippingPlane.index);
      }
      this._cartesian3.y = value;
    },
  },
  z: {
    get: function () {
      return this._cartesian3.z;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');
      if (
        defined(this._clippingPlane.onChangeCallback) &&
        value !== this._cartesian3.z
      ) {
        this._clippingPlane.onChangeCallback(this._clippingPlane.index);
      }
      this._cartesian3.z = value;
    },
  },
});
export default ClippingPlane;
