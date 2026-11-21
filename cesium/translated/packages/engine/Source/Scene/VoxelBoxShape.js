import {
  BoundingSphere,
  Cartesian3,
  Check,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  OrientedBoundingBox,
} from "@cesium/core";
import VoxelBoundsCollection from "./VoxelBoundsCollection.js";
import ClippingPlane from "./ClippingPlane.js";

/**
 * 一个控件 {@link VoxelShape}。
 *
 * @alias VoxelBoxShape
 * @constructor
 *
 * @see VoxelShape
 * @see VoxelEllipsoidShape
 * @see VoxelCylinderShape
 * @see VoxelShapeType
 *
 * @private
 */
function VoxelBoxShape() {
  this._orientedBoundingBox = new OrientedBoundingBox();
  this._boundingSphere = new BoundingSphere();
  this._boundTransform = new Matrix4();
  this._shapeTransform = new Matrix4();

  /**
   * 形状的最小边界。
   * @type {Cartesian3}
   * @private
   */
  this._minBounds = VoxelBoxShape.DefaultMinBounds.clone();

  /**
   * 形状的最大边界。
   * @type {Cartesian3}
   * @private
   */
  this._maxBounds = VoxelBoxShape.DefaultMaxBounds.clone();

  /**
   * 形状的最小渲染边界。
   * @type {Cartesian3}
   * @private
   */
  this._renderMinBounds = VoxelBoxShape.DefaultMinBounds.clone();

  /**
   * 形状的最大渲染边界。
   * @type {Cartesian3}
   * @private
   */
  this._renderMaxBounds = VoxelBoxShape.DefaultMaxBounds.clone();

  const { DefaultMinBounds, DefaultMaxBounds } = VoxelBoxShape;
  const boundPlanes = [
    new ClippingPlane(
      Cartesian3.negate(Cartesian3.UNIT_X, new Cartesian3()),
      DefaultMinBounds.x,
    ),
    new ClippingPlane(
      Cartesian3.negate(Cartesian3.UNIT_Y, new Cartesian3()),
      DefaultMinBounds.y,
    ),
    new ClippingPlane(
      Cartesian3.negate(Cartesian3.UNIT_Z, new Cartesian3()),
      DefaultMinBounds.z,
    ),
    new ClippingPlane(Cartesian3.UNIT_X, -DefaultMaxBounds.x),
    new ClippingPlane(Cartesian3.UNIT_Y, -DefaultMaxBounds.y),
    new ClippingPlane(Cartesian3.UNIT_Z, -DefaultMaxBounds.z),
  ];

  this._renderBoundPlanes = new VoxelBoundsCollection({ planes: boundPlanes });

  /**
   * UV空间变换平移（仅适用于JS，非着色器统一变量）。
   * @type {Cartesian3}
   * @private
   */
  this._localToShapeUvTranslate = new Cartesian3();

  this._shaderUniforms = {
    boxEcToXyz: new Matrix3(),
    boxLocalToShapeUvScale: new Cartesian3(),
  };

  this._shaderDefines = {
    BOX_INTERSECTION_INDEX: undefined,
  };

  this._shaderMaximumIntersectionsLength = 0; // not known until update
}

Object.defineProperties(VoxelBoxShape.prototype, {
  /**
   * 包含被限定实体的定向边界框。
   *
   * @memberof VoxelBoxShape.prototype
   * @type {OrientedBoundingBox}
   * @readonly
   * @private
   */
  orientedBoundingBox: {
    get: function () {
      return this._orientedBoundingBox;
    },
  },

  /**
   * 用于渲染边界的平面集合。
   * @memberof VoxelBoxShape.prototype
   * @type {VoxelBoundsCollection}
   * @readonly
   * @private
   */
  renderBoundPlanes: {
    get: function () {
      return this._renderBoundPlanes;
    },
  },

  /**
   * 包含被限定实体的边界球体。
   *
   * @memberof VoxelBoxShape.prototype
   * @type {BoundingSphere}
   * @readonly
   * @private
   */
  boundingSphere: {
    get: function () {
      return this._boundingSphere;
    },
  },

  /**
   * 包含被限定实体的变换矩阵。
   *
   * @memberof VoxelBoxShape.prototype
   * @type {Matrix4}
   * @readonly
   * @private
   */
  boundTransform: {
    get: function () {
      return this._boundTransform;
    },
  },

  /**
   * 包含形状的变换矩阵，忽略边界。
   *
   * @memberof VoxelBoxShape.prototype
   * @type {Matrix4}
   * @readonly
   * @private
   */
  shapeTransform: {
    get: function () {
      return this._shapeTransform;
    },
  },

  /**
   * @memberof VoxelBoxShape.prototype
   * @type {Object<string, any>}
   * @readonly
   * @private
   */
  shaderUniforms: {
    get: function () {
      return this._shaderUniforms;
    },
  },

  /**
   * @memberof VoxelBoxShape.prototype
   * @type {Object<string, any>}
   * @readonly
   * @private
   */
  shaderDefines: {
    get: function () {
      return this._shaderDefines;
    },
  },

  /**
   * 任意射线方向与形状的最大交点数。
   * @memberof VoxelBoxShape.prototype
   * @type {number}
   * @readonly
   * @private
   */
  shaderMaximumIntersectionsLength: {
    get: function () {
      return this._shaderMaximumIntersectionsLength;
    },
  },
});

const scratchCenter = new Cartesian3();
const scratchScale = new Cartesian3();
const scratchRotation = new Matrix3();
const scratchClipMinBounds = new Cartesian3();
const scratchClipMaxBounds = new Cartesian3();

/**
 * 更新形状的状态。
 * @private
 * @param {Matrix4} modelMatrix 模型矩阵。
 * @param {Cartesian3} minBounds 最小边界。
 * @param {Cartesian3} maxBounds 最大边界。
 * @param {Cartesian3} [clipMinBounds] 最小裁剪边界。
 * @param {Cartesian3} [clipMaxBounds] 最大裁剪边界。
 * @returns {boolean} Whether 形状可见。
 */
VoxelBoxShape.prototype.update = function (
  modelMatrix,
  minBounds,
  maxBounds,
  clipMinBounds,
  clipMaxBounds,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("modelMatrix", modelMatrix);
  Check.typeOf.object("minBounds", minBounds);
  Check.typeOf.object("maxBounds", maxBounds);
  //>>includeEnd('debug');

  clipMinBounds = clipMinBounds ?? minBounds.clone(scratchClipMinBounds);
  clipMaxBounds = clipMaxBounds ?? maxBounds.clone(scratchClipMaxBounds);

  minBounds = Cartesian3.clone(minBounds, this._minBounds);
  maxBounds = Cartesian3.clone(maxBounds, this._maxBounds);

  const renderMinBounds = Cartesian3.clamp(
    minBounds,
    clipMinBounds,
    clipMaxBounds,
    this._renderMinBounds,
  );
  const renderMaxBounds = Cartesian3.clamp(
    maxBounds,
    clipMinBounds,
    clipMaxBounds,
    this._renderMaxBounds,
  );

  // Box is not visible if:
  // - any of the min render bounds exceed the max render bounds
  // - two or more of the min bounds equal the max bounds (line / point)
  // - scale is 0 for any component (too annoying to reconstruct rotation matrix)
  const scale = Matrix4.getScale(modelMatrix, scratchScale);
  if (
    renderMinBounds.x > renderMaxBounds.x ||
    renderMinBounds.y > renderMaxBounds.y ||
    renderMinBounds.z > renderMaxBounds.z ||
    (renderMinBounds.x === renderMaxBounds.x) +
      (renderMinBounds.y === renderMaxBounds.y) +
      (renderMinBounds.z === renderMaxBounds.z) >=
      2 ||
    scale.x === 0.0 ||
    scale.y === 0.0 ||
    scale.z === 0.0
  ) {
    return false;
  }

  // Update the render bounds planes
  const renderBoundPlanes = this._renderBoundPlanes;
  renderBoundPlanes.get(0).distance = renderMinBounds.x;
  renderBoundPlanes.get(1).distance = renderMinBounds.y;
  renderBoundPlanes.get(2).distance = renderMinBounds.z;
  renderBoundPlanes.get(3).distance = -renderMaxBounds.x;
  renderBoundPlanes.get(4).distance = -renderMaxBounds.y;
  renderBoundPlanes.get(5).distance = -renderMaxBounds.z;

  this._shapeTransform = Matrix4.clone(modelMatrix, this._shapeTransform);

  this._orientedBoundingBox = getBoxChunkObb(
    renderMinBounds,
    renderMaxBounds,
    this._shapeTransform,
    this._orientedBoundingBox,
  );

  // All of the box bounds go from -1 to +1, so the model matrix scale can be
  // used as the oriented bounding box half axes.
  this._boundTransform = Matrix4.fromRotationTranslation(
    this._orientedBoundingBox.halfAxes,
    this._orientedBoundingBox.center,
    this._boundTransform,
  );

  this._boundingSphere = BoundingSphere.fromOrientedBoundingBox(
    this._orientedBoundingBox,
    this._boundingSphere,
  );

  const shaderUniforms = this._shaderUniforms;
  const shaderDefines = this._shaderDefines;

  // To keep things simple, clear the defines every time
  for (const key in shaderDefines) {
    if (shaderDefines.hasOwnProperty(key)) {
      shaderDefines[key] = undefined;
    }
  }

  // Keep track of how many intersections there are going to be.
  let intersectionCount = 0;

  shaderDefines["BOX_INTERSECTION_INDEX"] = intersectionCount;
  intersectionCount += 1;

  // Compute scale and translation to transform from UV space to bounded UV space
  const min = minBounds;
  const max = maxBounds;
  const boxLocalToShapeUvScale = Cartesian3.fromElements(
    boundScale(min.x, max.x),
    boundScale(min.y, max.y),
    boundScale(min.z, max.z),
    shaderUniforms.boxLocalToShapeUvScale,
  );
  this._localToShapeUvTranslate = Cartesian3.negate(
    Cartesian3.multiplyComponents(
      boxLocalToShapeUvScale,
      min,
      this._localToShapeUvTranslate,
    ),
    this._localToShapeUvTranslate,
  );

  this._shaderMaximumIntersectionsLength = intersectionCount;

  return true;
};

function boundScale(minBound, maxBound) {
  return CesiumMath.equalsEpsilon(minBound, maxBound, CesiumMath.EPSILON7)
    ? 1.0
    : 1.0 / (maxBound - minBound);
}

const scratchTransformPositionWorldToLocal = new Matrix4();
/**
 * 更新任何依赖视图的变换。
 * @private
 * @param {FrameState} frameState 帧状态。
 */
VoxelBoxShape.prototype.updateViewTransforms = function (frameState) {
  const shaderUniforms = this._shaderUniforms;
  const transformPositionWorldToLocal = Matrix4.inverse(
    this._shapeTransform,
    scratchTransformPositionWorldToLocal,
  );
  const transformDirectionWorldToLocal = Matrix4.getMatrix3(
    transformPositionWorldToLocal,
    shaderUniforms.boxEcToXyz,
  );
  const rotateViewToWorld = frameState.context.uniformState.inverseViewRotation;
  Matrix3.multiply(
    transformDirectionWorldToLocal,
    rotateViewToWorld,
    shaderUniforms.boxEcToXyz,
  );
};

/**
 * 将局部坐标转换为形状的UV空间。
 * @private
 * @param {Cartesian3} positionLocal 需要转换的局部坐标。
 * @param {Cartesian3} result 存储结果的笛卡尔3坐标。
 * @returns {Cartesian3} The 转换后的UV坐标。
 */
VoxelBoxShape.prototype.convertLocalToShapeUvSpace = function (
  positionLocal,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("positionLocal", positionLocal);
  Check.typeOf.object("result", result);
  //>>includeEnd('debug');

  const { boxLocalToShapeUvScale } = this._shaderUniforms;
  const boxLocalToShapeUvTranslate = this._localToShapeUvTranslate;

  return Cartesian3.add(
    Cartesian3.multiplyComponents(
      positionLocal,
      boxLocalToShapeUvScale,
      result,
    ),
    boxLocalToShapeUvTranslate,
    result,
  );
};

const scratchTileMinBounds = new Cartesian3();
const scratchTileMaxBounds = new Cartesian3();

/**
 * 为指定的瓦片计算定向边界框。
 * @private
 * @param {number} tileLevel 瓦片的层级。
 * @param {number} tileX 瓦片的x坐标。
 * @param {number} tileY 瓦片的y坐标。
 * @param {number} tileZ 瓦片的z坐标。
 * @param {OrientedBoundingBox} result 将包围指定瓦片的定向边界框。
 * @returns {OrientedBoundingBox} The 定向边界框。
 */
VoxelBoxShape.prototype.computeOrientedBoundingBoxForTile = function (
  tileLevel,
  tileX,
  tileY,
  tileZ,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("tileLevel", tileLevel);
  Check.typeOf.number("tileX", tileX);
  Check.typeOf.number("tileY", tileY);
  Check.typeOf.number("tileZ", tileZ);
  Check.typeOf.object("result", result);
  //>>includeEnd('debug');

  const minBounds = this._minBounds;
  const maxBounds = this._maxBounds;
  const sizeAtLevel = 1.0 / Math.pow(2, tileLevel);

  const tileMinBounds = Cartesian3.fromElements(
    CesiumMath.lerp(minBounds.x, maxBounds.x, sizeAtLevel * tileX),
    CesiumMath.lerp(minBounds.y, maxBounds.y, sizeAtLevel * tileY),
    CesiumMath.lerp(minBounds.z, maxBounds.z, sizeAtLevel * tileZ),
    scratchTileMinBounds,
  );

  const tileMaxBounds = Cartesian3.fromElements(
    CesiumMath.lerp(minBounds.x, maxBounds.x, sizeAtLevel * (tileX + 1)),
    CesiumMath.lerp(minBounds.y, maxBounds.y, sizeAtLevel * (tileY + 1)),
    CesiumMath.lerp(minBounds.z, maxBounds.z, sizeAtLevel * (tileZ + 1)),
    scratchTileMaxBounds,
  );

  return getBoxChunkObb(
    tileMinBounds,
    tileMaxBounds,
    this._shapeTransform,
    result,
  );
};

const sampleSizeScratch = new Cartesian3();

/**
 * 为指定瓦片内的指定样本计算定向边界框。
 * @private
 * @param {SpatialNode} spatialNode 包含样本的空间节点。
 * @param {Cartesian3} tileDimensions 瓦片在填充前的样本数量。
 * @param {Cartesian3} tileUv 瓦片内的样本坐标。
 * @param {OrientedBoundingBox} result 将包围指定样本的定向边界框。
 * @returns {OrientedBoundingBox} The 定向边界框。
 */
VoxelBoxShape.prototype.computeOrientedBoundingBoxForSample = function (
  spatialNode,
  tileDimensions,
  tileUv,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("spatialNode", spatialNode);
  Check.typeOf.object("tileDimensions", tileDimensions);
  Check.typeOf.object("tileUv", tileUv);
  Check.typeOf.object("result", result);
  //>>includeEnd('debug');

  const tileSizeAtLevel = 1.0 / Math.pow(2, spatialNode.level);
  const sampleSize = Cartesian3.divideComponents(
    Cartesian3.ONE,
    tileDimensions,
    sampleSizeScratch,
  );
  const sampleSizeAtLevel = Cartesian3.multiplyByScalar(
    sampleSize,
    tileSizeAtLevel,
    sampleSizeScratch,
  );

  const minLerp = Cartesian3.multiplyByScalar(
    Cartesian3.fromElements(
      spatialNode.x + tileUv.x,
      spatialNode.y + tileUv.y,
      spatialNode.z + tileUv.z,
      scratchTileMinBounds,
    ),
    tileSizeAtLevel,
    scratchTileMinBounds,
  );
  const maxLerp = Cartesian3.add(
    minLerp,
    sampleSizeAtLevel,
    scratchTileMaxBounds,
  );

  const minBounds = this._minBounds;
  const maxBounds = this._maxBounds;
  const sampleMinBounds = Cartesian3.fromElements(
    CesiumMath.lerp(minBounds.x, maxBounds.x, minLerp.x),
    CesiumMath.lerp(minBounds.y, maxBounds.y, minLerp.y),
    CesiumMath.lerp(minBounds.z, maxBounds.z, minLerp.z),
    scratchTileMinBounds,
  );
  const sampleMaxBounds = Cartesian3.fromElements(
    CesiumMath.lerp(minBounds.x, maxBounds.x, maxLerp.x),
    CesiumMath.lerp(minBounds.y, maxBounds.y, maxLerp.y),
    CesiumMath.lerp(minBounds.z, maxBounds.z, maxLerp.z),
    scratchTileMaxBounds,
  );

  return getBoxChunkObb(
    sampleMinBounds,
    sampleMaxBounds,
    this._shapeTransform,
    result,
  );
};

/**
 * 定义形状的最小边界。对应最小X、Y、Z值。
 * @private
 * @type {Cartesian3}
 * @constant
 * @readonly
 */
VoxelBoxShape.DefaultMinBounds = Object.freeze(
  new Cartesian3(-1.0, -1.0, -1.0),
);

/**
 * 定义形状的最大边界。对应最大X、Y、Z值。
 * @private
 * @type {Cartesian3}
 * @constant
 * @readonly
 */
VoxelBoxShape.DefaultMaxBounds = Object.freeze(
  new Cartesian3(+1.0, +1.0, +1.0),
);

const scratchBoxScale = new Cartesian3();
/**
 * 为形状的子区域计算一个 {@link OrientedBoundingBox}。
 *
 * @function
 *
 * @param {Cartesian3} minimumBounds 形状的局部坐标下的最小边界。
 * @param {Cartesian3} maximumBounds 形状的局部坐标下的最大边界。
 * @param {Matrix4} matrix 变换点的矩阵。
 * @param {OrientedBoundingBox} result 存储结果的对象。
 * @returns {OrientedBoundingBox} The 包含该子区域的定向边界框。
 *
 * @private
 */
function getBoxChunkObb(minimumBounds, maximumBounds, matrix, result) {
  const defaultMinBounds = VoxelBoxShape.DefaultMinBounds;
  const defaultMaxBounds = VoxelBoxShape.DefaultMaxBounds;

  const isDefaultBounds =
    Cartesian3.equals(minimumBounds, defaultMinBounds) &&
    Cartesian3.equals(maximumBounds, defaultMaxBounds);

  if (isDefaultBounds) {
    result.center = Matrix4.getTranslation(matrix, result.center);
    result.halfAxes = Matrix4.getMatrix3(matrix, result.halfAxes);
  } else {
    let scale = Matrix4.getScale(matrix, scratchBoxScale);
    const localCenter = Cartesian3.midpoint(
      minimumBounds,
      maximumBounds,
      scratchCenter,
    );
    result.center = Matrix4.multiplyByPoint(matrix, localCenter, result.center);
    scale = Cartesian3.fromElements(
      scale.x * 0.5 * (maximumBounds.x - minimumBounds.x),
      scale.y * 0.5 * (maximumBounds.y - minimumBounds.y),
      scale.z * 0.5 * (maximumBounds.z - minimumBounds.z),
      scratchBoxScale,
    );
    const rotation = Matrix4.getRotation(matrix, scratchRotation);
    result.halfAxes = Matrix3.setScale(rotation, scale, result.halfAxes);
  }

  return result;
}

export default VoxelBoxShape;
