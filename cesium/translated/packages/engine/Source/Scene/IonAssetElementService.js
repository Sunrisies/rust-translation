import {
  Check,
  Cartesian3,
  DeveloperError,
  BoundingSphere,
  defined,
  Frozen,
} from "@cesium/core";
import Ion from "../Core/Ion.js";
import IonResource from "../Core/IonResource.js";
import Resource from "../Core/Resource.js";
import ElementService from "./ElementService.js";

function checkPositiveInteger(name, value, maximum = Infinity) {
  if (
    defined(value) &&
    (!Number.isInteger(value) || value < 1 || value > maximum)
  ) {
    throw new DeveloperError(
      `${name} must be a positive integer no greater than ${maximum}.`,
    );
  }
}

/**
 * 将 id（bigint、数字或字符串）转换为十进制字符串，否则为 undefined。
 * 如果未定义，则返回 undefined。
 * @private
 */
function toIdString(value) {
  if (!defined(value)) {
    return undefined;
  }
  return String(value);
}

/**
 * 将 API 元素适配为公共结果，保留十进制字符串 ID。
 * 每个属性都映射到其文档中描述的字段，仅显示其任意值。
 * payload 保持原样传递。
 * @private
 */
function elementFromResponse(response) {
  const result = {
    id: toIdString(response.id),
    label: response.label,
  };
  if (defined(response.properties)) {
    result.properties = Object.fromEntries(
      Object.entries(response.properties).map(function ([name, property]) {
        return [
          name,
          {
            value: property.value,
            displayValue: property.displayValue,
            units: property.units,
          },
        ];
      }),
    );
  }
  const location = locationFromResponse(response.location);
  if (defined(location)) {
    result.location = location;
  }
  return result;
}

/** @private */
function locationFromResponse(location) {
  if (!defined(location) || !defined(location.center)) {
    return undefined;
  }
  return {
    center: {
      longitude: location.center.longitude,
      latitude: location.center.latitude,
      height: location.center.height,
    },
    radius: location.radius,
  };
}

/** @private */
function treeNodeFromResponse(response) {
  const result = {
    key: response.key,
    label: response.label,
    hasChildren: response.hasChildren,
    id: toIdString(response.id),
    kind: response.kind,
  };
  return result;
}

/**
 * {@link IonAssetElementService.Element} 的单个属性。
 *
 * @typedef {object} IonAssetElementService.ElementProperty
 * @property {*} value 该属性的原始值。
 * @property {string} [displayValue] 可阅读且预格式化的数值，包含任何单位后缀（例如 <code>"0.6208 m³"</code>）。
 * @property {string|null} [units] <code>value</code> 的单位，或者当属性无单位时返回 <code>null</code> 或 <code>undefined</code>。
 */

/**
 * {@link IonAssetElementService.Element} 的地理位置，仅在元素具有地理位置时显示。
 * 仅当元素具有地理位置时显示。
 *
 * @typedef {ElementService.ElementLocation} IonAssetElementService.ElementLocation
 */

/**
 * Cesium 离子资产中的单个元素，例如 BIM/CAD 模型中的墙或柱子。
 * 该元素的唯一整数标识符，以十进制字符串形式表示，例如 <code>"3298534886898"</code>。
 *
 * @typedef {object} IonAssetElementService.Element
 * @property {string} id 该元素的用户友好标签（如果有的话）。
 * @property {string} [label] 该元素的地理位置，或者当元素没有位置时返回 <code>undefined</code>（例如概念性元素或没有地理坐标系统的资产）。
 * @property {IonAssetElementService.ElementLocation} [location] 该元素的属性，按属性名称排序。结果列表可能省略某些属性；使用 {@link IonAssetElementService#getElement} 获取元素详细信息。属性名称保持原样，包括任何点号命名空间（例如 <code>"Volume Aspect.Net Volume"</code>）。
 * @property {Object<string, IonAssetElementService.ElementProperty>} [properties] {@link IonAssetElementService#listElements} 返回的结果页面。
 */

/**
 * 该页面上的元素。
 *
 * @typedef {object} IonAssetElementService.ElementPage
 * @property {IonAssetElementService.Element[]} items 所有页面中符合查询条件的元素总数，或者当无法获取总数时返回 <code>null</code>。
 * @property {number|null} total 用于获取下一页的令牌，作为 <code>options.continuationToken</code> 传递，或者当没有更多结果时返回 <code>undefined</code>。
 * @property {string} [continuationToken] 单个数值属性的聚合统计信息，由 {@link IonAssetElementService#aggregate} 返回。
 */

/**
 * 一组元素中单个数值属性的聚合统计信息。
 * 由 {@link IonAssetElementService#aggregate} 返回的统计信息。
 *
 * 非数值属性会返回 <code>count</code> 为 0 的结果。
 * 最小值、最大值和平均值返回 <code>null</code>，总和返回 0。
 *
 * @typedef {object} IonAssetElementService.Aggregation
 * @property {string} propertyKey 这些统计信息所描述的限定属性键。
 * @property {number} count 具有该属性键数值的元素数量。
 * @property {number|null} min 匹配元素中的最小值，或者当没有数值时返回 <code>null</code>。
 * @property {number|null} max 匹配元素中的最大值，如果没有数值则为 <code>null</code>。
 * @property {number|null} avg 匹配元素的平均值，如果没有数值则为 <code>null</code>。
 * @property {number} sum 匹配元素中数值的总和。
 */

/**
 * Cesium ion 资产元素树中的一个节点，由
 * {@link IonAssetElementService#getElementTreeChildren} 返回。
 *
 * @typedef {object} IonAssetElementService.ElementTreeNode
 * @property {string} key 该节点的不透明键。将它作为 <code>options.nodeKey</code> 传递给 {@link IonAssetElementService#getElementTreeChildren} 以列出该节点的子节点。
 * @property {string} label 该节点的用户友好标签。
 * @property {boolean} hasChildren 该节点是否有子节点。
 * @property {string} id 该节点所代表的整数实例 ID，以十进制字符串形式表示。
 * @property {"subject"|"model"|"category"|"element"} kind 节点的类型。
 */

/**
 * 由
 * {@link IonAssetElementService#getElementTreeParents} 返回的根优先路径中的条目。条目包括
 * 目标元素及其祖先元素。
 *
 * @typedef {object} IonAssetElementService.ElementTreePathEntry
 * @property {"subject"|"model"|"category"|"element"} kind 路径条目的类型。
 * @property {string} id 该主题、模型、类别或元素的整数实例 ID，以十进制字符串形式表示。
 */

/**
 * 使用
 * BIM/CAD 数据库模型支持的 ion REST API 的
 * <a href="https://cesium.com/learn/ion/ion-rest-api/">Asset Elements</a> 端点，查询 Cesium ion 资产中的单个元素。
 *
 * 元素 ID 通常是通过选择
 * 并读取其 <code>element</code> 属性获得的。
 *
 * 此对象通常不直接实例化，应使用 {@link IonAssetElementService.fromAssetId}。
 *
 * @extends ElementService
 * @experimental This 该特性不是最终的，并且根据 Cesium 的标准弃用政策可能会发生变化。
 *
 * @see Ion
 *
 * @example
 * const elements = Cesium.IonAssetElementService.fromAssetId(123456);
 * const page = await elements.listElements({
 * filter: { "IFC Attributes.name": { $like: "%Rebar%" } },
 * top: 50,
 * });
 * console.log(`${page.items.length} of ${page.total} elements`);
 */
class IonAssetElementService extends ElementService {
  /**
   * @param {object} options 具有以下属性的对象：
   * @param {number} options.assetId ion 资产 ID。
   * @param {Resource} options.resource 资产的 ion API 资源。
   */
  constructor(options) {
    super();
    this._assetId = options.assetId;
    this._resource = options.resource;
  }

  /**
   * 此服务所操作的 ion 资产 ID。
   * @type {number}
   * @readonly
   */
  get assetId() {
    return this._assetId;
  }

  /**
   * 为给定的 ion 资产创建 {@link IonAssetElementService}。
   *
   * @param {number} assetId 由 BIM/CAD 数据库模型支持的资产的 ion ID。
   * @param {object} [options] 具有以下属性的对象：
   * @param {string} [options.accessToken=Ion.defaultAccessToken] 要使用的 ion 访问令牌。
   * @param {string|Resource} [options.server=Ion.defaultServer] 要使用的 ion API 服务器。
   * @returns {IonAssetElementService} A 绑定到资产的服务。
   */
  static fromAssetId(assetId, options) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.number("assetId", assetId);
    //>>includeEnd('debug');

    options = options ?? Frozen.EMPTY_OBJECT;
    const accessToken = options.accessToken ?? Ion.defaultAccessToken;
    const server = Resource.createIfNeeded(options.server ?? Ion.defaultServer);
    server.appendForwardSlash();

    const resourceOptions = {
      // Trailing slash so derived resource urls resolve under the asset id.
      url: `v1/assets/${assetId}/`,
      headers: IonResource._addClientHeaders(),
    };
    if (defined(accessToken)) {
      resourceOptions.queryParameters = { access_token: accessToken };
    }
    const resource = server.getDerivedResource(resourceOptions);

    return new IonAssetElementService({
      assetId: assetId,
      resource: resource,
    });
  }

  /**
   * 从元素的
   * <code>location</code> 计算包围该元素的 {@link BoundingSphere}，适用于使用
   * {@link Camera#flyToBoundingSphere} 或 {@link Viewer#zoomTo} 调整相机视角。
   *
   * @param {IonAssetElementService.Element} element 由 {@link IonAssetElementService#getElement} 或 {@link IonAssetElementService#listElements} 返回的实体。
   * @returns {BoundingSphere|undefined} A 实体的边界球体，如果实体没有有效位置则为 <code>undefined</code>。
   *
   * @example
   * const element = await elements.getElement(elementId);
   * const boundingSphere = Cesium.IonAssetElementService.getBoundingSphere(element);
   * if (Cesium.defined(boundingSphere)) {
   * viewer.camera.flyToBoundingSphere(boundingSphere);
   * }
   */
  static getBoundingSphere(element) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("element", element);
    //>>includeEnd('debug');

    const center = element.location?.center;
    if (
      !defined(center) ||
      !Number.isFinite(center.longitude) ||
      !Number.isFinite(center.latitude)
    ) {
      return undefined;
    }

    const height = center.height ?? 0;
    const radius = element.location.radius ?? 0;
    if (!Number.isFinite(height) || !Number.isFinite(radius) || radius < 0) {
      return undefined;
    }

    const position = Cartesian3.fromDegrees(
      center.longitude,
      center.latitude,
      height,
    );
    return new BoundingSphere(position, radius);
  }

  /**
   * 从选中的 {@link Cesium3DTileFeature} 中读取实体 ID。进行渲染。
   * 特征在其
   * <code>element</code> 属性中携带所属实体的 ID。
   *
   * 返回的 ID 可以直接传递给
   * {@link IonAssetElementService#getElement}。
   *
   * @param {Cesium3DTileFeature} feature 从资产 tileset 中选中的特征。
   * @returns {string|undefined} The 作为十进制字符串的实体 ID，例如 <code>"3298534886898"</code>，如果特征没有实体 ID 则为 <code>undefined</code>。
   *
   * @example
   * const feature = viewer.scene.pick(movement.position);
   * const elementId = Cesium.IonAssetElementService.getElementId(feature);
   * if (Cesium.defined(elementId)) {
   * const element = await elements.getElement(elementId);
   * }
   */
  static getElementId(feature) {
    if (!defined(feature) || typeof feature.getProperty !== "function") {
      return undefined;
    }
    // 3D Tile feature properties store element IDs as BigInt values (e.g. 8589934767n)
    const elementId = feature.getProperty("element");
    return toIdString(elementId);
  }

  /**
   * 检索该资产的页面中的实体，可选择性过滤。
   *
   * 结果以不透明光标进行分页。通过传递返回的 <code>continuationToken</code> 作为
   * <code>options.continuationToken</code> 来请求后续页面，直到其变为 <code>undefined</code>。
   * 具有以下属性的对象：
   *
   * @param {object} [options] 每页返回的实体最大数量。
   * @param {number} [options.top=100] 从之前调用中返回的用于获取下一页结果的令牌。
   * @param {string} [options.continuationToken] 一个实体过滤器。有关支持的结构，请参阅 <a href="https://cesium.com/learn/ion/rest-api/#operation/getAssetElementsV1">List elements</a> ion REST API 文档中的查询参数部分。
   * @param {object|string} [options.filter] 一个 promise，用于返回页面中的实体。如果请求失败，promise 会拒绝并抛出 {@link RequestErrorEvent}。
   * @returns {Promise<IonAssetElementService.ElementPage>} A 必须是正整数。
   * @exception {DeveloperError} <code>options.top</code> 必须是字符串。
   * @exception {DeveloperError} <code>options.continuationToken</code> const page = await elements.listElements({
   *
   * @example
   * filter: {
   * filter: {
   * $or: [{ "IFC Class Name": "ifcwall" }, { "IFC Class Name": "ifccolumn" }],
   *   },
   * });
   */
  async listElements(options) {
    options = options ?? Frozen.EMPTY_OBJECT;

    //>>includeStart('debug', pragmas.debug);
    checkPositiveInteger("options.top", options.top);
    if (defined(options.continuationToken)) {
      Check.typeOf.string(
        "options.continuationToken",
        options.continuationToken,
      );
    }
    //>>includeEnd('debug');

    const queryParameters = { top: options.top ?? 100 };
    if (defined(options.continuationToken)) {
      queryParameters.continuationToken = options.continuationToken;
    }
    if (defined(options.filter)) {
      queryParameters.filter =
        typeof options.filter === "string"
          ? options.filter
          : JSON.stringify(options.filter);
    }

    const response = await this._resource
      .getDerivedResource({
        url: "elements",
        queryParameters: queryParameters,
      })
      .fetchJson();
    return {
      items: response.items.map(elementFromResponse),
      total: response.total,
      continuationToken: response.continuationToken,
    };
  }

  /**
   * 检索单个实体的元数据和位置信息。
   *
   * 使用 {@link IonAssetElementService.getElementId} 从
   * 选中的 {@link Cesium3DTileFeature} 中获取 ID。
   *
   * @param {string} elementId 作为十进制字符串的实体 ID，例如 <code>"3298534886898"</code>。
   * @returns {Promise<IonAssetElementService.Element>} A 一个承诺，用于获取请求的元素。如果请求失败或元素不存在，则承诺会拒绝并抛出 {@link RequestErrorEvent}。
   */
  async getElement(elementId) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.string("elementId", elementId);
    //>>includeEnd('debug');

    const response = await this._resource
      .getDerivedResource({
        url: `elements/${encodeURIComponent(elementId)}`,
      })
      .fetchJson();
    return elementFromResponse(response);
  }

  /**
   * 计算该资产中一个或多个数值属性的聚合统计信息（计数、最小值、最大值、平均值和总和）。
   * 可选地，针对已过滤的元素进行统计。
   * 聚合统计信息。如果请求失败，则承诺会拒绝并抛出 {@link RequestErrorEvent}。
   *
   * @param {object} options 包含以下属性的对象：
   * @param {string[]} options.propertyKeys 用于聚合的限定属性键。至少需要一个。
   * @param {object|string} [options.filter] 一个元素过滤器。有关支持的结构，请参阅<a href="https://cesium.com/learn/ion/rest-api/#operation/getAssetElementsAggregate">Aggregate elements</a> ion REST API 文档中的查询参数部分。
   * @returns {Promise<{aggregations: IonAssetElementService.Aggregation[], total: number}>} 一个承诺，用于获取聚合统计信息。如果请求失败，则承诺会拒绝并抛出 {@link RequestErrorEvent}。
   * @exception {DeveloperError} <code>options.propertyKeys</code> 必须是一个非空字符串数组。
   *
   * @example
   * try {
   * const result = await elements.aggregate({
   * propertyKeys: ["Volume Aspect.Net Volume"],
   * filter: { "IFC Class Name": "ifcwall" },
   *   });
   * console.log(result.aggregations, result.total);
   * } catch (error) {
   * console.error(error.statusCode, error.response);
   * };
   */
  async aggregate(options) {
    //>>includeStart('debug', pragmas.debug);
    Check.defined("options", options);
    Check.defined("options.propertyKeys", options.propertyKeys);
    if (
      !Array.isArray(options.propertyKeys) ||
      options.propertyKeys.length === 0
    ) {
      throw new DeveloperError(
        "options.propertyKeys must be a non-empty array.",
      );
    }
    for (let i = 0; i < options.propertyKeys.length; i++) {
      Check.typeOf.string(
        `options.propertyKeys[${i}]`,
        options.propertyKeys[i],
      );
    }
    //>>includeEnd('debug');

    // The server parameter is named "aggregations" but carries property keys;
    // suggest renaming it to "propertyKeys" server-side to match the client.
    const queryParameters = {
      aggregations: JSON.stringify(options.propertyKeys),
    };
    if (defined(options.filter)) {
      queryParameters.filter =
        typeof options.filter === "string"
          ? options.filter
          : JSON.stringify(options.filter);
    }

    const response = await this._resource
      .getDerivedResource({
        url: "elements/aggregate",
        queryParameters: queryParameters,
      })
      .fetchJson();
    return {
      aggregations: response.aggregations.map(function (aggregation) {
        return {
          // accept either key or propertyKey from the server, but always return propertyKey`
          propertyKey: aggregation.key ?? aggregation.propertyKey,
          count: aggregation.count,
          min: aggregation.min,
          max: aggregation.max,
          avg: aggregation.avg,
          sum: aggregation.sum,
        };
      }),
      total: response.total,
    };
  }

  /**
   * 列出该资产元素树中节点的子节点，或当未指定键时列出根节点。
   * 包含以下属性的对象：
   *
   * @param {object} [options] 由端点返回的不透明节点键。省略它以列出根节点。
   * @param {string} [options.nodeKey] 一个承诺，用于获取子节点。如果请求失败或提供了不存在的节点键，则承诺会拒绝并抛出 {@link RequestErrorEvent}。
   * @returns {Promise<{nodes: IonAssetElementService.ElementTreeNode[]}>} 必须是一个字符串。
   * @exception {DeveloperError} <code>options.nodeKey</code> try {
   *
   * @example
   * const { nodes } = await elements.getElementTreeChildren();
   * const { nodes: children } = await elements.getElementTreeChildren({
   * nodeKey: nodes[0].key,
   * console.log(nodes);
   *   });
   * } catch (error) {
   * console.error(error.statusCode, error.response);
   * 获取该资产元素树中元素的父节点，从根节点到该元素，使用 ion 的 <code>tree/parents</code> 端点。
   * }
   */
  async getElementTreeChildren(options) {
    options = options ?? Frozen.EMPTY_OBJECT;

    //>>includeStart('debug', pragmas.debug);
    if (defined(options.nodeKey)) {
      Check.typeOf.string("options.nodeKey", options.nodeKey);
    }
    //>>includeEnd('debug');

    const queryParameters = {};
    if (defined(options.nodeKey)) {
      queryParameters.nodeKey = options.nodeKey;
    }

    const response = await this._resource
      .getDerivedResource({
        url: "tree/children",
        queryParameters: queryParameters,
      })
      .fetchJson();
    return { nodes: response.nodes.map(treeNodeFromResponse) };
  }

  /**
   * 作为十进制字符串的元素 ID，例如 <code>"3298534886898"</code>。
   * 一个承诺，用于获取根优先路径。如果请求失败或不存在路径，则承诺会拒绝并抛出 {@link RequestErrorEvent}。
   *
   * @param {string} elementId 必须是一个字符串。
   * @returns {Promise<{path: IonAssetElementService.ElementTreePathEntry[]}>} try {
   * @exception {DeveloperError} <code>elementId</code> const { path } = await elements.getElementTreeParents(elementId);
   *
   * @example
   * console.log(path);
   * } catch (error) {
   * console.error(error.statusCode, error.response);
   * } catch (error) {
   * console.error(error.statusCode, error.response);
   * }
   *
   */
  async getElementTreeParents(elementId) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.string("elementId", elementId);
    //>>includeEnd('debug');

    const response = await this._resource
      .getDerivedResource({
        url: "tree/parents",
        queryParameters: { elementId },
      })
      .fetchJson();
    return {
      path: response.path.map(function (entry) {
        return { kind: entry.kind, id: toIdString(entry.id) };
      }),
    };
  }
}

export default IonAssetElementService;
