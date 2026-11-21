import { Check } from "@cesium/core";

/**
 * @typedef {object} PpeTexture.ConstructorOptions
 *
 * PpeTexture 构造器的初始化选项
 *
 * @property {PpeMetadata} traits 指示该纹理中存储哪些数据的特性
 * @property {number} index 纹理在 glTF 纹理数组中的索引
 * @property {number|undefined} [texCoord] TEXCOORD 属性可选的 set 索引
 * @property {number|undefined} [noData] 表示缺失数据的值
 * @property {number|undefined} [offset] 应用于属性值的偏移量
 * @property {number|undefined} [scale] 应用于属性值的缩放比例
 */

/**
 * `NGA_gpm_local` 中的 PPE（每点误差）纹理
 *
 * 这反映了 `ppeTexture` 的定义
 * {@link https://nsgreg.nga.mil/csmwg.jsp|NGA_gpm_local} glTF 扩展
 *
 * 这是一个有效的 glTF `TextureInfo` 对象（包含必填的 `index` 和可选的 `texCoord`），并包含其他属性
 * 用于描述存储在纹理中的 metdata 结构
 * 描述纹理中存储的初始化选项
 *
 * @constructor
 * @param {PpeTexture.ConstructorOptions} options 描述初始化选项的对象
 *
 * @private
 */
function PpeTexture(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.traits", options.traits);
  Check.typeOf.number.greaterThanOrEquals("options.index", options.index, 0);
  //>>includeEnd('debug');

  this._traits = options.traits;
  this._noData = options.noData;
  this._offset = options.offset;
  this._scale = options.scale;
  this._index = options.index;
  this._texCoord = options.texCoord;
}

Object.defineProperties(PpeTexture.prototype, {
  /**
   * 此处包含的数据适用于此节点及其对应的纹理
   * 表示缺失数据的值——也称为哨兵值——
   *
   * @memberof PpeTexture.prototype
   * @type {PpeMetadata}
   * @readonly
   */
  traits: {
    get: function () {
      return this._traits;
    },
  },

  /**
   * 应用于属性值的偏移量
   * 应用于属性值的缩放比例
   *
   * @memberof PpeTexture.prototype
   * @type {number|undefined}
   * @readonly
   */
  noData: {
    get: function () {
      return this._noData;
    },
  },

  /**
   * 纹理的索引
   *
   * @memberof PpeTexture.prototype
   * @type {number|undefined}
   * @readonly
   */
  offset: {
    get: function () {
      return this._offset;
    },
  },

  /**
   * 用于纹理坐标映射的纹理 TEXCOORD 属性的 set 索引
   *
   * @memberof PpeTexture.prototype
   * @type {number|undefined}
   * @readonly
   */
  scale: {
    get: function () {
      return this._scale;
    },
  },

  /**
   * The index of the texture
   *
   * @memberof PpeTexture.prototype
   * @type {number}
   * @readonly
   */
  index: {
    get: function () {
      return this._index;
    },
  },

  /**
   * The set index of texture's TEXCOORD attribute used for texture coordinate mapping.
   *
   * @memberof PpeTexture.prototype
   * @type {number|undefined}
   * @readonly
   */
  texCoord: {
    get: function () {
      return this._texCoord;
    },
  },
});

export default PpeTexture;
