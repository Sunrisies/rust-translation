import {
  BoundingSphere,
  Cartesian3,
  Cartographic,
  Check,
  ColorGeometryInstanceAttribute,
  Ellipsoid,
  GeometryInstance,
  IntersectionTests,
  Matrix4,
  OrientedBoundingBox,
  Plane,
  Ray,
  Rectangle,
  RectangleOutlineGeometry,
  defined,
} from "@cesium/core";
import PerInstanceColorAppearance from "./PerInstanceColorAppearance.js";
import Primitive from "./Primitive.js";
import SceneMode from "./SceneMode.js";

/**
 * 作为经纬度/高度区域指定的瓦片边界体积。
 * @alias TileBoundingRegion
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Rectangle} options.rectangle 指定该区域经纬度范围的长方形。
 * @param {number} [options.minimumHeight=0.0] 该区域的最小高度。
 * @param {number} [options.maximumHeight=0.0] 该区域的最大高度。
 * @param {Ellipsoid} [options.ellipsoid=Cesium.Ellipsoid.WGS84] 椭球体。
 * @param {boolean} [options.computeBoundingVolumes=true] 用于计算 {@link TileBoundingRegion#boundingVolume} 和
 * {@link TileBoundingVolume#boundingSphere}。如果为 false，则这些属性将不可定义。
 *
 * @private
 */
function TileBoundingRegion(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options", options);
  Check.typeOf.object("options.rectangle", options.rectangle);
  //>>includeEnd('debug');

  this.rectangle = Rectangle.clone(options.rectangle);
  this.minimumHeight = options.minimumHeight ?? 0.0;
  this.maximumHeight = options.maximumHeight ?? 0.0;

  /**
   * 瓦片矩形西南角的世界坐标。
   *
   * @type {Cartesian3}
   * @default Cartesian3()
   */
  this.southwestCornerCartesian = new Cartesian3();

  /**
   * 瓦片矩形东北角的世界坐标。
   *
   * @type {Cartesian3}
   * @default Cartesian3()
   */
  this.northeastCornerCartesian = new Cartesian3();

  /**
   * 一个法向量，与 southwestCornerCartesian 一起定义了瓦片西部边缘的平面。该平面以上的任何位置均位于瓦片外部。
   * 一个法向量，与 southwestCornerCartesian 一起定义了瓦片南部边缘的平面。该平面以上的任何位置均位于瓦片外部。
   *
   * @type {Cartesian3}
   * @default Cartesian3()
   */
  this.westNormal = new Cartesian3();

  /**
   * 一个法向量，与 southwestCornerCartesian 一起定义了瓦片东部边缘的平面。该平面以上的任何位置均位于瓦片外部。
   * 一个法向量，与 northeastCornerCartesian 一起定义了瓦片西部边缘的平面。该平面以上的任何位置均位于瓦片外部。
   * 由于相同纬度的点不一定位于同一平面上，该平面以下的位置不一定在瓦片内部，但距离很近。
   * 一个法向量，与 northeastCornerCartesian 一起定义了瓦片东部边缘的平面。该平面以上的任何位置均位于瓦片外部。
   *
   * @type {Cartesian3}
   * @default Cartesian3()
   */
  this.southNormal = new Cartesian3();

  /**
   * 一个法向量，与 northeastCornerCartesian 一起定义了瓦片西部边缘的平面。该平面以上的任何位置均位于瓦片外部。
   * 一个法向量，与 northeastCornerCartesian 一起定义了瓦片东部边缘的平面。该平面以上的任何位置均位于瓦片外部。
   *
   * @type {Cartesian3}
   * @default Cartesian3()
   */
  this.eastNormal = new Cartesian3();

  /**
   * 一个法向量，与 northeastCornerCartesian 一起定义了瓦片东部边缘的平面。该平面以上的任何位置均位于瓦片外部。
   * 一个法向量，与 northeastCornerCartesian 一起定义了瓦片东部边缘的平面。该平面以上的任何位置均位于瓦片外部。
   * 由于相同纬度的点不一定位于同一平面上，该平面以下的位置不一定在瓦片内部，但距离很近。
   * 该平面以下的位置不一定在瓦片内部，但距离很近。
   *
   * @type {Cartesian3}
   * @default Cartesian3()
   */
  this.northNormal = new Cartesian3();

  const ellipsoid = options.ellipsoid ?? Ellipsoid.WGS84;
  computeBox(this, options.rectangle, ellipsoid);

  this._orientedBoundingBox = undefined;
  this._boundingSphere = undefined;

  if (options.computeBoundingVolumes ?? true) {
    this.computeBoundingVolumes(ellipsoid);
  }
}

Object.defineProperties(TileBoundingRegion.prototype, {
  /**
   * 底层边界体积。
   *
   * @memberof TileBoundingRegion.prototype
   *
   * @type {object}
   * @readonly
   */
  boundingVolume: {
    get: function () {
      return this._orientedBoundingBox;
    },
  },
  /**
   * 底层边界球体。
   *
   * @memberof TileBoundingRegion.prototype
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

TileBoundingRegion.prototype.computeBoundingVolumes = function (ellipsoid) {
  // An oriented bounding box that encloses this tile's region.  This is used to calculate tile visibility.
  this._orientedBoundingBox = OrientedBoundingBox.fromRectangle(
    this.rectangle,
    this.minimumHeight,
    this.maximumHeight,
    ellipsoid,
  );

  this._boundingSphere = BoundingSphere.fromOrientedBoundingBox(
    this._orientedBoundingBox,
  );
};

const cartesian3Scratch = new Cartesian3();
const cartesian3Scratch2 = new Cartesian3();
const cartesian3Scratch3 = new Cartesian3();
const westNormalScratch = new Cartesian3();
const eastWestNormalScratch = new Cartesian3();
const westernMidpointScratch = new Cartesian3();
const easternMidpointScratch = new Cartesian3();
const cartographicScratch = new Cartographic();
const planeScratch = new Plane(Cartesian3.UNIT_X, 0.0);
const rayScratch = new Ray();

function computeBox(tileBB, rectangle, ellipsoid) {
  ellipsoid.cartographicToCartesian(
    Rectangle.southwest(rectangle),
    tileBB.southwestCornerCartesian,
  );
  ellipsoid.cartographicToCartesian(
    Rectangle.northeast(rectangle),
    tileBB.northeastCornerCartesian,
  );

  // The middle latitude on the western edge.
  cartographicScratch.longitude = rectangle.west;
  cartographicScratch.latitude = (rectangle.south + rectangle.north) * 0.5;
  cartographicScratch.height = 0.0;
  const westernMidpointCartesian = ellipsoid.cartographicToCartesian(
    cartographicScratch,
    westernMidpointScratch,
  );

  // Compute the normal of the plane on the western edge of the tile.
  const westNormal = Cartesian3.cross(
    westernMidpointCartesian,
    Cartesian3.UNIT_Z,
    westNormalScratch,
  );
  Cartesian3.normalize(westNormal, tileBB.westNormal);

  // The middle latitude on the eastern edge.
  cartographicScratch.longitude = rectangle.east;
  const easternMidpointCartesian = ellipsoid.cartographicToCartesian(
    cartographicScratch,
    easternMidpointScratch,
  );

  // Compute the normal of the plane on the eastern edge of the tile.
  const eastNormal = Cartesian3.cross(
    Cartesian3.UNIT_Z,
    easternMidpointCartesian,
    cartesian3Scratch,
  );
  Cartesian3.normalize(eastNormal, tileBB.eastNormal);

  let westVector = Cartesian3.subtract(
    westernMidpointCartesian,
    easternMidpointCartesian,
    cartesian3Scratch,
  );

  if (Cartesian3.magnitude(westVector) === 0.0) {
    westVector = Cartesian3.clone(westNormal, westVector);
  }

  const eastWestNormal = Cartesian3.normalize(
    westVector,
    eastWestNormalScratch,
  );

  // Compute the normal of the plane bounding the southern edge of the tile.
  const south = rectangle.south;
  let southSurfaceNormal;

  if (south > 0.0) {
    // Compute a plane that doesn't cut through the tile.
    cartographicScratch.longitude = (rectangle.west + rectangle.east) * 0.5;
    cartographicScratch.latitude = south;
    const southCenterCartesian = ellipsoid.cartographicToCartesian(
      cartographicScratch,
      rayScratch.origin,
    );
    Cartesian3.clone(eastWestNormal, rayScratch.direction);
    const westPlane = Plane.fromPointNormal(
      tileBB.southwestCornerCartesian,
      tileBB.westNormal,
      planeScratch,
    );
    // Find a point that is on the west and the south planes
    IntersectionTests.rayPlane(
      rayScratch,
      westPlane,
      tileBB.southwestCornerCartesian,
    );
    southSurfaceNormal = ellipsoid.geodeticSurfaceNormal(
      southCenterCartesian,
      cartesian3Scratch2,
    );
  } else {
    southSurfaceNormal = ellipsoid.geodeticSurfaceNormalCartographic(
      Rectangle.southeast(rectangle),
      cartesian3Scratch2,
    );
  }
  const southNormal = Cartesian3.cross(
    southSurfaceNormal,
    westVector,
    cartesian3Scratch3,
  );
  Cartesian3.normalize(southNormal, tileBB.southNormal);

  // Compute the normal of the plane bounding the northern edge of the tile.
  const north = rectangle.north;
  let northSurfaceNormal;

  if (north < 0.0) {
    // Compute a plane that doesn't cut through the tile.
    cartographicScratch.longitude = (rectangle.west + rectangle.east) * 0.5;
    cartographicScratch.latitude = north;
    const northCenterCartesian = ellipsoid.cartographicToCartesian(
      cartographicScratch,
      rayScratch.origin,
    );
    Cartesian3.negate(eastWestNormal, rayScratch.direction);
    const eastPlane = Plane.fromPointNormal(
      tileBB.northeastCornerCartesian,
      tileBB.eastNormal,
      planeScratch,
    );
    // Find a point that is on the east and the north planes
    IntersectionTests.rayPlane(
      rayScratch,
      eastPlane,
      tileBB.northeastCornerCartesian,
    );
    northSurfaceNormal = ellipsoid.geodeticSurfaceNormal(
      northCenterCartesian,
      cartesian3Scratch2,
    );
  } else {
    northSurfaceNormal = ellipsoid.geodeticSurfaceNormalCartographic(
      Rectangle.northwest(rectangle),
      cartesian3Scratch2,
    );
  }
  const northNormal = Cartesian3.cross(
    westVector,
    northSurfaceNormal,
    cartesian3Scratch3,
  );
  Cartesian3.normalize(northNormal, tileBB.northNormal);
}

const southwestCornerScratch = new Cartesian3();
const northeastCornerScratch = new Cartesian3();
const negativeUnitY = new Cartesian3(0.0, -1.0, 0.0);
const negativeUnitZ = new Cartesian3(0.0, 0.0, -1.0);
const vectorScratch = new Cartesian3();

function distanceToCameraRegion(tileBB, frameState) {
  const camera = frameState.camera;
  const cameraCartesianPosition = camera.positionWC;
  const cameraCartographicPosition = camera.positionCartographic;

  let result = 0.0;
  if (!Rectangle.contains(tileBB.rectangle, cameraCartographicPosition)) {
    let southwestCornerCartesian = tileBB.southwestCornerCartesian;
    let northeastCornerCartesian = tileBB.northeastCornerCartesian;
    let westNormal = tileBB.westNormal;
    let southNormal = tileBB.southNormal;
    let eastNormal = tileBB.eastNormal;
    let northNormal = tileBB.northNormal;

    if (frameState.mode !== SceneMode.SCENE3D) {
      southwestCornerCartesian = frameState.mapProjection.project(
        Rectangle.southwest(tileBB.rectangle),
        southwestCornerScratch,
      );
      southwestCornerCartesian.z = southwestCornerCartesian.y;
      southwestCornerCartesian.y = southwestCornerCartesian.x;
      southwestCornerCartesian.x = 0.0;
      northeastCornerCartesian = frameState.mapProjection.project(
        Rectangle.northeast(tileBB.rectangle),
        northeastCornerScratch,
      );
      northeastCornerCartesian.z = northeastCornerCartesian.y;
      northeastCornerCartesian.y = northeastCornerCartesian.x;
      northeastCornerCartesian.x = 0.0;
      westNormal = negativeUnitY;
      eastNormal = Cartesian3.UNIT_Y;
      southNormal = negativeUnitZ;
      northNormal = Cartesian3.UNIT_Z;
    }

    const vectorFromSouthwestCorner = Cartesian3.subtract(
      cameraCartesianPosition,
      southwestCornerCartesian,
      vectorScratch,
    );
    const distanceToWestPlane = Cartesian3.dot(
      vectorFromSouthwestCorner,
      westNormal,
    );
    const distanceToSouthPlane = Cartesian3.dot(
      vectorFromSouthwestCorner,
      southNormal,
    );

    const vectorFromNortheastCorner = Cartesian3.subtract(
      cameraCartesianPosition,
      northeastCornerCartesian,
      vectorScratch,
    );
    const distanceToEastPlane = Cartesian3.dot(
      vectorFromNortheastCorner,
      eastNormal,
    );
    const distanceToNorthPlane = Cartesian3.dot(
      vectorFromNortheastCorner,
      northNormal,
    );

    if (distanceToWestPlane > 0.0) {
      result += distanceToWestPlane * distanceToWestPlane;
    } else if (distanceToEastPlane > 0.0) {
      result += distanceToEastPlane * distanceToEastPlane;
    }

    if (distanceToSouthPlane > 0.0) {
      result += distanceToSouthPlane * distanceToSouthPlane;
    } else if (distanceToNorthPlane > 0.0) {
      result += distanceToNorthPlane * distanceToNorthPlane;
    }
  }

  let cameraHeight;
  let minimumHeight;
  let maximumHeight;
  if (frameState.mode === SceneMode.SCENE3D) {
    cameraHeight = cameraCartographicPosition.height;
    minimumHeight = tileBB.minimumHeight;
    maximumHeight = tileBB.maximumHeight;
  } else {
    cameraHeight = cameraCartesianPosition.x;
    minimumHeight = 0.0;
    maximumHeight = 0.0;
  }

  if (cameraHeight > maximumHeight) {
    const distanceAboveTop = cameraHeight - maximumHeight;
    result += distanceAboveTop * distanceAboveTop;
  } else if (cameraHeight < minimumHeight) {
    const distanceBelowBottom = minimumHeight - cameraHeight;
    result += distanceBelowBottom * distanceBelowBottom;
  }

  return Math.sqrt(result);
}

/**
 * 获取相机到瓦片上最近点的距离。此值用于选择细节级别。
 *
 * @param {FrameState} frameState 当前渲染帧的状态信息。
 * @returns {number} The 相机到瓦片上最近点的距离，以米为单位。
 */
TileBoundingRegion.prototype.distanceToCamera = function (frameState) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("frameState", frameState);
  //>>includeEnd('debug');

  const regionResult = distanceToCameraRegion(this, frameState);
  if (
    frameState.mode === SceneMode.SCENE3D &&
    defined(this._orientedBoundingBox)
  ) {
    const obbResult = Math.sqrt(
      this._orientedBoundingBox.distanceSquaredTo(frameState.camera.positionWC),
    );
    return Math.max(regionResult, obbResult);
  }
  return regionResult;
};

/**
 * 确定该盒子位于平面的哪一侧。
 *
 * @param {Plane} plane 要测试的平面。
 * @returns {Intersect} {@link Intersect.INSIDE} if the entire box is on the side of the plane
 *                      the normal is pointing, {@link Intersect.OUTSIDE} if the entire box is
 *                      on the opposite side, and {@link Intersect.INTERSECTING} if the box
 * intersects the plane.
 */
TileBoundingRegion.prototype.intersectPlane = function (plane) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("plane", plane);
  //>>includeEnd('debug');
  return this._orientedBoundingBox.intersectPlane(plane);
};

/**
 * Creates a debug primitive that shows the outline of the tile bounding region.
 *
 * @param {Color} color 原始几何体网格的目标颜色
 * @return {Primitive}
 *
 * @private
 */
TileBoundingRegion.prototype.createDebugVolume = function (color) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("color", color);
  //>>includeEnd('debug');

  const modelMatrix = Matrix4.clone(Matrix4.IDENTITY);
  const geometry = new RectangleOutlineGeometry({
    rectangle: this.rectangle,
    height: this.minimumHeight,
    extrudedHeight: this.maximumHeight,
  });
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
export default TileBoundingRegion;