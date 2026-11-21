// @ts-check

/**
 * 定义了从 Cesium API 获取的每个特征颜色设置，或与原始特征中的源颜色混合的声明式样式方式。
 * 例如 glTF 材质或瓦片中的每点颜色。
 * <p>
 * 当使用 <code>REPLACE</code> 或 <code>MIX</code> 且源颜色为 glTF 材质时，该技术必须将
 * <code>_3DTILESDIFFUSE</code> 语义分配给漫射颜色参数。否则仅支持 <code>HIGHLIGHT</code>。
 * </p>
 * <p>
 * 颜色评估为白色 (1.0, 1.0, 1.0) 的实体，无论瓦片集的颜色混合模式如何，都始终不进行颜色混合渲染。
 * </##5>
 * </p>
 * <pre><code>
 * "techniques": {
 * "technique0": {
 * "parameters": {
 * "diffuse": {
 * "semantic": "_3DTILESDIFFUSE",
 * "type": 35666
 *       }
 *     }
 *   }
 * }
 * </code></pre>
 *
 * @enum {number}
 */
const Cesium3DTileColorBlendMode = {
  /**
   * 将源颜色乘以特征颜色。
   *
   * @type {number}
   * @constant
   */
  HIGHLIGHT: 0,

  /**
   * 用特征颜色替换源颜色。
   *
   * @type {number}
   * @constant
   */
  REPLACE: 1,

  /**
   * 将源颜色和特征颜色混合在一起。
   *
   * @type {number}
   * @constant
   */
  MIX: 2,
};

Object.freeze(Cesium3DTileColorBlendMode);

export default Cesium3DTileColorBlendMode;
