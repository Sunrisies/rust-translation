import {
  Check,
  DeveloperError,
  RuntimeError,
  defined,
  destroyObject,
  getJsonFromTypedArray,
} from "@cesium/core";
import hasExtension from "./hasExtension.js";
import ImplicitAvailabilityBitstream from "./ImplicitAvailabilityBitstream.js";
import ImplicitMetadataView from "./ImplicitMetadataView.js";
import ImplicitSubdivisionScheme from "./ImplicitSubdivisionScheme.js";
import ImplicitSubtreeMetadata from "./ImplicitSubtreeMetadata.js";
import MetadataTable from "./MetadataTable.js";
import ResourceCache from "./ResourceCache.js";

/**
 * 表示隐式瓦片集中的一个子树对象的实体。
 * 包括可用性信息。
 * <p>
 * 子树处理瓦片元数据，这些元数据在子树的 JSON 中定义，可以是
 * tileMetadata (3D Tiles 1.1) 或 <code>3DTILES_metadata</code> 扩展格式。
 * 子树还处理内容元数据以及关于子树本身的元数据。
 * </p>
 *
 * 通常不直接实例化此对象，应使用 {@link ImplicitSubtree.fromSubtreeJson}。
 *
 * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_metadata#implicit-tile-properties|Implicit Tile Properties in the 3DTILES_metadata specification}
 * @see ImplicitSubtree.fromSubtreeJson
 *
 * @alias ImplicitSubtree
 * @constructor
 *
 * @param {Resource} resource 该子树的资源。用于按需获取外部缓冲区。
 * @param {ImplicitTileset} implicitTileset 隐式瓦片集。包含有关子树大小的信息。
 * @param {ImplicitTileCoordinates} implicitCoordinates 子树根瓦片的坐标。
 *
 * @private
 * @experimental This feature 是 3D Tiles 规范中的一部分，尚未最终确定，可能会因 Cesium 标准弃用政策而发生变化。
 */
function ImplicitSubtree(resource, implicitTileset, implicitCoordinates) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("resource", resource);
  Check.typeOf.object("implicitTileset", implicitTileset);
  Check.typeOf.object("implicitCoordinates", implicitCoordinates);
  //>>includeEnd('debug');

  this._resource = resource;
  this._subtreeJson = undefined;
  this._bufferLoader = undefined;
  this._tileAvailability = undefined;
  this._contentAvailabilityBitstreams = [];
  this._childSubtreeAvailability = undefined;
  this._implicitCoordinates = implicitCoordinates;
  this._subtreeLevels = implicitTileset.subtreeLevels;
  this._subdivisionScheme = implicitTileset.subdivisionScheme;
  this._branchingFactor = implicitTileset.branchingFactor;

  // properties for metadata
  this._metadata = undefined;
  this._tileMetadataTable = undefined;
  this._tilePropertyTableJson = undefined;

  this._contentMetadataTables = [];
  this._contentPropertyTableJsons = [];

  // Jump buffers are maps of availability bit index to entity ID
  this._tileJumpBuffer = undefined;
  this._contentJumpBuffers = [];

  this._ready = false;
}

Object.defineProperties(ImplicitSubtree.prototype, {
  /**
   * 当所有必要的可用性缓冲区被加载后，返回 true。
   * 当子树元数据存在时（3D Tiles 1.1），此属性存储一个 {@link ImplicitSubtreeMetadata} 实例。
   *
   * @type {boolean}
   * @readonly
   * @private
   */
  ready: {
    get: function () {
      return this._ready;
    },
  },

  /**
   * When subtree metadata is present (3D Tiles 1.1), this property stores an {@link ImplicitSubtreeMetadata} instance
   *
   * @type {ImplicitSubtreeMetadata}
   * @readonly
   * @private
   */
  metadata: {
    get: function () {
      return this._metadata;
    },
  },

  /**
   * 当瓦片元数据存在时（3D Tiles 1.1）或使用 <code>3DTILES_metadata</code> 扩展时，
   * 此属性存储用于子树中瓦片的 {@link MetadataTable} 实例。
   *
   * @type {MetadataTable}
   * @readonly
   * @private
   */
  tileMetadataTable: {
    get: function () {
      return this._tileMetadataTable;
    },
  },

  /**
   * 当瓦片元数据存在时（3D Tiles 1.1）或使用 <code>3DTILES_metadata</code> 扩展时，
   * 此属性存储来自扩展的 JSON 数据。由 {@link TileMetadata} 使用
   * 来获取子树中瓦片的额外信息和扩展内容。
   *
   * @type {object}
   * @readonly
   * @private
   */
  tilePropertyTableJson: {
    get: function () {
      return this._tilePropertyTableJson;
    },
  },

  /**
   * 当内容元数据存在时（3D Tiles 1.1），此属性存储
   * 子树中内容的 {@link MetadataTable} 实例数组。
   *
   * @type {Array}
   * @readonly
   * @private
   */
  contentMetadataTables: {
    get: function () {
      return this._contentMetadataTables;
    },
  },

  /**
   * 当内容元数据存在时（3D Tiles 1.1），此属性
   * 是来自扩展的 JSON 数组。用于获取子树中内容的额外信息和扩展内容。
   * 获取子树根节点的隐式瓦片坐标。
   *
   * @type {Array}
   * @readonly
   * @private
   */
  contentPropertyTableJsons: {
    get: function () {
      return this._contentPropertyTableJsons;
    },
  },

  /**
   * 检查特定瓦片是否在瓦片可用性位流的索引位置可用。
   *
   * @type {ImplicitTileCoordinates}
   * @readonly
   * @private
   */
  implicitCoordinates: {
    get: function () {
      return this._implicitCoordinates;
    },
  },
});

/**
 * 所需瓦片的索引
 *
 * @param {number} index 第 i 位的值
 * @returns {boolean} The 检查特定瓦片是否在隐式瓦片坐标的位置可用。
 * @private
 */
ImplicitSubtree.prototype.tileIsAvailableAtIndex = function (index) {
  return this._tileAvailability.getBit(index);
};

/**
 * 检查特定瓦片是否在隐式瓦片坐标的位置可用。
 * 注意：仅用于体素。
 *
 * @param {ImplicitTileCoordinates} implicitCoordinates 瓦片的全局坐标。
 * @returns {boolean} The 第 i 位的值。
 * @private
 */
ImplicitSubtree.prototype.tileIsAvailableAtCoordinates = function (
  implicitCoordinates,
) {
  const index = this.getTileIndex(implicitCoordinates);
  return this.tileIsAvailableAtIndex(index);
};

/**
 * 检查特定瓦片的内容是否在内容可用性位流的索引位置可用。
 *
 * @param {number} index 所需瓦片的索引。
 * @param {number} [contentIndex=0] 当使用多个内容时，所需内容的索引。
 * @returns {boolean} The 第 i 位的值。
 * @private
 */
ImplicitSubtree.prototype.contentIsAvailableAtIndex = function (
  index,
  contentIndex,
) {
  contentIndex = contentIndex ?? 0;
  //>>includeStart('debug', pragmas.debug);
  if (
    contentIndex < 0 ||
    contentIndex >= this._contentAvailabilityBitstreams.length
  ) {
    throw new DeveloperError("contentIndex out of bounds.");
  }
  //>>includeEnd('debug');

  return this._contentAvailabilityBitstreams[contentIndex].getBit(index);
};

/**
 * 检查特定瓦片的内容是否在隐式瓦片坐标下可用
 *
 * @param {ImplicitTileCoordinates} implicitCoordinates 瓦片的全局坐标
 * @param {number} [contentIndex=0] 使用 <code>3DTILES_multiple_contents</code> 扩展时，所需内容的索引
 * @returns {boolean} The 第 i 位的值
 * @private
 */
ImplicitSubtree.prototype.contentIsAvailableAtCoordinates = function (
  implicitCoordinates,
  contentIndex,
) {
  const index = this.getTileIndex(implicitCoordinates);
  return this.contentIsAvailableAtIndex(index, contentIndex);
};

/**
 * 检查子子树在子子树可用性位流的某个索引下是否可用
 *
 * @param {number} index 所需子子树的索引
 * @returns {boolean} The 第 i 位的值
 * @private
 */
ImplicitSubtree.prototype.childSubtreeIsAvailableAtIndex = function (index) {
  return this._childSubtreeAvailability.getBit(index);
};

/**
 * 检查特定子子树是否在隐式瓦片坐标下可用
 * 注意：仅用于体素。
 *
 * @param {ImplicitTileCoordinates} implicitCoordinates 子子树的全局坐标
 * @returns {boolean} The 第 i 位的值
 * @private
 */
ImplicitSubtree.prototype.childSubtreeIsAvailableAtCoordinates = function (
  implicitCoordinates,
) {
  const index = this.getChildSubtreeIndex(implicitCoordinates);
  return this.childSubtreeIsAvailableAtIndex(index);
};

/**
 * 获取该子树中给定层级的第一个节点的索引
 * 例如，对于四叉树：
 * <ul>
 * <li>层级 0 从索引 0 开始</li>
 * <li>层级 1 从索引 1 开始</li>
 * <li>层级 2 从索引 5 开始</li>
 * </ul>
 *
 * @param {number} level 相对于子树根节点的零索引层级数
 * @returns {number} The 所需层级的第一个索引
 * @private
 */
ImplicitSubtree.prototype.getLevelOffset = function (level) {
  const branchingFactor = this._branchingFactor;
  return (Math.pow(branchingFactor, level) - 1) / (branchingFactor - 1);
};

/**
 * 获取瓦片父节点的莫顿索引。这相当于
 * 截取莫顿索引的最后 2（四叉树）或 3（八叉树）位
 * 索引。
 *
 * @param {number} childIndex 子瓦片相对于其父节点的莫顿索引
 * @returns {number} The 子节点父节点的索引
 * @private
 */
ImplicitSubtree.prototype.getParentMortonIndex = function (mortonIndex) {
  let bitsPerLevel = 2;
  if (this._subdivisionScheme === ImplicitSubdivisionScheme.OCTREE) {
    bitsPerLevel = 3;
  }

  return mortonIndex >> bitsPerLevel;
};

/**
 * 从子树中解析所有相关信息。这会获取任何
 * 隐式瓦片集使用的外部缓冲区。
 *
 * @param {Resource} resource 该子树的资源。用于按需获取外部缓冲区。
 * @param {object} [json] 该子树的 JSON 对象。如果从二进制子树文件解析，则此值将为空。
 * @param {Uint8Array} [subtreeView] 子树二进制数据的内容
 * @param {ImplicitTileset} implicitTileset 该子树所属的隐式瓦片集。
 * @param {ImplicitTileCoordinates} implicitCoordinates 子树根瓦片的坐标。
 * @return {Promise<ImplicitSubtree>} The 创建的子树
 * @private
 *
 * @exception {DeveloperError} One 必须定义 json 和 subtreeView。
 */
ImplicitSubtree.fromSubtreeJson = async function (
  resource,
  json,
  subtreeView,
  implicitTileset,
  implicitCoordinates,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("resource", resource);
  if (defined(json) === defined(subtreeView)) {
    throw new DeveloperError("One of json and subtreeView must be defined.");
  }
  Check.typeOf.object("implicitTileset", implicitTileset);
  Check.typeOf.object("implicitCoordinates", implicitCoordinates);
  //>>includeEnd('debug');

  const subtree = new ImplicitSubtree(
    resource,
    implicitTileset,
    implicitCoordinates,
  );

  let chunks;
  if (defined(json)) {
    chunks = {
      json: json,
      binary: undefined,
    };
  } else {
    chunks = parseSubtreeChunks(subtreeView);
  }

  await parseSubtree(
    subtree,
    chunks.json,
    chunks.binary,
    implicitTileset,
    implicitTileset.metadataSchema,
  );
  return subtree;
};

/**
 * 从以 glTF JSON 格式存储的子树中解析所有相关信息，使用
 * <code>3DTILES_subtree</code> 扩展。这会获取任何外部缓冲区以及
 * 如果引用了，则获取元数据模式。
 *
 * @param {Resource} resource 该子树的资源。用于按需获取外部缓冲区和模式。
 * @param {object} gltf 该子树的 glTF JSON 对象。其所有缓冲区都必须具有 <code>uri</code>。
 * @param {ImplicitTileset} implicitTileset 该子树所属的隐式瓦片集。
 * @param {ImplicitTileCoordinates} implicitCoordinates 子树根瓦片的坐标。
 * @return {Promise<ImplicitSubtree>} The 创建的子树
 * @private
 */
ImplicitSubtree.fromSubtreeGltf = async function (
  resource,
  gltf,
  implicitTileset,
  implicitCoordinates,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("resource", resource);
  Check.typeOf.object("gltf", gltf);
  Check.typeOf.object("implicitTileset", implicitTileset);
  Check.typeOf.object("implicitCoordinates", implicitCoordinates);
  //>>includeEnd('debug');

  const subtree = new ImplicitSubtree(
    resource,
    implicitTileset,
    implicitCoordinates,
  );

  const { subtreeJson, metadataSchema } = await convertGltfToSubtreeJson(
    resource,
    gltf,
  );
  await parseSubtree(
    subtree,
    subtreeJson,
    undefined,
    implicitTileset,
    metadataSchema,
  );
  return subtree;
};

/**
 * 从以二进制 glTF (glb) 格式存储的子树中解析所有相关信息，使用
 * <code>3DTILES_subtree</code> 扩展。这会获取任何外部
 * 缓冲区以及如果引用了，则获取元数据模式。
 *
 * @param {Resource} resource 此子树所需的资源。用于按需获取外部缓冲区和模式。
 * @param {Uint8Array} glbView glb 的内容
 * @param {ImplicitTileset} implicitTileset 此子树所属的隐含瓦片集。
 * @param {ImplicitTileCoordinates} implicitCoordinates 子树的根瓦片坐标。
 * @return {Promise<ImplicitSubtree>} The 创建的子树
 * @private
 */
ImplicitSubtree.fromSubtreeGlb = async function (
  resource,
  glbView,
  implicitTileset,
  implicitCoordinates,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("resource", resource);
  Check.typeOf.object("glbView", glbView);
  Check.typeOf.object("implicitTileset", implicitTileset);
  Check.typeOf.object("implicitCoordinates", implicitCoordinates);
  //>>includeEnd('debug');

  const subtree = new ImplicitSubtree(
    resource,
    implicitTileset,
    implicitCoordinates,
  );

  const chunks = parseGlbChunks(glbView);
  const { subtreeJson, metadataSchema } = await convertGltfToSubtreeJson(
    resource,
    chunks.json,
  );
  await parseSubtree(
    subtree,
    subtreeJson,
    chunks.binary,
    implicitTileset,
    metadataSchema,
  );
  return subtree;
};

/**
 * 使用 <code>3DTILES_subtree</code> 扩展将 glTF 的 JSON 转换为子树 JSON，并从 glTF 中加载元数据模式
 * <code>EXT_structural_metadata</code> 扩展。
 * glTF 所需的资源。用于获取外部模式。
 *
 * @param {Resource} resource The resource for the glTF. This is used for fetching an external schema.
 * @param {object} gltf glTF JSON
 * @returns {Promise<{subtreeJson: object, metadataSchema: (MetadataSchema|undefined)}>} 子树 JSON 和模式，当 glTF 未定义时则为 undefined。
 * @private
 */
async function convertGltfToSubtreeJson(resource, gltf) {
  const subtreeExtension = gltf.extensions["3DTILES_subtree"];
  const subtreeJson = {
    tileAvailability: subtreeExtension.tileAvailability,
    contentAvailability: subtreeExtension.contentAvailability,
    childSubtreeAvailability: subtreeExtension.childSubtreeAvailability,
    buffers: gltf.buffers,
    bufferViews: gltf.bufferViews,
  };

  if (defined(subtreeExtension.tileProperties)) {
    subtreeJson.tileMetadata = subtreeExtension.tileProperties;
  }

  if (defined(subtreeExtension.contentProperties)) {
    subtreeJson.contentMetadata = [subtreeExtension.contentProperties];
  }

  let metadataSchema;
  if (hasExtension(gltf, "EXT_structural_metadata")) {
    const metadataJson = gltf.extensions["EXT_structural_metadata"];
    subtreeJson.propertyTables = metadataJson.propertyTables;
    metadataSchema = await loadMetadataSchema(resource, metadataJson);
  }

  return { subtreeJson, metadataSchema };
}

/**
 * 加载 <code>EXT_structural_metadata</code> 扩展的模式，该模式
 * 要么在代码中定义，要么存储在外部文件中。
 *
 * @param {Resource} resource 用于解析外部模式 URI 的资源。
 * @param {object} metadataJson <code>EXT_structural_metadata</code> 扩展 JSON
 * @returns {Promise<MetadataSchema|undefined>} The 模式，如果扩展未定义则为 <code>undefined</code>。
 * @private
 */
async function loadMetadataSchema(resource, metadataJson) {
  let schemaLoader;
  if (defined(metadataJson.schemaUri)) {
    const schemaResource = resource.getDerivedResource({
      url: metadataJson.schemaUri,
    });
    schemaLoader = ResourceCache.getSchemaLoader({ resource: schemaResource });
  } else if (defined(metadataJson.schema)) {
    schemaLoader = ResourceCache.getSchemaLoader({
      schema: metadataJson.schema,
    });
  } else {
    return undefined;
  }

  await schemaLoader.load();
  const schema = schemaLoader.schema;
  ResourceCache.unload(schemaLoader);
  return schema;
}

/**
 * 解析子树的可用性、缓冲区和元数据，并将结果存储于子树中。
 * 要填充的子树
 *
 * @param {ImplicitSubtree} subtree The subtree to populate
 * @param {object} subtreeJson 子树 JSON
 * @param {Uint8Array} [internalBuffer] 子树的内部缓冲区。当子树没有内部缓冲区时则为 undefined。
 * @param {ImplicitTileset} implicitTileset 此子树所属的隐含瓦片集。
 * @param {MetadataSchema} [metadataSchema] 子树元数据类所查找的模式。
 * @returns {Promise<void>}
 * @private
 */
async function parseSubtree(
  subtree,
  subtreeJson,
  internalBuffer,
  implicitTileset,
  metadataSchema,
) {
  subtree._subtreeJson = subtreeJson;

  let tilePropertyTableJson;
  if (hasExtension(subtreeJson, "3DTILES_metadata")) {
    tilePropertyTableJson = subtreeJson.extensions["3DTILES_metadata"];
  } else if (defined(subtreeJson.tileMetadata)) {
    const propertyTableIndex = subtreeJson.tileMetadata;
    tilePropertyTableJson = subtreeJson.propertyTables[propertyTableIndex];
  }

  const contentPropertyTableJsons = [];
  if (defined(subtreeJson.contentMetadata)) {
    const length = subtreeJson.contentMetadata.length;
    for (let i = 0; i < length; i++) {
      const propertyTableIndex = subtreeJson.contentMetadata[i];
      contentPropertyTableJsons.push(
        subtreeJson.propertyTables[propertyTableIndex],
      );
    }
  }

  let metadata;
  const subtreeMetadata = subtreeJson.subtreeMetadata;
  if (defined(subtreeMetadata)) {
    const metadataClass = subtreeMetadata.class;
    const subtreeMetadataClass = metadataSchema.classes[metadataClass];
    metadata = new ImplicitSubtreeMetadata({
      subtreeMetadata: subtreeMetadata,
      class: subtreeMetadataClass,
    });
  }

  subtree._metadata = metadata;
  subtree._tilePropertyTableJson = tilePropertyTableJson;
  subtree._contentPropertyTableJsons = contentPropertyTableJsons;

  // if no contentAvailability is specified, no tile in the subtree has
  // content
  const defaultContentAvailability = {
    constant: 0,
  };

  // In 3D Tiles 1.1, content availability is provided in an array in the subtree JSON
  // regardless of whether or not it contains multiple contents. This differs from previous
  // schemas, where content availability is either a single object in the subtree JSON or
  // as an array in the 3DTILES_multiple_contents extension.
  //
  // After identifying how availability is stored, put the results in this new array for consistent processing later
  subtreeJson.contentAvailabilityHeaders = [];
  if (hasExtension(subtreeJson, "3DTILES_multiple_contents")) {
    subtreeJson.contentAvailabilityHeaders =
      subtreeJson.extensions["3DTILES_multiple_contents"].contentAvailability;
  } else if (Array.isArray(subtreeJson.contentAvailability)) {
    subtreeJson.contentAvailabilityHeaders = subtreeJson.contentAvailability;
  } else {
    subtreeJson.contentAvailabilityHeaders.push(
      subtreeJson.contentAvailability ?? defaultContentAvailability,
    );
  }

  const bufferHeaders = preprocessBuffers(subtreeJson.buffers);
  const bufferViewHeaders = preprocessBufferViews(
    subtreeJson.bufferViews,
    bufferHeaders,
  );

  // Buffers and buffer views are inactive until explicitly marked active.
  // This way we can avoid fetching buffers that will not be used.
  markActiveBufferViews(subtreeJson, bufferViewHeaders);
  if (defined(tilePropertyTableJson)) {
    markActiveMetadataBufferViews(tilePropertyTableJson, bufferViewHeaders);
  }

  for (let i = 0; i < contentPropertyTableJsons.length; i++) {
    const contentPropertyTableJson = contentPropertyTableJsons[i];
    markActiveMetadataBufferViews(contentPropertyTableJson, bufferViewHeaders);
  }

  const buffersU8 = await requestActiveBuffers(
    subtree,
    bufferHeaders,
    internalBuffer,
  );
  const bufferViewsU8 = parseActiveBufferViews(bufferViewHeaders, buffersU8);
  parseAvailability(subtree, subtreeJson, implicitTileset, bufferViewsU8);

  if (defined(tilePropertyTableJson)) {
    parseTileMetadataTable(subtree, metadataSchema, bufferViewsU8);
    makeTileJumpBuffer(subtree);
  }

  parseContentMetadataTables(subtree, metadataSchema, bufferViewsU8);
  makeContentJumpBuffers(subtree);

  subtree._ready = true;
}

/**
 * 用于存储子树二进制两部分的辅助对象
 *
 * @typedef {object} SubtreeChunks
 * @property {object} json 子树的 json 数据块
 * @property {Uint8Array} binary 子树的二进制数据块。这代表内部缓冲区。
 * @private
 */

/**
 * 根据子树的二进制内容，将其分割为 JSON 和二进制数据块
 *
 * @param {Uint8Array} subtreeView 子树二进制
 * @returns {SubtreeChunks} An 包含 JSON 和二进制数据块的对象。
 * @private
 */
function parseSubtreeChunks(subtreeView) {
  // Parse the header
  const littleEndian = true;
  const subtreeReader = new DataView(
    subtreeView.buffer,
    subtreeView.byteOffset,
  );
  // Skip to the chunk lengths
  let byteOffset = 8;

  // Read the bottom 32 bits of the 64-bit byte length. This is ok for now because:
  // 1) not all browsers have native 64-bit operations
  // 2) the data is well under 4GB
  const jsonByteLength = subtreeReader.getUint32(byteOffset, littleEndian);
  byteOffset += 8;
  const binaryByteLength = subtreeReader.getUint32(byteOffset, littleEndian);
  byteOffset += 8;

  const subtreeJson = getJsonFromTypedArray(
    subtreeView,
    byteOffset,
    jsonByteLength,
  );
  byteOffset += jsonByteLength;
  const subtreeBinary = subtreeView.subarray(
    byteOffset,
    byteOffset + binaryByteLength,
  );

  return {
    json: subtreeJson,
    binary: subtreeBinary,
  };
}

const glbJsonChunkType = 0x4e4f534a;
const glbBinaryChunkType = 0x004e4942;

/**
 * 根据 glb 的二进制内容，将其分割为 JSON 和二进制数据块
 *
 * @param {Uint8Array} glbView glb 二进制
 * @returns {{json: object, binary: (Uint8Array|undefined)}} 包含 JSON 数据块和二进制数据块的对象，如果 glb 没有则为空。
 * @private
 */
function parseGlbChunks(glbView) {
  const littleEndian = true;
  const glbReader = new DataView(
    glbView.buffer,
    glbView.byteOffset,
    glbView.byteLength,
  );

  // Skip the magic and version to read the total byte length
  const glbByteLength = Math.min(
    glbReader.getUint32(8, littleEndian),
    glbView.byteLength,
  );
  let byteOffset = 12;

  let json;
  let binary;
  while (byteOffset + 8 <= glbByteLength) {
    const chunkByteLength = glbReader.getUint32(byteOffset, littleEndian);
    const chunkType = glbReader.getUint32(byteOffset + 4, littleEndian);
    byteOffset += 8;

    if (chunkType === glbJsonChunkType) {
      json = getJsonFromTypedArray(glbView, byteOffset, chunkByteLength);
    } else if (chunkType === glbBinaryChunkType) {
      binary = glbView.subarray(byteOffset, byteOffset + chunkByteLength);
    }
    byteOffset += chunkByteLength;
  }

  if (!defined(json)) {
    throw new RuntimeError("Invalid glb: no JSON chunk found.");
  }

  return {
    json: json,
    binary: binary,
  };
}

/**
 * 缓冲区头是来自子树 JSON 数据块的 JSON 头加上
 * 几个额外的布尔标志以便轻松参考。
 *
 * 假设缓冲区在明确标记为活动之前处于非活动状态。这用于
 * 避免获取不必要的缓冲区。
 *
 * @typedef {object} BufferHeader
 * @property {boolean} isExternal 如果这是外部缓冲区，则为 true
 * @property {boolean} isActive 此缓冲区当前是否正在使用。
 * @property {string} [uri] 缓冲区的 URI（仅限外部缓冲区）
 * @property {number} byteLength 缓冲区的字节长度，包括其中的任何填充内容。
 * @private
 */

/**
 * 遍历子树 JSON 中的缓冲区列表，并添加 isExternal 和 isActive 字段以便后续更轻松解析。这会修改
 * isExternal and isActive fields for easier parsing later. This modifies
 * 位于该位置的对象。
 *
 * @param {object[]} [bufferHeaders=[]] subtreeJson.buffers 中的 JSON 数据。
 * @returns {BufferHeader[]} The 包含额外字段的相同头部数组。
 * @private
 */
function preprocessBuffers(bufferHeaders) {
  bufferHeaders = defined(bufferHeaders) ? bufferHeaders : [];
  for (let i = 0; i < bufferHeaders.length; i++) {
    const bufferHeader = bufferHeaders[i];
    bufferHeader.isExternal = defined(bufferHeader.uri);
    bufferHeader.isActive = false;
  }

  return bufferHeaders;
}

/**
 * 缓冲区头部是 subtree JSON 块中的 JSON 头部，加上
 * isActive 标志以及指向底层缓冲头的引用。
 *
 * @typedef {object} BufferViewHeader
 * @property {BufferHeader} bufferHeader 指向底层缓冲头的引用。
 * @property {boolean} isActive 当前是否使用此 bufferView。
 * @property {number} buffer 底层缓冲头的索引。
 * @property {number} byteOffset bufferView 在缓冲区中的起始字节。
 * @property {number} byteLength bufferView 的长度。此长度不包含填充部分。
 * @private
 */

/**
 * 从 subtree JSON 中遍历 bufferView 列表，并添加
 * isActive 标志。同时保存对 bufferHeader 的引用。
 *
 * @param {object[]} [bufferViewHeaders=[]] subtree.bufferViews 中的 JSON 数据。
 * @param {BufferHeader[]} bufferHeaders 预处理后的缓冲区头部。
 * @returns {BufferViewHeader[]} The 包含额外字段的相同 bufferView 头部数组。
 * @private
 */
function preprocessBufferViews(bufferViewHeaders, bufferHeaders) {
  bufferViewHeaders = defined(bufferViewHeaders) ? bufferViewHeaders : [];
  for (let i = 0; i < bufferViewHeaders.length; i++) {
    const bufferViewHeader = bufferViewHeaders[i];
    const bufferHeader = bufferHeaders[bufferViewHeader.buffer];
    bufferViewHeader.bufferHeader = bufferHeader;
    bufferViewHeader.isActive = false;
  }
  return bufferViewHeaders;
}

/**
 * 确定哪些 bufferView 需要加载到内存中。包括：
 *
 * <ul>
 * <li>瓦片可用位流（如果定义了位流）</li>
 * <li>内容可用位流（如果定义了位流）</li>
 * <li>子子树可用位流（如果定义了位流）</li>
 * </ul>
 *
 * <p>
 * 此函数会直接修改 bufferView 头部的 isActive 标志。
 * </p>
 *
 * @param {object[]} subtreeJson subtree 中的 JSON 块。
 * @param {BufferViewHeader[]} bufferViewHeaders 预处理后的 bufferView 头部。
 * @private
 */
function markActiveBufferViews(subtreeJson, bufferViewHeaders) {
  let header;
  const tileAvailabilityHeader = subtreeJson.tileAvailability;

  // Check for bitstream first, which is part of the current schema.
  // bufferView is the name of the bitstream from an older schema.
  if (defined(tileAvailabilityHeader.bitstream)) {
    header = bufferViewHeaders[tileAvailabilityHeader.bitstream];
  } else if (defined(tileAvailabilityHeader.bufferView)) {
    header = bufferViewHeaders[tileAvailabilityHeader.bufferView];
  }

  if (defined(header)) {
    header.isActive = true;
    header.bufferHeader.isActive = true;
  }

  const contentAvailabilityHeaders = subtreeJson.contentAvailabilityHeaders;
  for (let i = 0; i < contentAvailabilityHeaders.length; i++) {
    header = undefined;
    if (defined(contentAvailabilityHeaders[i].bitstream)) {
      header = bufferViewHeaders[contentAvailabilityHeaders[i].bitstream];
    } else if (defined(contentAvailabilityHeaders[i].bufferView)) {
      header = bufferViewHeaders[contentAvailabilityHeaders[i].bufferView];
    }

    if (defined(header)) {
      header.isActive = true;
      header.bufferHeader.isActive = true;
    }
  }

  header = undefined;
  const childSubtreeAvailabilityHeader = subtreeJson.childSubtreeAvailability;
  if (defined(childSubtreeAvailabilityHeader.bitstream)) {
    header = bufferViewHeaders[childSubtreeAvailabilityHeader.bitstream];
  } else if (defined(childSubtreeAvailabilityHeader.bufferView)) {
    header = bufferViewHeaders[childSubtreeAvailabilityHeader.bufferView];
  }

  if (defined(header)) {
    header.isActive = true;
    header.bufferHeader.isActive = true;
  }
}

/**
 * 处理元数据时，查看瓦片和内容元数据缓冲区。
 * <p>
 * 此功能会立即加载所有元数据。后续迭代可能
 * 允许过滤这些元数据，避免下载不必要的缓冲区。
 * </p>
 *
 * @param {object} propertyTableJson 瓦片或某些内容的属性表 JSON。
 * @param {BufferViewHeader[]} bufferViewHeaders 预处理后的 bufferView 头部。
 * @private
 */
function markActiveMetadataBufferViews(propertyTableJson, bufferViewHeaders) {
  const properties = propertyTableJson.properties;
  let header;
  for (const key in properties) {
    if (properties.hasOwnProperty(key)) {
      const metadataHeader = properties[key];

      // An older spec used bufferView
      const valuesBufferView =
        metadataHeader.values ?? metadataHeader.bufferView;
      header = bufferViewHeaders[valuesBufferView];
      header.isActive = true;
      header.bufferHeader.isActive = true;

      // An older spec used stringOffsetBufferView
      const stringOffsetBufferView =
        metadataHeader.stringOffsets ?? metadataHeader.stringOffsetBufferView;
      if (defined(stringOffsetBufferView)) {
        header = bufferViewHeaders[stringOffsetBufferView];
        header.isActive = true;
        header.bufferHeader.isActive = true;
      }

      // an older spec used arrayOffsetBufferView
      const arrayOffsetBufferView =
        metadataHeader.arrayOffsets ?? metadataHeader.arrayOffsetBufferView;
      if (defined(arrayOffsetBufferView)) {
        header = bufferViewHeaders[arrayOffsetBufferView];
        header.isActive = true;
        header.bufferHeader.isActive = true;
      }
    }
  }
}

/**
 * 遍历缓冲区列表，将所有活动缓冲区收集到一个
 * 字典中。由于允许外部缓冲区，这有时涉及
 * 获取单独的二进制文件。因此，此方法返回一个承诺。
 * <p>
 * 结果被放入字典对象中。键是缓冲头的索引，值是内容的 Uint8Array。只有
 * 带有 isActive 标志的缓冲区才会被获取。
 * 如果内部缓冲区（subtree 的二进制块）被标记为活动，它也会存储在此
 * </p>
 * <p>
 * 内部缓冲区（subtree 的二进制块）如果被标记为活动，也会存储在此
 * 字典中。
 * </p>
 * @param {ImplicitSubtree} subtree subtree
 * @param {BufferHeader[]} bufferHeaders 预处理后的缓冲区头部。
 * @param {Uint8Array} internalBuffer subtree 文件的二进制块。
 * @returns {Promise<object>} A 承诺解析为包含活动缓冲头的字典。
 * @private
 */
function requestActiveBuffers(subtree, bufferHeaders, internalBuffer) {
  const promises = [];
  for (let i = 0; i < bufferHeaders.length; i++) {
    const bufferHeader = bufferHeaders[i];
    if (!bufferHeader.isActive) {
      promises.push(Promise.resolve(undefined));
    } else if (bufferHeader.isExternal) {
      const promise = requestExternalBuffer(subtree, bufferHeader);
      promises.push(promise);
    } else {
      promises.push(Promise.resolve(internalBuffer));
    }
  }
  return Promise.all(promises).then(function (bufferResults) {
    const buffersU8 = {};
    for (let i = 0; i < bufferResults.length; i++) {
      const result = bufferResults[i];
      if (defined(result)) {
        buffersU8[i] = result;
      }
    }
    return buffersU8;
  });
}

async function requestExternalBuffer(subtree, bufferHeader) {
  const baseResource = subtree._resource;
  const bufferResource = baseResource.getDerivedResource({
    url: bufferHeader.uri,
  });

  const bufferLoader = ResourceCache.getExternalBufferLoader({
    resource: bufferResource,
  });
  subtree._bufferLoader = bufferLoader;

  try {
    await bufferLoader.load();
  } catch (error) {
    if (bufferLoader.isDestroyed()) {
      return;
    }

    throw error;
  }

  return bufferLoader.typedArray;
}

/**
 * 遍历 bufferView 列表，如果它们被标记为活动，
 * 从其中一个活动缓冲区中提取子数组。
 *
 * @param {BufferViewHeader[]} bufferViewHeaders
 * @param {object} buffersU8 将缓冲区索引映射到其内容 Uint8Array 的字典。
 * @returns {object} A 将缓冲区视图索引映射到其内容 Uint8Array 的字典。
 * @private
 */
function parseActiveBufferViews(bufferViewHeaders, buffersU8) {
  const bufferViewsU8 = {};
  for (let i = 0; i < bufferViewHeaders.length; i++) {
    const bufferViewHeader = bufferViewHeaders[i];

    if (!bufferViewHeader.isActive) {
      continue;
    }

    const start = bufferViewHeader.byteOffset ?? 0;
    const end = start + bufferViewHeader.byteLength;
    const buffer = buffersU8[bufferViewHeader.buffer];
    const bufferView = buffer.subarray(start, end);
    bufferViewsU8[i] = bufferView;
  }
  return bufferViewsU8;
}

/**
 * 解析三个可用性位流并将其存储在子树中。
 *
 * @param {ImplicitSubtree} subtree 要修改的子树。
 * @param {object} subtreeJson 子树的 JSON 格式。
 * @param {ImplicitTileset} implicitTileset 该子树所属的隐含瓦片集。
 * @param {object} bufferViewsU8 将缓冲区视图索引映射到其内容 Uint8Array 的字典。
 * @private
 */
function parseAvailability(
  subtree,
  subtreeJson,
  implicitTileset,
  bufferViewsU8,
) {
  const branchingFactor = implicitTileset.branchingFactor;
  const subtreeLevels = implicitTileset.subtreeLevels;
  const tileAvailabilityBits =
    (Math.pow(branchingFactor, subtreeLevels) - 1) / (branchingFactor - 1);
  const childSubtreeBits = Math.pow(branchingFactor, subtreeLevels);

  // availableCount is only needed for the metadata jump buffer, which
  // corresponds to the tile availability bitstream.
  const hasMetadataExtension = hasExtension(subtreeJson, "3DTILES_metadata");
  const hasTileMetadata = defined(subtree._tilePropertyTableJson);
  let computeAvailableCountEnabled = hasMetadataExtension || hasTileMetadata;

  subtree._tileAvailability = parseAvailabilityBitstream(
    subtreeJson.tileAvailability,
    bufferViewsU8,
    tileAvailabilityBits,
    computeAvailableCountEnabled,
  );

  const hasContentMetadata = subtree._contentPropertyTableJsons.length > 0;
  computeAvailableCountEnabled =
    computeAvailableCountEnabled || hasContentMetadata;

  for (let i = 0; i < subtreeJson.contentAvailabilityHeaders.length; i++) {
    const bitstream = parseAvailabilityBitstream(
      subtreeJson.contentAvailabilityHeaders[i],
      bufferViewsU8,
      // content availability has the same length as tile availability.
      tileAvailabilityBits,
      computeAvailableCountEnabled,
    );
    subtree._contentAvailabilityBitstreams.push(bitstream);
  }

  subtree._childSubtreeAvailability = parseAvailabilityBitstream(
    subtreeJson.childSubtreeAvailability,
    bufferViewsU8,
    childSubtreeBits,
  );
}

/**
 * 根据描述可用性位流的 JSON 数据，将其转换为
 * 使用 {@link ImplicitAvailabilityBitstream} 的
 * 对象形式的内存表示。这能处理常量和 bufferView 中的位流。
 *
 * @param {object} availabilityJson 表示可用性的 JSON 对象。
 * @param {object} bufferViewsU8 将 bufferView 索引映射到其 Uint8Array 内容的字典。
 * @param {number} lengthBits 可用性位流的位数。
 * @param {boolean} [computeAvailableCountEnabled] 如果为 true 且 availabilityJson.availableCount 未定义，则计算 availableCount。
 * @returns {ImplicitAvailabilityBitstream} The 解析后的位流对象。
 * @private
 */
function parseAvailabilityBitstream(
  availabilityJson,
  bufferViewsU8,
  lengthBits,
  computeAvailableCountEnabled,
) {
  if (defined(availabilityJson.constant)) {
    return new ImplicitAvailabilityBitstream({
      constant: Boolean(availabilityJson.constant),
      lengthBits: lengthBits,
      availableCount: availabilityJson.availableCount,
    });
  }

  let bufferView;

  // Check for bitstream first, which is part of the current schema.
  // bufferView is the name of the bitstream from an older schema.
  if (defined(availabilityJson.bitstream)) {
    bufferView = bufferViewsU8[availabilityJson.bitstream];
  } else if (defined(availabilityJson.bufferView)) {
    bufferView = bufferViewsU8[availabilityJson.bufferView];
  }

  return new ImplicitAvailabilityBitstream({
    bitstream: bufferView,
    lengthBits: lengthBits,
    availableCount: availabilityJson.availableCount,
    computeAvailableCountEnabled: computeAvailableCountEnabled,
  });
}

/**
 * 解析瓦片元数据的元数据表，并存储一个 {@link MetadataTable} 在子树中。
 * 在子树中。
 *
 * @param {ImplicitSubtree} subtree 子树。
 * @param {MetadataSchema} metadataSchema 包含瓦片元数据类的模式。
 * @param {object} bufferViewsU8 将 bufferView 索引映射到其 Uint8Array 内容的字典。
 * @private
 */
function parseTileMetadataTable(subtree, metadataSchema, bufferViewsU8) {
  const tilePropertyTableJson = subtree._tilePropertyTableJson;
  const tileCount = subtree._tileAvailability.availableCount;

  const tileMetadataClassName = tilePropertyTableJson.class;
  const tileMetadataClass = metadataSchema.classes[tileMetadataClassName];

  subtree._tileMetadataTable = new MetadataTable({
    class: tileMetadataClass,
    count: tileCount,
    properties: tilePropertyTableJson.properties,
    bufferViews: bufferViewsU8,
  });
}

/**
 * 解析内容元数据的元数据表，并存储一个数组
 * 在子树中的 {@link MetadataTable}。
 *
 * @param {ImplicitSubtree} subtree 子树。
 * @param {MetadataSchema} metadataSchema 包含内容元数据类的模式。
 * @param {object} bufferViewsU8 将 bufferView 索引映射到其 Uint8Array 内容的字典。
 * @private
 */
function parseContentMetadataTables(subtree, metadataSchema, bufferViewsU8) {
  const contentPropertyTableJsons = subtree._contentPropertyTableJsons;
  const contentAvailabilityBitstreams = subtree._contentAvailabilityBitstreams;

  const contentMetadataTables = subtree._contentMetadataTables;
  for (let i = 0; i < contentPropertyTableJsons.length; i++) {
    const contentPropertyTableJson = contentPropertyTableJsons[i];
    const contentAvailabilityBitsteam = contentAvailabilityBitstreams[i];

    const contentCount = contentAvailabilityBitsteam.availableCount;
    const contentMetadataClassName = contentPropertyTableJson.class;
    const contentMetadataClass =
      metadataSchema.classes[contentMetadataClassName];

    const metadataTable = new MetadataTable({
      class: contentMetadataClass,
      count: contentCount,
      properties: contentPropertyTableJson.properties,
      bufferViews: bufferViewsU8,
    });

    contentMetadataTables.push(metadataTable);
  }
}

/**
 * 创建跳转缓冲区，即位索引到元数据实体 ID 的映射表。
 * <p>
 * 对于不可用的瓦片和内容，跳转缓冲区条目将处于未初始化状态。
 * 使用瓦片和内容的可用性来确定跳转缓冲区值是否有效。
 * </p>
 *
 * @param {ImplicitAvailabilityBitstream} availability 用于从可用性位流创建跳转缓冲区的位流。
 * @returns {Array} The 生成的跳转缓冲区。
 * @private
 */
function makeJumpBuffer(availability) {
  let entityId = 0;
  const bufferLength = availability.lengthBits;
  const availableCount = availability.availableCount;

  let jumpBuffer;
  if (availableCount < 256) {
    jumpBuffer = new Uint8Array(bufferLength);
  } else if (availableCount < 65536) {
    jumpBuffer = new Uint16Array(bufferLength);
  } else {
    jumpBuffer = new Uint32Array(bufferLength);
  }

  for (let i = 0; i < availability.lengthBits; i++) {
    if (availability.getBit(i)) {
      jumpBuffer[i] = entityId;
      entityId++;
    }
  }

  return jumpBuffer;
}

/**
 * 创建跳转缓冲区，即位索引到元数据实体 ID 的映射表，
 * 用于内容元数据。这存储在子树中。
 *
 * @param {ImplicitSubtree} subtree 子树。
 * @private
 */
function makeTileJumpBuffer(subtree) {
  const tileJumpBuffer = makeJumpBuffer(subtree._tileAvailability);
  subtree._tileJumpBuffer = tileJumpBuffer;
}

/**
 * 创建跳转缓冲区，即位索引到元数据实体 ID 的映射表，
 * 用于内容元数据。这存储在子树中。
 *
 * @param {ImplicitSubtree} subtree 子树。
 * @private
 */
function makeContentJumpBuffers(subtree) {
  const contentJumpBuffers = subtree._contentJumpBuffers;
  const contentAvailabilityBitstreams = subtree._contentAvailabilityBitstreams;
  for (let i = 0; i < contentAvailabilityBitstreams.length; i++) {
    const contentAvailability = contentAvailabilityBitstreams[i];
    const contentJumpBuffer = makeJumpBuffer(contentAvailability);
    contentJumpBuffers.push(contentJumpBuffer);
  }
}

/**
 * 给定瓦片的隐含 tiling 坐标，获取在
 * 子树的瓦片可用性位流中的索引。
 * @param {ImplicitTileCoordinates} implicitCoordinates 瓦片的全局坐标。
 * @return {number} The 子树中瓦片的索引。
 * @private
 */
ImplicitSubtree.prototype.getTileIndex = function (implicitCoordinates) {
  const localLevel =
    implicitCoordinates.level - this._implicitCoordinates.level;
  if (localLevel < 0 || this._subtreeLevels <= localLevel) {
    throw new RuntimeError("level is out of bounds for this subtree");
  }

  const subtreeCoordinates = implicitCoordinates.getSubtreeCoordinates();
  const offsetCoordinates =
    subtreeCoordinates.getOffsetCoordinates(implicitCoordinates);
  const index = offsetCoordinates.tileIndex;
  return index;
};

/**
 * 给定子树的隐含 tiling 坐标，获取在
 * 子树的子子树可用性位流中的索引。
 * @param {ImplicitTileCoordinates} implicitCoordinates 子树的全局坐标。
 * @return {number} The 该子树中的子子树在可用位流中的索引。
 * @private
 */
ImplicitSubtree.prototype.getChildSubtreeIndex = function (
  implicitCoordinates,
) {
  const localLevel =
    implicitCoordinates.level - this._implicitCoordinates.level;
  if (localLevel !== this._implicitCoordinates.subtreeLevels) {
    throw new RuntimeError("level is out of bounds for this subtree");
  }

  // Call getParentSubtreeCoordinates instead of getSubtreeCoordinates because the
  // child subtree is by definition the root of its own subtree, so we need to find
  // the parent subtree.
  const parentSubtreeCoordinates =
    implicitCoordinates.getParentSubtreeCoordinates();
  const offsetCoordinates =
    parentSubtreeCoordinates.getOffsetCoordinates(implicitCoordinates);
  const index = offsetCoordinates.mortonIndex;
  return index;
};

/**
 * 获取该子树中某个瓦片的实体 ID。
 * @param {ImplicitSubtree} subtree 子树
 * @param {ImplicitTileCoordinates} implicitCoordinates 瓦片的全局坐标
 * @return {number} The 用于访问瓦片元数据的实体 ID，若不适用则为 <code>undefined</code>。
 *
 * @private
 */
function getTileEntityId(subtree, implicitCoordinates) {
  if (!defined(subtree._tileMetadataTable)) {
    return undefined;
  }

  const tileIndex = subtree.getTileIndex(implicitCoordinates);
  if (subtree._tileAvailability.getBit(tileIndex)) {
    return subtree._tileJumpBuffer[tileIndex];
  }

  return undefined;
}

/**
 * 获取该子树中某个内容的实体 ID。
 * @param {ImplicitSubtree} subtree 子树
 * @param {ImplicitTileCoordinates} implicitCoordinates 内容的全局坐标
 * @param {number} contentIndex 内容索引，用于区分多个内容。
 * @return {number} The 用于访问内容元数据的实体 ID，若不适用则为 <code>undefined</code>。
 *
 * @private
 */
function getContentEntityId(subtree, implicitCoordinates, contentIndex) {
  const metadataTables = subtree._contentMetadataTables;
  if (!defined(metadataTables)) {
    return undefined;
  }

  const metadataTable = metadataTables[contentIndex];
  if (!defined(metadataTable)) {
    return undefined;
  }

  const availability = subtree._contentAvailabilityBitstreams[contentIndex];
  const tileIndex = subtree.getTileIndex(implicitCoordinates);
  if (availability.getBit(tileIndex)) {
    const contentJumpBuffer = subtree._contentJumpBuffers[contentIndex];
    return contentJumpBuffer[tileIndex];
  }

  return undefined;
}

/**
 * 创建并返回该子树中某个瓦片的元数据表视图。
 * @param {ImplicitTileCoordinates} implicitCoordinates 瓦片的全局坐标
 * @return {ImplicitMetadataView} The 该瓦片的元数据视图，若不适用则为 <code>undefined</code>。
 *
 * @private
 */
ImplicitSubtree.prototype.getTileMetadataView = function (implicitCoordinates) {
  const entityId = getTileEntityId(this, implicitCoordinates);
  if (!defined(entityId)) {
    return undefined;
  }

  const metadataTable = this._tileMetadataTable;
  return new ImplicitMetadataView({
    class: metadataTable.class,
    metadataTable: metadataTable,
    entityId: entityId,
    propertyTableJson: this._tilePropertyTableJson,
  });
};

/**
 * 创建并返回该子树中某个内容的元数据表视图。
 * @param {ImplicitTileCoordinates} implicitCoordinates 内容的全局坐标
 * @param {number} contentIndex 用于区分多个内容的内容索引
 * @return {ImplicitMetadataView} The 该内容的元数据视图，若不适用则为 <code>undefined</code>。
 *
 * @private
 */
ImplicitSubtree.prototype.getContentMetadataView = function (
  implicitCoordinates,
  contentIndex,
) {
  const entityId = getContentEntityId(this, implicitCoordinates, contentIndex);
  if (!defined(entityId)) {
    return undefined;
  }

  const metadataTable = this._contentMetadataTables[contentIndex];
  const propertyTableJson = this._contentPropertyTableJsons[contentIndex];
  return new ImplicitMetadataView({
    class: metadataTable.class,
    metadataTable: metadataTable,
    entityId: entityId,
    contentIndex: contentIndex,
    propertyTableJson: propertyTableJson,
  });
};

/**
 * @private
 */
ImplicitSubtree.prototype.isDestroyed = function () {
  return false;
};

/**
 * @private
 */
ImplicitSubtree.prototype.destroy = function () {
  if (defined(this._bufferLoader)) {
    ResourceCache.unload(this._bufferLoader);
  }

  return destroyObject(this);
};

export default ImplicitSubtree;
