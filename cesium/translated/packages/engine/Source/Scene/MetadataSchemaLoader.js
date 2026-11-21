import { DeveloperError, Frozen, defined } from "@cesium/core";
import MetadataSchema from "./MetadataSchema.js";
import ResourceLoader from "./ResourceLoader.js";
import ResourceLoaderState from "./ResourceLoaderState.js";

/**
 * 一个 {@link MetadataSchema} 加载器。
 * <p>
 * 实现 {@link ResourceLoader} 接口。
 * </p>
 *
 * @private
 * @experimental This 该功能使用了部分尚未定稿且可能随 Cesium 标准弃用政策而变更的 3D Tiles 规范。
 */
class MetadataSchemaLoader extends ResourceLoader {
  /**
   * @param {object} options 具有以下属性的对象：
   * @param {object} [options.schema] 明确定义 JSON 模式的对象。与 options.resource 互斥。
   * @param {Resource} [options.resource] 指向 JSON 模式文件的 {@link Resource}。与 options.schema 互斥。
   * @param {string} [options.cacheKey] 资源的缓存键。
   *
   * @exception {DeveloperError} One 必须定义 options.schema 和 options.resource。
   */
  constructor(options) {
    super();

    options = options ?? Frozen.EMPTY_OBJECT;
    const schema = options.schema;
    const resource = options.resource;
    const cacheKey = options.cacheKey;

    //>>includeStart('debug', pragmas.debug);
    if (defined(schema) === defined(resource)) {
      throw new DeveloperError(
        "One of options.schema and options.resource must be defined.",
      );
    }
    //>>includeEnd('debug');

    this._schema = defined(schema)
      ? MetadataSchema.fromJson(schema)
      : undefined;
    this._resource = resource;
    this._cacheKey = cacheKey;
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
   * 元数据模式对象。
   *
   *
   * @type {MetadataSchema}
   * @readonly
   * @private
   */
  get schema() {
    return this._schema;
  }

  /**
   * 加载资源。
   * @returns {Promise<MetadataSchemaLoader>} A 在资源加载完成后解析为加载器的承诺。
   * @private
   */
  async load() {
    if (defined(this._promise)) {
      return this._promise;
    }

    if (defined(this._schema)) {
      this._promise = Promise.resolve(this);
      return this._promise;
    }

    this._promise = loadExternalSchema(this);
    return this._promise;
  }

  /**
   * 卸载资源。
   * @private
   */
  unload() {
    this._schema = undefined;
  }
}

async function loadExternalSchema(schemaLoader) {
  const resource = schemaLoader._resource;
  schemaLoader._state = ResourceLoaderState.LOADING;
  try {
    const json = await resource.fetchJson();
    if (schemaLoader.isDestroyed()) {
      return;
    }

    schemaLoader._schema = MetadataSchema.fromJson(json);
    schemaLoader._state = ResourceLoaderState.READY;
    return schemaLoader;
  } catch (error) {
    if (schemaLoader.isDestroyed()) {
      return;
    }

    schemaLoader._state = ResourceLoaderState.FAILED;
    const errorMessage = `Failed to load schema: ${resource.url}`;
    throw schemaLoader.getError(errorMessage, error);
  }
}

export default MetadataSchemaLoader;
