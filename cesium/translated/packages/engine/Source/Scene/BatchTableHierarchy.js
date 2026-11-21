import {
  AttributeType,
  Check,
  ComponentDatatype,
  DeveloperError,
  clone,
  combine,
  defined,
} from "@cesium/core";
import getBinaryAccessor from "./getBinaryAccessor.js";
import Cesium3DTileBatchTable from "./Cesium3DTileBatchTable.js";

/**
 * 用于处理 <code>3DTILES_batch_table_hierarchy</code> 扩展的对象
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.extension <code>3DTILES_batch_table_hierarchy</code> 扩展对象。
 * @param {Uint8Array} [options.binaryBody] 批处理表的二进制体
 *
 * @alias BatchTableHierarchy
 * @constructor
 *
 * @private
 */
function BatchTableHierarchy(options) {
  this._classes = undefined;
  this._classIds = undefined;
  this._classIndexes = undefined;
  this._parentCounts = undefined;
  this._parentIndexes = undefined;
  this._parentIds = undefined;

  // Total memory used by the typed arrays
  this._byteLength = 0;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.extension", options.extension);
  //>>includeEnd('debug');

  initialize(this, options.extension, options.binaryBody);

  //>>includeStart('debug', pragmas.debug);
  validateHierarchy(this);
  //>>includeEnd('debug');
}

Object.defineProperties(BatchTableHierarchy.prototype, {
  byteLength: {
    get: function () {
      return this._byteLength;
    },
  },
});

/**
 * 从 <code>3DTILES_batch_table_hierarchy</code> 扩展中解析批处理表层次结构。
 * <code>3DTILES_batch_table_hierarchy</code> 扩展的层次结构实例
 *
 * @param {BatchTableHierarchy} hierarchy 扩展的 JSON 数据
 * @param {object} hierarchyJson 用于访问二进制属性的批处理表二进制体
 * @param {Uint8Array} [binaryBody] 返回该特性是否具有此属性
 * @private
 */
function initialize(hierarchy, hierarchyJson, binaryBody) {
  let i;
  let classId;
  let binaryAccessor;

  const instancesLength = hierarchyJson.instancesLength;
  const classes = hierarchyJson.classes;
  let classIds = hierarchyJson.classIds;
  let parentCounts = hierarchyJson.parentCounts;
  let parentIds = hierarchyJson.parentIds;
  let parentIdsLength = instancesLength;
  let byteLength = 0;

  if (defined(classIds.byteOffset)) {
    classIds.componentType =
      classIds.componentType ?? ComponentDatatype.UNSIGNED_SHORT;
    classIds.type = AttributeType.SCALAR;
    binaryAccessor = getBinaryAccessor(classIds);
    classIds = binaryAccessor.createArrayBufferView(
      binaryBody.buffer,
      binaryBody.byteOffset + classIds.byteOffset,
      instancesLength,
    );
    byteLength += classIds.byteLength;
  }

  let parentIndexes;
  if (defined(parentCounts)) {
    if (defined(parentCounts.byteOffset)) {
      parentCounts.componentType =
        parentCounts.componentType ?? ComponentDatatype.UNSIGNED_SHORT;
      parentCounts.type = AttributeType.SCALAR;
      binaryAccessor = getBinaryAccessor(parentCounts);
      parentCounts = binaryAccessor.createArrayBufferView(
        binaryBody.buffer,
        binaryBody.byteOffset + parentCounts.byteOffset,
        instancesLength,
      );
      byteLength += parentCounts.byteLength;
    }
    parentIndexes = new Uint16Array(instancesLength);
    parentIdsLength = 0;
    for (i = 0; i < instancesLength; ++i) {
      parentIndexes[i] = parentIdsLength;
      parentIdsLength += parentCounts[i];
    }

    byteLength += parentIndexes.byteLength;
  }

  if (defined(parentIds) && defined(parentIds.byteOffset)) {
    parentIds.componentType =
      parentIds.componentType ?? ComponentDatatype.UNSIGNED_SHORT;
    parentIds.type = AttributeType.SCALAR;
    binaryAccessor = getBinaryAccessor(parentIds);
    parentIds = binaryAccessor.createArrayBufferView(
      binaryBody.buffer,
      binaryBody.byteOffset + parentIds.byteOffset,
      parentIdsLength,
    );

    byteLength += parentIds.byteLength;
  }

  const classesLength = classes.length;
  for (i = 0; i < classesLength; ++i) {
    const classInstancesLength = classes[i].length;
    const properties = classes[i].instances;
    const binaryProperties = Cesium3DTileBatchTable.getBinaryProperties(
      classInstancesLength,
      properties,
      binaryBody,
    );
    byteLength += countBinaryPropertyMemory(binaryProperties);
    classes[i].instances = combine(binaryProperties, properties);
  }

  const classCounts = new Array(classesLength).fill(0);
  const classIndexes = new Uint16Array(instancesLength);
  for (i = 0; i < instancesLength; ++i) {
    classId = classIds[i];
    classIndexes[i] = classCounts[classId];
    ++classCounts[classId];
  }
  byteLength += classIndexes.byteLength;

  hierarchy._classes = classes;
  hierarchy._classIds = classIds;
  hierarchy._classIndexes = classIndexes;
  hierarchy._parentCounts = parentCounts;
  hierarchy._parentIndexes = parentIndexes;
  hierarchy._parentIds = parentIds;
  hierarchy._byteLength = byteLength;
}

function countBinaryPropertyMemory(binaryProperties) {
  let byteLength = 0;
  for (const name in binaryProperties) {
    if (binaryProperties.hasOwnProperty(name)) {
      byteLength += binaryProperties[name].typedArray.byteLength;
    }
  }
  return byteLength;
}

//>>includeStart('debug', pragmas.debug);
const scratchValidateStack = [];
function validateHierarchy(hierarchy) {
  const stack = scratchValidateStack;
  stack.length = 0;

  const classIds = hierarchy._classIds;
  const instancesLength = classIds.length;

  for (let i = 0; i < instancesLength; ++i) {
    validateInstance(hierarchy, i, stack);
  }
}

function validateInstance(hierarchy, instanceIndex, stack) {
  const parentCounts = hierarchy._parentCounts;
  const parentIds = hierarchy._parentIds;
  const parentIndexes = hierarchy._parentIndexes;
  const classIds = hierarchy._classIds;
  const instancesLength = classIds.length;

  if (!defined(parentIds)) {
    // No need to validate if there are no parents
    return;
  }

  if (instanceIndex >= instancesLength) {
    throw new DeveloperError(
      `Parent index ${instanceIndex} exceeds the total number of instances: ${instancesLength}`,
    );
  }
  if (stack.indexOf(instanceIndex) > -1) {
    throw new DeveloperError(
      "Circular dependency detected in the batch table hierarchy.",
    );
  }

  stack.push(instanceIndex);
  const parentCount = defined(parentCounts) ? parentCounts[instanceIndex] : 1;
  const parentIndex = defined(parentCounts)
    ? parentIndexes[instanceIndex]
    : instanceIndex;
  for (let i = 0; i < parentCount; ++i) {
    const parentId = parentIds[parentIndex + i];
    // Stop the traversal when the instance has no parent (its parentId equals itself), else continue the traversal.
    if (parentId !== instanceIndex) {
      validateInstance(hierarchy, parentId, stack);
    }
  }
  stack.pop(instanceIndex);
}
//>>includeEnd('debug');

// The size of this array equals the maximum instance count among all loaded tiles, which has the potential to be large.
const scratchVisited = [];
const scratchStack = [];
let marker = 0;
function traverseHierarchyMultipleParents(
  hierarchy,
  instanceIndex,
  endConditionCallback,
) {
  const classIds = hierarchy._classIds;
  const parentCounts = hierarchy._parentCounts;
  const parentIds = hierarchy._parentIds;
  const parentIndexes = hierarchy._parentIndexes;
  const instancesLength = classIds.length;

  // Ignore instances that have already been visited. This occurs in diamond inheritance situations.
  // Use a marker value to indicate that an instance has been visited, which increments with each run.
  // This is more efficient than clearing the visited array every time.
  const visited = scratchVisited;
  visited.length = Math.max(visited.length, instancesLength);
  const visitedMarker = ++marker;

  const stack = scratchStack;
  stack.length = 0;
  stack.push(instanceIndex);

  while (stack.length > 0) {
    instanceIndex = stack.pop();
    if (visited[instanceIndex] === visitedMarker) {
      // This instance has already been visited, stop traversal
      continue;
    }
    visited[instanceIndex] = visitedMarker;
    const result = endConditionCallback(hierarchy, instanceIndex);
    if (defined(result)) {
      // The end condition was met, stop the traversal and return the result
      return result;
    }
    const parentCount = parentCounts[instanceIndex];
    const parentIndex = parentIndexes[instanceIndex];
    for (let i = 0; i < parentCount; ++i) {
      const parentId = parentIds[parentIndex + i];
      // Stop the traversal when the instance has no parent (its parentId equals itself)
      // else add the parent to the stack to continue the traversal.
      if (parentId !== instanceIndex) {
        stack.push(parentId);
      }
    }
  }
}

function traverseHierarchySingleParent(
  hierarchy,
  instanceIndex,
  endConditionCallback,
) {
  let hasParent = true;
  while (hasParent) {
    const result = endConditionCallback(hierarchy, instanceIndex);
    if (defined(result)) {
      // The end condition was met, stop the traversal and return the result
      return result;
    }
    const parentId = hierarchy._parentIds[instanceIndex];
    hasParent = parentId !== instanceIndex;
    instanceIndex = parentId;
  }
}

function traverseHierarchy(hierarchy, instanceIndex, endConditionCallback) {
  // Traverse over the hierarchy and process each instance with the endConditionCallback.
  // When the endConditionCallback returns a value, the traversal stops and that value is returned.
  const parentCounts = hierarchy._parentCounts;
  const parentIds = hierarchy._parentIds;
  if (!defined(parentIds)) {
    return endConditionCallback(hierarchy, instanceIndex);
  } else if (defined(parentCounts)) {
    return traverseHierarchyMultipleParents(
      hierarchy,
      instanceIndex,
      endConditionCallback,
    );
  }
  return traverseHierarchySingleParent(
    hierarchy,
    instanceIndex,
    endConditionCallback,
  );
}

/**
 * 特性的批处理 ID
 *
 * @param {number} batchId 特性的大小写敏感属性 ID
 * @param {string} propertyId 特性具有此属性
 * @returns {boolean} Whether 返回是否有任何特性具有此属性
 * @private
 */
BatchTableHierarchy.prototype.hasProperty = function (batchId, propertyId) {
  const result = traverseHierarchy(
    this,
    batchId,
    function (hierarchy, instanceIndex) {
      const classId = hierarchy._classIds[instanceIndex];
      const instances = hierarchy._classes[classId].instances;
      if (defined(instances[propertyId])) {
        return true;
      }
    },
  );
  return defined(result);
};

/**
 * 属性的大小写敏感 ID
 *
 * @param {string} propertyId 属性的大小写敏感 ID
 * @returns {boolean} Whether 所有特性都具有此属性
 * @private
 */
BatchTableHierarchy.prototype.propertyExists = function (propertyId) {
  const classes = this._classes;
  const classesLength = classes.length;
  for (let i = 0; i < classesLength; ++i) {
    const instances = classes[i].instances;
    if (defined(instances[propertyId])) {
      return true;
    }
  }
  return false;
};

/**
 * 返回属性 ID 的数组
 *
 * @param {number} batchId 特性的批处理 ID
 * @param {number} index 实体的索引
 * @param {string[]} [results] 用于存储结果的数组
 * @returns {string[]} The 属性 ID
 * @private
 */
BatchTableHierarchy.prototype.getPropertyIds = function (batchId, results) {
  results = defined(results) ? results : [];
  results.length = 0;

  traverseHierarchy(this, batchId, function (hierarchy, instanceIndex) {
    const classId = hierarchy._classIds[instanceIndex];
    const instances = hierarchy._classes[classId].instances;
    for (const name in instances) {
      if (instances.hasOwnProperty(name)) {
        if (results.indexOf(name) === -1) {
          results.push(name);
        }
      }
    }
  });

  return results;
};

/**
 * 返回具有给定 ID 的属性的值副本
 *
 * @param {number} batchId 特性的批处理 ID
 * @param {string} propertyId 属性的大小写敏感 ID
 * @returns {*} The 属性的值，如果特性没有此属性则返回 <code>undefined</code>
 * @private
 */
BatchTableHierarchy.prototype.getProperty = function (batchId, propertyId) {
  return traverseHierarchy(this, batchId, function (hierarchy, instanceIndex) {
    const classId = hierarchy._classIds[instanceIndex];
    const instanceClass = hierarchy._classes[classId];
    const indexInClass = hierarchy._classIndexes[instanceIndex];
    const propertyValues = instanceClass.instances[propertyId];
    if (defined(propertyValues)) {
      if (defined(propertyValues.typedArray)) {
        return getBinaryProperty(propertyValues, indexInClass);
      }
      return clone(propertyValues[indexInClass], true);
    }
  });
};

function getBinaryProperty(binaryProperty, index) {
  const typedArray = binaryProperty.typedArray;
  const componentCount = binaryProperty.componentCount;
  if (componentCount === 1) {
    return typedArray[index];
  }
  return binaryProperty.type.unpack(typedArray, index * componentCount);
}

/**
 * 设置具有给定 ID 的属性的值。仅可以设置实例中的属性，父属性无法设置。
 * 特性的批处理 ID
 *
 * @param {number} batchId 特性的大小写敏感 ID
 * @param {string} propertyId 将被复制的属性的值
 * @param {*} value 如果已设置该属性，返回 <code>false</code>，否则返回 <code>true</code>
 * @returns {boolean} <code>true</code> 设置继承属性
 *
 * @exception {DeveloperError} when 检查特性是否属于给定名称的类
 * @private
 */
BatchTableHierarchy.prototype.setProperty = function (
  batchId,
  propertyId,
  value,
) {
  const result = traverseHierarchy(
    this,
    batchId,
    function (hierarchy, instanceIndex) {
      const classId = hierarchy._classIds[instanceIndex];
      const instanceClass = hierarchy._classes[classId];
      const indexInClass = hierarchy._classIndexes[instanceIndex];
      const propertyValues = instanceClass.instances[propertyId];
      if (defined(propertyValues)) {
        //>>includeStart('debug', pragmas.debug);
        if (instanceIndex !== batchId) {
          throw new DeveloperError(
            `Inherited property "${propertyId}" is read-only.`,
          );
        }
        //>>includeEnd('debug');
        if (defined(propertyValues.typedArray)) {
          setBinaryProperty(propertyValues, indexInClass, value);
        } else {
          propertyValues[indexInClass] = clone(value, true);
        }
        return true;
      }
    },
  );
  return defined(result);
};

function setBinaryProperty(binaryProperty, index, value) {
  const typedArray = binaryProperty.typedArray;
  const componentCount = binaryProperty.componentCount;
  if (componentCount === 1) {
    typedArray[index] = value;
  } else {
    binaryProperty.type.pack(value, typedArray, index * componentCount);
  }
}

/**
 * 特性是否属于具有给定名称的类
 *
 * @param {number} batchId 特性的批处理 ID
 * @param {string} className 类的名称
 * @return {boolean} <code>true</code> 如果特性属于由 className 指定的类，则返回 true，否则返回 <code>false</code>
 * @private
 */
BatchTableHierarchy.prototype.isClass = function (batchId, className) {
  // PERFORMANCE_IDEA : cache results in the ancestor classes to speed up this check if this area becomes a hotspot
  // PERFORMANCE_IDEA : treat class names as integers for faster comparisons
  const result = traverseHierarchy(
    this,
    batchId,
    function (hierarchy, instanceIndex) {
      const classId = hierarchy._classIds[instanceIndex];
      const instanceClass = hierarchy._classes[classId];
      if (instanceClass.name === className) {
        return true;
      }
    },
  );
  return defined(result);
};

/**
 * 获取指定特性所属类的名称
 *
 * @param {number} batchId 特性的批处理 ID
 * @return {string} The 该特性所属的类的名称
 */
BatchTableHierarchy.prototype.getClassName = function (batchId) {
  const classId = this._classIds[batchId];
  const instanceClass = this._classes[classId];
  return instanceClass.name;
};

export default BatchTableHierarchy;
