import { Check, DeveloperError, clone, defined } from "@cesium/core";

/**
 * 包含元数据的实体。
 * <p>
 * 此类型描述一个接口，不用于直接实例化。
 * </p>
 * <p>
 * 有关 3D Tiles 的详细信息，请参阅 {@link https://github.com/CesiumGS/3d-tiles/tree/main/extensions/3DTILES_metadata|3DTILES_metadata Extension}
 * </p>
 *
 * @alias MetadataEntity
 * @constructor
 *
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未定稿，可能会根据 Cesium 的标准弃用政策进行更改。
 */
function MetadataEntity() {}

Object.defineProperties(MetadataEntity.prototype, {
  /**
   * 属性所遵循的类。
   *
   * @memberof MetadataEntity.prototype
   * @type {MetadataClass}
   * @readonly
   * @private
   */
  class: {
    // eslint-disable-next-line getter-return
    get: function () {
      DeveloperError.throwInstantiationError();
    },
  },
});

/**
 * 返回实体是否具有该属性。
 *
 * @param {string} propertyId 属性的区分大小写的 ID。
 * @returns {boolean} Whether 实体具有该属性。
 * @private
 */
MetadataEntity.prototype.hasProperty = function (propertyId) {
  DeveloperError.throwInstantiationError();
};

/**
 * 返回实体是否具有给定语义的属性。
 *
 * @param {string} semantic 属性的区分大小写的语义。
 * @returns {boolean} Whether 实体具有给定语义的属性。
 * @private
 */
MetadataEntity.prototype.hasPropertyBySemantic = function (semantic) {
  DeveloperError.throwInstantiationError();
};

/**
 * 返回属性 ID 的数组。
 *
 * @param {string[]} [results] 用于存储结果的数组。
 * @returns {string[]} The 属性 ID。
 * @private
 */
MetadataEntity.prototype.getPropertyIds = function (results) {
  DeveloperError.throwInstantiationError();
};

/**
 * 返回具有给定 ID 的属性的值副本。
 * <p>
 * 如果属性已归一化，则返回归一化值。
 * </p>
 *
 * @param {string} propertyId 属性的区分大小写的 ID。
 * @returns {*} The 属性的值，或如果实体没有该属性则为 <code>undefined</code>。
 * @private
 */
MetadataEntity.prototype.getProperty = function (propertyId) {
  DeveloperError.throwInstantiationError();
};

/**
 * 设置具有给定 ID 的属性的值。
 * <p>
 * 如果属性已归一化，则必须向此函数提供归一化值。
 * </p>
 *
 * @param {string} propertyId 属性的区分大小写的 ID。
 * @param {*} value 将被复制的属性的值。
 * @returns {boolean} <code>true</code> 如果属性已被设置，则为 <code>false</code>，否则为否。
 * @private
 */
MetadataEntity.prototype.setProperty = function (propertyId, value) {
  DeveloperError.throwInstantiationError();
};

/**
 * 返回具有给定语义的属性的值副本。
 *
 * @param {string} semantic 属性的区分大小写的语义。
 * @returns {*} The 属性的值，或如果实体没有该属性则为 <code>undefined</code>。
 * @private
 */
MetadataEntity.prototype.getPropertyBySemantic = function (semantic) {
  DeveloperError.throwInstantiationError();
};

/**
 * 设置具有给定语义的属性的值。
 *
 * @param {string} semantic 属性的区分大小写的语义。
 * @param {*} value 将被复制的属性的值。
 * @returns {boolean} <code>true</code> 如果属性已被设置，则为 <code>false</code>，否则为否。
 * @private
 */
MetadataEntity.prototype.setPropertyBySemantic = function (semantic, value) {
  DeveloperError.throwInstantiationError();
};

/**
 * 返回实体是否具有该属性。
 *
 * @param {string} propertyId 属性的区分大小写的 ID。
 * @param {object} properties 包含属性的字典。
 * @param {MetadataClass} classDefinition 类。
 * @returns {boolean} Whether 实体具有该属性。
 *
 * @private
 */
MetadataEntity.hasProperty = function (
  propertyId,
  properties,
  classDefinition,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("propertyId", propertyId);
  Check.typeOf.object("properties", properties);
  Check.typeOf.object("classDefinition", classDefinition);
  //>>includeEnd('debug');

  if (defined(properties[propertyId])) {
    return true;
  }

  const classProperties = classDefinition.properties;
  if (!defined(classProperties)) {
    return false;
  }

  const classProperty = classProperties[propertyId];
  if (defined(classProperty) && defined(classProperty.default)) {
    return true;
  }

  return false;
};

/**
 * 返回实体是否具有给定语义的属性。
 *
 * @param {string} semantic 属性的区分大小写的语义。
 * @param {object} properties 包含属性的字典。
 * @param {MetadataClass} classDefinition 类。
 * @returns {boolean} Whether 实体具有给定语义的属性。
 *
 * @private
 */
MetadataEntity.hasPropertyBySemantic = function (
  semantic,
  properties,
  classDefinition,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("semantic", semantic);
  Check.typeOf.object("properties", properties);
  Check.typeOf.object("classDefinition", classDefinition);
  //>>includeEnd('debug');

  const propertiesBySemantic = classDefinition.propertiesBySemantic;
  if (!defined(propertiesBySemantic)) {
    return false;
  }

  const property = propertiesBySemantic[semantic];
  return defined(property);
};

/**
 * 返回属性 ID 的数组。
 *
 * @param {object} properties 包含属性的字典。
 * @param {MetadataClass} classDefinition 类。
 * @param {string[]} [results] 用于存储结果的数组。
 * @returns {string[]} The 属性 ID。
 *
 * @private
 */
MetadataEntity.getPropertyIds = function (
  properties,
  classDefinition,
  results,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("properties", properties);
  Check.typeOf.object("classDefinition", classDefinition);
  //>>includeEnd('debug');

  results = defined(results) ? results : [];
  results.length = 0;

  // Add entity properties
  for (const propertyId in properties) {
    if (
      properties.hasOwnProperty(propertyId) &&
      defined(properties[propertyId])
    ) {
      results.push(propertyId);
    }
  }

  // Add default properties
  const classProperties = classDefinition.properties;
  if (defined(classProperties)) {
    for (const classPropertyId in classProperties) {
      if (
        classProperties.hasOwnProperty(classPropertyId) &&
        !defined(properties[classPropertyId]) &&
        defined(classProperties[classPropertyId].default)
      ) {
        results.push(classPropertyId);
      }
    }
  }

  return results;
};

/**
 * 返回具有给定 ID 的属性的值副本。
 * <p>
 * 如果属性已归一化，则返回归一化值。
 * </p>
 *
 * @param {string} propertyId 属性的区分大小写的 ID。
 * @param {object} properties 包含属性的字典。
 * @param {MetadataClass} classDefinition 类。
 * @returns {*} The 该属性的值，如果实体没有该属性则返回 <code>undefined</code>。
 *
 * @private
 */
MetadataEntity.getProperty = function (
  propertyId,
  properties,
  classDefinition,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("propertyId", propertyId);
  Check.typeOf.object("properties", properties);
  Check.typeOf.object("classDefinition", classDefinition);

  if (!defined(classDefinition.properties[propertyId])) {
    throw new DeveloperError(`Class definition missing property ${propertyId}`);
  }
  //>>includeEnd('debug');

  const classProperty = classDefinition.properties[propertyId];
  let value = properties[propertyId];

  // Clone array values
  if (Array.isArray(value)) {
    value = value.slice();
  }

  // Arrays of vectors are represented as nested arrays in JSON
  const enableNestedArrays = true;

  // Handle noData and default
  value = classProperty.handleNoData(value);
  if (!defined(value) && defined(classProperty.default)) {
    value = clone(classProperty.default, true);
    return classProperty.unpackVectorAndMatrixTypes(value, enableNestedArrays);
  }

  if (!defined(value)) {
    return undefined;
  }

  value = classProperty.normalize(value);
  value = classProperty.applyValueTransform(value);
  return classProperty.unpackVectorAndMatrixTypes(value, enableNestedArrays);
};

/**
 * 设置具有给定 ID 的属性值。
 * <p>
 * 如果属性已归一化，则必须向此函数提供归一化值。
 * </p>
 *
 * @param {string} propertyId 属性的区分大小写的 ID。
 * @param {*} value 将被复制的属性值。
 * @param {object} properties 包含属性的字典。
 * @param {MetadataClass} classDefinition 类。
 * @returns {boolean} <code>true</code> 如果属性已设置，则返回 <code>false</code>，否则返回 <code>true</code>。
 *
 * @private
 */
MetadataEntity.setProperty = function (
  propertyId,
  value,
  properties,
  classDefinition,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("propertyId", propertyId);
  Check.defined("value", value);
  Check.typeOf.object("properties", properties);
  Check.typeOf.object("classDefinition", classDefinition);
  //>>includeEnd('debug');

  if (!defined(properties[propertyId])) {
    return false;
  }

  if (Array.isArray(value)) {
    value = value.slice(); // clone
  }

  let classProperty;
  const classProperties = classDefinition.properties;
  if (defined(classProperties)) {
    classProperty = classProperties[propertyId];
  }

  // arrays of vectors are represented as nested arrays in JSON
  const enableNestedArrays = true;
  if (defined(classProperty)) {
    value = classProperty.packVectorAndMatrixTypes(value, enableNestedArrays);
    value = classProperty.unapplyValueTransform(value);
    value = classProperty.unnormalize(value);
  }

  properties[propertyId] = value;
  return true;
};

/**
 * 返回具有给定语义的属性值的副本。
 *
 * @param {string} semantic 属性的区分大小写的语义。
 * @param {object} properties 包含属性的字典。
 * @param {MetadataClass} classDefinition 类。
 * @returns {*} The 该属性的值，如果实体没有该属性则返回 <code>undefined</code>。
 *
 * @private
 */
MetadataEntity.getPropertyBySemantic = function (
  semantic,
  properties,
  classDefinition,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("semantic", semantic);
  Check.typeOf.object("properties", properties);
  Check.typeOf.object("classDefinition", classDefinition);
  //>>includeEnd('debug');

  const propertiesBySemantic = classDefinition.propertiesBySemantic;
  if (!defined(propertiesBySemantic)) {
    return undefined;
  }

  const property = propertiesBySemantic[semantic];
  if (defined(property)) {
    return MetadataEntity.getProperty(property.id, properties, classDefinition);
  }
  return undefined;
};

/**
 * 设置具有给定语义的属性值。
 *
 * @param {string} semantic 属性的区分大小写的语义。
 * @param {*} value 将被复制的属性值。
 * @param {object} properties 包含属性的字典。
 * @param {MetadataClass} classDefinition 类。
 * @returns {boolean} <code>true</code> 如果属性已设置，则返回 <code>false</code>，否则返回 <code>true</code>。
 * @private
 */
MetadataEntity.setPropertyBySemantic = function (
  semantic,
  value,
  properties,
  classDefinition,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("semantic", semantic);
  Check.defined("value", value);
  Check.typeOf.object("properties", properties);
  Check.typeOf.object("classDefinition", classDefinition);
  //>>includeEnd('debug');

  const propertiesBySemantic = classDefinition.propertiesBySemantic;
  if (!defined(propertiesBySemantic)) {
    return false;
  }

  const property = classDefinition.propertiesBySemantic[semantic];
  if (defined(property)) {
    return MetadataEntity.setProperty(
      property.id,
      value,
      properties,
      classDefinition,
    );
  }

  return false;
};

export default MetadataEntity;
