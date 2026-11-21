// @ts-check

import { defined } from "@cesium/core";

/** @import { PixelFormat, PixelDatatype } from "@cesium/core" */

/**
 * 描述一个压缩纹理，并包含该压缩纹理缓冲区。

 */
class CompressedTextureBuffer {
  /**
   * @param {PixelFormat} internalFormat 压缩纹理的像素格式。
   * @param {PixelDatatype} pixelDatatype 压缩纹理的像素数据类型。
   * @param {number} width 纹理的宽度。
   * @param {number} height 纹理的高度。
   * @param {Uint8Array} buffer 压缩纹理缓冲区。
   */
  constructor(internalFormat, pixelDatatype, width, height, buffer) {
    this._format = internalFormat;
    this._datatype = pixelDatatype;
    this._width = width;
    this._height = height;
    this._buffer = buffer;
  }

  /**
   * 压缩纹理的格式。
   * @type {PixelFormat}
   * @readonly
   */
  get internalFormat() {
    return this._format;
  }

  /**
   * 压缩纹理的数据类型。
   * @type {PixelDatatype}
   * @readonly
   */
  get pixelDatatype() {
    return this._datatype;
  }

  /**
   * 纹理的宽度。
   * @type {number}
   * @readonly
   */
  get width() {
    return this._width;
  }

  /**
   * 纹理的高度。
   * @type {number}
   * @readonly
   */
  get height() {
    return this._height;
  }

  /**
   * 压缩纹理缓冲区。
   * @type {Uint8Array}
   * @readonly
   */
  get bufferView() {
    return this._buffer;
  }

  /**
   * 压缩纹理缓冲区。是 bufferView 的别名。
   * @type {Uint8Array}
   * @readonly
   */
  get arrayBufferView() {
    return this._buffer;
  }

  /**
   * 创建压缩纹理缓冲区的浅层克隆。
   *
   * @param {CompressedTextureBuffer} object 要克隆的压缩纹理缓冲区。
   * @return {CompressedTextureBuffer} A 压缩纹理缓冲区的浅层克隆。
   */
  static clone(object) {
    if (!defined(object)) {
      return undefined;
    }

    return new CompressedTextureBuffer(
      object._format,
      object._datatype,
      object._width,
      object._height,
      object._buffer,
    );
  }

  /**
   * 创建此压缩纹理缓冲区的浅层克隆。
   *
   * @return {CompressedTextureBuffer} A 压缩纹理缓冲区的浅层克隆。
   */
  clone() {
    return CompressedTextureBuffer.clone(this);
  }
}

export default CompressedTextureBuffer;
