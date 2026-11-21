// @ts-check

/**
 * 内置语义的枚举类型。
 *
 * @enum {string}
 *
 * @private
 * @experimental This 该特性采用了 3D Tiles 规范中尚未最终定稿且可能根据 Cesium 标准弃用政策进行更改的部分内容。
 * @see {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Metadata/Semantics|3D Metadata Semantic Reference}
 */
const MetadataSemantic = {
  /**
   * 唯一的标识符，以 <code>STRING</code> 形式存储。
   *
   * @type {string}
   * @constant
   * @private
   */
  ID: "ID",
  /**
   * 名称，以 <code>STRING</code> 形式存储。并不要求唯一。
   *
   * @type {string}
   * @constant
   * @private
   */
  NAME: "NAME",
  /**
   * 描述信息，以 <code>STRING</code> 形式存储。
   *
   * @type {string}
   * @constant
   * @private
   */
  DESCRIPTION: "DESCRIPTION",
  /**
   * 一个瓦片集中的瓦片数量，以 <code>UINT64</code> 形式存储。
   *
   * @type {string}
   * @constant
   * @private
   */
  TILESET_TILE_COUNT: "TILESET_TILE_COUNT",
  /**
   * 一个瓦片的边界框，以包含 12 个 <code>FLOAT32</code> 或 <code>FLOAT64</code> 组件的形式存储。这些组件的格式与 3D Tiles 1.0 中的 <code>boundingVolume.box</code> 相同。该语义用于提供比隐式瓦片化过程中隐式计算的边界框更紧密的边界。
   *
   * @type {string}
   * @constant
   * @private
   */
  TILE_BOUNDING_BOX: "TILE_BOUNDING_BOX",
  /**
   * 一个瓦片的边界区域，以包含 6 个 <code>FLOAT64</code> 组件的形式存储。这些组件为 <code>[west, south, east, north, minimumHeight, maximumHeight]</code>。该语义用于提供比隐式瓦片化过程中隐式计算的边界框更紧密的边界。
   *
   * @type {string}
   * @constant
   * @private
   */
  TILE_BOUNDING_REGION: "TILE_BOUNDING_REGION",
  /**
   * 一个瓦片的边界球体，以包含 4 个 <code>FLOAT32</code> 或 <code>FLOAT64</code> 组件的形式存储。这些组件为 <code>[centerX, centerY, centerZ, radius]</code>。该语义用于提供比隐式瓦片化过程中隐式计算的边界框更紧密的边界。
   *
   * @type {string}
   * @constant
   * @private
   */
  TILE_BOUNDING_SPHERE: "TILE_BOUNDING_SPHERE",
  /**
   * 瓦片在椭球体上方（或下方）的最小高度，以 <code>FLOAT32</code> 或 <code>FLOAT64</code> 形式存储。该语义用于使隐式瓦片化过程中计算的边界区域更加紧密。
   *
   * @type {string}
   * @constant
   * @private
   */
  TILE_MINIMUM_HEIGHT: "TILE_MINIMUM_HEIGHT",
  /**
   * 瓦片在椭球体上方（或下方）的最大高度，以 <code>FLOAT32</code> 或 <code>FLOAT64</code> 形式存储。该语义用于使隐式瓦片化过程中计算的边界区域更加紧密。
   *
   * @type {string}
   * @constant
   * @private
   */
  TILE_MAXIMUM_HEIGHT: "TILE_MAXIMUM_HEIGHT",
  /**
   * 一个瓦片的地平线遮挡点，以包含 <code>FLOAT32</code> 或 <code>FLOAT64</code> 组件的 <code>VEC3</code> 形式存储。
   *
   * @see {@link https://cesium.com/blog/2013/04/25/horizon-culling/|Horizon Culling}
   *
   * @type {string}
   * @constant
   * @private
   */
  TILE_HORIZON_OCCLUSION_POINT: "TILE_HORIZON_OCCLUSION_POINT",
  /**
   * 一个瓦片的几何误差，以 <code>FLOAT32</code> 或 <code>FLOAT64</code> 形式存储。该语义用于覆盖隐式瓦片化过程中隐式计算的几何误差。
   *
   * @type {string}
   * @constant
   * @private
   */
  TILE_GEOMETRIC_ERROR: "TILE_GEOMETRIC_ERROR",
  /**
   * 一个瓦片内容的边界框，以包含 12 个 <code>FLOAT32</code> 或 <code>FLOAT64</code> 组件的形式存储。这些组件的格式与 3D Tiles 1.0 中的 <code>boundingVolume.box</code> 相同。该语义用于提供比隐式瓦片化过程中隐式计算的边界框更紧密的边界。
   *
   * @type {string}
   * @constant
   * @private
   */
  CONTENT_BOUNDING_BOX: "CONTENT_BOUNDING_BOX",
  /**
   * 用于瓦片内容的边界区域，以 6 个 <code>FLOAT64</code> 组件数组的形式存储。这些组件分别为 <code>[west, south, east, north, minimumHeight, maximumHeight]</code>。这种语义方式能够提供比隐式平铺过程中自动计算的边界体积更紧密的包围范围。
   *
   * @type {string}
   * @constant
   * @private
   */
  CONTENT_BOUNDING_REGION: "CONTENT_BOUNDING_REGION",
  /**
   * 用于瓦片内容的边界球体，以 4 个 <code>FLOAT32</code> 或 <code>FLOAT64</code> 组件数组的形式存储。这些组件分别为 <code>[centerX, centerY, centerZ, radius]</code>。这种语义方式能够提供比隐式平铺过程中自动计算的边界体积更紧密的包围范围。
   *
   * @type {string}
   * @constant
   * @private
   */
  CONTENT_BOUNDING_SPHERE: "CONTENT_BOUNDING_SPHERE",
  /**
   * 瓦片内容在椭球体上方（或下方）的最小高度，以 <code>FLOAT32</code> 或 <code>FLOAT64</code> 形式存储。
   *
   * @type {string}
   * @constant
   * @private
   */
  CONTENT_MINIMUM_HEIGHT: "CONTENT_MINIMUM_HEIGHT",
  /**
   * 瓦片内容在椭球体上方（或下方）的最大高度，以 <code>FLOAT32</code> 或 <code>FLOAT64</code> 形式存储。
   *
   * @type {string}
   * @constant
   * @private
   */
  CONTENT_MAXIMUM_HEIGHT: "CONTENT_MAXIMUM_HEIGHT",
  /**
   * 瓦片内容的地平线遮挡点，以包含 <code>FLOAT32</code> 或 <code>FLOAT64</code> 组件的 <code>VEC3</code> 形式存储。
   *
   * @see {@link https://cesium.com/blog/2013/04/25/horizon-culling/|Horizon Culling}
   *
   * @type {string}
   * @constant
   * @private
   */
  CONTENT_HORIZON_OCCLUSION_POINT: "CONTENT_HORIZON_OCCLUSION_POINT",
};

Object.freeze(MetadataSemantic);

export default MetadataSemantic;
