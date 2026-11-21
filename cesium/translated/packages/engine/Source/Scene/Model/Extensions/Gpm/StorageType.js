// @ts-check

/**
 * 用于表示协方差信息的存储类型枚举。
 *
 * 这反映了 `gltfGpmLocal.storageType` 的定义。
 * {@link https://nsgreg.nga.mil/csmwg.jsp|NGA_gpm_local} glTF 扩展。
 *
 * @enum {string}
 * @experimental This 该功能尚未最终确定，可能会根据 Cesium 的标准弃用政策进行变更。
 */
const StorageType = {
  /**
   * 存储锚点的完整误差协方差，包括交叉协方差项。
   *
   * @type {string}
   * @constant
   */
  Direct: "Direct",

  /**
   * 每个锚点都存储一个完整的协方差矩阵。不过，在这种情况下，
   * 交叉协方差项不会直接存储，而是可以通过一组空间相关函数参数在元数据中计算得到。
   * 这些参数存储在元数据之中。
   *
   * @type {string}
   * @constant
   */
  Indirect: "Indirect",
};

Object.freeze(StorageType);

export default StorageType;
