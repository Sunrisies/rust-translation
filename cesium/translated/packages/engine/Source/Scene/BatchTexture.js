import {
  Cartesian2,
  Cartesian4,
  Check,
  Color,
  DeveloperError,
  PixelDatatype,
  PixelFormat,
  createGuid,
  defined,
  destroyObject,
} from "@cesium/core";
import ContextLimits from "../Renderer/ContextLimits.js";
import Sampler from "../Renderer/Sampler.js";
import Texture from "../Renderer/Texture.js";

/**
 * 用于管理批次中颜色、显示/隐藏及纹理拾取的对象
 * 表格或特征表
 *
 * @param {object} options 具有以下属性的对象：
 * @param {number} featuresLength 批次表格或特征表中的特征数量
 * @param {Cesium3DTileContent|ModelFeatureTable} owner 该批次纹理的所有者。对于 3D Tiles，这将是一个 {@link Cesium3DTileContent}。对于 glTF 模型，这将是一个 {@link ModelFeatureTable}。
 * @param {object} [statistics] 用于更新关于批次纹理信息的统计对象
 * @param {Function} [colorChangedCallback] 当特征颜色发生变化时调用的回调函数
 *
 * @alias BatchTexture
 * @constructor
 *
 * @private
 */
function BatchTexture(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("options.featuresLength", options.featuresLength);
  Check.typeOf.object("options.owner", options.owner);
  //>>includeEnd('debug');

  this._id = createGuid();

  const featuresLength = options.featuresLength;

  // PERFORMANCE_IDEA: These parallel arrays probably generate cache misses in get/set color/show
  // and use A LOT of memory.  How can we use less memory?
  this._showAlphaProperties = undefined; // [Show (0 or 255), Alpha (0 to 255)] property for each feature
  this._batchValues = undefined; // Per-feature RGBA (A is based on the color's alpha and feature's show property)

  this._batchValuesDirty = false;
  this._batchTexture = undefined;
  this._defaultTexture = undefined;

  this._pickTexture = undefined;
  this._pickIds = [];

  // Dimensions for batch and pick textures
  let textureDimensions;
  let textureStep;

  if (featuresLength > 0) {
    // PERFORMANCE_IDEA: this can waste memory in the last row in the uncommon case
    // when more than one row is needed (e.g., > 16K features in one tile)
    const width = Math.min(featuresLength, ContextLimits.maximumTextureSize);
    const height = Math.ceil(featuresLength / ContextLimits.maximumTextureSize);
    const stepX = 1.0 / width;
    const centerX = stepX * 0.5;
    const stepY = 1.0 / height;
    const centerY = stepY * 0.5;

    textureDimensions = new Cartesian2(width, height);
    textureStep = new Cartesian4(stepX, centerX, stepY, centerY);
  }

  this._translucentFeaturesLength = 0;
  this._featuresLength = featuresLength;
  this._textureDimensions = textureDimensions;
  this._textureStep = textureStep;
  this._owner = options.owner;
  this._statistics = options.statistics;
  this._colorChangedCallback = options.colorChangedCallback;
}

Object.defineProperties(BatchTexture.prototype, {
  /**
   * 半透明特征的数量
   *
   * @memberof BatchTexture.prototype
   * @type {number}
   * @readonly
   * @private
   */
  translucentFeaturesLength: {
    get: function () {
      return this._translucentFeaturesLength;
    },
  },

  /**
   * 该批次纹理使用的所有 GPU 资源的总大小
   *
   * @memberof BatchTexture.prototype
   * @type {number}
   * @readonly
   * @private
   */
  byteLength: {
    get: function () {
      let memory = 0;
      if (defined(this._pickTexture)) {
        memory += this._pickTexture.sizeInBytes;
      }
      if (defined(this._batchTexture)) {
        memory += this._batchTexture.sizeInBytes;
      }
      return memory;
    },
  },

  /**
   * 底层批次纹理的维度
   *
   * @memberof BatchTexture.prototype
   * @type {Cartesian2}
   * @readonly
   * @private
   */
  textureDimensions: {
    get: function () {
      return this._textureDimensions;
    },
  },

  /**
   * 每个纹理的大小以及沿各方向的纹素中心到边缘的距离。以 (stepX, centerX, stepY, centerY) 形式存储
   * 用于样式化的底层纹理。纹素通过
   *
   * @memberof BatchTexture.prototype
   * @type {Cartesian4}
   * @readonly
   * @private
   */
  textureStep: {
    get: function () {
      return this._textureStep;
    },
  },

  /**
   * 批次 ID 访问，其值为考虑
   * 显示/隐藏设置后的该特征的颜色后的值
   * 得到的颜色。
   *
   * @memberof BatchTexture.prototype
   * @type {Texture}
   * @readonly
   * @private
   */
  batchTexture: {
    get: function () {
      return this._batchTexture;
    },
  },

  /**
   * 当没有批次值时使用的默认纹理
   *
   * @memberof BatchTexture.prototype
   * @type {Texture}
   * @readonly
   * @private
   */
  defaultTexture: {
    get: function () {
      return this._defaultTexture;
    },
  },

  /**
   * 用于拾取的底层纹理。纹素通过
   * 批次 ID 访问，其值为拾取颜色
   *
   * @memberof BatchTexture.prototype
   * @type {Texture}
   * @readonly
   * @private
   */
  pickTexture: {
    get: function () {
      return this._pickTexture;
    },
  },
});

BatchTexture.DEFAULT_COLOR_VALUE = Color.WHITE;
BatchTexture.DEFAULT_SHOW_VALUE = true;

function getByteLength(batchTexture) {
  const dimensions = batchTexture._textureDimensions;
  return dimensions.x * dimensions.y * 4;
}

function getBatchValues(batchTexture) {
  if (!defined(batchTexture._batchValues)) {
    // Default batch texture to RGBA = 255: white highlight (RGB) and show/alpha = true/255 (A).
    const byteLength = getByteLength(batchTexture);
    const bytes = new Uint8Array(byteLength).fill(255);
    batchTexture._batchValues = bytes;
  }

  return batchTexture._batchValues;
}

function getShowAlphaProperties(batchTexture) {
  if (!defined(batchTexture._showAlphaProperties)) {
    const byteLength = 2 * batchTexture._featuresLength;
    const bytes = new Uint8Array(byteLength).fill(255);
    // [Show = true, Alpha = 255]
    batchTexture._showAlphaProperties = bytes;
  }
  return batchTexture._showAlphaProperties;
}

function checkBatchId(batchId, featuresLength) {
  if (!defined(batchId) || batchId < 0 || batchId >= featuresLength) {
    throw new DeveloperError(
      `batchId is required and between zero and featuresLength - 1 (${featuresLength}` -
        +").",
    );
  }
}

/**
 * 设置特征是否可见
 *
 * @param {number} batchId 特征的 ID
 * @param {boolean} show 如果特征应显示，则为 <code>true</code>，否则为 <code>false</code>
 * @private
 */
BatchTexture.prototype.setShow = function (batchId, show) {
  //>>includeStart('debug', pragmas.debug);
  checkBatchId(batchId, this._featuresLength);
  Check.typeOf.bool("show", show);
  //>>includeEnd('debug');

  if (show && !defined(this._showAlphaProperties)) {
    // Avoid allocating since the default is show = true
    return;
  }

  const showAlphaProperties = getShowAlphaProperties(this);
  const propertyOffset = batchId * 2;

  const newShow = show ? 255 : 0;
  if (showAlphaProperties[propertyOffset] !== newShow) {
    showAlphaProperties[propertyOffset] = newShow;

    const batchValues = getBatchValues(this);

    // Compute alpha used in the shader based on show and color.alpha properties
    const offset = batchId * 4 + 3;
    batchValues[offset] = show ? showAlphaProperties[propertyOffset + 1] : 0;

    this._batchValuesDirty = true;
  }
};

/**
 * 一次性设置所有特征的显示状态
 *
 * @param {boolean} show 如果特征应显示，则为 <code>true</code>，否则为 <code>false</code>
 * @private
 */
BatchTexture.prototype.setAllShow = function (show) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.bool("show", show);
  //>>includeEnd('debug');

  const featuresLength = this._featuresLength;
  for (let i = 0; i < featuresLength; ++i) {
    this.setShow(i, show);
  }
};

/**
 * 检查特征的当前显示值
 *
 * @param {number} batchId 特征的 ID
 * @return {boolean} <code>true</code> 如果特征可见，则为 <code>true</code>，否则为 <code>false</code>
 * @private
 */
BatchTexture.prototype.getShow = function (batchId) {
  //>>includeStart('debug', pragmas.debug);
  checkBatchId(batchId, this._featuresLength);
  //>>includeEnd('debug');

  if (!defined(this._showAlphaProperties)) {
    // Avoid allocating since the default is show = true
    return true;
  }

  const offset = batchId * 2;
  return this._showAlphaProperties[offset] === 255;
};

const scratchColorBytes = new Array(4);

/**
 * 设置特征的样式颜色
 *
 * @param {number} batchId 特征的 ID
 * @param {Color} color 分配给该特征的颜色
 *
 * @private
 */
BatchTexture.prototype.setColor = function (batchId, color) {
  //>>includeStart('debug', pragmas.debug);
  checkBatchId(batchId, this._featuresLength);
  Check.typeOf.object("color", color);
  //>>includeEnd('debug');

  if (
    Color.equals(color, BatchTexture.DEFAULT_COLOR_VALUE) &&
    !defined(this._batchValues)
  ) {
    // Avoid allocating since the default is white
    return;
  }

  const newColor = color.toBytes(scratchColorBytes);
  const newAlpha = newColor[3];

  const batchValues = getBatchValues(this);
  const offset = batchId * 4;

  const showAlphaProperties = getShowAlphaProperties(this);
  const propertyOffset = batchId * 2;

  if (
    batchValues[offset] !== newColor[0] ||
    batchValues[offset + 1] !== newColor[1] ||
    batchValues[offset + 2] !== newColor[2] ||
    showAlphaProperties[propertyOffset + 1] !== newAlpha
  ) {
    batchValues[offset] = newColor[0];
    batchValues[offset + 1] = newColor[1];
    batchValues[offset + 2] = newColor[2];

    const wasTranslucent = showAlphaProperties[propertyOffset + 1] !== 255;

    // Compute alpha used in the shader based on show and color.alpha properties
    const show = showAlphaProperties[propertyOffset] !== 0;
    batchValues[offset + 3] = show ? newAlpha : 0;
    showAlphaProperties[propertyOffset + 1] = newAlpha;

    // Track number of translucent features so we know if this tile needs
    // opaque commands, translucent commands, or both for rendering.
    const isTranslucent = newAlpha !== 255;
    if (isTranslucent && !wasTranslucent) {
      ++this._translucentFeaturesLength;
    } else if (!isTranslucent && wasTranslucent) {
      --this._translucentFeaturesLength;
    }

    this._batchValuesDirty = true;

    if (defined(this._colorChangedCallback)) {
      this._colorChangedCallback(batchId, color);
    }
  }
};

/**
 * 一次性设置所有特征的样式颜色
 *
 * @param {Color} color 分配给所有特征的颜色
 *
 * @private
 */
BatchTexture.prototype.setAllColor = function (color) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("color", color);
  //>>includeEnd('debug');

  const featuresLength = this._featuresLength;
  for (let i = 0; i < featuresLength; ++i) {
    this.setColor(i, color);
  }
};

/**
 * 获取特征的当前颜色
 *
 * @param {number} batchId 特征的 ID
 * @param {Color} result 将结果存储的颜色对象
 * @return {Color} The 分配给选定特征的颜色
 *
 * @private
 */
BatchTexture.prototype.getColor = function (batchId, result) {
  //>>includeStart('debug', pragmas.debug);
  checkBatchId(batchId, this._featuresLength);
  Check.typeOf.object("result", result);
  //>>includeEnd('debug');

  if (!defined(this._batchValues)) {
    return Color.clone(BatchTexture.DEFAULT_COLOR_VALUE, result);
  }

  const batchValues = this._batchValues;
  const offset = batchId * 4;

  const showAlphaProperties = this._showAlphaProperties;
  const propertyOffset = batchId * 2;

  return Color.fromBytes(
    batchValues[offset],
    batchValues[offset + 1],
    batchValues[offset + 2],
    showAlphaProperties[propertyOffset + 1],
    result,
  );
};

/**
 * 获取特征的拾取颜色。该特征是 RGBA 编码的
 * 拾取 ID。
 *
 * @param {number} batchId 特征的 ID
 * @return {PickId} The 分配给该特征的拾取颜色
 *
 * @private
 */
BatchTexture.prototype.getPickColor = function (batchId) {
  //>>includeStart('debug', pragmas.debug);
  checkBatchId(batchId, this._featuresLength);
  //>>includeEnd('debug');
  return this._pickIds[batchId];
};

function createTexture(batchTexture, context, bytes) {
  const dimensions = batchTexture._textureDimensions;
  return new Texture({
    context: context,
    pixelFormat: PixelFormat.RGBA,
    pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
    source: {
      width: dimensions.x,
      height: dimensions.y,
      arrayBufferView: bytes,
    },
    flipY: false,
    sampler: Sampler.NEAREST,
  });
}

function createPickTexture(batchTexture, context) {
  const featuresLength = batchTexture._featuresLength;
  if (!defined(batchTexture._pickTexture) && featuresLength > 0) {
    const pickIds = batchTexture._pickIds;
    const byteLength = getByteLength(batchTexture);
    const bytes = new Uint8Array(byteLength);
    const owner = batchTexture._owner;
    const statistics = batchTexture._statistics;

    // PERFORMANCE_IDEA: we could skip the pick texture completely by allocating
    // a continuous range of pickIds and then converting the base pickId + batchId
    // to RGBA in the shader.  The only consider is precision issues, which might
    // not be an issue in WebGL 2.
    for (let i = 0; i < featuresLength; ++i) {
      const pickId = context.createPickId(owner.getFeature(i));
      pickIds.push(pickId);

      const pickColor = pickId.color;
      const offset = i * 4;
      bytes[offset] = Color.floatToByte(pickColor.red);
      bytes[offset + 1] = Color.floatToByte(pickColor.green);
      bytes[offset + 2] = Color.floatToByte(pickColor.blue);
      bytes[offset + 3] = Color.floatToByte(pickColor.alpha);
    }

    batchTexture._pickTexture = createTexture(batchTexture, context, bytes);

    // Make sure the tileset statistics are updated the frame when the pick
    // texture is created.
    if (defined(statistics)) {
      statistics.batchTableByteLength += batchTexture._pickTexture.sizeInBytes;
    }
  }
}

function updateBatchTexture(batchTexture) {
  const dimensions = batchTexture._textureDimensions;
  // PERFORMANCE_IDEA: Instead of rewriting the entire texture, use fine-grained
  // texture updates when less than, for example, 10%, of the values changed.  Or
  // even just optimize the common case when one feature show/color changed.
  batchTexture._batchTexture.copyFrom({
    source: {
      width: dimensions.x,
      height: dimensions.y,
      arrayBufferView: batchTexture._batchValues,
    },
  });
}

BatchTexture.prototype.update = function (tileset, frameState) {
  const context = frameState.context;
  this._defaultTexture = context.defaultTexture;

  const passes = frameState.passes;
  if (passes.pick || passes.postProcess) {
    createPickTexture(this, context);
  }

  if (this._batchValuesDirty) {
    this._batchValuesDirty = false;

    // Create batch texture on-demand
    if (!defined(this._batchTexture)) {
      this._batchTexture = createTexture(this, context, this._batchValues);

      // Make sure the tileset statistics are updated the frame when the
      // batch texture is created.
      if (defined(this._statistics)) {
        this._statistics.batchTableByteLength += this._batchTexture.sizeInBytes;
      }
    }

    updateBatchTexture(this); // Apply per-feature show/color updates
  }
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <p>
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 * </p>
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁；否则为 <code>false</code>。
 *
 * @see BatchTexture#destroy
 * @private
 */
BatchTexture.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象持有的 WebGL 资源。销毁对象可确保确定性
 * 释放 WebGL 资源，而非依赖垃圾收集器来销毁该对象。
 * <p>
 * 一旦对象被销毁，就不应再使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数都会引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给该对象，如示例中所做的那样。
 * </p>
 *
 * @exception {DeveloperError} This 对象已被销毁，即调用了 destroy() 方法。
 *
 * @example
 * e = e && e.destroy();
 *
 * @see BatchTexture#isDestroyed
 * @private
 */
BatchTexture.prototype.destroy = function () {
  this._batchTexture = this._batchTexture && this._batchTexture.destroy();
  this._pickTexture = this._pickTexture && this._pickTexture.destroy();

  const pickIds = this._pickIds;
  const length = pickIds.length;
  for (let i = 0; i < length; ++i) {
    pickIds[i].destroy();
  }

  return destroyObject(this);
};

export default BatchTexture;
