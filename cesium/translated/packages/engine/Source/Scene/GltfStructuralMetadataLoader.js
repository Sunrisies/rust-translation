import { Check, DeveloperError, Frozen, defined } from "@cesium/core";
import parseStructuralMetadata from "./parseStructuralMetadata.js";
import parseFeatureMetadataLegacy from "./parseFeatureMetadataLegacy.js";
import ResourceCache from "./ResourceCache.js";
import ResourceLoader from "./ResourceLoader.js";
import ResourceLoaderState from "./ResourceLoaderState.js";

/**
 * 加载 glTF 结构元数据。
 * <p>
 * 实现 {@link ResourceLoader} 接口。
 * </p>
 *
 * @private
 * @experimental This 该特性使用了部分尚未定稿的 3D Tiles 规范，且可能根据 Cesium 的标准弃用政策进行更改。
 */
class GltfStructuralMetadataLoader extends ResourceLoader {
  /**
   * @param {object} options 具有以下属性的对象：
   * @param {object} options.gltf glTF JSON 数据。
   * @param {string} [options.extension] <code>EXT_structural_metadata</code> 扩展对象。如果未定义此对象，则必须定义 extensionLegacy。
   * @param {string} [options.extensionLegacy] 用于向后兼容的旧版 <code>EXT_feature_metadata</code> 扩展。
   * @param {Resource} options.gltfResource 包含 glTF 数据的 {@link Resource}。
   * @param {Resource} options.baseResource glTF JSON 中的路径所指向的 {@link Resource}。
   * @param {SupportedImageFormats} options.supportedImageFormats 支持的图像格式。
   * @param {FrameState} options.frameState 帧状态。
   * @param {string} [options.cacheKey] 资源的缓存键。
   * @param {boolean} [options.asynchronous=true] 决定 WebGL 资源创建是否会在多个帧中逐步完成，还是一次性完成直到所有 WebGL 资源创建完毕。
   */
  constructor(options) {
    super();

    options = options ?? Frozen.EMPTY_OBJECT;
    const {
      gltf,
      extension,
      extensionLegacy,
      gltfResource,
      baseResource,
      supportedImageFormats,
      frameState,
      cacheKey,
      asynchronous = true,
    } = options;

    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.object("options.gltf", gltf);
    Check.typeOf.object("options.gltfResource", gltfResource);
    Check.typeOf.object("options.baseResource", baseResource);
    Check.typeOf.object("options.supportedImageFormats", supportedImageFormats);
    Check.typeOf.object("options.frameState", frameState);

    if (!defined(options.extension) && !defined(options.extensionLegacy)) {
      throw new DeveloperError(
        "One of options.extension or options.extensionLegacy must be specified",
      );
    }
    //>>includeEnd('debug');

    this._gltfResource = gltfResource;
    this._baseResource = baseResource;
    this._gltf = gltf;
    this._extension = extension;
    this._extensionLegacy = extensionLegacy;
    this._supportedImageFormats = supportedImageFormats;
    this._frameState = frameState;
    this._cacheKey = cacheKey;
    this._asynchronous = asynchronous;
    this._bufferViewLoaders = [];
    this._bufferViewIds = [];
    this._textureLoaders = [];
    this._textureIds = [];
    this._schemaLoader = undefined;
    this._structuralMetadata = undefined;
    this._state = ResourceLoaderState.UNLOADED;
    this._promise = undefined;
  }

  /**
   * 资源的缓存键。
   *
   *
   * @type {string}
   * @readonly
   * @private
   */
  get cacheKey() {
    return this._cacheKey;
  }

  /**
   * 解析后的结构元数据。
   *
   *
   * @type {StructuralMetadata}
   * @readonly
   * @private
   */
  get structuralMetadata() {
    return this._structuralMetadata;
  }

  /**
   * 加载资源。
   * @returns {Promise<GltfStructuralMetadataLoader>} A 在资源加载完成时 resolve 的 promise，用于触发加载器。
   * @private
   */
  load() {
    if (defined(this._promise)) {
      return this._promise;
    }

    this._state = ResourceLoaderState.LOADING;
    this._promise = loadResources(this);
    return this._promise;
  }

  /**
   * 处理资源直至其准备就绪。
   *
   * @param {FrameState} frameState 帧状态。
   * @private
   */
  process(frameState) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.object("frameState", frameState);
    //>>includeEnd('debug');

    if (this._state === ResourceLoaderState.READY) {
      return true;
    }

    if (this._state !== ResourceLoaderState.LOADED) {
      return false;
    }

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

    const schema = this._schemaLoader.schema;
    const bufferViews = {};
    for (let i = 0; i < this._bufferViewIds.length; ++i) {
      const bufferViewId = this._bufferViewIds[i];
      const bufferViewLoader = this._bufferViewLoaders[i];
      if (!bufferViewLoader.isDestroyed()) {
        // Copy the typed array and let the underlying ArrayBuffer be freed
        const bufferViewTypedArray = new Uint8Array(
          bufferViewLoader.typedArray,
        );
        bufferViews[bufferViewId] = bufferViewTypedArray;
      }
    }

    const textures = {};
    for (let i = 0; i < this._textureIds.length; ++i) {
      const textureId = this._textureIds[i];
      const textureLoader = textureLoaders[i];
      if (!textureLoader.isDestroyed()) {
        textures[textureId] = textureLoader.texture;
      }
    }
    if (defined(this._extension)) {
      this._structuralMetadata = parseStructuralMetadata({
        extension: this._extension,
        schema: schema,
        bufferViews: bufferViews,
        textures: textures,
        context: frameState.context,
      });
    } else {
      this._structuralMetadata = parseFeatureMetadataLegacy({
        extension: this._extensionLegacy,
        schema: schema,
        bufferViews: bufferViews,
        textures: textures,
      });
    }

    // Buffer views can be unloaded after the data has been copied
    unloadBufferViews(this);

    this._state = ResourceLoaderState.READY;
    return true;
  }

  /**
   * 卸载资源。
   * @private
   */
  unload() {
    unloadBufferViews(this);
    unloadTextures(this);

    if (defined(this._schemaLoader)) {
      ResourceCache.unload(this._schemaLoader);
    }
    this._schemaLoader = undefined;

    if (defined(this._structuralMetadata)) {
      this._structuralMetadata.destroy();
    }

    this._structuralMetadata = undefined;
  }
}

async function loadResources(loader) {
  try {
    const bufferViewsPromise = loadBufferViews(loader);
    const texturesPromise = loadTextures(loader);
    const schemaPromise = loadSchema(loader);

    await Promise.all([bufferViewsPromise, texturesPromise, schemaPromise]);

    if (loader.isDestroyed()) {
      return;
    }

    loader._gltf = undefined; // No longer need to hold onto the glTF

    loader._state = ResourceLoaderState.LOADED;
    return loader;
  } catch (error) {
    if (loader.isDestroyed()) {
      return;
    }

    loader.unload();
    loader._state = ResourceLoaderState.FAILED;
    const errorMessage = "Failed to load structural metadata";
    throw loader.getError(errorMessage, error);
  }
}

function gatherBufferViewIdsFromProperties(properties, bufferViewIdSet) {
  for (const propertyId in properties) {
    if (properties.hasOwnProperty(propertyId)) {
      const property = properties[propertyId];
      const values = property.values;
      const arrayOffsets = property.arrayOffsets;
      const stringOffsets = property.stringOffsets;

      // Using an object like a mathematical set
      if (defined(values)) {
        bufferViewIdSet[values] = true;
      }
      if (defined(arrayOffsets)) {
        bufferViewIdSet[arrayOffsets] = true;
      }
      if (defined(stringOffsets)) {
        bufferViewIdSet[stringOffsets] = true;
      }
    }
  }
}

function gatherBufferViewIdsFromPropertiesLegacy(properties, bufferViewIdSet) {
  for (const propertyId in properties) {
    if (properties.hasOwnProperty(propertyId)) {
      const property = properties[propertyId];
      const bufferView = property.bufferView;
      const arrayOffsetBufferView = property.arrayOffsetBufferView;
      const stringOffsetBufferView = property.stringOffsetBufferView;

      // Using an object like a mathematical set
      if (defined(bufferView)) {
        bufferViewIdSet[bufferView] = true;
      }
      if (defined(arrayOffsetBufferView)) {
        bufferViewIdSet[arrayOffsetBufferView] = true;
      }
      if (defined(stringOffsetBufferView)) {
        bufferViewIdSet[stringOffsetBufferView] = true;
      }
    }
  }
}

function gatherUsedBufferViewIds(extension) {
  const propertyTables = extension.propertyTables;
  const bufferViewIdSet = {};
  if (defined(propertyTables)) {
    for (let i = 0; i < propertyTables.length; i++) {
      const propertyTable = propertyTables[i];
      gatherBufferViewIdsFromProperties(
        propertyTable.properties,
        bufferViewIdSet,
      );
    }
  }
  return bufferViewIdSet;
}

function gatherUsedBufferViewIdsLegacy(extensionLegacy) {
  const featureTables = extensionLegacy.featureTables;

  const bufferViewIdSet = {};
  if (defined(featureTables)) {
    for (const featureTableId in featureTables) {
      if (featureTables.hasOwnProperty(featureTableId)) {
        const featureTable = featureTables[featureTableId];
        const properties = featureTable.properties;
        if (defined(properties)) {
          gatherBufferViewIdsFromPropertiesLegacy(properties, bufferViewIdSet);
        }
      }
    }
  }
  return bufferViewIdSet;
}

async function loadBufferViews(structuralMetadataLoader) {
  let bufferViewIds;
  if (defined(structuralMetadataLoader._extension)) {
    bufferViewIds = gatherUsedBufferViewIds(
      structuralMetadataLoader._extension,
    );
  } else {
    bufferViewIds = gatherUsedBufferViewIdsLegacy(
      structuralMetadataLoader._extensionLegacy,
    );
  }

  // Load the buffer views
  const bufferViewPromises = [];
  for (const bufferViewId in bufferViewIds) {
    if (bufferViewIds.hasOwnProperty(bufferViewId)) {
      const bufferViewLoader = ResourceCache.getBufferViewLoader({
        gltf: structuralMetadataLoader._gltf,
        bufferViewId: parseInt(bufferViewId),
        gltfResource: structuralMetadataLoader._gltfResource,
        baseResource: structuralMetadataLoader._baseResource,
      });

      structuralMetadataLoader._bufferViewLoaders.push(bufferViewLoader);
      structuralMetadataLoader._bufferViewIds.push(bufferViewId);

      bufferViewPromises.push(bufferViewLoader.load());
    }
  }

  return Promise.all(bufferViewPromises);
}

function gatherUsedTextureIds(structuralMetadataExtension) {
  // Gather the used textures
  const textureIds = {};
  const propertyTextures = structuralMetadataExtension.propertyTextures;
  if (defined(propertyTextures)) {
    for (let i = 0; i < propertyTextures.length; i++) {
      const propertyTexture = propertyTextures[i];
      const properties = propertyTexture.properties;
      if (defined(properties)) {
        gatherTextureIdsFromProperties(properties, textureIds);
      }
    }
  }
  return textureIds;
}

function gatherTextureIdsFromProperties(properties, textureIds) {
  for (const propertyId in properties) {
    if (properties.hasOwnProperty(propertyId)) {
      // in EXT_structural_metadata the property is a valid textureInfo.
      const textureInfo = properties[propertyId];
      textureIds[textureInfo.index] = textureInfo;
    }
  }
}

function gatherUsedTextureIdsLegacy(extensionLegacy) {
  // Gather the used textures
  const textureIds = {};
  const featureTextures = extensionLegacy.featureTextures;
  if (defined(featureTextures)) {
    for (const featureTextureId in featureTextures) {
      if (featureTextures.hasOwnProperty(featureTextureId)) {
        const featureTexture = featureTextures[featureTextureId];
        const properties = featureTexture.properties;
        if (defined(properties)) {
          gatherTextureIdsFromPropertiesLegacy(properties, textureIds);
        }
      }
    }
  }

  return textureIds;
}

function gatherTextureIdsFromPropertiesLegacy(properties, textureIds) {
  for (const propertyId in properties) {
    if (properties.hasOwnProperty(propertyId)) {
      const property = properties[propertyId];
      const textureInfo = property.texture;
      textureIds[textureInfo.index] = textureInfo;
    }
  }
}

function loadTextures(structuralMetadataLoader) {
  let textureIds;
  if (defined(structuralMetadataLoader._extension)) {
    textureIds = gatherUsedTextureIds(structuralMetadataLoader._extension);
  } else {
    textureIds = gatherUsedTextureIdsLegacy(
      structuralMetadataLoader._extensionLegacy,
    );
  }

  const gltf = structuralMetadataLoader._gltf;
  const gltfResource = structuralMetadataLoader._gltfResource;
  const baseResource = structuralMetadataLoader._baseResource;
  const supportedImageFormats = structuralMetadataLoader._supportedImageFormats;
  const frameState = structuralMetadataLoader._frameState;
  const asynchronous = structuralMetadataLoader._asynchronous;

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
      structuralMetadataLoader._textureLoaders.push(textureLoader);
      structuralMetadataLoader._textureIds.push(textureId);
      texturePromises.push(textureLoader.load());
    }
  }

  return Promise.all(texturePromises);
}

async function loadSchema(structuralMetadataLoader) {
  const extension =
    structuralMetadataLoader._extension ??
    structuralMetadataLoader._extensionLegacy;

  let schemaLoader;
  if (defined(extension.schemaUri)) {
    const resource = structuralMetadataLoader._baseResource.getDerivedResource({
      url: extension.schemaUri,
    });
    schemaLoader = ResourceCache.getSchemaLoader({
      resource: resource,
    });
  } else {
    schemaLoader = ResourceCache.getSchemaLoader({
      schema: extension.schema,
    });
  }

  structuralMetadataLoader._schemaLoader = schemaLoader;
  await schemaLoader.load();
  if (!schemaLoader.isDestroyed()) {
    return schemaLoader.schema;
  }
}

function unloadBufferViews(structuralMetadataLoader) {
  const bufferViewLoaders = structuralMetadataLoader._bufferViewLoaders;
  const bufferViewLoadersLength = bufferViewLoaders.length;
  for (let i = 0; i < bufferViewLoadersLength; ++i) {
    ResourceCache.unload(bufferViewLoaders[i]);
  }
  structuralMetadataLoader._bufferViewLoaders.length = 0;
  structuralMetadataLoader._bufferViewIds.length = 0;
}

function unloadTextures(structuralMetadataLoader) {
  const textureLoaders = structuralMetadataLoader._textureLoaders;
  const textureLoadersLength = textureLoaders.length;
  for (let i = 0; i < textureLoadersLength; ++i) {
    ResourceCache.unload(textureLoaders[i]);
  }
  structuralMetadataLoader._textureLoaders.length = 0;
  structuralMetadataLoader._textureIds.length = 0;
}

export default GltfStructuralMetadataLoader;
