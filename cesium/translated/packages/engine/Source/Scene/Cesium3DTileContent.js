// @ts-check

import { DeveloperError } from "@cesium/core";
/** @import { Cartesian3 } from "@cesium/core"; */
/** @import Cesium3DContentGroup from "./Cesium3DContentGroup.js"; */
/** @import Cesium3DTile from "./Cesium3DTile.js"; */
/** @import Cesium3DTileBatchTable from "./Cesium3DTileBatchTable.js"; */
/** @import Cesium3DTileFeature from "./Cesium3DTileFeature.js"; */
/** @import Cesium3DTileStyle from "./Cesium3DTileStyle.js"; */
/** @import Cesium3DTileset from "./Cesium3DTileset.js"; */
/** @import { Color } from "@cesium/core"; */
/** @import FrameState from "./FrameState.js"; */
/** @import ImplicitMetadataView from "./ImplicitMetadataView.js"; */
/** @import { Ray } from "@cesium/core"; */

/**
 * @link Cesium3DTileset 中的瓦片内容。
 * <p>
 * 此接口的派生类提供对瓦片中各个特征的访问。
 * 通过 {@link Cesium3DTile#content} 访问派生对象。
 * </p>
 * <p>
 * 此类型描述一个接口，不打算直接实例化。
 * </p>
 *
 * @interface
 */
class Cesium3DTileContent {
  constructor() {
    /**
     * 获取或设置任何特征属性是否发生变化。用于
     * 在特征属性变化时优化应用样式。
     * <p>
     * 此方法用于实现 <code>Cesium3DTileContent</code> 接口，但不属于公共 Cesium API。
     * 获取瓦片中的特征数量。
     * </p>
     *
     * @type {boolean}
     *
     * @protected
     * @ignore
     */
    this.featurePropertiesDirty = false;
  }

  /**
   * 获取瓦片中的点数量。
   *
   *
   * @type {number}
   * @readonly
   * @constant
   */
  featuresLength;

  /**
   * 仅适用于具有点云内容的瓦片。这与 {@link Cesium3DTileContent#featuresLength} 不同，后者
   * <p>
   * 等于由 <code>BATCH_ID</code> 特征表语义区分的点组数量。
   * 获取瓦片中的三角形数量。
   * </p>
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/TileFormats/PointCloud#batched-points}
   *
   *
   * @type {number}
   * @readonly
   * @constant
   */
  pointsLength;

  /**
   * 获取瓦片的几何内存大小（以字节为单位）。
   *
   *
   * @type {number}
   * @readonly
   * @constant
   */
  trianglesLength;

  /**
   * 获取瓦片的纹理内存大小（以字节为单位）。
   *
   *
   * @type {number}
   * @readonly
   * @constant
   */
  geometryByteLength;

  /**
   * 获取瓦片的纹理内存大小（以字节为单位）。
   *
   *
   * @type {number}
   * @readonly
   * @constant
   */
  texturesByteLength;

  /**
   * 获取批表纹理及任何二进制
   * 元数据属性所使用的内存量，这些内存未在 geometryByteLength 或
   * texturesByteLength 中考虑。
   *
   *
   * @type {number}
   * @readonly
   * @constant
   */
  batchTableByteLength;

  /**
   * 获取包含其他内容的 {@link Cesium3DTileContent} 对象数组，例如复合瓦片。内部内容可能又包含内部内容，例如一个包含复合瓦片的复合瓦片。
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/TileFormats/Composite|Composite specification}
   *
   *
   * @type {Array<*>}
   * @readonly
   * @constant
   */
  innerContents;

  /**
   * 当瓦片内容准备好渲染时返回 true；否则返回 false。
   *
   *
   * @type {boolean}
   * @readonly
   * @constant
   */
  ready;

  /**
   * 获取该瓦片的 tileset。
   *
   *
   * @type {Cesium3DTileset}
   * @readonly
   * @constant
   */
  tileset;

  /**
   * 获取包含此内容的瓦片。
   *
   *
   * @type {Cesium3DTile}
   * @readonly
   * @constant
   */
  tile;

  /**
   * 获取瓦片内容的 URL。
   *
   * @type {string}
   * @readonly
   * @constant
   */
  url;

  /**
   * 获取该内容的批表。
   * <p>
   * 此方法用于实现 <code>Cesium3DTileContent</code> 接口，但不属于公共 Cesium API。
   * 不属于公共 Cesium API。
   * </p>
   *
   * @type {Cesium3DTileBatchTable}
   * @readonly
   * @constant
   *
   * @private
   */
  batchTable;

  /**
   * 获取该内容的元数据，无论是显式提供的还是通过
   * 隐式平铺提供的。如果没有元数据，此属性应被定义为未定义。
   * <p>
   * 此方法用于实现 <code>Cesium3DTileContent</code> 接口，但不属于公共 Cesium API。
   * 不属于公共 Cesium API。
   * </p>
   *
   * @type {ImplicitMetadataView|undefined}
   *
   * @private
   * @experimental This 该特性使用了尚未定稿的 3D Tiles 规范，且可能根据 Cesium 标准弃用政策发生变化。
   */
  metadata;

  /**
   * 如果内容具有元数据（3D Tiles 1.1），则获取该内容的组；或者
   * 如果使用了 <code>3DTILES_metadata</code> 扩展，则获取该组。如果两者都不存在，则获取空值。
   * 该属性应被定义为未定义。
   * <p>
   * 此属性用于实现 <code>Cesium3DTileContent</code> 接口，但
   * 不属于公共 Cesium API。
   * </p>
   *
   * @type {Cesium3DContentGroup|undefined}
   *
   * @private
   * @experimental This 该功能使用了尚未定稿的 3D Tiles 规范的一部分，可能会根据 Cesium 的标准弃用政策发生变化。
   */
  group;

  /**
   * 当前是否显示此内容。<br>
   * <br>
   * 将此值设置为 <code>true</code> 将使此内容（及其所有内部内容，如适用）可见。如果此内容及其所有内部内容当前可见，则返回 <code>true</code>。
   * 该功能使用了尚未定稿的 3D Tiles 规范的一部分，可能会根据 Cesium 的标准弃用政策发生变化。
   * 返回该特性是否具有此属性。
   *
   * @type {boolean}
   *
   * @private
   * @experimental This 特性的批次 ID。
   */
  show;

  /**
   * 属性的区分大小写的名称。
   *
   * @param {number} batchId 如果特性具有此属性，则返回 <code>true</code>；否则返回 <code>false</code>。
   * @param {string} name 返回具有给定 <code>batchId</code> 的 < {@link Cesium3DTileFeature} > 对象。该对象用于获取和修改特性的属性。
   * @returns {boolean} <code>true</code> 特性中的元素按 <code>batchId</code> 排序，该索引用于从批次表中检索其元数据。
   */
  hasProperty(batchId, name) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 特性的批次 ID。
   * 对应的 < {@link Cesium3DTileFeature} > 对象。
   * 必须介于零和 < {@link Cesium3DTileContent#featuresLength} - 1 之间。
   * <p>
   * 当 < {@link Cesium3DTileset#debugColorizeTiles} > 发生变化时调用。
   * </p>
   *
   * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/TileFormats/BatchTable}.
   *
   * @param {number} batchId 此属性用于实现 <code>Cesium3DTileContent</code> 接口，但
   * @returns {Cesium3DTileFeature} The 不属于公共 Cesium API。
   *
   * @exception {DeveloperError} batchId 是否启用或禁用调试设置。
   */
  getFeature(batchId) {
    DeveloperError.throwInstantiationError();
  }

  /**
       * 调试颜色。
       * <p>
       * 对应的 < {@link Cesium3DTileFeature} > 对象。
       * 将样式应用于内容。
       * </p>
       *
       * @param {boolean} enabled 此属性用于实现 <code>Cesium3DTileContent</code> 接口，但
       * @param {Color} color 不属于公共 Cesium API。
       * @returns {Cesium3DTileFeature} The 样式。

       * @private
       */
  applyDebugSettings(enabled, color) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 在 tileset 遍历过程中，tiles 调用此方法以获取渲染内容所需的绘制命令。
   * <p>
   * 当 tiles 的内容处于 PROCESSING 状态时，此操作将创建 WebGL 资源，最终使其进入 READY 状态。
   * 此属性用于实现 <code>Cesium3DTileContent</code> 接口，但
   * </p>
   *
   * @param {Cesium3DTileStyle} style 不属于公共 Cesium API。
   * @returns {void}
   *
   * @private
   */
  applyStyle(style) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 包含此 tiles 的 tileset。
   * 帧状态。
   * 找到射线与渲染后的 tiles 内容表面的交点。射线必须以世界坐标给出。
   * <p>
   * This is used to implement the <code>Cesium3DTileContent</code> interface, but is
   * not part of the public Cesium API.
   * </p>
   *
   * @param {Cesium3DTileset} tileset The tileset containing this tile.
   * @param {FrameState} frameState The frame state.
   * @returns {void}
   *
   * @private
   */
  update(tileset, frameState) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * Find an intersection between a ray and the tile content surface that was rendered. The ray must be given in world coordinates.
   *
   * @param {Ray} ray 用于检测相交的射线。
   * @param {FrameState} frameState 帧状态。
   * @param {Cartesian3|undefined} [result] 如果未找到相交实体，则返回 <code>undefined</code>。
   * @returns {Cartesian3|undefined} The 如果未找到相交实体，则返回 <code>undefined</code>。
   *
   * @private
   */
  pick(ray, frameState, result) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 如果此对象被销毁，则返回 true；否则返回 false。
   * <br /><br />
   * 如果此对象被销毁，则不应使用它；调用除 <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
   * 此方法用于实现 <code>Cesium3DTileContent</code> 接口，但不属于公共 Cesium API。
   * <p>
   * 如果此对象被销毁，则返回 <code>false</code>；否则返回 <code>false</code>。
   * 销毁此对象所持有的 WebGL 资源。销毁对象可以确保 WebGL 资源的确定释放，而无需依赖垃圾收集器来销毁该对象。
   * </p>
   *
   * @returns {boolean} <code>true</code> 如果此对象被销毁，则不应使用它；调用除 <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
   *
   * @see Cesium3DTileContent#destroy
   *
   * @private
   */
  isDestroyed() {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 应像示例中那样将返回值 (<code>undefined</code>) 赋给该对象。
   * 此方法用于实现 <code>Cesium3DTileContent</code> 接口，但不属于公共 Cesium API。
   * <br /><br />
   * 一旦对象被销毁，则不应使用它；调用除 <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
   * 应像示例中那样将返回值 (<code>undefined</code>) 赋给该对象。
   * 如果对象被销毁，即调用了 destroy() 方法，则返回 <code>true</code>。
   * <p>
   * 此方法用于实现 <code>Cesium3DTileContent</code> 接口，但不属于公共 Cesium API。
   * 如果对象被销毁，即调用了 destroy() 方法，则返回 <code>true</code>。
   * </p>
   *
   * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
   *
   * @example
   * content = content && content.destroy();
   *
   * @see Cesium3DTileContent#isDestroyed
   *
   * @returns {void}
   *
   * @private
   */
  destroy() {
    DeveloperError.throwInstantiationError();
  }
}

export default Cesium3DTileContent;
