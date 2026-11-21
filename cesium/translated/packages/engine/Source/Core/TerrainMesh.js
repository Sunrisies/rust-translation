import {
  Cartesian3,
  Cartographic,
  Ellipsoid,
  FixedFrameTransforms,
  Math as CesiumMath,
  Matrix4,
  OrientedBoundingBox,
  VerticalExaggeration,
  defined,
} from "@cesium/core";
import SceneMode from "../Scene/SceneMode.js";
import TerrainPicker from "./TerrainPicker.js";

/**
 * 用于单个地形瓦片的多边形网格及相关元数据。此类实例通常从原始 {@link TerrainData} 创建。
 * 该瓦片的中心点。顶点位置相对于此中心点指定。
 *
 * @alias TerrainMesh
 * @constructor
 *
 * @param {Cartesian3} center 顶点数据，包括位置、纹理坐标和高度。
 * @param {Float32Array} vertices 顶点数据顺序为 [X, Y, Z, H, U, V]，其中 X、Y 和 Z 表示
 * 顶点的笛卡尔坐标，H 表示椭球面上的高度，
 * U 和 V 为纹理坐标。
 * 描述顶点如何连接形成三角形的索引。
 * @param {Uint8Array|Uint16Array|Uint32Array} indices 不包括边缘部分的多边形网格索引数量。
 * @param {number} indexCountWithoutSkirts 不包括边缘部分的多边形网格顶点数量。
 * @param {number} vertexCountWithoutSkirts 不包括边缘部分的多边形网格顶点数。
 * @param {number} minimumHeight 瓦片中的最低高度，以米为单位，位于椭球面上方。
 * @param {number} maximumHeight 瓦片中的最高高度，以米为单位，位于椭球面上方。
 * @param {Rectangle} rectangle 该瓦片所覆盖的弧度范围。
 * @param {BoundingSphere} boundingSphere3D 完全包含瓦片的边界球体。
 * @param {Cartesian3} occludeePointInScaledSpace 瓦片的遮挡点，在椭球面-
 * 缩放空间中表示，用于地平线剔除。如果此点位于地平线以下，
 * 则认为该瓦片完全位于地平线下方。
 * @param {number} [vertexStride=6] 每个顶点中的组件数量。
 * @param {OrientedBoundingBox} [orientedBoundingBox] 完全包含瓦片的边界框。
 * @param {TerrainEncoding} encoding 用于解码多边形网格的信息。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} westIndicesSouthToNorth 瓦片西边缘上的顶点索引，按从南到北的顺序排列（顺时针方向）。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} southIndicesEastToWest 瓦片南边缘上的顶点索引，按从东到西的顺序排列（顺时针方向）。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} eastIndicesNorthToSouth 瓦片东边缘上的顶点索引，按从北到南的顺序排列（顺时针方向）。
 * @param {number[]|Uint8Array|Uint16Array|Uint32Array} northIndicesWestToEast 瓦片北边缘上的顶点索引，按从西到东的顺序排列（顺时针方向）。
 *
 * @private
 */
function TerrainMesh(
  center,
  vertices,
  indices,
  indexCountWithoutSkirts,
  vertexCountWithoutSkirts,
  minimumHeight,
  maximumHeight,
  rectangle,
  boundingSphere3D,
  occludeePointInScaledSpace,
  vertexStride,
  orientedBoundingBox,
  encoding,
  westIndicesSouthToNorth,
  southIndicesEastToWest,
  eastIndicesNorthToSouth,
  northIndicesWestToEast,
) {
  /**
   * 瓦片的中心点。顶点位置相对于此中心点指定。
   * @type {Cartesian3}
   */
  this.center = center;

  /**
   * 顶点数据，包括位置、纹理坐标和高度。
   * 顶点数据顺序为 [X, Y, Z, H, U, V]，其中 X、Y 和 Z 表示
   * 顶点的笛卡尔坐标，H 表示椭球面上的高度，
   * U 和 V 为纹理坐标。顶点数据可能包含上述属性之外的额外属性，当
   * {@link TerrainMesh#stride} 大于 6 时。
   * @type {Float32Array}
   */
  this.vertices = vertices;

  /**
   * 每个顶点中的组件数量。通常对于 6 个组件，该值为 6。
   * [X, Y, Z, H, U, V]，但如果每个顶点有额外数据（如顶点法线），则此值会有所不同。
   * 可能更高。
   * @type {number}
   */
  this.stride = vertexStride ?? 6;

  /**
   * 描述顶点如何连接形成三角形的索引。
   * @type {Uint8Array|Uint16Array|Uint32Array}
   */
  this.indices = indices;

  /**
   * 不包括边缘的网格索引数量。
   * @type {number}
   */
  this.indexCountWithoutSkirts = indexCountWithoutSkirts;

  /**
   * 不包括边缘的网格顶点数量。
   * @type {number}
   */
  this.vertexCountWithoutSkirts = vertexCountWithoutSkirts;

  /**
   * 瓦片中的最低高度，以米为单位，位于椭球体上方。
   * @type {number}
   */
  this.minimumHeight = minimumHeight;

  /**
   * 瓦片中的最高高度，以米为单位，位于椭球体上方。
   * @type {number}
   */
  this.maximumHeight = maximumHeight;

  /**
   * 该瓦片所覆盖的矩形区域，以弧度为单位。
   * @type {Rectangle}
   */
  this.rectangle = rectangle;

  /**
   * 完全包含该瓦片的边界球。
   * @type {BoundingSphere}
   */
  this.boundingSphere3D = boundingSphere3D;

  /**
   * 瓦片的遮挡点，以椭球体-缩放空间表示。如果此点位于地平线以下，
   * scaled space, and used for horizon culling.  If this point is below the horizon,
   * 则认为该瓦片完全位于地平线下方。
   * @type {Cartesian3}
   */
  this.occludeePointInScaledSpace = occludeePointInScaledSpace;

  /**
   * 完全包含该瓦片的边界框。
   * @type {OrientedBoundingBox}
   */
  this.orientedBoundingBox = orientedBoundingBox;

  /**
   * 用于解码网格顶点的信息。
   * @type {TerrainEncoding}
   */
  this.encoding = encoding;

  /**
   * 瓦片西边缘上顶点的索引，按从南到北的顺序排列（顺时针方向）。
   * @type {number[]|Uint8Array|Uint16Array|Uint32Array}
   */
  this.westIndicesSouthToNorth = westIndicesSouthToNorth;

  /**
   * 瓦片南边缘上顶点的索引，按从东到西的顺序排列（顺时针方向）。
   * @type {number[]|Uint8Array|Uint16Array|Uint32Array}
   */
  this.southIndicesEastToWest = southIndicesEastToWest;

  /**
   * 瓦片东边缘上顶点的索引，按从北到南的顺序排列（顺时针方向）。
   * @type {number[]|Uint8Array|Uint16Array|Uint32Array}
   */
  this.eastIndicesNorthToSouth = eastIndicesNorthToSouth;

  /**
   * 瓦片北边缘上顶点的索引，按从西到东的顺序排列（顺时针方向）。
   * @type {number[]|Uint8Array|Uint16Array|Uint32Array}
   */
  this.northIndicesWestToEast = northIndicesWestToEast;

  /**
   * 基于地形网格的定向边界框，从模型坐标转换为世界坐标的变换矩阵。
   * 在3D模式下，此值由定向边界框计算得出。在2D和Columbus View模式下，
   * 此值由瓦片的矩形投影坐标计算得出。
   * @type {Matrix4}
   */
  this._transform = new Matrix4();

  /**
   * 上次对此地形网格进行选择时使用的场景模式。
   * @type {SceneMode}
   */
  this._lastPickSceneMode = undefined;

  /**
   * 用于光线相交测试的地形选择器，针对该网格使用。
   * @type {TerrainPicker}
   */
  this._terrainPicker = new TerrainPicker(vertices, indices, encoding);
}

/**
 * 获取给定场景模式和投影下地形瓦片的模型到世界坐标变换矩阵。
 * @param {SceneMode} mode 场景模式（3D、2D或Columbus View）。
 * @param {MapProjection} projection 地图投影方式。
 * @returns {Matrix4} The 变换矩阵。
 * @private
 */
TerrainMesh.prototype.getTransform = function (mode, projection) {
  if (this._lastPickSceneMode === mode) {
    return this._transform;
  }
  this._terrainPicker.needsRebuild = true;

  if (!defined(mode) || mode === SceneMode.SCENE3D) {
    return computeTransform(this, this._transform);
  }

  return computeTransform2D(this, projection, this._transform);
};

function computeTransform(mesh, result) {
  const exaggeration = mesh.encoding.exaggeration;
  const exaggerationRelativeHeight = mesh.encoding.exaggerationRelativeHeight;

  const exaggeratedMinHeight = VerticalExaggeration.getHeight(
    mesh.minimumHeight,
    exaggeration,
    exaggerationRelativeHeight,
  );

  const exaggeratedMaxHeight = VerticalExaggeration.getHeight(
    mesh.maximumHeight,
    exaggeration,
    exaggerationRelativeHeight,
  );

  const obb = OrientedBoundingBox.fromRectangle(
    mesh.rectangle,
    exaggeratedMinHeight,
    exaggeratedMaxHeight,
    Ellipsoid.default,
    mesh.orientedBoundingBox,
  );

  OrientedBoundingBox.computeTransformation(obb, result);
  const zScale = Matrix4.getScale(result, scratchScale).z;
  if (zScale <= CesiumMath.EPSILON16) {
    scratchScale.z = 1.0;
    Matrix4.setScale(result, scratchScale, result);
  }

  return result;
}

const scratchSWCartesian = new Cartesian3();
const scratchNECartesian = new Cartesian3();
const scratchSWCartographic = new Cartographic();
const scratchNECartographic = new Cartographic();
const scratchScale2D = new Cartesian3();
const scratchCenter2D = new Cartesian3();
const scratchScale = new Cartesian3();

/**
 * 获取2D或Columbus View模式下地形瓦片的模型到世界坐标变换矩阵。
 * 假设2D中的瓦片是轴对齐且仍为矩形。（对于Web Mercator和地理投影也是如此。）
 * @param {TerrainMesh} mesh 地形网格。
 * @param {MapProjection} projection 地图投影方式。
 * @param {Matrix4} result 存储结果的对象。
 * @returns {Matrix4} The 变换矩阵。
 * @private
 */
function computeTransform2D(mesh, projection, result) {
  const exaggeration = mesh.encoding.exaggeration;
  const exaggerationRelativeHeight = mesh.encoding.exaggerationRelativeHeight;

  const exaggeratedMinHeight = VerticalExaggeration.getHeight(
    mesh.minimumHeight,
    exaggeration,
    exaggerationRelativeHeight,
  );

  const exaggeratedMaxHeight = VerticalExaggeration.getHeight(
    mesh.maximumHeight,
    exaggeration,
    exaggerationRelativeHeight,
  );

  const southwest = projection.project(
    Cartographic.fromRadians(
      mesh.rectangle.west,
      mesh.rectangle.south,
      0,
      scratchSWCartographic,
    ),
    scratchSWCartesian,
  );

  const northeast = projection.project(
    Cartographic.fromRadians(
      mesh.rectangle.east,
      mesh.rectangle.north,
      0,
      scratchNECartographic,
    ),
    scratchNECartesian,
  );

  const heightRange = exaggeratedMaxHeight - exaggeratedMinHeight;
  const scale = Cartesian3.fromElements(
    northeast.x - southwest.x,
    northeast.y - southwest.y,
    heightRange > 0 ? heightRange : 1.0, // Avoid zero scale
    scratchScale2D,
  );

  const center = Cartesian3.fromElements(
    southwest.x + scale.x * 0.5,
    southwest.y + scale.y * 0.5,
    exaggeratedMinHeight + scale.z * 0.5,
    scratchCenter2D,
  );

  Matrix4.fromTranslation(center, result);
  Matrix4.setScale(result, scale, result);
  Matrix4.multiply(
    FixedFrameTransforms.SWIZZLE_3D_TO_2D_MATRIX,
    result,
    result,
  );

  return result;
}

/**
 * 给出该地形瓦片上光线相交的点。
 * @param {Ray} ray 用于测试相交的光线。
 * @param {boolean} cullBackFaces 是否将背向三角形的交点视为相交点。
 * @param {SceneMode} mode 场景模式（3D、2D或Columbus View）。
 * @param {MapProjection} projection 地图投影方式。
 * @returns {Cartesian3} The 光线在网格上的交点，如果没有相交则定义为未定义。
 * @ignore
 */
TerrainMesh.prototype.pick = function (ray, cullBackFaces, mode, projection) {
  const intersection = this._terrainPicker.rayIntersect(
    ray,
    this.getTransform(mode, projection),
    cullBackFaces,
    mode,
    projection,
  );

  this._lastPickSceneMode = mode;
  return intersection;
};

/**
 * 更新地形网格以反映垂直夸张度的变化。
 * @param {number} exaggeration 用于夸大地形的标量值。
 * @param {number} exaggerationRelativeHeight 地形被夸大的相对高度。
 * @ignore
 */
TerrainMesh.prototype.updateExaggeration = function (
  exaggeration,
  exaggerationRelativeHeight,
) {
  // The encoding stored on the TerrainMesh references the updated exaggeration values already. This is just used
  // to trigger a rebuild on the terrain picker.
  this._terrainPicker._vertices = this.vertices;
  this._terrainPicker.needsRebuild = true;
  this._lastPickSceneMode = undefined;
};

/**
 * 更新地形网格以适应场景模式的变化。
 * @param {SceneMode} mode 场景模式（3D、2D 或 Columbus View）。
 * @ignore
 */
TerrainMesh.prototype.updateSceneMode = function (mode) {
  this._terrainPicker.needsRebuild = true;
  this._lastPickSceneMode = undefined;
};

export default TerrainMesh;
