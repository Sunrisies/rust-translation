import {
  Cartesian3,
  Check,
  Ellipsoid,
  Frozen,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  OrientedBoundingBox,
  Quaternion,
  RuntimeError,
  defined,
} from "@cesium/core";
import { constructBoundingVolumeJson, getNodeTransform } from "@cesium/gltf";
import Axis from "./Axis.js";
import Cesium3DTileContentType from "./Cesium3DTileContentType.js";
import Cesium3DTilesetMetadata from "./Cesium3DTilesetMetadata.js";
import hasExtension from "./hasExtension.js";
import ImplicitSubtree from "./ImplicitSubtree.js";
import ImplicitSubtreeCache from "./ImplicitSubtreeCache.js";
import ImplicitTileCoordinates from "./ImplicitTileCoordinates.js";
import ImplicitTileset from "./ImplicitTileset.js";
import MetadataSemantic from "./MetadataSemantic.js";
import MetadataType from "./MetadataType.js";
import preprocess3DTileContent from "./preprocess3DTileContent.js";
import Resource from "../Core/Resource.js";
import ResourceCache from "./ResourceCache.js";
import VoxelContent from "./VoxelContent.js";
import VoxelMetadataOrder from "./VoxelMetadataOrder.js";
import VoxelShapeType from "./VoxelShapeType.js";

/**
 * @typedef {object} Cesium3DTilesVoxelProvider.ConstructorOptions
 *
 * Cesium3DTilesVoxelProvider 构造函数的初始化选项
 *
 * @property {string} className 描述体素元数据的tileset 模式中的类。
 * @property {string[]} names 元数据名称。
 * @property {MetadataType[]} types 元数据类型。
 * @property {MetadataComponentType[]} componentTypes 元数据组件类型。
 * @property {VoxelShapeType} shape {@link VoxelShapeType}。
 * @property {Cartesian3} dimensions 每个瓦片维度中的体素数量。该数值在数据集中的所有瓦片中均相同。
 * @property {Cartesian3} [paddingBefore=Cartesian3.ZERO] 瓦片前的填充体素数量。当采样瓦片的边缘时，这能提升渲染质量，但会增加内存使用。
 * @property {Cartesian3} [paddingAfter=Cartesian3.ZERO] 瓦片后的填充体素数量。当采样瓦片的边缘时，这能提升渲染质量，但会增加内存使用。
 * @property {Matrix4} [globalTransform=Matrix4.IDENTITY] 从局部空间到全局空间的变换。
 * @property {Matrix4} [shapeTransform=Matrix4.IDENTITY] 从形状空间到局部空间的变换。
 * @property {Cartesian3} [minBounds] 最小边界。
 * @property {Cartesian3} [maxBounds] 最大边界。
 * @property {number[][]} [minimumValues] 元数据的最小值。
 * @property {number[][]} [maximumValues] 元数据的最大值。
 * @property {number} [maximumTileCount] 此提供器存在的瓦片最大数量。该值作为提示给体素渲染器，以分配适当的 GPU 内存。如果未知，则可以为 undefined。
 */

/**
 * 从 3D Tiles tileset 获取体素数据的 {@link VoxelProvider}。
 * <p>
 * 实现 {@link VoxelProvider} 接口。
 * </p>
 * <div class="notice">
 * 通常不直接实例化此对象，应使用 {@link Cesium3DTilesVoxelProvider.fromUrl} 或 {@link Cesium3DTilesVoxelProvider.fromGltf}。
 * </div>
 *
 * @alias Cesium3DTilesVoxelProvider
 * @constructor
 * @augments VoxelProvider
 *
 * @param {Cesium3DTilesVoxelProvider.ConstructorOptions} options 描述初始化选项的对象
 *
 * @see Cesium3DTilesVoxelProvider.fromUrl
 * @see Cesium3DTilesVoxelProvider.fromGltf
 * @see VoxelProvider
 * @see VoxelPrimitive
 * @see VoxelShapeType
 *
 * @experimental This 该特性尚未定稿，可能会根据 Cesium 的标准弃用政策进行变更。
 */
function Cesium3DTilesVoxelProvider(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  const {
    className,
    names,
    types,
    componentTypes,
    shape,
    dimensions,
    paddingBefore = Cartesian3.ZERO.clone(),
    paddingAfter = Cartesian3.ZERO.clone(),
    globalTransform = Matrix4.IDENTITY.clone(),
    shapeTransform = Matrix4.IDENTITY.clone(),
    minBounds,
    maxBounds,
    minimumValues,
    maximumValues,
    maximumTileCount,
  } = options;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("className", className);
  Check.typeOf.object("names", names);
  Check.typeOf.object("types", types);
  Check.typeOf.object("componentTypes", componentTypes);
  Check.typeOf.string("shape", shape);
  Check.typeOf.object("dimensions", dimensions);
  //>>includeEnd('debug');

  this._shapeTransform = shapeTransform;
  this._globalTransform = globalTransform;
  this._shape = shape;
  this._minBounds = minBounds;
  this._maxBounds = maxBounds;
  this._dimensions = dimensions;
  this._paddingBefore = paddingBefore;
  this._paddingAfter = paddingAfter;
  this._className = className;
  this._names = names;
  this._types = types;
  this._componentTypes = componentTypes;
  this._metadataOrder =
    shape === VoxelShapeType.ELLIPSOID
      ? VoxelMetadataOrder.Z_UP
      : VoxelMetadataOrder.Y_UP;
  this._minimumValues = minimumValues;
  this._maximumValues = maximumValues;
  this._maximumTileCount = maximumTileCount;
  this._availableLevels = undefined;
  this._implicitTileset = undefined;
  this._subtreeCache = new ImplicitSubtreeCache();
}

Object.defineProperties(Cesium3DTilesVoxelProvider.prototype, {
  /**
   * 从局部空间到全局空间的变换。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {Matrix4}
   * @default Matrix4.IDENTITY
   * @readonly
   */
  globalTransform: {
    get: function () {
      return this._globalTransform;
    },
  },

  /**
   * 从形状空间到局部空间的变换。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {Matrix4}
   * @default Matrix4.IDENTITY
   * @readonly
   */
  shapeTransform: {
    get: function () {
      return this._shapeTransform;
    },
  },

  /**
   * 获取 {@link VoxelShapeType}
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {VoxelShapeType}
   * @readonly
   */
  shape: {
    get: function () {
      return this._shape;
    },
  },

  /**
   * 获取最小边界。
   * 如果未定义，则使用形状的默认最小边界。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {Cartesian3|undefined}
   * @readonly
   */
  minBounds: {
    get: function () {
      return this._minBounds;
    },
  },

  /**
   * 获取最大边界。
   * 如果未定义，则使用形状的默认最大边界。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {Cartesian3|undefined}
   * @readonly
   */
  maxBounds: {
    get: function () {
      return this._maxBounds;
    },
  },

  /**
   * 获取每个瓦片维度中的体素数量。该数值在数据集中的所有瓦片中均相同。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {Cartesian3}
   * @readonly
   */
  dimensions: {
    get: function () {
      return this._dimensions;
    },
  },

  /**
   * 获取瓦片前的填充体素数量。当采样瓦片的边缘时，这能提升渲染质量，但会增加内存使用。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {Cartesian3}
   * @default Cartesian3.ZERO
   * @readonly
   */
  paddingBefore: {
    get: function () {
      return this._paddingBefore;
    },
  },

  /**
   * 获取瓦片后的填充体素数量。当采样瓦片的边缘时，这能提升渲染质量，但会增加内存使用。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {Cartesian3}
   * @default Cartesian3.ZERO
   * @readonly
   */
  paddingAfter: {
    get: function () {
      return this._paddingAfter;
    },
  },

  /**
   * 此 tileset 的元数据类。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {string}
   * @readonly
   */
  className: {
    get: function () {
      return this._className;
    },
  },

  /**
   * 获取元数据名称。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {string[]}
   * @readonly
   */
  names: {
    get: function () {
      return this._names;
    },
  },

  /**
   * 获取元数据类型。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {MetadataType[]}
   * @readonly
   */
  types: {
    get: function () {
      return this._types;
    },
  },

  /**
   * 获取元数据组件类型。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {MetadataComponentType[]}
   * @readonly
   */
  componentTypes: {
    get: function () {
      return this._componentTypes;
    },
  },

  /**
   * 获取缓冲区中元数据的排序。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {VoxelMetadataOrder}
   * @readonly
   * @private
   */
  metadataOrder: {
    get: function () {
      return this._metadataOrder;
    },
  },

  /**
   * 获取元数据的最小值。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {number[][]|undefined}
   * @readonly
   */
  minimumValues: {
    get: function () {
      return this._minimumValues;
    },
  },

  /**
   * 获取元数据的最大值。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {number[][]|undefined}
   * @readonly
   */
  maximumValues: {
    get: function () {
      return this._maximumValues;
    },
  },

  /**
   * 此提供器存在的最大瓦片数量。
   * 该值作为对体素渲染器的提示，以分配适当的GPU内存。
   * 如果不知道该值，则可以为 undefined。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {number|undefined}
   * @readonly
   */
  maximumTileCount: {
    get: function () {
      return this._maximumTileCount;
    },
  },

  /**
   * tileset中可用的瓦片的细节级别数量。
   *
   * @memberof Cesium3DTilesVoxelProvider.prototype
   * @type {number|undefined}
   * @readonly
   */
  availableLevels: {
    get: function () {
      return this._availableLevels;
    },
  },
});

/**
 * 创建一个从3D Tiles tileset获取体素数据的 {@link Cesium3DTilesVoxelProvider}。
 *
 * @param {Resource|string} url tileset JSON文件的URL
 * @returns {Promise<Cesium3DTilesVoxelProvider>} The 创建的提供器
 *
 * @exception {RuntimeException} Root 必须包含内容
 * @exception {RuntimeException} Root 瓦片内容必须具有3DTILES_content_voxels扩展名
 * @exception {RuntimeException} Root 瓦片必须具有隐式平铺机制
 * @exception {RuntimeException} Tileset 必须具有元数据模式
 * @exception {RuntimeException} Only 在Cesium3DTilesVoxelProvider中支持box、region和3DTILES_bounding_volume_cylinder。
 *
 * @example
 * try {
 * const voxelProvider = await Cesium3DTilesVoxelProvider.fromUrl(
 * "http://localhost:8002/tilesets/voxel/tileset.json"
 *   );
 * const voxelPrimitive = new VoxelPrimitive({
 * provider: voxelProvider,
 * customShader: customShader,
 *   });
 * scene.primitives.add(voxelPrimitive);
 * } catch (error) {
 * console.error(`Error creating voxel primitive: ${error}`);
 * }
 *
 * @see {@link VoxelPrimitive}
 */
Cesium3DTilesVoxelProvider.fromUrl = async function (url) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  //>>includeEnd('debug');

  const resource = Resource.createIfNeeded(url);
  const tilesetJson = await resource.fetchJson();

  validate(tilesetJson);

  const schemaLoader = getMetadataSchemaLoader(tilesetJson, resource);
  await schemaLoader.load();

  const { root } = tilesetJson;

  const metadataJson = hasExtension(tilesetJson, "3DTILES_metadata")
    ? tilesetJson.extensions["3DTILES_metadata"]
    : tilesetJson;

  const tilesetMetadata = new Cesium3DTilesetMetadata({
    metadataJson: metadataJson,
    schema: schemaLoader.schema,
  });

  const voxel = root.content.extensions["3DTILES_content_voxels"];
  const className = voxel.class;

  const providerOptions = getAttributeInfo(tilesetMetadata, className);
  Object.assign(providerOptions, getShape(root.boundingVolume));
  if (defined(root.transform)) {
    providerOptions.globalTransform = Matrix4.unpack(root.transform);
  } else {
    providerOptions.globalTransform = Matrix4.clone(Matrix4.IDENTITY);
  }

  providerOptions.dimensions = Cartesian3.unpack(voxel.dimensions);
  providerOptions.maximumTileCount = getTileCount(tilesetMetadata);

  if (defined(voxel.padding)) {
    providerOptions.paddingBefore = Cartesian3.unpack(voxel.padding.before);
    providerOptions.paddingAfter = Cartesian3.unpack(voxel.padding.after);
  }

  const provider = new Cesium3DTilesVoxelProvider(providerOptions);

  const implicitTileset = new ImplicitTileset(
    resource,
    root,
    schemaLoader.schema,
  );
  provider._implicitTileset = implicitTileset;
  provider._availableLevels = implicitTileset.availableLevels;

  ResourceCache.unload(schemaLoader);

  return provider;
};

/**
 * 创建一个从存储为glTF的3D Tiles 2.0 tileset获取体素数据的 {@link Cesium3DTilesVoxelProvider}。
 *
 * @param {Resource|string} url 包含<code>3DTILES_tileset</code>和<code>3DTILES_tileset_voxels</code>扩展名的glTF文件的URL
 * @returns {Promise<Cesium3DTilesVoxelProvider>} The 创建的提供器
 *
 * @exception {RuntimeError} Tileset 必须具有3DTILES_tileset_voxels扩展名
 * @exception {RuntimeError} Root 瓦片必须具有隐式平铺机制
 * @exception {RuntimeError} Tileset 必须具有元数据模式
 * @exception {DeveloperError} Only 边界体积支持box形状。
 *
 * @example
 * try {
 * const voxelProvider = await Cesium3DTilesVoxelProvider.fromGltf(
 * "http://localhost:8002/tilesets/voxel/voxels.tileset.gltf"
 *   );
 * const voxelPrimitive = new VoxelPrimitive({ provider: voxelProvider });
 * scene.primitives.add(voxelPrimitive);
 * } catch (error) {
 * console.error(`Error creating voxel primitive: ${error}`);
 * }
 *
 * @see {@link VoxelPrimitive}
 */
Cesium3DTilesVoxelProvider.fromGltf = async function (url) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("url", url);
  //>>includeEnd('debug');

  const resource = Resource.createIfNeeded(url);
  const gltfJson = await resource.fetchJson();

  const rootNode = getGltfRootNode(gltfJson);
  validateGltf(gltfJson, rootNode);

  const metadataJson = gltfJson.extensions.EXT_structural_metadata;
  const schemaLoader = getMetadataSchemaLoader(metadataJson, resource);
  await schemaLoader.load();

  const tilesetMetadata = new Cesium3DTilesetMetadata({
    metadataJson: metadataJson,
    schema: schemaLoader.schema,
  });

  const voxels = gltfJson.extensions["3DTILES_tileset_voxels"];
  const providerOptions = getAttributeInfo(tilesetMetadata, voxels.class);

  const boundingVolume = constructBoundingVolumeJson(
    rootNode.boundingVolume,
    gltfJson.shapes,
  );
  Object.assign(providerOptions, getGltfBoxShape(boundingVolume));

  const nodeTransform = getNodeTransform(rootNode);
  providerOptions.globalTransform = Matrix4.multiplyTransformation(
    Axis.Y_UP_TO_Z_UP,
    defined(nodeTransform) ? Matrix4.unpack(nodeTransform) : Matrix4.IDENTITY,
    new Matrix4(),
  );

  providerOptions.dimensions = Cartesian3.unpack(voxels.dimensions);
  providerOptions.maximumTileCount = getTileCount(tilesetMetadata);

  if (defined(voxels.padding)) {
    providerOptions.paddingBefore = Cartesian3.unpack(voxels.padding.before);
    providerOptions.paddingAfter = Cartesian3.unpack(voxels.padding.after);
  }

  const provider = new Cesium3DTilesVoxelProvider(providerOptions);
  provider._metadataOrder = VoxelMetadataOrder.Z_UP;

  const implicitTileset = new ImplicitTileset(
    resource,
    getImplicitTileHeader(rootNode, boundingVolume),
    schemaLoader.schema,
  );
  provider._implicitTileset = implicitTileset;
  provider._availableLevels = implicitTileset.availableLevels;

  ResourceCache.unload(schemaLoader);

  return provider;
};

function getGltfRootNode(gltf) {
  const rootNodeIndex = gltf.scenes?.[0]?.nodes?.[0];
  if (!defined(rootNodeIndex)) {
    throw new RuntimeError("Tileset must have a scene with a root node");
  }
  return gltf.nodes[rootNodeIndex];
}

function validateGltf(gltf, rootNode) {
  if (!hasExtension(gltf, "3DTILES_tileset_voxels")) {
    throw new RuntimeError(
      "Tileset must have the 3DTILES_tileset_voxels extension",
    );
  }

  if (!hasExtension(rootNode, "3DTILES_implicit_tiling")) {
    throw new RuntimeError("Root tile must have implicit tiling");
  }

  const metadataJson = gltf.extensions.EXT_structural_metadata;
  if (!defined(metadataJson?.schema) && !defined(metadataJson?.schemaUri)) {
    throw new RuntimeError("Tileset must have a metadata schema");
  }
}

function toXyzTemplate(uri) {
  return uri
    .replace("{right}", "{x}")
    .replace("{forward}", "{y}")
    .replace("{up}", "{z}");
}

function getImplicitTileHeader(rootNode, boundingVolume) {
  const { geometricError, refine } = rootNode.extensions["3DTILES_tileset"];
  const {
    contentUri,
    subtreeUri,
    subdivisionScheme,
    subtreeLevels,
    availableLevels,
  } = rootNode.extensions["3DTILES_implicit_tiling"];

  return {
    geometricError,
    refine,
    boundingVolume,
    content: { uri: toXyzTemplate(contentUri) },
    implicitTiling: {
      subdivisionScheme,
      subtreeLevels,
      availableLevels,
      subtrees: { uri: toXyzTemplate(subtreeUri) },
    },
  };
}

// The EXT_voxels box axes (right, forward, up) are glTF (-x, +z, +y).
const voxelFrameToGltf = Matrix4.fromRotationTranslation(
  new Matrix3(-1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0),
);

function getGltfBoxShape(boundingVolume) {
  const { shape, minBounds, maxBounds, shapeTransform } =
    getShape(boundingVolume);

  return {
    shape,
    minBounds: new Cartesian3(minBounds.x, minBounds.z, minBounds.y),
    maxBounds: new Cartesian3(maxBounds.x, maxBounds.z, maxBounds.y),
    shapeTransform: Matrix4.multiplyTransformation(
      shapeTransform,
      voxelFrameToGltf,
      new Matrix4(),
    ),
  };
}

function getTileCount(metadata) {
  if (!defined(metadata.tileset)) {
    return undefined;
  }

  return metadata.tileset.getPropertyBySemantic(
    MetadataSemantic.TILESET_TILE_COUNT,
  );
}

function validate(tileset) {
  const root = tileset.root;

  if (!defined(root.content)) {
    throw new RuntimeError("Root must have content");
  }

  if (!hasExtension(root.content, "3DTILES_content_voxels")) {
    throw new RuntimeError(
      "Root tile content must have 3DTILES_content_voxels extension",
    );
  }

  if (
    !hasExtension(root, "3DTILES_implicit_tiling") &&
    !defined(root.implicitTiling)
  ) {
    throw new RuntimeError("Root tile must have implicit tiling");
  }

  if (
    !defined(tileset.schema) &&
    !defined(tileset.schemaUri) &&
    !hasExtension(tileset, "3DTILES_metadata")
  ) {
    throw new RuntimeError("Tileset must have a metadata schema");
  }
}

function getShape(boundingVolume) {
  if (defined(boundingVolume.box)) {
    return getBoxShape(boundingVolume.box);
  } else if (defined(boundingVolume.region)) {
    return getEllipsoidShape(boundingVolume.region);
  } else if (hasExtension(boundingVolume, "3DTILES_bounding_volume_cylinder")) {
    return getCylinderShape(
      boundingVolume.extensions["3DTILES_bounding_volume_cylinder"],
    );
  }

  throw new RuntimeError(
    "Only box, region and 3DTILES_bounding_volume_cylinder are supported in Cesium3DTilesVoxelProvider",
  );
}

function getEllipsoidShape(region) {
  const west = region[0];
  const south = region[1];
  const east = region[2];
  const north = region[3];
  const minHeight = region[4];
  const maxHeight = region[5];

  const shapeTransform = Matrix4.fromScale(Ellipsoid.WGS84.radii);

  const minBounds = new Cartesian3(west, south, minHeight);
  const maxBounds = new Cartesian3(east, north, maxHeight);

  return {
    shape: VoxelShapeType.ELLIPSOID,
    minBounds: minBounds,
    maxBounds: maxBounds,
    shapeTransform: shapeTransform,
  };
}

const scratchScale = new Cartesian3();
const scratchRotation = new Matrix3();

function getBoxShape(box) {
  const obb = OrientedBoundingBox.unpack(box);
  const scale = Matrix3.getScale(obb.halfAxes, scratchScale);
  const rotation = Matrix3.getRotation(obb.halfAxes, scratchRotation);

  return {
    shape: VoxelShapeType.BOX,
    minBounds: Cartesian3.negate(scale, new Cartesian3()),
    maxBounds: Cartesian3.clone(scale),
    shapeTransform: Matrix4.fromRotationTranslation(rotation, obb.center),
  };
}

function getCylinderShape(cylinder) {
  const {
    minRadius,
    maxRadius,
    height,
    minAngle = -CesiumMath.PI,
    maxAngle = CesiumMath.PI,
    translation = [0, 0, 0],
    rotation = [0, 0, 0, 1],
  } = cylinder;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("minRadius", minRadius);
  Check.typeOf.number("maxRadius", maxRadius);
  Check.typeOf.number("height", height);
  Check.typeOf.number("minAngle", minAngle);
  Check.typeOf.number("maxAngle", maxAngle);
  Check.typeOf.object("translation", translation);
  Check.typeOf.object("rotation", rotation);
  //>>includeEnd('debug');

  const minHeight = -0.5 * height + translation[2];
  const maxHeight = 0.5 * height + translation[2];

  const shapeTransform = Matrix4.fromTranslationQuaternionRotationScale(
    Cartesian3.unpack(translation),
    Quaternion.unpack(rotation),
    Cartesian3.ONE,
  );

  return {
    shape: VoxelShapeType.CYLINDER,
    minBounds: Cartesian3.fromElements(minRadius, minAngle, minHeight),
    maxBounds: Cartesian3.fromElements(maxRadius, maxAngle, maxHeight),
    shapeTransform: shapeTransform,
  };
}

function getMetadataSchemaLoader(tilesetJson, resource) {
  const { schemaUri, schema } = tilesetJson;
  if (!defined(schemaUri)) {
    return ResourceCache.getSchemaLoader({ schema });
  }
  return ResourceCache.getSchemaLoader({
    resource: resource.getDerivedResource({
      url: schemaUri,
    }),
  });
}

function getAttributeInfo(metadata, className) {
  const { schema, statistics } = metadata;
  const classStatistics = statistics?.classes[className];
  const properties = schema.classes[className].properties;

  const propertyInfo = Object.entries(properties).map(([id, property]) => {
    const { type, componentType } = property;
    const min = classStatistics?.properties[id].min;
    const max = classStatistics?.properties[id].max;
    const componentCount = MetadataType.getComponentCount(type);
    const minValue = copyArray(min, componentCount);
    const maxValue = copyArray(max, componentCount);

    return { id, type, componentType, minValue, maxValue };
  });

  const names = propertyInfo.map((info) => info.id);
  const types = propertyInfo.map((info) => info.type);
  const componentTypes = propertyInfo.map((info) => info.componentType);

  const minimumValues = propertyInfo.map((info) => info.minValue);
  const maximumValues = propertyInfo.map((info) => info.maxValue);
  const hasMinimumValues = minimumValues.some(defined);

  return {
    className,
    names,
    types,
    componentTypes,
    minimumValues: hasMinimumValues ? minimumValues : undefined,
    maximumValues: hasMinimumValues ? maximumValues : undefined,
  };
}

function copyArray(values, length) {
  // Copy input values into a new array of a specified length.
  // If the input is not an array, its value will be copied into the first element
  // of the returned array. If the input is an array shorter than the returned
  // array, the extra elements in the returned array will be undefined. If the
  // input is undefined, the return will be undefined.
  if (!defined(values)) {
    return;
  }
  const valuesArray = Array.isArray(values) ? values : [values];
  return Array.from({ length }, (v, i) => valuesArray[i]);
}

/**
 * 获取给定子树坐标下的子树
 * @param {VoxelProvider} provider 体素提供器
 * @param {ImplicitTileCoordinates} subtreeCoord 检索子树的坐标
 * @returns {Promise<ImplicitSubtree>} The 给定坐标下的子树
 * @private
 */
async function getSubtree(provider, subtreeCoord) {
  const implicitTileset = provider._implicitTileset;
  const subtreeCache = provider._subtreeCache;

  // First load the subtree to check if the tile is available.
  // If the subtree has been requested previously it might still be in the cache
  let subtree = subtreeCache.find(subtreeCoord);
  if (defined(subtree)) {
    return subtree;
  }

  const subtreeRelative = implicitTileset.subtreeUriTemplate.getDerivedResource(
    {
      templateValues: subtreeCoord.getTemplateValues(),
    },
  );
  const subtreeResource = implicitTileset.baseResource.getDerivedResource({
    url: subtreeRelative.url,
  });

  const arrayBuffer = await subtreeResource.fetchArrayBuffer();
  // Check one more time if the subtree is in the cache.
  // This could happen if there are two in-flight tile requests from the same
  // subtree and one finishes before the other.
  subtree = subtreeCache.find(subtreeCoord);
  if (defined(subtree)) {
    return subtree;
  }

  const { contentType, jsonPayload, binaryPayload } =
    preprocess3DTileContent(arrayBuffer);
  if (contentType === Cesium3DTileContentType.IMPLICIT_SUBTREE_GLTF) {
    subtree = await ImplicitSubtree.fromSubtreeGltf(
      subtreeResource,
      jsonPayload,
      implicitTileset,
      subtreeCoord,
    );
  } else if (contentType === Cesium3DTileContentType.IMPLICIT_SUBTREE_GLB) {
    subtree = await ImplicitSubtree.fromSubtreeGlb(
      subtreeResource,
      binaryPayload,
      implicitTileset,
      subtreeCoord,
    );
  } else {
    subtree = await ImplicitSubtree.fromSubtreeJson(
      subtreeResource,
      jsonPayload,
      binaryPayload,
      implicitTileset,
      subtreeCoord,
    );
  }
  subtreeCache.addSubtree(subtree);
  return subtree;
}

/**
 * 请求特定瓦片的数据。
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {number} [options.tileLevel=0] 瓦片的层级。
 * @param {number} [options.tileX=0] 瓦片的X坐标。
 * @param {number} [options.tileY=0] 瓦片的Y坐标。
 * @param {number} [options.tileZ=0] 瓦片的Z坐标。
 * @privateparam {number} [options.keyframe=0] 请求的关键帧。
 * @returns {Promise<VoxelContent>|undefined} A 承诺解析为包含该瓦片数据的VoxelContent，如果请求无法在此帧安排，则为undefined。
 */
Cesium3DTilesVoxelProvider.prototype.requestData = async function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const {
    tileLevel = 0,
    tileX = 0,
    tileY = 0,
    tileZ = 0,
    keyframe = 0,
  } = options;

  if (keyframe !== 0) {
    return Promise.reject(
      `3D Tiles currently doesn't support time-dynamic data.`,
    );
  }

  // 1. Load the subtree that the tile belongs to (possibly from the subtree cache)
  // 2. Load the voxel content if available

  // Can't use a scratch variable here because the object is used inside the promise chain.
  const implicitTileset = this._implicitTileset;
  const tileCoordinates = new ImplicitTileCoordinates({
    subdivisionScheme: implicitTileset.subdivisionScheme,
    subtreeLevels: implicitTileset.subtreeLevels,
    level: tileLevel,
    x: tileX,
    y: tileY,
    z: tileZ,
  });

  // Find the coordinates of the parent subtree containing tileCoordinates
  // If tileCoordinates is a subtree child, use that subtree
  // If tileCoordinates is a subtree root, use its parent subtree
  const isSubtreeRoot =
    tileCoordinates.isSubtreeRoot() && tileCoordinates.level > 0;

  const subtreeCoord = isSubtreeRoot
    ? tileCoordinates.getParentSubtreeCoordinates()
    : tileCoordinates.getSubtreeCoordinates();

  const that = this;

  const subtree = await getSubtree(that, subtreeCoord);
  // NOTE: these two subtree methods are ONLY used by voxels!
  const isAvailable = isSubtreeRoot
    ? subtree.childSubtreeIsAvailableAtCoordinates
    : subtree.tileIsAvailableAtCoordinates;

  const available = isAvailable.call(subtree, tileCoordinates);

  if (!available) {
    return Promise.reject(
      `Tile is not available at level ${tileLevel}, x ${tileX}, y ${tileY}, z ${tileZ}.`,
    );
  }

  const { contentUriTemplates, baseResource } = implicitTileset;
  const gltfRelative = contentUriTemplates[0].getDerivedResource({
    templateValues: tileCoordinates.getTemplateValues(),
  });
  const gltfResource = baseResource.getDerivedResource({
    url: gltfRelative.url,
  });

  return VoxelContent.fromGltf(gltfResource);
};

export default Cesium3DTilesVoxelProvider;
