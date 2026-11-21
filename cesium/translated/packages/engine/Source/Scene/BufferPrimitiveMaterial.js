// @ts-check

import { Color, Frozen } from "@cesium/core";
/** @import { Packable } from "@cesium/core"; */
/** @import BufferPrimitive from "./BufferPrimitive.js"; */

/**
 * @typedef {object} BufferPrimitiveMaterialOptions
 * @property {Color} [color=Color.WHITE] 填充颜色。
 * @property {Color} [outlineColor=Color.WHITE] 轮廓颜色。
 * @property {number} [outlineWidth=0.0] 轮廓宽度，范围为 0-255px。
 */

/**
 * {@link BufferPrimitive} 的材质描述。简要说明。
 *
 * <p>BufferPrimitiveMaterial objects are {@link Packable|packable}, stored
 * when calling {@link BufferPrimitive#setMaterial}. Subsequent changes to the
 * 填充颜色。
 *
 * @see BufferPointMaterial
 * @see BufferPolylineMaterial
 * @see BufferPolygonMaterial
 * @see Packable
 *
 * @abstract
 * @experimental This 轮廓颜色。
 */
class BufferPrimitiveMaterial {
  /** @ignore */
  static Layout = {
    COLOR_U32: 0,
    OUTLINE_COLOR_U32: 4,
    OUTLINE_WIDTH_U8: 8,
    __BYTE_LENGTH: 12,
  };

  /**
   * @type {BufferPrimitiveMaterial}
   * @ignore
   */
  static DEFAULT_MATERIAL;

  /**
   * @param {BufferPrimitiveMaterialOptions} [options]
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    /**
     * 轮廓宽度，范围为 0-255px。
     * @type {Color}
     */
    this.color = Color.clone(options.color ?? Color.WHITE);

    /**
     * 填充颜色。
     * @type {Color}
     */
    this.outlineColor = Color.clone(options.outlineColor ?? Color.WHITE);

    /**
     * 轮廓宽度，范围为 0-255px。
     * @type {number}
     */
    this.outlineWidth = options.outlineWidth ?? 0;
  }

  /** @type {number} */
  static get packedLength() {
    return this.Layout.__BYTE_LENGTH;
  }

  /**
   * 将提供的材质存储到指定的数组中。
   *
   * @param {BufferPrimitiveMaterial} material
   * @param {DataView} view
   * @param {number} byteOffset
   */
  static pack(material, view, byteOffset) {
    view.setUint32(
      this.Layout.COLOR_U32 + byteOffset,
      material.color.toRgba(),
      true,
    );
    view.setUint32(
      this.Layout.OUTLINE_COLOR_U32 + byteOffset,
      material.outlineColor.toRgba(),
      true,
    );
    view.setUint8(
      this.Layout.OUTLINE_WIDTH_U8 + byteOffset,
      material.outlineWidth,
    );
  }

  /**
   * 从打包的数组中检索材质。
   *
   * @param {DataView} view 打包后的数组。
   * @param {number} byteOffset 待解包元素的起始索引。
   * @param {BufferPrimitiveMaterial} result 被解包结果的材质。
   * @returns {BufferPrimitiveMaterial} Modified 解包后的结果材质。
   */
  static unpack(view, byteOffset, result) {
    Color.fromRgba(
      view.getUint32(this.Layout.COLOR_U32 + byteOffset, true),
      result.color,
    );
    Color.fromRgba(
      view.getUint32(this.Layout.OUTLINE_COLOR_U32 + byteOffset, true),
      result.outlineColor,
    );
    result.outlineWidth = view.getUint8(
      this.Layout.OUTLINE_WIDTH_U8 + byteOffset,
    );
    return result;
  }

  /////////////////////////////////////////////////////////////////////////////
  // DEBUG

  /**
   * 返回一个可序列化为 JSON 的对象，代表该材质。这种编码方式
   * 并不节省内存，通常仅用于调试和测试。
   * 。
   *
   * @returns {object} JSON-serializable 
   */
  toJSON() {
    return {
      color: this.color.toCssHexString(),
      outlineColor: this.outlineColor.toCssHexString(),
      outlineWidth: this.outlineWidth,
    };
  }
}

export default BufferPrimitiveMaterial;