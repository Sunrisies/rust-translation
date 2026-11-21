// @ts-check

/**
 * 表示相对于地形的位置。
 *
 * @enum {number}
 */
const HeightReference = {
  /**
   * 该位置是绝对的。
   * @type {number}
   * @constant
   */
  NONE: 0,

  /**
   * 该位置会被限制在地形和 3D Tiles 范围内。当限制到如照片级 3D Tiles 这样的 3D Tileset 时，请确保该 tileset 的 {@link Cesium3DTileset#enableCollision} 设置为 <code>true</code>。否则，实体可能无法正确被限制在 tileset 表面。
   * @type {number}
   * @constant
   */
  CLAMP_TO_GROUND: 1,

  /**
   * 位置高度是指高于地形和 3D Tiles 的高度。
   * @type {number}
   * @constant
   */
  RELATIVE_TO_GROUND: 2,

  /**
   * 该位置被限制在地形范围内。
   * @type {number}
   * @constant
   */
  CLAMP_TO_TERRAIN: 3,

  /**
   * 位置高度是指高于地形的高度。
   * @type {number}
   * @constant
   */
  RELATIVE_TO_TERRAIN: 4,

  /**
   * 该位置被限制在 3D Tiles 范围内。
   * @type {number}
   * @constant
   */
  CLAMP_TO_3D_TILE: 5,

  /**
   * 位置高度是指高于 3D Tiles 的高度。
   * @type {number}
   * @constant
   */
  RELATIVE_TO_3D_TILE: 6,
};

Object.freeze(HeightReference);

export default HeightReference;

/**
 * 如果高度应被限制在表面，则返回 true。
 * @param {HeightReference} heightReference
 * @returns true 如果高度应被限制在表面，则返回 true。
 * @private
 */
export function isHeightReferenceClamp(heightReference) {
  return (
    heightReference === HeightReference.CLAMP_TO_GROUND ||
    heightReference === HeightReference.CLAMP_TO_3D_TILE ||
    heightReference === HeightReference.CLAMP_TO_TERRAIN
  );
}

/**
 * 如果高度应相对于表面偏移，则返回 true。
 * @param {HeightReference} heightReference
 * @returns true 如果高度应相对于表面偏移，则返回 true。
 * @private
 */
export function isHeightReferenceRelative(heightReference) {
  return (
    heightReference === HeightReference.RELATIVE_TO_GROUND ||
    heightReference === HeightReference.RELATIVE_TO_3D_TILE ||
    heightReference === HeightReference.RELATIVE_TO_TERRAIN
  );
}
