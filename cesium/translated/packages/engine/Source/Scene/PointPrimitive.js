import {
  BoundingRectangle,
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Color,
  DeveloperError,
  DistanceDisplayCondition,
  Frozen,
  Matrix4,
  NearFarScalar,
  defined,
} from "@cesium/core";
import SceneMode from "./SceneMode.js";
import SceneTransforms from "./SceneTransforms.js";
import SplitDirection from "./SplitDirection.js";

/**
 * <div class="notice">
 * 通过调用 {@link PointPrimitiveCollection#add} 创建点并设置其初始属性。不要直接调用构造函数。
 * </div>
 * 位于 3D 场景中的图形点，即被创建
 * 并使用 {@link PointPrimitiveCollection} 进行渲染。
 *
 * @alias PointPrimitive
 *
 * @performance Reading 某个属性，例如 {@link PointPrimitive#show}，是常量时间操作。
 * 对属性的赋值是常量时间操作，但会导致
 * 在调用 {@link PointPrimitiveCollection#update} 时产生 CPU 到 GPU 的数据传输。每个 pointPrimitives 的传输量
 * 与更新的属性数量无关。如果集合中的大多数 pointPrimitives 需要被
 * 更新，使用 {@link PointPrimitiveCollection#removeAll} 清空集合可能更高效。
 * 然后添加新的 pointPrimitives，而不是修改每一个。
 *
 * @exception {DeveloperError} scaleByDistance.far 必须大于 scaleByDistance.near。
 * @exception {DeveloperError} translucencyByDistance.far 必须大于 translucencyByDistance.near。
 * @exception {DeveloperError} distanceDisplayCondition.far 必须大于 distanceDisplayCondition.near。
 *
 * @see PointPrimitiveCollection
 * @see PointPrimitiveCollection#add
 *
 * @internalConstructor
 * @class
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=points|Cesium Sandcastle Points Demo}
 */
function PointPrimitive(options, pointPrimitiveCollection) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  if (
    defined(options.disableDepthTestDistance) &&
    options.disableDepthTestDistance < 0.0
  ) {
    throw new DeveloperError(
      "disableDepthTestDistance must be greater than or equal to 0.0.",
    );
  }
  //>>includeEnd('debug');

  let translucencyByDistance = options.translucencyByDistance;
  let scaleByDistance = options.scaleByDistance;
  let distanceDisplayCondition = options.distanceDisplayCondition;
  if (defined(translucencyByDistance)) {
    //>>includeStart('debug', pragmas.debug);
    if (translucencyByDistance.far <= translucencyByDistance.near) {
      throw new DeveloperError(
        "translucencyByDistance.far must be greater than translucencyByDistance.near.",
      );
    }
    //>>includeEnd('debug');
    translucencyByDistance = NearFarScalar.clone(translucencyByDistance);
  }
  if (defined(scaleByDistance)) {
    //>>includeStart('debug', pragmas.debug);
    if (scaleByDistance.far <= scaleByDistance.near) {
      throw new DeveloperError(
        "scaleByDistance.far must be greater than scaleByDistance.near.",
      );
    }
    //>>includeEnd('debug');
    scaleByDistance = NearFarScalar.clone(scaleByDistance);
  }
  if (defined(distanceDisplayCondition)) {
    //>>includeStart('debug', pragmas.debug);
    if (distanceDisplayCondition.far <= distanceDisplayCondition.near) {
      throw new DeveloperError(
        "distanceDisplayCondition.far must be greater than distanceDisplayCondition.near.",
      );
    }
    //>>includeEnd('debug');
    distanceDisplayCondition = DistanceDisplayCondition.clone(
      distanceDisplayCondition,
    );
  }

  this._show = options.show ?? true;
  this._position = Cartesian3.clone(options.position ?? Cartesian3.ZERO);
  this._actualPosition = Cartesian3.clone(this._position); // For columbus view and 2D
  this._color = Color.clone(options.color ?? Color.WHITE);
  this._outlineColor = Color.clone(options.outlineColor ?? Color.TRANSPARENT);
  this._outlineWidth = options.outlineWidth ?? 0.0;
  this._pixelSize = options.pixelSize ?? 10.0;
  this._scaleByDistance = scaleByDistance;
  this._translucencyByDistance = translucencyByDistance;
  this._distanceDisplayCondition = distanceDisplayCondition;
  this._disableDepthTestDistance = options.disableDepthTestDistance ?? 0.0;
  this._id = options.id;
  this._collection = options.collection ?? pointPrimitiveCollection;

  this._clusterShow = true;

  this._pickId = undefined;
  this._pointPrimitiveCollection = pointPrimitiveCollection;
  this._dirty = false;
  this._index = -1; //Used only by PointPrimitiveCollection

  this._splitDirection = options.splitDirection ?? SplitDirection.NONE;
}

const SHOW_INDEX = (PointPrimitive.SHOW_INDEX = 0);
const POSITION_INDEX = (PointPrimitive.POSITION_INDEX = 1);
const COLOR_INDEX = (PointPrimitive.COLOR_INDEX = 2);
const OUTLINE_COLOR_INDEX = (PointPrimitive.OUTLINE_COLOR_INDEX = 3);
const OUTLINE_WIDTH_INDEX = (PointPrimitive.OUTLINE_WIDTH_INDEX = 4);
const PIXEL_SIZE_INDEX = (PointPrimitive.PIXEL_SIZE_INDEX = 5);
const SCALE_BY_DISTANCE_INDEX = (PointPrimitive.SCALE_BY_DISTANCE_INDEX = 6);
const TRANSLUCENCY_BY_DISTANCE_INDEX =
  (PointPrimitive.TRANSLUCENCY_BY_DISTANCE_INDEX = 7);
const DISTANCE_DISPLAY_CONDITION_INDEX =
  (PointPrimitive.DISTANCE_DISPLAY_CONDITION_INDEX = 8);
const DISABLE_DEPTH_DISTANCE_INDEX =
  (PointPrimitive.DISABLE_DEPTH_DISTANCE_INDEX = 9);
const SPLIT_DIRECTION_INDEX = (PointPrimitive.SPLIT_DIRECTION_INDEX = 10);
PointPrimitive.NUMBER_OF_PROPERTIES = 11;

function makeDirty(pointPrimitive, propertyChanged) {
  const pointPrimitiveCollection = pointPrimitive._pointPrimitiveCollection;
  if (defined(pointPrimitiveCollection)) {
    pointPrimitiveCollection._updatePointPrimitive(
      pointPrimitive,
      propertyChanged,
    );
    pointPrimitive._dirty = true;
  }
}

Object.defineProperties(PointPrimitive.prototype, {
  /**
   * 决定该点是否显示。使用此属性来隐藏或显示点，而不是
   * 将其移除并重新添加到集合中。
   * @memberof PointPrimitive.prototype
   * @type {boolean}
   */
  show: {
    get: function () {
      return this._show;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (!defined(value)) {
        throw new DeveloperError("value is required.");
      }
      //>>includeEnd('debug');

      if (this._show !== value) {
        this._show = value;
        makeDirty(this, SHOW_INDEX);
      }
    },
  },

  /**
   * 获取或设置该点的笛卡尔坐标位置。
   * @memberof PointPrimitive.prototype
   * @type {Cartesian3}
   */
  position: {
    get: function () {
      return this._position;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug)
      if (!defined(value)) {
        throw new DeveloperError("value is required.");
      }
      //>>includeEnd('debug');

      const position = this._position;
      if (!Cartesian3.equals(position, value)) {
        Cartesian3.clone(value, position);
        Cartesian3.clone(value, this._actualPosition);

        makeDirty(this, POSITION_INDEX);
      }
    },
  },

  /**
   * 根据点与相机的距离获取或设置近和远缩放属性。
   * 点的缩放会在 {@link NearFarScalar#nearValue} 和
   * {@link NearFarScalar#farValue} while the camera distance falls within the lower and upper bounds
   * of the specified {@link NearFarScalar#near} and {@link NearFarScalar#far}.
   * 将 pixelSize 和 outlineWidth 相乘以影响点的总大小。如果未定义，
   * multiplies the pixelSize and outlineWidth to affect the total size of the point.  If undefined,
   * scaleByDistance 将被禁用。
   * @memberof PointPrimitive.prototype
   * @type {NearFarScalar}
   *
   * @example
   * // 示例 1。
   * // 将 pointPrimitive 的 scaleByDistance 设置为当
   * // 相机距离 pointPrimitive 1500 米时，该点消失，并且
   * // 当相机距离接近 8.0e6 米时。
   * p.scaleByDistance = new Cesium.NearFarScalar(1.5e2, 15, 8.0e6, 0.0);
   *
   * @example
   * // 示例 2。
   * // 禁用距离缩放
   * p.scaleByDistance = undefined;
   */
  scaleByDistance: {
    get: function () {
      return this._scaleByDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value) && value.far <= value.near) {
        throw new DeveloperError(
          "far distance must be greater than near distance.",
        );
      }
      //>>includeEnd('debug');

      const scaleByDistance = this._scaleByDistance;
      if (!NearFarScalar.equals(scaleByDistance, value)) {
        this._scaleByDistance = NearFarScalar.clone(value, scaleByDistance);
        makeDirty(this, SCALE_BY_DISTANCE_INDEX);
      }
    },
  },

  /**
   * 根据点与相机的距离获取或设置近和远半透明属性。
   * 点的半透明度会在 {@link NearFarScalar#nearValue} 和
   * {@link NearFarScalar#farValue} 之间插值，当相机距离落在上下范围内时。
   * 指定 {@link NearFarScalar#near} 和 {@link NearFarScalar#far} 的值。
   * 超出这些范围时，点的半透明度会被限制在最近的边界。如果未定义，
   * translucencyByDistance 将被禁用。
   * @memberof PointPrimitive.prototype
   * @type {NearFarScalar}
   *
   * @example
   * // 示例 1。
   * // 当相机距离点 1500 米时，将点的半透明度设置为 1.0，并且随着
   * // 相机距离接近 8.0e6 米时，点消失。
   * p.translucencyByDistance = new Cesium.NearFarScalar(1.5e2, 1.0, 8.0e6, 0.0);
   * // 示例 2。
   *
   * @example
   * // 禁用基于距离的半透明度
   * p.translucencyByDistance = undefined;
   * 获取或设置点内部尺寸（以像素为单位）。
   */
  translucencyByDistance: {
    get: function () {
      return this._translucencyByDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value) && value.far <= value.near) {
        throw new DeveloperError(
          "far distance must be greater than near distance.",
        );
      }
      //>>includeEnd('debug');

      const translucencyByDistance = this._translucencyByDistance;
      if (!NearFarScalar.equals(translucencyByDistance, value)) {
        this._translucencyByDistance = NearFarScalar.clone(
          value,
          translucencyByDistance,
        );
        makeDirty(this, TRANSLUCENCY_BY_DISTANCE_INDEX);
      }
    },
  },

  /**
   * 获取或设置点的内部颜色。
   * @memberof PointPrimitive.prototype
   * @type {number}
   */
  pixelSize: {
    get: function () {
      return this._pixelSize;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (!defined(value)) {
        throw new DeveloperError("value is required.");
      }
      //>>includeEnd('debug');

      if (this._pixelSize !== value) {
        this._pixelSize = value;
        makeDirty(this, PIXEL_SIZE_INDEX);
      }
    },
  },

  /**
   * 红色、绿色、蓝色和透明度值由 <code>value</code> 的 <code>red</code>、<code>green</code>，
   * <code>blue</code> 和 <code>alpha</code> 属性表示，如示例 1 所示。这些数值范围从 <code>0.0</code>
   * （无强度）到 <code>1.0</code>（全强度）。
   * // 示例 1。分配黄色。
   * @memberof PointPrimitive.prototype
   * @type {Color}
   *
   * @example
   * p.color = Cesium.Color.YELLOW;
   * // 示例 2。使点Primitive 半透明 50%。
   *
   * @example
   * p.color = new Cesium.Color(1.0, 1.0, 1.0, 0.5);
   * 获取或设置点的轮廓颜色。
   */
  color: {
    get: function () {
      return this._color;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (!defined(value)) {
        throw new DeveloperError("value is required.");
      }
      //>>includeEnd('debug');

      const color = this._color;
      if (!Color.equals(color, value)) {
        Color.clone(value, color);
        makeDirty(this, COLOR_INDEX);
      }
    },
  },

  /**
   * 获取或设置轮廓宽度（以像素为单位）。此宽度会加到 pixelSize 上，
   * @memberof PointPrimitive.prototype
   * @type {Color}
   */
  outlineColor: {
    get: function () {
      return this._outlineColor;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (!defined(value)) {
        throw new DeveloperError("value is required.");
      }
      //>>includeEnd('debug');

      const outlineColor = this._outlineColor;
      if (!Color.equals(outlineColor, value)) {
        Color.clone(value, outlineColor);
        makeDirty(this, OUTLINE_COLOR_INDEX);
      }
    },
  },

  /**
   * 从而增加点的总大小。
   * 获取或设置条件，指定该点在距离相机多远的范围内显示。
   * @memberof PointPrimitive.prototype
   * @type {number}
   */
  outlineWidth: {
    get: function () {
      return this._outlineWidth;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (!defined(value)) {
        throw new DeveloperError("value is required.");
      }
      //>>includeEnd('debug');

      if (this._outlineWidth !== value) {
        this._outlineWidth = value;
        makeDirty(this, OUTLINE_WIDTH_INDEX);
      }
    },
  },

  /**
   * 获取或设置使深度测试失效的距离，例如防止与地形发生裁剪。
   * @memberof PointPrimitive.prototype
   * @type {DistanceDisplayCondition}
   * @default undefined
   */
  distanceDisplayCondition: {
    get: function () {
      return this._distanceDisplayCondition;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value) && value.far <= value.near) {
        throw new DeveloperError("far must be greater than near");
      }
      //>>includeEnd('debug');
      if (
        !DistanceDisplayCondition.equals(this._distanceDisplayCondition, value)
      ) {
        this._distanceDisplayCondition = DistanceDisplayCondition.clone(
          value,
          this._distanceDisplayCondition,
        );
        makeDirty(this, DISTANCE_DISPLAY_CONDITION_INDEX);
      }
    },
  },

  /**
   * 当设置为零时，始终应用深度测试；当设置为 Number.POSITIVE_INFINITY 时，永远不应用深度测试。
   * 当设置为零时，深度测试始终应用；当设置为 Number.POSITIVE_INFINITY 时，永远不应用深度测试。
   * @memberof PointPrimitive.prototype
   * @type {number}
   * @default 0.0
   */
  disableDepthTestDistance: {
    get: function () {
      return this._disableDepthTestDistance;
    },
    set: function (value) {
      if (this._disableDepthTestDistance !== value) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(value) || value < 0.0) {
          throw new DeveloperError(
            "disableDepthTestDistance must be greater than or equal to 0.0.",
          );
        }
        //>>includeEnd('debug');
        this._disableDepthTestDistance = value;
        makeDirty(this, DISABLE_DEPTH_DISTANCE_INDEX);
      }
    },
  },

  /**
   * 获取或设置点被选中时返回的自定义值。
   * @memberof PointPrimitive.prototype
   * @type {*}
   */
  id: {
    get: function () {
      return this._id;
    },
    set: function (value) {
      this._id = value;
      if (defined(this._pickId)) {
        this._pickId.object.id = value;
      }
    },
  },

  /**
   * @private
   */
  pickId: {
    get: function () {
      return this._pickId;
    },
  },

  /**
   * 决定由于聚集而显示或隐藏该点。
   * @memberof PointPrimitive.prototype
   * @type {boolean}
   * @private
   */
  clusterShow: {
    get: function () {
      return this._clusterShow;
    },
    set: function (value) {
      if (this._clusterShow !== value) {
        this._clusterShow = value;
        makeDirty(this, SHOW_INDEX);
      }
    },
  },

  /**
   * 应用于该点的 {@link SplitDirection}。
   * @memberof PointPrimitive.prototype
   * @type {SplitDirection}
   * @default {@link SplitDirection.NONE}
   */
  splitDirection: {
    get: function () {
      return this._splitDirection;
    },
    set: function (value) {
      if (this._splitDirection !== value) {
        this._splitDirection = value;
        makeDirty(this, SPLIT_DIRECTION_INDEX);
      }
    },
  },
});

PointPrimitive.prototype.getPickId = function (context) {
  if (!defined(this._pickId)) {
    this._pickId = context.createPickId({
      primitive: this,
      collection: this._collection,
      id: this._id,
    });
  }

  return this._pickId;
};

PointPrimitive.prototype._getActualPosition = function () {
  return this._actualPosition;
};

PointPrimitive.prototype._setActualPosition = function (value) {
  Cartesian3.clone(value, this._actualPosition);
  makeDirty(this, POSITION_INDEX);
};

const tempCartesian3 = new Cartesian4();
PointPrimitive._computeActualPosition = function (
  position,
  frameState,
  modelMatrix,
) {
  if (frameState.mode === SceneMode.SCENE3D) {
    return position;
  }

  Matrix4.multiplyByPoint(modelMatrix, position, tempCartesian3);
  return SceneTransforms.computeActualEllipsoidPosition(
    frameState,
    tempCartesian3,
  );
};

const scratchCartesian4 = new Cartesian4();

// This function is basically a stripped-down JavaScript version of PointPrimitiveCollectionVS.glsl
PointPrimitive._computeScreenSpacePosition = function (
  modelMatrix,
  position,
  scene,
  result,
) {
  // Model to world coordinates
  const positionWorld = Matrix4.multiplyByVector(
    modelMatrix,
    Cartesian4.fromElements(
      position.x,
      position.y,
      position.z,
      1,
      scratchCartesian4,
    ),
    scratchCartesian4,
  );
  const positionWC = SceneTransforms.worldToWindowCoordinates(
    scene,
    positionWorld,
    result,
  );
  return positionWC;
};

/**
 * 计算点原点的屏幕空间位置。
 * 屏幕空间原点是画布的左上角；<code>x</code> 从
 * 左侧到右侧增加，<code>y</code> 从顶部到底部增加。
 *
 * @param {Scene} scene 场景。
 * @param {Cartesian2} [result] 存储结果的对象。
 * @returns {Cartesian2} The 点的屏幕空间位置。
 *
 * @exception {DeveloperError} PointPrimitive 必须位于集合中。
 *
 * @example
 * console.log(p.computeScreenSpacePosition(scene).toString());
 */
PointPrimitive.prototype.computeScreenSpacePosition = function (scene, result) {
  const pointPrimitiveCollection = this._pointPrimitiveCollection;
  if (!defined(result)) {
    result = new Cartesian2();
  }

  //>>includeStart('debug', pragmas.debug);
  if (!defined(pointPrimitiveCollection)) {
    throw new DeveloperError("PointPrimitive must be in a collection.");
  }
  if (!defined(scene)) {
    throw new DeveloperError("scene is required.");
  }
  //>>includeEnd('debug');

  const modelMatrix = pointPrimitiveCollection.modelMatrix;
  const windowCoordinates = PointPrimitive._computeScreenSpacePosition(
    modelMatrix,
    this._actualPosition,
    scene,
    result,
  );
  if (!defined(windowCoordinates)) {
    return undefined;
  }

  windowCoordinates.y = scene.canvas.clientHeight - windowCoordinates.y;
  return windowCoordinates;
};

/**
 * 获取以 screenSpacePosition 为中心的点的屏幕空间边界框。
 * @param {PointPrimitive} point 用于获取屏幕空间边界框的点。
 * @param {Cartesian2} screenSpacePosition 标签的屏幕空间中心。
 * @param {BoundingRectangle} [result] 用于存储结果的对象。
 * @returns {BoundingRectangle} The 屏幕空间边界框。
 *
 * @private
 */
PointPrimitive.getScreenSpaceBoundingBox = function (
  point,
  screenSpacePosition,
  result,
) {
  const size = point.pixelSize;
  const halfSize = size * 0.5;

  const x = screenSpacePosition.x - halfSize;
  const y = screenSpacePosition.y - halfSize;
  const width = size;
  const height = size;

  if (!defined(result)) {
    result = new BoundingRectangle();
  }

  result.x = x;
  result.y = y;
  result.width = width;
  result.height = height;

  return result;
};

/**
 * 判断该点是否等于另一个点。如果所有属性均相等，则两点相等；来自不同集合的点也可以相等。
 * 用于比较相等性的点。
 *
 * @param {PointPrimitive} [other] 用于判断相等性的点。
 * @returns {boolean} <code>true</code> 如果两点相等，则返回 true；否则返回 <code>false</code>。
 */
PointPrimitive.prototype.equals = function (other) {
  return (
    this === other ||
    (defined(other) &&
      this._id === other._id &&
      Cartesian3.equals(this._position, other._position) &&
      Color.equals(this._color, other._color) &&
      this._pixelSize === other._pixelSize &&
      this._outlineWidth === other._outlineWidth &&
      this._show === other._show &&
      Color.equals(this._outlineColor, other._outlineColor) &&
      NearFarScalar.equals(this._scaleByDistance, other._scaleByDistance) &&
      NearFarScalar.equals(
        this._translucencyByDistance,
        other._translucencyByDistance,
      ) &&
      DistanceDisplayCondition.equals(
        this._distanceDisplayCondition,
        other._distanceDisplayCondition,
      ) &&
      this._disableDepthTestDistance === other._disableDepthTestDistance &&
      this._splitDirection === other._splitDirection)
  );
};

PointPrimitive.prototype._destroy = function () {
  this._pickId = this._pickId && this._pickId.destroy();
  this._pointPrimitiveCollection = undefined;
};
export default PointPrimitive;