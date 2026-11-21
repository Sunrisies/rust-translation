/**
 * 用于描述覆盖影像的着色器输入信息的结构
 * 作为 <code>ImageryPipelineStage</code> 的一部分，覆盖 3D Tiles
 *
 * <code>ImageryPipelineStage</code> 接收原始图形及其
 * <code>ModelPrimitiveImagery</code> 对象。这些对象提供
 * <code>ImageryCoverage</code> 信息，表示被原始图形覆盖的影像
 * tiles 集合。
 *
 * <code>ImageryPipelineStage</code> 使用 <code>ImageryCoverage</code>
 * 来获取 <code>Imagery</code> 对象及其纹理，用于每个覆盖区域的 (x, y, level)
 * 位置，计算纹理平移和缩放，以及该影像纹理的
 * 纹理坐标矩形。
 *
 * 这些信息被汇总到该类的实例中，以便后续通过统一变量传递给着色器。
 * 创建新实例
 *
 * @private
 */
class ImageryInput {
  /**
   * 创建新的实例
   *
   * @param {ImageryLayer} imageryLayer 影像图层
   * @param {Texture} texture 来自影像的纹理
   * @param {Cartesian4} textureTranslationAndScale 需要应用于纹理的平移和缩放，以正确
   * 覆盖在原始图形上。这被存储为 Cartesian4 坐标
   * ，其中 (x,y) 表示平移，(z,w) 表示缩放。
   * 将这些信息存储为独立的
   * Cartesian2 对象可能更清晰、更简洁，但使用单个 Cartesian4 坐标可能是
   * 最初在 GlobeFS.glsl 中做出的设计选择，
   * 目的是减少统一变量的数量。
   * 边界框
   * @param {Cartesian4} textureCoordinateRectangle （在纹理坐标中）。这直接对应
   * <code>ImageryCoverage.textureCoordinateRectangle</code>，
   * 但被转换为 Cartesian4 坐标以在着色器中使用。
   * “设置索引”
   * 是应使用的纹理坐标属性。这将用于访问纹理坐标属性
   * @param {number} imageryTexCoordAttributeSetIndex 在着色器中的 <code>a_imagery_texCoord_${imageryTexCoordAttributeSetIndex}</code>
   * 。
   * will be used to access the texture coordinate attribute
   * <code>a_imagery_texCoord_${imageryTexCoordAttributeSetIndex}</code>
   * in the shader.
   */
  constructor(
    imageryLayer,
    texture,
    textureTranslationAndScale,
    textureCoordinateRectangle,
    imageryTexCoordAttributeSetIndex,
  ) {
    this.imageryLayer = imageryLayer;
    this.texture = texture;
    this.textureTranslationAndScale = textureTranslationAndScale;
    this.textureCoordinateRectangle = textureCoordinateRectangle;
    this.imageryTexCoordAttributeSetIndex = imageryTexCoordAttributeSetIndex;
  }
}

export default ImageryInput;
