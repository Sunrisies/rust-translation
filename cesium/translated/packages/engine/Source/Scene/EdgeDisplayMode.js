/**
 * 定义由哪些边缘贡献了渲染效果。
 * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_primitive_edge_visibility|EXT_mesh_primitive_edge_visibility}
 * glTF 扩展的渲染是相对于表面几何形状进行的。
 * <p>
 * 不包含该扩展的primitive 不受此设置影响，
 * 并始终正常渲染。
 * </p>
 *
 * @enum {number}
 *
 * @see Model#edgeDisplayMode
 * @see Cesium3DTileset#edgeDisplayMode
 */
const EdgeDisplayMode = {
  /**
   * 仅渲染表面。来自
   * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_primitive_edge_visibility|EXT_mesh_primitive_edge_visibility}
   * 扩展的边缘会被隐藏。
   *
   * @type {number}
   * @constant
   */
  SURFACES_ONLY: 0,

  /**
   * 同时渲染表面和边缘。来自
   * {@link https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_primitive_edge_visibility|EXT_mesh_primitive_edge_visibility}
   * 扩展的渲染内容会叠加在表面几何形状上。
   *
   * @type {number}
   * @constant
   */
  SURFACES_AND_EDGES: 1,

  /**
   * 仅渲染边缘。具有边缘可见性数据的primitive 会隐藏其表面几何形状，
   * 以近似 CAD 风格的线框渲染方式呈现。没有该扩展的 primitive 不受此影响。
   *
   * @type {number}
   * @constant
   */
  EDGES_ONLY: 2,
};

Object.freeze(EdgeDisplayMode);

export default EdgeDisplayMode;
