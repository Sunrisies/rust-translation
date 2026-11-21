import {
  Check,
  ComponentDatatype,
  DeveloperError,
  RuntimeError,
  defined,
  deprecationWarning,
  oneTimeWarning,
} from "@cesium/core";
import BatchTableHierarchy from "./BatchTableHierarchy.js";
import StructuralMetadata from "./StructuralMetadata.js";
import PropertyAttribute from "./PropertyAttribute.js";
import PropertyTable from "./PropertyTable.js";
import getBinaryAccessor from "./getBinaryAccessor.js";
import JsonMetadataTable from "./JsonMetadataTable.js";
import MetadataClass from "./MetadataClass.js";
import MetadataSchema from "./MetadataSchema.js";
import MetadataTable from "./MetadataTable.js";
import ModelComponents from "./ModelComponents.js";
import ModelUtility from "./Model/ModelUtility.js";

/**
 * 一个解析 3D Tiles 1.0 批表并将其转换为
 * 与 <code>EXT_structural_metadata</code> glTF 扩展中的结构元数据兼容的对象
 * <p>
 * 有关 glTF 的信息，请参见 {@link https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_structural_metadata|EXT_structural_metadata Extension}
 * </p>
 *
 * @param {object} options 具有以下属性的对象：
 * @param {number} options.count 批表中的特征数量。
 * @param {object} options.batchTable 批表 JSON 数据
 * @param {Uint8Array} [options.binaryBody] 批表二进制体
 * @param {boolean} [options.parseAsPropertyAttributes=false] 如果为 true，则将二进制属性解析为属性属性，而不是属性表。此选项用于 GPU 样式处理的 .pnts 模型。
 * @param {ModelComponents.Attribute[]} [options.customAttributeOutput] 在此传入空数组，该方法将填充一个自定义属性列表，用于存储属性属性的值。这些属性将使用类型化数组创建，调用者负责将其上传到 GPU。当 options.parseAsPropertyAttributes 为 true 时，此选项是必需的。
 * @return {StructuralMetadata} A 转换后的结构元数据对象
 *
 * @private
 * @experimental This 该特征使用了 3D Tiles 规范中尚未定稿且可能随 Cesium 标准弃用政策而变更的部分内容。
 */
function parseBatchTable(options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("options.count", options.count);
  Check.typeOf.object("options.batchTable", options.batchTable);
  //>>includeEnd('debug');

  const featureCount = options.count;
  const batchTable = options.batchTable;
  const binaryBody = options.binaryBody;
  const parseAsPropertyAttributes = options.parseAsPropertyAttributes ?? false;
  const customAttributeOutput = options.customAttributeOutput;

  //>>includeStart('debug', pragmas.debug);
  if (parseAsPropertyAttributes && !defined(customAttributeOutput)) {
    throw new DeveloperError(
      "customAttributeOutput is required when parsing batch table as property attributes",
    );
  }
  //>>includeEnd('debug');

  // divide properties into binary, json and hierarchy
  const partitionResults = partitionProperties(batchTable);

  let jsonMetadataTable;
  if (defined(partitionResults.jsonProperties)) {
    jsonMetadataTable = new JsonMetadataTable({
      count: featureCount,
      properties: partitionResults.jsonProperties,
    });
  }

  let hierarchy;
  if (defined(partitionResults.hierarchy)) {
    hierarchy = new BatchTableHierarchy({
      extension: partitionResults.hierarchy,
      binaryBody: binaryBody,
    });
  }

  const className = MetadataClass.BATCH_TABLE_CLASS_NAME;
  const binaryProperties = partitionResults.binaryProperties;

  let metadataTable;
  let propertyAttributes;
  let transcodedSchema;
  if (parseAsPropertyAttributes) {
    const attributeResults = transcodeBinaryPropertiesAsPropertyAttributes(
      featureCount,
      className,
      binaryProperties,
      binaryBody,
      customAttributeOutput,
    );
    transcodedSchema = attributeResults.transcodedSchema;
    const propertyAttribute = new PropertyAttribute({
      propertyAttribute: attributeResults.propertyAttributeJson,
      class: attributeResults.transcodedClass,
    });

    propertyAttributes = [propertyAttribute];
  } else {
    const binaryResults = transcodeBinaryProperties(
      featureCount,
      className,
      binaryProperties,
      binaryBody,
    );
    transcodedSchema = binaryResults.transcodedSchema;
    const featureTableJson = binaryResults.featureTableJson;
    metadataTable = new MetadataTable({
      count: featureTableJson.count,
      properties: featureTableJson.properties,
      class: binaryResults.transcodedClass,
      bufferViews: binaryResults.bufferViewsTypedArrays,
    });
    propertyAttributes = [];
  }

  const propertyTables = [];
  if (
    defined(metadataTable) ||
    defined(jsonMetadataTable) ||
    defined(hierarchy)
  ) {
    const propertyTable = new PropertyTable({
      id: 0,
      name: "Batch Table",
      count: featureCount,
      metadataTable: metadataTable,
      jsonMetadataTable: jsonMetadataTable,
      batchTableHierarchy: hierarchy,
    });
    propertyTables.push(propertyTable);
  }

  const metadataOptions = {
    schema: transcodedSchema,
    propertyTables: propertyTables,
    propertyAttributes: propertyAttributes,
    extensions: partitionResults.extensions,
    extras: partitionResults.extras,
  };

  return new StructuralMetadata(metadataOptions);
}

/**
 * 将批表的属性分为二进制、JSON 和层次结构形式
 * 作为各自独立的扩展处理
 *
 * @param {object} batchTable 批表 JSON 数据
 * @returns {object} The 批表被分为二进制、JSON 和层次结构部分。额外内容和扩展也被分离出来以便于处理。
 *
 * @private
 */
function partitionProperties(batchTable) {
  const legacyHierarchy = batchTable.HIERARCHY;
  const extras = batchTable.extras;
  const extensions = batchTable.extensions;

  let hierarchyExtension;
  if (defined(legacyHierarchy)) {
    parseBatchTable._deprecationWarning(
      "batchTableHierarchyExtension",
      "The batch table HIERARCHY property has been moved to an extension. Use extensions.3DTILES_batch_table_hierarchy instead.",
    );
    hierarchyExtension = legacyHierarchy;
  } else if (defined(extensions)) {
    hierarchyExtension = extensions["3DTILES_batch_table_hierarchy"];
  }

  // A JsonMetadataTable is only allocated as needed.
  let jsonProperties;
  // A MetadataTable or PropertyAttribute will always be created, even if
  // there are no properties.
  const binaryProperties = {};
  for (const propertyId in batchTable) {
    if (
      !batchTable.hasOwnProperty(propertyId) ||
      // these cases were handled above;
      propertyId === "HIERARCHY" ||
      propertyId === "extensions" ||
      propertyId === "extras"
    ) {
      continue;
    }

    const property = batchTable[propertyId];
    if (Array.isArray(property)) {
      jsonProperties = defined(jsonProperties) ? jsonProperties : {};
      jsonProperties[propertyId] = property;
    } else {
      binaryProperties[propertyId] = property;
    }
  }

  return {
    binaryProperties: binaryProperties,
    jsonProperties: jsonProperties,
    hierarchy: hierarchyExtension,
    extras: extras,
    extensions: extensions,
  };
}

/**
 * 将批表的二进制属性转换为与
 * <code>EXT_structural_metadata</code>
 *
 * @param {number} featureCount 批表中的特征数量
 * @param {string} className 要创建的元数据类名称。
 * @param {Object<string, Object>} binaryProperties 属性 ID 到属性定义的字典
 * @param {Uint8Array} [binaryBody] 批表的二进制体
 * @return {object} Transcoded 构建 {@link StructuralMetadata} 对象所需的数据。
 *
 * @private
 */
function transcodeBinaryProperties(
  featureCount,
  className,
  binaryProperties,
  binaryBody,
) {
  const classProperties = {};
  const featureTableProperties = {};
  const bufferViewsTypedArrays = {};
  let bufferViewCount = 0;
  for (const propertyId in binaryProperties) {
    if (!binaryProperties.hasOwnProperty(propertyId)) {
      continue;
    }

    if (!defined(binaryBody)) {
      throw new RuntimeError(
        `Property ${propertyId} requires a batch table binary.`,
      );
    }

    const property = binaryProperties[propertyId];
    const binaryAccessor = getBinaryAccessor(property);

    featureTableProperties[propertyId] = {
      bufferView: bufferViewCount,
    };

    classProperties[propertyId] = transcodePropertyType(property);

    bufferViewsTypedArrays[bufferViewCount] =
      binaryAccessor.createArrayBufferView(
        binaryBody.buffer,
        binaryBody.byteOffset + property.byteOffset,
        featureCount,
      );

    bufferViewCount++;
  }

  const schemaJson = {
    classes: {},
  };
  schemaJson.classes[className] = {
    properties: classProperties,
  };

  const transcodedSchema = MetadataSchema.fromJson(schemaJson);

  const featureTableJson = {
    class: className,
    count: featureCount,
    properties: featureTableProperties,
  };

  return {
    featureTableJson: featureTableJson,
    bufferViewsTypedArrays: bufferViewsTypedArrays,
    transcodedSchema: transcodedSchema,
    transcodedClass: transcodedSchema.classes[className],
  };
}

function transcodeBinaryPropertiesAsPropertyAttributes(
  featureCount,
  className,
  binaryProperties,
  binaryBody,
  customAttributeOutput,
) {
  const classProperties = {};
  const propertyAttributeProperties = {};
  let nextPlaceholderId = 0;

  for (const propertyId in binaryProperties) {
    if (!binaryProperties.hasOwnProperty(propertyId)) {
      continue;
    }

    // For draco-compressed attributes from .pnts files, the results will be
    // stored in separate typed arrays. These will be used in place of the
    // binary body
    const property = binaryProperties[propertyId];
    if (!defined(binaryBody) && !defined(property.typedArray)) {
      throw new RuntimeError(
        `Property ${propertyId} requires a batch table binary.`,
      );
    }

    let sanitizedPropertyId = ModelUtility.sanitizeGlslIdentifier(propertyId);

    // If the sanitized string is empty or a duplicate, use a placeholder
    // name instead. This will work for styling, but it may lead to undefined
    // behavior in CustomShader, since
    // - different tiles may pick a different placeholder ID due to the
    //    collection being unordered
    // - different tiles may have different number of properties.
    if (
      sanitizedPropertyId === "" ||
      classProperties.hasOwnProperty(sanitizedPropertyId)
    ) {
      sanitizedPropertyId = `property_${nextPlaceholderId}`;
      nextPlaceholderId++;
    }

    const classProperty = transcodePropertyType(property);
    classProperty.name = propertyId;
    classProperties[sanitizedPropertyId] = classProperty;

    // Extract the typed array and create a custom attribute as a typed array.
    // The caller must add the results to the ModelComponents, and upload the
    // typed array to the GPU. The attribute name is converted to all capitals
    // and underscores, like a glTF custom attribute.
    //
    // For example, if the original property ID was 'Temperature ℃', the result
    // is _TEMPERATURE
    let customAttributeName = sanitizedPropertyId.toUpperCase();
    if (!customAttributeName.startsWith("_")) {
      customAttributeName = `_${customAttributeName}`;
    }

    // for .pnts with draco compression, property.typedArray is used
    // instead of the binary body.
    let attributeTypedArray = property.typedArray;
    if (!defined(attributeTypedArray)) {
      const binaryAccessor = getBinaryAccessor(property);
      attributeTypedArray = binaryAccessor.createArrayBufferView(
        binaryBody.buffer,
        binaryBody.byteOffset + property.byteOffset,
        featureCount,
      );
    }

    const attribute = new ModelComponents.Attribute();
    attribute.name = customAttributeName;
    attribute.count = featureCount;
    attribute.type = property.type;
    const componentDatatype =
      ComponentDatatype.fromTypedArray(attributeTypedArray);
    if (
      componentDatatype === ComponentDatatype.INT ||
      componentDatatype === ComponentDatatype.UNSIGNED_INT ||
      componentDatatype === ComponentDatatype.DOUBLE
    ) {
      parseBatchTable._oneTimeWarning(
        "Cast pnts property to floats",
        `Point cloud property "${customAttributeName}" will be cast to a float array because INT, UNSIGNED_INT, and DOUBLE are not valid WebGL vertex attribute types. Some precision may be lost.`,
      );
      attributeTypedArray = new Float32Array(attributeTypedArray);
    }
    attribute.componentDatatype =
      ComponentDatatype.fromTypedArray(attributeTypedArray);
    attribute.typedArray = attributeTypedArray;
    customAttributeOutput.push(attribute);

    // Refer to the custom attribute name from the property attribute
    propertyAttributeProperties[sanitizedPropertyId] = {
      attribute: customAttributeName,
    };
  }

  const schemaJson = {
    classes: {},
  };
  schemaJson.classes[className] = {
    properties: classProperties,
  };

  const transcodedSchema = MetadataSchema.fromJson(schemaJson);

  const propertyAttributeJson = {
    properties: propertyAttributeProperties,
  };

  return {
    class: className,
    propertyAttributeJson: propertyAttributeJson,
    transcodedSchema: transcodedSchema,
    transcodedClass: transcodedSchema.classes[className],
  };
}

/**
 * 根据批表中的属性定义，计算等效的
 * <code>EXT_structural_metadata</code> 类型定义
 *
 * @param {object} property 批表属性定义
 * @return {object} The 对应的结构元数据属性定义
 * @private
 */
function transcodePropertyType(property) {
  const componentType = transcodeComponentType(property.componentType);

  return {
    type: property.type,
    componentType: componentType,
  };
}

/**
 * 将批表属性的组件类型转换为对应的
 * 与结构元数据使用的类型
 *
 * @property {string} componentType 批表的组件类型
 * @return {string} The 对应的结构元数据数据类型
 *
 * @private
 */
function transcodeComponentType(componentType) {
  switch (componentType) {
    case "BYTE":
      return "INT8";
    case "UNSIGNED_BYTE":
      return "UINT8";
    case "SHORT":
      return "INT16";
    case "UNSIGNED_SHORT":
      return "UINT16";
    case "INT":
      return "INT32";
    case "UNSIGNED_INT":
      return "UINT32";
    case "FLOAT":
      return "FLOAT32";
    case "DOUBLE":
      return "FLOAT64";
  }
}

// exposed for testing
parseBatchTable._deprecationWarning = deprecationWarning;
parseBatchTable._oneTimeWarning = oneTimeWarning;

export default parseBatchTable;
