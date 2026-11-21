import { Color, defined } from "@cesium/core";

/**
 * 一个 {@link Model} 的特性。
 * <p>
 * 提供对模型特征表中存储的该特性属性的访问。
 * </p>
 * <p>
 * 对 <code>ModelFeature</code> 对象的修改具有模型的生命周期。
 * </p>
 * <p>
 * 不要直接构造此对象，应通过 {@link Scene#pick} 选择来访问它。
 * </p>
 *
 * @alias ModelFeature
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Model} options.model 该特性所属的模型。
 * @param {number} options.featureId 该特性的唯一整体标识符。
 *
 * @example
 * // 当鼠标悬停时，在控制台日志中显示该特性的所有属性。
 * handler.setInputAction(function(movement) {
 * const feature = scene.pick(movement.endPosition);
 * if (feature instanceof Cesium.ModelFeature) {
 * console.log(feature);
 *     }
 * }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
 *
 */
function ModelFeature(options) {
  this._model = options.model;

  // This ModelFeatureTable is not documented as an option since it is
  // part of the private API and should not appear in the documentation.
  this._featureTable = options.featureTable;

  this._featureId = options.featureId;
  this._color = undefined; // for calling getColor
}

Object.defineProperties(ModelFeature.prototype, {
  /**
   * 获取或设置该特性是否会被显示。此设置对所有特性生效
   * 当样式中的 show 属性被评估时。
   *
   * @memberof ModelFeature.prototype
   *
   * @type {boolean}
   *
   * @default true
   */
  show: {
    get: function () {
      return this._featureTable.getShow(this._featureId);
    },
    set: function (value) {
      this._featureTable.setShow(this._featureId, value);
    },
  },

  /**
   * 获取或设置与特性颜色相乘的高亮颜色。当
   * 此颜色为白色时，特性颜色不会改变。此设置对所有特性生效
   * 当样式中的颜色属性被评估时。
   *
   * @memberof ModelFeature.prototype
   *
   * @type {Color}
   *
   * @default {@link Color.WHITE}
   */
  color: {
    get: function () {
      if (!defined(this._color)) {
        this._color = new Color();
      }
      return this._featureTable.getColor(this._featureId, this._color);
    },
    set: function (value) {
      this._featureTable.setColor(this._featureId, value);
    },
  },
  /**
   * {@link Scene#pick} 返回的所有对象都具有 <code>primitive</code> 属性。这返回
   * 包含该特性的模型。
   *
   * @memberof ModelFeature.prototype
   *
   * @type {Model}
   *
   * @readonly
   * @private
   */
  primitive: {
    get: function () {
      return this._model;
    },
  },

  /**
   * 该特性所属的 {@link ModelFeatureTable}。
   *
   * @memberof ModelFeature.prototype
   *
   * @type {ModelFeatureTable}
   *
   * @readonly
   * @private
   */
  featureTable: {
    get: function () {
      return this._featureTable;
    },
  },

  /**
   * 获取与该特性相关的特征 ID。对于 3D Tiles 1.0，返回
   * 批次 ID。对于 EXT_mesh_features，这是来自
   * 所选特征 ID 集的特征 ID。
   *
   * @memberof ModelFeature.prototype
   *
   * @type {number}
   *
   * @readonly
   * @experimental This 该特性使用的是 3D Tiles 规范中尚未定稿的部分，可能会因 Cesium 标准弃用政策而发生变化。
   */
  featureId: {
    get: function () {
      return this._featureId;
    },
  },
});

/**
 * 返回该特性是否包含此属性。
 *
 * @param {string} name 属性的大小写敏感名称。
 * @returns {boolean} Whether 该特性包含此属性。
 */
ModelFeature.prototype.hasProperty = function (name) {
  return this._featureTable.hasProperty(this._featureId, name);
};

/**
 * 返回具有给定名称的特性的属性值副本。
 *
 * @param {string} name 属性的大小写敏感名称。
 * @returns {*} The 属性的值，或者如果特性没有此属性则返回 <code>undefined</code>。
 *
 * @example
 * // 在控制台日志中显示该特性的所有属性。
 * const propertyIds = feature.getPropertyIds();
 * const length = propertyIds.length;
 * for (let i = 0; i < length; ++i) {
 * const propertyId = propertyIds[i];
 * console.log(propertyId + ': ' + feature.getProperty(propertyId));
 * }
 */
ModelFeature.prototype.getProperty = function (name) {
  return this._featureTable.getProperty(this._featureId, name);
};

/**
 * 返回具有给定名称的特性的属性值副本，并检查所有
 * 来自 EXT_structural_metadata 和 legacy EXT_feature_metadata glTF 的元数据。
 * extensions. Metadata 按照从最具体到最通用的顺序与名称进行匹配。
 * 首先返回最通用的匹配项。Metadata 的匹配顺序如下：
 * <ol>
 * <li>通过语义的结构性元数据属性</li>
 * <li>通过属性 ID 的结构性元数据属性</li>
 * </ol>
 * <p>
 * 请参阅 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_structural_metadata|EXT_structural_metadata Extension} 以及
 * 之前的 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_feature_metadata|EXT_feature_metadata Extension} 关于 glTF 的内容。
 * </p>
 *
 * @param {string} name 特征的语义或属性 ID。在每种粒度级别中，先检查语义，再检查属性 ID。
 * @return {*} The 属性的值，如果特征没有该属性则返回 <code>undefined</code>。
 *
 * @experimental This 该特征使用了 3D Tiles 规范中的部分内容，该内容尚未最终定稿，可能会因 Cesium 的标准弃用政策而发生变化。
 */
ModelFeature.prototype.getPropertyInherited = function (name) {
  if (this._featureTable.hasPropertyBySemantic(this._featureId, name)) {
    return this._featureTable.getPropertyBySemantic(this._featureId, name);
  }

  return this._featureTable.getProperty(this._featureId, name);
};

/**
 * 返回特征的属性 ID 数组。
 *
 * @param {string[]} [results] 用于存储结果的数组。
 * @returns {string[]} The 特征属性的 ID。
 */
ModelFeature.prototype.getPropertyIds = function (results) {
  return this._featureTable.getPropertyIds(results);
};

/**
 * 设置具有给定名称的特征属性值。
 *
 * @param {string} name 属性名称区分大小写。
 * @param {*} value 将被复制的属性值。
 * @returns {boolean} <code>true</code> 如果属性已设置，返回 <code>true</code>，否则返回 <code>false</code>。
 *
 * @exception {DeveloperError} Inherited batch table hierarchy 属性为只读。
 *
 * @example
 * const height = feature.getProperty('Height'); // 例如，建筑物的高度
 *
 * @example
 * const name = 'clicked';
 * if (feature.getProperty(name)) {
 * console.log('already clicked');
 * } else {
 * feature.setProperty(name, true);
 * console.log('first click');
 * }
 */
ModelFeature.prototype.setProperty = function (name, value) {
  return this._featureTable.setProperty(this._featureId, name, value);
};

export default ModelFeature;
