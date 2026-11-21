import {
  Cartesian3,
  DeveloperError,
  defined,
  destroyObject,
} from "@cesium/core";
import Request from "../Core/Request.js";
import RequestScheduler from "../Core/RequestScheduler.js";
import RequestState from "../Core/RequestState.js";
import RequestType from "../Core/RequestType.js";
import Cesium3DContentGroup from "./Cesium3DContentGroup.js";
import Cesium3DTileContentType from "./Cesium3DTileContentType.js";
import Cesium3DTileContentFactory from "./Cesium3DTileContentFactory.js";
import findContentMetadata from "./findContentMetadata.js";
import findGroupMetadata from "./findGroupMetadata.js";
import preprocess3DTileContent from "./preprocess3DTileContent.js";

/**
 * 用于具有多内容的瓦片的内容集合，通过瓦片 JSON（3D Tiles 1.1）或 <code>3DTILES_multiple_contents</code> 扩展实现。
 * <p>
 * 实现 {@link Cesium3DTileContent} 接口。
 * </p>
 *
 * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_multiple_contents|3DTILES_multiple_contents extension}
 *
 * @implements Cesium3DTileContent
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，且尚未最终确定，可能根据 Cesium 的标准弃用政策发生变化。
 */
class Multiple3DTileContent {
  /**
   * @param {Cesium3DTileset} tileset 此内容所属的瓦片集。
   * @param {Cesium3DTile} tile 此内容所属的内容。
   * @param {Resource} tilesetResource 指向瓦片集的资源。将用于派生每个内部内容的资源。
   * @param {object} contentsJson 包含内容数组的瓦片 JSON（3D Tiles 1.1），或 <code>3DTILES_multiple_contents</code> 扩展 JSON。
   */
  constructor(tileset, tile, tilesetResource, contentsJson) {
    this._tileset = tileset;
    this._tile = tile;
    this._tilesetResource = tilesetResource;
    this._contents = [];
    this._contentsCreated = false;

    // An older version of 3DTILES_multiple_contents used "content" instead of "contents"
    const contentHeaders = defined(contentsJson.contents)
      ? contentsJson.contents
      : contentsJson.content;

    this._innerContentHeaders = contentHeaders;
    this._requestsInFlight = 0;

    // How many times cancelPendingRequests() has been called. This is
    // used to help short-circuit computations after a tile was canceled.
    this._cancelCount = 0;

    // The number of contents that turned out to be external tilesets
    // in createInnerContent. When all contents are external tilesets,
    // then tile.hasRenderableContent will become `false`
    this._externalTilesetCount = 0;

    const contentCount = this._innerContentHeaders.length;
    this._arrayFetchPromises = new Array(contentCount);
    this._requests = new Array(contentCount);
    this._ready = false;

    this._innerContentResources = new Array(contentCount);
    this._serverKeys = new Array(contentCount);

    for (let i = 0; i < contentCount; i++) {
      const contentResource = tilesetResource.getDerivedResource({
        url: contentHeaders[i].uri,
      });

      const serverKey = RequestScheduler.getServerKey(
        contentResource.getUrlComponent(),
      );

      this._innerContentResources[i] = contentResource;
      this._serverKeys[i] = serverKey;
    }
  }

  /**
   * {@link Cesium3DTileContent} 接口的一部分。<code>Multiple3DTileContent</code> 会检查内部内容中是否有 <code>featuresPropertyDirty</code>。
   *
   * @type {boolean}
   *
   * @private
   */
  get featurePropertiesDirty() {
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      if (contents[i].featurePropertiesDirty) {
        return true;
      }
    }

    return false;
  }

  set featurePropertiesDirty(value) {
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      contents[i].featurePropertiesDirty = value;
    }
  }

  /**
   * {@link Cesium3DTileContent} 接口的一部分。<code>Multiple3DTileContent</code>
   * 始终返回 <code>0</code>。应调用 <code>featuresLength</code> 获取特定内部内容。
   *
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  get featuresLength() {
    return 0;
  }

  /**
   * {@link Cesium3DTileContent} 接口的一部分。<code>Multiple3DTileContent</code>
   * 始终返回 <code>0</code>。应调用 <code>pointsLength</code> 获取特定内部内容。
   *
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  get pointsLength() {
    return 0;
  }

  /**
   * {@link Cesium3DTileContent} 接口的一部分。<code>Multiple3DTileContent</code>
   * 始终返回 <code>0</code>。应调用 <code>trianglesLength</code> 获取特定内部内容。
   *
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  get trianglesLength() {
    return 0;
  }

  /**
   * {@link Cesium3DTileContent} 接口的一部分。<code>Multiple3DTileContent</code>
   * 始终返回 <code>0</code>。应调用 <code>geometryByteLength</code> 获取特定内部内容。
   *
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  get geometryByteLength() {
    return 0;
  }

  /**
   * {@link Cesium3DTileContent} 接口的一部分。<code>Multiple3DTileContent</code>
   * 始终返回 <code>0</code>。应调用 <code>texturesByteLength</code> 获取特定内部内容。
   *
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  get texturesByteLength() {
    return 0;
  }

  /**
   * {@link Cesium3DTileContent} 接口的一部分。<code>Multiple3DTileContent</code>
   * 始终返回 <code>0</code>。应调用 <code>batchTableByteLength</code> 获取特定内部内容。
   *
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  get batchTableByteLength() {
    return 0;
  }

  get innerContents() {
    return this._contents;
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
    if (!this._contentsCreated) {
      return false;
    }

    return this._ready;
  }

  get tileset() {
    return this._tileset;
  }

  get tile() {
    return this._tile;
  }

  /**
   * {@link Cesium3DTileContent} 接口的一部分。
   * 与其他内容类型不同，<code>Multiple3DTileContent</code> 没有
   * 单一的 URL，因此此值返回 undefined。
   *
   * @type {string}
   * @readonly
   * @private
   */
  get url() {
    return undefined;
  }

  /**
   * {@link Cesium3DTileContent} 接口的一部分。<code>Multiple3DTileContent</code>
   * 始终返回 <code>undefined</code>。应调用 <code>metadata</code> 获取特定内部内容。
   * @private
   */
  get metadata() {
    return undefined;
  }

  set metadata(_) {
    //>>includeStart('debug', pragmas.debug);
    throw new DeveloperError("Multiple3DTileContent cannot have metadata");
    //>>includeEnd('debug');
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。<code>Multiple3DTileContent</code>
   * 始终返回 <code>undefined</code>。应调用 <code>batchTable</code> 获取特定内部内容。
   * @private
   */
  get batchTable() {
    return undefined;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。<code>Multiple3DTileContent</code>
   * 始终返回 <code>undefined</code>。应调用 <code>group</code> 获取特定内部内容。
   * @private
   */
  get group() {
    return undefined;
  }

  set group(_) {
    //>>includeStart('debug', pragmas.debug);
    throw new DeveloperError(
      "Multiple3DTileContent cannot have group metadata",
    );
    //>>includeEnd('debug');
  }

  /** @inheritdoc */
  get show() {
    let result = true;
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      result = result & contents[i].show;
    }
    return result;
  }

  set show(value) {
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      contents[i].show = value;
    }
  }

  /**
   * 获取内部内容 URL 的数组，无论它们是否已被
   * 获取。此功能适用于与
   * {@link Cesium3DTileset#debugShowUrl} 使用。
   *
   * @type {string[]}
   * @readonly
   * @private
   */
  get innerContentUrls() {
    return this._innerContentHeaders.map(function (contentHeader) {
      return contentHeader.uri;
    });
  }

  /**
   * 请求此 <code>Multiple3DTileContent</code> 的内部内容。在
   * {@link Multiple3DTileContent#contentsFetchedPromise} 定义之前，必须调用一次。该承诺
   * 在所有请求安排完成后即可获取。
   * <p>
   * 当请求成功安排时，该方法还会更新瓦片统计中的待处理请求数量。
   * 如果请求成功安排，则承诺会在请求完成时解析，否则为 undefined，或者无法安排请求。
   * </p>
   *
   * @return {Promise<void>|undefined} A 取消所有内部内容的请求。当瓦片
   * @private
   */
  requestInnerContents() {
    // It's possible for these promises to leak content array buffers if the
    // camera moves before they all are scheduled. To prevent this leak, check
    // if we can schedule all the requests at once. If not, no requests are
    // scheduled
    if (!canScheduleAllRequests(this._serverKeys)) {
      this.tileset.statistics.numberOfAttemptedRequests +=
        this._serverKeys.length;
      return;
    }

    const contentHeaders = this._innerContentHeaders;
    updatePendingRequests(this, contentHeaders.length);

    const originalCancelCount = this._cancelCount;
    for (let i = 0; i < contentHeaders.length; i++) {
      // The cancel count is needed to avoid a race condition where a content
      // is canceled multiple times.
      this._arrayFetchPromises[i] = requestInnerContent(
        this,
        i,
        originalCancelCount,
        this._tile._contentState,
      );
    }

    return createInnerContents(this);
  }

  /**
   * 在瓦片消失时由瓦片调用。
   * 进行此操作。
   *
   * @private
   */
  cancelRequests() {
    for (let i = 0; i < this._requests.length; i++) {
      const request = this._requests[i];
      if (defined(request)) {
        request.cancel();
      }
    }
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。<code>Multiple3DTileContent</code>
   * 始终返回 <code>false</code>。应调用 <code>hasProperty</code> 获取特定内部内容。
   * @private
   */
  hasProperty(batchId, name) {
    return false;
  }

  /**
   * 属于 {@link Cesium3DTileContent} 接口的一部分。<code>Multiple3DTileContent</code>
   * 始终返回 <code>undefined</code>。应调用 <code>getFeature</code> 获取特定内部内容。
   * @private
   */
  getFeature(batchId) {
    return undefined;
  }

  applyDebugSettings(enabled, color) {
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      contents[i].applyDebugSettings(enabled, color);
    }
  }

  applyStyle(style) {
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      contents[i].applyStyle(style);
    }
  }

  update(tileset, frameState) {
    const contents = this._contents;
    const length = contents.length;
    let ready = true;
    for (let i = 0; i < length; ++i) {
      contents[i].update(tileset, frameState);
      ready = ready && contents[i].ready;
    }

    if (!this._ready && ready) {
      this._ready = true;
    }
  }

  /**
   * 查找光线与渲染的瓦片内容表面之间的交点。光线必须以世界坐标给出。
   *
   * @param {Ray} ray 用于检测交点的光线。
   * @param {FrameState} frameState 帧状态。
   * @param {Cartesian3|undefined} [result] 交点或 <code>undefined</code>，如果未找到交点。
   * @returns {Cartesian3|undefined} The 交点或 <code>undefined</code>，如果未找到交点。
   *
   * @private
   */
  pick(ray, frameState, result) {
    if (!this._ready) {
      return undefined;
    }

    let intersection;
    let minDistance = Number.POSITIVE_INFINITY;
    const contents = this._contents;
    const length = contents.length;

    for (let i = 0; i < length; ++i) {
      const candidate = contents[i].pick(ray, frameState, result);

      if (!defined(candidate)) {
        continue;
      }

      const distance = Cartesian3.distance(ray.origin, candidate);
      if (distance < minDistance) {
        intersection = candidate;
        minDistance = distance;
      }
    }

    if (!defined(intersection)) {
      return undefined;
    }

    return result;
  }

  isDestroyed() {
    return false;
  }

  destroy() {
    const contents = this._contents;
    const length = contents.length;
    for (let i = 0; i < length; ++i) {
      contents[i].destroy();
    }
    return destroyObject(this);
  }
}

function updatePendingRequests(multipleContents, deltaRequestCount) {
  multipleContents._requestsInFlight += deltaRequestCount;
  multipleContents.tileset.statistics.numberOfPendingRequests +=
    deltaRequestCount;
}

function cancelPendingRequests(multipleContents, originalContentState) {
  multipleContents._cancelCount++;

  // reset the tile's content state to try again later.
  multipleContents._tile._contentState = originalContentState;

  const statistics = multipleContents.tileset.statistics;

  statistics.numberOfPendingRequests -= multipleContents._requestsInFlight;
  statistics.numberOfAttemptedRequests += multipleContents._requestsInFlight;
  multipleContents._requestsInFlight = 0;

  // Discard the request promises.
  const contentCount = multipleContents._innerContentHeaders.length;
  multipleContents._arrayFetchPromises = new Array(contentCount);
}

/**
 * 检查是否所有内部内容的请求可以一次性安排。这较慢，但可避免潜在的内存泄漏。
 * @param {string[]} serverKeys 所有内部内容的服务器密钥
 * @return {boolean} True 如果请求调度器有足够的空闲槽位来安排所有内部内容。
 * @private
 */
function canScheduleAllRequests(serverKeys) {
  const requestCountsByServer = {};
  for (let i = 0; i < serverKeys.length; i++) {
    const serverKey = serverKeys[i];
    if (defined(requestCountsByServer[serverKey])) {
      requestCountsByServer[serverKey]++;
    } else {
      requestCountsByServer[serverKey] = 1;
    }
  }

  for (const key in requestCountsByServer) {
    if (
      requestCountsByServer.hasOwnProperty(key) &&
      !RequestScheduler.serverHasOpenSlots(key, requestCountsByServer[key])
    ) {
      return false;
    }
  }
  return RequestScheduler.heapHasOpenSlots(serverKeys.length);
}

function requestInnerContent(
  multipleContents,
  index,
  originalCancelCount,
  originalContentState,
) {
  // it is important to clone here. The fetchArrayBuffer() below here uses
  // throttling, but other uses of the resources do not.
  const contentResource =
    multipleContents._innerContentResources[index].clone();
  const tile = multipleContents.tile;

  // Always create a new request. If the tile gets canceled, this
  // avoids getting stuck in the canceled state.
  const priorityFunction = function () {
    return tile._priority;
  };
  const serverKey = multipleContents._serverKeys[index];
  const request = new Request({
    throttle: true,
    throttleByServer: true,
    type: RequestType.TILES3D,
    priorityFunction: priorityFunction,
    serverKey: serverKey,
  });
  contentResource.request = request;
  multipleContents._requests[index] = request;

  const promise = contentResource.fetchArrayBuffer();
  if (!defined(promise)) {
    return;
  }

  return promise
    .then(function (arrayBuffer) {
      // Pending requests have already been canceled.
      if (originalCancelCount < multipleContents._cancelCount) {
        return;
      }

      if (
        contentResource.request.cancelled ||
        contentResource.request.state === RequestState.CANCELLED
      ) {
        cancelPendingRequests(multipleContents, originalContentState);
        return;
      }

      updatePendingRequests(multipleContents, -1);
      return arrayBuffer;
    })
    .catch(function (error) {
      // Pending requests have already been canceled.
      if (originalCancelCount < multipleContents._cancelCount) {
        return;
      }

      if (
        contentResource.request.cancelled ||
        contentResource.request.state === RequestState.CANCELLED
      ) {
        cancelPendingRequests(multipleContents, originalContentState);
        return;
      }

      updatePendingRequests(multipleContents, -1);
      handleInnerContentFailed(multipleContents, index, error);
    });
}

async function createInnerContents(multipleContents) {
  const originalCancelCount = multipleContents._cancelCount;
  const arrayBuffers = await Promise.all(multipleContents._arrayFetchPromises);
  // Request have been cancelled
  if (originalCancelCount < multipleContents._cancelCount) {
    return;
  }

  const promises = arrayBuffers.map((arrayBuffer, i) =>
    createInnerContent(multipleContents, arrayBuffer, i),
  );

  // Even if we had a partial success (in which case the inner promise will be handled, but the content will not be returned), mark that we finished creating
  // contents
  const contents = await Promise.all(promises);
  multipleContents._contentsCreated = true;
  multipleContents._contents = contents.filter(defined);

  // If each content is an external tileset, then the tile
  // itself does not have any renderable content
  if (
    multipleContents._externalTilesetCount === multipleContents._contents.length
  ) {
    const tile = multipleContents._tile;
    tile.hasRenderableContent = false;
  }

  return contents;
}

async function createInnerContent(multipleContents, arrayBuffer, index) {
  if (!defined(arrayBuffer)) {
    // Content was not fetched. The error was handled in
    // the fetch promise. Return undefined to indicate partial failure.
    return;
  }

  try {
    const preprocessed = preprocess3DTileContent(arrayBuffer);

    const tileset = multipleContents._tileset;
    const resource = multipleContents._innerContentResources[index];
    const tile = multipleContents._tile;

    if (preprocessed.contentType === Cesium3DTileContentType.EXTERNAL_TILESET) {
      multipleContents._externalTilesetCount++;
      tile.hasTilesetContent = true;
    }

    multipleContents._disableSkipLevelOfDetail =
      multipleContents._disableSkipLevelOfDetail ||
      preprocessed.contentType === Cesium3DTileContentType.GEOMETRY ||
      preprocessed.contentType === Cesium3DTileContentType.VECTOR;

    let content;
    const contentFactory = Cesium3DTileContentFactory[preprocessed.contentType];
    if (defined(preprocessed.binaryPayload)) {
      content = await Promise.resolve(
        contentFactory(
          tileset,
          tile,
          resource,
          preprocessed.binaryPayload.buffer,
          0,
        ),
      );
    } else {
      // JSON formats
      content = await Promise.resolve(
        contentFactory(tileset, tile, resource, preprocessed.jsonPayload),
      );
    }

    const contentHeader = multipleContents._innerContentHeaders[index];

    if (tile.hasImplicitContentMetadata) {
      const subtree = tile.implicitSubtree;
      const coordinates = tile.implicitCoordinates;
      content.metadata = subtree.getContentMetadataView(coordinates, index);
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
  } catch (error) {
    handleInnerContentFailed(multipleContents, index, error);
  }
}

function handleInnerContentFailed(multipleContents, index, error) {
  const tileset = multipleContents._tileset;
  const url = multipleContents._innerContentResources[index].url;
  const message = defined(error.message) ? error.message : error.toString();
  if (tileset.tileFailed.numberOfListeners > 0) {
    tileset.tileFailed.raiseEvent({
      url: url,
      message: message,
    });
  } else {
    console.log(`A content failed to load: ${url}`);
    console.log(`Error: ${message}`);
  }
}

export default Multiple3DTileContent;
