import { Check, Frozen, defined } from "@cesium/core";
import ResourceCache from "../../../ResourceCache.js";
import ResourceLoader from "../../../ResourceLoader.js";
import ResourceLoaderState from "../../../ResourceLoaderState.js";
import PropertyTexture from "../../../PropertyTexture.js";
import StructuralMetadata from "../../../StructuralMetadata.js";
import MetadataSchema from "../../../MetadataSchema.js";
import PpeTexture from "./PpeTexture.js";
import PpeMetadata from "./PpeMetadata.js";
import MeshPrimitiveGpmLocal from "./MeshPrimitiveGpmLocal.js";

/**
 * 从 glTF 网格原语中加载 glTF NGA_gpm_local。
 * <p>
 * 实现 {@link ResourceLoader} 接口。
 * </p>
 * 此操作加载网格原语的 NGA_gpm_local 扩展的 "ppeTextures" 并将其存储在 `MeshPrimitiveGpmLocal` 对象中。
 * 该对象将被转换为 `StructuralMetadata` 对象，该对象可能
 *
 * 覆盖直接从 glTF 读取的任何 `StructuralMetadata`。
 * 具有以下属性：
 *
 * @alias GltfMeshPrimitiveGpmLoader
 * @constructor
 * @augments ResourceLoader
 *
 * @param {object} options glTF JSON 数据。
 * @param {object} options.gltf NGA_gpm_local 扩展对象。
 * @param {string} [options.extension] 包含 glTF 的 {@link Resource}。
 * @param {Resource} options.gltfResource 在 glTF JSON 中相对路径指向的 {@link Resource}。
 * @param {Resource} options.baseResource 支持的图像格式。
 * @param {SupportedImageFormats} options.supportedImageFormats 帧状态。
 * @param {FrameState} options.frameState 资源的缓存键。
 * @param {string} [options.cacheKey] 决定 WebGL 资源创建是分散在多个帧进行，还是一次性完成，直到所有 WebGL 资源都被创建。
 * @param {boolean} [options.asynchronous=true] 资源的缓存键。
 *
 * @private
 */
function GltfMeshPrimitiveGpmLoader(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const gltf = options.gltf;
  const extension = options.extension;
  const gltfResource = options.gltfResource;
  const baseResource = options.baseResource;
  const supportedImageFormats = options.supportedImageFormats;
  const frameState = options.frameState;
  const cacheKey = options.cacheKey;
  const asynchronous = options.asynchronous ?? true;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.gltf", gltf);
  Check.typeOf.object("options.extension", extension);
  Check.typeOf.object("options.gltfResource", gltfResource);
  Check.typeOf.object("options.baseResource", baseResource);
  Check.typeOf.object("options.supportedImageFormats", supportedImageFormats);
  Check.typeOf.object("options.frameState", frameState);
  //>>includeEnd('debug');

  this._gltfResource = gltfResource;
  this._baseResource = baseResource;
  this._gltf = gltf;
  this._extension = extension;
  this._supportedImageFormats = supportedImageFormats;
  this._frameState = frameState;
  this._cacheKey = cacheKey;
  this._asynchronous = asynchronous;
  this._textureLoaders = [];
  this._textureIds = [];
  this._meshPrimitiveGpmLocal = undefined;
  this._structuralMetadata = undefined;
  this._state = ResourceLoaderState.UNLOADED;
  this._promise = undefined;
}

if (defined(Object.create)) {
  GltfMeshPrimitiveGpmLoader.prototype = Object.create(
    ResourceLoader.prototype,
  );
  GltfMeshPrimitiveGpmLoader.prototype.constructor = GltfMeshPrimitiveGpmLoader;
}

Object.defineProperties(GltfMeshPrimitiveGpmLoader.prototype, {
  /**
   * 从网格原语中解析出的 GPM 扩展信息。
   *
   * @memberof GltfMeshPrimitiveGpmLoader.prototype
   *
   * @type {string}
   * @readonly
   * @private
   */
  cacheKey: {
    get: function () {
      return this._cacheKey;
    },
  },

  /**
   * 将解析后的 'MeshPrimitiveGpmLocal' 转换为 'StructuralMetadata' 的结果。
   *
   * @memberof GltfMeshPrimitiveGpmLoader.prototype
   *
   * @type {MeshPrimitiveGpmLocal}
   * @readonly
   * @private
   */
  meshPrimitiveGpmLocal: {
    get: function () {
      return this._meshPrimitiveGpmLocal;
    },
  },

  /**
   * 返回将解析后的 'MeshPrimitiveGpmLocal' 转换为 'StructuralMetadata' 的结果。
   * 关于转换的某些细节在此处未明确说明。
   *
   * 加载资源。
   *
   * @memberof GltfMeshPrimitiveGpmLoader.prototype
   *
   * @type {StructuralMetadata}
   * @readonly
   * @private
   */
  structuralMetadata: {
    get: function () {
      return this._structuralMetadata;
    },
  },
});

GltfMeshPrimitiveGpmLoader.prototype._loadResources = async function () {
  try {
    const texturesPromise = this._loadTextures();
    await texturesPromise;

    if (this.isDestroyed()) {
      return;
    }

    this._gltf = undefined; // No longer need to hold onto the glTF

    this._state = ResourceLoaderState.LOADED;
    return this;
  } catch (error) {
    if (this.isDestroyed()) {
      return;
    }

    this.unload();
    this._state = ResourceLoaderState.FAILED;
    const errorMessage = "Failed to load GPM data";
    throw this.getError(errorMessage, error);
  }
};

/**
 * 承诺，当资源加载完成时，该承诺将解析为加载器。
 * @returns {Promise<GltfMeshPrimitiveGpmLoader>} A PPE 纹理属性标识符键到 `MetadataSchema` 实例的静态映射。这用于仅在
 * @private
 */
GltfMeshPrimitiveGpmLoader.prototype.load = function () {
  if (defined(this._promise)) {
    return this._promise;
  }

  this._state = ResourceLoaderState.LOADING;
  this._promise = this._loadResources(this);
  return this._promise;
};

function gatherUsedTextureIds(gpmExtension) {
  // Gather the used textures
  const textureIds = {};
  const ppeTextures = gpmExtension.ppeTextures;
  if (defined(ppeTextures)) {
    for (let i = 0; i < ppeTextures.length; i++) {
      const ppeTexture = ppeTextures[i];
      // The texture is a valid textureInfo.
      textureIds[ppeTexture.index] = ppeTexture;
    }
  }
  return textureIds;
}

GltfMeshPrimitiveGpmLoader.prototype._loadTextures = function () {
  let textureIds;
  if (defined(this._extension)) {
    textureIds = gatherUsedTextureIds(this._extension);
  }

  const gltf = this._gltf;
  const gltfResource = this._gltfResource;
  const baseResource = this._baseResource;
  const supportedImageFormats = this._supportedImageFormats;
  const frameState = this._frameState;
  const asynchronous = this._asynchronous;

  // Load the textures
  const texturePromises = [];
  for (const textureId in textureIds) {
    if (textureIds.hasOwnProperty(textureId)) {
      const textureLoader = ResourceCache.getTextureLoader({
        gltf: gltf,
        textureInfo: textureIds[textureId],
        gltfResource: gltfResource,
        baseResource: baseResource,
        supportedImageFormats: supportedImageFormats,
        frameState: frameState,
        asynchronous: asynchronous,
      });
      this._textureLoaders.push(textureLoader);
      this._textureIds.push(textureId);
      texturePromises.push(textureLoader.load());
    }
  }

  return Promise.all(texturePromises);
};

/**
 * _obtainPpeTexturesMetadataSchema 中创建每个具有特定结构的模式一次。
 * 创建将给定的 PPE 纹理视为属性纹理属性的元数据类 JSON 描述。
 * - PPE 纹理
 * - 纹理在扩展中的索引
 *
 * @private
 */
GltfMeshPrimitiveGpmLoader.ppeTexturesMetadataSchemaCache = new Map();

/**
 * 类 JSON
 * 在给定 `MeshPrimitiveGpmLocal` 实例中，返回 PPE 纹理的 `MetadataSchema`。
 *
 * @param {PpeTexture} ppeTexture - PPE 纹理
 * @param {number} index - 纹理在扩展中的索引
 * @returns The 类 JSON
 */
GltfMeshPrimitiveGpmLoader._createPpeTextureClassJson = function (
  ppeTexture,
  index,
) {
  const traits = ppeTexture.traits;
  const ppePropertyName = traits.source;

  // The ppeTexture will have a structure like this:
  //
  //"ppeTextures" : [
  //  {
  //    "traits" : {
  //      "source" : "SIGZ",
  //      "min" : 0.0,
  //      "max" : 16.0
  //    },
  //    "index" : 2,
  //    "noData" : 255,
  //    "offset" : 0.0,
  //    "scale" : 0.06274509803921569,
  //    "texCoord" : 1
  //  },
  //
  // This is translated into a single class property here, that defines
  // the structure of the property texture property.
  //
  // Given that `offset` and `scale` may only be applied to integer
  // property values when they are `normalized`, the values will be
  // declared as `normalized` here.
  // The normalization factor will later have to be cancelled out,
  // with the `scale` being multiplied by 255.
  const offset = ppeTexture.offset ?? 0.0;
  const scale = (ppeTexture.scale ?? 1.0) * 255.0;
  const classJson = {
    name: `PPE texture class ${index}`,
    properties: {
      [ppePropertyName]: {
        name: "PPE",
        type: "SCALAR",
        componentType: "UINT8",
        normalized: true,
        offset: offset,
        scale: scale,
        min: traits.min,
        max: traits.max,
      },
    },
  };
  return classJson;
};

/**
 * 返回给定 `MeshPrimitiveGpmLocal` 实例中 PPE 纹理的 `MetadataSchema`。
 * 此方法将返回（静态/全局）缓存的元数据模式，该模式反映给定实例中的 PPE 纹理结构，并在必要时创建和缓存它。
 *
 * 有关缓存键的详细信息，请参阅 `_collectPpeTexturePropertyIdentifiers`。
 * 扩展对象
 * `MetadataSchema`
 *
 * 创建作为 PPE 纹理标识符的字符串数组。
 *
 * @param {MeshPrimitiveGpmLocal} meshPrimitiveGpmLocal 每个 glTF 可以在 `NGA_gpm_local` 扩展中定义多个 `ppeTexture` 对象。这些纹理中的每一个对应
 * @returns The 一个元数据模式中的“属性纹理属性”。
 */
GltfMeshPrimitiveGpmLoader._obtainPpeTexturesMetadataSchema = function (
  meshPrimitiveGpmLocal,
) {
  const ppeTexturePropertyIdentifiers =
    GltfMeshPrimitiveGpmLoader._collectPpeTexturePropertyIdentifiers(
      meshPrimitiveGpmLocal,
    );
  const key = ppeTexturePropertyIdentifiers.toString();
  let ppeTexturesMetadataSchema =
    GltfMeshPrimitiveGpmLoader.ppeTexturesMetadataSchemaCache.get(key);
  if (defined(ppeTexturesMetadataSchema)) {
    return ppeTexturesMetadataSchema;
  }

  const schemaId = `PPE_TEXTURE_SCHEMA_${GltfMeshPrimitiveGpmLoader.ppeTexturesMetadataSchemaCache.size}`;
  const ppeTexturesMetadataSchemaJson = {
    id: schemaId,
    classes: {},
  };

  const ppeTextures = meshPrimitiveGpmLocal.ppeTextures;
  for (let i = 0; i < ppeTextures.length; i++) {
    const ppeTexture = ppeTextures[i];
    const classId = `ppeTexture_${i}`;
    const classJson = GltfMeshPrimitiveGpmLoader._createPpeTextureClassJson(
      ppeTexture,
      i,
    );
    ppeTexturesMetadataSchemaJson.classes[classId] = classJson;
  }

  ppeTexturesMetadataSchema = MetadataSchema.fromJson(
    ppeTexturesMetadataSchemaJson,
  );
  GltfMeshPrimitiveGpmLoader.ppeTexturesMetadataSchemaCache.set(
    key,
    ppeTexturesMetadataSchema,
  );
  return ppeTexturesMetadataSchema;
};

/**
 * 此方法将创建一个数组，其中每个元素都是 (JSON) 数据。
 *
 * Each glTF may define multiple `ppeTexture` objects within the
 * `NGA_gpm_local` extensions. Each of these textures corresponds
 * to one 'property texture property' in a metadata schema.
 *
 * This method will create an array where each element is a (JSON)
 * GPM PPE 纹理定义部分的字符串表示形式
 * 用于根据 `StructuralMetadata` 中的结构区分两种 PPE 纹理的相关信息
 * 在 `StructuralMetadata` 中
 *
 * @param {MeshPrimitiveGpmLocal} meshPrimitiveGpmLocal 扩展对象
 * @returns The 标识符
 */
GltfMeshPrimitiveGpmLoader._collectPpeTexturePropertyIdentifiers = function (
  meshPrimitiveGpmLocal,
) {
  const ppeTexturePropertyIdentifiers = [];
  const ppeTextures = meshPrimitiveGpmLocal.ppeTextures;
  for (let i = 0; i < ppeTextures.length; i++) {
    const ppeTexture = ppeTextures[i];
    // The following will create an identifier that can be used
    // to define two PPE textures as "representing the same
    // property texture property" within a structural metadata
    // schema.
    const classJson = GltfMeshPrimitiveGpmLoader._createPpeTextureClassJson(
      ppeTexture,
      i,
    );
    const ppeTexturePropertyIdentifier = JSON.stringify(classJson);
    ppeTexturePropertyIdentifiers.push(ppeTexturePropertyIdentifier);
  }
  return ppeTexturePropertyIdentifiers;
};

/**
 * 将给定的 `MeshPrimitiveGpmLocal` 对象转换为 `StructuralMetadata` 对象
 * 对象。
 *
 * 这将把给定对象中的 PPE 纹理转换为属性
 * 纹理属性。模式表将基于 PPE 纹理的结构创建
 * 生成。
 *
 * @param {MeshPrimitiveGpmLocal} meshPrimitiveGpmLocal 扩展对象
 * @param {object} textures 纹理 ID 到纹理对象的映射关系
 * @returns The `StructuralMetadata` 对象
 */
GltfMeshPrimitiveGpmLoader._convertToStructuralMetadata = function (
  meshPrimitiveGpmLocal,
  textures,
) {
  const propertyTextures = [];
  const ppeTexturesMetadataSchema =
    GltfMeshPrimitiveGpmLoader._obtainPpeTexturesMetadataSchema(
      meshPrimitiveGpmLocal,
    );
  const ppeTextures = meshPrimitiveGpmLocal.ppeTextures;
  for (let i = 0; i < ppeTextures.length; i++) {
    const ppeTexture = ppeTextures[i];
    const classId = `ppeTexture_${i}`;
    const traits = ppeTexture.traits;
    const ppePropertyName = traits.source;
    const metadataClass = ppeTexturesMetadataSchema.classes[classId];

    const ppeTextureAsPropertyTexture = {
      class: classId,
      properties: {
        [ppePropertyName]: {
          index: ppeTexture.index,
          texCoord: ppeTexture.texCoord,
        },
      },
    };
    propertyTextures.push(
      new PropertyTexture({
        id: i,
        name: ppeTexture.name,
        propertyTexture: ppeTextureAsPropertyTexture,
        class: metadataClass,
        textures: textures,
      }),
    );
  }
  const structuralMetadata = new StructuralMetadata({
    schema: ppeTexturesMetadataSchema,
    propertyTables: [],
    propertyTextures: propertyTextures,
    propertyAttributes: [],
  });
  return structuralMetadata;
};

/**
 * 处理资源直至其准备就绪
 *
 * @param {FrameState} frameState 帧状态。
 * @private
 */
GltfMeshPrimitiveGpmLoader.prototype.process = function (frameState) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("frameState", frameState);
  //>>includeEnd('debug');

  if (this._state === ResourceLoaderState.READY) {
    return true;
  }

  if (this._state !== ResourceLoaderState.LOADED) {
    return false;
  }

  // The standard process of loading textures
  // (from GltfStructuralMetadataLoader)
  const textureLoaders = this._textureLoaders;
  const textureLoadersLength = textureLoaders.length;
  let ready = true;
  for (let i = 0; i < textureLoadersLength; ++i) {
    const textureLoader = textureLoaders[i];
    const textureReady = textureLoader.process(frameState);
    ready = ready && textureReady;
  }

  if (!ready) {
    return false;
  }

  // More of the standard process of loading textures
  // (from GltfStructuralMetadataLoader)
  const textures = {};
  for (let i = 0; i < this._textureIds.length; ++i) {
    const textureId = this._textureIds[i];
    const textureLoader = textureLoaders[i];
    if (!textureLoader.isDestroyed()) {
      textures[textureId] = textureLoader.texture;
    }
  }

  // Convert the JSON representation of the `ppeTextures` that
  // are found in the extensjon JSON into `PpeTexture` objects
  const ppeTextures = [];
  const extension = this._extension;
  if (defined(extension.ppeTextures)) {
    const ppeTexturesJson = extension.ppeTextures;
    for (const ppeTextureJson of ppeTexturesJson) {
      const traitsJson = ppeTextureJson.traits;
      const traits = new PpeMetadata({
        min: traitsJson.min,
        max: traitsJson.max,
        source: traitsJson.source,
      });
      const ppeTexture = new PpeTexture({
        traits: traits,
        noData: ppeTextureJson.noData,
        offset: ppeTextureJson.offset,
        scale: ppeTextureJson.scale,
        index: ppeTextureJson.index,
        texCoord: ppeTextureJson.texCoord,
      });
      ppeTextures.push(ppeTexture);
    }
  }
  const meshPrimitiveGpmLocal = new MeshPrimitiveGpmLocal(ppeTextures);
  this._meshPrimitiveGpmLocal = meshPrimitiveGpmLocal;

  const structuralMetadata =
    GltfMeshPrimitiveGpmLoader._convertToStructuralMetadata(
      meshPrimitiveGpmLocal,
      textures,
    );
  this._structuralMetadata = structuralMetadata;

  this._state = ResourceLoaderState.READY;
  return true;
};

GltfMeshPrimitiveGpmLoader.prototype._unloadTextures = function () {
  const textureLoaders = this._textureLoaders;
  const textureLoadersLength = textureLoaders.length;
  for (let i = 0; i < textureLoadersLength; ++i) {
    ResourceCache.unload(textureLoaders[i]);
  }
  this._textureLoaders.length = 0;
  this._textureIds.length = 0;
};

/**
 * 卸载资源
 * @private
 */
GltfMeshPrimitiveGpmLoader.prototype.unload = function () {
  this._unloadTextures();
  this._gltf = undefined;
  this._extension = undefined;
  this._structuralMetadata = undefined;
};

export default GltfMeshPrimitiveGpmLoader;
