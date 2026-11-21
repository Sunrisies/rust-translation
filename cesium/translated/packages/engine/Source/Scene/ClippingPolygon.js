import {
  Cartesian3,
  Check,
  Ellipsoid,
  PolygonGeometry,
  Rectangle,
  defined,
  deprecationWarning,
} from "@cesium/core";

/**
 * 用于 {@link ClippingPlaneCollection} 的几何多边形，用于选择性地隐藏模型、3D 瓦片集或地球仪中的区域。
 * @alias ClippingPolygon
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Cartesian3[]} options.positions 定义裁剪多边形外环的三个或更多笛卡尔坐标列表。
 * @param {Cartesian3[][]} [options.holes] 内部环（孔洞）的数组，每个数组包含三个或更多的笛卡尔坐标。孔洞内的区域不会被纳入多边形中。
 * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.default]
 *
 * @example
 * const positions = Cesium.Cartesian3.fromRadiansArray([
 *     -1.3194369277314022,
 *     0.6988062530900625,
 *     -1.31941,
 *     0.69879,
 *     -1.3193955980204217,
 *     0.6988091578771254,
 *     -1.3193931220959367,
 *     0.698743632490865,
 *     -1.3194358224045408,
 *     0.6987471965556998,
 * ]);
 *
 * const polygon = new Cesium.ClippingPolygon({
 * positions: positions
 * });
 *
 * @example
 * // 一个包含两个孔洞的裁剪多边形。孔洞内的区域不会被裁剪。
 * const outerRing = Cesium.Cartesian3.fromDegreesArray([
 *     -100.0, 40.0,
 *     -90.0, 40.0,
 *     -90.0, 50.0,
 *     -100.0, 50.0,
 * ]);
 *
 * const firstHole = Cesium.Cartesian3.fromDegreesArray([
 *     -98.0, 42.0,
 *     -96.0, 42.0,
 *     -96.0, 44.0,
 *     -98.0, 44.0,
 * ]);
 *
 * const secondHole = Cesium.Cartesian3.fromDegreesArray([
 *     -94.0, 46.0,
 *     -92.0, 46.0,
 *     -92.0, 48.0,
 *     -94.0, 48.0,
 * ]);
 *
 * const polygonWithHoles = new Cesium.ClippingPolygon({
 * positions: outerRing,
 * holes: [firstHole, secondHole],
 * });
 */
function ClippingPolygon(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options", options);
  Check.typeOf.object("options.positions", options.positions);
  Check.typeOf.number.greaterThanOrEquals(
    "options.positions.length",
    options.positions.length,
    3,
  );
  if (defined(options.holes)) {
    for (let i = 0; i < options.holes.length; i++) {
      Check.typeOf.number.greaterThanOrEquals(
        `options.holes[${i}].length`,
        options.holes[i].length,
        3,
      );
    }
  }
  //>>includeEnd('debug');

  this._ellipsoid = options.ellipsoid ?? Ellipsoid.default;
  this._positions = copyArrayCartesian3(options.positions);
  this._holes = defined(options.holes)
    ? options.holes.map(copyArrayCartesian3)
    : [];

  /**
   * 包含外环的地图矩形
   *
   * @type {Rectangle}
   * @private
   */
  this._rectangle = PolygonGeometry.computeRectangleFromPositions(
    this._positions,
    this._ellipsoid,
  );

  // Freeze the geometry so it cannot change after construction. To change a
  // polygon, remove it from the collection and add a new one.
  deepFreeze(this._positions);
  deepFreezeHoles(this._holes);
}

/**
 * 返回给定数组的深度副本。
 *
 * 如果输入未定义，则返回 <code>undefined</code>。
 *
 * 否则，结果将是给定数组的副本，其中
 * 每个元素都通过 <code>Cartesian3.clone</code> 复制。
 *
 * @param {Cartesian3[]|undefined} input 输入数组
 * @returns {Cartesian3[]|undefined} The copy
 * @ignore
 */
function copyArrayCartesian3(input) {
  if (!defined(input)) {
    return undefined;
  }
  const n = input.length;
  const output = Array(n);
  for (let i = 0; i < n; i++) {
    output[i] = Cartesian3.clone(input[i]);
  }
  return output;
}

/**
 * 冻结一个位置数组及其包含的每个 Cartesian3 对象，使得
 * 多边形的几何结构无法被就地修改。返回相同的数组。
 *
 * @param {Cartesian3[]} positions 要冻结的数组
 * @returns {Cartesian3[]} The frozen array
 * @ignore
 */
function deepFreeze(positions) {
  for (let i = 0; i < positions.length; i++) {
    Object.freeze(positions[i]);
  }
  return Object.freeze(positions);
}

/**
 * 冻结一个环（孔洞）数组及其内容。返回相同的数组。
 *
 * @param {Cartesian3[][]} holes 要冻结的环
 * @returns {Cartesian3[][]} The frozen array
 * @ignore
 */
function deepFreezeHoles(holes) {
  for (let i = 0; i < holes.length; i++) {
    deepFreeze(holes[i]);
  }
  return Object.freeze(holes);
}

/**
 * 返回给定数组是否在分量上相等。
 *
 * 当两个数组都未定义时，返回 <code>true</code>。
 * 当只有一个数组定义，或两者都定义但长度不同时，返回 <code>false</code>。
 * 否则，返回数组对应元素是否通过 <code>Cartesian3.equals</code> 相等。
 *
 * 第一个数组
 * 第二个数组
 *
 * @param {Cartesian3[]|undefined} a 数组是否相等
 * @param {Cartesian3[]|undefined} b 返回两个环数组是否在分量上相等。
 * @returns {boolean} Whether 第一个环数组
 * @ignore
 */
function equalsArrayCartesian3(a, b) {
  if (!defined(a) && !defined(b)) {
    return true;
  }
  if (defined(a) !== defined(b)) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  const n = a.length;
  for (let i = 0; i < n; i++) {
    const ca = a[i];
    const cb = b[i];
    if (!Cartesian3.equals(ca, cb)) {
      return false;
    }
  }
  return true;
}

/**
 * 返回两个环数组是否在分量上相等。
 *
 * @param {Cartesian3[][]} a 第一个环数组
 * @param {Cartesian3[][]} b 第二个环数组
 * @returns {boolean} Whether 环数组是否相等
 * @ignore
 */
function equalsHoles(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!equalsArrayCartesian3(a[i], b[i])) {
      return false;
    }
  }
  return true;
}

Object.defineProperties(ClippingPolygon.prototype, {
  /**
   * 返回多边形中的总位置数，包括所有孔洞。
   *
   * @memberof ClippingPolygon.prototype
   * @type {number}
   * @readonly
   */
  length: {
    get: function () {
      let count = this._positions.length;
      const holes = this._holes;
      for (let i = 0; i < holes.length; i++) {
        count += holes[i].length;
      }
      return count;
    },
  },
  /**
   * 返回位置的外环。ClippingPolygon 的几何结构是不可变的；返回的数组及其坐标被冻结。
   * immutable; the returned array and its coordinates are frozen.
   *
   * @memberof ClippingPolygon.prototype
   * @type {Cartesian3[]}
   * @readonly
   */
  positions: {
    get: function () {
      return this._positions;
    },
  },
  /**
   * 返回多边形的内部环（孔洞），每个环为一组坐标位置。
   *
   * @memberof ClippingPolygon.prototype
   * @type {Cartesian3[][]}
   * @readonly
   */
  holes: {
    get: function () {
      return this._holes;
    },
  },
  /**
   * 返回用于将多边形裁剪到表面时投影的椭球体。
   *
   * @memberof ClippingPolygon.prototype
   * @type {Ellipsoid}
   * @readonly
   */
  ellipsoid: {
    get: function () {
      return this._ellipsoid;
    },
  },
  /**
   * 在构建时一次性计算包含多边形的地图矩形。
   * 由于裁剪多边形几何形状不可变，该矩形始终不变。
   * 不会发生变化。
   *
   * @memberof ClippingPolygon.prototype
   * @type {Rectangle}
   * @readonly
   */
  rectangle: {
    get: function () {
      return this._rectangle;
    },
  },
});

/**
 * 克隆裁剪多边形，但不改变其所有权。
 * @param {ClippingPolygon} polygon 要克隆的裁剪多边形。
 * @param {ClippingPolygon} [result] 存储克隆参数所依赖的对象。
 * @returns {ClippingPolygon} a 对输入裁剪多边形的克隆操作。
 */
ClippingPolygon.clone = function (polygon, result) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("polygon", polygon);
  //>>includeEnd('debug');

  if (!defined(result)) {
    return new ClippingPolygon({
      positions: polygon.positions,
      holes: polygon.holes,
      ellipsoid: polygon.ellipsoid,
    });
  }

  result._ellipsoid = polygon.ellipsoid;
  result._positions = copyArrayCartesian3(polygon.positions);
  result._holes = polygon.holes.map(copyArrayCartesian3);
  result._rectangle = PolygonGeometry.computeRectangleFromPositions(
    result._positions,
    result._ellipsoid,
  );
  deepFreeze(result._positions);
  deepFreezeHoles(result._holes);
  return result;
};

/**
 * 比较提供的两个裁剪多边形，返回
 * 如果相等则返回 <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {ClippingPolygon} left 第一个多边形。
 * @param {ClippingPolygon} right 第二个多边形。
 * @returns {boolean} <code>true</code> 如果左右值相等则返回 <code>false</code>，否则返回 <code>true</code>。
 */
ClippingPolygon.equals = function (left, right) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("left", left);
  Check.typeOf.object("right", right);
  //>>includeEnd('debug');

  return (
    left.ellipsoid.equals(right.ellipsoid) &&
    left.positions === right.positions &&
    equalsHoles(left.holes, right.holes)
  );
};

/**
 * 计算包含由坐标位置列表定义的多边形的地图矩形，涵盖国际日期线和极地区域的情况。
 *
 * @param {Rectangle} [result] 存储结果的对象。
 * @returns {Rectangle} The 结果矩形。
 *
 * @deprecated This 该函数已过时，将在 CesiumJS 1.147 中移除。请改用 {@link ClippingPolygon#rectangle}。
 */
ClippingPolygon.prototype.computeRectangle = function (result) {
  deprecationWarning(
    "ClippingPolygon.computeRectangle",
    "ClippingPolygon.computeRectangle is deprecated as of CesiumJS 1.145 and will be removed in 1.147. Use the ClippingPolygon.rectangle property instead.",
  );
  return Rectangle.clone(this._rectangle, result);
};

export default ClippingPolygon;
