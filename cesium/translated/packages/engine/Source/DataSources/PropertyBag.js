import { DeveloperError, Event, JulianDate, defined } from "@cesium/core";
import ConstantProperty from "./ConstantProperty.js";
import createPropertyDescriptor from "./createPropertyDescriptor.js";
import Property from "./Property.js";

/**
 * 一个<code>{@link Property}</code>，其值为属性名称与对应其他属性计算值之间的键值映射。
 *
 * @alias PropertyBag
 * @implements Record<string, 任意
 * @constructor
 *
 * @param {object} [value] 一个包含属性名称与属性之间的键值映射的对象。
 * @param {Function} [createPropertyCallback] 当<code>value</code>中任何属性的值不是<code>Property</code>时调用的函数。
 */
function PropertyBag(value, createPropertyCallback) {
  this._propertyNames = [];
  this._definitionChanged = new Event();

  if (defined(value)) {
    this.merge(value, createPropertyCallback);
  }
}

Object.defineProperties(PropertyBag.prototype, {
  /**
   * 获取此实例上注册的所有属性名称。
   * @memberof PropertyBag.prototype
   * @type {Array}
   */
  propertyNames: {
    get: function () {
      return this._propertyNames;
    },
  },
  /**
   * 获取指示该属性是否为常量的值。该属性
   * 如果对象中的所有属性项都是常量，则视为常量。
   * @memberof PropertyBag.prototype
   *
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      const propertyNames = this._propertyNames;
      for (let i = 0, len = propertyNames.length; i < len; i++) {
        if (!Property.isConstant(this[propertyNames[i]])) {
          return false;
        }
      }
      return true;
    },
  },
  /**
   * 当包含在该对象中的属性集合发生变化，或其中一个属性本身发生变化时引发的事件。
   * 确定此对象是否定义了给定名称的属性。
   *
   * @memberof PropertyBag.prototype
   *
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },
});

/**
 * 要检查的属性名称。
 *
 * @param {string} propertyName 要检查的属性名称。
 *
 * @returns {boolean} True 如果此对象定义了给定名称的属性，则为真；否则为假。
 */
PropertyBag.prototype.hasProperty = function (propertyName) {
  return this._propertyNames.indexOf(propertyName) !== -1;
};

function createConstantProperty(value) {
  return new ConstantProperty(value);
}

/**
 * 向此对象添加一个属性。
 *
 * @param {string} propertyName 要添加的属性名称。
 * @param {*} [value] 新属性的值（如果提供）。
 * @param {Function} [createPropertyCallback] 当新属性的值被设置为非<code>Property</code>时调用的函数。
 *
 * @exception {DeveloperError} "propertyName" 已经是已注册的属性。
 */
PropertyBag.prototype.addProperty = function (
  propertyName,
  value,
  createPropertyCallback,
) {
  const propertyNames = this._propertyNames;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(propertyName)) {
    throw new DeveloperError("propertyName is required.");
  }
  if (propertyNames.indexOf(propertyName) !== -1) {
    throw new DeveloperError(
      `${propertyName} is already a registered property.`,
    );
  }
  //>>includeEnd('debug');

  propertyNames.push(propertyName);
  Object.defineProperty(
    this,
    propertyName,
    createPropertyDescriptor(
      propertyName,
      true,
      createPropertyCallback ?? createConstantProperty,
    ),
  );

  if (defined(value)) {
    this[propertyName] = value;
  }

  this._definitionChanged.raiseEvent(this);
};

/**
 * 使用<code>addProperty</code>添加之前存在的属性。
 *
 * @param {string} propertyName 要移除的属性名称。
 *
 * @exception {DeveloperError} "propertyName" 不是已注册的属性。
 */
PropertyBag.prototype.removeProperty = function (propertyName) {
  const propertyNames = this._propertyNames;
  const index = propertyNames.indexOf(propertyName);

  //>>includeStart('debug', pragmas.debug);
  if (!defined(propertyName)) {
    throw new DeveloperError("propertyName is required.");
  }
  if (index === -1) {
    throw new DeveloperError(`${propertyName} is not a registered property.`);
  }
  //>>includeEnd('debug');

  this._propertyNames.splice(index, 1);
  delete this[propertyName];

  this._definitionChanged.raiseEvent(this);
};

const timeScratch = new JulianDate();

/**
 * 获取该属性的值。每个包含的属性将在给定时间被评估，整体结果将是一个将属性名称与这些值映射的对象。
 * 检索值的时间。如果省略，则使用当前系统时间。
 *
 * @param {JulianDate} [time=JulianDate.now()] 存储值的目标对象。如果省略，将创建并返回新实例。
 * @param {object} [result] 如果未提供<code>result</code>参数，则使用当前系统时间。
 * 注意，<code>result</code>中的任何不属于此<code>PropertyBag</code>的属性将保持原状。
 * @returns {object} The 修改<code>result</code>参数或如果未提供<code>result</code>参数则创建并返回新实例。
 */
PropertyBag.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }

  if (!defined(result)) {
    result = {};
  }

  const propertyNames = this._propertyNames;
  for (let i = 0, len = propertyNames.length; i < len; i++) {
    const propertyName = propertyNames[i];
    result[propertyName] = Property.getValueOrUndefined(
      this[propertyName],
      time,
      result[propertyName],
    );
  }
  return result;
};

/**
 * 将此对象上每个未分配的属性分配给提供源对象上相同属性的值。
 * 要合并到此对象中的目标对象。
 *
 * @param {object} source 当<code>value</code>中任何属性的值不是<code>Property</code>时调用的函数。
 * @param {Function} [createPropertyCallback] 比较此属性与提供的属性，如果相等则返回<code>true</code>，否则返回<code>false</code>。
 */
PropertyBag.prototype.merge = function (source, createPropertyCallback) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(source)) {
    throw new DeveloperError("source is required.");
  }
  //>>includeEnd('debug');

  const propertyNames = this._propertyNames;
  const sourcePropertyNames = defined(source._propertyNames)
    ? source._propertyNames
    : Object.keys(source);
  for (let i = 0, len = sourcePropertyNames.length; i < len; i++) {
    const name = sourcePropertyNames[i];

    const targetProperty = this[name];
    const sourceProperty = source[name];

    //Custom properties that are registered on the source must also be added to this.
    if (targetProperty === undefined && propertyNames.indexOf(name) === -1) {
      this.addProperty(name, undefined, createPropertyCallback);
    }

    if (sourceProperty !== undefined) {
      if (targetProperty !== undefined) {
        if (defined(targetProperty) && defined(targetProperty.merge)) {
          targetProperty.merge(sourceProperty);
        }
      } else if (
        defined(sourceProperty) &&
        defined(sourceProperty.merge) &&
        defined(sourceProperty.clone)
      ) {
        this[name] = sourceProperty.clone();
      } else {
        this[name] = sourceProperty;
      }
    }
  }
};

function propertiesEqual(a, b) {
  const aPropertyNames = a._propertyNames;
  const bPropertyNames = b._propertyNames;

  const len = aPropertyNames.length;
  if (len !== bPropertyNames.length) {
    return false;
  }

  for (let aIndex = 0; aIndex < len; ++aIndex) {
    const name = aPropertyNames[aIndex];
    const bIndex = bPropertyNames.indexOf(name);
    if (bIndex === -1) {
      return false;
    }
    if (!Property.equals(a[name], b[name])) {
      return false;
    }
  }
  return true;
}

/**
 * 另一个属性。
 * 如果左右两边相等，返回<code>false</code>，否则返回<code>true</code>。
 *
 * @param {Property} [other] 该属性。
 * @returns {boolean} <code>true</code> if left and right are equal, <code>false</code> otherwise.
 */
PropertyBag.prototype.equals = function (other) {
  return (
    this === other || //
    (other instanceof PropertyBag && //
      propertiesEqual(this, other))
  );
};
export default PropertyBag;
