import {
  BoundingSphere,
  Check,
  DeveloperError,
  Ellipsoid,
  Event,
  Frozen,
  Math as CesiumMath,
  OrientedBoundingBox,
  Rectangle,
  RuntimeError,
  defined,
} from "@cesium/core";
import { parseGlb } from "@cesium/gltf";
import Cesium3DTilesTerrainData from "./Cesium3DTilesTerrainData.js";
import Credit from "./Credit.js";
import DoubleEndedPriorityQueue from "./DoubleEndedPriorityQueue.js";
import GeographicTilingScheme from "./GeographicTilingScheme.js";
import ImplicitSubtree from "../Scene/ImplicitSubtree.js";
import ImplicitTileCoordinates from "../Scene/ImplicitTileCoordinates.js";
import IonResource from "./IonResource.js";
import ImplicitTileset from "../Scene/ImplicitTileset.js";
import loadImageFromTypedArray from "./loadImageFromTypedArray.js";
import MetadataSchema from "../Scene/MetadataSchema.js";
import MetadataSchemaLoader from "../Scene/MetadataSchemaLoader.js";
import MetadataSemantic from "../Scene/MetadataSemantic.js";
import Resource from "./Resource.js";
import ResourceCache from "../Scene/ResourceCache.js";
import TerrainProvider from "./TerrainProvider.js";

/**
 * @typedef {object} Cesium3DTilesTerrainProvider.ConstructorOptions
 *
 * Cesium3DTilesTerrainProvider构造器的初始化选项
 *
 * @property {boolean} [requestVertexNormals=false] 标志，指示客户端是否应从服务器请求额外的光照信息，如果可用则以每个顶点法线形式提供。
 * @property {boolean} [requestWaterMask=false] 标志，指示客户端是否应从服务器请求瓦片水掩膜，如果可用。
 * @property {Ellipsoid} [ellipsoid=Ellipsoid.default] 椭球体。如果未指定，则使用WGS84椭球体。
 * @property {Credit|string} [credit] 数据源的标识，在画布上显示。
 */

/**
 * <div class="notice">
 * 要创建Cesium3DTilesTerrainProvider，请调用 {@link Cesium3DTilesTerrainProvider.fromIonAssetId} 或 {@link Cesium3DTilesTerrainProvider.fromUrl}。不要直接调用构造器。
 * </div>
 *
 * 一个访问3D瓦片格式地形数据的 {@link TerrainProvider}。
 *
 * @alias Cesium3DTilesTerrainProvider
 * @experimental This 该功能尚未最终确定，可能会根据Cesium的标准弃用政策进行变更。
 * @constructor
 *
 * @param {Cesium3DTilesTerrainProvider.ConstructorOptions}[options] 描述初始化选项的对象
 *
 * @see TerrainProvider
 * @see Cesium3DTilesTerrainProvider.fromUrl
 * @see Cesium3DTilesTerrainProvider.fromIonAssetId
 *
 * // 使用顶点法线创建GTOPO30
 * try {
 * const viewer = new Cesium.Viewer("cesiumContainer", {
 * terrainProvider: await Cesium.Cesium3DTilesTerrainProvider.fromIonAssetId(2732686, {
 * requestVertexNormals: true
 *     })
 *   });
 * } catch (error) {
 * console.log(error);
 * }
 */
function Cesium3DTilesTerrainProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  let credit = options.credit;
  if (typeof credit === "string") {
    credit = new Credit(credit);
  }
  this._credit = credit;
  this._tileCredits = undefined;
  this._errorEvent = new Event();
  this._ellipsoid = options.ellipsoid ?? Ellipsoid.WGS84;

  this._tilingScheme = new GeographicTilingScheme({
    ellipsoid: this._ellipsoid,
  });

  this._subtreeCache = new ImplicitSubtreeCache({
    provider: this,
  });

  /**
   * @private
   * @type {ImplicitTileset|undefined}
   */
  this._tileset0 = undefined;
  /**
   * @private
   * @type {ImplicitTileset|undefined}
   */
  this._tileset1 = undefined;

  this._resource = undefined;

  /**
   * 布尔标志，指示客户端是否应从服务器请求顶点法线。
   * @type {boolean}
   * @default false
   * @private
   */
  this._requestVertexNormals = options.requestVertexNormals ?? false;

  /**
   * 布尔标志，指示客户端是否应从服务器请求瓦片水掩膜。
   * @type {boolean}
   * @default false
   * @private
   */
  this._requestWaterMask = options.requestWaterMask ?? false;
}

/**
 * 创建一个访问Cesium 3D瓦片格式地形数据的 {@link TerrainProvider}。
 *
 * @param {Resource|string|Promise<Resource>|Promise<string>} url Cesium地形服务器的URL。
 * @param {Cesium3DTilesTerrainProvider.ConstructorOptions} [options] 描述初始化选项的对象。
 * @returns {Promise<Cesium3DTilesTerrainProvider>} A 解析为地形提供器的promise。
 *
 * @example
 * // 使用法线创建地形。
 * try {
 * const viewer = new Cesium.Viewer("cesiumContainer", {
 * terrainProvider: await Cesium.Cesium3DTilesTerrainProvider.fromUrl(
 * Cesium.IonResource.fromAssetId(3956), {
 * requestVertexNormals: true
 *     })
 *   });
 * } catch (error) {
 * console.log(error);
 * }
 */
Cesium3DTilesTerrainProvider.fromUrl = async function (url, options) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  //>>includeEnd('debug');

  options = options ?? Frozen.EMPTY_OBJECT;

  url = await Promise.resolve(url);
  const resource = Resource.createIfNeeded(url);

  let tilesetJson;
  try {
    tilesetJson = await resource.fetchJson();
  } catch (error) {
    throw new RuntimeError("Could not load tileset JSON", error);
  }

  const provider = new Cesium3DTilesTerrainProvider(options);
  // ion resources have a credits property we can use for additional attribution.
  provider._tileCredits = resource.credits;
  provider._resource = resource;

  const childrenJson = tilesetJson["root"]["children"];
  const child0Json = childrenJson[0];
  const child1Json = childrenJson[1];

  const metadataSchemaJson = tilesetJson["schema"];
  const metadataSchema = MetadataSchema.fromJson(metadataSchemaJson);

  provider._tileset0 = new ImplicitTileset(
    resource,
    child0Json,
    metadataSchema,
  );
  provider._tileset1 = new ImplicitTileset(
    resource,
    child1Json,
    metadataSchema,
  );

  return provider;
};

/**
 * 从Cesium离子资产ID创建一个访问Cesium 3D瓦片格式地形数据的 {@link TerrainProvider}
 *
 * @param {number} assetId Cesium离子资产ID。
 * @param {CesiumTerrainProvider.ConstructorOptions} [options] 描述初始化选项的对象。
 * @returns {Promise<CesiumTerrainProvider>}
 *
 * @example
 * // 使用顶点法线创建GTOPO30
 * try {
 * const viewer = new Cesium.Viewer("cesiumContainer", {
 * terrainProvider: await Cesium.Cesium3DTilesTerrainProvider.fromIonAssetId(2732686, {
 * requestVertexNormals: true
 *     })
 *   });
 * } catch (error) {
 * console.log(error);
 * }
 *
 * @exception {RuntimeError} layer.json 未指定格式
 * @exception {RuntimeError} layer.json 指定了未知格式
 * @exception {RuntimeError} layer.json 指定了不支持的量化网格版本
 * @exception {RuntimeError} layer.json 未指定 tiles 属性，或指定了空数组
 * @exception {RuntimeError} layer.json 未指定任何 tile URL 模板
 */
Cesium3DTilesTerrainProvider.fromIonAssetId = async function (
  assetId,
  options,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("assetId", assetId);
  //>>includeEnd('debug');

  const resource = await IonResource.fromAssetId(assetId);
  return Cesium3DTilesTerrainProvider.fromUrl(resource, options);
};

const scratchPromises = new Array(3);

/**
 * 请求特定 tiles 的几何数据。此函数不应在之前调用
 * {@link Cesium3DTilesTerrainProvider#ready} 返回 true。结果必须包含地形数据
 * 可选择性地包含水掩码以及哪些子 tiles 可用的指示信息
 *
 * @param {number} x 请求几何数据的 tiles 的 X 坐标
 * @param {number} y 请求几何数据的 tiles 的 Y 坐标
 * @param {number} level 请求几何数据的 tiles 的层级
 * @param {Request} [request] 请求对象。仅用于内部使用
 *
 * @returns {Promise.<Cesium3DTilesTerrainData>|undefined} A 请求几何数据的 promise。如果此方法
 * 返回 undefined 而不是 promise，说明当前有太多请求正在等待中
 * 并将在稍后重试
 */
Cesium3DTilesTerrainProvider.prototype.requestTileGeometry = async function (
  x,
  y,
  level,
  request,
) {
  const rootId = getRootIdFromGeographic(level, x);
  const implicitTileset = rootId === 0 ? this._tileset0 : this._tileset1;

  const tileCoord = getImplicitTileCoordinatesFromGeographicCoordinates(
    implicitTileset,
    level,
    x,
    y,
  );

  const subtreeCoord = tileCoord.getSubtreeCoordinates();

  const cache = this._subtreeCache;
  let subtree = cache.find(rootId, subtreeCoord);

  const requestWaterMask = this._requestWaterMask;
  const that = this;

  let subtreePromise;
  if (subtree === undefined) {
    const subtreeRelative =
      implicitTileset.subtreeUriTemplate.getDerivedResource({
        templateValues: subtreeCoord.getTemplateValues(),
      });
    const subtreeResource = implicitTileset.baseResource.getDerivedResource({
      url: subtreeRelative.url,
    });
    subtreePromise = subtreeResource
      .fetchArrayBuffer()
      .then(async function (arrayBuffer) {
        // Check if the subtree exists again in case multiple fetches for the same subtree went out at the same time. Don't want to double-add to the cache
        subtree = cache.find(rootId, subtreeCoord);
        if (subtree === undefined) {
          const bufferU8 = new Uint8Array(arrayBuffer);
          subtree = await ImplicitSubtree.fromSubtreeJson(
            that._resource,
            undefined,
            bufferU8,
            implicitTileset,
            subtreeCoord,
          );
          cache.addSubtree(rootId, subtree);
        }

        return subtree;
      });
  } else {
    subtreePromise = Promise.resolve(subtree);
  }

  // Note: only one content for terrain
  const glbRelative = implicitTileset.contentUriTemplates[0].getDerivedResource(
    {
      templateValues: tileCoord.getTemplateValues(),
    },
  );
  const glbResource = implicitTileset.baseResource.getDerivedResource({
    url: glbRelative.url,
  });

  // Start fetching the glb right away -- possibly even before the subtree is loaded in some cases
  const glbPromise = glbResource.fetchArrayBuffer();
  if (glbPromise === undefined) {
    return undefined;
  }

  const gltfPromise = glbPromise.then((glbBuffer) =>
    parseGlb(new Uint8Array(glbBuffer)),
  );

  const promises = scratchPromises;
  promises[0] = subtreePromise;
  promises[1] = gltfPromise;
  promises[2] = requestWaterMask
    ? gltfPromise.then((gltf) => loadWaterMask(gltf, glbResource))
    : undefined;

  try {
    const results = await Promise.all(promises);
    const subtree = results[0];
    const gltf = results[1];
    const waterMask = results[2];

    const metadataView = subtree.getTileMetadataView(tileCoord);

    const minimumHeight = metadataView.getPropertyBySemantic(
      MetadataSemantic.TILE_MINIMUM_HEIGHT,
    );

    const maximumHeight = metadataView.getPropertyBySemantic(
      MetadataSemantic.TILE_MAXIMUM_HEIGHT,
    );

    const boundingSphereArray = metadataView.getPropertyBySemantic(
      MetadataSemantic.TILE_BOUNDING_SPHERE,
    );
    const boundingSphere = BoundingSphere.unpack(
      boundingSphereArray,
      0,
      new BoundingSphere(),
    );

    const horizonOcclusionPoint = metadataView.getPropertyBySemantic(
      MetadataSemantic.TILE_HORIZON_OCCLUSION_POINT,
    );

    const tilingScheme = that._tilingScheme;

    // The tiling scheme uses geographic coords, not implicit coords
    const rectangle = tilingScheme.tileXYToRectangle(
      x,
      y,
      level,
      new Rectangle(),
    );

    const ellipsoid = that._ellipsoid;

    const orientedBoundingBox = OrientedBoundingBox.fromRectangle(
      rectangle,
      minimumHeight,
      maximumHeight,
      ellipsoid,
      new OrientedBoundingBox(),
    );

    const skirtHeight = that.getLevelMaximumGeometricError(level) * 5.0;

    const hasSW = isChildAvailable(implicitTileset, subtree, tileCoord, 0, 0);
    const hasSE = isChildAvailable(implicitTileset, subtree, tileCoord, 1, 0);
    const hasNW = isChildAvailable(implicitTileset, subtree, tileCoord, 0, 1);
    const hasNE = isChildAvailable(implicitTileset, subtree, tileCoord, 1, 1);
    const childTileMask =
      (hasSW ? 1 : 0) | (hasSE ? 2 : 0) | (hasNW ? 4 : 0) | (hasNE ? 8 : 0);

    const terrainData = new Cesium3DTilesTerrainData({
      gltf: gltf,
      minimumHeight: minimumHeight,
      maximumHeight: maximumHeight,
      boundingSphere: boundingSphere,
      orientedBoundingBox: orientedBoundingBox,
      horizonOcclusionPoint: horizonOcclusionPoint,
      skirtHeight: skirtHeight,
      requestVertexNormals: that._requestVertexNormals,
      childTileMask: childTileMask,
      credits: that._tileCredits,
      waterMask: waterMask,
    });

    return Promise.resolve(terrainData);
  } catch (err) {
    console.log(
      `Could not load subtree: ${rootId} ${subtreeCoord.level} ${subtreeCoord.x} ${subtreeCoord.y}: ${err}`,
    );

    console.log(
      `Could not load tile: ${rootId} ${tileCoord.level} ${tileCoord.x} ${tileCoord.y}: ${err}`,
    );
    return undefined;
  }
};

/**
 * 确定特定 tiles 的数据是否可加载
 *
 * @param {number} x 请求几何数据的 tiles 的 X 坐标
 * @param {number} y 请求几何数据的 tiles 的 Y 坐标
 * @param {number} level 请求几何数据的 tiles 的层级
 * @returns {boolean|undefined} Undefined 如果不支持或可用性未知，否则为 true 或 false
 */
Cesium3DTilesTerrainProvider.prototype.getTileDataAvailable = function (
  x,
  y,
  level,
) {
  const cache = this._subtreeCache;

  const rootId = getRootIdFromGeographic(level, x);
  const implicitTileset = rootId === 0 ? this._tileset0 : this._tileset1;
  const tileCoord = getImplicitTileCoordinatesFromGeographicCoordinates(
    implicitTileset,
    level,
    x,
    y,
  );

  const subtreeCoord = tileCoord.getSubtreeCoordinates();
  const subtree = cache.find(rootId, subtreeCoord);

  // If the subtree is loaded, return the tile's availability
  if (subtree !== undefined) {
    const available = subtree.tileIsAvailableAtCoordinates(tileCoord);
    return available;
  }

  if (subtreeCoord.isImplicitTilesetRoot()) {
    if (tileCoord.isSubtreeRoot()) {
      // The subtree's root tile is always available
      return true;
    }
    // Don't know if the tile is available because its subtree hasn't been loaded yet
    return undefined;
  }

  const parentSubtreeCoord = subtreeCoord.getParentSubtreeCoordinates();

  // Check the parent subtree's child subtree availability to know if this subtree is available.
  const parentSubtree = cache.find(rootId, parentSubtreeCoord);
  if (parentSubtree !== undefined) {
    const isChildSubtreeAvailable =
      parentSubtree.childSubtreeIsAvailableAtCoordinates(subtreeCoord);

    if (isChildSubtreeAvailable) {
      return tileCoord.isSubtreeRoot()
        ? true // The root tile of the subtree is always available
        : undefined; // Don't know if the tile is available because the subtree hasn't been loaded yet
    }
    // Child subtree not available, so this tile isn't either
    return false;
  }

  // The parent subtree isn't loaded either, so we don't even know if the child subtree is available
  return undefined;
};

/**
 * 从地理 tiles 坐标获取根 ID
 * 地理分片方案中有 2 个根 tiles：每个半球一个
 * @private
 * @param {number} level tiles 的层级
 * @param {number} x tiles 的 X 坐标
 * @returns {number} The 根 tiles ID（0 或 1）
 */
function getRootIdFromGeographic(level, x) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("level", level);
  Check.typeOf.number("x", x);
  //>>includeEnd('debug');

  const numberOfYTilesAtLevel = 1 << level;
  const rootId = (x / numberOfYTilesAtLevel) | 0;
  return rootId;
}

/**
 * 从地理 tiles 坐标获取隐式 tiles 坐标
 * @private
 * @param {ImplicitTileset} implicitTileset
 * @param {number} level tiles 的层级
 * @param {number} x tiles 的 X 坐标
 * @param {number} y tiles 的 y 坐标
 * @returns {ImplicitTileCoordinates} The 隐式 tiles 坐标
 */
function getImplicitTileCoordinatesFromGeographicCoordinates(
  implicitTileset,
  level,
  x,
  y,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("implicitTileset", implicitTileset);
  Check.typeOf.number("level", level);
  Check.typeOf.number("x", x);
  Check.typeOf.number("y", y);
  //>>includeEnd('debug');

  const numberOfYTilesAtLevel = 1 << level;
  const implicitLevel = level;
  const implicitX = x % numberOfYTilesAtLevel;
  const implicitY = numberOfYTilesAtLevel - y - 1;
  const { subdivisionScheme, subtreeLevels } = implicitTileset;

  return new ImplicitTileCoordinates({
    subdivisionScheme: subdivisionScheme,
    subtreeLevels: subtreeLevels,
    level: implicitLevel,
    x: implicitX,
    y: implicitY,
  });
}

/**
 * 从 glTF 加载水掩码图像纹理
 * @private
 * @param {Object.<string,*>} gltf glTF JSON
 * @param {Resource} gltfResource 指向 glTF 的资源
 * @returns {Promise<HTMLImageElement|HTMLCanvasElement|ImageBitmap>|undefined} A 解析为已加载图像的 promise。如果 <code>request.throttle</code> 为 true 且请求优先级不够高，则返回 undefined
 */
async function loadWaterMask(gltf, gltfResource) {
  const extension = gltf.extensions?.["EXT_structural_metadata"];
  if (!defined(extension) || !defined(extension.propertyTextures)) {
    return;
  }

  const schemaLoader = new MetadataSchemaLoader({
    schema: extension.schema,
  });

  await schemaLoader.load();
  const schema = schemaLoader.schema;

  let metadataClass, waterMaskProperty;
  if (defined(schema.classes)) {
    for (const classId in schema.classes) {
      if (schema.classes.hasOwnProperty(classId)) {
        metadataClass = schema.classes[classId];
        waterMaskProperty = metadataClass.propertiesBySemantic["WATERMASK"];
        if (defined(waterMaskProperty)) {
          break;
        }
      }
    }
  }

  if (!defined(waterMaskProperty)) {
    return;
  }

  const propertyTextureData = extension.propertyTextures.find(
    (data) => data.class === metadataClass.id,
  );
  if (!defined(propertyTextureData)) {
    throw new DeveloperError(
      `Expected a propertyTexture with a class ${metadataClass.id}`,
    );
  }

  const textureInfo = propertyTextureData.properties[waterMaskProperty.id];
  const texture = gltf.textures[textureInfo.index];
  const bufferViewId = gltf.images[texture.source]?.bufferView;

  const bufferViewLoader = ResourceCache.getBufferViewLoader({
    gltf: gltf,
    bufferViewId: bufferViewId,
    gltfResource: gltfResource,
    baseResource: gltfResource,
  });
  await bufferViewLoader.load();

  const image = await loadImageFromTypedArray({
    uint8Array: new Uint8Array(bufferViewLoader.typedArray),
    format: "image/png",
    flipY: false,
    skipColorSpaceConversion: true,
  });

  return image;
}

/**
 * 检查给定 tiles 坐标下的子 tiles 是否在指定子树中可用
 * @private
 * @param {ImplicitTileset} implicitTileset 隐式 tileset
 * @param {ImplicitSubtree} subtree 子树
 * @param {ImplicitTileCoordinates} coord 父 tiles 的 tiles 坐标
 * @param {number} x 子 tiles 的 x 坐标
 * @param {number} y 子 tiles 的 y 坐标
 * @returns {boolean} <code>true</code> 如果子 tiles 可用。否则为 <code>false</code>
 */
function isChildAvailable(implicitTileset, subtree, coord, x, y) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("implicitTileset", implicitTileset);
  Check.typeOf.object("subtree", subtree);
  Check.typeOf.object("coord", coord);
  Check.typeOf.number("x", x);
  Check.typeOf.number("y", y);
  //>>includeEnd('debug');

  // For terrain it's required that the root tile of any available subtree is also available, so
  // when the child tile belongs to a child subtree, we only need to check if the child subtree itself is available.
  const isBottomOfSubtree = coord.isBottomOfSubtree();

  const localLevel = 1;
  const offset = getImplicitTileCoordinates(implicitTileset, localLevel, x, y);
  const childCoord = coord.getDescendantCoordinates(offset);

  const isAvailable = isBottomOfSubtree
    ? subtree.childSubtreeIsAvailableAtCoordinates(childCoord)
    : subtree.tileIsAvailableAtCoordinates(childCoord);

  return isAvailable;
}

/**
 * 从地理 tiles 坐标获取隐式 tiles 坐标
 * @private
 * @param {ImplicitTileset} implicitTileset
 * @param {number} level tiles 的层级
 * @param {number} x tiles 的 x 坐标
 * @param {number} y tiles 的 y 坐标
 * @returns {ImplicitTileCoordinates}
 */
function getImplicitTileCoordinates(implicitTileset, level, x, y) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("implicitTileset", implicitTileset);
  Check.typeOf.number("level", level);
  Check.typeOf.number("x", x);
  Check.typeOf.number("y", y);
  //>>includeEnd('debug');

  const { subdivisionScheme, subtreeLevels } = implicitTileset;

  return new ImplicitTileCoordinates({
    subdivisionScheme: subdivisionScheme,
    subtreeLevels: subtreeLevels,
    level: level,
    x: x,
    y: y,
  });
}

/**
 * 确保我们加载了瓦片的可用性数据。
 *
 * @param {number} _x 请求几何数据的瓦片的X坐标。
 * @param {number} _y 请求几何数据的瓦片的Y坐标。
 * @param {number} _level 请求几何数据的瓦片层级。
 * @returns {Promise<void>|undefined} Undefined 如果无需加载，或当所有必需的瓦片被加载时Promise会解析。
 */
Cesium3DTilesTerrainProvider.prototype.loadTileDataAvailability = function (
  _x,
  _y,
  _level,
) {
  return undefined;
};

/**
 * 获取给定层级下瓦片允许的最大几何误差。
 *
 * @param {number} level 获取最大几何误差的瓦片层级。
 * @returns {number} The 最大几何误差。
 */
Cesium3DTilesTerrainProvider.prototype.getLevelMaximumGeometricError =
  function (level) {
    const ellipsoid = this._ellipsoid;
    const rootError =
      TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
        ellipsoid,
        64,
        2,
      );
    return rootError / (1 << level);
  };

Object.defineProperties(Cesium3DTilesTerrainProvider.prototype, {
  /**
   * 在地形提供程序遇到异步错误时触发事件。通过订阅该事件，您将收到错误通知并可能从中恢复。事件监听器
   * 接收 {@link TileProviderError} 的实例。
   * are passed an instance of {@link TileProviderError}.
   * @memberof Cesium3DTilesTerrainProvider.prototype
   * @type {Event}
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * 获取当前地形提供程序激活时显示的信用值。通常用于显示地形的来源。
   * 获取提供程序使用的镶嵌方案。
   * @memberof Cesium3DTilesTerrainProvider.prototype
   * @type {Credit}
   */
  credit: {
    get: function () {
      return this._credit;
    },
  },

  /**
   * 获取提供程序使用的镶嵌方案。
   * @memberof Cesium3DTilesTerrainProvider.prototype
   * @type {TilingScheme}
   */
  tilingScheme: {
    get: function () {
      return this._tilingScheme;
    },
  },

  /**
   * 获取指示提供程序是否包含水掩膜的值。水掩膜
   * 指示地球上的哪些区域是水而不是陆地，因此可以被渲染为具有动画波浪的反射表面。
   * 获取指示请求的瓦片是否包含顶点法线的值。
   * @memberof Cesium3DTilesTerrainProvider.prototype
   * @type {boolean}
   */
  hasWaterMask: {
    get: function () {
      return this._requestWaterMask;
    },
  },

  /**
   * 获取指示请求的瓦片是否包含顶点法线的值。
   * @memberof Cesium3DTilesTerrainProvider.prototype
   * @type {boolean}
   */
  hasVertexNormals: {
    get: function () {
      return this._requestVertexNormals;
    },
  },

  /**
   * 获取可用于确定此提供程序所提供地形可用性的对象，例如
   * 在点和矩形上。
   * @memberof Cesium3DTilesTerrainProvider.prototype
   * @type {TileAvailability|undefined}
   */
  availability: {
    get: function () {
      return this._subtreeCache;
    },
  },
});

/**
 * 隐式子树缓存中的一个节点。
 * @private
 * @constructor
 * @param {number} rootId 根瓦片ID（0或1）
 * @param {ImplicitSubtree} subtree 子树
 * @param {number} stamp 用于优先级排序的时间戳。
 */
function ImplicitSubtreeCacheNode(rootId, subtree, stamp) {
  this.rootId = rootId;
  this.subtree = subtree;
  this.stamp = stamp;
}

/**
 * 隐式子树的缓存。
 * @private
 * @constructor
 * @param {object} options 具有以下属性的对象
 * @param {Cesium3DTilesTerrainProvider} options.provider
 * @param {number} [options.maximumSubtreeCount=0] 此缓存可以存储的子树总数。如果添加新子树会超出此限制，则最低优先级的子树将被移除，直到有空间为止，除非要移除的子树是新子树的父节点，在这种情况下不会移除，新子树仍会被添加，从而超出内存限制。
 */
function ImplicitSubtreeCache(options) {
  this._maximumSubtreeCount = options.maximumSubtreeCount ?? 0;
  this._subtreeRequestCounter = 0;

  this._queue = new DoubleEndedPriorityQueue({
    comparator: ImplicitSubtreeCache.comparator,
  });

  this._provider = options.provider;
}

/**
 * @param {ImplicitSubtreeCacheNode} a
 * @param {ImplicitSubtreeCacheNode} b
 * @returns {number}
 */
ImplicitSubtreeCache.comparator = function (a, b) {
  const aCoord = a.subtree.implicitCoordinates;
  const bCoord = b.subtree.implicitCoordinates;
  if (aCoord.isAncestor(bCoord)) {
    // Technically this shouldn't happen because the ancestor subtree was supposed to be added to the cache first.
    return +1.0;
  } else if (bCoord.isAncestor(aCoord)) {
    return -1.0;
  }
  return a.stamp - b.stamp;
};

/**
 * 将子树添加到缓存中。
 * @param {number} rootId 根瓦片ID（0或1）
 * @param {ImplicitSubtree} subtree 子树
 */
ImplicitSubtreeCache.prototype.addSubtree = function (rootId, subtree) {
  const cacheNode = new ImplicitSubtreeCacheNode(
    rootId,
    subtree,
    this._subtreeRequestCounter,
  );
  this._queue.insert(cacheNode);

  this._subtreeRequestCounter++;

  const subtreeCoord = subtree.implicitCoordinates;

  // Make sure the parent subtree exists in the cache
  if (subtreeCoord.level > 0) {
    const parentCoord = subtreeCoord.getParentSubtreeCoordinates();
    const parentNode = this.find(rootId, parentCoord);

    //>>includeStart('debug', pragmas.debug)
    if (parentNode === undefined) {
      throw new DeveloperError("parent node needs to exist");
    }
    //>>includeEnd('debug');
  }

  if (this._maximumSubtreeCount > 0) {
    while (this._queue.length > this._maximumSubtreeCount) {
      const lowestPriorityNode = this._queue.getMinimum();
      if (lowestPriorityNode === cacheNode) {
        // Don't remove itself
        break;
      }

      this._queue.removeMinimum();
    }
  }
};

/**
 * 在缓存中查找子树。
 * @param {number} rootId 根瓦片ID（0或1）
 * @param {ImplicitTileCoordinates} subtreeCoord 子树的坐标
 * @returns {ImplicitSubtree|undefined} The 找到的子树；否则为未定义。
 */
ImplicitSubtreeCache.prototype.find = function (rootId, subtreeCoord) {
  const queue = this._queue;
  const array = queue.internalArray;
  const { level, x, y } = subtreeCoord;

  for (let i = 0; i < queue.length; i++) {
    const other = array[i];
    const otherRootId = other.rootId;
    const otherCoord = other.subtree.implicitCoordinates;
    if (
      otherRootId === rootId &&
      otherCoord.level === level &&
      otherCoord.x === x &&
      otherCoord.y === y
    ) {
      return other.subtree;
    }
  }
  return undefined;
};

/**
 * 确定覆盖该位置的最详细瓦片的 {@link ImplicitTileCoordinates}。
 *
 * @param {Cartographic} position 用于确定最大坐标的位置。高度组件被忽略。
 * @returns {ImplicitTileCoordinates|undefined} The 覆盖该位置的最精细瓦片坐标。
 * @throws {DeveloperError} If 根据瓦片映射方案，该位置不在任何瓦片范围内。
 */

ImplicitSubtreeCache.prototype._computeMaximumImplicitTileCoordinatesAtPosition =
  function (position) {
    const { longitude, latitude } = position;
    const provider = this._provider;
    const rootId = longitude < 0.0 ? 0 : 1;
    const implicitTileset =
      rootId === 0 ? provider._tileset0 : provider._tileset1;
    const subtreeLevels = implicitTileset.subtreeLevels;
    const rootSubtreeCoord = getImplicitTileCoordinates(
      implicitTileset,
      0,
      0,
      0,
    );

    let subtree = this.find(rootId, rootSubtreeCoord);
    if (subtree === undefined) {
      // Nothing has been loaded yet
      return undefined;
    }

    let subtreeCoord = subtree.implicitCoordinates;
    let subtreeX = subtreeCoord.x;
    let subtreeY = subtreeCoord.y;
    let subtreeLevel = subtreeCoord.level;

    const globalMinimumLongitude = -CesiumMath.PI;
    const globalMaximumLongitude = +CesiumMath.PI;
    const rootLongitudeStart = CesiumMath.lerp(
      globalMinimumLongitude,
      globalMaximumLongitude,
      rootId / 2.0,
    );
    const rootLongitudeEnd = CesiumMath.lerp(
      globalMinimumLongitude,
      globalMaximumLongitude,
      (rootId + 1) / 2,
    );
    const rootLatitudeStart = -CesiumMath.PI * 0.5;
    const rootLatitudeEnd = +CesiumMath.PI * 0.5;

    let u = 0.0;
    let v = 0.0;

    // Find the deepest available subtree
    let childSubtreeLoaded = true;
    while (childSubtreeLoaded) {
      const invDim = 1.0 / (1 << subtreeLevel);

      const lonLength = (rootLongitudeEnd - rootLongitudeStart) * invDim;
      const lonMin = rootLongitudeStart + subtreeX * lonLength;

      const latLength = (rootLatitudeEnd - rootLatitudeStart) * invDim;
      const latMin = rootLatitudeStart + subtreeY * latLength;

      u = (longitude - lonMin) / lonLength;
      v = (latitude - latMin) / latLength;

      const childSubtreeCoord = computeDescendantCoordinatesAtUv(
        implicitTileset,
        subtreeCoord,
        u,
        v,
        subtreeLevels,
      );

      if (subtree.childSubtreeIsAvailableAtCoordinates(childSubtreeCoord)) {
        const childSubtree = this.find(rootId, childSubtreeCoord);
        if (childSubtree !== undefined) {
          subtree = childSubtree;
          subtreeCoord = subtree.implicitCoordinates;
          subtreeX = subtreeCoord.x;
          subtreeY = subtreeCoord.y;
          subtreeLevel = subtreeCoord.level;
        } else {
          // Child subtree is available but has not been loaded yet
          // Since the root node of a subtree is always available, return the level of the child subtree
          // sampleTerrainMostDetailed will keep calling this function until all available subtrees in the chain have been loaded
          return childSubtreeCoord;
        }
      } else {
        // Child subtree is not available
        childSubtreeLoaded = false;
      }
    }

    // Find the deepest level in the subtree
    let deepestTileCoord;
    for (let localLevel = 0; localLevel < subtreeLevels; localLevel++) {
      const childCoord = computeDescendantCoordinatesAtUv(
        implicitTileset,
        subtreeCoord,
        u,
        v,
        localLevel,
      );

      if (subtree.tileIsAvailableAtCoordinates(childCoord)) {
        deepestTileCoord = childCoord;
      } else {
        break;
      }
    }

    return deepestTileCoord;
  };

/**
 * 计算子树中给定 (u,v) 位置下的后代瓦片坐标。
 * @private
 * @param {ImplicitTileset} implicitTileset
 * @param {ImplicitTileCoordinates} subtreeCoord
 * @param {number} u
 * @param {number} v
 * @param {number} levelOffset
 * @returns {ImplicitTileCoordinates} The 父子树坐标
 */
function computeDescendantCoordinatesAtUv(
  implicitTileset,
  subtreeCoord,
  u,
  v,
  levelOffset,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("implicitTileset", implicitTileset);
  Check.typeOf.object("subtreeCoord", subtreeCoord);
  Check.typeOf.number("u", u);
  Check.typeOf.number("v", v);
  Check.typeOf.number("levelOffset", levelOffset);
  //>>includeEnd('debug');

  const dimension = 1 << levelOffset;
  const localX = CesiumMath.clamp((u * dimension) | 0, 0, dimension - 1);
  const localY = CesiumMath.clamp((v * dimension) | 0, 0, dimension - 1);
  const offset = getImplicitTileCoordinates(
    implicitTileset,
    levelOffset,
    localX,
    localY,
  );
  return subtreeCoord.getDescendantCoordinates(offset);
}

// NOTE: ImplicitSubtreeCache implements just enough of the TileAvailability interface to support `sampleTerrain` and `sampleTerrainMostDetailed`.
// Right now this just means implementing `computeMaximumLevelAtPosition`.
// It's more difficult to implement the rest of the methods because doing everything in terms of ranges instead of bits is kind of awkward.

/**
 * 确定覆盖该位置的最精细瓦片的层级。
 *
 * @param {Cartographic} position 用于确定最大可用层级的位置。高度分量被忽略。
 * @returns {number} The 覆盖该位置的最精细瓦片层级。
 * @throws {DeveloperError} If 根据瓦片映射方案，该位置不在任何瓦片范围内。
 */
ImplicitSubtreeCache.prototype.computeMaximumLevelAtPosition = function (
  position,
) {
  const tileCoordinates =
    this._computeMaximumImplicitTileCoordinatesAtPosition(position);
  if (tileCoordinates === undefined) {
    return 0;
  }
  return tileCoordinates.level;
};

export default Cesium3DTilesTerrainProvider;