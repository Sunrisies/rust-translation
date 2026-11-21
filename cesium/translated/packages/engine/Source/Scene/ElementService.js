import { DeveloperError } from "@cesium/core";

/**
 * {@link ElementService.Element} 的地理位置，当前存在
 * 仅当该元素被定位后才会显示。
 *
 * @typedef {object} ElementService.ElementLocation
 * @property {object} center 该实体的中心位置。
 * @property {number} center.longitude 经度，以度为单位。
 * @property {number} center.latitude 纬度，以度为单位。
 * @property {number} center.height 相对于椭球面的高度，以米为单位。
 * @property {number} radius 以米为单位的球体半径，该球体以 <code>center</code> 为中心并包围该元素。
 */

/**
 * 一个实体及其元数据。
 *
 * 实现可能包含额外的提供方特定字段。
 *
 * @typedef {object} ElementService.Element
 * @property {string} id 实体标识符。
 * @property {string} [label] 如果有的话，该实体的用户友好标签。
 * @property {ElementService.ElementLocation} [location] 该实体的地理位置，如果实体没有位置则显示为 <code>undefined</code>（例如概念性实体或没有地理坐标系统的资产）。
 */

/**
 * 由 {@link ElementService#listElements} 返回的实体页面。
 *
 * @typedef {object} ElementService.ElementPage
 * @property {ElementService.Element[]} items 该页面上的实体。
 * @property {number|null} total 匹配实体的总数，如果无法获取总数则显示为 <code>null</code>。
 */

/**
 * 实体属性的聚合统计信息。
 *
 * @typedef {object} ElementService.Aggregation
 * @property {string} [propertyKey] 这些统计信息所描述的属性键。
 * @property {number} count 统计信息中包含的实体数量。
 * @property {number|null} min 最小值，如果无法获取则显示为 <code>null</code>。
 * @property {number|null} max 最大值，如果无法获取则显示为 <code>null</code>。
 * @property {number|null} avg 平均值，如果无法获取则显示为 <code>null</code>。
 * @property {number} sum 各值的总和。
 */

/**
 * 元素树中的一个节点。
 *
 * @typedef {object} ElementService.ElementTreeNode
 * @property {string} label 该节点的用户友好标签。
 * @property {boolean} hasChildren 该节点是否有子节点。
 * @property {string} id 该节点所代表的实体的标识符。
 */

/**
 * 以根优先方式的元素树路径中的一条条目。
 *
 * @typedef {object} ElementService.ElementTreePathEntry
 * @property {string} id 该条目所代表的标识符。
 */

/**
 * 提供对模型中的实体及其元数据的访问。此类型
 * 描述一个接口，不打算直接实例化。
 *
 * @abstract
 * @experimental This 该特性尚未最终确定，可能会根据 Cesium 的标准弃用政策进行更改。
 *
 * @see IonAssetElementService
 */
class ElementService {
  constructor() {
    // Permit derived service construction while preventing direct use of this
    // abstract base class.
    if (new.target === ElementService) {
      DeveloperError.throwInstantiationError();
    }
  }

  /**
   * 可选地过滤后返回实体页面。
   *
   * @param {object} [options] 提供方特定的查询选项。
   * @returns {Promise<ElementService.ElementPage>} A 解析为实体页面的承诺。
   */
  async listElements(options) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 检索单个实体。
   *
   * @param {string} elementId 实体标识符。
   * @returns {Promise<ElementService.Element>} A 解析为该实体的承诺。
   */
  async getElement(elementId) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 计算实体属性的聚合统计信息。
   *
   * @param {object} options 提供方特定的聚合选项。
   * @returns {Promise<{aggregations: ElementService.Aggregation[], total: number}>} 解析为聚合统计信息的承诺。
   */
  async aggregate(options) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 列出元素树中节点的子节点。
   *
   * @param {object} [options] 提供方特定的树查询选项。
   * @returns {Promise<{nodes: ElementService.ElementTreeNode[]}>} 解析为子节点的承诺。
   */
  async getElementTreeChildren(options) {
    DeveloperError.throwInstantiationError();
  }

  /**
   * 从元素树的根节点检索到特定元素的路径。
   *
   * @param {string} elementId 实体标识符。
   * @returns {Promise<{path: ElementService.ElementTreePathEntry[]}>} 一个承诺，指向根优先路径。
   */
  async getElementTreeParents(elementId) {
    DeveloperError.throwInstantiationError();
  }
}

export default ElementService;
