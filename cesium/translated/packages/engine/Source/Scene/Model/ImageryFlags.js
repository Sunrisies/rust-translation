/**
 * 一个类，包含一组标志，用于指示哪些部分
 * 的<code>ImageryLayer</code> 需要处理。
 *
 * 该标志在 <code>ImageryPipelineStage</code> 中用于决定
 * 融合影像纹理信息与之前像素的结构。
 * 方式。
 *
 * 每个标志表示作为输入一部分的至少一个 <code>ImageryLayer</code> 对象
 * <b>没有</b>具有通过相应 <code>ImageryLayer.DEFAULT_...</code> 定义的默认值。
 * 。
 *
 * 请注意，这些标志的类型可以是 <code>boolean</code> 或
 * <code>number</code>。用户应检查这些标志是否具有
 * ‘truthy’ 或 ‘falsy’ 值。
 *
 * @private
 */
class ImageryFlags {
  constructor() {
    this.alpha = false;
    this.brightness = false;
    this.contrast = false;
    this.hue = false;
    this.saturation = false;
    this.gamma = false;
    this.colorToAlpha = false;
  }
}

export default ImageryFlags;
