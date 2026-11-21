/**
 * 分类是否会影响地形、3D Tiles或两者都影响。
 *
 * @enum {number}
 */
const ClassificationType = {
  /**
   * 仅地形将被分类。
   *
   * @type {number}
   * @constant
   */
  TERRAIN: 0,
  /**
   * 仅3D Tiles将被分类。
   *
   * @type {number}
   * @constant
   */
  CESIUM_3D_TILE: 1,
  /**
   * 地形和3D Tiles都将被分类。
   *
   * @type {number}
   * @constant
   */
  BOTH: 2,
};

/**
 * @private
 */
ClassificationType.NUMBER_OF_CLASSIFICATION_TYPES = 3;

Object.freeze(ClassificationType);

export default ClassificationType;
