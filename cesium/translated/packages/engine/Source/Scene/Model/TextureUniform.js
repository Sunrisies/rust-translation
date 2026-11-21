import {
  DeveloperError,
  Frozen,
  PixelDatatype,
  PixelFormat,
  defined,
} from "@cesium/core";
import Resource from "../../Core/Resource.js";
import Sampler from "../../Renderer/Sampler.js";
import TextureWrap from "../../Renderer/TextureWrap.js";

/**
 * 一个简单的结构体，用作 <code>sampler2D</code> 值的载体。
 * uniform。此参数与 {@link CustomShader} 和 {@link TextureManager} 一起使用。
 *
 * @param {object} options 一个包含以下属性的对象：
 * @param {TypedArray} [options.typedArray] 存储纹理内容的类型数组，其类型与 options.pixelDatatype 一致。值按行优先顺序存储。由于 WebGL 对纹理采用 y-up 约定，因此行从下到上排列。
 * @param {number} [options.width] 图像的宽度。当 options.typedArray 存在时必需。
 * @param {number} [options.height] 图像的高度。当 options.typedArray 存在时必需。
 * @param {string|Resource} [options.url] 指向纹理图像的 URL 字符串或资源。
 * @param {boolean} [options.repeat=true] 定义后，纹理采样器将在两个方向都被设置为 wrap 模式。
 * @param {PixelFormat} [options.pixelFormat=PixelFormat.RGBA] 当 options.typedArray 被定义时，此参数用于确定纹理的像素格式。
 * @param {PixelDatatype} [options.pixelDatatype=PixelDatatype.UNSIGNED_BYTE] 当 options.typedArray 被定义时，这是类型数组中像素值的数据类型。
 * @param {TextureMinificationFilter} [options.minificationFilter=TextureMinificationFilter.LINEAR] 纹理采样器的压缩过滤器。
 * @param {TextureMagnificationFilter} [options.magnificationFilter=TextureMagnificationFilter.LINEAR] 纹理采样器的放大过滤器。
 * @param {number} [options.maximumAnisotropy=1.0] 纹理采样器的最大各向异性值。
 *
 * @alias TextureUniform
 * @constructor
 *
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，但尚非最终版本，且可能根据 Cesium 的标准弃用政策发生变化。
 */
function TextureUniform(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  //>>includeStart('debug', pragmas.debug);
  const hasTypedArray = defined(options.typedArray);
  const hasUrl = defined(options.url);
  if (hasTypedArray === hasUrl) {
    throw new DeveloperError(
      "exactly one of options.typedArray, options.url must be defined",
    );
  }
  if (hasTypedArray && (!defined(options.width) || !defined(options.height))) {
    throw new DeveloperError(
      "options.width and options.height are required when options.typedArray is defined",
    );
  }
  //>>includeEnd('debug');

  this.typedArray = options.typedArray;
  this.width = options.width;
  this.height = options.height;
  this.pixelFormat = options.pixelFormat ?? PixelFormat.RGBA;
  this.pixelDatatype = options.pixelDatatype ?? PixelDatatype.UNSIGNED_BYTE;

  let resource = options.url;
  if (typeof resource === "string") {
    resource = Resource.createIfNeeded(resource);
  }
  this.resource = resource;

  const repeat = options.repeat ?? true;
  const wrap = repeat ? TextureWrap.REPEAT : TextureWrap.CLAMP_TO_EDGE;
  this.sampler = new Sampler({
    wrapS: wrap,
    wrapT: wrap,
    minificationFilter: options.minificationFilter,
    magnificationFilter: options.magnificationFilter,
    maximumAnisotropy: options.maximumAnisotropy,
  });
}

export default TextureUniform;
