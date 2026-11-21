import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Check,
  ComponentDatatype,
  EncodedCartesian3,
  FixedFrameTransforms,
  GeometryInstanceAttribute,
  Math as CesiumMath,
  Matrix4,
  Rectangle,
  defined,
} from "@cesium/core";
import ShaderSource from "../Renderer/ShaderSource.js";
import PerInstanceColorAppearance from "../Scene/PerInstanceColorAppearance.js";
import ShadowVolumeAppearanceFS from "../Shaders/ShadowVolumeAppearanceFS.js";

/**
 * 为 ClassificationPrimitive 创建着色器，使其能够使用给定的外观以及拾取功能。
 *
 * @param {boolean} extentsCulling 丢弃实例纹理坐标范围之外的片段。
 * @param {boolean} planarExtents 如果设置为 true，则使用平面而非球面坐标计算纹理坐标。
 * @param {Appearance} appearance 通过 GroundPrimitive 与 ClassificationPrimitive 一起使用的外观。
 * @private
 */
function ShadowVolumeAppearance(extentsCulling, planarExtents, appearance) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.bool("extentsCulling", extentsCulling);
  Check.typeOf.bool("planarExtents", planarExtents);
  Check.typeOf.object("appearance", appearance);
  //>>includeEnd('debug');

  this._projectionExtentDefines = {
    eastMostYhighDefine: "",
    eastMostYlowDefine: "",
    westMostYhighDefine: "",
    westMostYlowDefine: "",
  };

  // Compute shader dependencies
  const colorShaderDependencies = new ShaderDependencies();
  colorShaderDependencies.requiresTextureCoordinates = extentsCulling;
  colorShaderDependencies.requiresEC = !appearance.flat;

  const pickShaderDependencies = new ShaderDependencies();
  pickShaderDependencies.requiresTextureCoordinates = extentsCulling;

  if (appearance instanceof PerInstanceColorAppearance) {
    // PerInstanceColorAppearance doesn't have material.shaderSource, instead it has its own vertex and fragment shaders
    colorShaderDependencies.requiresNormalEC = !appearance.flat;
  } else {
    // Scan material source for what hookups are needed. Assume czm_materialInput materialInput.
    const materialShaderSource = `${appearance.material.shaderSource}\n${appearance.fragmentShaderSource}`;

    colorShaderDependencies.normalEC =
      materialShaderSource.indexOf("materialInput.normalEC") !== -1 ||
      materialShaderSource.indexOf("czm_getDefaultMaterial") !== -1;
    colorShaderDependencies.positionToEyeEC =
      materialShaderSource.indexOf("materialInput.positionToEyeEC") !== -1;
    colorShaderDependencies.tangentToEyeMatrix =
      materialShaderSource.indexOf("materialInput.tangentToEyeMatrix") !== -1;
    colorShaderDependencies.st =
      materialShaderSource.indexOf("materialInput.st") !== -1;
  }

  this._colorShaderDependencies = colorShaderDependencies;
  this._pickShaderDependencies = pickShaderDependencies;
  this._appearance = appearance;
  this._extentsCulling = extentsCulling;
  this._planarExtents = planarExtents;
}

/**
 * 在颜色渲染时，为 ClassificationPrimitive 的颜色通道创建片段着色器。
 *
 * @param {boolean} columbusView2D 该着色器将用于 Columbus View 还是 2D 模式。
 * @returns {ShaderSource} Shader 片段着色器的源数据。
 */
ShadowVolumeAppearance.prototype.createFragmentShader = function (
  columbusView2D,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.bool("columbusView2D", columbusView2D);
  //>>includeEnd('debug');

  const appearance = this._appearance;
  const dependencies = this._colorShaderDependencies;

  const defines = [];
  if (!columbusView2D && !this._planarExtents) {
    defines.push("SPHERICAL");
  }
  if (dependencies.requiresEC) {
    defines.push("REQUIRES_EC");
  }
  if (dependencies.requiresWC) {
    defines.push("REQUIRES_WC");
  }
  if (dependencies.requiresTextureCoordinates) {
    defines.push("TEXTURE_COORDINATES");
  }
  if (this._extentsCulling) {
    defines.push("CULL_FRAGMENTS");
  }
  if (dependencies.requiresNormalEC) {
    defines.push("NORMAL_EC");
  }
  if (appearance instanceof PerInstanceColorAppearance) {
    defines.push("PER_INSTANCE_COLOR");
  }

  // Material inputs. Use of parameters in the material is different
  // from requirement of the parameters in the overall shader, for example,
  // texture coordinates may be used for fragment culling but not for the material itself.
  if (dependencies.normalEC) {
    defines.push("USES_NORMAL_EC");
  }
  if (dependencies.positionToEyeEC) {
    defines.push("USES_POSITION_TO_EYE_EC");
  }
  if (dependencies.tangentToEyeMatrix) {
    defines.push("USES_TANGENT_TO_EYE");
  }
  if (dependencies.st) {
    defines.push("USES_ST");
  }

  if (appearance.flat) {
    defines.push("FLAT");
  }

  let materialSource = "";
  if (!(appearance instanceof PerInstanceColorAppearance)) {
    materialSource = appearance.material.shaderSource;
  }

  return new ShaderSource({
    defines: defines,
    sources: [materialSource, ShadowVolumeAppearanceFS],
  });
};

ShadowVolumeAppearance.prototype.createPickFragmentShader = function (
  columbusView2D,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.bool("columbusView2D", columbusView2D);
  //>>includeEnd('debug');

  const dependencies = this._pickShaderDependencies;

  const defines = ["PICK"];
  if (!columbusView2D && !this._planarExtents) {
    defines.push("SPHERICAL");
  }
  if (dependencies.requiresEC) {
    defines.push("REQUIRES_EC");
  }
  if (dependencies.requiresWC) {
    defines.push("REQUIRES_WC");
  }
  if (dependencies.requiresTextureCoordinates) {
    defines.push("TEXTURE_COORDINATES");
  }
  if (this._extentsCulling) {
    defines.push("CULL_FRAGMENTS");
  }
  return new ShaderSource({
    defines: defines,
    sources: [ShadowVolumeAppearanceFS],
    pickColorQualifier: "in",
  });
};

/**
 * 在三次阴影体积通道的最后阶段，为 ClassificationPrimitive 的颜色通道创建顶点着色器。
 *
 * @param {string[]} defines 传递给顶点着色器的外部定义参数。
 * @param {string} vertexShaderSource 用于计算位置的 ShadowVolumeAppearanceVS 及其必要的修改。
 * @param {boolean} columbusView2D 该着色器将用于 Columbus View 还是 2D 模式。
 * @param {MapProjection} mapProjection 当前场景的地图投影。
 * @returns {string} Shader 顶点着色器的源数据。
 */
ShadowVolumeAppearance.prototype.createVertexShader = function (
  defines,
  vertexShaderSource,
  columbusView2D,
  mapProjection,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("defines", defines);
  Check.typeOf.string("vertexShaderSource", vertexShaderSource);
  Check.typeOf.bool("columbusView2D", columbusView2D);
  Check.defined("mapProjection", mapProjection);
  //>>includeEnd('debug');
  return createShadowVolumeAppearanceVS(
    this._colorShaderDependencies,
    this._planarExtents,
    columbusView2D,
    defines,
    vertexShaderSource,
    this._appearance,
    mapProjection,
    this._projectionExtentDefines,
  );
};

/**
 * 在三次阴影体积通道的最后阶段，为 ClassificationPrimitive 的拾取通道创建顶点着色器。
 *
 * @param {string[]} defines 传递给顶点着色器的外部定义参数。
 * @param {string} vertexShaderSource 用于计算位置和拾取功能的 ShadowVolumeAppearanceVS 及其必要的修改。
 * @param {boolean} columbusView2D 该着色器将用于 Columbus View 还是 2D 模式。
 * @param {MapProjection} mapProjection 当前场景的地图投影。
 * @returns {string} Shader 顶点着色器的源数据。
 */
ShadowVolumeAppearance.prototype.createPickVertexShader = function (
  defines,
  vertexShaderSource,
  columbusView2D,
  mapProjection,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("defines", defines);
  Check.typeOf.string("vertexShaderSource", vertexShaderSource);
  Check.typeOf.bool("columbusView2D", columbusView2D);
  Check.defined("mapProjection", mapProjection);
  //>>includeEnd('debug');
  return createShadowVolumeAppearanceVS(
    this._pickShaderDependencies,
    this._planarExtents,
    columbusView2D,
    defines,
    vertexShaderSource,
    undefined,
    mapProjection,
    this._projectionExtentDefines,
  );
};

const longitudeExtentsCartesianScratch = new Cartesian3();
const longitudeExtentsCartographicScratch = new Cartographic();
const longitudeExtentsEncodeScratch = {
  high: 0.0,
  low: 0.0,
};
function createShadowVolumeAppearanceVS(
  shaderDependencies,
  planarExtents,
  columbusView2D,
  defines,
  vertexShaderSource,
  appearance,
  mapProjection,
  projectionExtentDefines,
) {
  const allDefines = defines.slice();

  if (projectionExtentDefines.eastMostYhighDefine === "") {
    const eastMostCartographic = longitudeExtentsCartographicScratch;
    eastMostCartographic.longitude = CesiumMath.PI;
    eastMostCartographic.latitude = 0.0;
    eastMostCartographic.height = 0.0;
    const eastMostCartesian = mapProjection.project(
      eastMostCartographic,
      longitudeExtentsCartesianScratch,
    );
    let encoded = EncodedCartesian3.encode(
      eastMostCartesian.x,
      longitudeExtentsEncodeScratch,
    );
    projectionExtentDefines.eastMostYhighDefine = `EAST_MOST_X_HIGH ${encoded.high.toFixed(
      `${encoded.high}`.length + 1,
    )}`;
    projectionExtentDefines.eastMostYlowDefine = `EAST_MOST_X_LOW ${encoded.low.toFixed(
      `${encoded.low}`.length + 1,
    )}`;

    const westMostCartographic = longitudeExtentsCartographicScratch;
    westMostCartographic.longitude = -CesiumMath.PI;
    westMostCartographic.latitude = 0.0;
    westMostCartographic.height = 0.0;
    const westMostCartesian = mapProjection.project(
      westMostCartographic,
      longitudeExtentsCartesianScratch,
    );
    encoded = EncodedCartesian3.encode(
      westMostCartesian.x,
      longitudeExtentsEncodeScratch,
    );
    projectionExtentDefines.westMostYhighDefine = `WEST_MOST_X_HIGH ${encoded.high.toFixed(
      `${encoded.high}`.length + 1,
    )}`;
    projectionExtentDefines.westMostYlowDefine = `WEST_MOST_X_LOW ${encoded.low.toFixed(
      `${encoded.low}`.length + 1,
    )}`;
  }

  if (columbusView2D) {
    allDefines.push(projectionExtentDefines.eastMostYhighDefine);
    allDefines.push(projectionExtentDefines.eastMostYlowDefine);
    allDefines.push(projectionExtentDefines.westMostYhighDefine);
    allDefines.push(projectionExtentDefines.westMostYlowDefine);
  }

  if (defined(appearance) && appearance instanceof PerInstanceColorAppearance) {
    allDefines.push("PER_INSTANCE_COLOR");
  }
  if (shaderDependencies.requiresTextureCoordinates) {
    allDefines.push("TEXTURE_COORDINATES");
    if (!(planarExtents || columbusView2D)) {
      allDefines.push("SPHERICAL");
    }
    if (columbusView2D) {
      allDefines.push("COLUMBUS_VIEW_2D");
    }
  }

  return new ShaderSource({
    defines: allDefines,
    sources: [vertexShaderSource],
  });
}

/**
 * 跟踪着色器依赖关系。
 * @private
 */
function ShaderDependencies() {
  this._requiresEC = false;
  this._requiresWC = false; // depends on eye coordinates, needed for material and for phong
  this._requiresNormalEC = false; // depends on eye coordinates, needed for material
  this._requiresTextureCoordinates = false; // depends on world coordinates, needed for material and for culling

  this._usesNormalEC = false;
  this._usesPositionToEyeEC = false;
  this._usesTangentToEyeMat = false;
  this._usesSt = false;
}

Object.defineProperties(ShaderDependencies.prototype, {
  // Set when assessing final shading (flat vs. phong) and culling using computed texture coordinates
  requiresEC: {
    get: function () {
      return this._requiresEC;
    },
    set: function (value) {
      this._requiresEC = value || this._requiresEC;
    },
  },
  requiresWC: {
    get: function () {
      return this._requiresWC;
    },
    set: function (value) {
      this._requiresWC = value || this._requiresWC;
      this.requiresEC = this._requiresWC;
    },
  },
  requiresNormalEC: {
    get: function () {
      return this._requiresNormalEC;
    },
    set: function (value) {
      this._requiresNormalEC = value || this._requiresNormalEC;
      this.requiresEC = this._requiresNormalEC;
    },
  },
  requiresTextureCoordinates: {
    get: function () {
      return this._requiresTextureCoordinates;
    },
    set: function (value) {
      this._requiresTextureCoordinates =
        value || this._requiresTextureCoordinates;
      this.requiresWC = this._requiresTextureCoordinates;
    },
  },
  // Get/Set when assessing material hookups
  normalEC: {
    set: function (value) {
      this.requiresNormalEC = value;
      this._usesNormalEC = value;
    },
    get: function () {
      return this._usesNormalEC;
    },
  },
  tangentToEyeMatrix: {
    set: function (value) {
      this.requiresWC = value;
      this.requiresNormalEC = value;
      this._usesTangentToEyeMat = value;
    },
    get: function () {
      return this._usesTangentToEyeMat;
    },
  },
  positionToEyeEC: {
    set: function (value) {
      this.requiresEC = value;
      this._usesPositionToEyeEC = value;
    },
    get: function () {
      return this._usesPositionToEyeEC;
    },
  },
  st: {
    set: function (value) {
      this.requiresTextureCoordinates = value;
      this._usesSt = value;
    },
    get: function () {
      return this._usesSt;
    },
  },
});

function pointLineDistance(point1, point2, point) {
  return (
    Math.abs(
      (point2.y - point1.y) * point.x -
        (point2.x - point1.x) * point.y +
        point2.x * point1.y -
        point2.y * point1.x,
    ) / Cartesian2.distance(point2, point1)
  );
}

const points2DScratch = [
  new Cartesian2(),
  new Cartesian2(),
  new Cartesian2(),
  new Cartesian2(),
];

// textureCoordinateRotationPoints form 2 lines in the computed UV space that remap to desired texture coordinates.
// This allows simulation of baked texture coordinates for EllipseGeometry, RectangleGeometry, and PolygonGeometry.
function addTextureCoordinateRotationAttributes(
  attributes,
  textureCoordinateRotationPoints,
) {
  const points2D = points2DScratch;

  const minXYCorner = Cartesian2.unpack(
    textureCoordinateRotationPoints,
    0,
    points2D[0],
  );
  const maxYCorner = Cartesian2.unpack(
    textureCoordinateRotationPoints,
    2,
    points2D[1],
  );
  const maxXCorner = Cartesian2.unpack(
    textureCoordinateRotationPoints,
    4,
    points2D[2],
  );

  attributes.uMaxVmax = new GeometryInstanceAttribute({
    componentDatatype: ComponentDatatype.FLOAT,
    componentsPerAttribute: 4,
    normalize: false,
    value: [maxYCorner.x, maxYCorner.y, maxXCorner.x, maxXCorner.y],
  });

  const inverseExtentX =
    1.0 / pointLineDistance(minXYCorner, maxYCorner, maxXCorner);
  const inverseExtentY =
    1.0 / pointLineDistance(minXYCorner, maxXCorner, maxYCorner);

  attributes.uvMinAndExtents = new GeometryInstanceAttribute({
    componentDatatype: ComponentDatatype.FLOAT,
    componentsPerAttribute: 4,
    normalize: false,
    value: [minXYCorner.x, minXYCorner.y, inverseExtentX, inverseExtentY],
  });
}

const cartographicScratch = new Cartographic();
const cornerScratch = new Cartesian3();
const northWestScratch = new Cartesian3();
const southEastScratch = new Cartesian3();
const highLowScratch = { high: 0.0, low: 0.0 };
function add2DTextureCoordinateAttributes(rectangle, projection, attributes) {
  // Compute corner positions in double precision
  const carto = cartographicScratch;
  carto.height = 0.0;

  carto.longitude = rectangle.west;
  carto.latitude = rectangle.south;

  const southWestCorner = projection.project(carto, cornerScratch);

  carto.latitude = rectangle.north;
  const northWest = projection.project(carto, northWestScratch);

  carto.longitude = rectangle.east;
  carto.latitude = rectangle.south;
  const southEast = projection.project(carto, southEastScratch);

  // Since these positions are all in the 2D plane, there's a lot of zeros
  // and a lot of repetition. So we only need to encode 4 values.
  // Encode:
  // x: x value for southWestCorner
  // y: y value for southWestCorner
  // z: y value for northWest
  // w: x value for southEast

  const valuesHigh = [0, 0, 0, 0];
  const valuesLow = [0, 0, 0, 0];
  let encoded = EncodedCartesian3.encode(southWestCorner.x, highLowScratch);
  valuesHigh[0] = encoded.high;
  valuesLow[0] = encoded.low;

  encoded = EncodedCartesian3.encode(southWestCorner.y, highLowScratch);
  valuesHigh[1] = encoded.high;
  valuesLow[1] = encoded.low;

  encoded = EncodedCartesian3.encode(northWest.y, highLowScratch);
  valuesHigh[2] = encoded.high;
  valuesLow[2] = encoded.low;

  encoded = EncodedCartesian3.encode(southEast.x, highLowScratch);
  valuesHigh[3] = encoded.high;
  valuesLow[3] = encoded.low;

  attributes.planes2D_HIGH = new GeometryInstanceAttribute({
    componentDatatype: ComponentDatatype.FLOAT,
    componentsPerAttribute: 4,
    normalize: false,
    value: valuesHigh,
  });

  attributes.planes2D_LOW = new GeometryInstanceAttribute({
    componentDatatype: ComponentDatatype.FLOAT,
    componentsPerAttribute: 4,
    normalize: false,
    value: valuesLow,
  });
}

const enuMatrixScratch = new Matrix4();
const inverseEnuScratch = new Matrix4();
const rectanglePointCartesianScratch = new Cartesian3();
const rectangleCenterScratch = new Cartographic();
const pointsCartographicScratch = [
  new Cartographic(),
  new Cartographic(),
  new Cartographic(),
  new Cartographic(),
  new Cartographic(),
  new Cartographic(),
  new Cartographic(),
  new Cartographic(),
];
/**
 * 在计算限制矩形的平面时，
 * 需要考虑“凸起”和其他变形情况。
 * 将矩形以局部 ENU 系统的平面为基准，将椭圆中心点和边缘中心点展平，并在二维中计算边界，
 * into the plane of the local ENU system, compute bounds in 2D, and
 * 再投影回椭圆中心位置。
 *
 * @private
 */
function computeRectangleBounds(
  rectangle,
  ellipsoid,
  height,
  southWestCornerResult,
  eastVectorResult,
  northVectorResult,
) {
  // Compute center of rectangle
  const centerCartographic = Rectangle.center(
    rectangle,
    rectangleCenterScratch,
  );
  centerCartographic.height = height;
  const centerCartesian = Cartographic.toCartesian(
    centerCartographic,
    ellipsoid,
    rectanglePointCartesianScratch,
  );
  const enuMatrix = FixedFrameTransforms.eastNorthUpToFixedFrame(
    centerCartesian,
    ellipsoid,
    enuMatrixScratch,
  );
  const inverseEnu = Matrix4.inverse(enuMatrix, inverseEnuScratch);

  const west = rectangle.west;
  const east = rectangle.east;
  const north = rectangle.north;
  const south = rectangle.south;

  const cartographics = pointsCartographicScratch;
  cartographics[0].latitude = south;
  cartographics[0].longitude = west;
  cartographics[1].latitude = north;
  cartographics[1].longitude = west;
  cartographics[2].latitude = north;
  cartographics[2].longitude = east;
  cartographics[3].latitude = south;
  cartographics[3].longitude = east;

  const longitudeCenter = (west + east) * 0.5;
  const latitudeCenter = (north + south) * 0.5;

  cartographics[4].latitude = south;
  cartographics[4].longitude = longitudeCenter;
  cartographics[5].latitude = north;
  cartographics[5].longitude = longitudeCenter;
  cartographics[6].latitude = latitudeCenter;
  cartographics[6].longitude = west;
  cartographics[7].latitude = latitudeCenter;
  cartographics[7].longitude = east;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < 8; i++) {
    cartographics[i].height = height;
    const pointCartesian = Cartographic.toCartesian(
      cartographics[i],
      ellipsoid,
      rectanglePointCartesianScratch,
    );
    Matrix4.multiplyByPoint(inverseEnu, pointCartesian, pointCartesian);
    pointCartesian.z = 0.0; // flatten into XY plane of ENU coordinate system
    minX = Math.min(minX, pointCartesian.x);
    maxX = Math.max(maxX, pointCartesian.x);
    minY = Math.min(minY, pointCartesian.y);
    maxY = Math.max(maxY, pointCartesian.y);
  }

  const southWestCorner = southWestCornerResult;
  southWestCorner.x = minX;
  southWestCorner.y = minY;
  southWestCorner.z = 0.0;
  Matrix4.multiplyByPoint(enuMatrix, southWestCorner, southWestCorner);

  const southEastCorner = eastVectorResult;
  southEastCorner.x = maxX;
  southEastCorner.y = minY;
  southEastCorner.z = 0.0;
  Matrix4.multiplyByPoint(enuMatrix, southEastCorner, southEastCorner);
  // make eastward vector
  Cartesian3.subtract(southEastCorner, southWestCorner, eastVectorResult);

  const northWestCorner = northVectorResult;
  northWestCorner.x = minX;
  northWestCorner.y = maxY;
  northWestCorner.z = 0.0;
  Matrix4.multiplyByPoint(enuMatrix, northWestCorner, northWestCorner);
  // make eastward vector
  Cartesian3.subtract(northWestCorner, southWestCorner, northVectorResult);
}

const eastwardScratch = new Cartesian3();
const northwardScratch = new Cartesian3();
const encodeScratch = new EncodedCartesian3();
/**
 * 获取包含以下内容的属性对象：
 * - 3个高精度点，作为 6个 GeometryInstanceAttributes。这些点用于计算眼空间平面。
 * - 1个纹理坐标旋转 GeometryInstanceAttributes。
 * - 2个 GeometryInstanceAttributes，用于在二维和 Columbus View 中计算高精度点。
 * 这些点用于像上面那样计算眼空间平面。
 *
 * 用于为具有材料或多个不重叠实例的小面积 ClassificationPrimitives 计算纹理坐标。
 *
 * @see ShadowVolumeAppearance
 * @private
 *
 * @param {Rectangle} boundingRectangle 点将大致限制的矩形对象。
 * @param {number[]} textureCoordinateRotationPoints 在计算的纹理坐标系统中用于重新映射纹理坐标的点。
 * @param {Ellipsoid} ellipsoid 用于将矩形点转换为世界坐标的椭圆。
 * @param {MapProjection} projection 用于二维和 Columbus View 的地图投影。
 * @param {number} [height=0] 阴影体积的最大高度。
 * @returns {object} An 包含平面纹理坐标属性的属性字典。
 */
ShadowVolumeAppearance.getPlanarTextureCoordinateAttributes = function (
  boundingRectangle,
  textureCoordinateRotationPoints,
  ellipsoid,
  projection,
  height,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("boundingRectangle", boundingRectangle);
  Check.defined(
    "textureCoordinateRotationPoints",
    textureCoordinateRotationPoints,
  );
  Check.typeOf.object("ellipsoid", ellipsoid);
  Check.typeOf.object("projection", projection);
  //>>includeEnd('debug');

  const corner = cornerScratch;
  const eastward = eastwardScratch;
  const northward = northwardScratch;
  computeRectangleBounds(
    boundingRectangle,
    ellipsoid,
    height ?? 0.0,
    corner,
    eastward,
    northward,
  );

  const attributes = {};
  addTextureCoordinateRotationAttributes(
    attributes,
    textureCoordinateRotationPoints,
  );

  const encoded = EncodedCartesian3.fromCartesian(corner, encodeScratch);

  attributes.southWest_HIGH = new GeometryInstanceAttribute({
    componentDatatype: ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    normalize: false,
    value: Cartesian3.pack(encoded.high, [0, 0, 0]),
  });
  attributes.southWest_LOW = new GeometryInstanceAttribute({
    componentDatatype: ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    normalize: false,
    value: Cartesian3.pack(encoded.low, [0, 0, 0]),
  });
  attributes.eastward = new GeometryInstanceAttribute({
    componentDatatype: ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    normalize: false,
    value: Cartesian3.pack(eastward, [0, 0, 0]),
  });
  attributes.northward = new GeometryInstanceAttribute({
    componentDatatype: ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    normalize: false,
    value: Cartesian3.pack(northward, [0, 0, 0]),
  });

  add2DTextureCoordinateAttributes(boundingRectangle, projection, attributes);
  return attributes;
};

const spherePointScratch = new Cartesian3();
function latLongToSpherical(latitude, longitude, ellipsoid, result) {
  const cartographic = cartographicScratch;
  cartographic.latitude = latitude;
  cartographic.longitude = longitude;
  cartographic.height = 0.0;

  const spherePoint = Cartographic.toCartesian(
    cartographic,
    ellipsoid,
    spherePointScratch,
  );

  // Project into plane with vertical for latitude
  const magXY = Math.sqrt(
    spherePoint.x * spherePoint.x + spherePoint.y * spherePoint.y,
  );

  // Use fastApproximateAtan2 for alignment with shader
  const sphereLatitude = CesiumMath.fastApproximateAtan2(magXY, spherePoint.z);
  const sphereLongitude = CesiumMath.fastApproximateAtan2(
    spherePoint.x,
    spherePoint.y,
  );

  result.x = sphereLatitude;
  result.y = sphereLongitude;

  return result;
}

const sphericalScratch = new Cartesian2();
/**
 * 获取包含以下属性的对象：
 * - 球坐标下矩形区域的西南角，以及经纬度范围的反比值。
 * 这些数值采用与着色器中相同的 atan2 近似算法计算。
 * - 1 个 GeometryInstanceAttributes，用于纹理坐标旋转。
 * - 2 个 GeometryInstanceAttributes，用于计算 2D 和 Columbus View 中的高精度点。
 * 这些点用于计算上述眼空间平面。
 *
 * 在为具有材料的大面积 ClassificationPrimitives 或
 * 多个不重叠的实例计算纹理坐标时使用。
 * @see ShadowVolumeAppearance
 * @private
 *
 * @param {Rectangle} boundingRectangle 将大致限定球形范围的矩形对象。
 * @param {number[]} textureCoordinateRotationPoints 在计算的纹理坐标系统中用于重映射纹理坐标的点。
 * @param {Ellipsoid} ellipsoid 用于将矩形点转换为世界坐标的椭球体。
 * @param {MapProjection} projection 用于 2D 和 Columbus View 的地图投影。
 * @returns {object} An 包含球坐标纹理坐标属性的属性字典。
 */
ShadowVolumeAppearance.getSphericalExtentGeometryInstanceAttributes = function (
  boundingRectangle,
  textureCoordinateRotationPoints,
  ellipsoid,
  projection,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("boundingRectangle", boundingRectangle);
  Check.defined(
    "textureCoordinateRotationPoints",
    textureCoordinateRotationPoints,
  );
  Check.typeOf.object("ellipsoid", ellipsoid);
  Check.typeOf.object("projection", projection);
  //>>includeEnd('debug');

  // rectangle cartographic coords !== spherical because it's on an ellipsoid
  const southWestExtents = latLongToSpherical(
    boundingRectangle.south,
    boundingRectangle.west,
    ellipsoid,
    sphericalScratch,
  );

  let south = southWestExtents.x;
  let west = southWestExtents.y;

  const northEastExtents = latLongToSpherical(
    boundingRectangle.north,
    boundingRectangle.east,
    ellipsoid,
    sphericalScratch,
  );
  let north = northEastExtents.x;
  let east = northEastExtents.y;

  // If the bounding rectangle crosses the IDL, rotate the spherical extents so the cross no longer happens.
  // This rotation must happen in the shader too.
  let rotationRadians = 0.0;
  if (west > east) {
    rotationRadians = CesiumMath.PI - west;
    west = -CesiumMath.PI;
    east += rotationRadians;
  }

  // Slightly pad extents to avoid floating point error when fragment culling at edges.
  south -= CesiumMath.EPSILON5;
  west -= CesiumMath.EPSILON5;
  north += CesiumMath.EPSILON5;
  east += CesiumMath.EPSILON5;

  const longitudeRangeInverse = 1.0 / (east - west);
  const latitudeRangeInverse = 1.0 / (north - south);

  const attributes = {
    sphericalExtents: new GeometryInstanceAttribute({
      componentDatatype: ComponentDatatype.FLOAT,
      componentsPerAttribute: 4,
      normalize: false,
      value: [south, west, latitudeRangeInverse, longitudeRangeInverse],
    }),
    longitudeRotation: new GeometryInstanceAttribute({
      componentDatatype: ComponentDatatype.FLOAT,
      componentsPerAttribute: 1,
      normalize: false,
      value: [rotationRadians],
    }),
  };

  addTextureCoordinateRotationAttributes(
    attributes,
    textureCoordinateRotationPoints,
  );
  add2DTextureCoordinateAttributes(boundingRectangle, projection, attributes);
  return attributes;
};

ShadowVolumeAppearance.hasAttributesForTextureCoordinatePlanes = function (
  attributes,
) {
  return (
    defined(attributes.southWest_HIGH) &&
    defined(attributes.southWest_LOW) &&
    defined(attributes.northward) &&
    defined(attributes.eastward) &&
    defined(attributes.planes2D_HIGH) &&
    defined(attributes.planes2D_LOW) &&
    defined(attributes.uMaxVmax) &&
    defined(attributes.uvMinAndExtents)
  );
};

ShadowVolumeAppearance.hasAttributesForSphericalExtents = function (
  attributes,
) {
  return (
    defined(attributes.sphericalExtents) &&
    defined(attributes.longitudeRotation) &&
    defined(attributes.planes2D_HIGH) &&
    defined(attributes.planes2D_LOW) &&
    defined(attributes.uMaxVmax) &&
    defined(attributes.uvMinAndExtents)
  );
};

function shouldUseSpherical(rectangle) {
  return (
    Math.max(rectangle.width, rectangle.height) >
    ShadowVolumeAppearance.MAX_WIDTH_FOR_PLANAR_EXTENTS
  );
}

/**
 * 判断给定矩形是否足够宽，使得其区域内的纹理坐标
 * 应基于球形范围而非平面距离来计算。
 *
 * @param {Rectangle} rectangle 一个矩形。
 * @private
 */
ShadowVolumeAppearance.shouldUseSphericalCoordinates = function (rectangle) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("rectangle", rectangle);
  //>>includeEnd('debug');

  return shouldUseSpherical(rectangle);
};

/**
 * 地面基元的纹理坐标要么使用大面积的球坐标计算，要么
 * 使用与平面的距离计算。
 *
 * @type {number}
 * @constant
 * @private
 */
ShadowVolumeAppearance.MAX_WIDTH_FOR_PLANAR_EXTENTS = CesiumMath.toRadians(1.0);
export default ShadowVolumeAppearance;
