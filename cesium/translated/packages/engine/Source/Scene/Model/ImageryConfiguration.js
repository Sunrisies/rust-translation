/**
 * 一个包含影响影像层外观值的类。
 * 一个 <code>ImageryLayer</code>。
 *
 * 它用于 <code>ModelImagery</code> 中，以检测
 * 影像设置的变化：<code>ModelImagery</code> 每
 * 个影像层存储一个实例。在 <code>update</code>
 * 调用时，它会检查是否有设置被更改。
 * 如果有变化，模型的绘制命令将被重置。
 *
 * @private
 */
class ImageryConfiguration {
  constructor(imageryLayer) {
    this.show = imageryLayer.show;
    this.alpha = imageryLayer.alpha;
    this.brightness = imageryLayer.brightness;
    this.contrast = imageryLayer.contrast;
    this.hue = imageryLayer.hue;
    this.saturation = imageryLayer.saturation;
    this.gamma = imageryLayer.gamma;
    this.colorToAlpha = imageryLayer.colorToAlpha;
  }
}

export default ImageryConfiguration;
