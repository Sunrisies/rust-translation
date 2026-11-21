// @ts-check

/**
 * 体素内容的元数据排序方式。
 * 在所有情况下，x 数据在 y 轴上是连续递增的，
 * 而每一组 y 值增量对应一个 z 切片。
 * 不过，各轴的方向遵循不同的约定。
 *
 * @enum {number}
 * @private
 */
const VoxelMetadataOrder = {
  /**
   * 遵循 3D Tiles 约定的默认排序方式。Z 轴指向向上。
   * @type {number}
   * @constant
   */
  Z_UP: 0,
  /**
   * 遵循 glTF 约定的排序方式。Y 轴指向向上。
   * @type {number}
   * @constant
   */
  Y_UP: 1,
};

Object.freeze(VoxelMetadataOrder);

export default VoxelMetadataOrder;
