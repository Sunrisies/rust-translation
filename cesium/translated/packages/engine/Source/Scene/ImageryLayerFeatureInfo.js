import { defined } from "@cesium/core";

/**
 * 描述影像图层中的栅格化实体，如点、多边形、折线等。
 *
 * @alias ImageryLayerFeatureInfo
 * @constructor
 */
function ImageryLayerFeatureInfo() {
  /**
   * 获取或设置实体的名称。
   * @type {string|undefined}
   */
  this.name = undefined;

  /**
   * 获取或设置实体的 HTML 描述。该 HTML 不可信，在展示给用户之前需进行清理处理。
   * 获取或设置实体的位置，若位置未知则保持为 undefined。
   * @type {string|undefined}
   */
  this.description = undefined;

  /**
   * 获取或设置实体的原始数据，原始数据可能以多种格式存在，如 GeoJSON、KML 等。
   *
   * @type {Cartographic|undefined}
   */
  this.position = undefined;

  /**
   * 获取或设置实体的图像图层。
   * 通过选择适当的属性来配置实体的名称。该名称将从以下顺序中的某个来源获得：1) 名为 'name' 的属性，2) 名为 'title' 的属性，3) 包含单词 'name' 的第一个属性，4) 包含单词 'title' 的第一个属性。如果无法从这些来源获取名称，则保持现有名称不变。
   * @type {object|undefined}
   */
  this.data = undefined;

  /**
   * 包含实体属性的对象字面量。
   * @type {object|undefined}
   */
  this.imageryLayer = undefined;
}

/**
 * 通过创建属性及其值的 HTML 表格来配置实体的描述。
 * 包含实体属性的对象字面量。
 * 3) the first property containing the word 'name', 4) the first property containing the word 'title'.  If
 * the name cannot be obtained from any of these sources, the existing name will be left unchanged.
 *
 * @param {object} properties An object literal containing the properties of the feature.
 */
ImageryLayerFeatureInfo.prototype.configureNameFromProperties = function (
  properties,
) {
  let namePropertyPrecedence = 10;
  let nameProperty;

  for (const key in properties) {
    if (properties.hasOwnProperty(key) && properties[key]) {
      const lowerKey = key.toLowerCase();

      if (namePropertyPrecedence > 1 && lowerKey === "name") {
        namePropertyPrecedence = 1;
        nameProperty = key;
      } else if (namePropertyPrecedence > 2 && lowerKey === "title") {
        namePropertyPrecedence = 2;
        nameProperty = key;
      } else if (namePropertyPrecedence > 3 && /name/i.test(key)) {
        namePropertyPrecedence = 3;
        nameProperty = key;
      } else if (namePropertyPrecedence > 4 && /title/i.test(key)) {
        namePropertyPrecedence = 4;
        nameProperty = key;
      }
    }
  }

  if (defined(nameProperty)) {
    this.name = properties[nameProperty];
  }
};

/**
 * Configures the description of this feature by creating an HTML table of properties and their values.
 *
 * @param {object} properties An object literal containing the properties of the feature.
 */
ImageryLayerFeatureInfo.prototype.configureDescriptionFromProperties =
  function (properties) {
    function describe(properties) {
      let html = '<table class="cesium-infoBox-defaultTable">';
      for (const key in properties) {
        if (properties.hasOwnProperty(key)) {
          const value = properties[key];
          if (defined(value)) {
            if (typeof value === "object") {
              html += `<tr><td>${key}</td><td>${describe(value)}</td></tr>`;
            } else {
              html += `<tr><td>${key}</td><td>${value}</td></tr>`;
            }
          }
        }
      }
      html += "</table>";

      return html;
    }

    this.description = describe(properties);
  };
export default ImageryLayerFeatureInfo;
