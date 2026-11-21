import { Check, Frozen } from "@cesium/core";

/**
 * 用于分组的基本抽象类。该类的存在旨在使元数据 API 更加一致。
 * 即更统一，意味着可以通过以下方式访问元数据。
 * <code>content.group.metadata</code>，类似于以 <code>tile.metadata</code> 方式访问瓦片元数据。
 * <code>tile.metadata</code>。
 *
 * @param {object} options 该对象包含以下属性：
 * @param {GroupMetadata} options.metadata 与此分组相关的元数据。
 *
 * @alias Cesium3DContentGroup
 * @constructor
 * @private
 * @experimental This 该特性采用了 3D Tiles 规范中的部分内容，但规范尚未最终确定，可能根据 Cesium 的标准弃用政策发生变化。
 */
function Cesium3DContentGroup(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.metadata", options.metadata);
  //>>includeEnd('debug');

  this._metadata = options.metadata;
}

Object.defineProperties(Cesium3DContentGroup.prototype, {
  /**
   * 获取此分组的元数据。
   *
   * @memberof Cesium3DContentGroup.prototype
   *
   * @type {GroupMetadata}
   *
   * @readonly
   */
  metadata: {
    get: function () {
      return this._metadata;
    },
  },
});

export default Cesium3DContentGroup;
