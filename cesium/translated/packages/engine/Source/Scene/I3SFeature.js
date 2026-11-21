import { defined } from "@cesium/core";
import I3SDataProvider from "./I3SDataProvider.js";

/**
 * 此类实现了 I3S Feature 功能。
 * <p>
 * 请勿直接构造此对象，应通过 {@link I3SNode} 访问瓦片。
 * </p>
 * @alias I3SFeature
 * @internalConstructor
 */
function I3SFeature(parent, uri) {
  this._parent = parent;
  this._dataProvider = parent._dataProvider;
  this._layer = parent._layer;

  if (defined(this._parent._nodeIndex)) {
    this._resource = this._parent._layer.resource.getDerivedResource({
      url: `nodes/${this._parent._data.mesh.attribute.resource}/${uri}`,
    });
  } else {
    this._resource = this._parent.resource.getDerivedResource({ url: uri });
  }
}

Object.defineProperties(I3SFeature.prototype, {
  /**
   * 获取该功能的资源。
   * @memberof I3SFeature.prototype
   * @type {Resource}
   * @readonly
   */
  resource: {
    get: function () {
      return this._resource;
    },
  },
  /**
   * 获取此对象的 I3S 数据。
   * @memberof I3SFeature.prototype
   * @type {object}
   * @readonly
   */
  data: {
    get: function () {
      return this._data;
    },
  },
});

/**
 * 加载内容。
 * @returns {Promise<object>} A 当 I3S Feature 数据加载完成时，该承诺即被解决。
 * @private
 */
I3SFeature.prototype.load = async function () {
  this._data = await I3SDataProvider.loadJson(this._resource);
  return this._data;
};

export default I3SFeature;
