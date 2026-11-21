import { Check, RuntimeError, clone, defined } from "@cesium/core";
import Resource from "../Core/Resource.js";
import hasExtension from "./hasExtension.js";
import ImplicitSubdivisionScheme from "./ImplicitSubdivisionScheme.js";

/**
 * 隐式瓦片集是一个简单的结构，用于存储关于
 * 单个隐式瓦片集结构的信息。这包括用于定位资源的模板 URI、来自隐式根瓦片（边界体积、
 * 几何误差等）的详细信息，以及关于子树（例如子树级别、
 * 细分方案）的详细信息。
 * 瓦片集的基础资源。
 *
 * @alias ImplicitTileset
 * @constructor
 *
 * @param {Resource} baseResource 瓦片集的基础资源。
 * @param {object} tileJson 瓦片的 JSON 头部，包含隐式瓦片布局（3D Tiles 1.1）或 3DTILES_implicit_tiling 扩展。
 * @param {MetadataSchema} [metadataSchema] 包含隐式瓦片元数据类的元数据模式。
 * @private
 * @experimental This 该特性使用了尚未定稿且可能随 Cesium 标准弃用政策而变化的 3D Tiles 规范部分内容。
 */
function ImplicitTileset(baseResource, tileJson, metadataSchema) {
  const implicitTiling = hasExtension(tileJson, "3DTILES_implicit_tiling")
    ? tileJson.extensions["3DTILES_implicit_tiling"]
    : tileJson.implicitTiling;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("implicitTiling", implicitTiling);
  //>>includeEnd('debug');

  /**
   * 瓦片集的基础资源。此资源在此存储，因为后续在扩展 Implicit3DTileContents 时需要它，以便瓦片 URL 相对
   * 于瓦片集，而非子树文件。
   * 根瓦片的几何误差。
   *
   * @type {Resource}
   * @readonly
   * @private
   */
  this.baseResource = baseResource;

  /**
   * 包含隐式瓦片元数据类的元数据模式。
   *
   * @type {number}
   * @readonly
   * @private
   */
  this.geometricError = tileJson.geometricError;

  /**
   * 边界体积的 JSON 表示形式。这要么是盒子，要么是
   *
   * @type {MetadataSchema|undefined}
   * @readonly
   * @private
   */
  this.metadataSchema = metadataSchema;

  // Due to using explicit tile metadata to store a tight bounding box
  // in some cases (see https://github.com/CesiumGS/cesium/pull/11365)
  // it's important that this bounding volume is computed from the tile JSON
  // (which is the original, possibly loose bounding volume) rather than
  // tile.boundingVolume which is the tighter one.
  const boundingVolume = tileJson.boundingVolume;
  if (
    !defined(boundingVolume.box) &&
    !defined(boundingVolume.region) &&
    !hasExtension(boundingVolume, "3DTILES_bounding_volume_S2") &&
    !hasExtension(boundingVolume, "3DTILES_bounding_volume_cylinder")
  ) {
    throw new RuntimeError(
      "Only box, region, 3DTILES_bounding_volume_S2, and 3DTILES_bounding_volume_cylinder are supported for implicit tiling",
    );
  }

  /**
   * 区域。
   * 作为字符串的细化策略，为 'ADD' 或 'REPLACE'。
   *
   * @type {object}
   * @readonly
   * @private
   */
  this.boundingVolume = boundingVolume;

  /**
   * 子树的资源模板 URI，例如
   *
   * @type {string}
   * @readonly
   * @private
   */
  this.refine = tileJson.refine;

  /**
   * <code>https://example.com/{level}/{x}/{y}.subtree</code>
   * 
   *
   * @type {Resource}
   * @readonly
   * @private
   */

  this.subtreeUriTemplate = new Resource({ url: implicitTiling.subtrees.uri });

  /**
   * 用于定位内容资源的模板 URI，例如
   * <code>https://example.com/{level}/{x}/{y}.b3dm</code>。
   * <p>
   * 这是一个数组，用于支持多个内容。
   * </p>
   *
   * @type {Resource[]}
   * @readonly
   * @private
   */
  this.contentUriTemplates = [];

  /**
   * 存储内容头部的副本，因此诸如
   * <code>extras</code> 或 <code>extensions</code> 等属性在
   * 为每个瓦片创建 {@link Cesium3DTile} 时得以保留。
   * <p>
   * 这是一个数组，用于支持多个内容。
   * </p>
   *
   * @type {object[]}
   * @readonly
   * @private
   */
  this.contentHeaders = [];

  const contentHeaders = gatherContentHeaders(tileJson);
  for (let i = 0; i < contentHeaders.length; i++) {
    const contentHeader = contentHeaders[i];
    this.contentHeaders.push(clone(contentHeader, true));
    const contentResource = new Resource({ url: contentHeader.uri });
    this.contentUriTemplates.push(contentResource);
  }

  /**
   * 内容的最大数量以及内容可用性位流。
   * 用于检查内容可用性时的循环边界。
   *
   * @type {number}
   * @readonly
   * @private
   */
  this.contentCount = this.contentHeaders.length;

  /**
   * 存储根隐式瓦片的 JSON 头部副本。这被用作
   * 创建 {@link Cesium3DTile} 的模板。以下属性
   * 被移除：
   *
   * <ul>
   * <li><code>tile.implicitTiling</code> 以防止隐式布局的无限循环</li>
   * <li><code>tile.extensions["3DTILES_implicit_tiling"]</code>，如果替代 tile.implicitTiling</li>
   * <li><code>tile.contents</code>，因为内容是单独处理的</li>
   * <li><code>tile.content</code>，如果替代 tile.contents</li>
   * <li><code>tile.extensions["3DTILES_multiple_contents"]</code>，如果替代 tile.contents 或 tile.content</li>
   * </ul>
   *
   * @type {object}
   * @readonly
   * @private
   */
  this.tileHeader = makeTileHeaderTemplate(tileJson);

  /**
   * 此隐式瓦片集的分区方案，可选 OCTREE 或 QUADTREE。
   *
   * @type {ImplicitSubdivisionScheme}
   * @readonly
   * @private
   */
  this.subdivisionScheme =
    ImplicitSubdivisionScheme[implicitTiling.subdivisionScheme];

  /**
   * 此瓦片集的分支因子，QUADTREE 为 4，OCTREE 为 8。
   * OCTREE。
   *
   * @type {number}
   * @readonly
   * @private
   */
  this.branchingFactor = ImplicitSubdivisionScheme.getBranchingFactor(
    this.subdivisionScheme,
  );

  /**
   * 每个子树中不同的层级数量。例如，一个 subtreeLevels = 2 的 QUADTREE 将包含 5 个节点（1 个根节点 + 4 个子节点）。
   * 表示包含 5 个节点的 QUADTREE。
   *
   * @type {number}
   * @readonly
   * @private
   */
  this.subtreeLevels = implicitTiling.subtreeLevels;

  /**
   * 瓦片集中可用瓦片的层级数量。
   *
   * @type {number}
   * @readonly
   * @private
   */
  if (defined(implicitTiling.availableLevels)) {
    this.availableLevels = implicitTiling.availableLevels;
  } else {
    this.availableLevels = implicitTiling.maximumLevel + 1;
  }
}

/**
 * 收集瓦片中所有内容的 JSON 头部信息。
 * 此机制同时适用于普通瓦片和多内容瓦片，要么在 contents 数组中（3D Tiles 1.1），要么通过 `3DTILES_multiple_contents` 扩展格式。
 * 使用 3DTILES_implicit_tiling 扩展的 JSON 头部信息，用于隐式瓦片布局（3D Tiles 1.1）。
 *
 * @param {object} tileJson 每个瓦片的 JSON 头部信息，通过 3DTILES_implicit_tiling 扩展实现隐式瓦片布局。
 * @return {object[]} An 每个瓦片内容的 JSON 头部信息的数组。
 * @private
 */
function gatherContentHeaders(tileJson) {
  if (hasExtension(tileJson, "3DTILES_multiple_contents")) {
    const extension = tileJson.extensions["3DTILES_multiple_contents"];
    return defined(extension.contents) ? extension.contents : extension.content;
  }

  if (defined(tileJson.contents)) {
    return tileJson.contents;
  }

  if (defined(tileJson.content)) {
    return [tileJson.content];
  }

  return [];
}

function makeTileHeaderTemplate(tileJson) {
  const template = clone(tileJson, true);

  // Remove the implicit tiling extension to prevent infinite loops,
  // as well as content-related properties since content is handled separately
  if (defined(template.extensions)) {
    delete template.extensions["3DTILES_implicit_tiling"];
    delete template.extensions["3DTILES_multiple_contents"];

    // if there are no other extensions, remove the extensions property to
    // keep each tile simple
    if (Object.keys(template.extensions).length === 0) {
      delete template.extensions;
    }
  }

  delete template.implicitTiling;
  delete template.contents;
  delete template.content;

  return template;
}

export default ImplicitTileset;
