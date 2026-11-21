import {
  AttributeType,
  Check,
  ComponentDatatype,
  DeveloperError,
  Frozen,
  Geometry,
  IndexDatatype,
  Math as CesiumMath,
  RuntimeError,
  assert,
  defined,
  destroyObject,
} from "@cesium/core";
import Buffer from "./Buffer.js";
import BufferUsage from "./BufferUsage.js";
import ContextLimits from "./ContextLimits.js";

/** @import {TypedArray, TypedArrayConstructor} from "@cesium/core"; */

/** @ignore */
function addAttribute(attributes, attribute, index, context) {
  const hasVertexBuffer = defined(attribute.vertexBuffer);
  const hasValue = defined(attribute.value);
  const componentsPerAttribute = attribute.value
    ? attribute.value.length
    : attribute.componentsPerAttribute;

  //>>includeStart('debug', pragmas.debug);
  if (!hasVertexBuffer && !hasValue) {
    throw new DeveloperError("attribute must have a vertexBuffer or a value.");
  }
  if (hasVertexBuffer && hasValue) {
    throw new DeveloperError(
      "attribute cannot have both a vertexBuffer and a value.  It must have either a vertexBuffer property defining per-vertex data or a value property defining data for all vertices.",
    );
  }
  if (
    componentsPerAttribute !== 1 &&
    componentsPerAttribute !== 2 &&
    componentsPerAttribute !== 3 &&
    componentsPerAttribute !== 4
  ) {
    if (hasValue) {
      throw new DeveloperError(
        "attribute.value.length must be in the range [1, 4].",
      );
    }

    throw new DeveloperError(
      "attribute.componentsPerAttribute must be in the range [1, 4].",
    );
  }
  if (
    defined(attribute.componentDatatype) &&
    !ComponentDatatype.validate(attribute.componentDatatype)
  ) {
    throw new DeveloperError(
      "attribute must have a valid componentDatatype or not specify it.",
    );
  }
  if (defined(attribute.strideInBytes) && attribute.strideInBytes > 255) {
    // WebGL limit.  Not in GL ES.
    throw new DeveloperError(
      "attribute must have a strideInBytes less than or equal to 255 or not specify it.",
    );
  }
  if (
    defined(attribute.instanceDivisor) &&
    attribute.instanceDivisor > 0 &&
    !context.instancedArrays
  ) {
    throw new DeveloperError("instanced arrays is not supported");
  }
  if (defined(attribute.instanceDivisor) && attribute.instanceDivisor < 0) {
    throw new DeveloperError(
      "attribute must have an instanceDivisor greater than or equal to zero",
    );
  }
  if (defined(attribute.instanceDivisor) && hasValue) {
    throw new DeveloperError(
      "attribute cannot have have an instanceDivisor if it is not backed by a buffer",
    );
  }
  if (
    defined(attribute.instanceDivisor) &&
    attribute.instanceDivisor > 0 &&
    attribute.index === 0
  ) {
    throw new DeveloperError(
      "attribute zero cannot have an instanceDivisor greater than 0",
    );
  }
  //>>includeEnd('debug');

  // Shallow copy the attribute; we do not want to copy the vertex buffer.
  const attr = {
    index: attribute.index ?? index,
    enabled: attribute.enabled ?? true,
    vertexBuffer: attribute.vertexBuffer,
    value: hasValue ? attribute.value.slice(0) : undefined,
    componentsPerAttribute: componentsPerAttribute,
    componentDatatype: attribute.componentDatatype ?? ComponentDatatype.FLOAT,
    normalize: attribute.normalize ?? false,
    offsetInBytes: attribute.offsetInBytes ?? 0,
    strideInBytes: attribute.strideInBytes ?? 0,
    instanceDivisor: attribute.instanceDivisor ?? 0,
  };

  if (hasVertexBuffer) {
    // Common case: vertex buffer for per-vertex data
    attr.vertexAttrib = function (gl) {
      const index = this.index;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer._getBuffer());
      gl.vertexAttribPointer(
        index,
        this.componentsPerAttribute,
        this.componentDatatype,
        this.normalize,
        this.strideInBytes,
        this.offsetInBytes,
      );
      gl.enableVertexAttribArray(index);
      if (this.instanceDivisor > 0) {
        context.glVertexAttribDivisor(index, this.instanceDivisor);
        context._vertexAttribDivisors[index] = this.instanceDivisor;
        context._previousDrawInstanced = true;
      }
    };

    attr.disableVertexAttribArray = function (gl) {
      gl.disableVertexAttribArray(this.index);
      if (this.instanceDivisor > 0) {
        context.glVertexAttribDivisor(index, 0);
      }
    };
  } else {
    // Less common case: value array for the same data for each vertex
    switch (attr.componentsPerAttribute) {
      case 1:
        attr.vertexAttrib = function (gl) {
          gl.vertexAttrib1fv(this.index, this.value);
        };
        break;
      case 2:
        attr.vertexAttrib = function (gl) {
          gl.vertexAttrib2fv(this.index, this.value);
        };
        break;
      case 3:
        attr.vertexAttrib = function (gl) {
          gl.vertexAttrib3fv(this.index, this.value);
        };
        break;
      case 4:
        attr.vertexAttrib = function (gl) {
          gl.vertexAttrib4fv(this.index, this.value);
        };
        break;
    }

    attr.disableVertexAttribArray = function (gl) {};
  }

  attributes.push(attr);
}

function bind(gl, attributes, indexBuffer) {
  for (let i = 0; i < attributes.length; ++i) {
    const attribute = attributes[i];
    if (attribute.enabled) {
      attribute.vertexAttrib(gl);
    }
  }

  if (defined(indexBuffer)) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer._getBuffer());
  }
}

/**
 * 创建一个顶点数组，该数组定义了构成顶点的属性，并包含一个可选的索引缓冲区。
 * 用于选择要渲染的顶点。属性使用如下示例 1 中的对象字面量来定义。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {Context} options.context VertexArray 被创建的上下文。
 * @param {object[]} options.attributes 一个属性数组。
 * @param {Buffer} [options.indexBuffer] 一个可选的索引缓冲区。
 *
 * @returns {VertexArray} The 已准备好用于绘制的顶点数组。
 *
 * @exception {DeveloperError} Attribute 必须拥有 <code>vertexBuffer</code>。
 * @exception {DeveloperError} Attribute 必须拥有 <code>componentsPerAttribute</code>。
 * @exception {DeveloperError} Attribute 必须拥有有效的 <code>componentDatatype</code>，或不指定该值。
 * @exception {DeveloperError} Attribute 必须拥有 <code>strideInBytes</code>，且其值小于或等于 255，或不指定该值。
 * @exception {DeveloperError} Index 当多个属性使用 n 时。
 *
 *
 * @example
 * // 示例 1. 创建一个由三个浮点数组成的顶点数组。
 * // 例如，位置值来自单个顶点缓冲区。不使用索引缓冲区。
 * const positionBuffer = Buffer.createVertexBuffer({
 * context : context,
 * sizeInBytes : 12,
 * usage : BufferUsage.STATIC_DRAW
 * });
 * const attributes = [
 *     {
 * index                  : 0,
 * enabled                : true,
 * vertexBuffer           : positionBuffer,
 * componentsPerAttribute : 3,
 * componentDatatype      : ComponentDatatype.FLOAT,
 * normalize              : false,
 * offsetInBytes          : 0,
 * strideInBytes          : 0 // 紧密排列
 * instanceDivisor        : 0 // 非实例化
 *     }
 * ];
 * const va = new VertexArray({
 * context : context,
 * attributes : attributes
 * });
 *
 * @example
 * // 示例 2. 创建一个由两个不同顶点缓冲区组成的顶点数组。
 * // 每个顶点具有三个分量的位置和三个分量的法线。
 * const positionBuffer = Buffer.createVertexBuffer({
 * context : context,
 * sizeInBytes : 12,
 * usage : BufferUsage.STATIC_DRAW
 * });
 * const normalBuffer = Buffer.createVertexBuffer({
 * context : context,
 * sizeInBytes : 12,
 * usage : BufferUsage.STATIC_DRAW
 * });
 * const attributes = [
 *     {
 * index                  : 0,
 * vertexBuffer           : positionBuffer,
 * componentsPerAttribute : 3,
 * componentDatatype      : ComponentDatatype.FLOAT
 *     },
 *     {
 * index                  : 1,
 * vertexBuffer           : normalBuffer,
 * componentsPerAttribute : 3,
 * componentDatatype      : ComponentDatatype.FLOAT
 *     }
 * ];
 * const va = new VertexArray({
 * context : context,
 * attributes : attributes
 * });
 *
 * @example
 * // 示例 3. 使用单个顶点缓冲区而不是两个，创建与示例 2 相同的顶点布局。
 * // vertex buffer, instead of two.
 * const buffer = Buffer.createVertexBuffer({
 * context : context,
 * sizeInBytes : 24,
 * usage : BufferUsage.STATIC_DRAW
 * });
 * const attributes = [
 *     {
 * vertexBuffer           : buffer,
 * componentsPerAttribute : 3,
 * componentDatatype      : ComponentDatatype.FLOAT,
 * offsetInBytes          : 0,
 * strideInBytes          : 24
 *     },
 *     {
 * vertexBuffer           : buffer,
 * componentsPerAttribute : 3,
 * componentDatatype      : ComponentDatatype.FLOAT,
 * normalize              : true,
 * offsetInBytes          : 12,
 * strideInBytes          : 24
 *     }
 * ];
 * const va = new VertexArray({
 * context : context,
 * attributes : attributes
 * });
 *
 * @see Buffer#createVertexBuffer
 * @see Buffer#createIndexBuffer
 * @see Context#draw
 *
 * @private
 */
function VertexArray(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.context", options.context);
  Check.defined("options.attributes", options.attributes);
  //>>includeEnd('debug');

  const context = options.context;
  const gl = context._gl;
  const attributes = options.attributes;
  const indexBuffer = options.indexBuffer;

  let i;
  const vaAttributes = [];
  let numberOfVertices = 1; // if every attribute is backed by a single value
  let hasInstancedAttributes = false;
  let hasConstantAttributes = false;

  let length = attributes.length;
  for (i = 0; i < length; ++i) {
    addAttribute(vaAttributes, attributes[i], i, context);
  }

  length = vaAttributes.length;
  for (i = 0; i < length; ++i) {
    const attribute = vaAttributes[i];

    if (defined(attribute.vertexBuffer) && attribute.instanceDivisor === 0) {
      // This assumes that each vertex buffer in the vertex array has the same number of vertices.
      const bytes =
        attribute.strideInBytes ||
        attribute.componentsPerAttribute *
          ComponentDatatype.getSizeInBytes(attribute.componentDatatype);
      numberOfVertices = attribute.vertexBuffer.sizeInBytes / bytes;
      break;
    }
  }

  for (i = 0; i < length; ++i) {
    if (vaAttributes[i].instanceDivisor > 0) {
      hasInstancedAttributes = true;
    }
    if (defined(vaAttributes[i].value)) {
      hasConstantAttributes = true;
    }
  }

  //>>includeStart('debug', pragmas.debug);
  // Verify all attribute names are unique
  const uniqueIndices = {};
  for (i = 0; i < length; ++i) {
    const index = vaAttributes[i].index;
    if (uniqueIndices[index]) {
      throw new DeveloperError(
        `Index ${index} is used by more than one attribute.`,
      );
    }
    uniqueIndices[index] = true;
  }
  //>>includeEnd('debug');

  let vao;

  // Setup VAO if supported
  if (context.vertexArrayObject) {
    vao = context.glCreateVertexArray();
    context.glBindVertexArray(vao);
    bind(gl, vaAttributes, indexBuffer);
    context.glBindVertexArray(null);
  }

  this._numberOfVertices = numberOfVertices;
  this._hasInstancedAttributes = hasInstancedAttributes;
  this._hasConstantAttributes = hasConstantAttributes;
  this._context = context;
  this._gl = gl;
  this._vao = vao;
  this._attributes = vaAttributes;
  this._indexBuffer = indexBuffer;
}

function computeNumberOfVertices(attribute) {
  return attribute.values.length / attribute.componentsPerAttribute;
}

function computeAttributeSizeInBytes(attribute) {
  return (
    ComponentDatatype.getSizeInBytes(attribute.componentDatatype) *
    attribute.componentsPerAttribute
  );
}

function interleaveAttributes(attributes) {
  let j;
  let name;
  let attribute;

  // Extract attribute names.
  const names = [];
  for (name in attributes) {
    // Attribute needs to have per-vertex values; not a constant value for all vertices.
    if (
      attributes.hasOwnProperty(name) &&
      defined(attributes[name]) &&
      defined(attributes[name].values)
    ) {
      names.push(name);

      if (attributes[name].componentDatatype === ComponentDatatype.DOUBLE) {
        attributes[name].componentDatatype = ComponentDatatype.FLOAT;
        attributes[name].values = ComponentDatatype.createTypedArray(
          ComponentDatatype.FLOAT,
          attributes[name].values,
        );
      }
    }
  }

  // Validation.  Compute number of vertices.
  let numberOfVertices;
  const namesLength = names.length;

  if (namesLength > 0) {
    numberOfVertices = computeNumberOfVertices(attributes[names[0]]);

    for (j = 1; j < namesLength; ++j) {
      const currentNumberOfVertices = computeNumberOfVertices(
        attributes[names[j]],
      );

      if (currentNumberOfVertices !== numberOfVertices) {
        throw new RuntimeError(
          `${
            "Each attribute list must have the same number of vertices.  " +
            "Attribute "
          }${names[j]} has a different number of vertices ` +
            `(${currentNumberOfVertices.toString()})` +
            ` than attribute ${names[0]} (${numberOfVertices.toString()}).`,
        );
      }
    }
  }

  // Sort attributes by the size of their components.  From left to right, a vertex stores floats, shorts, and then bytes.
  names.sort(function (left, right) {
    return (
      ComponentDatatype.getSizeInBytes(attributes[right].componentDatatype) -
      ComponentDatatype.getSizeInBytes(attributes[left].componentDatatype)
    );
  });

  // Compute sizes and strides.
  let vertexSizeInBytes = 0;
  const offsetsInBytes = {};

  for (j = 0; j < namesLength; ++j) {
    name = names[j];
    attribute = attributes[name];

    offsetsInBytes[name] = vertexSizeInBytes;
    vertexSizeInBytes += computeAttributeSizeInBytes(attribute);
  }

  if (vertexSizeInBytes > 0) {
    // Pad each vertex to be a multiple of the largest component datatype so each
    // attribute can be addressed using typed arrays.
    const maxComponentSizeInBytes = ComponentDatatype.getSizeInBytes(
      attributes[names[0]].componentDatatype,
    ); // Sorted large to small
    const remainder = vertexSizeInBytes % maxComponentSizeInBytes;
    if (remainder !== 0) {
      vertexSizeInBytes += maxComponentSizeInBytes - remainder;
    }

    // Total vertex buffer size in bytes, including per-vertex padding.
    const vertexBufferSizeInBytes = numberOfVertices * vertexSizeInBytes;

    // Create array for interleaved vertices.  Each attribute has a different view (pointer) into the array.
    const buffer = new ArrayBuffer(vertexBufferSizeInBytes);
    const views = {};

    for (j = 0; j < namesLength; ++j) {
      name = names[j];
      const sizeInBytes = ComponentDatatype.getSizeInBytes(
        attributes[name].componentDatatype,
      );

      views[name] = {
        pointer: ComponentDatatype.createTypedArray(
          attributes[name].componentDatatype,
          buffer,
        ),
        index: offsetsInBytes[name] / sizeInBytes, // Offset in ComponentType
        strideInComponentType: vertexSizeInBytes / sizeInBytes,
      };
    }

    // Copy attributes into one interleaved array.
    // PERFORMANCE_IDEA:  Can we optimize these loops?
    for (j = 0; j < numberOfVertices; ++j) {
      for (let n = 0; n < namesLength; ++n) {
        name = names[n];
        attribute = attributes[name];
        const values = attribute.values;
        const view = views[name];
        const pointer = view.pointer;

        const numberOfComponents = attribute.componentsPerAttribute;
        for (let k = 0; k < numberOfComponents; ++k) {
          pointer[view.index + k] = values[j * numberOfComponents + k];
        }

        view.index += view.strideInComponentType;
      }
    }

    return {
      buffer: buffer,
      offsetsInBytes: offsetsInBytes,
      vertexSizeInBytes: vertexSizeInBytes,
    };
  }

  // No attributes to interleave.
  return undefined;
}

/**
 * 从几何数据创建顶点数组。几何数据包含顶点属性及可选的索引数据
 * 存储在系统内存中，而顶点数组在 WebGL 中则包含顶点缓冲区及可选的索引缓冲区
 * 用于渲染的内存。
 * <br /><br />
 * <code>geometry</code> 参数应采用与 {@link BoxGeometry} 返回的几何数据相同的布局。
 * <br /><br />
 * <code>options</code> 可以包含四个属性：
 * <ul>
 * <li><code>geometry</code>: 用于创建顶点数组的数据源几何数据。</li>
 * <li><code>attributeLocations</code>: 将几何属性名称映射到顶点着色器属性位置的对象。</li>
 * <li><code>bufferUsage</code>: 顶点数组缓冲区的预期使用模式。在某些 WebGL 实现中，这可能会显著影响性能。参见 {@link BufferUsage}。默认值为 <code>BufferUsage.DYNAMIC_DRAW</code>。</li>
 * <li><code>interleave</code>: 决定所有属性是否在一个顶点缓冲区中交错存储，还是每个属性分别存储在独立的顶点缓冲区中。默认值为 <code>false</code>。</li>
 * </ul>
 * <br />
 * 如果未指定 <code>options</code>，或者 <code>geometry</code> 不包含数据，则返回的顶点数组为空。
 *
 * @param {object} options 定义几何数据、属性索引、缓冲区使用模式和用于创建顶点数组的顶点布局的对象。
 *
 * @exception {RuntimeError} Each 属性列表必须具有相同数量的顶点。
 * @exception {DeveloperError} The 几何数据必须包含零个或 하나的索引列表。
 * @exception {DeveloperError} Index n 被多个属性使用。
 *
 *
 * @example
 * // 示例 1. 为渲染盒子创建顶点数组。默认采用动态绘制方式
 * // usage 用于创建的顶点和索引缓冲区。属性默认不交错存储。
 * const geometry = new BoxGeometry();
 * const geometry = new BoxGeometry();
 * const va = VertexArray.fromGeometry({
 * context            : context,
 * geometry           : geometry,
 * attributeLocations : GeometryPipeline.createAttributeLocations(geometry),
 * });
 *
 * @example
 * // 示例 2。在单个顶点缓冲区中创建包含交错属性的顶点数组。顶点和索引缓冲区具有静态绘制使用权限。
 * // 示例 3。当调用者销毁顶点数组时，也会销毁与之关联的顶点缓冲区和索引缓冲区。
 * va = va.destroy();
 * context            : context,
 * geometry           : geometry,
 * attributeLocations : GeometryPipeline.createAttributeLocations(geometry),
 * bufferUsage        : BufferUsage.STATIC_DRAW,
 * interleave         : true
 * });
 *
 * @example
 * // 示例 3。当调用者销毁顶点数组时，也会销毁与之关联的
 * // 顶点缓冲区和索引缓冲区。
 * va = va.destroy();
 *
 * @see Buffer#createVertexBuffer
 * @see Buffer#createIndexBuffer
 * @see GeometryPipeline.createAttributeLocations
 * @see ShaderProgram
 */
VertexArray.fromGeometry = function (options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  Check.defined("options.context", options.context);
  //>>includeEnd('debug');

  const context = options.context;
  const geometry = options.geometry ?? Frozen.EMPTY_OBJECT;

  const bufferUsage = options.bufferUsage ?? BufferUsage.DYNAMIC_DRAW;

  const attributeLocations = options.attributeLocations ?? Frozen.EMPTY_OBJECT;
  const interleave = options.interleave ?? false;
  const createdVAAttributes = options.vertexArrayAttributes;

  let name;
  let attribute;
  let vertexBuffer;
  const vaAttributes = defined(createdVAAttributes) ? createdVAAttributes : [];
  const attributes = geometry.attributes;

  if (interleave) {
    // Use a single vertex buffer with interleaved vertices.
    const interleavedAttributes = interleaveAttributes(attributes);
    if (defined(interleavedAttributes)) {
      vertexBuffer = Buffer.createVertexBuffer({
        context: context,
        typedArray: interleavedAttributes.buffer,
        usage: bufferUsage,
      });
      const offsetsInBytes = interleavedAttributes.offsetsInBytes;
      const strideInBytes = interleavedAttributes.vertexSizeInBytes;

      for (name in attributes) {
        if (attributes.hasOwnProperty(name) && defined(attributes[name])) {
          attribute = attributes[name];

          if (defined(attribute.values)) {
            // Common case: per-vertex attributes
            vaAttributes.push({
              index: attributeLocations[name],
              vertexBuffer: vertexBuffer,
              componentDatatype: attribute.componentDatatype,
              componentsPerAttribute: attribute.componentsPerAttribute,
              normalize: attribute.normalize,
              offsetInBytes: offsetsInBytes[name],
              strideInBytes: strideInBytes,
            });
          } else {
            // Constant attribute for all vertices
            vaAttributes.push({
              index: attributeLocations[name],
              value: attribute.value,
              componentDatatype: attribute.componentDatatype,
              normalize: attribute.normalize,
            });
          }
        }
      }
    }
  } else {
    // One vertex buffer per attribute.
    for (name in attributes) {
      if (attributes.hasOwnProperty(name) && defined(attributes[name])) {
        attribute = attributes[name];

        let componentDatatype = attribute.componentDatatype;
        if (componentDatatype === ComponentDatatype.DOUBLE) {
          componentDatatype = ComponentDatatype.FLOAT;
        }

        let attrProps = {};
        if (defined(attribute.values)) {
          vertexBuffer = Buffer.createVertexBuffer({
            context: context,
            typedArray: ComponentDatatype.createTypedArray(
              componentDatatype,
              attribute.values,
            ),
            usage: bufferUsage,
          });

          attrProps = {
            index: attributeLocations[name],
            vertexBuffer: vertexBuffer,
            value: attribute.value,
            componentDatatype: componentDatatype,
            componentsPerAttribute: attribute.componentsPerAttribute,
            normalize: attribute.normalize,
          };
        }

        //if we already have a typedArray lets use it
        if (defined(attribute.typedArray)) {
          vertexBuffer = Buffer.createVertexBuffer({
            context: context,
            typedArray: attribute.typedArray,
            usage: bufferUsage,
          });

          attrProps = {
            index: attributeLocations[name],
            vertexBuffer: vertexBuffer,
            value: undefined,
            componentDatatype: componentDatatype,
            componentsPerAttribute: AttributeType.getNumberOfComponents(
              attribute.type,
            ),
            normalize: attribute.normalized,
            instanceDivisor: attribute.instanceDivisor,
          };
        }

        vaAttributes.push(attrProps);
      }
    }
  }

  let indexBuffer;
  const indices = geometry.indices;
  if (defined(indices)) {
    if (
      Geometry.computeNumberOfVertices(geometry) >=
        CesiumMath.SIXTY_FOUR_KILOBYTES &&
      context.elementIndexUint
    ) {
      indexBuffer = Buffer.createIndexBuffer({
        context: context,
        typedArray: new Uint32Array(indices),
        usage: bufferUsage,
        indexDatatype: IndexDatatype.UNSIGNED_INT,
      });
    } else {
      indexBuffer = Buffer.createIndexBuffer({
        context: context,
        typedArray: new Uint16Array(indices),
        usage: bufferUsage,
        indexDatatype: IndexDatatype.UNSIGNED_SHORT,
      });
    }
  }

  return new VertexArray({
    context: context,
    attributes: vaAttributes,
    indexBuffer: indexBuffer,
  });
};

Object.defineProperties(VertexArray.prototype, {
  numberOfAttributes: {
    get: function () {
      return this._attributes.length;
    },
  },
  numberOfVertices: {
    get: function () {
      return this._numberOfVertices;
    },
  },
  indexBuffer: {
    get: function () {
      return this._indexBuffer;
    },
  },
});

/**
 * 索引是数组中属性的位置，而非属性的索引属性。
 */
VertexArray.prototype.getAttribute = function (index) {
  //>>includeStart('debug', pragmas.debug);
  Check.defined("index", index);
  //>>includeEnd('debug');

  return this._attributes[index];
};

// Workaround for ANGLE, where the attribute divisor seems to be part of the global state instead
// of the VAO state. This function is called when the vao is bound, and should be removed
// once the ANGLE issue is resolved. Setting the divisor should normally happen in vertexAttrib and
// disableVertexAttribArray.
function setVertexAttribDivisor(vertexArray) {
  const context = vertexArray._context;
  const hasInstancedAttributes = vertexArray._hasInstancedAttributes;
  if (!hasInstancedAttributes && !context._previousDrawInstanced) {
    return;
  }
  context._previousDrawInstanced = hasInstancedAttributes;

  const divisors = context._vertexAttribDivisors;
  const attributes = vertexArray._attributes;
  const maxAttributes = ContextLimits.maximumVertexAttributes;
  let i;

  if (hasInstancedAttributes) {
    const length = attributes.length;
    for (i = 0; i < length; ++i) {
      const attribute = attributes[i];
      if (attribute.enabled) {
        const divisor = attribute.instanceDivisor;
        const index = attribute.index;
        if (divisor !== divisors[index]) {
          context.glVertexAttribDivisor(index, divisor);
          divisors[index] = divisor;
        }
      }
    }
  } else {
    for (i = 0; i < maxAttributes; ++i) {
      if (divisors[i] > 0) {
        context.glVertexAttribDivisor(i, 0);
        divisors[i] = 0;
      }
    }
  }
}

// Vertex attributes backed by a constant value go through vertexAttrib[1234]f[v]
// which is part of context state rather than VAO state.
function setConstantAttributes(vertexArray, gl) {
  const attributes = vertexArray._attributes;
  const length = attributes.length;
  for (let i = 0; i < length; ++i) {
    const attribute = attributes[i];
    if (attribute.enabled && defined(attribute.value)) {
      attribute.vertexAttrib(gl);
    }
  }
}

/**
 * 从给定数组复制到顶点属性缓冲区中，按照指定的偏移量和数量
 * 进行复制，数量为（VECN）个顶点。数组和顶点属性必须具有相同长度，该长度可以大于
 * 指定范围以进行更新。
 * 从给定数组复制到索引缓冲区中，按照指定的偏移量和数量
 * @param {number} attributeIndex
 * @param {TypedArray} array
 * @param {number} vertexOffset
 * @param {number} vertexCount
 */
VertexArray.prototype.copyAttributeFromRange = function (
  attributeIndex,
  array,
  vertexOffset,
  vertexCount,
) {
  const attribute = this.getAttribute(attributeIndex);
  const buffer = /** @type {Buffer} */ (attribute.vertexBuffer);
  const elementsPerVertex = attribute.componentsPerAttribute;

  //>>includeStart('debug', pragmas.debug);
  assert(buffer.sizeInBytes === array.byteLength, "Invalid buffer length");
  //>>includeEnd('debug');

  const ArrayConstructor = /** @type {TypedArrayConstructor} */ (
    array.constructor
  );

  const byteOffset =
    vertexOffset * elementsPerVertex * ArrayConstructor.BYTES_PER_ELEMENT;

  // Create a zero-copy ArrayView onto the specified range of the source array.
  const rangeArrayView = new ArrayConstructor(
    /** @type {ArrayBuffer} */ (array.buffer),
    array.byteOffset + byteOffset,
    vertexCount * elementsPerVertex,
  );

  buffer.copyFromArrayView(rangeArrayView, byteOffset);
};

/**
 * 进行复制，数量为（uint）个索引。数组和索引缓冲区必须具有相同长度，该长度可以大于
 * 指定范围以进行更新。
 * and index buffer must have the same length, which can be larger
 * than the specified range to update.
 * @param {TypedArray} array
 * @param {number} indexOffset
 * @param {number} indexCount
 */
VertexArray.prototype.copyIndexFromRange = function (
  array,
  indexOffset,
  indexCount,
) {
  const buffer = /** @type {Buffer} */ (this._indexBuffer);

  //>>includeStart('debug', pragmas.debug);
  assert(buffer.sizeInBytes === array.byteLength, "Invalid buffer length");
  //>>includeEnd('debug');

  const ArrayConstructor = /** @type {TypedArrayConstructor} */ (
    array.constructor
  );

  const byteOffset = indexOffset * ArrayConstructor.BYTES_PER_ELEMENT;

  // Create a zero-copy ArrayView onto the specified range of the source array.
  const rangeArrayView = new ArrayConstructor(
    /** @type {ArrayBuffer} */ (array.buffer),
    array.byteOffset + byteOffset,
    indexCount,
  );

  buffer.copyFromArrayView(rangeArrayView, byteOffset);
};

VertexArray.prototype._bind = function () {
  if (defined(this._vao)) {
    this._context.glBindVertexArray(this._vao);
    if (this._context.instancedArrays) {
      setVertexAttribDivisor(this);
    }
    if (this._hasConstantAttributes) {
      setConstantAttributes(this, this._gl);
    }
  } else {
    bind(this._gl, this._attributes, this._indexBuffer);
  }
};

VertexArray.prototype._unBind = function () {
  if (defined(this._vao)) {
    this._context.glBindVertexArray(null);
  } else {
    const attributes = this._attributes;
    const gl = this._gl;

    for (let i = 0; i < attributes.length; ++i) {
      const attribute = attributes[i];
      if (attribute.enabled) {
        attribute.disableVertexAttribArray(gl);
      }
    }
    if (this._indexBuffer) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }
  }
};

VertexArray.prototype.isDestroyed = function () {
  return false;
};

VertexArray.prototype.destroy = function () {
  const attributes = this._attributes;
  for (let i = 0; i < attributes.length; ++i) {
    const vertexBuffer = attributes[i].vertexBuffer;
    if (
      defined(vertexBuffer) &&
      !vertexBuffer.isDestroyed() &&
      vertexBuffer.vertexArrayDestroyable
    ) {
      vertexBuffer.destroy();
    }
  }

  const indexBuffer = this._indexBuffer;
  if (
    defined(indexBuffer) &&
    !indexBuffer.isDestroyed() &&
    indexBuffer.vertexArrayDestroyable
  ) {
    indexBuffer.destroy();
  }

  if (defined(this._vao)) {
    this._context.glDeleteVertexArray(this._vao);
  }

  return destroyObject(this);
};
export default VertexArray;
