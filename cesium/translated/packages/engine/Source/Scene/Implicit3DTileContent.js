import {
  Cartesian3,
  Check,
  DeveloperError,
  HilbertOrder,
  Math as CesiumMath,
  Matrix3,
  Rectangle,
  clone,
  combine,
  defined,
  destroyObject,
} from "@cesium/core";
import S2Cell from "../Core/S2Cell.js";
import ImplicitSubtree from "./ImplicitSubtree.js";
import hasExtension from "./hasExtension.js";
import MetadataSemantic from "./MetadataSemantic.js";
import BoundingVolumeSemantics from "./BoundingVolumeSemantics.js";

/**
 * 一个专门的 {@link Cesium3DTileContent} 类，可延迟评估隐式
 * 瓦片集。其运作方式与
 * {@link Tileset3DTileContent} 类似，即一旦内容构建完成，它
 * 会更新瓦片集树以添加更多瓦片。然而，与外部瓦片集不同，
 * 子子树被表示为带有
 * Implicit3DTileContent 的额外占位符节点。
 * <p>
 * 实现 {@link Cesium3DTileContent} 接口。
 * </p>
 * 通常不直接实例化此对象，应使用 {@link Implicit3DTileContent.fromSubtreeJson},
 * {@link Implicit3DTileContent.fromSubtreeGltf} 或 {@link Implicit3DTileContent.fromSubtreeGlb}.
 *
 * @implements Cesium3DTileContent
 * @private
 * @experimental This 该特性使用了 3D 瓦片规范中的部分内容，该规范尚未定稿且可能随 Cesium 标准弃用政策而变更。
 */
class Implicit3DTileContent {
  /**
   * @param {Cesium3DTileset} tileset 此内容所属的瓦片集
   * @param {Cesium3DTile} tile 此内容所属的瓦片。
   * @param {Resource} resource 瓦片集的资源
   * @param {object} [json] 包含子树的 JSON 对象。与 arrayBuffer 互斥。
   * @param {ArrayBuffer} [arrayBuffer] 存储内容有效载荷的 arrayBuffer。与 json 互斥。
   * @param {number} [byteOffset=0] 如果提供了，则指向 arrayBuffer 的偏移量
   *
   * @exception {DeveloperError} One json 和 arrayBuffer 必须定义清楚。
   */
  constructor(tileset, tile, resource) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("tile.implicitTileset", tile.implicitTileset);
    Check.defined("tile.implicitCoordinates", tile.implicitCoordinates);
    //>>includeEnd('debug');

    const implicitTileset = tile.implicitTileset;
    const implicitCoordinates = tile.implicitCoordinates;

    this._implicitTileset = implicitTileset;
    this._implicitCoordinates = implicitCoordinates;
    this._implicitSubtree = undefined;
    this._tileset = tileset;
    this._tile = tile;
    this._resource = resource;
    this._show = true;

    this._metadata = undefined;

    this.featurePropertiesDirty = false;
    this._group = undefined;

    /**
     * 创建此子树中每个瓦片的子节点。
     *
     * @type {Cesium3DTile.ImplicitChildrenCallback|undefined}
     * @private
     */
    this._implicitChildrenCallback = undefined;

    const templateValues = implicitCoordinates.getTemplateValues();
    const subtreeResource =
      implicitTileset.subtreeUriTemplate.getDerivedResource({
        templateValues: templateValues,
      });
    this._url = subtreeResource.getUrlComponent(true);

    this._ready = false;
  }

  get featuresLength() {
    return 0;
  }

  get pointsLength() {
    return 0;
  }

  get trianglesLength() {
    return 0;
  }

  get geometryByteLength() {
    return 0;
  }

  get texturesByteLength() {
    return 0;
  }

  get batchTableByteLength() {
    return 0;
  }

  get innerContents() {
    return undefined;
  }

  /**
   * 当瓦片内容准备好渲染时返回 true；否则返回 false。
   *
   *
   * @type {boolean}
   * @readonly
   * @private
   */
  get ready() {
    return this._ready;
  }

  get tileset() {
    return this._tileset;
  }

  get tile() {
    return this._tile;
  }

  get url() {
    return this._url;
  }

  /**
   * {@link Cesium3DTileContent} 接口的一部分。<code>Implicit3DTileContent</code>
   * 总是返回 <code>undefined</code>。只有转换后的瓦片才有内容元数据。
   * @private
   */
  get metadata() {
    return undefined;
  }

  set metadata(_) {
    //>>includeStart('debug', pragmas.debug);
    throw new DeveloperError("Implicit3DTileContent cannot have metadata");
    //>>includeEnd('debug');
  }

  get batchTable() {
    return undefined;
  }

  get group() {
    return this._group;
  }

  set group(value) {
    this._group = value;
  }

  /** @inheritdoc */
  get show() {
    return this._show;
  }

  set show(value) {
    this._show = value;
  }

  /**
   * 通过解析子树资源并设置
   * 一个承诺链来扩展直接子树来初始化隐式内容。
   *
   * @param {Cesium3DTileset} tileset 此内容所属的瓦片集
   * @param {Cesium3DTile} tile 此内容所属的瓦片。
   * @param {Resource} resource 瓦片集的资源
   * @param {object} [json] 包含子树的 JSON。与 arrayBuffer 互斥。
   * @param {ArrayBuffer} [arrayBuffer] 包含子树二进制数据的 ArrayBuffer。与 json 互斥。
   * @param {number} [byteOffset=0] 指向 arrayBuffer 的字节偏移量
   * @return {Promise<Implicit3DTileContent>}
   *
   * @exception {DeveloperError} One json 和 arrayBuffer 必须定义清楚。
   *
   * @private
   */
  static async fromSubtreeJson(
    tileset,
    tile,
    resource,
    json,
    arrayBuffer,
    byteOffset,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("tile.implicitTileset", tile.implicitTileset);
    Check.defined("tile.implicitCoordinates", tile.implicitCoordinates);
    if (defined(json) === defined(arrayBuffer)) {
      throw new DeveloperError("One of json and arrayBuffer must be defined.");
    }
    //>>includeEnd('debug');

    byteOffset = byteOffset ?? 0;
    let uint8Array;
    if (defined(arrayBuffer)) {
      uint8Array = new Uint8Array(arrayBuffer, byteOffset);
    }

    const implicitTileset = tile.implicitTileset;
    const implicitCoordinates = tile.implicitCoordinates;

    const subtree = await ImplicitSubtree.fromSubtreeJson(
      resource,
      json,
      uint8Array,
      implicitTileset,
      implicitCoordinates,
    );

    return createContentFromSubtree(tileset, tile, resource, subtree);
  }

  /**
   * 从以 glTF JSON 形式存储的子树中初始化隐式内容，使用
   * <code>3DTILES_subtree</code> 扩展。
   *
   * @param {Cesium3DTileset} tileset 此内容所属的瓦片集
   * @param {Cesium3DTile} tile 此内容所属的瓦片。
   * @param {Resource} resource 瓦片集的资源
   * @param {object} gltf 包含子树的 glTF JSON。其所有缓冲区必须具有 <code>uri</code>。
   * @return {Promise<Implicit3DTileContent>}
   *
   * @private
   */
  static async fromSubtreeGltf(tileset, tile, resource, gltf) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("tile.implicitTileset", tile.implicitTileset);
    Check.defined("tile.implicitCoordinates", tile.implicitCoordinates);
    Check.typeOf.object("gltf", gltf);
    //>>includeEnd('debug');

    const subtree = await ImplicitSubtree.fromSubtreeGltf(
      resource,
      gltf,
      tile.implicitTileset,
      tile.implicitCoordinates,
    );

    return createContentFromSubtree(tileset, tile, resource, subtree);
  }

  /**
   * 从以二进制 glTF (glb) 形式存储的子树中初始化隐式内容，使用
   * <code>3DTILES_subtree</code> 扩展。
   *
   * @param {Cesium3DTileset} tileset 此内容所属的瓦片集
   * @param {Cesium3DTile} tile 此内容所属的瓦片
   * @param {Resource} resource 瓦片集的资源
   * @param {ArrayBuffer} arrayBuffer 包含 glb 的 ArrayBuffer
   * @param {number} [byteOffset=0] ArrayBuffer 中的字节偏移量
   * @return {Promise<Implicit3DTileContent>}
   *
   * @private
   */
  static async fromSubtreeGlb(
    tileset,
    tile,
    resource,
    arrayBuffer,
    byteOffset,
  ) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("tile.implicitTileset", tile.implicitTileset);
    Check.defined("tile.implicitCoordinates", tile.implicitCoordinates);
    Check.typeOf.object("arrayBuffer", arrayBuffer);
    //>>includeEnd('debug');

    const glbView = new Uint8Array(arrayBuffer, byteOffset ?? 0);
    const subtree = await ImplicitSubtree.fromSubtreeGlb(
      resource,
      glbView,
      tile.implicitTileset,
      tile.implicitCoordinates,
    );

    return createContentFromSubtree(tileset, tile, resource, subtree);
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。<code>Implicit3DTileContent</code>
   * 总是返回 <code>false</code>，因为这种类型的瓦片没有任何特征。
   * @private
   */
  hasProperty(batchId, name) {
    return false;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。<code>Implicit3DTileContent</code>
   * 总是返回 <code>undefined</code>，因为这种类型的瓦片没有任何特征。
   * @private
   */
  getFeature(batchId) {
    return undefined;
  }

  applyDebugSettings(enabled, color) {}
  applyStyle(style) {}
  update(tileset, frameState) {}

  pick(ray, frameState, result) {
    return undefined;
  }

  isDestroyed() {
    return false;
  }

  destroy() {
    this._implicitSubtree =
      this._implicitSubtree && this._implicitSubtree.destroy();
    return destroyObject(this);
  }
}

/**
 * 为解析的子树创建内容并将子树展开为瓦片。
 *
 * @param {Cesium3DTileset} tileset 此内容所属的瓦片集
 * @param {Cesium3DTile} tile 此内容所属的瓦片
 * @param {Resource} resource 瓦片集的资源
 * @param {ImplicitSubtree} subtree 解析后的子树
 * @return {Implicit3DTileContent}
 * @private
 */
function createContentFromSubtree(tileset, tile, resource, subtree) {
  const content = new Implicit3DTileContent(tileset, tile, resource);

  content._implicitSubtree = subtree;
  expandSubtree(content, subtree);
  content._ready = true;

  return content;
}

/**
 * 展开单个子树占位符瓦片。这会生成根节点
 * {@link Cesium3DTile} 并将它存储在占位符瓦片的
 * children 数组中。子树的其余部分按需生成，因为
 * 遍历会向每个瓦片询问其子节点。
 *
 * @param {Implicit3DTileContent} content 内容
 * @param {ImplicitSubtree} subtree 解析后的子树
 * @private
 */
function expandSubtree(content, subtree) {
  const placeholderTile = content._tile;
  content._implicitChildrenCallback = (tile) =>
    deriveImplicitChildren(content, tile);

  const rootParentIsPlaceholder = true;
  const rootTile = deriveChildTile(
    content,
    subtree,
    placeholderTile,
    content._implicitCoordinates.childIndex,
    placeholderTile.implicitCoordinates,
    rootParentIsPlaceholder,
  );

  placeholderTile.children.push(rootTile);
  content._tileset.statistics.numberOfTilesTotal++;
}

/**
 * 获取子树中瓦片的可用子节点。位于
 * 子树顶部的瓦片则获得用于其子树的占位符瓦片。
 *
 * @param {Implicit3DTileContent} content 拥有子树的隐式内容
 * @param {Cesium3DTile} tile 用于生成子节点的瓦片
 * @private
 */
function deriveImplicitChildren(content, tile) {
  const subtree = content._implicitSubtree;
  if (!defined(subtree)) {
    return;
  }

  const implicitTileset = content._implicitTileset;
  const statistics = content._tileset.statistics;
  const coordinates = tile.implicitCoordinates;
  const atBottomOfSubtree = coordinates.isBottomOfSubtree();

  for (
    let childIndex = 0;
    childIndex < implicitTileset.branchingFactor;
    childIndex++
  ) {
    const childCoordinates = coordinates.getChildCoordinates(childIndex);

    let childTile;
    if (atBottomOfSubtree) {
      if (!subtree.childSubtreeIsAvailableAtCoordinates(childCoordinates)) {
        continue;
      }
      childTile = makePlaceholderChildSubtree(
        content,
        tile,
        childIndex,
        childCoordinates,
      );
    } else {
      if (!subtree.tileIsAvailableAtCoordinates(childCoordinates)) {
        continue;
      }
      childTile = deriveChildTile(
        content,
        subtree,
        tile,
        childIndex,
        childCoordinates,
      );
    }

    tile.children.push(childTile);
    statistics.numberOfTilesTotal++;
  }
}

function getGeometricError(tileMetadata, implicitTileset, implicitCoordinates) {
  const semantic = MetadataSemantic.TILE_GEOMETRIC_ERROR;

  if (defined(tileMetadata) && tileMetadata.hasPropertyBySemantic(semantic)) {
    return tileMetadata.getPropertyBySemantic(semantic);
  }

  return (
    implicitTileset.geometricError / Math.pow(2, implicitCoordinates.level)
  );
}

/**
 * 给定父瓦片及要创建哪个子节点的信息，隐式地生成
 * 子瓦片的属性。
 * <p>
 * 这创建的是用于渲染的真实瓦片，而不是像其他
 * ImplicitTileset 方法中的占位符瓦片。
 * </p>
 *
 * @param {Implicit3DTileContent} implicitContent 隐式内容
 * @param {ImplicitSubtree} subtree 子瓦片所属的子树
 * @param {Cesium3DTile} parentTile 新子瓦片的父节点
 * @param {number} childIndex 子瓦片相对于其父节点的 Morton 索引
 * @param {ImplicitTileCoordinates} implicitCoordinates 子瓦片的坐标
 * @param {boolean} [parentIsPlaceholderTile=false] 如果 parentTile 是占位符瓦片，则为真。每个子树的根节点均为如此。
 * @returns {Cesium3DTile} The 新子瓦片。
 * @private
 */
function deriveChildTile(
  implicitContent,
  subtree,
  parentTile,
  childIndex,
  implicitCoordinates,
  parentIsPlaceholderTile,
) {
  const implicitTileset = implicitContent._implicitTileset;

  // Parse metadata and bounding volume semantics at the beginning
  // as the bounding volumes are needed below.
  let tileMetadata;
  let tileBounds;
  if (defined(subtree.tilePropertyTableJson)) {
    tileMetadata = subtree.getTileMetadataView(implicitCoordinates);

    tileBounds = BoundingVolumeSemantics.parseAllBoundingVolumeSemantics(
      "TILE",
      tileMetadata,
    );
  }

  // Content is not loaded at this point, so this flag is set for future reference.
  const contentPropertyTableJsons = subtree.contentPropertyTableJsons;
  const length = contentPropertyTableJsons.length;
  let hasImplicitContentMetadata = false;
  for (let i = 0; i < length; i++) {
    if (subtree.contentIsAvailableAtCoordinates(implicitCoordinates, i)) {
      hasImplicitContentMetadata = true;
      break;
    }
  }

  const boundingVolume = getTileBoundingVolume(
    implicitTileset,
    implicitCoordinates,
    childIndex,
    parentIsPlaceholderTile,
    parentTile,
    tileBounds,
  );

  const contentJsons = [];
  for (let i = 0; i < implicitTileset.contentCount; i++) {
    if (!subtree.contentIsAvailableAtCoordinates(implicitCoordinates, i)) {
      continue;
    }
    const childContentTemplate = implicitTileset.contentUriTemplates[i];
    const childContentUri = childContentTemplate.getDerivedResource({
      templateValues: implicitCoordinates.getTemplateValues(),
    }).url;
    const contentJson = {
      uri: childContentUri,
    };

    let contentBounds;

    if (subtree.contentPropertyTableJsons.length > 0) {
      const contentMetadata = subtree.getContentMetadataView(
        implicitCoordinates,
        i,
      );

      contentBounds = BoundingVolumeSemantics.parseAllBoundingVolumeSemantics(
        "CONTENT",
        contentMetadata,
      );
    }

    const contentBoundingVolume = getContentBoundingVolume(
      boundingVolume,
      contentBounds,
    );

    if (defined(contentBoundingVolume)) {
      contentJson.boundingVolume = contentBoundingVolume;
    }

    // combine() is used to pass through any additional properties the
    // user specified such as extras or extensions
    contentJsons.push(combine(contentJson, implicitTileset.contentHeaders[i]));
  }

  const childGeometricError = getGeometricError(
    tileMetadata,
    implicitTileset,
    implicitCoordinates,
  );

  const tileJson = {
    boundingVolume: boundingVolume,
    geometricError: childGeometricError,
    refine: implicitTileset.refine,
    contents: contentJsons,
  };

  // combine() is used to pass through any additional properties the
  // user specified such as extras or extensions.
  const deep = true;
  const rootHeader = clone(implicitTileset.tileHeader, deep);
  // The bounding volume was computed above since it may come from metadata
  // in the subtree file.
  delete rootHeader.boundingVolume;
  // Copying the transform to all the transcoded tiles would cause the transform
  // to be applied multiple times. Removing it from the header avoids this issue.
  delete rootHeader.transform;
  // The implicit tiling spec does not specify what should happen if explicit
  // tile metadata is added to the placeholder tile. Since implicit tile
  // metadata comes from the subtree file, ignore the explicit version.
  //
  // Also, when a property with the semantic TILE_BOUNDING_VOLUME is added to
  // the placeholder tile to set a tight bounding volume (See Cesium3DTile.js)
  // propagating it to transcoded tiles causes transcoded tiles to use the
  // wrong bounding volume, this can lead to loading far too many tiles.
  delete rootHeader.metadata;
  const combinedTileJson = combine(tileJson, rootHeader, deep);

  const childTile = makeTile(
    implicitContent,
    implicitTileset.baseResource,
    combinedTileJson,
    parentTile,
  );

  childTile.implicitCoordinates = implicitCoordinates;
  childTile.implicitSubtree = subtree;
  childTile.metadata = tileMetadata;
  childTile.hasImplicitContentMetadata = hasImplicitContentMetadata;
  childTile._implicitChildrenCallback =
    implicitContent._implicitChildrenCallback;

  return childTile;
}

/**
 * 检查边界体积的高度是否可以更新。
 * 如果 minimumHeight/maximumHeight 参数
 * 被定义且边界体积是区域或 S2 单元，则返回真。
 *
 * @param {object} [boundingVolume] 边界体积
 * @param {object} [tileBounds] 瓦片边界
 * @param {number} [tileBounds.minimumHeight] 最小高度
 * @param {number} [tileBounds.maximumHeight] 最大高度
 * @returns {boolean} Whether 边界体积的高度可以更新
 * @private
 */
function canUpdateHeights(boundingVolume, tileBounds) {
  return (
    defined(boundingVolume) &&
    defined(tileBounds) &&
    (defined(tileBounds.minimumHeight) || defined(tileBounds.maximumHeight)) &&
    (hasExtension(boundingVolume, "3DTILES_bounding_volume_S2") ||
      defined(boundingVolume.region))
  );
}

/**
 * 更新边界体积的最小和最大高度。
 * 通常用于使用
 * <code>TILE_MINIMUM_HEIGHT</code> 和 <code>TILE_MAXIMUM_HEIGHT</code>
 * 语义来收紧边界体积。只有在相应情况下才会更新高度
 * 定义了最小高度/最大高度参数
 * 边界体积是一个区域或 S2 单元。
 *
 * @param {object} boundingVolume 边界体积
 * @param {object} [tileBounds] 瓦片边界
 * @param {number} [tileBounds.minimumHeight] 新的最小高度
 * @param {number} [tileBounds.maximumHeight] 新的最大高度
 * @private
 */
function updateHeights(boundingVolume, tileBounds) {
  if (!defined(tileBounds)) {
    return;
  }

  if (hasExtension(boundingVolume, "3DTILES_bounding_volume_S2")) {
    updateS2CellHeights(
      boundingVolume.extensions["3DTILES_bounding_volume_S2"],
      tileBounds.minimumHeight,
      tileBounds.maximumHeight,
    );
  } else if (defined(boundingVolume.region)) {
    updateRegionHeights(
      boundingVolume.region,
      tileBounds.minimumHeight,
      tileBounds.maximumHeight,
    );
  }
}

/**
 * 对于边界区域，更新最小和最大高度。这通常用于使用
 * <code>TILE_MINIMUM_HEIGHT</code> 和 <code>TILE_MAXIMUM_HEIGHT</code>
 * 语义来收紧边界体积。
 * 只有当相应的
 * 最小高度/最大高度参数被定义时，高度才会更新。
 *
 * @param {Array} region 描述边界区域的6元素数组
 * @param {number} [minimumHeight] 新的最小高度
 * @param {number} [maximumHeight] 新的最大高度
 * @private
 */
function updateRegionHeights(region, minimumHeight, maximumHeight) {
  if (defined(minimumHeight)) {
    region[4] = minimumHeight;
  }

  if (defined(maximumHeight)) {
    region[5] = maximumHeight;
  }
}

/**
 * 对于边界的 S2 单元，更新最小和最大高度。这通常用于使用
 * <code>TILE_MINIMUM_HEIGHT</code> 和 <code>TILE_MAXIMUM_HEIGHT</code>
 * 语义来收紧边界体积。只有当相应的
 * 最小高度/最大高度参数被定义时，高度才会更新。
 * 最小高度/最大高度参数被定义时，才会更新。
 *
 * @param {object} s2CellVolume 描述 S2 单元的对象
 * @param {number} [minimumHeight] 新的最小高度
 * @param {number} [maximumHeight] 新的最大高度
 * @private
 */
function updateS2CellHeights(s2CellVolume, minimumHeight, maximumHeight) {
  if (defined(minimumHeight)) {
    s2CellVolume.minimumHeight = minimumHeight;
  }

  if (defined(maximumHeight)) {
    s2CellVolume.maximumHeight = maximumHeight;
  }
}

/**
 * 获取瓦片的边界体积，该体积可以通过
 * 元数据语义如 TILE_BOUNDING_BOX 或隐式方式指定
 * 从隐式根瓦片的边界体积中推导出来。
 * <p>
 * 边界体积类型的优先级：
 * <ol>
 * <li>显式的最小/最大高度
 *   <ol>
 * <li>带有显式区域
 * <li>带有隐式 S2
 * <li>带有隐式区域
 *   </ol>
 * </li>
 * <li>显式框形
 * <li>显式区域
 * <li>显式球体
 * <li>隐式 S2
 * <li>隐式框形
 * <li>隐式区域
 * </ol>
 * </p>
 *
 * @param {ImplicitTileset} implicitTileset 包含根边界体积的隐式瓦片集结构
 * @param {ImplicitTileCoordinates} implicitCoordinates 子瓦片的坐标
 * @param {number} childIndex 子瓦片相对于其父瓦片的莫顿索引
 * @param {boolean} parentIsPlaceholderTile 如果父瓦片是占位符瓦片，则为真。每个子树的根节点均为如此。
 * @param {Cesium3DTile} parentTile 新子瓦片的父瓦片
 * @param {object} [tileBounds] 瓦片边界
 * @returns {object} An 包含边界体积的 JSON 的对象
 * @private
 */
function getTileBoundingVolume(
  implicitTileset,
  implicitCoordinates,
  childIndex,
  parentIsPlaceholderTile,
  parentTile,
  tileBounds,
) {
  let boundingVolume;

  if (
    !defined(tileBounds) ||
    !defined(tileBounds.boundingVolume) ||
    (!canUpdateHeights(tileBounds.boundingVolume, tileBounds) &&
      canUpdateHeights(implicitTileset.boundingVolume, tileBounds))
  ) {
    boundingVolume = deriveBoundingVolume(
      implicitTileset,
      implicitCoordinates,
      childIndex,
      parentIsPlaceholderTile ?? false,
      parentTile,
    );
  } else {
    boundingVolume = tileBounds.boundingVolume;
  }

  // The TILE_MINIMUM_HEIGHT and TILE_MAXIMUM_HEIGHT metadata semantics
  // can be used to tighten the bounding volume
  updateHeights(boundingVolume, tileBounds);

  return boundingVolume;
}

/**
 * 获取内容边界体积，该体积可以通过
 * 元数据语义如 CONTENT_BOUNDING_BOX 指定。
 * <p>
 * 边界体积类型的优先级：
 * <ol>
 * <li>显式最小/最大高度
 *   <ol>
 * <li>带有显式区域
 * <li>带有瓦片边界体积（S2 或区域）
 *   </ol>
 * </li>
 * <li>显式框形
 * <li>显式区域
 * <li>显式球体
 * <li>瓦片边界体积（当 content.boundingVolume 未定义时）
 * </ol>
 * </p>
 *
 * @param {object} tileBoundingVolume 包含瓦片边界体积的 JSON 对象
 * @param {object} [contentBounds] 内容边界
 * @returns {object|undefined} An 包含边界体积的 JSON 对象，如果没有边界体积则为 <code>undefined</code>
 * @private
 */
function getContentBoundingVolume(tileBoundingVolume, contentBounds) {
  // content bounding volumes can only be specified via
  // metadata semantics such as CONTENT_BOUNDING_BOX
  let contentBoundingVolume;
  if (defined(contentBounds)) {
    contentBoundingVolume = contentBounds.boundingVolume;
  }

  // The CONTENT_MINIMUM_HEIGHT and CONTENT_MAXIMUM_HEIGHT metadata semantics
  // can be used to tighten the bounding volume
  if (canUpdateHeights(contentBoundingVolume, contentBounds)) {
    updateHeights(contentBoundingVolume, contentBounds);
  } else if (canUpdateHeights(tileBoundingVolume, contentBounds)) {
    contentBoundingVolume = clone(tileBoundingVolume, true);
    updateHeights(contentBoundingVolume, contentBounds);
  }

  return contentBoundingVolume;
}

/**
 * 根据瓦片的坐标，从根瓦片推导其边界体积。
 *
 * @param {ImplicitTileset} implicitTileset 包含根边界体积的隐式瓦片集结构。
 * @param {ImplicitTileCoordinates} implicitCoordinates 子瓦片的坐标。
 * @param {number} childIndex 子瓦片相对于其父瓦片的莫顿索引。
 * @param {boolean} parentIsPlaceholderTile 如果父瓦片是占位瓦片，则为真。每个子树的根都满足此条件。
 * @param {Cesium3DTile} parentTile 新子瓦片的父瓦片。
 * @returns {object} An 包含边界体积JSON的对象。
 * @private
 */
function deriveBoundingVolume(
  implicitTileset,
  implicitCoordinates,
  childIndex,
  parentIsPlaceholderTile,
  parentTile,
) {
  const rootBoundingVolume = implicitTileset.boundingVolume;

  if (hasExtension(rootBoundingVolume, "3DTILES_bounding_volume_S2")) {
    return deriveBoundingVolumeS2(
      parentIsPlaceholderTile,
      parentTile,
      childIndex,
      implicitCoordinates.level,
      implicitCoordinates.x,
      implicitCoordinates.y,
      implicitCoordinates.z,
    );
  }

  if (defined(rootBoundingVolume.region)) {
    const childRegion = deriveBoundingRegion(
      rootBoundingVolume.region,
      implicitCoordinates.level,
      implicitCoordinates.x,
      implicitCoordinates.y,
      implicitCoordinates.z,
    );

    return {
      region: childRegion,
    };
  }

  const childBox = deriveBoundingBox(
    rootBoundingVolume.box,
    implicitCoordinates.level,
    implicitCoordinates.x,
    implicitCoordinates.y,
    implicitCoordinates.z,
  );

  return {
    box: childBox,
  };
}

/**
 * 为后代瓦片（子瓦片、孙瓦片等）推导边界体积，
 * 假设使用四叉树或八叉树隐式划分方案。(层级, x, y, [z])
 * 给定坐标以选择后代瓦片并计算其位置和尺寸。
 * 如果存在 z 值，则使用八叉树细分。否则，使用四叉树细分。
 * <p>
 * 如果存在 z 值，则使用八叉树细分。否则，使用四叉树细分。四叉树总是在水平尺寸的中点处进行划分，
 * 即 (x, y)，而 z 轴保持不变。
 * 如果父瓦片是占位瓦片，则为真。每个子树的根都满足此条件。
 * </p>
 *
 * @param {boolean} parentIsPlaceholderTile 新子瓦片的父瓦片。
 * @param {Cesium3DTile} parentTile 子瓦片相对于其父瓦片的莫顿索引。
 * @param {number} childIndex 后代瓦片相对于根隐式瓦片的层级。
 * @param {number} level 后代瓦片相对于根隐式瓦片的层级。
 * @param {number} x 后代瓦片的 x 坐标。
 * @param {number} y 后代瓦片的 y 坐标。
 * @param {number} [z] 后代瓦片的 z 坐标（仅适用于八叉树）。
 * @returns {object} An 具有 3DTILES_bounding_volume_S2 扩展名的对象。
 * @private
 */
function deriveBoundingVolumeS2(
  parentIsPlaceholderTile,
  parentTile,
  childIndex,
  level,
  x,
  y,
  z,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.bool("parentIsPlaceholderTile", parentIsPlaceholderTile);
  Check.typeOf.object("parentTile", parentTile);
  Check.typeOf.number("childIndex", childIndex);
  Check.typeOf.number("level", level);
  Check.typeOf.number("x", x);
  Check.typeOf.number("y", y);
  if (defined(z)) {
    Check.typeOf.number("z", z);
  }
  //>>includeEnd('debug');

  const boundingVolumeS2 = parentTile._boundingVolume;

  // Handle the placeholder tile case, where we just duplicate the placeholder's bounding volume.
  if (parentIsPlaceholderTile) {
    return {
      extensions: {
        "3DTILES_bounding_volume_S2": {
          token: S2Cell.getTokenFromId(boundingVolumeS2.s2Cell._cellId),
          minimumHeight: boundingVolumeS2.minimumHeight,
          maximumHeight: boundingVolumeS2.maximumHeight,
        },
      },
    };
  }

  // Extract the first 3 face bits from the 64-bit S2 cell ID.
  const face = Number(parentTile._boundingVolume.s2Cell._cellId >> BigInt(61));
  // The Hilbert curve is rotated for the "odd" faces on the S2 Earthcube.
  // See http://s2geometry.io/devguide/img/s2cell_global.jpg
  const position =
    face % 2 === 0
      ? HilbertOrder.encode2D(level, x, y)
      : HilbertOrder.encode2D(level, y, x);
  const cell = S2Cell.fromFacePositionLevel(face, BigInt(position), level);

  let minHeight, maxHeight;
  if (defined(z)) {
    const midpointHeight =
      (boundingVolumeS2.maximumHeight + boundingVolumeS2.minimumHeight) / 2;
    minHeight =
      childIndex < 4 ? boundingVolumeS2.minimumHeight : midpointHeight;
    maxHeight =
      childIndex < 4 ? midpointHeight : boundingVolumeS2.maximumHeight;
  } else {
    minHeight = boundingVolumeS2.minimumHeight;
    maxHeight = boundingVolumeS2.maximumHeight;
  }

  return {
    extensions: {
      "3DTILES_bounding_volume_S2": {
        token: S2Cell.getTokenFromId(cell._cellId),
        minimumHeight: minHeight,
        maximumHeight: maxHeight,
      },
    },
  };
}

const scratchScaleFactors = new Cartesian3();
const scratchRootCenter = new Cartesian3();
const scratchCenter = new Cartesian3();
const scratchHalfAxes = new Matrix3();
/**
 * 为后代瓦片（子瓦片、孙瓦片等）推导边界体积，
 * 假设使用四叉树或八叉树隐式划分方案。(层级, x, y, [z])
 * 给定坐标以选择后代瓦片并计算其位置和尺寸。
 * 如果存在 z 值，则使用八叉树细分。否则，使用四叉树细分。
 * <p>
 * 如果存在 z 值，则使用八叉树细分。否则，使用四叉树细分。四叉树总是在水平尺寸的中点处进行划分，
 * 即 (x, y)，而 z 轴保持不变。
 * 此方法直接从根边界体积计算子瓦片的体积，
 * </p>
 * <p>
 * 而不是通过递归细分来最小化浮点误差。
 * 12个数字组成的数组，表示根瓦片的边界框。
 * </p>
 *
 * @param {number[]} rootBox 后代瓦片相对于根隐式瓦片的层级。
 * @param {number} level 后代瓦片的 x 坐标。
 * @param {number} x 后代瓦片的 y 坐标。
 * @param {number} y 后代瓦片的 z 坐标（仅适用于八叉树）。
 * @param {number} [z] 12个数字组成的数组，表示后代瓦片的边界框。
 * @returns {number[]} An 为后代瓦片（子瓦片、孙瓦片等）推导边界体积。
 * @private
 */
function deriveBoundingBox(rootBox, level, x, y, z) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("rootBox", rootBox);
  Check.typeOf.number("level", level);
  Check.typeOf.number("x", x);
  Check.typeOf.number("y", y);
  if (defined(z)) {
    Check.typeOf.number("z", z);
  }
  //>>includeEnd('debug');

  if (level === 0) {
    return rootBox;
  }

  const rootCenter = Cartesian3.unpack(rootBox, 0, scratchRootCenter);
  const rootHalfAxes = Matrix3.unpack(rootBox, 3, scratchHalfAxes);

  const tileScale = Math.pow(2, -level);
  const modelSpaceX = -1 + (2 * x + 1) * tileScale;
  const modelSpaceY = -1 + (2 * y + 1) * tileScale;

  let modelSpaceZ = 0;
  const scaleFactors = Cartesian3.fromElements(
    tileScale,
    tileScale,
    1,
    scratchScaleFactors,
  );

  if (defined(z)) {
    modelSpaceZ = -1 + (2 * z + 1) * tileScale;
    scaleFactors.z = tileScale;
  }

  let center = Cartesian3.fromElements(
    modelSpaceX,
    modelSpaceY,
    modelSpaceZ,
    scratchCenter,
  );
  center = Matrix3.multiplyByVector(rootHalfAxes, center, scratchCenter);
  center = Cartesian3.add(center, rootCenter, scratchCenter);

  let halfAxes = Matrix3.clone(rootHalfAxes);
  halfAxes = Matrix3.multiplyByScale(halfAxes, scaleFactors, halfAxes);

  const childBox = new Array(12);
  Cartesian3.pack(center, childBox);
  Matrix3.pack(halfAxes, childBox, 3);
  return childBox;
}

const scratchRectangle = new Rectangle();
/**
 * Derive a bounding volume for a descendant tile (child, grandchild, etc.),
 * 采用四叉树或八叉树隐式切片方案。该参数表示（层级，x，y，[z]）坐标，用于选择子级切片并计算其位置及尺寸。
 * 选择子级切片并计算其位置时使用的坐标。
 * 和尺寸。
 * <p>
 * 如果包含 z 值，则使用八叉树细分；否则使用四叉树细分。四叉树总是在水平尺寸的中点处进行分割，即（中纬度，中纬度），而高度值保持不变。
 * 此方法直接从根边界体积计算子体积，而非通过递归细分来最小化浮点误差。
 * 表示根隐式切片内容的6个数字数组。
 * 相对于根隐式切片子的层级。
 * </p>
 * <p>
 * 直接从根边界体积计算子体积，而非通过递归细分来最小化浮点误差。
 * 6个数字数组，表示子切片边界区域。
 * </p>
 * @param {number[]} rootRegion 用于创建内容为 Implicit3DTileContent 的占位符3D 切片。
 * @param {number} level 相对于根隐式切片子的子切片层级。
 * @param {number} x 子切片的 x 坐标。
 * @param {number} y 子切片的 x 坐标。
 * @param {number} [z] 子切片的 z 坐标（仅适用于八叉树）。
 * @returns {number[]} An 6个数字数组，表示子切片的边界区域。
 * @private
 */
function deriveBoundingRegion(rootRegion, level, x, y, z) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("rootRegion", rootRegion);
  Check.typeOf.number("level", level);
  Check.typeOf.number("x", x);
  Check.typeOf.number("y", y);
  if (defined(z)) {
    Check.typeOf.number("z", z);
  }
  //>>includeEnd('debug');

  if (level === 0) {
    return rootRegion.slice();
  }

  const rectangle = Rectangle.unpack(rootRegion, 0, scratchRectangle);
  const rootMinimumHeight = rootRegion[4];
  const rootMaximumHeight = rootRegion[5];
  const tileScale = Math.pow(2, -level);

  const childWidth = tileScale * rectangle.width;
  const west = CesiumMath.negativePiToPi(rectangle.west + x * childWidth);
  const east = CesiumMath.negativePiToPi(west + childWidth);

  const childHeight = tileScale * rectangle.height;
  const south = CesiumMath.negativePiToPi(rectangle.south + y * childHeight);
  const north = CesiumMath.negativePiToPi(south + childHeight);

  // Height is only subdivided for octrees; It remains constant for quadtrees.
  let minimumHeight = rootMinimumHeight;
  let maximumHeight = rootMaximumHeight;
  if (defined(z)) {
    const childThickness = tileScale * (rootMaximumHeight - rootMinimumHeight);
    minimumHeight += z * childThickness;
    maximumHeight = minimumHeight + childThickness;
  }

  return [west, south, east, north, minimumHeight, maximumHeight];
}

/**
 * 创建一个占位符3D 切片，其内容为 Implicit3DTileContent。
 * 用于延迟评估子子树的内容。
 *
 * @param {Implicit3DTileContent} content 内容对象。
 * @param {Cesium3DTile} parentTile 新子子树的父切片。
 * @param {number} childIndex 子切片相对于其父切片的 Morton 索引。
 * @param {ImplicitTileCoordinates} implicitCoordinates 子子树根切片的坐标。
 * @returns {Cesium3DTile} The 新的占位符切片。
 * @private
 */
function makePlaceholderChildSubtree(
  content,
  parentTile,
  childIndex,
  implicitCoordinates,
) {
  const implicitTileset = content._implicitTileset;

  const childBoundingVolume = deriveBoundingVolume(
    implicitTileset,
    implicitCoordinates,
    childIndex,
    false,
    parentTile,
  );

  // Ignore tile metadata when computing geometric error for the placeholder tile
  // since the child subtree's metadata hasn't been loaded yet.
  // The actual geometric error will be computed in deriveChildTile.
  const childGeometricError = getGeometricError(
    undefined,
    implicitTileset,
    implicitCoordinates,
  );

  const childContentUri = implicitTileset.subtreeUriTemplate.getDerivedResource(
    {
      templateValues: implicitCoordinates.getTemplateValues(),
    },
  ).url;
  const tileJson = {
    boundingVolume: childBoundingVolume,
    geometricError: childGeometricError,
    refine: implicitTileset.refine,
    contents: [
      {
        uri: childContentUri,
      },
    ],
  };

  const tile = makeTile(
    content,
    implicitTileset.baseResource,
    tileJson,
    parentTile,
  );
  tile.implicitTileset = implicitTileset;
  tile.implicitCoordinates = implicitCoordinates;
  return tile;
}

/**
 * 创建 {@link Cesium3DTile}。此方式使用切片内容的构造函数，而非导入 Cesium3DTile。这样做可避免
 * 本文件与 Cesium3DTile.js 之间的循环依赖。
 * 此文件与 Cesium3DTile.js 之间的循环依赖。
 * @param {Implicit3DTileContent} content 隐式内容。
 * @param {Resource} baseResource 切片集的基础资源。
 * @param {object} tileJson 切片的 JSON 头部信息。
 * @param {Cesium3DTile} parentTile 新切片的父切片。
 * @returns {Cesium3DTile} The 新创建的切片。
 * @private
 */
function makeTile(content, baseResource, tileJson, parentTile) {
  const Cesium3DTile = content._tile.constructor;
  return new Cesium3DTile(content._tileset, baseResource, tileJson, parentTile);
}

// Exposed for testing
Implicit3DTileContent._deriveBoundingBox = deriveBoundingBox;
Implicit3DTileContent._deriveBoundingRegion = deriveBoundingRegion;
Implicit3DTileContent._deriveBoundingVolumeS2 = deriveBoundingVolumeS2;

export default Implicit3DTileContent;
