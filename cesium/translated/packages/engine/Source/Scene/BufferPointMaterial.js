// @ts-check

import { Frozen } from "@cesium/core";
import BufferPrimitiveMaterial from "./BufferPrimitiveMaterial.js";

/** @import { Color } from "@cesium/core"; */
/** @import BufferPoint from "./BufferPoint.js"; */

/**
 * @typedef {object} BufferPointMaterialOptions
 * @property {Color} [color=Color.WHITE] 填充颜色。
 * @property {Color} [outlineColor=Color.WHITE] 轮廓颜色。
 * @property {number} [outlineWidth=0.0] 轮廓宽度，范围为 0-255px。
 * @property {number} [size=1.0] 点的大小，范围为 0-255px。
 */

/**
 * {@link BufferPoint} 的材质描述。
 *
 * <p>BufferPointMaterial 对象是 {@link Packable|可打包}，在调用
 * {@link BufferPoint#setMaterial} 时存储。后续对材质的修改
 * 不会影响该点，直到再次调用 setMaterial() 为止。</p>
 *
 * @experimental This 此特性尚未最终确定，可能会根据 Cesium 的标准弃用政策发生变化。
 * @extends BufferPrimitiveMaterial
 */
class BufferPointMaterial extends BufferPrimitiveMaterial {
  /** @ignore */
  static Layout = {
    ...BufferPrimitiveMaterial.Layout,
    SIZE_U8: BufferPrimitiveMaterial.Layout.__BYTE_LENGTH,
    __BYTE_LENGTH: BufferPrimitiveMaterial.Layout.__BYTE_LENGTH + 4,
  };

  /**
   * @type {BufferPointMaterial}
   * @ignore
   */
  static DEFAULT_MATERIAL = Object.freeze(new BufferPointMaterial());

  /**
   * @param {BufferPointMaterialOptions} [options]
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    super(options);

    /**
     * 点的大小，范围为 0-255px。
     * @type {number}
     */
    this.size = options.size ?? 1;
  }

  /**
   * @override
   * @param {BufferPointMaterial} material
   * @param {DataView} view
   * @param {number} byteOffset
   * @override
   */
  static pack(material, view, byteOffset) {
    super.pack(material, view, byteOffset);
    view.setUint8(this.Layout.SIZE_U8 + byteOffset, material.size);
  }

  /**
   * @override
   * @param {DataView} view
   * @param {number} byteOffset
   * @param {BufferPointMaterial} result
   * @returns {BufferPointMaterial}
   * @override
   */
  static unpack(view, byteOffset, result) {
    super.unpack(view, byteOffset, result);
    result.size = view.getUint8(this.Layout.SIZE_U8 + byteOffset);
    return result;
  }

  /////////////////////////////////////////////////////////////////////////////
  // DEBUG

  /**
   * 返回一个可序列化为 JSON 的对象以表示材质。这种编码方式
   * 并不节省内存，通常仅用于调试和
   * 测试用途。
   *
   * @returns {object} JSON-serializable 对象。
   */
  toJSON() {
    return { ...super.toJSON(), size: this.size };
  }
}

export default BufferPointMaterial;
