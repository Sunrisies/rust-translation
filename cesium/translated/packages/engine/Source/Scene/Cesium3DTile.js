import {
  BoundingSphere,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  CullingVolume,
  Ellipsoid,
  Intersect,
  JulianDate,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  OrientedBoundingBox,
  OrthographicFrustum,
  Rectangle,
  RuntimeError,
  VerticalExaggeration,
  defined,
  deprecationWarning,
  destroyObject,
} from "@cesium/core";
import Request from "../Core/Request.js";
import RequestScheduler from "../Core/RequestScheduler.js";
import RequestState from "../Core/RequestState.js";
import RequestType from "../Core/RequestType.js";
import Resource from "../Core/Resource.js";
import Cesium3DContentGroup from "./Cesium3DContentGroup.js";
import Cesium3DTileContentFactory from "./Cesium3DTileContentFactory.js";
import Cesium3DTileContentState from "./Cesium3DTileContentState.js";
import Cesium3DTileContentType from "./Cesium3DTileContentType.js";
import Cesium3DTileOptimizationHint from "./Cesium3DTileOptimizationHint.js";
import Cesium3DTilePass from "./Cesium3DTilePass.js";
import Cesium3DTileRefine from "./Cesium3DTileRefine.js";
import Empty3DTileContent from "./Empty3DTileContent.js";
import findContentMetadata from "./findContentMetadata.js";
import findGroupMetadata from "./findGroupMetadata.js";
import findTileMetadata from "./findTileMetadata.js";
import hasExtension from "./hasExtension.js";
import Multiple3DTileContent from "./Multiple3DTileContent.js";
import BoundingVolumeSemantics from "./BoundingVolumeSemantics.js";
import preprocess3DTileContent from "./preprocess3DTileContent.js";
import SceneMode from "./SceneMode.js";
import TileBoundingRegion from "./TileBoundingRegion.js";
import TileBoundingS2Cell from "./TileBoundingS2Cell.js";
import TileBoundingSphere from "./TileBoundingSphere.js";
import TileOrientedBoundingBox from "./TileOrientedBoundingBox.js";
import Pass from "../Renderer/Pass.js";

/**
 * 一个 {@link Cesium3DTileset} 中的瓦片。当瓦片首次创建时，其内容尚未加载；
 * 根据视图需求按需加载内容。
 * <p>
 * 不要直接构造此对象，应通过 {@link Cesium3DTileset#tileVisible} 访问瓦片。
 * </p>
 *
 * @alias Cesium3DTile
 * @constructor
 * @param {Cesium3DTileset} tileset 瓦片集
 * @param {Resource} baseResource 瓦片集的基础资源
 * @param {object} header 瓦片的 JSON 头信息
 * @param {Cesium3DTile} parent 新瓦片的父瓦片
 */
function Cesium3DTile(tileset, baseResource, header, parent) {
  this._tileset = tileset;
  this._header = header;

  const hasContentsArray = defined(header.contents);
  const hasMultipleContents =
    (hasContentsArray && header.contents.length > 1) ||
    hasExtension(header, "3DTILES_multiple_contents");

  // In the 1.0 schema, content is stored in tile.content instead of tile.contents
  const contentHeader =
    hasContentsArray && !hasMultipleContents
      ? header.contents[0]
      : header.content;

  this._contentHeader = contentHeader;

  const hasTransform = defined(header.transform);

  /**
   * 此瓦片的本地变换。
   * @type {Matrix4}
   */
  this.transform = hasTransform
    ? Matrix4.unpack(header.transform)
    : Matrix4.clone(Matrix4.IDENTITY);

  const parentTransform = defined(parent)
    ? parent.computedTransform
    : tileset.modelMatrix;
  const computedTransform = hasTransform
    ? Matrix4.multiply(parentTransform, this.transform, new Matrix4())
    : Matrix4.clone(parentTransform);

  const parentInitialTransform = defined(parent)
    ? parent._initialTransform
    : Matrix4.IDENTITY;
  this._initialTransform = hasTransform
    ? Matrix4.multiply(parentInitialTransform, this.transform, new Matrix4())
    : Matrix4.clone(parentInitialTransform);

  /**
   * 此瓦片的最终计算变换。
   * @type {Matrix4}
   * @readonly
   */
  this.computedTransform = computedTransform;

  /**
   * 当存在瓦片元数据（3D Tiles 1.1）或使用 <code>3DTILES_metadata</code> 扩展时，
   * 会存储一个 {@link TileMetadata} 对象以访问瓦片元数据。
   *
   * @type {TileMetadata}
   * @readonly
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，这部分内容尚未定稿，可能会因 Cesium 标准弃用政策而变更。
   */
  this.metadata = findTileMetadata(tileset, header);

  this._verticalExaggeration = 1.0;
  this._verticalExaggerationRelativeHeight = 0.0;

  // Important: tile metadata must be parsed before this line so that the
  // metadata semantics TILE_BOUNDING_BOX, TILE_BOUNDING_REGION, or TILE_BOUNDING_SPHERE
  // can override header.boundingVolume (if necessary)
  this._boundingVolume = this.createBoundingVolume(
    header.boundingVolume,
    computedTransform,
  );
  this._boundingVolume2D = undefined;

  let contentBoundingVolume;

  if (defined(contentHeader) && defined(contentHeader.boundingVolume)) {
    // Non-leaf tiles may have a content bounding-volume, which is a tight-fit bounding volume
    // around only the features in the tile.  This box is useful for culling for rendering,
    // but not for culling for traversing the tree since it does not guarantee spatial coherence, i.e.,
    // since it only bounds features in the tile, not the entire tile, children may be
    // outside of this box.
    contentBoundingVolume = this.createBoundingVolume(
      contentHeader.boundingVolume,
      computedTransform,
    );
  }
  this._contentBoundingVolume = contentBoundingVolume;
  this._contentBoundingVolume2D = undefined;

  let viewerRequestVolume;
  if (defined(header.viewerRequestVolume)) {
    viewerRequestVolume = this.createBoundingVolume(
      header.viewerRequestVolume,
      computedTransform,
    );
  }
  this._viewerRequestVolume = viewerRequestVolume;

  /**
   * 如果此瓦片被渲染而其子瓦片未被渲染，则会产生以米为单位的错误。
   * 用于计算屏幕空间误差，即以像素为单位测量的误差。
   *
   * @type {number}
   * @readonly
   */
  this.geometricError = header.geometricError;
  this._geometricError = header.geometricError;

  if (!defined(this._geometricError)) {
    this._geometricError = defined(parent)
      ? parent._geometricError
      : tileset._geometricError;
    Cesium3DTile._deprecationWarning(
      "geometricErrorUndefined",
      "Required property geometricError is undefined for this tile. Using parent's geometric error instead.",
    );
  }

  this.updateGeometricErrorScale();

  let refine;
  if (defined(header.refine)) {
    if (header.refine === "replace" || header.refine === "add") {
      Cesium3DTile._deprecationWarning(
        "lowercase-refine",
        `This tile uses a lowercase refine "${
          header.refine
        }". Instead use "${header.refine.toUpperCase()}".`,
      );
    }
    refine =
      header.refine.toUpperCase() === "REPLACE"
        ? Cesium3DTileRefine.REPLACE
        : Cesium3DTileRefine.ADD;
  } else if (defined(parent)) {
    // Inherit from parent tile if omitted.
    refine = parent.refine;
  } else {
    refine = Cesium3DTileRefine.REPLACE;
  }

  /**
   * 指定在渲染此瓦片时使用的细化类型。
   *
   * @type {Cesium3DTileRefine}
   * @readonly
   * @private
   */
  this.refine = refine;

  /**
   * 支持 <code>children</code> 属性。
   *
   * @type {Cesium3DTile[]}
   * @readonly
   * @private
   */
  this._children = [];

  /**
   * 当请求时创建此瓦片的隐式子瓦片，或者
   * 如果此瓦片不属于隐式瓦片集，则设为 <code>undefined</code>。
   *
   * @type {Cesium3DTile.ImplicitChildrenCallback|undefined}
   * @private
   */
  this._implicitChildrenCallback = undefined;

  /**
   * <code>_children</code> 是否包含隐式子瓦片。
   *
   * @type {boolean}
   * @private
   */
  this._implicitChildrenCreated = false;

  /**
   * 此瓦片的父瓦片，如果此瓦片是根节点则设为 <code>undefined</code>。
   * <p>
   * 当瓦片内容指向外部瓦片集 JSON 文件时，外部瓦片集的
   * 根瓦片的父瓦片不为 <code>undefined</code>；相反，父瓦片引用
   * 该瓦片（其内容指向外部瓦片集 JSON 文件），就好像两个瓦片集合并在一起一样。
   * </p>
   *
   * @type {Cesium3DTile}
   * @readonly
   */
  this.parent = parent;

  let content;
  let hasEmptyContent = false;
  let contentState;
  let contentResource;
  let serverKey;

  baseResource = Resource.createIfNeeded(baseResource);

  if (hasMultipleContents) {
    contentState = Cesium3DTileContentState.UNLOADED;
    // Each content may have its own URI, but they all need to be resolved
    // relative to the tileset, so the base resource is used.
    contentResource = baseResource.clone();
  } else if (defined(contentHeader)) {
    let contentHeaderUri = contentHeader.uri;
    if (defined(contentHeader.url)) {
      Cesium3DTile._deprecationWarning(
        "contentUrl",
        'This tileset JSON uses the "content.url" property which has been deprecated. Use "content.uri" instead.',
      );
      contentHeaderUri = contentHeader.url;
    }
    if (contentHeaderUri === "") {
      Cesium3DTile._deprecationWarning(
        "contentUriEmpty",
        "content.uri property is an empty string, which creates a circular dependency, making this tileset invalid. Omit the content property instead",
      );
      content = new Empty3DTileContent(tileset, this);
      hasEmptyContent = true;
      contentState = Cesium3DTileContentState.READY;
    } else {
      contentState = Cesium3DTileContentState.UNLOADED;
      contentResource = baseResource.getDerivedResource({
        url: contentHeaderUri,
      });
      serverKey = RequestScheduler.getServerKey(
        contentResource.getUrlComponent(),
      );
    }
  } else {
    content = new Empty3DTileContent(tileset, this);
    hasEmptyContent = true;
    contentState = Cesium3DTileContentState.READY;
  }

  this._content = content;
  this._contentResource = contentResource;
  this._contentState = contentState;
  this._expiredContent = undefined;

  this._serverKey = serverKey;

  /**
   * 当 <code>true</code> 时，该瓦片没有内容。
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  this.hasEmptyContent = hasEmptyContent;

  /**
   * 当 <code>true</code> 时，该瓦片的内容指向外部瓦片集。
   * <p>
   * 在瓦片内容加载之前，此值为 <code>false</code>。
   * </p>
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  this.hasTilesetContent = false;

  /**
   * 当 <code>true</code> 时，该瓦片的内容是一个隐式瓦片集。
   * <p>
   * 在瓦片的隐式内容加载之前，此值为 <code>false</code>。
   * </p>
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，这部分内容尚未定稿，可能会因 Cesium 标准弃用政策而变更。
   */
  this.hasImplicitContent = false;

  /**
   * 确定该瓦片是否有可渲染内容。
   *
   * 加载过程基于假设该瓦片确实有
   * 可渲染内容，如果内容不为空。<br>
   * <br>
   * 只有当瓦片内容被加载时，此值才变为 <code>false</code>。
   * 且实际上是指向外部的单一项内容
   * tileset 或隐式内容
   * </p>
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  this.hasRenderableContent = !hasEmptyContent;

  /**
   * 当 <code>true</code> 时，瓦片包含来自隐式平铺的内容元数据。此标志被设置
   * 用于由 <code>Implicit3DTileContent</code> 转码的瓦片。
   * <p>
   * 在瓦片内容加载之前，此值为 <code>false</code>。
   * </p>
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分内容。
   */
  this.hasImplicitContentMetadata = false;

  /**
   * 当 <code>true</code> 时，瓦片包含多种内容，既可以在瓦片 JSON 中（3D Tiles 1.1）
   * 也可以通过 <code>3DTILES_multiple_contents</code> 扩展实现。
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_multiple_contents|3DTILES_multiple_contents extension}
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  this.hasMultipleContents = hasMultipleContents;

  /**
   * 是 tileset 的 LRU 缓存中的节点，用于确定何时卸载瓦片内容。
   *
   * 参见 {@link Cesium3DTilesetCache}
   *
   * @type {DoublyLinkedListNode}
   * @readonly
   *
   * @private
   */
  this.cacheNode = undefined;

  const expire = header.expire;
  let expireDuration;
  let expireDate;
  if (defined(expire)) {
    expireDuration = expire.duration;
    if (defined(expire.date)) {
      expireDate = JulianDate.fromIso8601(expire.date);
    }
  }

  /**
   * 内容准备就绪后到其过期并请求新内容之间的秒数。
   *
   * @type {number}
   */
  this.expireDuration = expireDuration;

  /**
   * 内容过期的日期以及请求新内容的日期。
   *
   * @type {JulianDate}
   */
  this.expireDate = expireDate;

  /**
   * 样式最后一次应用于该瓦片的时间。
   *
   * @type {number}
   *
   * @private
   */
  this.lastStyleTime = 0.0;

  /**
   * 标记瓦片的子边界是否完全包含在瓦片边界内。
   *
   * @type {Cesium3DTileOptimizationHint}
   *
   * @private
   */
  this._optimChildrenWithinParent = Cesium3DTileOptimizationHint.NOT_COMPUTED;

  /**
   * 跟踪瓦片与 ClippingPlaneCollection 的关系是否因
   * ClippingPlaneCollection 的状态而发生变化。
   *
   * @type {boolean}
   *
   * @private
   */
  this.clippingPlanesDirty = false;

  /**
   * 跟踪瓦片与 ClippingPolygonCollection 的关系是否因
   * ClippingPolygonCollection 的状态而发生变化。
   *
   * @type {boolean}
   *
   * @private
   */
  this.clippingPolygonsDirty = false;

  /**
   * 跟踪 tileset 的 ClippingPolygonCollection 几何形状是否改变（添加了或删除了多边形），
   * 这要求瓦片内容重新生成裁剪纹理。
   *
   * @type {boolean}
   *
   * @private
   */
  this.clippingPolygonsNeedRebake = false;

  /**
   * 跟踪是否应推迟瓦片的请求，直到所有未推迟的
   * 瓦片加载完成。
   *
   * @type {boolean}
   *
   * @private
   */
  this.priorityDeferred = false;

  /**
   * 对于隐式平铺，一个 ImplicitTileset 对象将附加到一个
   * 占位符瓦片，通过 JSON 中的隐式平铺（3D Tiles 1.1）
   * 或 <code>3DTILES_implicit_tiling</code> 扩展实现。
   * 这样 {@link Implicit3DTileContent} 可以在内容获取后访问该瓦片。
   *
   * @type {ImplicitTileset|undefined}
   *
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分内容。
   */
  this.implicitTileset = undefined;

  /**
   * 对于隐式平铺，隐式 tileset 中的 (level, x, y, [z]) 坐标存储在瓦片中。
   * 该特性使用了 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分内容。
   *
   * @type {ImplicitTileCoordinates|undefined}
   *
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分内容。
   */
  this.implicitCoordinates = undefined;

  /**
   * 对于隐式平铺，每个转码后的瓦片将持有对弱引用
   * 该 {@link ImplicitSubtree}。
   *
   * @type {ImplicitSubtree|undefined}
   *
   * @private
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未最终定稿，可能根据 Cesium 的标准弃用政策发生变化。
   */
  this.implicitSubtree = undefined;

  // Members that are updated every frame for tree traversal and rendering optimizations:
  this._distanceToCamera = 0.0;
  this._centerZDepth = 0.0;
  this._screenSpaceError = 0.0;
  this._screenSpaceErrorProgressiveResolution = 0.0; // The screen space error at a given screen height of tileset.progressiveResolutionHeightFraction * screenHeight
  this._visibilityPlaneMask = 0;
  this._visible = false;
  this._inRequestVolume = false;

  this._finalResolution = true;
  this._depth = 0;
  this._stackLength = 0;
  this._selectionDepth = 0;

  this._updatedVisibilityFrame = 0;
  this._touchedFrame = 0;
  this._visitedFrame = 0;
  this._selectedFrame = 0;
  this._wasSelectedLastFrame = false;
  this._requestedFrame = 0;
  this._ancestorWithContent = undefined;
  this._ancestorWithContentAvailable = undefined;
  this._refines = false;
  this._shouldSelect = false;
  this._isClipped = true;
  this._isClippedByPolygon = false;
  this._clippingPlanesState = 0; // encapsulates (_isClipped, clippingPlanes.enabled) and number/function
  this._clippingPolygonsState = 0; // encapsulates (_isClipped, clippingPolygons.enabled) and number/function
  this._debugBoundingVolume = undefined;
  this._debugContentBoundingVolume = undefined;
  this._debugViewerRequestVolume = undefined;
  this._debugColor = Color.fromRandom({ alpha: 1.0 });
  this._debugColorizeTiles = false;

  this._priority = 0.0; // The priority used for request sorting
  this._priorityHolder = this; // Reference to the ancestor up the tree that holds the _foveatedFactor and _distanceToCamera for all tiles in the refinement chain.
  this._priorityProgressiveResolution = false;
  this._priorityProgressiveResolutionScreenSpaceErrorLeaf = false;
  this._priorityReverseScreenSpaceError = 0.0;
  this._foveatedFactor = 0.0;
  this._wasMinPriorityChild = false; // Needed for knowing when to continue a refinement chain. Gets reset in updateTile in traversal and gets set in updateAndPushChildren in traversal.

  this._loadTimestamp = new JulianDate();

  this._commandsLength = 0;

  this._color = undefined;
  this._colorDirty = false;

  this._request = undefined;

  // A parent's layer wins over this tile's own group, as in 3DTILES_layers. Tiles with
  // multiple contents only inherit (needs per-content hiding).
  const featureLayers = tileset.featureLayers;
  const ownFeatureLayer =
    defined(featureLayers) && defined(contentHeader) && !hasMultipleContents
      ? featureLayers._getByGroup(findGroupMetadata(tileset, contentHeader))
      : undefined;
  this._featureLayer = parent?._featureLayer ?? ownFeatureLayer;
}

// This can be overridden for testing purposes
Cesium3DTile._deprecationWarning = deprecationWarning;

Object.defineProperties(Cesium3DTile.prototype, {
  /**
   * 包含此图块的 tileset。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {Cesium3DTileset}
   * @readonly
   */
  tileset: {
    get: function () {
      return this._tileset;
    },
  },

  /**
   * 获取图块的子实体。隐式 tileset 的图块在首次访问此属性时派生出来。
   * 获取图块的内容。这代表实际图块的数据载荷，
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {Cesium3DTile[]}
   * @readonly
   */
  children: {
    get: function () {
      if (
        !this._implicitChildrenCreated &&
        defined(this._implicitChildrenCallback)
      ) {
        this._implicitChildrenCreated = true;
        this._implicitChildrenCallback(this);
      }
      return this._children;
    },
    set: function (value) {
      this._implicitChildrenCallback = undefined;
      this._implicitChildrenCreated = false;
      this._children = value;
    },
  },

  /**
   * The tile's content.  This represents the actual tile's payload,
   * 而非 tileset JSON 文件中的内容元数据。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {Cesium3DTileContent}
   * @readonly
   */
  content: {
    get: function () {
      return this._content;
    },
  },

  /**
   * 获取图块的边界体积。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {TileBoundingVolume}
   * @readonly
   * @private
   */
  boundingVolume: {
    get: function () {
      return this._boundingVolume;
    },
  },

  /**
   * 获取图块内容的边界体积。当内容边界体积为
   * <code>undefined</code>时，此值默认为图块的边界体积。
   * <code>undefined</code>。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {TileBoundingVolume}
   * @readonly
   * @private
   */
  contentBoundingVolume: {
    get: function () {
      return this._contentBoundingVolume ?? this._boundingVolume;
    },
  },

  /**
   * 获取由图块边界体积派生的边界球体。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {BoundingSphere}
   * @readonly
   */
  boundingSphere: {
    get: function () {
      return this._boundingVolume.boundingSphere;
    },
  },

  /**
   * 确定图块是否在当前视野内可见。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  isVisible: {
    get: function () {
      return this._visible && this._inRequestVolume;
    },
  },

  /**
   * 返回该图块在 tileset JSON 中的 <code>extras</code> 属性，其中包含特定于应用的元数据。
   * 如果 <code>extras</code> 不存在，则返回 <code>undefined</code>。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {object}
   * @readonly
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification#specifying-extensions-and-application-specific-extras|Extras in the 3D Tiles specification.}
   */
  extras: {
    get: function () {
      return this._header.extras;
    },
  },

  /**
   * 获取或设置图块的高亮颜色。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {Color}
   *
   * @default {@link Color.WHITE}
   *
   * @private
   */
  color: {
    get: function () {
      if (!defined(this._color)) {
        this._color = new Color();
      }
      return Color.clone(this._color);
    },
    set: function (value) {
      this._color = Color.clone(value, this._color);
      this._colorDirty = true;
    },
  },

  /**
   * 确定图块是否有可渲染内容。<code>true</code>表示图块
   * 内容已准备就绪，或者包含在加载新内容时渲染的过期内容；否则，
   * <code>false</code>。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  contentAvailable: {
    get: function () {
      return (
        (this.contentReady && this.hasRenderableContent) ||
        (defined(this._expiredContent) && !this.contentFailed)
      );
    },
  },

  /**
   * 确定图块的内容是否准备就绪。对于
   * 空内容的图块，此值自动为 <code>true</code>。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  contentReady: {
    get: function () {
      return this._contentState === Cesium3DTileContentState.READY;
    },
  },

  /**
   * 确定图块的内容是否未请求。<code>true</code>表示图块
   * 内容尚未被请求；否则，为 <code>false</code>。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  contentUnloaded: {
    get: function () {
      return this._contentState === Cesium3DTileContentState.UNLOADED;
    },
  },

  /**
   * 确定图块是否有可渲染内容且尚未加载。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  hasUnloadedRenderableContent: {
    get: function () {
      return this.hasRenderableContent && this.contentUnloaded;
    },
  },

  /**
   * 确定图块的内容是否过期。<code>true</code>表示图块
   * 内容已过期；否则，为 <code>false</code>。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  contentExpired: {
    get: function () {
      return this._contentState === Cesium3DTileContentState.EXPIRED;
    },
  },

  /**
   * 确定图块的内容是否加载失败。<code>true</code>表示图块
   * 内容加载失败；否则，为 <code>false</code>。
   *
   * @memberof Cesium3DTile.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  contentFailed: {
    get: function () {
      return this._contentState === Cesium3DTileContentState.FAILED;
    },
  },

  /**
   * 返回该图块使用的绘制命令数量。
   *
   * @readonly
   *
   * @private
   */
  commandsLength: {
    get: function () {
      return this._commandsLength;
    },
  },
});

const scratchCartesian = new Cartesian3();

/**
 * @private
 * @param {Cesium3DTile} tile
 * @param {FrameState} frameState
 * @returns {boolean}
 */
function isPriorityDeferred(tile, frameState) {
  const { tileset, boundingSphere } = tile;
  const { radius, center } = boundingSphere;
  const { camera } = frameState;

  // If closest point on line is inside the sphere then set foveatedFactor to 0.
  // Otherwise, the dot product is with the line from camera to the point on the sphere that is closest to the line.
  const scaledCameraDirection = Cartesian3.multiplyByScalar(
    camera.directionWC,
    tile._centerZDepth,
    scratchCartesian,
  );
  const closestPointOnLine = Cartesian3.add(
    camera.positionWC,
    scaledCameraDirection,
    scratchCartesian,
  );
  // The distance from the camera's view direction to the tile.
  const toLine = Cartesian3.subtract(
    closestPointOnLine,
    center,
    scratchCartesian,
  );
  const distanceToCenterLine = Cartesian3.magnitude(toLine);
  const notTouchingSphere = distanceToCenterLine > radius;

  // If camera's direction vector is inside the bounding sphere then consider
  // this tile right along the line of sight and set _foveatedFactor to 0.
  // Otherwise,_foveatedFactor is one minus the dot product of the camera's direction
  // and the vector between the camera and the point on the bounding sphere closest to the view line.
  if (notTouchingSphere) {
    const toLineNormalized = Cartesian3.normalize(toLine, scratchCartesian);
    const scaledToLine = Cartesian3.multiplyByScalar(
      toLineNormalized,
      radius,
      scratchCartesian,
    );
    const closestOnSphere = Cartesian3.add(
      center,
      scaledToLine,
      scratchCartesian,
    );
    const toClosestOnSphere = Cartesian3.subtract(
      closestOnSphere,
      camera.positionWC,
      scratchCartesian,
    );
    const toClosestOnSphereNormalize = Cartesian3.normalize(
      toClosestOnSphere,
      scratchCartesian,
    );
    tile._foveatedFactor =
      1.0 -
      Math.abs(Cartesian3.dot(camera.directionWC, toClosestOnSphereNormalize));
  } else {
    tile._foveatedFactor = 0.0;
  }

  // Skip this feature if: non-skipLevelOfDetail and replace refine, if the foveated settings are turned off, if tile is progressive resolution and replace refine and skipLevelOfDetail (will help get rid of ancestor artifacts faster)
  // Or if the tile is a preload of any kind
  const replace = tile.refine === Cesium3DTileRefine.REPLACE;
  const skipLevelOfDetail = tileset.isSkippingLevelOfDetail;
  if (
    (replace && !skipLevelOfDetail) ||
    !tileset.foveatedScreenSpaceError ||
    tileset.foveatedConeSize === 1.0 ||
    (tile._priorityProgressiveResolution && replace && skipLevelOfDetail) ||
    tileset._pass === Cesium3DTilePass.PRELOAD_FLIGHT ||
    tileset._pass === Cesium3DTilePass.PRELOAD
  ) {
    return false;
  }

  const maximumFovatedFactor = 1.0 - Math.cos(camera.frustum.fov * 0.5); // 0.14 for fov = 60. NOTE very hard to defer vertically foveated tiles since max is based on fovy (which is fov). Lowering the 0.5 to a smaller fraction of the screen height will start to defer vertically foveated tiles.
  const foveatedConeFactor = tileset.foveatedConeSize * maximumFovatedFactor;

  // If it's inside the user-defined view cone, then it should not be deferred.
  if (tile._foveatedFactor <= foveatedConeFactor) {
    return false;
  }

  // Relax SSE based on how big the angle is between the tile and the edge of the foveated cone.
  const range = maximumFovatedFactor - foveatedConeFactor;
  const normalizedFoveatedFactor = CesiumMath.clamp(
    (tile._foveatedFactor - foveatedConeFactor) / range,
    0.0,
    1.0,
  );
  const sseRelaxation = tileset.foveatedInterpolationCallback(
    tileset.foveatedMinimumScreenSpaceErrorRelaxation,
    tileset.memoryAdjustedScreenSpaceError,
    normalizedFoveatedFactor,
  );
  const sse =
    tile._screenSpaceError === 0.0 && defined(tile.parent)
      ? tile.parent._screenSpaceError * 0.5
      : tile._screenSpaceError;

  return tileset.memoryAdjustedScreenSpaceError - sseRelaxation <= sse;
}

const scratchJulianDate = new JulianDate();

/**
 * 获取图块的屏幕空间错误。
 *
 * @private
 * @param {FrameState} frameState
 * @param {boolean} useParentGeometricError
 * @param {number} progressiveResolutionHeightFraction
 */
Cesium3DTile.prototype.getScreenSpaceError = function (
  frameState,
  useParentGeometricError,
  progressiveResolutionHeightFraction,
) {
  const tileset = this._tileset;
  const heightFraction = progressiveResolutionHeightFraction ?? 1.0;
  const parentGeometricError = defined(this.parent)
    ? this.parent.geometricError
    : tileset._scaledGeometricError;
  const geometricError = useParentGeometricError
    ? parentGeometricError
    : this.geometricError;
  if (geometricError === 0.0) {
    // Leaf tiles do not have any error so save the computation
    return 0.0;
  }
  const { camera, context } = frameState;
  let frustum = camera.frustum;
  const width = context.drawingBufferWidth;
  const height = context.drawingBufferHeight * heightFraction;
  let error;
  if (
    frameState.mode === SceneMode.SCENE2D ||
    frustum instanceof OrthographicFrustum
  ) {
    const offCenterFrustum = frustum.offCenterFrustum;
    if (defined(offCenterFrustum)) {
      frustum = offCenterFrustum;
    }
    const pixelSize =
      Math.max(frustum.top - frustum.bottom, frustum.right - frustum.left) /
      Math.max(width, height);
    error = geometricError / pixelSize;
  } else {
    // Avoid divide by zero when viewer is inside the tile
    const distance = Math.max(this._distanceToCamera, CesiumMath.EPSILON7);
    const sseDenominator = frustum.sseDenominator;
    error = (geometricError * height) / (distance * sseDenominator);
    if (tileset.dynamicScreenSpaceError) {
      const density = tileset._dynamicScreenSpaceErrorComputedDensity;
      const factor = tileset.dynamicScreenSpaceErrorFactor;
      const dynamicError = CesiumMath.fog(distance, density) * factor;
      error -= dynamicError;
    }
  }

  error /= frameState.pixelRatio;

  return error;
};

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {Cesium3DTile} tile
 * @returns {boolean}
 */
function isPriorityProgressiveResolution(tileset, tile) {
  if (
    tileset.progressiveResolutionHeightFraction <= 0.0 ||
    tileset.progressiveResolutionHeightFraction > 0.5
  ) {
    return false;
  }

  const maximumScreenSpaceError = tileset.memoryAdjustedScreenSpaceError;
  let isProgressiveResolutionTile =
    tile._screenSpaceErrorProgressiveResolution > maximumScreenSpaceError; // Mark non-SSE leaves
  tile._priorityProgressiveResolutionScreenSpaceErrorLeaf = false; // Needed for skipLOD
  const parent = tile.parent;
  const tilePasses =
    tile._screenSpaceErrorProgressiveResolution <= maximumScreenSpaceError;
  const parentFails =
    defined(parent) &&
    parent._screenSpaceErrorProgressiveResolution > maximumScreenSpaceError;
  if (tilePasses && parentFails) {
    // A progressive resolution SSE leaf, promote its priority as well
    tile._priorityProgressiveResolutionScreenSpaceErrorLeaf = true;
    isProgressiveResolutionTile = true;
  }
  return isProgressiveResolutionTile;
}

/**
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {Cesium3DTile} tile
 * @returns {number}
 */
function getPriorityReverseScreenSpaceError(tileset, tile) {
  const parent = tile.parent;
  const useParentScreenSpaceError =
    defined(parent) &&
    (!tileset.isSkippingLevelOfDetail ||
      tile._screenSpaceError === 0.0 ||
      parent.hasTilesetContent ||
      parent.hasImplicitContent);
  const screenSpaceError = useParentScreenSpaceError
    ? parent._screenSpaceError
    : tile._screenSpaceError;
  return tileset.root._screenSpaceError - screenSpaceError;
}

/**
 * 更新图块的可见性。
 *
 * @private
 * @param {FrameState} frameState
 */
Cesium3DTile.prototype.updateVisibility = function (frameState) {
  const { parent, tileset } = this;
  if (this._updatedVisibilityFrame === tileset._updatedVisibilityFrame) {
    // The tile has already been updated for this frame
    return;
  }

  const parentTransform = defined(parent)
    ? parent.computedTransform
    : tileset.modelMatrix;
  const parentVisibilityPlaneMask = defined(parent)
    ? parent._visibilityPlaneMask
    : CullingVolume.MASK_INDETERMINATE;
  this.updateTransform(parentTransform, frameState);
  this._distanceToCamera = this.distanceToTile(frameState);
  this._centerZDepth = this.distanceToTileCenter(frameState);
  this._screenSpaceError = this.getScreenSpaceError(frameState, false);
  this._screenSpaceErrorProgressiveResolution = this.getScreenSpaceError(
    frameState,
    false,
    tileset.progressiveResolutionHeightFraction,
  );
  this._visibilityPlaneMask = this.visibility(
    frameState,
    parentVisibilityPlaneMask,
  ); // Use parent's plane mask to speed up visibility test
  this._visible = this._visibilityPlaneMask !== CullingVolume.MASK_OUTSIDE;
  // Descendants inherit this tile's layer, so culling it also prunes its subtree.
  if (defined(this._featureLayer) && !this._featureLayer.show) {
    this._visible = false;
  }
  this._inRequestVolume = this.insideViewerRequestVolume(frameState);
  this._priorityReverseScreenSpaceError = getPriorityReverseScreenSpaceError(
    tileset,
    this,
  );
  this._priorityProgressiveResolution = isPriorityProgressiveResolution(
    tileset,
    this,
  );
  this.priorityDeferred = isPriorityDeferred(this, frameState);

  this._updatedVisibilityFrame = tileset._updatedVisibilityFrame;
};

/**
 * 更新图块是否已过期。
 *
 * @private
 */
Cesium3DTile.prototype.updateExpiration = function () {
  if (
    defined(this.expireDate) &&
    this.contentReady &&
    !this.hasEmptyContent &&
    !this.hasMultipleContents
  ) {
    const now = JulianDate.now(scratchJulianDate);
    if (JulianDate.lessThan(this.expireDate, now)) {
      this._contentState = Cesium3DTileContentState.EXPIRED;
      this._expiredContent = this._content;
    }
  }
};

/**
 * @private
 * @param {Cesium3DTile} tile
 */
function updateExpireDate(tile) {
  if (!defined(tile.expireDuration)) {
    return;
  }
  const expireDurationDate = JulianDate.now(scratchJulianDate);
  JulianDate.addSeconds(
    expireDurationDate,
    tile.expireDuration,
    expireDurationDate,
  );

  if (defined(tile.expireDate)) {
    if (JulianDate.lessThan(tile.expireDate, expireDurationDate)) {
      JulianDate.clone(expireDurationDate, tile.expireDate);
    }
  } else {
    tile.expireDate = JulianDate.clone(expireDurationDate);
  }
}

/**
 * @private
 * @param {Cesium3DTile} tile
 * @returns {Function}
 */
function createPriorityFunction(tile) {
  return function () {
    return tile._priority;
  };
}

/**
 * 请求图块的内容。
 * <p>
 * 如果 Cesium 请求调度器无法优先处理，则无法发起请求。
 * </p>
 *
 * @return {Promise<Cesium3DTileContent>|undefined} A 承诺在请求完成时解决，如果没有需要请求或无法安排请求，则视为未定义。
 * @private
 */
Cesium3DTile.prototype.requestContent = function () {
  // empty contents don't require any HTTP requests
  if (this.hasEmptyContent) {
    return;
  }

  if (this.hasMultipleContents) {
    return requestMultipleContents(this);
  }

  return requestSingleContent(this);
};

/**
 * 单个图块中可以包含多个 {@link Cesium3DTileContent}，
 * tile JSON (3D Tiles 1.1) 或 <code>3DTILES_multiple_contents</code> 扩展。
 * 由于请求调度方式的差异，此功能单独处理。
 * <p>
 * 这种多内容实现不支持
 * 像 requestSingleContent 那样支持 tile 过期。如果发生变化，
 * 请注意，resource.setQueryParameters() 的详细信息必须放在 {@link Multiple3DTileContent} 中，因为这是按请求进行的。
 * </p>
 *
 * @private
 * @param {Cesium3DTile} tile
 * @returns {Promise<Cesium3DTileContent>|Promise<undefined>|undefined} A 一个在加载后解析为 tile 内容的 promise，或者如果请求在过程中被取消则解析为 undefined 的 promise，或者如果此帧无法安排请求则解析为 undefined。
 */
function requestMultipleContents(tile) {
  let multipleContents = tile._content;
  const tileset = tile._tileset;

  if (!defined(multipleContents)) {
    // Create the content object immediately, it will handle scheduling
    // requests for inner contents.
    const contentsJson = hasExtension(tile._header, "3DTILES_multiple_contents")
      ? tile._header.extensions["3DTILES_multiple_contents"]
      : tile._header;

    multipleContents = new Multiple3DTileContent(
      tileset,
      tile,
      tile._contentResource.clone(),
      contentsJson,
    );
    tile._content = multipleContents;
  }

  const promise = multipleContents.requestInnerContents();

  if (!defined(promise)) {
    // Request could not all be scheduled this frame
    return;
  }

  tile._contentState = Cesium3DTileContentState.LOADING;
  return promise
    .then((content) => {
      if (tile.isDestroyed()) {
        // Tile is unloaded before the content can process
        return;
      }

      // Tile was canceled, try again later
      if (!defined(content)) {
        return;
      }

      tile._contentState = Cesium3DTileContentState.PROCESSING;
      return multipleContents;
    })
    .catch((error) => {
      if (tile.isDestroyed()) {
        // Tile is unloaded before the content can process
        return;
      }

      tile._contentState = Cesium3DTileContentState.FAILED;
      throw error;
    });
}

async function processArrayBuffer(
  tile,
  tileset,
  request,
  expired,
  requestPromise,
) {
  const previousState = tile._contentState;
  tile._contentState = Cesium3DTileContentState.LOADING;
  ++tileset.statistics.numberOfPendingRequests;

  let arrayBuffer;
  try {
    arrayBuffer = await requestPromise;
  } catch (error) {
    --tileset.statistics.numberOfPendingRequests;
    if (tile.isDestroyed()) {
      // Tile is unloaded before the content can process
      return;
    }

    if (request.cancelled || request.state === RequestState.CANCELLED) {
      // Cancelled due to low priority - try again later.
      tile._contentState = previousState;
      ++tileset.statistics.numberOfAttemptedRequests;
      return;
    }

    if (isEmptyTile(tile, error)) {
      if (expired) {
        tile.expireDate = undefined;
      }
      tile._content = new Empty3DTileContent(tileset, tile);
      markTileAsEmptyContent(tile);
      tile._contentState = Cesium3DTileContentState.PROCESSING;
      return tile._content;
    }

    tile._contentState = Cesium3DTileContentState.FAILED;
    throw error;
  }

  if (tile.isDestroyed()) {
    --tileset.statistics.numberOfPendingRequests;
    // Tile is unloaded before the content can process
    return;
  }

  if (request.cancelled || request.state === RequestState.CANCELLED) {
    // Cancelled due to low priority - try again later.
    tile._contentState = previousState;
    --tileset.statistics.numberOfPendingRequests;
    ++tileset.statistics.numberOfAttemptedRequests;
    return;
  }

  try {
    const content = await makeContent(tile, arrayBuffer);
    --tileset.statistics.numberOfPendingRequests;

    if (tile.isDestroyed()) {
      // Tile is unloaded before the content can process
      return;
    }

    if (expired) {
      tile.expireDate = undefined;
    }

    tile._content = content;
    if (content instanceof Empty3DTileContent) {
      markTileAsEmptyContent(tile);
    }
    tile._contentState = Cesium3DTileContentState.PROCESSING;

    return content;
  } catch (error) {
    --tileset.statistics.numberOfPendingRequests;
    if (tile.isDestroyed()) {
      // Tile is unloaded before the content can process
      return;
    }

    tile._contentState = Cesium3DTileContentState.FAILED;
    throw error;
  }
}

/**
 * @private
 * @param {Cesium3DTile} tile
 * @returns {Promise<Cesium3DTileContent>|Promise<undefined>|undefined} A 一个在加载后解析为 tile 内容的 promise；如果 tile 在处理前被销毁，则解析为 undefined 的 promise，或者如果请求在过程中被取消则解析为 undefined；或者如果此帧无法安排请求则解析为 undefined。
 */
function requestSingleContent(tile) {
  // it is important to clone here. The fetchArrayBuffer() below uses
  // throttling, but other uses of the resources do not.
  const resource = tile._contentResource.clone();
  const expired = tile.contentExpired;
  if (expired) {
    // Append a query parameter of the tile expiration date to prevent caching
    resource.setQueryParameters({
      expired: tile.expireDate.toString(),
    });
  }

  const request = new Request({
    throttle: true,
    throttleByServer: true,
    type: RequestType.TILES3D,
    priorityFunction: createPriorityFunction(tile),
    serverKey: tile._serverKey,
  });

  tile._request = request;
  resource.request = request;
  const tileset = tile._tileset;
  const promise = resource.fetchArrayBuffer();
  if (!defined(promise)) {
    ++tileset.statistics.numberOfAttemptedRequests;
    return;
  }

  return processArrayBuffer(tile, tileset, request, expired, promise);
}

/**
 * 决定是否将 tile 加载错误解释为“无内容”。
 * （空 tile）而不是真正的失败。缺失的 tile 策略指定
 * 应被解释为“无内容”的 HTTP 状态代码，允许 tiles 被
 * 静态托管，而不生成和提供不必要的内容用于
 * 空 tiles。
 * @ignore
 */
function isEmptyTile(tile, error) {
  const tileset = tile._tileset;
  const policy = tileset?._runtimeContentCodec?.missingTilePolicy;
  if (!defined(policy)) {
    return false;
  }

  if (!defined(error.statusCode)) {
    return false;
  }
  return policy.statusCodes.includes(error.statusCode);
}

function markTileAsEmptyContent(tile) {
  // These flags are mutable instance state initialized in the constructor.
  tile.hasEmptyContent = true;
  tile.hasRenderableContent = false;
}

Cesium3DTile._isEmptyTile = isEmptyTile;

/**
 * 给定下载的内容负载，构造一个 {@link Cesium3DTileContent}。
 * <p>
 * 此仅用于单内容。
 * </p>
 *
 * @param {Cesium3DTile} tile tile
 * @param {ArrayBuffer} arrayBuffer 包含内容数据的下载负载
 * @return {Promise<Cesium3DTileContent>} A 内容对象
 * @private
 */
async function makeContent(tile, arrayBuffer) {
  const tileset = tile._tileset;
  const codec = tileset?._runtimeContentCodec;
  if (defined(codec) && typeof codec.createContent === "function") {
    const content = await Promise.resolve(
      codec.createContent(tileset, tile, tile._contentResource, arrayBuffer),
    );
    if (tile.isDestroyed()) {
      return;
    }
    return content;
  }

  const preprocessed = preprocess3DTileContent(arrayBuffer);

  // Vector and Geometry tile rendering do not support the skip LOD optimization.
  tileset._disableSkipLevelOfDetail =
    tileset._disableSkipLevelOfDetail ||
    preprocessed.contentType === Cesium3DTileContentType.GEOMETRY ||
    preprocessed.contentType === Cesium3DTileContentType.VECTOR;

  if (Cesium3DTileContentType.isSubtree(preprocessed.contentType)) {
    tile.hasImplicitContent = true;
    tile.hasRenderableContent = false;
  }

  if (preprocessed.contentType === Cesium3DTileContentType.EXTERNAL_TILESET) {
    tile.hasTilesetContent = true;
    tile.hasRenderableContent = false;
  }

  let content;
  const contentFactory = Cesium3DTileContentFactory[preprocessed.contentType];
  if (tile.isDestroyed()) {
    return;
  }

  if (defined(preprocessed.binaryPayload)) {
    content = await Promise.resolve(
      contentFactory(
        tileset,
        tile,
        tile._contentResource,
        preprocessed.binaryPayload.buffer,
        0,
      ),
    );
  } else {
    // JSON formats
    content = await Promise.resolve(
      contentFactory(
        tileset,
        tile,
        tile._contentResource,
        preprocessed.jsonPayload,
      ),
    );
  }

  const contentHeader = tile._contentHeader;

  if (tile.hasImplicitContentMetadata) {
    const subtree = tile.implicitSubtree;
    const coordinates = tile.implicitCoordinates;
    content.metadata = subtree.getContentMetadataView(coordinates, 0);
  } else if (!tile.hasImplicitContent) {
    content.metadata = findContentMetadata(tileset, contentHeader);
  }

  const groupMetadata = findGroupMetadata(tileset, contentHeader);
  if (defined(groupMetadata)) {
    content.group = new Cesium3DContentGroup({
      metadata: groupMetadata,
    });
  }

  return content;
}

/**
 * 取消对 tile 内容的请求。当 tile
 * 消失时调用此操作。
 *
 * @private
 */
Cesium3DTile.prototype.cancelRequests = function () {
  if (this.hasMultipleContents) {
    this._content.cancelRequests();
  } else {
    this._request.cancel();
  }
};

/**
 * 卸载 tile 的内容。
 *
 * @private
 */
Cesium3DTile.prototype.unloadContent = function () {
  if (!this.hasRenderableContent) {
    return;
  }

  this._content = this._content && this._content.destroy();
  this._contentState = Cesium3DTileContentState.UNLOADED;

  this.lastStyleTime = 0.0;
  this.clippingPlanesDirty = this._clippingPlanesState === 0;
  this._clippingPlanesState = 0;
  this.clippingPolygonsDirty = this._clippingPolygonsState === 0;
  this._clippingPolygonsState = 0;
  this.clippingPolygonsNeedRebake = false;

  this._debugColorizeTiles = false;

  this._debugBoundingVolume =
    this._debugBoundingVolume && this._debugBoundingVolume.destroy();
  this._debugContentBoundingVolume =
    this._debugContentBoundingVolume &&
    this._debugContentBoundingVolume.destroy();
  this._debugViewerRequestVolume =
    this._debugViewerRequestVolume && this._debugViewerRequestVolume.destroy();
};

const scratchProjectedBoundingSphere = new BoundingSphere();

/**
 * @private
 * @param {Cesium3DTile} tile
 * @param {FrameState} frameState
 * @returns {TileBoundingVolume}
 */
function getBoundingVolume(tile, frameState) {
  if (
    frameState.mode !== SceneMode.SCENE3D &&
    !defined(tile._boundingVolume2D)
  ) {
    const boundingSphere = tile._boundingVolume.boundingSphere;
    const sphere = BoundingSphere.projectTo2D(
      boundingSphere,
      frameState.mapProjection,
      scratchProjectedBoundingSphere,
    );
    tile._boundingVolume2D = new TileBoundingSphere(
      sphere.center,
      sphere.radius,
    );
  }

  return frameState.mode !== SceneMode.SCENE3D
    ? tile._boundingVolume2D
    : tile._boundingVolume;
}

/**
 * @private
 * @param {Cesium3DTile} tile
 * @param {FrameState} frameState
 * @returns {TileBoundingVolume}
 */
function getContentBoundingVolume(tile, frameState) {
  if (
    frameState.mode !== SceneMode.SCENE3D &&
    !defined(tile._contentBoundingVolume2D)
  ) {
    const boundingSphere = tile._contentBoundingVolume.boundingSphere;
    const sphere = BoundingSphere.projectTo2D(
      boundingSphere,
      frameState.mapProjection,
      scratchProjectedBoundingSphere,
    );
    tile._contentBoundingVolume2D = new TileBoundingSphere(
      sphere.center,
      sphere.radius,
    );
  }
  return frameState.mode !== SceneMode.SCENE3D
    ? tile._contentBoundingVolume2D
    : tile._contentBoundingVolume;
}

/**
 * 决定 tile 的边界体积是否与 culling 体积相交。
 *
 * @param {FrameState} frameState 帧状态。
 * @param {number} parentVisibilityPlaneMask 父对象的平面遮罩以加快可见性检查。
 * @returns {number} A 如 {@link CullingVolume#computeVisibilityWithPlaneMask} 中所述의平面遮罩。
 *
 * @private
 */
Cesium3DTile.prototype.visibility = function (
  frameState,
  parentVisibilityPlaneMask,
) {
  const cullingVolume = frameState.cullingVolume;
  const boundingVolume = getBoundingVolume(this, frameState);

  const tileset = this._tileset;
  const clippingPlanes = tileset.clippingPlanes;
  if (defined(clippingPlanes) && clippingPlanes.enabled) {
    const intersection = clippingPlanes.computeIntersectionWithBoundingVolume(
      boundingVolume,
      tileset.clippingPlanesOriginMatrix,
    );
    this._isClipped = intersection !== Intersect.INSIDE;
    if (intersection === Intersect.OUTSIDE) {
      return CullingVolume.MASK_OUTSIDE;
    }
  }

  const clippingPolygons = tileset.clippingPolygons;
  if (defined(clippingPolygons) && clippingPolygons.enabled) {
    const intersection =
      clippingPolygons.computeIntersectionWithBoundingVolume(boundingVolume);

    this._isClippedByPolygon = intersection !== Intersect.OUTSIDE;
    // Polygon clipping intersections are determined by outer rectangles, therefore we cannot
    // preemptively determine if a tile is completely clipped or not here.
  }

  return cullingVolume.computeVisibilityWithPlaneMask(
    boundingVolume,
    parentVisibilityPlaneMask,
  );
};

/**
 * 假设 tile 的边界体积与 culling 体积相交，决定
 * tile 内容的边界体积是否与 culling 体积相交。
 *
 * @param {FrameState} frameState 帧状态。
 * @returns {Intersect} The 交集结果：tile 的内容完全在外部、完全在内部，或与 culling 体积相交。
 *
 * @private
 */
Cesium3DTile.prototype.contentVisibility = function (frameState) {
  // Assumes the tile's bounding volume intersects the culling volume already, so
  // just return Intersect.INSIDE if there is no content bounding volume.
  if (!defined(this._contentBoundingVolume)) {
    return Intersect.INSIDE;
  }

  if (this._visibilityPlaneMask === CullingVolume.MASK_INSIDE) {
    // The tile's bounding volume is completely inside the culling volume so
    // the content bounding volume must also be inside.
    return Intersect.INSIDE;
  }

  // PERFORMANCE_IDEA: is it possible to burn less CPU on this test since we know the
  // tile's (not the content's) bounding volume intersects the culling volume?
  const cullingVolume = frameState.cullingVolume;
  const boundingVolume = getContentBoundingVolume(this, frameState);

  const tileset = this._tileset;
  const clippingPlanes = tileset.clippingPlanes;
  if (defined(clippingPlanes) && clippingPlanes.enabled) {
    const intersection = clippingPlanes.computeIntersectionWithBoundingVolume(
      boundingVolume,
      tileset.clippingPlanesOriginMatrix,
    );
    this._isClipped = intersection !== Intersect.INSIDE;
    if (intersection === Intersect.OUTSIDE) {
      return Intersect.OUTSIDE;
    }
  }

  const clippingPolygons = tileset.clippingPolygons;
  if (defined(clippingPolygons) && clippingPolygons.enabled) {
    const intersection =
      clippingPolygons.computeIntersectionWithBoundingVolume(boundingVolume);
    this._isClippedByPolygon = intersection !== Intersect.OUTSIDE;
    if (intersection === Intersect.INSIDE) {
      return Intersect.OUTSIDE;
    }
  }

  return cullingVolume.computeVisibility(boundingVolume);
};

/**
 * 计算 tile 的边界体积到相机最近点的（可能近似的）距离。
 *
 * @param {FrameState} frameState 帧状态。
 * @returns {number} The 距离，以米为单位，如果相机在边界体积内则为零。
 *
 * @private
 */
Cesium3DTile.prototype.distanceToTile = function (frameState) {
  const boundingVolume = getBoundingVolume(this, frameState);
  return boundingVolume.distanceToCamera(frameState);
};

const scratchToTileCenter = new Cartesian3();

/**
 * 计算 tile 的边界体积中心到由其位置和视角方向定义的相机平面的距离。
 *
 * @param {FrameState} frameState 帧状态。
 * @returns {number} The 距离，以米为单位。
 *
 * @private
 */
Cesium3DTile.prototype.distanceToTileCenter = function (frameState) {
  const tileBoundingVolume = getBoundingVolume(this, frameState);
  const boundingVolume = tileBoundingVolume.boundingVolume; // Gets the underlying OrientedBoundingBox or BoundingSphere
  const toCenter = Cartesian3.subtract(
    boundingVolume.center,
    frameState.camera.positionWC,
    scratchToTileCenter,
  );
  return Cartesian3.dot(frameState.camera.directionWC, toCenter);
};

/**
 * 检查相机是否位于查看器请求体积内。
 *
 * @param {FrameState} frameState 帧状态。
 * @returns {boolean} Whether 相机在体积内。
 *
 * @private
 */
Cesium3DTile.prototype.insideViewerRequestVolume = function (frameState) {
  const viewerRequestVolume = this._viewerRequestVolume;
  return (
    !defined(viewerRequestVolume) ||
    viewerRequestVolume.distanceToCamera(frameState) === 0.0
  );
};

const scratchMatrix = new Matrix3();
const scratchScale = new Cartesian3();
const scratchHalfAxes = new Matrix3();
const scratchCenter = new Cartesian3();
const scratchRectangle = new Rectangle();
const scratchOrientedBoundingBox = new OrientedBoundingBox();
const scratchTransform = new Matrix4();

/**
 * @private
 * @param {Array} box 定义有向边界框的12个数字数组
 * @param {Matrix4} transform
 * @param {TileBoundingVolume} [result]
 * @returns {TileOrientedBoundingBox}
 */
function createBox(box, transform, result) {
  let center = Cartesian3.fromElements(box[0], box[1], box[2], scratchCenter);
  let halfAxes = Matrix3.fromArray(box, 3, scratchHalfAxes);

  // Find the transformed center and halfAxes
  center = Matrix4.multiplyByPoint(transform, center, center);
  const rotationScale = Matrix4.getMatrix3(transform, scratchMatrix);
  halfAxes = Matrix3.multiply(rotationScale, halfAxes, halfAxes);

  if (defined(result)) {
    result.update(center, halfAxes);
    return result;
  }
  return new TileOrientedBoundingBox(center, halfAxes);
}

/**
 * @private
 * @param {Array} region 定义EPSG:4979坐标下的地理边界区域的6个数字数组，顺序为[西经、南纬、东经、北纬、最低高度、最高高度]
 * @param {Matrix4} transform
 * @param {Matrix4} initialTransform
 * @param {TileOrientedBoundingBox} [result]
 * @returns {TileOrientedBoundingBox}
 */
function createBoxFromTransformedRegion(
  region,
  transform,
  initialTransform,
  result,
) {
  const rectangle = Rectangle.unpack(region, 0, scratchRectangle);
  const minimumHeight = region[4];
  const maximumHeight = region[5];

  const orientedBoundingBox = OrientedBoundingBox.fromRectangle(
    rectangle,
    minimumHeight,
    maximumHeight,
    Ellipsoid.WGS84,
    scratchOrientedBoundingBox,
  );
  let center = orientedBoundingBox.center;
  let halfAxes = orientedBoundingBox.halfAxes;

  // A region bounding volume is not transformed by the transform in the tileset JSON,
  // but may be transformed by additional transforms applied in Cesium.
  // This is why the transform is calculated as the difference between the initial transform and the current transform.
  transform = Matrix4.multiplyTransformation(
    transform,
    Matrix4.inverseTransformation(initialTransform, scratchTransform),
    scratchTransform,
  );
  center = Matrix4.multiplyByPoint(transform, center, center);
  const rotationScale = Matrix4.getMatrix3(transform, scratchMatrix);
  halfAxes = Matrix3.multiply(rotationScale, halfAxes, halfAxes);

  if (defined(result) && result instanceof TileOrientedBoundingBox) {
    result.update(center, halfAxes);
    return result;
  }

  return new TileOrientedBoundingBox(center, halfAxes);
}

/**
 * 根据给定区域和变换创建TileBoundingVolume
 * 信息。
 *
 * 这可以是TileBoundingRegion或TileOrientedBoundingBox。
 *
 * 如果给定的变换是初始变换，则这将返回
 * TileBoundingRegion。这要么是给定的结果参数，
 * 要么如果给定的结果参数不是TileBoundingRegion，则是一个新的TileBoundingRegion。
 * 如果给定的变换与初始变换不同，则这将返回通过应用
 *
 * 给定变换到给定区域计算得到的TileOrientedBoundingBox。这要么是
 * 给定的结果参数，要么如果给定的结果参数不是TileOrientedBoundingBox，则是一个新的TileOrientedBoundingBox。
 * 定义EPSG:4979坐标下的地理边界区域的6个数字数组，顺序为
 * [西经、南纬、东经、北纬、最低高度、最高高度]
 * 瓦片的当前计算Transform。
 *
 * @private
 * @param {Array} region 包含父变换（进而包含包含瓦片的tileset的模型矩阵）
 * 瓦片的初始变换。
 * 在包含瓦片的tileset的模型矩阵发生任何变化之前。
 * @param {Matrix4} transform 可选结果。
 * 产生的边界体积。
 * 定义边界球体的4个数字数组
 * @param {Matrix4} initialTransform 从瓦片的边界体积头部创建边界体积。
 * 瓦片的边界体积头部。
 * @param {TileBoundingVolume} [result] 应用于边界体积的变换。
 * @returns {TileBoundingVolume} The 存储结果的对象。
 */
function createRegion(region, transform, initialTransform, result) {
  if (
    !Matrix4.equalsEpsilon(transform, initialTransform, CesiumMath.EPSILON8)
  ) {
    if (result instanceof TileOrientedBoundingBox) {
      return createBoxFromTransformedRegion(
        region,
        transform,
        initialTransform,
        result,
      );
    }
    return createBoxFromTransformedRegion(
      region,
      transform,
      initialTransform,
      undefined,
    );
  }

  const rectangleRegion = Rectangle.unpack(region, 0, scratchRectangle);

  if (result instanceof TileBoundingRegion) {
    result.rectangle = Rectangle.clone(rectangleRegion, result.rectangle);
    result.minimumHeight = region[4];
    result.maximumHeight = region[5];
    // The TileBoundingRegion was already constructed with the default
    // WGS84 ellipsoid, so keep it consistent when updating.
    result.computeBoundingVolumes(Ellipsoid.WGS84);
    return result;
  }

  return new TileBoundingRegion({
    rectangle: rectangleRegion,
    minimumHeight: region[4],
    maximumHeight: region[5],
  });
}

/**
 * @private
 * @param {Array} sphere 修改的结果参数或如果未提供则新的TileBoundingVolume实例。
 * @param {Matrix4} transform
 * @param {TileBoundingVolume} [result]
 * @returns {TileBoundingSphere}
 */
function createSphere(sphere, transform, result) {
  let center = Cartesian3.fromElements(
    sphere[0],
    sphere[1],
    sphere[2],
    scratchCenter,
  );
  let radius = sphere[3];

  // Find the transformed center and radius
  center = Matrix4.multiplyByPoint(transform, center, center);
  const scale = Matrix4.getScale(transform, scratchScale);
  const uniformScale = Cartesian3.maximumComponent(scale);
  radius *= uniformScale;

  if (defined(result)) {
    result.update(center, radius);
    return result;
  }
  return new TileBoundingSphere(center, radius);
}

/**
 * 根据提供的放大因子放大瓦片的边界框。
 *
 * @param {object} boundingVolumeHeader 瓦片的边界体积头部。
 * @param {Matrix4} transform 应用于边界体积的变换。
 * @param {TileBoundingVolume} [result] 存储结果的对象。
 *
 * @returns {TileBoundingVolume} The 修改后的结果参数或如果未提供则新的TileBoundingVolume实例。
 *
 * @private
 */
Cesium3DTile.prototype.createBoundingVolume = function (
  boundingVolumeHeader,
  transform,
  result,
) {
  // if explicit tile metadata includes TILE_BOUNDING_BOX, TILE_BOUNDING_REGION,
  // or TILE_BOUNDING_SPHERE, override tile.boundingVolume.
  const tileMetadata = this.metadata;
  let metadataBoundingVolumeHeader;
  if (defined(tileMetadata)) {
    metadataBoundingVolumeHeader =
      BoundingVolumeSemantics.parseBoundingVolumeSemantic("TILE", tileMetadata);
  }
  if (defined(metadataBoundingVolumeHeader)) {
    boundingVolumeHeader = metadataBoundingVolumeHeader;
  }

  if (!defined(boundingVolumeHeader)) {
    throw new RuntimeError("boundingVolume must be defined");
  }

  if (hasExtension(boundingVolumeHeader, "3DTILES_bounding_volume_S2")) {
    return new TileBoundingS2Cell(
      boundingVolumeHeader.extensions["3DTILES_bounding_volume_S2"],
    );
  }

  const { box, region, sphere } = boundingVolumeHeader;
  if (defined(box)) {
    const tileOrientedBoundingBox = createBox(box, transform, result);
    if (this._verticalExaggeration !== 1.0) {
      exaggerateBoundingBox(
        tileOrientedBoundingBox,
        this._verticalExaggeration,
        this._verticalExaggerationRelativeHeight,
      );
    }
    return tileOrientedBoundingBox;
  }
  if (defined(region)) {
    const tileBoundingVolume = createRegion(
      region,
      transform,
      this._initialTransform,
      result,
    );
    if (this._verticalExaggeration === 1.0) {
      return tileBoundingVolume;
    }
    if (tileBoundingVolume instanceof TileOrientedBoundingBox) {
      exaggerateBoundingBox(
        tileBoundingVolume,
        this._verticalExaggeration,
        this._verticalExaggerationRelativeHeight,
      );
    } else {
      tileBoundingVolume.minimumHeight = VerticalExaggeration.getHeight(
        tileBoundingVolume.minimumHeight,
        this._verticalExaggeration,
        this._verticalExaggerationRelativeHeight,
      );
      tileBoundingVolume.maximumHeight = VerticalExaggeration.getHeight(
        tileBoundingVolume.maximumHeight,
        this._verticalExaggeration,
        this._verticalExaggerationRelativeHeight,
      );
      tileBoundingVolume.computeBoundingVolumes(Ellipsoid.WGS84);
    }
    return tileBoundingVolume;
  }
  if (defined(sphere)) {
    const tileBoundingSphere = createSphere(sphere, transform, result);
    if (this._verticalExaggeration !== 1.0) {
      const exaggeratedCenter = VerticalExaggeration.getPosition(
        tileBoundingSphere.center,
        Ellipsoid.WGS84,
        this._verticalExaggeration,
        this._verticalExaggerationRelativeHeight,
        scratchCenter,
      );
      const exaggeratedRadius =
        tileBoundingSphere.radius * this._verticalExaggeration;
      tileBoundingSphere.update(exaggeratedCenter, exaggeratedRadius);
    }
    return tileBoundingSphere;
  }
  throw new RuntimeError(
    "boundingVolume must contain a sphere, region, or box",
  );
};

const scratchExaggeratedCorners = Cartesian3.unpackArray(
  new Array(8 * 3).fill(0),
);

/**
 * 基于提供的放大因子放大瓦片的边界框。
 *
 * @private
 * @param {TileOrientedBoundingBox} tileOrientedBoundingBox - 瓦片的有向边界框。
 * @param {number} exaggeration - 应用于瓦片边界框的放大因子。
 * @param {number} exaggerationRelativeHeight - 将进行放大的高度。
 */
function exaggerateBoundingBox(
  tileOrientedBoundingBox,
  exaggeration,
  exaggerationRelativeHeight,
) {
  const exaggeratedCorners = tileOrientedBoundingBox.boundingVolume
    .computeCorners(scratchExaggeratedCorners)
    .map((corner) =>
      VerticalExaggeration.getPosition(
        corner,
        Ellipsoid.WGS84,
        exaggeration,
        exaggerationRelativeHeight,
        corner,
      ),
    );
  const exaggeratedBox = OrientedBoundingBox.fromPoints(
    exaggeratedCorners,
    scratchOrientedBoundingBox,
  );
  tileOrientedBoundingBox.update(
    exaggeratedBox.center,
    exaggeratedBox.halfAxes,
  );
}

/**
 * 更新瓦片的变换。该变换应用于瓦片的边界体积。
 *
 * @private
 * @param {Matrix4} parentTransform
 * @param {FrameState} [frameState]
 */
Cesium3DTile.prototype.updateTransform = function (
  parentTransform,
  frameState,
) {
  parentTransform = parentTransform ?? Matrix4.IDENTITY;
  const computedTransform = Matrix4.multiplyTransformation(
    parentTransform,
    this.transform,
    scratchTransform,
  );
  const transformChanged = !Matrix4.equals(
    computedTransform,
    this.computedTransform,
  );
  const exaggerationChanged =
    defined(frameState) &&
    (this._verticalExaggeration !== frameState.verticalExaggeration ||
      this._verticalExaggerationRelativeHeight !==
        frameState.verticalExaggerationRelativeHeight);

  if (!transformChanged && !exaggerationChanged) {
    return;
  }
  if (transformChanged) {
    Matrix4.clone(computedTransform, this.computedTransform);
  }
  if (exaggerationChanged) {
    this._verticalExaggeration = frameState.verticalExaggeration;
    this._verticalExaggerationRelativeHeight =
      frameState.verticalExaggerationRelativeHeight;
  }

  // Update the bounding volumes
  const header = this._header;
  const contentHeader = this._contentHeader;
  this._boundingVolume = this.createBoundingVolume(
    header.boundingVolume,
    this.computedTransform,
    this._boundingVolume,
  );
  if (defined(this._contentBoundingVolume)) {
    this._contentBoundingVolume = this.createBoundingVolume(
      contentHeader.boundingVolume,
      this.computedTransform,
      this._contentBoundingVolume,
    );
  }
  if (defined(this._viewerRequestVolume)) {
    this._viewerRequestVolume = this.createBoundingVolume(
      header.viewerRequestVolume,
      this.computedTransform,
      this._viewerRequestVolume,
    );
  }

  this.updateGeometricErrorScale();

  // Destroy the debug bounding volumes. They will be generated fresh.
  this._debugBoundingVolume =
    this._debugBoundingVolume && this._debugBoundingVolume.destroy();
  this._debugContentBoundingVolume =
    this._debugContentBoundingVolume &&
    this._debugContentBoundingVolume.destroy();
  this._debugViewerRequestVolume =
    this._debugViewerRequestVolume && this._debugViewerRequestVolume.destroy();
};

Cesium3DTile.prototype.updateGeometricErrorScale = function () {
  const scale = Matrix4.getScale(this.computedTransform, scratchScale);
  const uniformScale = Cartesian3.maximumComponent(scale);
  this.geometricError = this._geometricError * uniformScale;

  if (!defined(this.parent)) {
    // Update the tileset's geometric error
    const tileset = this._tileset;
    tileset._scaledGeometricError = tileset._geometricError * uniformScale;
  }
};

/**
 * @private
 * @param {Cesium3DTile} tile
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 * @param {object} passOptions
 */
function applyDebugSettings(tile, tileset, frameState, passOptions) {
  if (!passOptions.isRender) {
    return;
  }

  const hasContentBoundingVolume =
    defined(tile._contentHeader) && defined(tile._contentHeader.boundingVolume);

  const showVolume =
    tileset.debugShowBoundingVolume ||
    (tileset.debugShowContentBoundingVolume && !hasContentBoundingVolume);
  if (showVolume) {
    let color;
    if (!tile._finalResolution) {
      color = Color.YELLOW;
    } else if (!tile.hasRenderableContent) {
      color = Color.DARKGRAY;
    } else {
      color = Color.WHITE;
    }
    if (!defined(tile._debugBoundingVolume)) {
      tile._debugBoundingVolume = tile._boundingVolume.createDebugVolume(color);
    }
    tile._debugBoundingVolume.update(frameState);
    const attributes =
      tile._debugBoundingVolume.getGeometryInstanceAttributes("outline");
    attributes.color = ColorGeometryInstanceAttribute.toValue(
      color,
      attributes.color,
    );
  } else if (!showVolume && defined(tile._debugBoundingVolume)) {
    tile._debugBoundingVolume = tile._debugBoundingVolume.destroy();
  }

  if (tileset.debugShowContentBoundingVolume && hasContentBoundingVolume) {
    if (!defined(tile._debugContentBoundingVolume)) {
      tile._debugContentBoundingVolume =
        tile._contentBoundingVolume.createDebugVolume(Color.BLUE);
    }
    tile._debugContentBoundingVolume.update(frameState);
  } else if (
    !tileset.debugShowContentBoundingVolume &&
    defined(tile._debugContentBoundingVolume)
  ) {
    tile._debugContentBoundingVolume =
      tile._debugContentBoundingVolume.destroy();
  }

  if (
    tileset.debugShowViewerRequestVolume &&
    defined(tile._viewerRequestVolume)
  ) {
    if (!defined(tile._debugViewerRequestVolume)) {
      tile._debugViewerRequestVolume =
        tile._viewerRequestVolume.createDebugVolume(Color.YELLOW);
    }
    tile._debugViewerRequestVolume.update(frameState);
  } else if (
    !tileset.debugShowViewerRequestVolume &&
    defined(tile._debugViewerRequestVolume)
  ) {
    tile._debugViewerRequestVolume = tile._debugViewerRequestVolume.destroy();
  }

  const debugColorizeTilesOn =
    (tileset.debugColorizeTiles && !tile._debugColorizeTiles) ||
    defined(tileset._heatmap.tilePropertyName);
  const debugColorizeTilesOff =
    !tileset.debugColorizeTiles && tile._debugColorizeTiles;

  if (debugColorizeTilesOn) {
    tileset._heatmap.colorize(tile, frameState); // Skipped if tileset._heatmap.tilePropertyName is undefined
    tile._debugColorizeTiles = true;
    tile.color = tile._debugColor;
  } else if (debugColorizeTilesOff) {
    tile._debugColorizeTiles = false;
    tile.color = Color.WHITE;
  }

  if (tile._colorDirty) {
    tile._colorDirty = false;
    tile._content.applyDebugSettings(true, tile._color);
  }

  if (debugColorizeTilesOff) {
    tileset.makeStyleDirty(); // Re-apply style now that colorize is switched off
  }
}

/**
 * @private
 * @param {Cesium3DTile} tile
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 */
function updateContent(tile, tileset, frameState) {
  const expiredContent = tile._expiredContent;

  // expired content is not supported for multiple contents
  if (!tile.hasMultipleContents && defined(expiredContent)) {
    if (!tile.contentReady) {
      // Render the expired content while the content loads
      try {
        expiredContent.update(tileset, frameState);
      } catch (error) {
        // Eat error for expired content
      }
      return;
    }

    // New content is ready, destroy expired content
    tile._expiredContent.destroy();
    tile._expiredContent = undefined;
  }

  if (!defined(tile.content)) {
    // Implicit placeholder tile
    return;
  }

  try {
    tile.content.update(tileset, frameState);
  } catch (error) {
    tile._contentState = Cesium3DTileContentState.FAILED;
    throw error;
  }
}

/**
 * 计算并比较ClippingPlanes状态：
 * - 启用状态 - 裁剪平面是否启用？此瓦片是否被裁剪？
 * - 裁剪平面数量
 * - 裁剪函数（并集 vs. 交集）

 * @private
 * @param {Cesium3DTile} tile
 * @param {Cesium3DTileset} tileset
 */
function updateClippingPlanes(tile, tileset) {
  const clippingPlanes = tileset.clippingPlanes;
  let currentClippingPlanesState = 0;
  if (defined(clippingPlanes) && tile._isClipped && clippingPlanes.enabled) {
    currentClippingPlanesState = clippingPlanes.clippingPlanesState;
  }
  // If clippingPlaneState for tile changed, mark clippingPlanesDirty so content can update
  if (currentClippingPlanesState !== tile._clippingPlanesState) {
    tile._clippingPlanesState = currentClippingPlanesState;
    tile.clippingPlanesDirty = true;
  }
}

/**
 * 计算并比较裁剪多边形状态：
 * - 启用状态 - 裁剪多边形是否启用？该瓦片是否被裁剪？
 * - 裁剪多边形数量与位置数量
 * - 反裁剪函数

 * @private
 * @param {Cesium3DTile} tile
 * @param {Cesium3DTileset} tileset
 */
function updateClippingPolygons(tile, tileset) {
  const clippingPolygons = tileset.clippingPolygons;
  let currentClippingPolygonsState = 0;
  if (
    defined(clippingPolygons) &&
    tile._isClippedByPolygon &&
    clippingPolygons.enabled
  ) {
    currentClippingPolygonsState = clippingPolygons.clippingPolygonsState;
  }
  // If clippingPolygonState for tile changed, mark clippingPolygonsDirty so content can update
  if (currentClippingPolygonsState !== tile._clippingPolygonsState) {
    tile._clippingPolygonsState = currentClippingPolygonsState;
    tile.clippingPolygonsDirty = true;
  }
}

/**
 * 获取渲染该瓦片所需的绘制命令。
 *
 * @private
 * @param {Cesium3DTileset} tileset
 * @param {FrameState} frameState
 * @param {object} passOptions
 */
Cesium3DTile.prototype.update = function (tileset, frameState, passOptions) {
  const { commandList } = frameState;
  const commandStart = commandList.length;

  updateClippingPlanes(this, tileset);
  updateClippingPolygons(this, tileset);
  applyDebugSettings(this, tileset, frameState, passOptions);
  updateContent(this, tileset, frameState);

  const commandEnd = commandList.length;
  this._commandsLength = commandEnd - commandStart;

  for (let i = commandStart; i < commandEnd; ++i) {
    const command = commandList[i];
    const translucent = command.pass === Pass.TRANSLUCENT;
    command.depthForTranslucentClassification = translucent;
  }

  this.clippingPlanesDirty = false; // reset after content update
  this.clippingPolygonsDirty = false;
  this.clippingPolygonsNeedRebake = false;
};

const scratchCommandList = [];

/**
 * 处理瓦片内容，例如创建 WebGL 资源，以从 PROCESSING 状态变为 READY 状态。
 *
 * @param {Cesium3DTileset} tileset 包含该瓦片的瓦片集。
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */
Cesium3DTile.prototype.process = function (tileset, frameState) {
  if (!this.contentExpired && !this.contentReady && this._content.ready) {
    updateExpireDate(this);

    // Refresh style for expired content
    this._selectedFrame = 0;
    this.lastStyleTime = 0.0;

    JulianDate.now(this._loadTimestamp);
    this._contentState = Cesium3DTileContentState.READY;

    if (!this.hasTilesetContent && !this.hasImplicitContent) {
      // RESEARCH_IDEA: ability to unload tiles (without content) for an
      // external tileset when all the tiles are unloaded.
      tileset._statistics.incrementLoadCounts(this.content);
      ++tileset._statistics.numberOfTilesWithContentReady;
      ++tileset._statistics.numberOfLoadedTilesTotal;

      // Add to the tile cache. Previously expired tiles are already in the cache and won't get re-added.
      tileset._cache.add(this);
    }
  }

  const savedCommandList = frameState.commandList;
  frameState.commandList = scratchCommandList;

  try {
    this._content.update(tileset, frameState);
  } catch (error) {
    this._contentState = Cesium3DTileContentState.FAILED;
    throw error;
  }

  scratchCommandList.length = 0;
  frameState.commandList = savedCommandList;
};

/**
 * @private
 * @param {number} normalizedValue
 * @param {number} numberOfDigits
 * @param {number} leftShift
 * @returns {number}
 */
function isolateDigits(normalizedValue, numberOfDigits, leftShift) {
  const scaled = normalizedValue * Math.pow(10, numberOfDigits);
  const integer = parseInt(scaled);
  return integer * Math.pow(10, leftShift);
}

/**
 * @private
 * @param {number} value
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
function priorityNormalizeAndClamp(value, minimum, maximum) {
  // Subtract epsilon since we only want decimal digits present in the output.
  return Math.max(
    CesiumMath.normalize(value, minimum, maximum) - CesiumMath.EPSILON7,
    0.0,
  );
}

/**
 * 根据距离和深度设置瓦片的优先级
 * @private
 */
Cesium3DTile.prototype.updatePriority = function () {
  const tileset = this.tileset;
  const preferLeaves = tileset.preferLeaves;
  const minimumPriority = tileset._minimumPriority;
  const maximumPriority = tileset._maximumPriority;

  // Combine priority systems together by mapping them into a base 10 number where each priority controls a specific set of digits in the number.
  // For number priorities, map them to a 0.xxxxx number then left shift it up into a set number of digits before the decimal point. Chop of the fractional part then left shift again into the position it needs to go.
  // For blending number priorities, normalize them to 0-1 and interpolate to get a combined 0-1 number, then proceed as normal.
  // Booleans can just be 0 or 10^leftshift.
  // Think of digits as penalties since smaller numbers are higher priority. If a tile has some large quantity or has a flag raised it's (usually) penalized for it, expressed as a higher number for the digit.
  // Priority number format: preloadFlightDigits(1) | foveatedDeferDigits(1) | foveatedDigits(4) | preloadProgressiveResolutionDigits(1) | preferredSortingDigits(4) . depthDigits(the decimal digits)
  // Certain flags like preferLeaves will flip / turn off certain digits to get desired load order.

  // Setup leftShifts, digit counts, and scales (for booleans)
  const digitsForANumber = 4;
  const digitsForABoolean = 1;

  const preferredSortingLeftShift = 0;
  const preferredSortingDigitsCount = digitsForANumber;

  const foveatedLeftShift =
    preferredSortingLeftShift + preferredSortingDigitsCount;
  const foveatedDigitsCount = digitsForANumber;

  const preloadProgressiveResolutionLeftShift =
    foveatedLeftShift + foveatedDigitsCount;
  const preloadProgressiveResolutionDigitsCount = digitsForABoolean;
  const preloadProgressiveResolutionScale = Math.pow(
    10,
    preloadProgressiveResolutionLeftShift,
  );

  const foveatedDeferLeftShift =
    preloadProgressiveResolutionLeftShift +
    preloadProgressiveResolutionDigitsCount;
  const foveatedDeferDigitsCount = digitsForABoolean;
  const foveatedDeferScale = Math.pow(10, foveatedDeferLeftShift);

  const preloadFlightLeftShift =
    foveatedDeferLeftShift + foveatedDeferDigitsCount;
  const preloadFlightScale = Math.pow(10, preloadFlightLeftShift);

  // Compute the digits for each priority
  let depthDigits = priorityNormalizeAndClamp(
    this._depth,
    minimumPriority.depth,
    maximumPriority.depth,
  );
  depthDigits = preferLeaves ? 1.0 - depthDigits : depthDigits;

  // Map 0-1 then convert to digit. Include a distance sort when doing non-skipLOD and replacement refinement, helps things like non-skipLOD photogrammetry
  const useDistance =
    !tileset.isSkippingLevelOfDetail &&
    this.refine === Cesium3DTileRefine.REPLACE;
  const normalizedPreferredSorting = useDistance
    ? priorityNormalizeAndClamp(
        this._priorityHolder._distanceToCamera,
        minimumPriority.distance,
        maximumPriority.distance,
      )
    : priorityNormalizeAndClamp(
        this._priorityReverseScreenSpaceError,
        minimumPriority.reverseScreenSpaceError,
        maximumPriority.reverseScreenSpaceError,
      );
  const preferredSortingDigits = isolateDigits(
    normalizedPreferredSorting,
    preferredSortingDigitsCount,
    preferredSortingLeftShift,
  );

  const preloadProgressiveResolutionDigits = this._priorityProgressiveResolution
    ? 0
    : preloadProgressiveResolutionScale;

  const normalizedFoveatedFactor = priorityNormalizeAndClamp(
    this._priorityHolder._foveatedFactor,
    minimumPriority.foveatedFactor,
    maximumPriority.foveatedFactor,
  );
  const foveatedDigits = isolateDigits(
    normalizedFoveatedFactor,
    foveatedDigitsCount,
    foveatedLeftShift,
  );

  const foveatedDeferDigits = this.priorityDeferred ? foveatedDeferScale : 0;

  const preloadFlightDigits =
    tileset._pass === Cesium3DTilePass.PRELOAD_FLIGHT ? 0 : preloadFlightScale;

  // Get the final base 10 number
  this._priority =
    depthDigits +
    preferredSortingDigits +
    preloadProgressiveResolutionDigits +
    foveatedDigits +
    foveatedDeferDigits +
    preloadFlightDigits;
};

/**
 * @private
 */
Cesium3DTile.prototype.isDestroyed = function () {
  return false;
};

/**
 * @private
 */
Cesium3DTile.prototype.destroy = function () {
  this._implicitChildrenCallback = undefined;
  this._implicitChildrenCreated = false;
  // For the interval between new content being requested and downloaded, expiredContent === content, so don't destroy twice
  this._content = this._content && this._content.destroy();
  this._expiredContent =
    this._expiredContent &&
    !this._expiredContent.isDestroyed() &&
    this._expiredContent.destroy();
  this._debugBoundingVolume =
    this._debugBoundingVolume && this._debugBoundingVolume.destroy();
  this._debugContentBoundingVolume =
    this._debugContentBoundingVolume &&
    this._debugContentBoundingVolume.destroy();
  this._debugViewerRequestVolume =
    this._debugViewerRequestVolume && this._debugViewerRequestVolume.destroy();
  return destroyObject(this);
};

/**
 * 填充隐式瓦片集中瓦片的 <code>children</code> 数组。
 *
 * @callback Cesium3DTile.ImplicitChildrenCallback
 * @param {Cesium3DTile} tile 用于创建子元素的瓦片。
 * @private
 */

export default Cesium3DTile;
