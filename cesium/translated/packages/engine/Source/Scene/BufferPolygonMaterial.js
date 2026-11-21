// @ts-check

import { Frozen } from "@cesium/core";
import BufferPrimitiveMaterial from "./BufferPrimitiveMaterial.js";

/** @import { Color } from "@cesium/core"; */
/** @import BufferPolygon from "./BufferPolygon.js"; */

/**
 * @typedef {object} BufferPolygonMaterialOptions
 * @property {Color} [color=Color.WHITE] 填充颜色。
 * @property {Color} [outlineColor=Color.WHITE] 轮廓颜色。
 * @property {number} [outlineWidth=0.0] 轮廓宽度，范围为 0-255 像素。
 */

/**
 * {@link BufferPolygon} 的材质描述。
 *
 * <p>BufferPolygonMaterial objects are {@link Packable|packable}, stored
 * when calling {@link BufferPolygon#setMaterial}. Subsequent changes to the
 * 该特性尚未确定，可能会根据 Cesium 的标准弃用政策发生变化。
 *
 * @experimental This feature is not final and is subject to change without Cesium's standard deprecation policy.
 * @extends BufferPrimitiveMaterial
 */
class BufferPolygonMaterial extends BufferPrimitiveMaterial {
  /**
   * @type {BufferPolygonMaterial}
   * @ignore
   */
  static DEFAULT_MATERIAL = Object.freeze(new BufferPolygonMaterial());

  /**
   * @param {BufferPolygonMaterialOptions} [options]
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    super(options);
  }
}

export default BufferPolygonMaterial;