// @ts-check

import { Frozen } from "@cesium/core";
import BufferPrimitiveMaterial from "./BufferPrimitiveMaterial.js";

/** @import { Color } from "@cesium/core"; */
/** @import BufferPolyline from "./BufferPolyline.js"; */

/**
 * @typedef {object} BufferPolylineMaterialOptions
 * @property {Color} [color=Color.WHITE] 填充颜色。
 * @property {Color} [outlineColor=Color.WHITE] 轮廓颜色。
 * @property {number} [outlineWidth=0.0] 轮廓宽度，范围为 0-255 像素。
 * @property {number} [width=1.0] 线的宽度，以用户选择的单位为准。
 * {@link BufferPolylineCollection#widthUnits}。
 */

/**
 * {@link BufferPolyline} 的材质描述。
 *
 * <p>BufferPolylineMaterial objects are {@link Packable|packable}, stored
 * when calling {@link BufferPolyline#setMaterial}. Subsequent changes to the
 * 折线宽度，以 {@link BufferPolylineCollection#widthUnits} 选择的单位为准。
 *
 * @experimental This 返回一个可序列化为 JSON 的对象，代表材质信息。这种编码方式
 * @extends BufferPrimitiveMaterial
 */
class BufferPolylineMaterial extends BufferPrimitiveMaterial {
  /** @ignore */
  static Layout = {
    ...BufferPrimitiveMaterial.Layout,
    WIDTH_F32: BufferPrimitiveMaterial.Layout.__BYTE_LENGTH,
    __BYTE_LENGTH: BufferPrimitiveMaterial.Layout.__BYTE_LENGTH + 4,
  };

  /**
   * @type {BufferPolylineMaterial}
   * @ignore
   */
  static DEFAULT_MATERIAL = Object.freeze(new BufferPolylineMaterial());

  /**
   * @param {BufferPolylineMaterialOptions} [options]
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    super(options);

    /**
     * Width of polyline, in the unit selected by {@link BufferPolylineCollection#widthUnits}.
     * @type {number}
     */
    this.width = options.width ?? 1;
  }

  /**
   * @param {BufferPolylineMaterial} material
   * @param {DataView} view
   * @param {number} byteOffset
   * @override
   */
  static pack(material, view, byteOffset) {
    super.pack(material, view, byteOffset);
    view.setFloat32(this.Layout.WIDTH_F32 + byteOffset, material.width, true);
  }

  /**
   * @param {DataView} view
   * @param {number} byteOffset
   * @param {BufferPolylineMaterial} result
   * @returns {BufferPolylineMaterial}
   * @override
   */
  static unpack(view, byteOffset, result) {
    super.unpack(view, byteOffset, result);
    result.width = view.getFloat32(this.Layout.WIDTH_F32 + byteOffset, true);
    return result;
  }

  /////////////////////////////////////////////////////////////////////////////
  // DEBUG

  /**
   * 对象。
   * is not memory-efficient, and should generally be used for debugging and
   * testing.
   *
   * @returns {object} JSON-serializable object.
   */
  toJSON() {
    return { ...super.toJSON(), width: this.width };
  }
}

export default BufferPolylineMaterial;