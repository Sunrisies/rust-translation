import { defined } from "@cesium/core";
import isBitSet from "./isBitSet.js";

// Bitmask for checking tile properties
const childrenBitmasks = [0x01, 0x02, 0x04, 0x08];
const anyChildBitmask = 0x0f;
const cacheFlagBitmask = 0x10; // True if there is a child subtree
const imageBitmask = 0x40;
const terrainBitmask = 0x80;

/**
 * 包含来自 Google Earth Enterprise 服务器的每个瓦片信息。
 *
 * @param {number} bits 包含每个瓦片数据类型及可用子项的比特掩码。
 * @param {number} cnodeVersion 子树元数据请求的版本。
 * @param {number} imageryVersion 影像瓦片请求的版本。
 * @param {number} terrainVersion 地形瓦片请求的版本。
 * @param {number} imageryProvider 影像提供商的 ID。
 * @param {number} terrainProvider 地形的提供商的 ID。
 *
 * @private
 */
function GoogleEarthEnterpriseTileInformation(
  bits,
  cnodeVersion,
  imageryVersion,
  terrainVersion,
  imageryProvider,
  terrainProvider,
) {
  this._bits = bits;
  this.cnodeVersion = cnodeVersion;
  this.imageryVersion = imageryVersion;
  this.terrainVersion = terrainVersion;
  this.imageryProvider = imageryProvider;
  this.terrainProvider = terrainProvider;
  this.ancestorHasTerrain = false; // Set it later once we find its parent
  this.terrainState = undefined;
}

/**
 * 从对象创建 GoogleEarthEnterpriseTileInformation。
 *
 * @param {object} info 要克隆的对象。
 * @param {GoogleEarthEnterpriseTileInformation} [result] 存储结果的对象。
 * @returns {GoogleEarthEnterpriseTileInformation} The 修改后的结果参数，或如果未提供则创建一个新的 GoogleEarthEnterpriseTileInformation 实例。
 */
GoogleEarthEnterpriseTileInformation.clone = function (info, result) {
  if (!defined(result)) {
    result = new GoogleEarthEnterpriseTileInformation(
      info._bits,
      info.cnodeVersion,
      info.imageryVersion,
      info.terrainVersion,
      info.imageryProvider,
      info.terrainProvider,
    );
  } else {
    result._bits = info._bits;
    result.cnodeVersion = info.cnodeVersion;
    result.imageryVersion = info.imageryVersion;
    result.terrainVersion = info.terrainVersion;
    result.imageryProvider = info.imageryProvider;
    result.terrainProvider = info.terrainProvider;
  }
  result.ancestorHasTerrain = info.ancestorHasTerrain;
  result.terrainState = info.terrainState;

  return result;
};

/**
 * 设置瓦片的父级。
 *
 * @param {GoogleEarthEnterpriseTileInformation} parent 父瓦片。
 */
GoogleEarthEnterpriseTileInformation.prototype.setParent = function (parent) {
  this.ancestorHasTerrain = parent.ancestorHasTerrain || this.hasTerrain();
};

/**
 * 判断子树是否可用。
 *
 * @returns {boolean} true 如果子树可用，则为 false，否则为 true。
 */
GoogleEarthEnterpriseTileInformation.prototype.hasSubtree = function () {
  return isBitSet(this._bits, cacheFlagBitmask);
};

/**
 * 判断影像是否可用。
 *
 * @returns {boolean} true 如果影像可用，则为 false，否则为 true。
 */
GoogleEarthEnterpriseTileInformation.prototype.hasImagery = function () {
  return isBitSet(this._bits, imageBitmask);
};

/**
 * 判断地形是否可用。
 *
 * @returns {boolean} true 如果地形可用，则为 false，否则为 true。
 */
GoogleEarthEnterpriseTileInformation.prototype.hasTerrain = function () {
  return isBitSet(this._bits, terrainBitmask);
};

/**
 * 判断是否有子项存在。
 *
 * @returns {boolean} true 如果有子项可用，则为 false，否则为 true。
 */
GoogleEarthEnterpriseTileInformation.prototype.hasChildren = function () {
  return isBitSet(this._bits, anyChildBitmask);
};

/**
 * 判断指定的子项是否可用。
 *
 * @param {number} index 子瓦片的索引。
 *
 * @returns {boolean} true 如果子项可用，则为 false，否则为 true。
 */
GoogleEarthEnterpriseTileInformation.prototype.hasChild = function (index) {
  return isBitSet(this._bits, childrenBitmasks[index]);
};

/**
 * 包含子项的比特掩码。
 *
 * @returns {number} Children 比特掩码
 */
GoogleEarthEnterpriseTileInformation.prototype.getChildBitmask = function () {
  return this._bits & anyChildBitmask;
};
export default GoogleEarthEnterpriseTileInformation;
