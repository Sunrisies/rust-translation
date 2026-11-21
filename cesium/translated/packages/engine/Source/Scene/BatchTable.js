import {
  Cartesian2,
  Cartesian3,
  Cartesian4,
  ComponentDatatype,
  DeveloperError,
  PixelDatatype,
  PixelFormat,
  combine,
  defined,
  destroyObject,
} from "@cesium/core";
import ContextLimits from "../Renderer/ContextLimits.js";
import Sampler from "../Renderer/Sampler.js";
import Texture from "../Renderer/Texture.js";

/**
 * 为批量primitive创建纹理，用于查找每个实体的属性。例如，将每个primitive的拾取颜色存储在纹理中。
 *
 * @alias BatchTable
 * @constructor
 * @private
 *
 * @param {Context} context 创建批量表时的上下文环境。
 * @param {object[]} attributes 描述每个实体属性的对象数组。每个对象包含数据类型、每个属性的组件数、是否归一化以及函数名。
 * 在顶点着色器中检索该值。
 * @param {number} numberOfInstances 批量表中的实例数量。
 *
 * @example
 * // 创建批量表
 * const attributes = [{
 * functionName : 'getShow',
 * componentDatatype : ComponentDatatype.UNSIGNED_BYTE,
 * componentsPerAttribute : 1
 * }, {
 * functionName : 'getPickColor',
 * componentDatatype : ComponentDatatype.UNSIGNED_BYTE,
 * componentsPerAttribute : 4,
 * normalize : true
 * }];
 * const batchTable = new BatchTable(context, attributes, 5);
 *
 * // 在创建绘制命令时，更新统一映射和顶点着色器
 * vertexShaderSource = batchTable.getVertexShaderCallback()(vertexShaderSource);
 * const shaderProgram = ShaderProgram.fromCache({
 *    // ...
 * vertexShaderSource : vertexShaderSource,
 * });
 *
 * drawCommand.shaderProgram = shaderProgram;
 * drawCommand.uniformMap = batchTable.getUniformMapCallback()(uniformMap);
 *
 * // 在着色器中使用属性函数名来检索实体值
 * // ...
 * attribute float batchId;
 *
 * void main() {
 *     // ...
 * float show = getShow(batchId);
 * vec3 pickColor = getPickColor(batchId);
 *     // ...
 * }
 */
function BatchTable(context, attributes, numberOfInstances) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(context)) {
    throw new DeveloperError("context is required");
  }
  if (!defined(attributes)) {
    throw new DeveloperError("attributes is required");
  }
  if (!defined(numberOfInstances)) {
    throw new DeveloperError("numberOfInstances is required");
  }
  //>>includeEnd('debug');

  this._attributes = attributes;
  this._numberOfInstances = numberOfInstances;

  if (attributes.length === 0) {
    return;
  }

  // PERFORMANCE_IDEA: We may be able to arrange the attributes so they can be packing into fewer texels.
  // Right now, an attribute with one component uses an entire texel when 4 single component attributes can
  // be packed into a texel.
  //
  // Packing floats into unsigned byte textures makes the problem worse. A single component float attribute
  // will be packed into a single texel leaving 3 texels unused. 4 texels are reserved for each float attribute
  // regardless of how many components it has.
  const pixelDatatype = getDatatype(attributes);
  const textureFloatSupported = context.floatingPointTexture;
  const packFloats =
    pixelDatatype === PixelDatatype.FLOAT && !textureFloatSupported;
  const offsets = createOffsets(attributes, packFloats);

  const stride = getStride(offsets, attributes, packFloats);
  const maxNumberOfInstancesPerRow = Math.floor(
    ContextLimits.maximumTextureSize / stride,
  );

  const instancesPerWidth = Math.min(
    numberOfInstances,
    maxNumberOfInstancesPerRow,
  );
  const width = stride * instancesPerWidth;
  const height = Math.ceil(numberOfInstances / instancesPerWidth);

  const stepX = 1.0 / width;
  const centerX = stepX * 0.5;
  const stepY = 1.0 / height;
  const centerY = stepY * 0.5;

  this._textureDimensions = new Cartesian2(width, height);
  this._textureStep = new Cartesian4(stepX, centerX, stepY, centerY);
  this._pixelDatatype = !packFloats
    ? pixelDatatype
    : PixelDatatype.UNSIGNED_BYTE;
  this._packFloats = packFloats;
  this._offsets = offsets;
  this._stride = stride;
  this._texture = undefined;

  const batchLength = 4 * width * height;
  this._batchValues =
    pixelDatatype === PixelDatatype.FLOAT && !packFloats
      ? new Float32Array(batchLength)
      : new Uint8Array(batchLength);
  this._batchValuesDirty = false;
}

Object.defineProperties(BatchTable.prototype, {
  /**
   * 属性描述。
   * @memberOf BatchTable.prototype
   * @type {object[]}
   * @readonly
   */
  attributes: {
    get: function () {
      return this._attributes;
    },
  },
  /**
   * 实例数量。
   * @memberOf BatchTable.prototype
   * @type {number}
   * @readonly
   */
  numberOfInstances: {
    get: function () {
      return this._numberOfInstances;
    },
  },
});

function getDatatype(attributes) {
  let foundFloatDatatype = false;
  const length = attributes.length;
  for (let i = 0; i < length; ++i) {
    if (attributes[i].componentDatatype !== ComponentDatatype.UNSIGNED_BYTE) {
      foundFloatDatatype = true;
      break;
    }
  }
  return foundFloatDatatype ? PixelDatatype.FLOAT : PixelDatatype.UNSIGNED_BYTE;
}

function getAttributeType(attributes, attributeIndex) {
  const componentsPerAttribute =
    attributes[attributeIndex].componentsPerAttribute;
  if (componentsPerAttribute === 2) {
    return Cartesian2;
  } else if (componentsPerAttribute === 3) {
    return Cartesian3;
  } else if (componentsPerAttribute === 4) {
    return Cartesian4;
  }
  return Number;
}

function createOffsets(attributes, packFloats) {
  const offsets = new Array(attributes.length);

  let currentOffset = 0;
  const attributesLength = attributes.length;
  for (let i = 0; i < attributesLength; ++i) {
    const attribute = attributes[i];
    const componentDatatype = attribute.componentDatatype;

    offsets[i] = currentOffset;

    if (componentDatatype !== ComponentDatatype.UNSIGNED_BYTE && packFloats) {
      currentOffset += 4;
    } else {
      ++currentOffset;
    }
  }

  return offsets;
}

function getStride(offsets, attributes, packFloats) {
  const length = offsets.length;
  const lastOffset = offsets[length - 1];
  const lastAttribute = attributes[length - 1];
  const componentDatatype = lastAttribute.componentDatatype;

  if (componentDatatype !== ComponentDatatype.UNSIGNED_BYTE && packFloats) {
    return lastOffset + 4;
  }
  return lastOffset + 1;
}

const scratchPackedFloatCartesian4 = new Cartesian4();

function getPackedFloat(array, index, result) {
  let packed = Cartesian4.unpack(array, index, scratchPackedFloatCartesian4);
  const x = Cartesian4.unpackFloat(packed);

  packed = Cartesian4.unpack(array, index + 4, scratchPackedFloatCartesian4);
  const y = Cartesian4.unpackFloat(packed);

  packed = Cartesian4.unpack(array, index + 8, scratchPackedFloatCartesian4);
  const z = Cartesian4.unpackFloat(packed);

  packed = Cartesian4.unpack(array, index + 12, scratchPackedFloatCartesian4);
  const w = Cartesian4.unpackFloat(packed);

  return Cartesian4.fromElements(x, y, z, w, result);
}

function setPackedAttribute(value, array, index) {
  let packed = Cartesian4.packFloat(value.x, scratchPackedFloatCartesian4);
  Cartesian4.pack(packed, array, index);

  packed = Cartesian4.packFloat(value.y, packed);
  Cartesian4.pack(packed, array, index + 4);

  packed = Cartesian4.packFloat(value.z, packed);
  Cartesian4.pack(packed, array, index + 8);

  packed = Cartesian4.packFloat(value.w, packed);
  Cartesian4.pack(packed, array, index + 12);
}

const scratchGetAttributeCartesian4 = new Cartesian4();

/**
 * 获取表中某个属性的值。
 *
 * @param {number} instanceIndex 实体的索引。
 * @param {number} attributeIndex 属性的索引。
 * @param {undefined|Cartesian2|Cartesian3|Cartesian4} [result] 存储结果的对象。其类型取决于属性中的组件数。
 * @returns {number|Cartesian2|Cartesian3|Cartesian4} The 存储的实体值。
 *
 * @exception {DeveloperError} instanceIndex 超出范围。
 * @exception {DeveloperError} attributeIndex 超出范围。
 */
BatchTable.prototype.getBatchedAttribute = function (
  instanceIndex,
  attributeIndex,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  if (instanceIndex < 0 || instanceIndex >= this._numberOfInstances) {
    throw new DeveloperError("instanceIndex is out of range.");
  }
  if (attributeIndex < 0 || attributeIndex >= this._attributes.length) {
    throw new DeveloperError("attributeIndex is out of range");
  }
  //>>includeEnd('debug');

  const attributes = this._attributes;
  const offset = this._offsets[attributeIndex];
  const stride = this._stride;

  const index = 4 * stride * instanceIndex + 4 * offset;
  let value;

  if (
    this._packFloats &&
    attributes[attributeIndex].componentDatatype !== PixelDatatype.UNSIGNED_BYTE
  ) {
    value = getPackedFloat(
      this._batchValues,
      index,
      scratchGetAttributeCartesian4,
    );
  } else {
    value = Cartesian4.unpack(
      this._batchValues,
      index,
      scratchGetAttributeCartesian4,
    );
  }

  const attributeType = getAttributeType(attributes, attributeIndex);
  if (defined(attributeType.fromCartesian4)) {
    return attributeType.fromCartesian4(value, result);
  } else if (defined(attributeType.clone)) {
    return attributeType.clone(value, result);
  }

  return value.x;
};

const setAttributeScratchValues = [
  undefined,
  undefined,
  new Cartesian2(),
  new Cartesian3(),
  new Cartesian4(),
];
const setAttributeScratchCartesian4 = new Cartesian4();

/**
 * 设置表中某个属性的值。
 *
 * @param {number} instanceIndex 实体的索引。
 * @param {number} attributeIndex 属性的索引。
 * @param {number|Cartesian2|Cartesian3|Cartesian4} value 要存储在表中的值。值的类型取决于属性中的组件数。
 *
 * @exception {DeveloperError} instanceIndex 超出范围。
 * @exception {DeveloperError} attributeIndex 超出范围。
 */
BatchTable.prototype.setBatchedAttribute = function (
  instanceIndex,
  attributeIndex,
  value,
) {
  //>>includeStart('debug', pragmas.debug);
  if (instanceIndex < 0 || instanceIndex >= this._numberOfInstances) {
    throw new DeveloperError("instanceIndex is out of range.");
  }
  if (attributeIndex < 0 || attributeIndex >= this._attributes.length) {
    throw new DeveloperError("attributeIndex is out of range");
  }
  if (!defined(value)) {
    throw new DeveloperError("value is required.");
  }
  //>>includeEnd('debug');

  const attributes = this._attributes;
  const result =
    setAttributeScratchValues[
      attributes[attributeIndex].componentsPerAttribute
    ];
  const currentAttribute = this.getBatchedAttribute(
    instanceIndex,
    attributeIndex,
    result,
  );
  const attributeType = getAttributeType(this._attributes, attributeIndex);
  const entriesEqual = defined(attributeType.equals)
    ? attributeType.equals(currentAttribute, value)
    : currentAttribute === value;
  if (entriesEqual) {
    return;
  }

  const attributeValue = setAttributeScratchCartesian4;
  attributeValue.x = defined(value.x) ? value.x : value;
  attributeValue.y = defined(value.y) ? value.y : 0.0;
  attributeValue.z = defined(value.z) ? value.z : 0.0;
  attributeValue.w = defined(value.w) ? value.w : 0.0;

  const offset = this._offsets[attributeIndex];
  const stride = this._stride;
  const index = 4 * stride * instanceIndex + 4 * offset;

  if (
    this._packFloats &&
    attributes[attributeIndex].componentDatatype !== PixelDatatype.UNSIGNED_BYTE
  ) {
    setPackedAttribute(attributeValue, this._batchValues, index);
  } else {
    Cartesian4.pack(attributeValue, this._batchValues, index);
  }

  this._batchValuesDirty = true;
};

function createTexture(batchTable, context) {
  const dimensions = batchTable._textureDimensions;
  batchTable._texture = new Texture({
    context: context,
    pixelFormat: PixelFormat.RGBA,
    pixelDatatype: batchTable._pixelDatatype,
    width: dimensions.x,
    height: dimensions.y,
    sampler: Sampler.NEAREST,
    flipY: false,
  });
}

function updateTexture(batchTable) {
  const dimensions = batchTable._textureDimensions;
  batchTable._texture.copyFrom({
    source: {
      width: dimensions.x,
      height: dimensions.y,
      arrayBufferView: batchTable._batchValues,
    },
  });
}

/**
 * 创建/更新批量表纹理。
 * @param {FrameState} frameState 帧状态。
 *
 * @exception {RuntimeError} The 需要浮点纹理扩展，但不受支持。
 */
BatchTable.prototype.update = function (frameState) {
  if (
    (defined(this._texture) && !this._batchValuesDirty) ||
    this._attributes.length === 0
  ) {
    return;
  }

  this._batchValuesDirty = false;

  if (!defined(this._texture)) {
    createTexture(this, frameState.context);
  }
  updateTexture(this);
};

/**
 * 获取一个函数，用于更新统一映射以包含在批量表中查找值所需的值。
 *
 * @returns {BatchTable.updateUniformMapCallback} A 更新统一映射的回调。
 */
BatchTable.prototype.getUniformMapCallback = function () {
  const that = this;
  return function (uniformMap) {
    if (that._attributes.length === 0) {
      return uniformMap;
    }

    const batchUniformMap = {
      batchTexture: function () {
        return that._texture;
      },
      batchTextureDimensions: function () {
        return that._textureDimensions;
      },
      batchTextureStep: function () {
        return that._textureStep;
      },
    };
    return combine(uniformMap, batchUniformMap);
  };
};

function getGlslComputeSt(batchTable) {
  const stride = batchTable._stride;

  // GLSL batchId is zero-based: [0, numberOfInstances - 1]
  if (batchTable._textureDimensions.y === 1) {
    return (
      `${
        "uniform vec4 batchTextureStep; \n" +
        "vec2 computeSt(float batchId) \n" +
        "{ \n" +
        "    float stepX = batchTextureStep.x; \n" +
        "    float centerX = batchTextureStep.y; \n" +
        "    float numberOfAttributes = float("
      }${stride}); \n` +
      `    return vec2(centerX + (batchId * numberOfAttributes * stepX), 0.5); \n` +
      `} \n`
    );
  }

  return (
    `${
      "uniform vec4 batchTextureStep; \n" +
      "uniform vec2 batchTextureDimensions; \n" +
      "vec2 computeSt(float batchId) \n" +
      "{ \n" +
      "    float stepX = batchTextureStep.x; \n" +
      "    float centerX = batchTextureStep.y; \n" +
      "    float stepY = batchTextureStep.z; \n" +
      "    float centerY = batchTextureStep.w; \n" +
      "    float numberOfAttributes = float("
    }${stride}); \n` +
    `    float xId = mod(batchId * numberOfAttributes, batchTextureDimensions.x); \n` +
    `    float yId = floor(batchId * numberOfAttributes / batchTextureDimensions.x); \n` +
    `    return vec2(centerX + (xId * stepX), centerY + (yId * stepY)); \n` +
    `} \n`
  );
}

function getComponentType(componentsPerAttribute) {
  if (componentsPerAttribute === 1) {
    return "float";
  }
  return `vec${componentsPerAttribute}`;
}

function getComponentSwizzle(componentsPerAttribute) {
  if (componentsPerAttribute === 1) {
    return ".x";
  } else if (componentsPerAttribute === 2) {
    return ".xy";
  } else if (componentsPerAttribute === 3) {
    return ".xyz";
  }
  return "";
}

function getGlslAttributeFunction(batchTable, attributeIndex) {
  const attributes = batchTable._attributes;
  const attribute = attributes[attributeIndex];
  const componentsPerAttribute = attribute.componentsPerAttribute;
  const functionName = attribute.functionName;
  const functionReturnType = getComponentType(componentsPerAttribute);
  const functionReturnValue = getComponentSwizzle(componentsPerAttribute);

  const offset = batchTable._offsets[attributeIndex];

  let glslFunction =
    `${functionReturnType} ${functionName}(float batchId) \n` +
    `{ \n` +
    `    vec2 st = computeSt(batchId); \n` +
    `    st.x += batchTextureStep.x * float(${offset}); \n`;

  if (
    batchTable._packFloats &&
    attribute.componentDatatype !== PixelDatatype.UNSIGNED_BYTE
  ) {
    glslFunction +=
      "vec4 textureValue; \n" +
      "textureValue.x = czm_unpackFloat(texture(batchTexture, st)); \n" +
      "textureValue.y = czm_unpackFloat(texture(batchTexture, st + vec2(batchTextureStep.x, 0.0))); \n" +
      "textureValue.z = czm_unpackFloat(texture(batchTexture, st + vec2(batchTextureStep.x * 2.0, 0.0))); \n" +
      "textureValue.w = czm_unpackFloat(texture(batchTexture, st + vec2(batchTextureStep.x * 3.0, 0.0))); \n";
  } else {
    glslFunction += "    vec4 textureValue = texture(batchTexture, st); \n";
  }

  glslFunction += `    ${functionReturnType} value = textureValue${functionReturnValue}; \n`;

  if (
    batchTable._pixelDatatype === PixelDatatype.UNSIGNED_BYTE &&
    attribute.componentDatatype === ComponentDatatype.UNSIGNED_BYTE &&
    !attribute.normalize
  ) {
    glslFunction += "value *= 255.0; \n";
  } else if (
    batchTable._pixelDatatype === PixelDatatype.FLOAT &&
    attribute.componentDatatype === ComponentDatatype.UNSIGNED_BYTE &&
    attribute.normalize
  ) {
    glslFunction += "value /= 255.0; \n";
  }

  glslFunction += "    return value; \n" + "} \n";
  return glslFunction;
}

/**
 * 获取一个函数，用于更新顶点着色器以包含在批量表中查找值所需的函数。
 *
 * @returns {BatchTable.updateVertexShaderSourceCallback} A 用于更新顶点着色器源的回调函数。
 */
BatchTable.prototype.getVertexShaderCallback = function () {
  const attributes = this._attributes;
  if (attributes.length === 0) {
    return function (source) {
      return source;
    };
  }

  let batchTableShader = "uniform highp sampler2D batchTexture; \n";
  batchTableShader += `${getGlslComputeSt(this)}\n`;

  const length = attributes.length;
  for (let i = 0; i < length; ++i) {
    batchTableShader += getGlslAttributeFunction(this, i);
  }

  return function (source) {
    const mainIndex = source.indexOf("void main");
    const beforeMain = source.substring(0, mainIndex);
    const afterMain = source.substring(mainIndex);
    return `${beforeMain}\n${batchTableShader}\n${afterMain}`;
  };
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 true；否则返回 <code>false</code>。
 *
 * @see BatchTable#destroy
 */
BatchTable.prototype.isDestroyed = function () {
  return false;
};

/**
 * 会释放此对象所持有的 WebGL 资源。销毁对象可以使得 WebGL 资源被确定性地释放，而无需依赖垃圾收集器来销毁该对象。
 * 一旦对象被销毁，就不应再使用它；调用除
 * <br /><br />
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。因此，
 * 将返回值 (<code>undefined</code>) 赋给该对象，如示例中所示。
 * 表明对象已被销毁，即调用了 destroy() 方法。
 *
 * @exception {DeveloperError} This 用于更新统一映射的回调函数。
 *
 * @see BatchTable#isDestroyed
 */
BatchTable.prototype.destroy = function () {
  this._texture = this._texture && this._texture.destroy();
  return destroyObject(this);
};

/**
 * 用于更新统一映射的回调函数。
 * @callback BatchTable.updateUniformMapCallback
 *
 * @param {object} uniformMap 统一映射。
 * @returns {object} The 新的统一映射，包含用于从批次表中检索值的属性。
 */

/**
 * 用于更新顶点着色器源的回调函数。
 * @callback BatchTable.updateVertexShaderSourceCallback
 *
 * @param {string} vertexShaderSource 顶点着色器源。
 * @returns {string} The 新的顶点着色器源，其中注入了用于从批次表中检索值的函数。
 */
export default BatchTable;
