import {
  AttributeType,
  Check,
  ComponentDatatype,
  IndexDatatype,
  defined,
} from "@cesium/core";
import Buffer from "../Renderer/Buffer.js";
import BufferUsage from "../Renderer/BufferUsage.js";
import ModelComponents from "./ModelComponents.js";
import PrimitiveOutlineGenerator from "./Model/PrimitiveOutlineGenerator.js";

/**
 * 用于跟踪某个属性在后期处理后是否会被加载为缓冲区或类型数组的简单结构体。
 * 或类型数组。
 *
 * @alias PrimitiveLoadPlan.AttributeLoadPlan
 * @constructor
 *
 * @param {ModelComponents.Attribute} attribute 需要更新的属性。
 *
 * @private
 */
function AttributeLoadPlan(attribute) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("attribute", attribute);
  //>>includeEnd('debug');

  /**
   * 需要跟踪的实体。
   *
   * @type {ModelComponents.Attribute}
   * @readonly
   * @private
   */
  this.attribute = attribute;

  /**
   * 该属性在 {@link PrimitiveLoadPlan#postProcess} 完成时是否会被加载为 GPU 缓冲区。
   * 该属性在 {@link PrimitiveLoadPlan#postProcess} 完成时是否会被加载为打包类型数组。
   *
   * @type {boolean}
   * @private
   */
  this.loadBuffer = false;

  /**
   * 该索引缓冲区在 {@link PrimitiveLoadPlan#postProcess} 完成时是否会被加载为类型数组。
   * 该索引缓冲区在 {@link PrimitiveLoadPlan#postProcess} 完成时是否会被加载为 GPU 缓冲区。
   *
   * @type {boolean}
   * @private
   */
  this.loadTypedArray = false;
}

/**
 * 用于跟踪索引缓冲区在后期处理后是否会被加载为缓冲区或类型数组的简单结构体。
 * 或类型数组。
 *
 * @alias PrimitiveLoadPlan.IndicesLoadPlan
 * @constructor
 *
 * @param {ModelComponents.Indices} indices 需要更新的索引。
 *
 * @private
 */
function IndicesLoadPlan(indices) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("indices", indices);
  //>>includeEnd('debug');

  /**
   * 需要跟踪的索引。
   *
   * @type {ModelComponents.Indices}
   * @readonly
   * @private
   */
  this.indices = indices;

  /**
   * 这些索引在 {@link PrimitiveLoadPlan#postProcess} 完成时是否会被加载为 GPU 缓冲区。
   * 该索引在 {@link PrimitiveLoadPlan#postProcess} 完成时是否会被加载为 GPU 类型数组副本。
   *
   * @type {boolean}
   * @private
   */
  this.loadBuffer = false;

  /**
   * 这些三角形索引在 {@link PrimitiveLoadPlan#postProcess} 完成时是否会被加载为 GPU 缓冲区副本。
   * Primitives 在它们的属性和索引被加载后可能需要后期处理步骤，例如为 CESIUM_primitive_outline glTF 扩展生成轮廓。
   *
   * @type {boolean}
   * @private
   */
  this.loadTypedArray = false;
}

/**
 * 该 primitive 需要后期处理步骤。
 * 这些索引和属性需要被后期处理。
 * 这是一个包含需要后期处理的属性的扁平列表，包括常规属性和形态目标属性。
 * 关于需要后期处理的三角形索引信息，如果存在的话。
 *
 * @alias PrimitiveLoadPlan
 * @constructor
 *
 * @param {ModelComponents.Primitive} primitive 需要跟踪的 primitive。
 *
 * @private
 */
function PrimitiveLoadPlan(primitive) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("primitive", primitive);
  //>>includeEnd('debug');

  /**
   * 需要跟踪的 primitive。
   *
   * @type {ModelComponents.Primitive}
   * @readonly
   * @private
   */
  this.primitive = primitive;

  /**
   * 一个需要后期处理的属性的扁平列表。这包括：
   * 常规属性和形态目标属性。
   *
   * @type {PrimitiveLoadPlan.AttributeLoadPlan[]}
   * @private
   */
  this.attributePlans = [];

  /**
   * 关于需要后期处理的三角形索引信息，如果存在的话。
   * 如果存在，则设置为 true 以表示该 primitive 具有 CESIUM_primitive_outline 扩展并需要后期处理。
   *
   * @type {PrimitiveLoadPlan.IndicesLoadPlan}
   * @private
   */
  this.indicesPlan = undefined;

  /**
   * 该 primitive 具有 KHR_gaussian_splatting 和 KHR_gaussian_splatting_compression_spz_2 扩展并需要后期处理。
   * 应用可能修改几何形状的后期处理步骤，例如生成轮廓坐标。如果不需要后期处理步骤，则此函数将不执行任何操作。
   *
   * @type {boolean}
   * @private
   */
  this.needsOutlines = false;

  /**
   * The outline edge indices from the CESIUM_primitive_outline extension
   *
   * @type {number[]}
   * @private
   */
  this.outlineIndices = undefined;

  /**
   * Set this true to indicate that the primitive has the
   * KHR_gaussian_splatting and KHR_gaussian_splatting_compression_spz_2 extension and needs to be post-processed
   *
   * @type {boolean}
   * @private
   */
  this.needsGaussianSplats = false;
}

/**
 * Apply post-processing steps that may modify geometry such as generating
 * outline coordinates. If no post-processing steps are needed, this function
 * is a no-op.
 *
 * @param {Context} context The context for generating buffers on the GPU
 */
PrimitiveLoadPlan.prototype.postProcess = function (context) {
  // Handle CESIUM_primitive_outline. This modifies indices and attributes and
  // also generates a new attribute for the outline coordinates. These steps
  // are synchronous.
  if (this.needsOutlines) {
    generateOutlines(this);
    generateBuffers(this, context);
  }

  if (this.needsGaussianSplats) {
    setupGaussianSplatBuffers(this, context);
  }
};

function generateOutlines(loadPlan) {
  const primitive = loadPlan.primitive;
  const indices = primitive.indices;

  const vertexCount = primitive.attributes[0].count;

  const generator = new PrimitiveOutlineGenerator({
    triangleIndices: indices.typedArray,
    outlineIndices: loadPlan.outlineIndices,
    originalVertexCount: vertexCount,
  });

  // The generator modifies/adds indices. In some uncommon cases it may have
  // to upgrade to 16- or 32-bit indices so the datatype may change.
  indices.typedArray = generator.updatedTriangleIndices;
  indices.indexDatatype = IndexDatatype.fromTypedArray(indices.typedArray);

  // Some vertices may be copied due to the addition of the new attribute
  // which may have multiple values at a vertex depending on the face
  const { attributePlans } = loadPlan;
  for (let i = 0; i < attributePlans.length; i++) {
    const { attribute } = attributePlans[i];
    attribute.typedArray = generator.updateAttribute(attribute.typedArray);
  }

  // The outline generator creates a new attribute for the outline coordinates
  // that are used with a lookup texture.
  const outlineCoordinates = makeOutlineCoordinatesAttribute(
    generator.outlineCoordinates,
  );
  const outlineCoordinatesPlan = new AttributeLoadPlan(outlineCoordinates);
  outlineCoordinatesPlan.loadBuffer = true;
  outlineCoordinatesPlan.loadTypedArray = false;
  loadPlan.attributePlans.push(outlineCoordinatesPlan);
  primitive.outlineCoordinates = outlineCoordinatesPlan.attribute;
}

function makeOutlineCoordinatesAttribute(outlineCoordinatesTypedArray) {
  const attribute = new ModelComponents.Attribute();
  attribute.name = "_OUTLINE_COORDINATES";
  attribute.typedArray = outlineCoordinatesTypedArray;
  attribute.componentDatatype = ComponentDatatype.FLOAT;
  attribute.type = AttributeType.VEC3;
  attribute.normalized = false;
  attribute.count = outlineCoordinatesTypedArray.length / 3;

  return attribute;
}

function setupGaussianSplatBuffers(loadPlan, context) {
  const { attributePlans } = loadPlan;
  for (let i = 0; i < attributePlans.length; i++) {
    const attributePlan = attributePlans[i];
    attributePlan.loadBuffer = false;
    attributePlan.loadTypedArray = true;
  }
}

function generateBuffers(loadPlan, context) {
  generateAttributeBuffers(loadPlan.attributePlans, context);

  if (defined(loadPlan.indicesPlan)) {
    generateIndexBuffers(loadPlan.indicesPlan, context);
  }
}

function generateAttributeBuffers(attributePlans, context) {
  for (let i = 0; i < attributePlans.length; i++) {
    const { attribute, loadBuffer, loadTypedArray } = attributePlans[i];
    if (loadBuffer) {
      const buffer = Buffer.createVertexBuffer({
        typedArray: attribute.typedArray,
        context: context,
        usage: BufferUsage.STATIC_DRAW,
      });
      buffer.vertexArrayDestroyable = false;
      attribute.buffer = buffer;
    }

    if (!loadTypedArray) {
      attribute.typedArray = undefined;
    }
  }
}

function generateIndexBuffers(indicesPlan, context) {
  const indices = indicesPlan.indices;
  if (indicesPlan.loadBuffer) {
    const buffer = Buffer.createIndexBuffer({
      typedArray: indices.typedArray,
      context: context,
      usage: BufferUsage.STATIC_DRAW,
      indexDatatype: indices.indexDatatype,
    });
    indices.buffer = buffer;
    buffer.vertexArrayDestroyable = false;
  }

  if (!indicesPlan.loadTypedArray) {
    indices.typedArray = undefined;
  }
}

PrimitiveLoadPlan.AttributeLoadPlan = AttributeLoadPlan;
PrimitiveLoadPlan.IndicesLoadPlan = IndicesLoadPlan;
export default PrimitiveLoadPlan;
