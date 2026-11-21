import { Check, Color, defined, destroyObject } from "@cesium/core";
import BatchTexture from "../BatchTexture.js";
import Cesium3DTileFeature from "../Cesium3DTileFeature.js";
import ModelFeature from "./ModelFeature.js";
import StyleCommandsNeeded from "./StyleCommandsNeeded.js";
import ModelType from "./ModelType.js";

/**
 * 管理 {@link ModelFeature} 在 {@link Model} 中的状态。
 * 从 {@link PropertyTable} 中提取属性。
 *
 * @param {object} options 包含以下选项的对象：
 * @param {Model} options.model 拥有该特性表的模型。
 * @param {PropertyTable} options.propertyTable 用于初始化模型的属性表。
 *
 * @alias ModelFeatureTable
 * @constructor
 *
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该规范尚未定稿，可能会因 Cesium 标准弃用政策而发生变化。
 */
function ModelFeatureTable(options) {
  const model = options.model;
  const propertyTable = options.propertyTable;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("propertyTable", propertyTable);
  Check.typeOf.object("model", model);
  //>>includeEnd('debug');

  this._propertyTable = propertyTable;
  this._model = model;

  this._features = undefined;
  this._featuresLength = 0;

  this._batchTexture = undefined;

  this._styleCommandsNeededDirty = false;
  this._styleCommandsNeeded = StyleCommandsNeeded.ALL_OPAQUE;

  initialize(this);
}

Object.defineProperties(ModelFeatureTable.prototype, {
  /**
   * 为表中特性创建的批处理纹理。
   *
   * @memberof ModelFeatureTable.prototype
   *
   * @type {BatchTexture}
   * @readonly
   *
   * @private
   */
  batchTexture: {
    get: function () {
      return this._batchTexture;
    },
  },

  /**
   * 表中特性的数量。
   *
   * @memberof ModelFeatureTable.prototype
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  featuresLength: {
    get: function () {
      return this._featuresLength;
    },
  },

  /**
   * 批处理纹理的大小。此大小不包括属性表的大小，因为后者通过 StructuralMetadata 单独计算。
   * 一个标志，用于指示该特性表所需的样式命令类型是否发生变化。
   *
   * @memberof ModelFeatureTable.prototype
   *
   * @type {number}
   * @readonly
   *
   * @private
   */
  batchTextureByteLength: {
    get: function () {
      if (defined(this._batchTexture)) {
        return this._batchTexture.byteLength;
      }

      return 0;
    },
  },

  /**
   * 一个标志，用于指示该特性表所需的样式命令类型是否发生变化。
   *
   * @memberof ModelFeatureTable.prototype
   *
   * @type {boolean}
   * @readonly
   *
   * @private
   */
  styleCommandsNeededDirty: {
    get: function () {
      return this._styleCommandsNeededDirty;
    },
  },
});

function initialize(modelFeatureTable) {
  const model = modelFeatureTable._model;
  const is3DTiles = ModelType.is3DTiles(model.type);

  const featuresLength = modelFeatureTable._propertyTable.count;
  if (featuresLength === 0) {
    return;
  }

  let i;
  const features = new Array(featuresLength);
  if (is3DTiles) {
    const content = model.content;
    for (i = 0; i < featuresLength; i++) {
      features[i] = new Cesium3DTileFeature(content, i);
    }
  } else {
    for (i = 0; i < featuresLength; i++) {
      features[i] = new ModelFeature({
        model: model,
        featureId: i,
        featureTable: modelFeatureTable,
      });
    }
  }

  modelFeatureTable._features = features;
  modelFeatureTable._featuresLength = featuresLength;

  modelFeatureTable._batchTexture = new BatchTexture({
    featuresLength: featuresLength,
    owner: modelFeatureTable,
    statistics: is3DTiles ? model.content.tileset.statistics : undefined,
  });
}

/**
 * 创建/更新批处理纹理。
 *
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */
ModelFeatureTable.prototype.update = function (frameState) {
  // Assume the number of translucent features has not changed.
  this._styleCommandsNeededDirty = false;
  this._batchTexture.update(undefined, frameState);

  const currentStyleCommandsNeeded = StyleCommandsNeeded.getStyleCommandsNeeded(
    this._featuresLength,
    this._batchTexture.translucentFeaturesLength,
  );

  if (this._styleCommandsNeeded !== currentStyleCommandsNeeded) {
    this._styleCommandsNeededDirty = true;
    this._styleCommandsNeeded = currentStyleCommandsNeeded;
  }
};

ModelFeatureTable.prototype.setShow = function (featureId, show) {
  this._batchTexture.setShow(featureId, show);
};

ModelFeatureTable.prototype.setAllShow = function (show) {
  this._batchTexture.setAllShow(show);
};

ModelFeatureTable.prototype.getShow = function (featureId) {
  return this._batchTexture.getShow(featureId);
};

ModelFeatureTable.prototype.setColor = function (featureId, color) {
  this._batchTexture.setColor(featureId, color);
};

ModelFeatureTable.prototype.setAllColor = function (color) {
  this._batchTexture.setAllColor(color);
};

ModelFeatureTable.prototype.getColor = function (featureId, result) {
  return this._batchTexture.getColor(featureId, result);
};

ModelFeatureTable.prototype.getPickColor = function (featureId) {
  return this._batchTexture.getPickColor(featureId);
};

ModelFeatureTable.prototype.getFeature = function (featureId) {
  return this._features[featureId];
};

ModelFeatureTable.prototype.hasProperty = function (featureId, propertyName) {
  return this._propertyTable.hasProperty(featureId, propertyName);
};

ModelFeatureTable.prototype.hasPropertyBySemantic = function (
  featureId,
  propertyName,
) {
  return this._propertyTable.hasPropertyBySemantic(featureId, propertyName);
};

ModelFeatureTable.prototype.getProperty = function (featureId, name) {
  return this._propertyTable.getProperty(featureId, name);
};

ModelFeatureTable.prototype.getPropertyBySemantic = function (
  featureId,
  semantic,
) {
  return this._propertyTable.getPropertyBySemantic(featureId, semantic);
};

ModelFeatureTable.prototype.getPropertyIds = function (results) {
  return this._propertyTable.getPropertyIds(results);
};

ModelFeatureTable.prototype.setProperty = function (featureId, name, value) {
  return this._propertyTable.setProperty(featureId, name, value);
};

ModelFeatureTable.prototype.isClass = function (featureId, className) {
  return this._propertyTable.isClass(featureId, className);
};

ModelFeatureTable.prototype.isExactClass = function (featureId, className) {
  return this._propertyTable.isExactClass(featureId, className);
};

ModelFeatureTable.prototype.getExactClassName = function (featureId) {
  return this._propertyTable.getExactClassName(featureId);
};

const scratchColor = new Color();
/**
 * @private
 */
ModelFeatureTable.prototype.applyStyle = function (style) {
  if (!defined(style)) {
    this.setAllColor(BatchTexture.DEFAULT_COLOR_VALUE);
    this.setAllShow(BatchTexture.DEFAULT_SHOW_VALUE);
    return;
  }

  for (let i = 0; i < this._featuresLength; i++) {
    const feature = this.getFeature(i);
    const color = defined(style.color)
      ? (style.color.evaluateColor(feature, scratchColor) ??
        BatchTexture.DEFAULT_COLOR_VALUE)
      : BatchTexture.DEFAULT_COLOR_VALUE;
    const show = defined(style.show)
      ? (style.show.evaluate(feature) ?? BatchTexture.DEFAULT_SHOW_VALUE)
      : BatchTexture.DEFAULT_SHOW_VALUE;

    this.setColor(i, color);
    this.setShow(i, show);
  }
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <p>
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数都将引发 {@link DeveloperError} 异常。
 * </p>
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 <code>false</code>；否则返回 true。
 *
 * @see ModelFeatureTable#destroy
 * @private
 */
ModelFeatureTable.prototype.isDestroyed = function () {
  return false;
};

/**
 * 销毁此对象所持有的 WebGL 资源。销毁对象可以确保 WebGL 资源的确定性释放，而无需依赖垃圾收集器来销毁该对象。
 * 一旦对象被销毁，就不应再使用它；调用除
 * <p>
 * <code>isDestroyed</code> 之外的任何函数都将引发 {@link DeveloperError} 异常。因此，
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
 * 表示对象被销毁，即调用了 destroy() 方法。
 * </p>
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 *
 * @example
 * e = e && e.destroy();
 *
 * @see ModelFeatureTable#isDestroyed
 * @private
 */
ModelFeatureTable.prototype.destroy = function (frameState) {
  this._batchTexture = this._batchTexture && this._batchTexture.destroy();
  destroyObject(this);
};

export default ModelFeatureTable;