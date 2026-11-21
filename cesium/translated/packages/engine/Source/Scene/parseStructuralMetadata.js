import {
  Check,
  Frozen,
  PixelDatatype,
  PixelFormat,
  RuntimeError,
  defined,
  oneTimeWarning,
} from "@cesium/core";
import PropertyTable from "./PropertyTable.js";
import PropertyTexture from "./PropertyTexture.js";
import PropertyAttribute from "./PropertyAttribute.js";
import StructuralMetadata from "./StructuralMetadata.js";
import MetadataTable from "./MetadataTable.js";
import Sampler from "../Renderer/Sampler.js";
import Texture from "../Renderer/Texture.js";
import TextureWrap from "../Renderer/TextureWrap.js";
import TextureMagnificationFilter from "../Renderer/TextureMagnificationFilter.js";
import TextureMinificationFilter from "../Renderer/TextureMinificationFilter.js";
import ContextLimits from "../Renderer/ContextLimits.js";
import MetadataComponentType from "./MetadataComponentType.js";
import MetadataType from "./MetadataType.js";

/**
 * 解析 <code>EXT_structural_metadata</code> glTF 扩展以创建
 * 结构元数据对象。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.extension 扩展 JSON 对象。
 * @param {MetadataSchema} options.schema 解析后的模式。
 * @param {Object<string, Uint8Array>} [options.bufferViews] 将 bufferView ID 映射到 Uint8Array 对象的对象。
 * @param {Object<string, Texture>} [options.textures] 将 texture ID 映射到 {@link Texture} 对象的对象。
 * @param {Context} [options.context] 当前渲染上下文。
 * @return {StructuralMetadata} A 结构元数据对象
 * @private
 * @experimental This 该功能使用了 3D Tiles 规范中的部分内容，该规范尚未最终定稿，且可能根据 Cesium 的标准弃用政策进行更改。
 */
function parseStructuralMetadata(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const extension = options.extension;

  // The calling code is responsible for loading the schema.
  // This keeps metadata parsing synchronous.
  const schema = options.schema;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.extension", extension);
  Check.typeOf.object("options.schema", schema);
  //>>includeEnd('debug');

  const propertyTables = [];
  if (defined(extension.propertyTables)) {
    for (let i = 0; i < extension.propertyTables.length; i++) {
      const propertyTable = extension.propertyTables[i];
      const classDefinition = schema.classes[propertyTable.class];
      const propertyTableTexture = createTextureForPropertyTable(
        propertyTable,
        options.bufferViews,
        classDefinition,
        options.context,
      );

      const metadataTable = new MetadataTable({
        count: propertyTable.count,
        properties: propertyTable.properties,
        class: classDefinition,
        bufferViews: options.bufferViews,
      });

      propertyTables.push(
        new PropertyTable({
          id: i,
          name: propertyTable.name,
          count: propertyTable.count,
          metadataTable: metadataTable,
          extras: propertyTable.extras,
          extensions: propertyTable.extensions,
          texture: propertyTableTexture,
        }),
      );
    }
  }

  const propertyTextures = [];
  if (defined(extension.propertyTextures)) {
    for (let i = 0; i < extension.propertyTextures.length; i++) {
      const propertyTexture = extension.propertyTextures[i];
      propertyTextures.push(
        new PropertyTexture({
          id: i,
          name: propertyTexture.name,
          propertyTexture: propertyTexture,
          class: schema.classes[propertyTexture.class],
          textures: options.textures,
        }),
      );
    }
  }

  const propertyAttributes = [];
  if (defined(extension.propertyAttributes)) {
    for (let i = 0; i < extension.propertyAttributes.length; i++) {
      const propertyAttribute = extension.propertyAttributes[i];
      propertyAttributes.push(
        new PropertyAttribute({
          id: i,
          name: propertyAttribute.name,
          class: schema.classes[propertyAttribute.class],
          propertyAttribute: propertyAttribute,
        }),
      );
    }
  }

  return new StructuralMetadata({
    schema: schema,
    propertyTables: propertyTables,
    propertyTextures: propertyTextures,
    propertyAttributes: propertyAttributes,
    statistics: extension.statistics,
    extras: extension.extras,
    extensions: extension.extensions,
  });
}

// Always use four channels for property table textures.
const NUM_CHANNELS = 4;

/**
 * 根据属性表属性（与 GPU 兼容的属性）创建纹理。
 * 属性值以线性方式打包在 2D RGBA8 纹理中。
 *
 * @param {PropertyTable} propertyTable 属性表。
 * @param {Object<string, Uint8Array>} bufferViews 为给定属性表将 bufferView ID 映射到 Uint8Array 对象的对象。
 * @param {MetadataClass} classDefinition 模式中定义的类
 * @param {Context} context 渲染上下文。
 * @returns {Texture|undefined} The 创建的纹理，如果没有与 GPU 兼容的属性，则值为 <code>undefined</code>。
 *
 * @private
 */
function createTextureForPropertyTable(
  propertyTable,
  bufferViews,
  classDefinition,
  context,
) {
  const properties = propertyTable.properties;
  if (!defined(properties)) {
    return undefined;
  }

  const numFeatures = propertyTable.count;

  let gpuCompatiblePropertyInfo;
  try {
    gpuCompatiblePropertyInfo = collectGpuCompatiblePropertyInfo(
      properties,
      bufferViews,
      classDefinition,
      numFeatures,
    );
  } catch (error) {
    console.warn(
      `Failed to create texture for property table "${propertyTable.name}": ${error.message}`,
    );
    return undefined;
  }

  const numGpuCompatibleProperties = gpuCompatiblePropertyInfo.length;

  if (numGpuCompatibleProperties === 0) {
    return undefined;
  }

  if (numFeatures === 0) {
    return undefined;
  }

  const maxTextureSize = ContextLimits.maximumTextureSize;
  const textureWidth = Math.min(numFeatures, maxTextureSize);
  const totalTexels = numGpuCompatibleProperties * numFeatures;
  const textureHeight = Math.ceil(totalTexels / textureWidth);

  if (textureHeight > maxTextureSize) {
    oneTimeWarning(
      "PropertyTableTextureExceedsMaximumSize",
      `Cannot create a texture for the property table "${propertyTable.name}" because it exceeds the maximum texture size of ${ContextLimits.maximumTextureSize}.`,
    );
    return undefined;
  }

  const packedBufferView = packPropertyTablePropertiesIntoRGBA8(
    gpuCompatiblePropertyInfo,
    numFeatures,
    textureWidth,
    textureHeight,
  );

  // Create a sampler fit for sampling raw data without mipmapping / filtering etc.
  const sampler = new Sampler({
    wrapS: TextureWrap.CLAMP_TO_EDGE,
    wrapT: TextureWrap.CLAMP_TO_EDGE,
    minificationFilter: TextureMinificationFilter.NEAREST,
    magnificationFilter: TextureMagnificationFilter.NEAREST,
  });

  return Texture.create({
    context: context,
    pixelFormat: PixelFormat.RGBA,
    pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
    sampler: sampler,
    flipY: false,
    source: {
      width: textureWidth,
      height: textureHeight,
      arrayBufferView: packedBufferView,
    },
  });
}

function collectGpuCompatiblePropertyInfo(
  properties,
  bufferViews,
  classDefinition,
  numFeatures,
) {
  const propertyInfos = [];
  const classProperties = classDefinition.properties;

  // It's possible for a primitive in a tileset to only use a subset of the class properties defined in the schema.
  // For instance, the Design Tiler merges classes together by default, and omits properties in primitives that aren't used.
  // To make the default values available to the GPU, and to avoid compiling different versions of the shader for each primitive,
  // we iterate over _all_ class properties here - not just the properties in the property table.
  for (const [propertyId, classProperty] of Object.entries(classProperties)) {
    // Certain properties like strings, dynamic-sized arrays, and 64-bit types cannot be represented natively on the GPU.
    if (!classProperty.isGpuCompatible(NUM_CHANNELS)) {
      continue;
    }

    const property = properties[propertyId];
    const bufferView = defined(property)
      ? bufferViews[property.values]
      : createNoDataBufferView(classProperty, numFeatures);

    const bufferViewLength = bufferView.length;
    const bytesPerElement = classProperty.cpuBytesPerElement();
    const numBufferElements = bufferViewLength / bytesPerElement;
    if (numBufferElements !== numFeatures) {
      throw new RuntimeError(
        `Property with ID: "${propertyId}" has (${numBufferElements}), which does not match number of features in the property table: (${numFeatures}).`,
      );
    }

    propertyInfos.push({
      view: bufferView,
      classProperty: classProperty,
    });
  }

  return propertyInfos;
}

/**
 * 当某个属性属于 tileset 类模式但在属性表中未使用时，
 * 我们会创建一个填充有该属性 noData 值的 buffer view。
 *
 * @param {MetadataClassProperty} classProperty 类属性定义。
 * @param {number} numFeatures 属性表中的特征数量。
 *
 * @returns {Uint8Array} A 填充有该属性 noData 值的 buffer view。
 *
 * @private
 */
function createNoDataBufferView(classProperty, numFeatures) {
  // noData can be a number, an array of numbers (e.g. for vecN types), or a nested array of numbers (e.g. for arrays of vecN types).
  let noData = classProperty.noData;
  const metadataComponentCount = MetadataType.getComponentCount(
    classProperty.type,
  );
  const metadataArrayLength = classProperty.isArray
    ? classProperty.arrayLength
    : 1;

  // Special case: noData enum values are specified as strings, so we need to convert them to numbers here.
  if (classProperty.type === MetadataType.ENUM) {
    const enumDefinition = classProperty.enumType;
    noData = enumDefinition.valuesByName[noData];
  }

  // Wrap noData in an array (up to two times) so we can treat it uniformly in the loop below.
  if (metadataComponentCount === 1) {
    noData = [noData];
  }

  if (metadataArrayLength === 1) {
    noData = [noData];
  }

  const bytesPerElement = classProperty.cpuBytesPerElement();
  const bytesPerComponent = MetadataComponentType.getSizeInBytes(
    classProperty.valueType,
  );
  const buffer = new ArrayBuffer(bytesPerElement * numFeatures);
  const view = new DataView(buffer);
  const accessors = MetadataComponentType.getDataViewAccessors(
    view,
    classProperty.valueType,
  );

  for (let i = 0; i < numFeatures; i++) {
    for (let j = 0; j < metadataArrayLength; j++) {
      for (let k = 0; k < metadataComponentCount; k++) {
        const componentIdx = j * metadataComponentCount + k;
        accessors.set(
          bytesPerElement * i + componentIdx * bytesPerComponent,
          noData[j][k],
        );
      }
    }
  }

  return new Uint8Array(buffer);
}

// Make one big buffer view to load into the texture
// Since each texel is always 4 bytes (RGBA8 format), elements less than 4 bytes need to be padded (respecting little-endian order).
// Exception: single-component 64-bit types can be downcast to 32-bit for GPU compatibility (with potential loss of precision / range).
function packPropertyTablePropertiesIntoRGBA8(
  propertyInfos,
  numFeatures,
  textureWidth,
  textureHeight,
) {
  const numGpuCompatibleProperties = propertyInfos.length;
  const packedBufferView = new Uint8Array(
    textureWidth * textureHeight * NUM_CHANNELS,
  );
  const packedDataView = new DataView(
    packedBufferView.buffer,
    packedBufferView.byteOffset,
    packedBufferView.byteLength,
  );

  for (
    let propertyIndex = 0;
    propertyIndex < numGpuCompatibleProperties;
    propertyIndex++
  ) {
    const propertyInfo = propertyInfos[propertyIndex];
    const classProperty = propertyInfo.classProperty;
    const propertyLinearTexelOffset = propertyIndex * numFeatures;
    const sourceType = classProperty.valueType;
    const packedType = MetadataComponentType.gpuComponentType(sourceType);

    // E.g. When the source component type is INT64, we first downcast each element to INT32 before packing into the GPU buffer.
    if (sourceType !== packedType) {
      downcastAndPackProperty(
        propertyInfo,
        packedDataView,
        propertyLinearTexelOffset,
      );
      continue;
    }

    packProperty(propertyInfo, packedBufferView, propertyLinearTexelOffset);
  }

  return packedBufferView;
}

function packProperty(
  propertyInfo,
  packedBufferView,
  propertyLinearTexelOffset,
) {
  const bufferView = propertyInfo.view;
  const bytesPerElement = propertyInfo.classProperty.cpuBytesPerElement();
  const numElements = bufferView.length / bytesPerElement;

  for (let elementIndex = 0; elementIndex < numElements; elementIndex++) {
    const sourceOffset = elementIndex * bytesPerElement;
    const destinationOffset =
      (propertyLinearTexelOffset + elementIndex) * NUM_CHANNELS;

    packedBufferView.set(
      bufferView.subarray(sourceOffset, sourceOffset + bytesPerElement),
      destinationOffset,
    );
  }
}

// This is the slow path - rather than doing a straight copy, we need to interpret and downcast each element before packing it into the GPU buffer.
// Note: this function does not handle properties with multiple components per element (or arrays). While not complete, this is OK because
// multi-component properties with 64-bit types - even when downcast to 32 bits - cannot fit into a single RGBA8 texel.
function downcastAndPackProperty(
  propertyInfo,
  packedDataView,
  propertyLinearTexelOffset,
) {
  const classProperty = propertyInfo.classProperty;
  const bufferView = propertyInfo.view;
  const sourceType = classProperty.valueType;
  const packedType = MetadataComponentType.gpuComponentType(sourceType);

  const bytesPerElement = classProperty.cpuBytesPerElement();
  const numElements = bufferView.length / bytesPerElement;

  const sourceDataView = new DataView(
    bufferView.buffer,
    bufferView.byteOffset,
    bufferView.byteLength,
  );
  const sourceAccessors = MetadataComponentType.getDataViewAccessors(
    sourceDataView,
    sourceType,
  );
  const packedAccessors = MetadataComponentType.getDataViewAccessors(
    packedDataView,
    packedType,
  );

  const downcastFunction = MetadataComponentType.downcastFunction(sourceType);

  for (let elementIndex = 0; elementIndex < numElements; elementIndex++) {
    const sourceElementOffset = elementIndex * bytesPerElement;
    const destinationElementOffset =
      (propertyLinearTexelOffset + elementIndex) * NUM_CHANNELS;

    const value = sourceAccessors.get(sourceElementOffset);
    packedAccessors.set(destinationElementOffset, downcastFunction(value));
  }
}

export default parseStructuralMetadata;
