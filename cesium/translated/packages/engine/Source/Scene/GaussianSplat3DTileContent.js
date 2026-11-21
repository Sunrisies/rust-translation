import {
  RuntimeError,
  defined,
  deprecationWarning,
  destroyObject,
  oneTimeWarning,
} from "@cesium/core";
import Resource from "../Core/Resource.js";
import GltfLoader from "./GltfLoader.js";
import Axis from "./Axis.js";
import GaussianSplatPrimitive from "./GaussianSplatPrimitive.js";
import ModelUtility from "./Model/ModelUtility.js";
import VertexAttributeSemantic from "./VertexAttributeSemantic.js";

/** @import Cesium3DTileContent from "./Cesium3DTileContent.js"; */

/**
 * 使用 {@link https://github.com/CesiumGS/glTF/tree/draft-splat-spz/extensions/2.0/Khronos/KHR_gaussian_splatting | KHR_gaussian_splatting} 和 {@link https://github.com/CesiumGS/glTF/tree/draft-splat-spz/extensions/2.0/Khronos/KHR_gaussian_splatting_compression_spz_2 | KHR_gaussian_splatting_compression_spz_2} 扩展来表示 glTF 或 glb 的内容。
 * <p>
 * 实现 {@link Cesium3DTileContent} 接口。
 * </p>
 *
 * @implements Cesium3DTileContent
 */
class GaussianSplat3DTileContent {
  constructor(loader, tileset, tile, resource) {
    this._tileset = tileset;
    this._tile = tile;
    this._resource = resource;
    this._loader = loader;

    if (!defined(this._tileset.gaussianSplatPrimitive)) {
      this._tileset.gaussianSplatPrimitive = new GaussianSplatPrimitive({
        tileset: this._tileset,
      });
    }

    /**
     * 转换为根瓦片空间后的位置属性缓冲区的本地副本。
     * 原始的 glTF 属性数据保持不变，以便重建时重新应用源坐标的变换。
     * 从源坐标进行的变换。
     * @type {undefined|Float32Array}
     * @private
     */
    this._positions = undefined;

    /**
     * 转换为根瓦片空间后的旋转属性缓冲区的本地副本。
     * @type {undefined|Float32Array}
     * @private
     */
    this._rotations = undefined;

    /**
     * 转换为根瓦片空间后的缩放属性缓冲区的本地副本。
     * @type {undefined|Float32Array}
     * @private
     */
    this._scales = undefined;

    /**
     * 包含用于渲染的高斯斑点数据的 glTF 原始数据。
     * @type {undefined|Primitive}
     * @private
     */
    this.gltfPrimitive = undefined;

    /**
     * 将模型坐标转换为世界坐标的变换矩阵。
     * @type {undefined|Matrix4}
     * @private
     */
    this.worldTransform = undefined;

    /**
     * 获取或设置任何特征属性是否发生更改。用于
     * 在特征属性更改时优化样式应用。
     * <p>
     * 此功能用于实现 <code>Cesium3DTileContent</code> 接口，但不属于公共 Cesium API。
     * 指示瓦片的本地坐标是否已进行变换。
     * </p>
     *
     * @type {boolean}
     *
     * @private
     */
    this.featurePropertiesDirty = false;

    this._metadata = undefined;
    this._group = undefined;
    this._ready = false;
    /**
     * 用于指示瓦片的坐标是否进行了变换。
     * @type {boolean}
     * @private
     */
    this._transformed = false;

    /**
     * 用于高斯斑点处理的球谐函数的阶数。
     * @type {number}
     * @private
     */
    this._sphericalHarmonicsDegree = 0;

    /**
     * 用于高斯斑点处理的球谐系数数量。
     * @type {number}
     * @private
     */
    this._sphericalHarmonicsCoefficientCount = 0;

    /**
     * 已打包用于纹理或着色器的球谐函数数据。
     * @type {undefined|Uint32Array}
     * @private
     */
    this._packedSphericalHarmonicsData = undefined;

    /**
     * 从 glTF 原始数据中加载的所有斑点特征 ID 集合，
     * 按位置索引排序（featureId_0, featureId_1, ...）。
     * 每个条目是一个 Uint32Array，每个斑点包含一个元素。
     * @type {Array<Uint32Array>}
     * @private
     */
    this._allFeatureIds = [];

    /**
     * 用于最后一次斑点烘焙的本地空间到根瓦片的缓存变换矩阵。
     * 如果未更改，这些变换后的缓冲区可以直接重用。
     * @type {undefined|Matrix4}
     * @private
     */
    this._lastSplatTransform = undefined;
  }

  /**
   * 进行检查以确保提供的瓦片集包含高斯斑点扩展。
   *
   * @param {Cesium3DTileset} tileset 用于检查扩展的瓦片集。
   * @returns {boolean} Returns 如果瓦片集包含必要的扩展，则输出 <code>true</code>。
   * @static
   */
  static tilesetRequiresGaussianSplattingExt(tileset) {
    let hasGaussianSplatExtension = false;
    if (tileset.isGltfExtensionRequired instanceof Function) {
      hasGaussianSplatExtension =
        tileset.isGltfExtensionRequired("KHR_gaussian_splatting") &&
        tileset.isGltfExtensionRequired(
          "KHR_gaussian_splatting_compression_spz_2",
        );

      if (
        tileset.isGltfExtensionRequired("KHR_spz_gaussian_splats_compression")
      ) {
        deprecationWarning(
          "KHR_spz_gaussian_splats_compression",
          "Support for the original KHR_spz_gaussian_splats_compression extension has been removed in favor " +
            "of the up to date KHR_gaussian_splatting and KHR_gaussian_splatting_compression_spz_2 extensions" +
            "\n\nPlease retile your tileset with the KHR_gaussian_splatting and " +
            "KHR_gaussian_splatting_compression_spz_2 extensions.",
        );
      }
    }

    return hasGaussianSplatExtension;
  }

  /**
   * 获取瓦片中特征的数量。目前始终为 0。
   *
   *
   * @type {number}
   * @readonly
   */
  get featuresLength() {
    return 0;
  }

  /**
   * 等于瓦片中高斯斑点的数量。每个斑点由一个中位数点及一组属性表示，因此我们可以将此视为瓦片中的点数。
   * 将此视为瓦片中的点数。
   *
   *
   * @type {number}
   * @readonly
   */
  get pointsLength() {
    return this.gltfPrimitive.attributes[0].count;
  }

  /**
   * 获取瓦片中三角形的数量。目前始终为 0，因为高斯斑点在瓦片内容中不以三角形形式表示。
   * <p>
   *
   * @type {number}
   * @readonly
   */
  get trianglesLength() {
    return 0;
  }

  /**
   * 此内容几何属性所使用的字节数。
   * <p>
   * @type {number}
   * @readonly
   */
  get geometryByteLength() {
    return 0;
  }

  /**
   * 此内容纹理所使用的字节数。
   * <p>
   * @type {number}
   * @readonly
   */
  get texturesByteLength() {
    const primitive = this._tileset?.gaussianSplatPrimitive;
    if (!defined(primitive)) {
      return 0;
    }
    const texture = primitive.gaussianSplatTexture;
    const selectedTileLength = primitive.selectedTileLength;
    if (!defined(texture) || selectedTileLength === 0) {
      return 0;
    }
    return texture.sizeInBytes / selectedTileLength;
  }

  /**
   * 获取批次表纹理及任何二进制数据所占用的内存量。
   * 未在 geometryByteLength 或
   * texturesByteLength 中考虑的元数据属性。
   * <p>
   *
   * @type {number}
   * @readonly
   */
  get batchTableByteLength() {
    return 0;
  }

  /**
   * 获取包含其他内容的 {@link Cesium3DTileContent} 对象数组，例如复合瓦片。内部内容可能又包含内部内容，例如一个包含复合瓦片的复合瓦片。
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/TileFormats/Composite|Composite specification}
   *
   *
   * @type {Array}
   * @readonly
   */
  get innerContents() {
    return undefined;
  }

  /**
   * 当瓦片内容准备好渲染时返回 true；否则返回 false。
   *
   *
   * @type {boolean}
   * @readonly
   */
  get ready() {
    return this._ready;
  }

  /**
   * 当瓦片内容被转换为世界坐标时返回 true；否则返回 false。
   * <p>
   * @type {boolean}
   * @readonly
   */
  get transformed() {
    return this._transformed;
  }

  /**
   * 此内容所属的瓦片集。
   * <p>
   * @type {Cesium3DTileset}
   * @readonly
   */
  get tileset() {
    return this._tileset;
  }

  /**
   * 此内容所属的瓦片。
   * <p>
   * @type {Cesium3DTile}
   * @readonly
   */
  get tile() {
    return this._tile;
  }

  /**
   * 此内容加载的资源来源。
   * <p>
   * @type {string}
   * @readonly
   */
  get url() {
    return this._resource.getUrlComponent(true);
  }

  /**
   * 获取此内容的批次表。
   * <p>
   * 此方法用于实现 <code>Cesium3DTileContent</code> 接口，但
   * 不属于公共 Cesium API。
   * </p>
   *
   * @type {Cesium3DTileBatchTable}
   * @readonly
   *
   * @private
   */
  get batchTable() {
    return undefined;
  }

  /**
   * 获取此内容的元数据，无论是显式提供的还是通过
   * 隐式瓦片化提供的。如果没有元数据，此属性应被定义为未定义。
   * <p>
   * 此方法用于实现 <code>Cesium3DTileContent</code> 接口，但
   * 不属于公共 Cesium API。
   * </p>
   *
   * @type {ImplicitMetadataView|undefined}
   *
   * @private
   * @experimental This 该特性使用了尚未最终定稿的 3D Tiles 规范，且可能根据 Cesium 的标准弃用政策发生变化。
   */
  get metadata() {
    return this._metadata;
  }

  set metadata(value) {
    this._metadata = value;
  }

  /**
   * 如果此内容具有元数据（3D Tiles 1.1），或者
   * 如果使用了 <code>3DTILES_metadata</code> 扩展，则获取此内容的组信息。如果两者都不存在，
   * 此属性应被定义为未定义。
   * <p>
   * 此方法用于实现 <code>Cesium3DTileContent</code> 接口，但
   * 不属于公共 Cesium API。
   * </p>
   *
   * @type {Cesium3DContentGroup|undefined}
   *
   * @private
   * @experimental This 该特性使用了尚未最终定稿的 3D Tiles 规范，且可能根据 Cesium 的标准弃用政策发生变化。
   */
  get group() {
    return this._group;
  }

  set group(value) {
    this._group = value;
  }

  /** @inheritdoc */
  get show() {
    // TODO CONTENT_SHOW: There is no reasonable way to show
    // or hide a single gaussian splat content. The contents
    // are mushed together into a GaussianSplatPrimitive that
    // is part of a tileset. This is broken on several levels
    // anyhow, so no need to bother here: Just use the 'show'
    // flag of the tileset.
    return this._tileset.show;
  }

  set show(value) {
    this._tileset.show = value;
  }

  /**
   * 获取此瓦片高斯模糊的变换后位置。
   * @type {undefined|Float32Array}
   * @private
   */
  get positions() {
    return this._positions;
  }

  /**
   * 获取此瓦片高斯模糊的变换后旋转角度。
   * @type {undefined|Float32Array}
   * @private
   */
  get rotations() {
    return this._rotations;
  }

  /**
   * 获取此瓦片高斯模糊的变换后缩放比例。
   * @type {undefined|Float32Array}
   * @private
   */
  get scales() {
    return this._scales;
  }

  /**
   * 用于高斯模糊的球谐系数数量。
   * @type {number}
   * @private
   * @experimental This 该特性使用了尚未最终定稿的 3D Tiles 规范，且可能根据 Cesium 的标准弃用政策发生变化。
   */
  get sphericalHarmonicsCoefficientCount() {
    return this._sphericalHarmonicsCoefficientCount;
  }

  /**
   * 用于高斯模糊的球谐函数的阶数。
   * @type {number}
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容。
   */
  get sphericalHarmonicsDegree() {
    return this._sphericalHarmonicsDegree;
  }

  /**
   * 用于着色器或纹理的高斯斑点所需的打包球谐数据。
   * @type {number}
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容。
   */
  get packedSphericalHarmonicsData() {
    return this._packedSphericalHarmonicsData;
  }

  /**
   * 从 glTF 或 glb 资源创建新的 {@link GaussianSplat3DTileContent} 实例。
   *
   * @param {Cesium3DTileset} tileset - 该内容所属的瓦片集。
   * @param {Cesium3DTile} tile - 该内容所属的瓦片。
   * @param {Resource|string} resource - glTF 或 glb 文件의 리소스 또는 URL。
   * @param {object|Uint8Array} gltf - 包含 glb 二进制数据的 glTF JSON 对象或 Uint8Array。
   * @returns {GaussianSplat3DTileContent} A 新的 GaussianSplat3DTileContent 实例。
   * @throws {RuntimeError} If glTF 或 glb 无法加载。
   * @private
   */
  static async fromGltf(tileset, tile, resource, gltf) {
    const basePath = resource;
    const baseResource = Resource.createIfNeeded(basePath);

    const loaderOptions = {
      releaseGltfJson: false,
      upAxis: Axis.Y,
      forwardAxis: Axis.Z,
      // Ensure non-SPZ vertex attributes (e.g. _FEATURE_ID_0) are available as
      // typed arrays for CPU-side aggregation.  SPZ-decoded attributes already
      // produce typed arrays regardless of this flag.
      loadAttributesAsTypedArray: true,
    };

    if (defined(gltf.asset)) {
      loaderOptions.gltfJson = gltf;
      loaderOptions.baseResource = baseResource;
      loaderOptions.gltfResource = baseResource;
    } else if (gltf instanceof Uint8Array) {
      loaderOptions.typedArray = gltf;
      loaderOptions.baseResource = baseResource;
      loaderOptions.gltfResource = baseResource;
    } else {
      loaderOptions.gltfResource = Resource.createIfNeeded(gltf);
    }

    const loader = new GltfLoader(loaderOptions);

    try {
      await loader.load();
    } catch (error) {
      loader.destroy();
      throw new RuntimeError(`Failed to load glTF: ${error.message}`);
    }

    return new GaussianSplat3DTileContent(loader, tileset, tile, resource);
  }

  /**
   * 更新瓦片的内容并准备渲染。
   * @param {Cesium3DTileset}￼Data 归属信息
   * @param {FrameState} frameState - 当前帧状态。
   * @private
   */
  update(primitive, frameState) {
    const loader = this._loader;

    if (this._ready) {
      return;
    }

    frameState.afterRender.push(() => true);

    if (!defined(loader)) {
      this._ready = true;
      return;
    }

    if (this._resourcesLoaded) {
      this.gltfPrimitive = loader.components.scene.nodes[0].primitives[0];
      this.worldTransform = loader.components.scene.nodes[0].matrix;
      this._ready = true;

      // SPZ decode produces Float32Array attributes for these semantics, so
      // typedArray.slice() preserves the expected runtime type for current data.
      // If future splat encodings use quantized integer attributes here, revisit
      // this assumption before relying on the copied array type.
      this._positions = ModelUtility.getAttributeBySemantic(
        this.gltfPrimitive,
        VertexAttributeSemantic.POSITION,
      ).typedArray.slice();

      this._rotations = ModelUtility.getAttributeBySemantic(
        this.gltfPrimitive,
        VertexAttributeSemantic.ROTATION,
      ).typedArray.slice();

      this._scales = ModelUtility.getAttributeBySemantic(
        this.gltfPrimitive,
        VertexAttributeSemantic.SCALE,
      ).typedArray.slice();

      const { l, n } = degreeAndCoefFromAttributes(
        this.gltfPrimitive.attributes,
      );
      this._sphericalHarmonicsDegree = l;
      this._sphericalHarmonicsCoefficientCount = n;

      this._packedSphericalHarmonicsData = packSphericalHarmonicsData(this);

      // Load ALL feature ID sets from the primitive so that custom shaders
      // can access featureId_0, featureId_1, ... simultaneously.
      const primitiveFeatureIds = this.gltfPrimitive.featureIds;
      const allFeatureIds = [];
      if (defined(primitiveFeatureIds)) {
        // Sequential fallback IDs are identical across sets, so allocate them
        // once (lazily) and share the array rather than one Uint32Array per set.
        let sequentialFeatureIds;
        for (let i = 0; i < primitiveFeatureIds.length; i++) {
          const fid = primitiveFeatureIds[i];
          let data;
          if (defined(fid.setIndex)) {
            const attr = ModelUtility.getAttributeBySemantic(
              this.gltfPrimitive,
              VertexAttributeSemantic.FEATURE_ID,
              fid.setIndex,
            );
            if (defined(attr) && defined(attr.typedArray)) {
              data = new Uint32Array(attr.typedArray);
            } else if (defined(attr) && defined(attr.constant)) {
              // Per glTF 2.0, an accessor without a bufferView is zero-filled.
              // GltfLoader represents it as a constant (non-SPZ semantics are
              // not routed through SPZ decoding), so expand it per splat.
              data = new Uint32Array(this.pointsLength).fill(attr.constant);
            } else {
              // The feature ID set references an attribute the primitive does
              // not have. This is a data error; warn rather than hide it, then
              // fall back to sequential IDs so the featureId_N shader slots
              // stay aligned.
              oneTimeWarning(
                "GaussianSplatMissingFeatureIdAttribute",
                `Feature ID set ${i} references attribute _FEATURE_ID_${fid.setIndex} but the primitive does not provide it. Falling back to sequential IDs (0..N-1).`,
              );
            }
          }
          // Implicit feature IDs (no attribute) use the vertex index per the
          // EXT_mesh_features spec. The same shared sequential array is reused
          // as the fallback when a declared attribute is missing its data.
          if (!defined(data)) {
            if (!defined(sequentialFeatureIds)) {
              const count = this.pointsLength;
              sequentialFeatureIds = new Uint32Array(count);
              for (let j = 0; j < count; j++) {
                sequentialFeatureIds[j] = j;
              }
            }
            data = sequentialFeatureIds;
          }
          allFeatureIds.push(data);
        }
      }
      this._allFeatureIds = allFeatureIds;

      return;
    }

    this._resourcesLoaded = loader.process(frameState);
  }

  /**
   * 获取从 glTF primitive 加载的所有斑点特征 ID 集合。
   * 每个条目是一个 Uint32Array，每个斑点包含一个元素，按
   * 位置索引（featureId_0, featureId_1, ...）排序。
   * @type {Array<Uint32Array>}
   * @private
   */
  get allFeatureIds() {
    return this._allFeatureIds;
  }

  /**
   * 该瓦片内容可用的特征 ID 集合数量。
   * @type {number}
   * @private
   */
  get featureIdCount() {
    return this._allFeatureIds.length;
  }

  /**
   * 返回特征是否具有此属性。
   *
   * @param {number} batchId 特征的 batchId。
   * @param {string} name 属性的大小写敏感名称。
   * @returns {boolean} <code>true</code> 如果特征具有此属性，则返回 true；否则返回 <code>false</code>。
   */
  hasProperty(batchId, name) {
    return false;
  }

  /**
   * 返回具有给定 <code>batchId</code> 的 {@link Cesium3DTileFeature} 对象。该对象用于获取和修改
   * 特征的属性。
   * 瓦片中的特征按 <code>batchId</code> 排序，这是从批次表中检索其元数据的索引。
   * <p>
   * 特征的 batchId。
   * </p>
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/TileFormats/BatchTable}.
   *
   * @param {number} batchId 对应 {@link Cesium3DTileFeature} 对象。
   * @returns {Cesium3DTileFeature} The 必须介于零和 {@link Cesium3DTileContent#featuresLength} - 1之间。
   *
   * @exception {DeveloperError} batchId 在 {@link Cesium3DTileset#debugColorizeTiles} 发生变化时调用。
   */
  getFeature(batchId) {
    return undefined;
  }

  /**
       * 用于实现 <code>Cesium3DTileContent</code> 接口，但不属于公共 Cesium API。
       * <p>
       * 是否启用或禁用调试设置。
       * 对应 {@link Cesium3DTileFeature} 对象。
       * </p>
       *
       * @param {boolean} enabled 对内容应用样式。
       * @returns {Cesium3DTileFeature} The 用于实现 <code>Cesium3DTileContent</code> 接口，但不属于公共 Cesium API。

       * @private
       */
  applyDebugSettings(enabled, color) {}

  /**
   * 样式。
   * <p>
   * 用于实现 <code>Cesium3DTileContent</code> 接口，但不属于公共 Cesium API。
   * 样式本身。
   * </p>
   *
   * @param {Cesium3DTileStyle} style 光线与已渲染的瓦片内容表面之间的交点查找。光线必须以世界坐标给出。
   *
   * @private
   */
  applyStyle(style) {}

  /**
   * Find an intersection between a ray and the tile content surface that was rendered. The ray must be given in world coordinates.
   *
   * @param {Ray} ray 用于检测相交的射线。
   * @param {FrameState} frameState 帧状态。
   * @param {Cartesian3|undefined} [result] 如果未找到相交实体，则返回 <code>undefined</code>。
   * @returns {Cartesian3|undefined} The 如果未找到相交实体，则返回 <code>undefined</code>。
   *
   * @private
   */
  pick(ray, frameState, result) {
    return undefined;
  }

  /**
   * 如果此对象被销毁，则返回 true；否则返回 false。
   * <br /><br />
   * 如果此对象被销毁，则不应使用它；调用除
   * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
   * <p>
   * 此方法用于实现 <code>Cesium3DTileContent</code> 接口，但属于
   * 非公共 Cesium API 的一部分。
   * </p>
   *
   * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>；否则返回 <code>false</code>。
   *
   * @see Cesium3DTileContent#destroy
   *
   * @private
   */
  isDestroyed() {
    return this.isDestroyed;
  }

  /**
   * 释放此对象使用的资源。
   * @private
   */
  destroy() {
    this.splatPrimitive = undefined;

    this._tile = undefined;
    this._tileset = undefined;
    this._resource = undefined;
    this._ready = false;
    this._group = undefined;
    this._metadata = undefined;
    this._resourcesLoaded = false;
    this._lastSplatTransform = undefined;

    if (defined(this._loader)) {
      this._loader.destroy();
      this._loader = undefined;
    }

    return destroyObject(this);
  }
}

function getShAttributePrefix(attribute) {
  const prefix = attribute.startsWith("KHR_gaussian_splatting:")
    ? "KHR_gaussian_splatting:"
    : "_";
  return `${prefix}SH_DEGREE_`;
}

/**
 * 根据属性确定球谐函数的度数和系数数量
 * @param {Attribute[]} attributes - glTF 属性列表。
 * @returns {object} An 包含度数 (l) 和系数 (n) 的对象。
 * @private
 */
function degreeAndCoefFromAttributes(attributes) {
  const shAttributes = attributes.filter((attr) =>
    attr.name.includes("SH_DEGREE_"),
  );

  switch (shAttributes.length) {
    default:
    case 0:
      return { l: 0, n: 0 };
    case 3:
      return { l: 1, n: 9 };
    case 8:
      return { l: 2, n: 24 };
    case 15:
      return { l: 3, n: 45 };
  }
}

/**
 * 将 32 位浮点数转换为 16 位浮点数。
 * @param {number} float32 输入
 * @returns {number} Half 精度为 float
 * @private
 */
const buffer = new ArrayBuffer(4);
const floatView = new Float32Array(buffer);
const intView = new Uint32Array(buffer);

function float32ToFloat16(float32) {
  floatView[0] = float32;
  const bits = intView[0];

  const sign = (bits >> 31) & 0x1;
  const exponent = (bits >> 23) & 0xff;
  const mantissa = bits & 0x7fffff;

  let half;

  if (exponent === 0xff) {
    half = (sign << 15) | (0x1f << 10) | (mantissa ? 0x200 : 0);
  } else if (exponent === 0) {
    half = sign << 15;
  } else {
    const newExponent = exponent - 127 + 15;
    if (newExponent >= 31) {
      half = (sign << 15) | (0x1f << 10);
    } else if (newExponent <= 0) {
      half = sign << 15;
    } else {
      half = (sign << 15) | (newExponent << 10) | (mantissa >>> 13);
    }
  }

  return half;
}

/**
 * 从属性名中提取球谐函数的度数和系数。
 * @param {string} attribute - 属性名。
 * @returns {object} An 包含度数 (l) 和系数 (n) 的对象。
 * @private
 */
function extractSHDegreeAndCoef(attribute) {
  const prefix = getShAttributePrefix(attribute);
  const separator = "_COEF_";

  const lStart = prefix.length;
  const coefIndex = attribute.indexOf(separator, lStart);

  const l = parseInt(attribute.slice(lStart, coefIndex), 10);
  const n = parseInt(attribute.slice(coefIndex + separator.length), 10);

  return { l, n };
}

/**
 * 将球谐数据打包到半精度浮点数中。
 * @param {GaussianSplat3DTileContent} tileContent - 包含球谐数据的瓦片内容。
 * @returns {Uint32Array} - 打包后的 Float16 球谐数据。
 * @private
 */
function packSphericalHarmonicsData(tileContent) {
  const degree = tileContent.sphericalHarmonicsDegree;
  const coefs = tileContent.sphericalHarmonicsCoefficientCount;
  const totalLength = tileContent.pointsLength * (coefs * (2 / 3)); //3 packs into 2
  const packedData = new Uint32Array(totalLength);

  const shAttributes = tileContent.gltfPrimitive.attributes.filter((attr) =>
    attr.name.includes("SH_DEGREE_"),
  );
  let stride = 0;
  const base = [0, 9, 24];
  switch (degree) {
    case 1:
      stride = 9;
      break;
    case 2:
      stride = 24;
      break;
    case 3:
      stride = 45;
      break;
  }
  shAttributes.sort((a, b) => {
    if (a.name < b.name) {
      return -1;
    }
    if (a.name > b.name) {
      return 1;
    }

    return 0;
  });
  const packedStride = stride * (2 / 3);
  for (let i = 0; i < shAttributes.length; i++) {
    const { l, n } = extractSHDegreeAndCoef(shAttributes[i].name);
    for (let j = 0; j < tileContent.pointsLength; j++) {
      //interleave the data
      const packedBase = (base[l - 1] * 2) / 3;
      const idx = j * packedStride + packedBase + n * 2;
      const src = j * 3;
      packedData[idx] =
        float32ToFloat16(shAttributes[i].typedArray[src]) |
        (float32ToFloat16(shAttributes[i].typedArray[src + 1]) << 16);
      packedData[idx + 1] = float32ToFloat16(
        shAttributes[i].typedArray[src + 2],
      );
    }
  }
  return packedData;
}

export default GaussianSplat3DTileContent;
