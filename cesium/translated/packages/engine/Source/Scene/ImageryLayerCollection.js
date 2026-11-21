import {
  Cartesian2,
  Cartographic,
  DeveloperError,
  Event,
  GeographicProjection,
  Math as CesiumMath,
  Rectangle,
  defined,
  destroyObject,
} from "@cesium/core";
import ImageryLayer from "./ImageryLayer.js";
import ImageryState from "./ImageryState.js";

/**
 * 用于在 {@link Globe} 或 {@link Cesium3DTileset} 上渲染栅格影像的有序影像图层集合。
 *
 * @alias ImageryLayerCollection
 * @constructor
 * @see {@link Scene#imageryLayers} for 在球体上操作影像图层。
 * @see {@link Cesium3DTileset#imageryLayers} for 在 3D 瓦片集上操作影像图层。
 * @demo {@link https://sandcastle.cesium.com/index.html?id=imagery-adjustment|Cesium Sandcastle Imagery Adjustment Demo}
 * @demo {@link https://sandcastle.cesium.com/index.html?id=imagery-layers-manipulation|Cesium Sandcastle Imagery Manipulation Demo}
 */
function ImageryLayerCollection() {
  this._layers = [];

  /**
   * 当某个图层被添加到集合中时引发的事件。事件处理程序会接收到被添加的图层及其添加索引。
   * 当某个图层从集合中移除时引发的事件。事件处理程序会接收到被移除的图层及其移除索引。
   * @type {Event}
   * @default Event()
   */
  this.layerAdded = new Event();

  /**
   * 当某个图层在集合中改变位置时引发的事件。事件处理程序会接收到被移动的图层、移动后的新索引以及移动前的旧索引。
   * 当通过设置
   * @type {Event}
   * @default Event()
   */
  this.layerRemoved = new Event();

  /**
   * An event that is raised when a layer changes position in the collection.  Event handlers are passed the layer that
   * was moved, its new index after the move, and its old index prior to the move.
   * @type {Event}
   * @default Event()
   */
  this.layerMoved = new Event();

  /**
   * An event that is raised when a layer is shown or hidden by setting the
   * {@link ImageryLayer#show} 属性来显示或隐藏一个图层时引发的事件。事件处理程序会接收到该图层的引用、集合中该图层的索引，以及一个标志：如果图层现在被显示则为 true，否则为 false。
   * 获取该集合中的图层数量。
   * shown or false if it is now hidden.
   *
   * @type {Event}
   * @default Event()
   */
  this.layerShownOrHidden = new Event();
}

Object.defineProperties(ImageryLayerCollection.prototype, {
  /**
   * Gets the number of layers in this collection.
   * @memberof ImageryLayerCollection.prototype
   * @type {number}
   */
  length: {
    get: function () {
      return this._layers.length;
    },
  },
});

/**
 * 将图层添加到集合中。
 *
 * @param {ImageryLayer} layer 要添加的图层。
 * @param {number} [index] 添加图层的索引。如果省略，该图层将
 * 被添加到所有现有图层之上。
 *
 * @exception {DeveloperError} index, 如果提供，则必须大于或等于零且小于或等于图层数量。
 *
 * @example
 * const imageryLayer = Cesium.ImageryLayer.fromWorldImagery();
 * scene.imageryLayers.add(imageryLayer);
 *
 * @example
 * const imageryLayer = Cesium.ImageryLayer.fromProviderAsync(Cesium.IonImageryProvider.fromAssetId(3812));
 * scene.imageryLayers.add(imageryLayer);
 */
ImageryLayerCollection.prototype.add = function (layer, index) {
  const hasIndex = defined(index);

  //>>includeStart('debug', pragmas.debug);
  if (!defined(layer)) {
    throw new DeveloperError("layer is required.");
  }
  if (hasIndex) {
    if (index < 0) {
      throw new DeveloperError("index must be greater than or equal to zero.");
    } else if (index > this._layers.length) {
      throw new DeveloperError(
        "index must be less than or equal to the number of layers.",
      );
    }
  }
  //>>includeEnd('debug');

  if (!hasIndex) {
    index = this._layers.length;
    this._layers.push(layer);
  } else {
    this._layers.splice(index, 0, layer);
  }

  this._update();
  this.layerAdded.raiseEvent(layer, index);
  const removeReadyEventListener = layer.readyEvent.addEventListener(() => {
    this.layerShownOrHidden.raiseEvent(layer, layer._layerIndex, layer.show);
    removeReadyEventListener();
  });
};

/**
 * 使用给定的影像提供器创建新图层并将其添加到集合中。
 *
 * @param {ImageryProvider} imageryProvider 要创建新图层的影像提供器。
 * @param {number} [index] 添加图层的索引。如果省略，该图层将
 * 被添加到所有现有图层之上。
 * @returns {ImageryLayer} The 新创建的图层。
 *
 * @example
 * try {
 * const provider = await Cesium.IonImageryProvider.fromAssetId(3812);
 * scene.imageryLayers.addImageryProvider(provider);
 * } catch (error) {
 * console.log(`创建影像图层时出错。 ${error}`)
 * }
 */
ImageryLayerCollection.prototype.addImageryProvider = function (
  imageryProvider,
  index,
) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(imageryProvider)) {
    throw new DeveloperError("imageryProvider is required.");
  }
  //>>includeEnd('debug');

  const layer = new ImageryLayer(imageryProvider);
  this.add(layer, index);
  return layer;
};

/**
 * 如果存在，则从集合中移除一个图层。
 *
 * @param {ImageryLayer} layer 要移除的图层。
 * @param {boolean} [destroy=true] 是否除了移除之外还销毁这些图层。
 * @returns {boolean} true 如果图层在集合中且被移除，
 * 如果图层不在集合中则为 false。
 */
ImageryLayerCollection.prototype.remove = function (layer, destroy) {
  destroy = destroy ?? true;

  const index = this._layers.indexOf(layer);
  if (index !== -1) {
    this._layers.splice(index, 1);

    this._update();

    this.layerRemoved.raiseEvent(layer, index);

    if (destroy) {
      layer.destroy();
    }

    return true;
  }

  return false;
};

/**
 * 从集合中移除所有图层。
 *
 * @param {boolean} [destroy=true] 是否在移除控件的同时销毁其对应的图层。
 */
ImageryLayerCollection.prototype.removeAll = function (destroy) {
  destroy = destroy ?? true;

  const layers = this._layers;
  for (let i = 0, len = layers.length; i < len; i++) {
    const layer = layers[i];
    this.layerRemoved.raiseEvent(layer, i);

    if (destroy) {
      layer.destroy();
    }
  }

  this._layers = [];
};

/**
 * 检查集合中是否存在指定的图层。
 *
 * @param {ImageryLayer} layer 要检查的图层。
 *
 * @returns {boolean} true 如果集合中包含该图层，则返回 false，否则返回 true。
 */
ImageryLayerCollection.prototype.contains = function (layer) {
  return this.indexOf(layer) !== -1;
};

/**
 * 确定集合中指定图层的索引。
 *
 * @param {ImageryLayer} layer 查找索引的图层。
 *
 * @returns {number} The 集合中图层的索引，如果图层不存在于集合中则返回 -1。
 */
ImageryLayerCollection.prototype.indexOf = function (layer) {
  return this._layers.indexOf(layer);
};

/**
 * 根据索引从集合中获取图层。
 *
 * @param {number} index 要检索的索引。
 *
 * @returns {ImageryLayer} The 给定索引下的影像图层。
 */
ImageryLayerCollection.prototype.get = function (index) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(index)) {
    throw new DeveloperError("index is required.", "index");
  }
  //>>includeEnd('debug');

  return this._layers[index];
};

function getLayerIndex(layers, layer) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(layer)) {
    throw new DeveloperError("layer is required.");
  }
  //>>includeEnd('debug');

  const index = layers.indexOf(layer);

  //>>includeStart('debug', pragmas.debug);
  if (index === -1) {
    throw new DeveloperError("layer is not in this collection.");
  }
  //>>includeEnd('debug');

  return index;
}

function swapLayers(collection, i, j) {
  const arr = collection._layers;
  i = CesiumMath.clamp(i, 0, arr.length - 1);
  j = CesiumMath.clamp(j, 0, arr.length - 1);

  if (i === j) {
    return;
  }

  const temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;

  collection._update();

  collection.layerMoved.raiseEvent(temp, j, i);
}

/**
 * 将图层在集合中的位置向上移动一位。
 *
 * @param {ImageryLayer} layer 要移动的图层。
 *
 * @exception {DeveloperError} layer 不属于此集合。
 * @exception {DeveloperError} This 对象已被销毁，即调用了 destroy() 方法。
 */
ImageryLayerCollection.prototype.raise = function (layer) {
  const index = getLayerIndex(this._layers, layer);
  swapLayers(this, index, index + 1);
};

/**
 * 将图层在集合中的位置向下移动一位。
 *
 * @param {ImageryLayer} layer 要移动的图层。
 *
 * @exception {DeveloperError} layer 不属于此集合。
 * @exception {DeveloperError} This 对象已被销毁，即调用了 destroy() 方法。
 */
ImageryLayerCollection.prototype.lower = function (layer) {
  const index = getLayerIndex(this._layers, layer);
  swapLayers(this, index, index - 1);
};

/**
 * 将图层移动到集合的顶部。
 *
 * @param {ImageryLayer} layer 要移动的图层。
 *
 * @exception {DeveloperError} layer 不属于此集合。
 * @exception {DeveloperError} This 对象已被销毁，即调用了 destroy() 方法。
 */
ImageryLayerCollection.prototype.raiseToTop = function (layer) {
  const index = getLayerIndex(this._layers, layer);
  if (index === this._layers.length - 1) {
    return;
  }
  this._layers.splice(index, 1);
  this._layers.push(layer);

  this._update();

  this.layerMoved.raiseEvent(layer, this._layers.length - 1, index);
};

/**
 * 将图层移动到集合的底部。
 *
 * @param {ImageryLayer} layer 要移动的图层。
 *
 * @exception {DeveloperError} layer 不属于此集合。
 * @exception {DeveloperError} This 对象已被销毁，即调用了 destroy() 方法。
 */
ImageryLayerCollection.prototype.lowerToBottom = function (layer) {
  const index = getLayerIndex(this._layers, layer);
  if (index === 0) {
    return;
  }
  this._layers.splice(index, 1);
  this._layers.splice(0, 0, layer);

  this._update();

  this.layerMoved.raiseEvent(layer, 0, index);
};

const applicableRectangleScratch = new Rectangle();

function pickImageryHelper(scene, pickedLocation, pickFeatures, callback) {
  // Find the terrain tile containing the picked location.
  const tilesToRender = scene.globe._surface._tilesToRender;
  let pickedTile;

  for (
    let textureIndex = 0;
    !defined(pickedTile) && textureIndex < tilesToRender.length;
    ++textureIndex
  ) {
    const tile = tilesToRender[textureIndex];
    if (Rectangle.contains(tile.rectangle, pickedLocation)) {
      pickedTile = tile;
    }
  }

  if (!defined(pickedTile)) {
    return;
  }

  // Pick against all attached imagery tiles containing the pickedLocation.
  const imageryTiles = pickedTile.data.imagery;

  for (let i = imageryTiles.length - 1; i >= 0; --i) {
    const terrainImagery = imageryTiles[i];
    const imagery = terrainImagery.readyImagery;
    if (!defined(imagery)) {
      continue;
    }
    if (!imagery.imageryLayer.ready) {
      continue;
    }
    const provider = imagery.imageryLayer.imageryProvider;
    if (pickFeatures && !defined(provider.pickFeatures)) {
      continue;
    }

    if (!Rectangle.contains(imagery.rectangle, pickedLocation)) {
      continue;
    }

    // If this imagery came from a parent, it may not be applicable to its entire rectangle.
    // Check the textureCoordinateRectangle.
    const applicableRectangle = applicableRectangleScratch;

    const epsilon = 1 / 1024; // 1/4 of a pixel in a typical 256x256 tile.
    applicableRectangle.west = CesiumMath.lerp(
      pickedTile.rectangle.west,
      pickedTile.rectangle.east,
      terrainImagery.textureCoordinateRectangle.x - epsilon,
    );
    applicableRectangle.east = CesiumMath.lerp(
      pickedTile.rectangle.west,
      pickedTile.rectangle.east,
      terrainImagery.textureCoordinateRectangle.z + epsilon,
    );
    applicableRectangle.south = CesiumMath.lerp(
      pickedTile.rectangle.south,
      pickedTile.rectangle.north,
      terrainImagery.textureCoordinateRectangle.y - epsilon,
    );
    applicableRectangle.north = CesiumMath.lerp(
      pickedTile.rectangle.south,
      pickedTile.rectangle.north,
      terrainImagery.textureCoordinateRectangle.w + epsilon,
    );
    if (!Rectangle.contains(applicableRectangle, pickedLocation)) {
      continue;
    }

    callback(imagery);
  }
}

/**
 * 确定被拾取射线相交的影像图层。要从屏幕上的位置计算拾取射线，请使用 {@link Camera.getPickRay}。
 * 用于测试相交的射线。
 *
 * @param {Ray} ray 用于检测相交的射线。
 * @param {Scene} scene 场景。
 * @return {ImageryLayer[]|undefined} An 包含所有图层的数组。
 * 被指定拾取射线相交的图层。如果未选择任何图层，则返回 undefined。
 * 没有选中图层。
 *
 */
ImageryLayerCollection.prototype.pickImageryLayers = function (ray, scene) {
  // Find the picked location on the globe.
  const pickedPosition = scene.globe.pick(ray, scene);
  if (!defined(pickedPosition)) {
    return;
  }

  const pickedLocation =
    scene.ellipsoid.cartesianToCartographic(pickedPosition);

  const imageryLayers = [];

  pickImageryHelper(scene, pickedLocation, false, function (imagery) {
    imageryLayers.push(imagery.imageryLayer);
  });

  if (imageryLayers.length === 0) {
    return undefined;
  }

  return imageryLayers;
};

const nativeBoundingRectangleScratch = new Rectangle();
const nativeApplicableRectangleScratch = new Rectangle();
const southwestNativeScratch = new Cartesian2();
const northeastNativeScratch = new Cartesian2();
const southwestCartographicScratch = new Cartographic();
const northeastCartographicScratch = new Cartographic();

/**
 * 将纹理坐标矩形（原始体的 UV 空间）映射回地理矩形，使用原始体的地图边界和
 * 影像平铺方案的原生坐标。
 * 异步确定被拾取射线相交的影像图层特征。被相交的影像图层特征是通过调用
 *
 * @private
 */

function computeApplicableGeographicRectangle(
  cartographicBoundingRectangle,
  textureCoordinateRectangle,
  imageryLayer,
  result,
) {
  const tilingScheme = imageryLayer.imageryProvider.tilingScheme;
  const nativeBoundingRectangle = tilingScheme.rectangleToNativeRectangle(
    cartographicBoundingRectangle,
    nativeBoundingRectangleScratch,
  );

  const epsilon = 1 / 1024; // 1/4 of a pixel in a typical 256x256 tile.
  const applicableNative = nativeApplicableRectangleScratch;
  applicableNative.west = CesiumMath.lerp(
    nativeBoundingRectangle.west,
    nativeBoundingRectangle.east,
    textureCoordinateRectangle.minX - epsilon,
  );
  applicableNative.east = CesiumMath.lerp(
    nativeBoundingRectangle.west,
    nativeBoundingRectangle.east,
    textureCoordinateRectangle.maxX + epsilon,
  );
  applicableNative.south = CesiumMath.lerp(
    nativeBoundingRectangle.south,
    nativeBoundingRectangle.north,
    textureCoordinateRectangle.minY - epsilon,
  );
  applicableNative.north = CesiumMath.lerp(
    nativeBoundingRectangle.south,
    nativeBoundingRectangle.north,
    textureCoordinateRectangle.maxY + epsilon,
  );

  if (!defined(result)) {
    result = new Rectangle();
  }

  const projection = tilingScheme.projection;
  if (projection instanceof GeographicProjection) {
    result.west = CesiumMath.toRadians(applicableNative.west);
    result.south = CesiumMath.toRadians(applicableNative.south);
    result.east = CesiumMath.toRadians(applicableNative.east);
    result.north = CesiumMath.toRadians(applicableNative.north);
    return result;
  }

  southwestNativeScratch.x = applicableNative.west;
  southwestNativeScratch.y = applicableNative.south;
  northeastNativeScratch.x = applicableNative.east;
  northeastNativeScratch.y = applicableNative.north;

  const southwest = projection.unproject(
    southwestNativeScratch,
    southwestCartographicScratch,
  );
  const northeast = projection.unproject(
    northeastNativeScratch,
    northeastCartographicScratch,
  );
  result.west = southwest.longitude;
  result.south = southwest.latitude;
  result.east = northeast.longitude;
  result.north = northeast.latitude;
  return result;
}

function pickModelFeatures(model, pickedLocation, callback) {
  const modelImagery = model._modelImagery;

  if (!defined(modelImagery)) {
    return;
  }

  const modelPrimitiveImageries = modelImagery._modelPrimitiveImageries;

  if (!defined(modelPrimitiveImageries)) {
    return;
  }

  for (let j = 0; j < modelPrimitiveImageries.length; j++) {
    const modelPrimitiveImagery = modelPrimitiveImageries[j];
    const coveragesPerLayer = modelPrimitiveImagery._coveragesPerLayer;
    if (!defined(coveragesPerLayer)) {
      continue;
    }

    for (let k = coveragesPerLayer.length - 1; k >= 0; --k) {
      const coverages = coveragesPerLayer[k];

      for (let l = 0; l < coverages.length; l++) {
        const coverage = coverages[l];
        const imagery = coverage.imagery;
        const imageryLayer = imagery.imageryLayer;
        const provider = imageryLayer.imageryProvider;

        if (!defined(provider.pickFeatures)) {
          continue;
        }

        if (!defined(imagery) || imagery.state !== ImageryState.READY) {
          continue;
        }

        if (!Rectangle.contains(imagery.rectangle, pickedLocation)) {
          continue;
        }

        const mappedPositions =
          modelPrimitiveImagery.mappedPositionsForImageryLayer(imageryLayer);
        const cartographicBoundingRectangle =
          mappedPositions.cartographicBoundingRectangle;

        const applicableRectangle = computeApplicableGeographicRectangle(
          cartographicBoundingRectangle,
          coverage.textureCoordinateRectangle,
          imageryLayer,
          applicableRectangleScratch,
        );

        if (!Rectangle.contains(applicableRectangle, pickedLocation)) {
          continue;
        }

        callback(imagery);
      }
    }
  }
}

/**
 * 对于被拾取射线相交的每个影像图层瓦片，调用 {@link ImageryProvider#pickFeatures} 来查找的。要从屏幕上的位置计算拾取射线，请使用 {@link Camera.getPickRay}。
 * 用于测试相交的射线。
 * 场景。
 *
 * @param {Ray} ray 承诺，该承诺会返回一个被拾取射线相交的特征数组。
 * @param {Scene} scene 如果可以迅速确定没有特征相交（例如，
 * @return {Promise<ImageryLayerFeatureInfo[]>|undefined} A 因为没有活跃的影像提供程序支持 {@link ImageryProvider#pickFeatures}
 * 或者因为拾取射线没有与表面相交），此函数将
 * 返回 undefined。
 * or because the pick ray does not intersect the surface), this function will
 * return undefined.
 *
 * @example
 * const pickRay = viewer.camera.getPickRay(windowPosition);
 * const featuresPromise = viewer.imageryLayers.pickImageryLayerFeatures(pickRay, viewer.scene);
 * if (!Cesium.defined(featuresPromise)) {
 * console.log('No features picked.');
 * } else {
 * Promise.resolve(featuresPromise).then(function(features) {
 * // 当选中的实体列表可用时，此函数会异步调用。
 * console.log(`Number of features: ${features.length}`);
 * if (features.length > 0) {
 * console.log(`First feature name: ${features[0].name}`);
 *         }
 *     });
 * }
 */
ImageryLayerCollection.prototype.pickImageryLayerFeatures = function (
  ray,
  scene,
) {
  // Find the picked location on the globe.
  let pickedPosition;

  if (defined(scene.globe)) {
    pickedPosition = scene.globe.pick(ray, scene);
  }

  let pickedModel;

  if (!defined(pickedPosition)) {
    const result = scene.pickFromRay(ray);

    if (!defined(result)) {
      return undefined;
    }

    pickedPosition = result.position;

    if (!defined(pickedPosition)) {
      return undefined;
    }

    if (defined(result.object) && defined(result.object.detail)) {
      pickedModel = result.object.detail.model;
    }
  }

  const pickedLocation =
    scene.ellipsoid.cartesianToCartographic(pickedPosition);

  const promises = [];
  const imageryLayers = [];

  function queuePickFeatures(imagery) {
    if (!imagery.imageryLayer.ready) {
      return undefined;
    }
    const provider = imagery.imageryLayer.imageryProvider;
    const promise = provider.pickFeatures(
      imagery.x,
      imagery.y,
      imagery.level,
      pickedLocation.longitude,
      pickedLocation.latitude,
    );
    if (defined(promise)) {
      promises.push(promise);
      imageryLayers.push(imagery.imageryLayer);
    }
  }

  if (defined(scene.globe)) {
    pickImageryHelper(scene, pickedLocation, true, function (imagery) {
      queuePickFeatures(imagery);
    });
  }

  if (defined(pickedModel)) {
    pickModelFeatures(pickedModel, pickedLocation, function (imagery) {
      queuePickFeatures(imagery);
    });
  }

  if (promises.length === 0) {
    return undefined;
  }

  return Promise.all(promises).then(function (results) {
    const features = [];
    for (let resultIndex = 0; resultIndex < results.length; ++resultIndex) {
      const result = results[resultIndex];
      const image = imageryLayers[resultIndex];
      if (defined(result) && result.length > 0) {
        for (
          let featureIndex = 0;
          featureIndex < result.length;
          ++featureIndex
        ) {
          const feature = result[featureIndex];
          feature.imageryLayer = image;
          // For features without a position, use the picked location.
          if (!defined(feature.position)) {
            feature.position = pickedLocation;
          }
          features.push(feature);
        }
      }
    }
    return features;
  });
};

/**
 * 更新帧状态以执行任何待处理的纹理重投影。
 *
 * @ignore
 *
 * @param {FrameState} frameState 帧状态。
 */
ImageryLayerCollection.prototype.queueReprojectionCommands = function (
  frameState,
) {
  const layers = this._layers;
  for (let i = 0, len = layers.length; i < len; ++i) {
    layers[i].queueReprojectionCommands(frameState);
  }
};

/**
 * 取消下帧的重投影命令。
 *
 * @ignore
 */
ImageryLayerCollection.prototype.cancelReprojections = function () {
  const layers = this._layers;
  for (let i = 0, len = layers.length; i < len; ++i) {
    layers[i].cancelReprojections();
  }
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code>之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} true 如果此对象被销毁；否则返回 false。
 *
 * @see ImageryLayerCollection#destroy
 */
ImageryLayerCollection.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁该集合中所有层所持有的 WebGL 资源。明确销毁此
 * 对象允许确定性地释放 WebGL 资源，而不是依赖垃圾收集器。
 * 器。
 * <br /><br />
 * 一旦此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code>之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给该对象，如示例中所示。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy()。
 *
 *
 * @example
 * layerCollection = layerCollection && layerCollection.destroy();
 *
 * @see ImageryLayerCollection#isDestroyed
 */
ImageryLayerCollection.prototype.destroy = function () {
  this.removeAll(true);
  return destroyObject(this);
};

ImageryLayerCollection.prototype._update = function () {
  let isBaseLayer = true;
  const layers = this._layers;
  let layersShownOrHidden;
  let layer;
  let i, len;
  for (i = 0, len = layers.length; i < len; ++i) {
    layer = layers[i];

    layer._layerIndex = i;

    if (layer.show) {
      layer._isBaseLayer = isBaseLayer;
      isBaseLayer = false;
    } else {
      layer._isBaseLayer = false;
    }

    if (layer.show !== layer._show) {
      if (defined(layer._show)) {
        if (!defined(layersShownOrHidden)) {
          layersShownOrHidden = [];
        }
        layersShownOrHidden.push(layer);
      }
      layer._show = layer.show;
    }
  }

  if (defined(layersShownOrHidden)) {
    for (i = 0, len = layersShownOrHidden.length; i < len; ++i) {
      layer = layersShownOrHidden[i];
      this.layerShownOrHidden.raiseEvent(layer, layer._layerIndex, layer.show);
    }
  }
};
export default ImageryLayerCollection;
