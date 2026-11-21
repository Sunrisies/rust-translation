import {
  DeveloperError,
  Frozen,
  addAllToArray,
  clone,
  defined,
} from "@cesium/core";
import Resource from "../Core/Resource.js";
import ConditionsExpression from "./ConditionsExpression.js";
import Expression from "./Expression.js";

/**
 * 应用于 {@link Cesium3DTileset} 的样式。
 * <p>
 * 使用
 * {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling|3D Tiles Styling language} 定义的表达式进行评估。
 * </p>
 *
 * @alias Cesium3DTileStyle
 * @constructor
 *
 * @param {object} [style] 定义样式的对象。
 *
 * @example
 * tileset.style = new Cesium.Cesium3DTileStyle({
 * color : {
 * conditions : [
 * ['${Height} >= 100', 'color("purple", 0.5)'],
 * ['${Height} >= 50', 'color("red")'],
 * ['true', 'color("blue")']
 *         ]
 *     },
 * show : '${Height} > 0',
 * meta : {
 * description : '"Building id ${id} has height ${Height}."'
 *     }
 * });
 *
 * @example
 * tileset.style = new Cesium.Cesium3DTileStyle({
 * color : 'vec4(${Temperature})',
 * pointSize : '${Temperature} * 2.0'
 * });
 *
 * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling|3D Tiles Styling language}
 */
function Cesium3DTileStyle(style) {
  this._style = {};
  this._ready = false;

  this._show = undefined;
  this._color = undefined;
  this._pointSize = undefined;
  this._pointOutlineColor = undefined;
  this._pointOutlineWidth = undefined;
  this._labelColor = undefined;
  this._labelOutlineColor = undefined;
  this._labelOutlineWidth = undefined;
  this._font = undefined;
  this._labelStyle = undefined;
  this._labelText = undefined;
  this._backgroundColor = undefined;
  this._backgroundPadding = undefined;
  this._backgroundEnabled = undefined;
  this._scaleByDistance = undefined;
  this._translucencyByDistance = undefined;
  this._distanceDisplayCondition = undefined;
  this._heightOffset = undefined;
  this._anchorLineEnabled = undefined;
  this._anchorLineColor = undefined;
  this._image = undefined;
  this._disableDepthTestDistance = undefined;
  this._horizontalOrigin = undefined;
  this._verticalOrigin = undefined;
  this._labelHorizontalOrigin = undefined;
  this._labelVerticalOrigin = undefined;
  this._meta = undefined;

  // Vector Tiles in 3D Tiles 2.0.
  this._lineWidth = undefined;

  this._colorShaderFunction = undefined;
  this._showShaderFunction = undefined;
  this._pointSizeShaderFunction = undefined;
  this._colorShaderFunctionReady = false;
  this._showShaderFunctionReady = false;
  this._pointSizeShaderFunctionReady = false;

  this._colorShaderTranslucent = false;

  setup(this, style);
}

function setup(that, styleJson) {
  styleJson = clone(styleJson, true) ?? that._style;
  that._style = styleJson;

  that.show = styleJson.show;
  that.color = styleJson.color;
  that.pointSize = styleJson.pointSize;
  that.pointOutlineColor = styleJson.pointOutlineColor;
  that.pointOutlineWidth = styleJson.pointOutlineWidth;
  that.labelColor = styleJson.labelColor;
  that.labelOutlineColor = styleJson.labelOutlineColor;
  that.labelOutlineWidth = styleJson.labelOutlineWidth;
  that.labelStyle = styleJson.labelStyle;
  that.font = styleJson.font;
  that.labelText = styleJson.labelText;
  that.backgroundColor = styleJson.backgroundColor;
  that.backgroundPadding = styleJson.backgroundPadding;
  that.backgroundEnabled = styleJson.backgroundEnabled;
  that.scaleByDistance = styleJson.scaleByDistance;
  that.translucencyByDistance = styleJson.translucencyByDistance;
  that.distanceDisplayCondition = styleJson.distanceDisplayCondition;
  that.heightOffset = styleJson.heightOffset;
  that.anchorLineEnabled = styleJson.anchorLineEnabled;
  that.anchorLineColor = styleJson.anchorLineColor;
  that.image = styleJson.image;
  that.disableDepthTestDistance = styleJson.disableDepthTestDistance;
  that.horizontalOrigin = styleJson.horizontalOrigin;
  that.verticalOrigin = styleJson.verticalOrigin;
  that.labelHorizontalOrigin = styleJson.labelHorizontalOrigin;
  that.labelVerticalOrigin = styleJson.labelVerticalOrigin;

  // Vector Tiles in 3D Tiles 2.0.
  that.lineWidth = styleJson.lineWidth;

  const meta = {};
  if (defined(styleJson.meta)) {
    const defines = styleJson.defines;
    const metaJson = styleJson.meta ?? Frozen.EMPTY_OBJECT;
    for (const property in metaJson) {
      if (metaJson.hasOwnProperty(property)) {
        meta[property] = new Expression(metaJson[property], defines);
      }
    }
  }

  that._meta = meta;

  that._ready = true;
}

function getExpression(tileStyle, value) {
  const defines = (tileStyle._style ?? Frozen.EMPTY_OBJECT).defines;

  if (!defined(value)) {
    return undefined;
  } else if (typeof value === "boolean" || typeof value === "number") {
    return new Expression(String(value));
  } else if (typeof value === "string") {
    return new Expression(value, defines);
  } else if (defined(value.conditions)) {
    return new ConditionsExpression(value, defines);
  }
  return value;
}

function getJsonFromExpression(expression) {
  if (!defined(expression)) {
    return undefined;
  } else if (defined(expression.expression)) {
    return expression.expression;
  } else if (defined(expression.conditionsExpression)) {
    return clone(expression.conditionsExpression, true);
  }
  return expression;
}

Object.defineProperties(Cesium3DTileStyle.prototype, {
  /**
   * 使用
   * {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling|3D Tiles Styling language} 获取定义样式的对象。
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {object}
   * @readonly
   *
   * @default {}
   */
  style: {
    get: function () {
      return this._style;
    },
  },

  /**
   * 用于评估样式的 <code>show</code> 属性，可获取或设置 {@link StyleExpression} 对象。也可以使用布尔值、字符串或定义显示样式的对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值与设置器提供的值可能不同。
   * <p>
   * 表达式必须返回或转换为 <code>Boolean</code>。
   * </p>
   * <p>
   * 此表达式适用于所有瓦片格式。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @example
   * const style = new Cesium3DTileStyle({
   * show : '(regExp("^Chest").test(${County})) && (${YearBuilt} >= 1970)'
   * });
   * style.show.evaluate(feature); // 根据特征属性返回 true 或 false
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用自定义函数覆盖 show 表达式
   * style.show = {
   * evaluate : function(feature) {
   * return true;
   *     }
   * };
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用布尔值覆盖 show 表达式
   * style.show = true;
   * };
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 show 表达式
   * style.show = '${Height} > 0';
   * };
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用条件覆盖 show 表达式
   * style.show = {
   * conditions: [
   * ['${height} > 2', 'false'],
   * ['true', 'true']
   *     ];
   * };
   */
  show: {
    get: function () {
      return this._show;
    },
    set: function (value) {
      this._show = getExpression(this, value);
      this._style.show = getJsonFromExpression(this._show);
      this._showShaderFunctionReady = false;
    },
  },

  /**
   * 用于评估样式的 <code>color</code> 属性，可获取或设置 {@link StyleExpression} 对象。也可以使用字符串或定义颜色样式的对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值与设置器提供的值可能不同。
   * <p>
   * 该表达式必须返回一个 <code>Color</code>。
   * </p>
   * <p>
   * 此表达式适用于所有瓦片格式。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @example
   * const style = new Cesium3DTileStyle({
   * color : '(${Temperature} > 90) ? color("red") : color("white")'
   * });
   * style.color.evaluateColor(feature, result); // 返回一个 Cesium.Color 对象
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用自定义函数覆盖颜色表达式
   * style.color = {
   * evaluateColor : function(feature, result) {
   * return Cesium.Color.clone(Cesium.Color.WHITE, result);
   *     }
   * };
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖颜色表达式
   * style.color = 'color("blue")';
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用条件覆盖颜色表达式
   * style.color = {
   * conditions : [
   * ['${height} > 2', 'color("cyan")'],
   * ['true', 'color("blue")']
   *     ]
   * };
   */
  color: {
    get: function () {
      return this._color;
    },
    set: function (value) {
      this._color = getExpression(this, value);
      this._style.color = getJsonFromExpression(this._color);
      this._colorShaderFunctionReady = false;
    },
  },

  /**
   * 获取或设置用于计算样式 <code>pointSize</code> 属性的 {@link StyleExpression} 对象。也可以使用定义点大小样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>Number</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片或点云瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @example
   * const style = new Cesium3DTileStyle({
   * pointSize : '(${Temperature} > 90) ? 2.0 : 1.0'
   * });
   * style.pointSize.evaluate(feature); // 返回一个 Number
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用自定义函数覆盖点大小表达式
   * style.pointSize = {
   * evaluate : function(feature) {
   * return 1.0;
   *     }
   * };
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用数字覆盖点大小表达式
   * style.pointSize = 1.0;
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖点大小表达式
   * style.pointSize = '${height} / 10';
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用条件覆盖点大小表达式
   * style.pointSize =  {
   * conditions : [
   * ['${height} > 2', '1.0'],
   * ['true', '2.0']
   *     ]
   * };
   */
  pointSize: {
    get: function () {
      return this._pointSize;
    },
    set: function (value) {
      this._pointSize = getExpression(this, value);
      this._style.pointSize = getJsonFromExpression(this._pointSize);
      this._pointSizeShaderFunctionReady = false;
    },
  },

  /**
   * 获取或设置用于计算样式 <code>pointOutlineColor</code> 属性的 {@link StyleExpression} 对象。也可以使用定义颜色样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>Color</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 pointOutlineColor 表达式
   * style.pointOutlineColor = 'color("blue")';
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用条件覆盖 pointOutlineColor 表达式
   * style.pointOutlineColor = {
   * conditions : [
   * ['${height} > 2', 'color("cyan")'],
   * ['true', 'color("blue")']
   *     ]
   * };
   */
  pointOutlineColor: {
    get: function () {
      return this._pointOutlineColor;
    },
    set: function (value) {
      this._pointOutlineColor = getExpression(this, value);
      this._style.pointOutlineColor = getJsonFromExpression(
        this._pointOutlineColor,
      );
    },
  },

  /**
   * 用于评估样式 <code>pointOutlineWidth</code> 属性的 {@link StyleExpression} 对象。或者可以使用定义数值样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>Number</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 pointOutlineWidth 表达式
   * style.pointOutlineWidth = '5';
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用条件覆盖 pointOutlineWidth 表达式
   * style.pointOutlineWidth = {
   * conditions : [
   * ['${height} > 2', '5'],
   * ['true', '0']
   *     ]
   * };
   */
  pointOutlineWidth: {
    get: function () {
      return this._pointOutlineWidth;
    },
    set: function (value) {
      this._pointOutlineWidth = getExpression(this, value);
      this._style.pointOutlineWidth = getJsonFromExpression(
        this._pointOutlineWidth,
      );
    },
  },

  /**
   * 用于评估样式 <code>labelColor</code> 属性的 {@link StyleExpression} 对象。或者可以使用定义颜色样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>Color</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 labelColor 表达式
   * style.labelColor = 'color("blue")';
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 通过条件覆盖 labelColor 表达式
   * style.labelColor = {
   * conditions : [
   * ['${height} > 2', 'color("cyan")'],
   * ['true', 'color("blue")']
   *     ]
   * };
   */
  labelColor: {
    get: function () {
      return this._labelColor;
    },
    set: function (value) {
      this._labelColor = getExpression(this, value);
      this._style.labelColor = getJsonFromExpression(this._labelColor);
    },
  },

  /**
   * 获取或设置用于计算样式 <code>labelOutlineColor</code> 属性的 {@link StyleExpression} 对象。也可以使用定义颜色样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 表达式必须返回 <code>Color</code> 类型。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会因 Cesium 标准弃用政策而发生变化。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 通过字符串覆盖 labelOutlineColor 表达式
   * style.labelOutlineColor = 'color("blue")';
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 通过条件覆盖 labelOutlineColor 表达式
   * style.labelOutlineColor = {
   * conditions : [
   * ['${height} > 2', 'color("cyan")'],
   * ['true', 'color("blue")']
   *     ]
   * };
   */
  labelOutlineColor: {
    get: function () {
      return this._labelOutlineColor;
    },
    set: function (value) {
      this._labelOutlineColor = getExpression(this, value);
      this._style.labelOutlineColor = getJsonFromExpression(
        this._labelOutlineColor,
      );
    },
  },

  /**
   * 获取或设置用于计算样式 <code>labelOutlineWidth</code> 属性的 {@link StyleExpression} 对象。也可以使用定义数值样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 表达式必须返回 <code>Number</code> 类型。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会因 Cesium 标准弃用政策而发生变化。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 通过字符串覆盖 labelOutlineWidth 表达式
   * style.labelOutlineWidth = '5';
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 通过条件覆盖 labelOutlineWidth 表达式
   * style.labelOutlineWidth = {
   * conditions : [
   * ['${height} > 2', '5'],
   * ['true', '0']
   *     ]
   * };
   */
  labelOutlineWidth: {
    get: function () {
      return this._labelOutlineWidth;
    },
    set: function (value) {
      this._labelOutlineWidth = getExpression(this, value);
      this._style.labelOutlineWidth = getJsonFromExpression(
        this._labelOutlineWidth,
      );
    },
  },

  /**
   * 获取或设置用于计算样式 <code>font</code> 属性的 {@link StyleExpression} 对象。也可以使用定义字符串样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>String</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
   *
   * @example
   * const style = new Cesium3DTileStyle({
   * font : '(${Temperature} > 90) ? "30px Helvetica" : "24px Helvetica"'
   * });
   * style.font.evaluate(feature); // 返回一个 String
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用自定义函数覆盖 font 表达式
   * style.font = {
   * evaluate : function(feature) {
   * return '24px Helvetica';
   *     }
   * };
   */
  font: {
    get: function () {
      return this._font;
    },
    set: function (value) {
      this._font = getExpression(this, value);
      this._style.font = getJsonFromExpression(this._font);
    },
  },

  /**
   * 用于获取或设置用于评估样式 <code>label style</code> 属性的 {@link StyleExpression} 对象。也可以使用定义数字样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，这些可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>LabelStyle</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
   *
   * @example
   * const style = new Cesium3DTileStyle({
   * labelStyle : `(\${Temperature} > 90) ? ${LabelStyle.FILL_AND_OUTLINE} : ${LabelStyle.FILL}`
   * });
   * style.labelStyle.evaluate(feature); // 返回一个 LabelStyle
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用自定义函数覆盖 labelStyle 表达式
   * style.labelStyle = {
   * evaluate : function(feature) {
   * return LabelStyle.FILL;
   *     }
   * };
   */
  labelStyle: {
    get: function () {
      return this._labelStyle;
    },
    set: function (value) {
      this._labelStyle = getExpression(this, value);
      this._style.labelStyle = getJsonFromExpression(this._labelStyle);
    },
  },

  /**
   * 用于获取或设置用于评估样式 <code>labelText</code> 属性的 {@link StyleExpression} 对象。也可以使用定义字符串样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，这些可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>String</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
   *
   * @example
   * const style = new Cesium3DTileStyle({
   * labelText : '(${Temperature} > 90) ? ">90" : "<=90"'
   * });
   * style.labelText.evaluate(feature); // 返回一个 String
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用自定义函数覆盖 labelText 表达式
   * style.labelText = {
   * evaluate : function(feature) {
   * return 'Example label text';
   *     }
   * };
   */
  labelText: {
    get: function () {
      return this._labelText;
    },
    set: function (value) {
      this._labelText = getExpression(this, value);
      this._style.labelText = getJsonFromExpression(this._labelText);
    },
  },

  /**
   * 用于获取或设置用于计算样式 <code>backgroundColor</code> 属性的 {@link StyleExpression} 对象。也可以使用定义颜色样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 表达式必须返回 <code>Color</code> 类型。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿且可能随 Cesium 标准弃用政策而变更。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 backgroundColor 表达式
   * style.backgroundColor = 'color("blue")';
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用条件覆盖 backgroundColor 表达式
   * style.backgroundColor = {
   * conditions : [
   * ['${height} > 2', 'color("cyan")'],
   * ['true', 'color("blue")']
   *     ]
   * };
   */
  backgroundColor: {
    get: function () {
      return this._backgroundColor;
    },
    set: function (value) {
      this._backgroundColor = getExpression(this, value);
      this._style.backgroundColor = getJsonFromExpression(
        this._backgroundColor,
      );
    },
  },

  /**
   * 用于获取或设置用于计算样式 <code>backgroundPadding</code> 属性的 {@link StyleExpression} 对象。也可以使用定义 vec2 样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 表达式必须返回 <code>Cartesian2</code> 类型。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿且可能随 Cesium 标准弃用政策而变更。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 backgroundPadding 表达式
   * style.backgroundPadding = 'vec2(5.0, 7.0)';
   * style.backgroundPadding.evaluate(feature); // 返回一个 Cartesian2
   */
  backgroundPadding: {
    get: function () {
      return this._backgroundPadding;
    },
    set: function (value) {
      this._backgroundPadding = getExpression(this, value);
      this._style.backgroundPadding = getJsonFromExpression(
        this._backgroundPadding,
      );
    },
  },

  /**
   * 用于获取或设置用于计算样式 <code>backgroundEnabled</code> 属性的 {@link StyleExpression} 对象。也可以使用定义布尔样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>Boolean</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This “feature”使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 backgroundEnabled 表达式
   * style.backgroundEnabled = 'true';
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用条件覆盖 backgroundEnabled 表达式
   * style.backgroundEnabled = {
   * conditions : [
   * ['${height} > 2', 'true'],
   * ['true', 'false']
   *     ]
   * };
   */
  backgroundEnabled: {
    get: function () {
      return this._backgroundEnabled;
    },
    set: function (value) {
      this._backgroundEnabled = getExpression(this, value);
      this._style.backgroundEnabled = getJsonFromExpression(
        this._backgroundEnabled,
      );
    },
  },

  /**
   * 用于评估样式 <code>scaleByDistance</code> 属性的 {@link StyleExpression} 对象。也可以使用定义 vec4 样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>Cartesian4</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This “feature”使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 scaleByDistance 表达式
   * style.scaleByDistance = 'vec4(1.5e2, 2.0, 1.5e7, 0.5)';
   * style.scaleByDistance.evaluate(feature); // 返回一个 Cartesian4
   */
  scaleByDistance: {
    get: function () {
      return this._scaleByDistance;
    },
    set: function (value) {
      this._scaleByDistance = getExpression(this, value);
      this._style.scaleByDistance = getJsonFromExpression(
        this._scaleByDistance,
      );
    },
  },

  /**
   * 用于评估样式 <code>translucencyByDistance</code> 属性的 {@link StyleExpression} 对象。也可以使用定义 vec4 样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>Cartesian4</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This “feature”使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 translucencyByDistance 表达式
   * style.translucencyByDistance = 'vec4(1.5e2, 1.0, 1.5e7, 0.2)';
   * style.translucencyByDistance.evaluate(feature); // 返回一个 Cartesian4
   */
  translucencyByDistance: {
    get: function () {
      return this._translucencyByDistance;
    },
    set: function (value) {
      this._translucencyByDistance = getExpression(this, value);
      this._style.translucencyByDistance = getJsonFromExpression(
        this._translucencyByDistance,
      );
    },
  },

  /**
   * 用于评估样式 <code>distanceDisplayCondition</code> 属性的 {@link StyleExpression} 对象。也可以使用定义 vec2 样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 表达式必须返回 <code>Cartesian2</code>。
   * </p>
   * <p>
   * 该表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿，且可能根据 Cesium 的标准弃用政策进行更改。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 distanceDisplayCondition 表达式
   * style.distanceDisplayCondition = 'vec2(0.0, 5.5e6)';
   * style.distanceDisplayCondition.evaluate(feature); // 返回一个 Cartesian2
   */
  distanceDisplayCondition: {
    get: function () {
      return this._distanceDisplayCondition;
    },
    set: function (value) {
      this._distanceDisplayCondition = getExpression(this, value);
      this._style.distanceDisplayCondition = getJsonFromExpression(
        this._distanceDisplayCondition,
      );
    },
  },

  /**
   * 用于获取或设置用于计算样式 <code>heightOffset</code> 属性的 {@link StyleExpression} 对象。也可以使用定义数字样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 表达式必须返回 <code>Number</code>。
   * </p>
   * <p>
   * 该表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿，且可能根据 Cesium 的标准弃用政策进行更改。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 heightOffset 表达式
   * style.heightOffset = '2.0';
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用条件覆盖 heightOffset 表达式
   * style.heightOffset = {
   * conditions : [
   * ['${height} > 2', '4.0'],
   * ['true', '2.0']
   *     ]
   * };
   */
  heightOffset: {
    get: function () {
      return this._heightOffset;
    },
    set: function (value) {
      this._heightOffset = getExpression(this, value);
      this._style.heightOffset = getJsonFromExpression(this._heightOffset);
    },
  },

  /**
   * 用于获取或设置用于计算样式 <code>anchorLineEnabled</code> 属性的 {@link StyleExpression} 对象。也可以使用定义布尔样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 表达式必须返回 <code>Boolean</code>。
   * </p>
   * <p>
   * 该表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿，且可能根据 Cesium 的标准弃用政策进行更改。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 anchorLineEnabled 表达式
   * style.anchorLineEnabled = 'true';
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用条件覆盖 anchorLineEnabled 表达式
   * style.anchorLineEnabled = {
   * conditions : [
   * ['${height} > 2', 'true'],
   * ['true', 'false']
   *     ]
   * };
   */
  anchorLineEnabled: {
    get: function () {
      return this._anchorLineEnabled;
    },
    set: function (value) {
      this._anchorLineEnabled = getExpression(this, value);
      this._style.anchorLineEnabled = getJsonFromExpression(
        this._anchorLineEnabled,
      );
    },
  },

  /**
   * 用于获取或设置用于计算样式 <code>anchorLineColor</code> 属性的 {@link StyleExpression} 对象。也可以使用定义颜色样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 表达式必须返回 <code>Color</code> 类型。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会因 Cesium 标准弃用政策而发生变化。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 anchorLineColor 表达式
   * style.anchorLineColor = 'color("blue")';
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用条件覆盖 anchorLineColor 表达式
   * style.anchorLineColor = {
   * conditions : [
   * ['${height} > 2', 'color("cyan")'],
   * ['true', 'color("blue")']
   *     ]
   * };
   */
  anchorLineColor: {
    get: function () {
      return this._anchorLineColor;
    },
    set: function (value) {
      this._anchorLineColor = getExpression(this, value);
      this._style.anchorLineColor = getJsonFromExpression(
        this._anchorLineColor,
      );
    },
  },

  /**
   * 用于获取或设置用于计算样式 <code>image</code> 属性的 {@link StyleExpression} 对象。也可以使用定义字符串样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 表达式必须返回 <code>String</code> 类型。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会因 Cesium 标准弃用政策而发生变化。
   *
   * @example
   * const style = new Cesium3DTileStyle({
   * image : '(${Temperature} > 90) ? "/url/to/image1" : "/url/to/image2"'
   * });
   * style.image.evaluate(feature); // 返回字符串类型
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用自定义函数覆盖 image 表达式
   * style.image = {
   * evaluate : function(feature) {
   * return '/url/to/image';
   *     }
   * };
   */
  image: {
    get: function () {
      return this._image;
    },
    set: function (value) {
      this._image = getExpression(this, value);
      this._style.image = getJsonFromExpression(this._image);
    },
  },

  /**
   * 用于获取或设置用于计算样式 <code>disableDepthTestDistance</code> 属性的 {@link StyleExpression} 对象。也可以使用定义数字样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>Number</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行变更。
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用字符串覆盖 disableDepthTestDistance 表达式
   * style.disableDepthTestDistance = '1000.0';
   * style.disableDepthTestDistance.evaluate(feature); // 返回一个 Number
   */
  disableDepthTestDistance: {
    get: function () {
      return this._disableDepthTestDistance;
    },
    set: function (value) {
      this._disableDepthTestDistance = getExpression(this, value);
      this._style.disableDepthTestDistance = getJsonFromExpression(
        this._disableDepthTestDistance,
      );
    },
  },

  /**
   * 获取或设置用于计算样式 <code>horizontalOrigin</code> 属性的 {@link StyleExpression} 对象。也可以使用定义数值样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>HorizontalOrigin</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行变更。
   *
   * @example
   * const style = new Cesium3DTileStyle({
   * horizontalOrigin : HorizontalOrigin.LEFT
   * });
   * style.horizontalOrigin.evaluate(feature); // 返回一个 HorizontalOrigin
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用自定义函数覆盖 horizontalOrigin 表达式
   * style.horizontalOrigin = {
   * evaluate : function(feature) {
   * return HorizontalOrigin.CENTER;
   *     }
   * };
   */
  horizontalOrigin: {
    get: function () {
      return this._horizontalOrigin;
    },
    set: function (value) {
      this._horizontalOrigin = getExpression(this, value);
      this._style.horizontalOrigin = getJsonFromExpression(
        this._horizontalOrigin,
      );
    },
  },

  /**
   * 获取或设置用于计算样式 <code>verticalOrigin</code> 属性的 {@link StyleExpression} 对象。也可以使用定义数值样式的字符串或对象。
   * 获取器将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值可能与设置器提供的值不同。
   * <p>
   * 该表达式必须返回一个 <code>VerticalOrigin</code>。
   * </p>
   * <p>
   * 此表达式仅适用于矢量瓦片中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行变更。
   *
   * @example
   * const style = new Cesium3DTileStyle({
   * verticalOrigin : VerticalOrigin.TOP
   * });
   * style.verticalOrigin.evaluate(feature); // 返回一个 VerticalOrigin
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用自定义函数覆盖 verticalOrigin 表达式
   * style.verticalOrigin = {
   * evaluate : function(feature) {
   * return VerticalOrigin.CENTER;
   *     }
   * };
   */
  verticalOrigin: {
    get: function () {
      return this._verticalOrigin;
    },
    set: function (value) {
      this._verticalOrigin = getExpression(this, value);
      this._style.verticalOrigin = getJsonFromExpression(this._verticalOrigin);
    },
  },

  /**
   Gets or sets the {@link StyleExpression} object used to evaluate the style's <code>labelHorizontalOrigin</code> property. Alternatively a string or object defining a number style can be used.
    * 该 getter 将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值与给 setter 提供的值可能不同。
    * <p>
    * 该表达式必须返回 <code>HorizontalOrigin</code>。
    * </p>
    * <p>
    * 此表达式仅适用于 Vector tile 中的点特征。
    * </p>
    *
    * @memberof Cesium3DTileStyle.prototype
    *
    * @type {StyleExpression}
    *
    * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该规范尚未定稿，且可能根据 Cesium 的标准弃用政策发生变化。
    *
    * @example
    * const style = new Cesium3DTileStyle({
    * labelHorizontalOrigin : HorizontalOrigin.LEFT
    * });
    * style.labelHorizontalOrigin.evaluate(feature); // 返回 <code>HorizontalOrigin</code>
    *
    * @example
    * const style = new Cesium.Cesium3DTileStyle();
    * // 使用自定义函数覆盖 labelHorizontalOrigin 表达式
    * style.labelHorizontalOrigin = {
    * evaluate : function(feature) {
    * return HorizontalOrigin.CENTER;
    *     }
    * };
    */
  labelHorizontalOrigin: {
    get: function () {
      return this._labelHorizontalOrigin;
    },
    set: function (value) {
      this._labelHorizontalOrigin = getExpression(this, value);
      this._style.labelHorizontalOrigin = getJsonFromExpression(
        this._labelHorizontalOrigin,
      );
    },
  },

  /**
   * 用于获取或设置用于计算样式 <code>labelVerticalOrigin</code> 属性的 {@link StyleExpression} 对象。也可以使用定义数字样式的字符串或对象。
   * 该 getter 将返回内部 {@link Expression} 或 {@link ConditionsExpression}，其值与给 setter 提供的值可能不同。
   * <p>
   * 该表达式必须返回 <code>VerticalOrigin</code>。
   * </p>
   * <p>
   * 此表达式仅适用于 Vector tile 中的点特征。
   * </p>
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @experimental This feature 使用的是 3D Tiles 规范中的部分内容，该规范尚未定稿，且可能根据 Cesium 的标准弃用政策发生变化。
   *
   * @example
   * const style = new Cesium3DTileStyle({
   * labelVerticalOrigin : VerticalOrigin.TOP
   * });
   * style.labelVerticalOrigin.evaluate(feature); // 返回 <code>VerticalOrigin</code>
   *
   * @example
   * const style = new Cesium.Cesium3DTileStyle();
   * // 使用自定义函数覆盖 labelVerticalOrigin 表达式
   * style.labelVerticalOrigin = {
   * evaluate : function(feature) {
   * return VerticalOrigin.CENTER;
   *     }
   * };
   */
  labelVerticalOrigin: {
    get: function () {
      return this._labelVerticalOrigin;
    },
    set: function (value) {
      this._labelVerticalOrigin = getExpression(this, value);
      this._style.labelVerticalOrigin = getJsonFromExpression(
        this._labelVerticalOrigin,
      );
    },
  },

  /**
   * 仅内部使用，在 3D Tiles 2.0 版本的 Vector Tiles 中支持。
   * @memberof Cesium3DTileStyle.prototype
   * @type {StyleExpression}
   * @ignore
   */
  lineWidth: {
    get: function () {
      return this._lineWidth;
    },
    set: function (value) {
      this._lineWidth = getExpression(this, value);
      this._style.lineWidth = getJsonFromExpression(this._lineWidth);
    },
  },

  /**
   * 用于获取或设置包含特定于应用的表达式的对象，该表达式可以显式计算，例如用于 UI 中的显示。
   * const style = new Cesium3DTileStyle({
   *
   * @memberof Cesium3DTileStyle.prototype
   *
   * @type {StyleExpression}
   *
   * @example
   * meta : {
   * description : '"Building id ${id} has height ${Height}."'
   * style.meta.description.evaluate(feature); // 返回包含替换变量的 String
   *     }
   * });
   * 从 url 异步创建 Cesium3DTileStyle。
   */
  meta: {
    get: function () {
      return this._meta;
    },
    set: function (value) {
      this._meta = value;
    },
  },
});

/**
 * Asynchronously creates a Cesium3DTileStyle from a url.
 *
 * @param {Resource|string} url 要加载的样式网址。
 *
 * @returns {Promise<Cesium3DTileStyle>} A 解析为创建的样式的承诺。
 *
 * @private
 */
Cesium3DTileStyle.fromUrl = function (url) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(url)) {
    throw new DeveloperError("url is required");
  }
  //>>includeEnd('debug');

  const resource = Resource.createIfNeeded(url);
  return resource.fetchJson(url).then(function (styleJson) {
    return new Cesium3DTileStyle(styleJson);
  });
};

/**
 * 获取该样式的颜色着色器函数。
 *
 * @param {string} functionSignature 生成函数的签名。
 * @param {object} variableSubstitutionMap 将变量名称映射到着色器变量名称。
 * @param {object} shaderState 存储关于生成的着色器函数的信息，包括其是否半透明。
 *
 * @returns {string} The 着色器函数。
 *
 * @private
 */
Cesium3DTileStyle.prototype.getColorShaderFunction = function (
  functionSignature,
  variableSubstitutionMap,
  shaderState,
) {
  if (this._colorShaderFunctionReady) {
    shaderState.translucent = this._colorShaderTranslucent;
    // Return the cached result, may be undefined
    return this._colorShaderFunction;
  }

  this._colorShaderFunctionReady = true;
  if (defined(this.color) && defined(this.color.getShaderFunction)) {
    this._colorShaderFunction = this.color.getShaderFunction(
      functionSignature,
      variableSubstitutionMap,
      shaderState,
      "vec4",
    );
  } else {
    this._colorShaderFunction = undefined;
  }

  this._colorShaderTranslucent = shaderState.translucent;
  return this._colorShaderFunction;
};

/**
 * 获取该样式的显示着色器函数。
 *
 * @param {string} functionSignature 生成函数的签名。
 * @param {object} variableSubstitutionMap 将变量名称映射到着色器变量名称。
 * @param {object} shaderState 存储关于生成的着色器函数的信息，包括其是否半透明。
 *
 * @returns {string} The 着色器函数。
 *
 * @private
 */
Cesium3DTileStyle.prototype.getShowShaderFunction = function (
  functionSignature,
  variableSubstitutionMap,
  shaderState,
) {
  if (this._showShaderFunctionReady) {
    // Return the cached result, may be undefined
    return this._showShaderFunction;
  }

  this._showShaderFunctionReady = true;

  if (defined(this.show) && defined(this.show.getShaderFunction)) {
    this._showShaderFunction = this.show.getShaderFunction(
      functionSignature,
      variableSubstitutionMap,
      shaderState,
      "bool",
    );
  } else {
    this._showShaderFunction = undefined;
  }
  return this._showShaderFunction;
};

/**
 * 获取该样式的点大小着色器函数。
 *
 * @param {string} functionSignature 生成函数的签名。
 * @param {object} variableSubstitutionMap 将变量名称映射到着色器变量名称。
 * @param {object} shaderState 存储关于生成的着色器函数的信息，包括其是否半透明。
 *
 * @returns {string} The 着色器函数。
 *
 * @private
 */
Cesium3DTileStyle.prototype.getPointSizeShaderFunction = function (
  functionSignature,
  variableSubstitutionMap,
  shaderState,
) {
  if (this._pointSizeShaderFunctionReady) {
    // Return the cached result, may be undefined
    return this._pointSizeShaderFunction;
  }

  this._pointSizeShaderFunctionReady = true;
  if (defined(this.pointSize) && defined(this.pointSize.getShaderFunction)) {
    this._pointSizeShaderFunction = this.pointSize.getShaderFunction(
      functionSignature,
      variableSubstitutionMap,
      shaderState,
      "float",
    );
  } else {
    this._pointSizeShaderFunction = undefined;
  }

  return this._pointSizeShaderFunction;
};

/**
 * 获取样式使用的变量。
 *
 * @returns {string[]} The 样式使用的变量。
 *
 * @private
 */
Cesium3DTileStyle.prototype.getVariables = function () {
  let variables = [];

  if (defined(this.color) && defined(this.color.getVariables)) {
    addAllToArray(variables, this.color.getVariables());
  }

  if (defined(this.show) && defined(this.show.getVariables)) {
    addAllToArray(variables, this.show.getVariables());
  }

  if (defined(this.pointSize) && defined(this.pointSize.getVariables)) {
    addAllToArray(variables, this.pointSize.getVariables());
  }

  // Remove duplicates
  variables = variables.filter(function (variable, index, variables) {
    return variables.indexOf(variable) === index;
  });

  return variables;
};

export default Cesium3DTileStyle;
