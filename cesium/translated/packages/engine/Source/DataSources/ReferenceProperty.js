import { DeveloperError, Event, JulianDate, defined } from "@cesium/core";
import Property from "./Property.js";

function resolve(that) {
  let targetProperty = that._targetProperty;

  if (!defined(targetProperty)) {
    let targetEntity = that._targetEntity;

    if (!defined(targetEntity)) {
      targetEntity = that._targetCollection.getById(that._targetId);

      if (!defined(targetEntity)) {
        // target entity not found
        that._targetEntity = that._targetProperty = undefined;
        return;
      }

      // target entity was found. listen for changes to entity definition
      targetEntity.definitionChanged.addEventListener(
        ReferenceProperty.prototype._onTargetEntityDefinitionChanged,
        that,
      );
      that._targetEntity = targetEntity;
    }

    // walk the list of property names and resolve properties
    const targetPropertyNames = that._targetPropertyNames;
    targetProperty = that._targetEntity;
    for (
      let i = 0, len = targetPropertyNames.length;
      i < len && defined(targetProperty);
      ++i
    ) {
      targetProperty = targetProperty[targetPropertyNames[i]];
    }

    // target property may or may not be defined, depending on if it was found
    that._targetProperty = targetProperty;
  }

  return targetProperty;
}

/**
 * 一个透明地链接到提供对象上另一个属性的 {@link Property}。
 *
 * @alias ReferenceProperty
 * @constructor
 *
 * @param {EntityCollection} targetCollection 用于解析引用的实体集合。
 * @param {string} targetId 被引用的实体的 id。
 * @param {string[]} targetPropertyNames 我们将使用的目标实体上的属性名称。
 *
 * @example
 * const collection = new Cesium.EntityCollection();
 *
 * //创建新实体并分配广告牌比例。
 * const object1 = new Cesium.Entity({id:'object1'});
 * object1.billboard = new Cesium.BillboardGraphics();
 * object1.billboard.scale = new Cesium.ConstantProperty(2.0);
 * collection.add(object1);
 *
 * //创建第二个实体并引用第一个实体的比例。
 * const object2 = new Cesium.Entity({id:'object2'});
 * object2.model = new Cesium.ModelGraphics();
 * object2.model.scale = new Cesium.ReferenceProperty(collection, 'object1', ['billboard', 'scale']);
 * collection.add(object2);
 *
 * //创建第三个对象，但使用 fromString 辅助函数。
 * const object3 = new Cesium.Entity({id:'object3'});
 * object3.billboard = new Cesium.BillboardGraphics();
 * object3.billboard.scale = Cesium.ReferenceProperty.fromString(collection, 'object1#billboard.scale');
 * collection.add(object3);
 *
 * //可以通过转义的方式引用 id 和属性名称中包含 # 或 . 的实体。
 * const object4 = new Cesium.Entity({id:'#object.4'});
 * object4.billboard = new Cesium.BillboardGraphics();
 * object4.billboard.scale = new Cesium.ConstantProperty(2.0);
 * collection.add(object4);
 *
 * const object5 = new Cesium.Entity({id:'object5'});
 * object5.billboard = new Cesium.BillboardGraphics();
 * object5.billboard.scale = Cesium.ReferenceProperty.fromString(collection, '\\#object\\.4#billboard.scale');
 * collection.add(object5);
 */
function ReferenceProperty(targetCollection, targetId, targetPropertyNames) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(targetCollection)) {
    throw new DeveloperError("targetCollection is required.");
  }
  if (!defined(targetId) || targetId === "") {
    throw new DeveloperError("targetId is required.");
  }
  if (!defined(targetPropertyNames) || targetPropertyNames.length === 0) {
    throw new DeveloperError("targetPropertyNames is required.");
  }
  for (let i = 0; i < targetPropertyNames.length; i++) {
    const item = targetPropertyNames[i];
    if (!defined(item) || item === "") {
      throw new DeveloperError("reference contains invalid properties.");
    }
  }
  //>>includeEnd('debug');

  this._targetCollection = targetCollection;
  this._targetId = targetId;
  this._targetPropertyNames = targetPropertyNames;
  this._targetProperty = undefined;
  this._targetEntity = undefined;
  this._definitionChanged = new Event();

  targetCollection.collectionChanged.addEventListener(
    ReferenceProperty.prototype._onCollectionChanged,
    this,
  );
}

Object.defineProperties(ReferenceProperty.prototype, {
  /**
   * 获取表示该属性是否为常量的值。
   * @memberof ReferenceProperty.prototype
   * @type {boolean}
   * @readonly
   */
  isConstant: {
    get: function () {
      return Property.isConstant(resolve(this));
    },
  },
  /**
   * 获取当该属性的定义发生变化时引发的事件。
   * 每当被引用的属性的定义发生变化时，该定义也会改变。
   * @memberof ReferenceProperty.prototype
   * @type {Event}
   * @readonly
   */
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },
  /**
   * 获取位置所定义的参考框架。
   * 只有当被引用的属性是 {@link PositionProperty} 时，该属性才有效。
   * @memberof ReferenceProperty.prototype
   * @type {ReferenceFrame}
   * @readonly
   */
  referenceFrame: {
    get: function () {
      const target = resolve(this);
      return defined(target) ? target.referenceFrame : undefined;
    },
  },
  /**
   * 获取被引用的实体的 id。
   * @memberof ReferenceProperty.prototype
   * @type {string}
   * @readonly
   */
  targetId: {
    get: function () {
      return this._targetId;
    },
  },
  /**
   * 获取包含被引用实体的集合。
   * @memberof ReferenceProperty.prototype
   * @type {EntityCollection}
   * @readonly
   */
  targetCollection: {
    get: function () {
      return this._targetCollection;
    },
  },
  /**
   * 获取用于检索被引用属性的属性名称数组。
   * @memberof ReferenceProperty.prototype
   * @type {}
   * @readonly
   */
  targetPropertyNames: {
    get: function () {
      return this._targetPropertyNames;
    },
  },
  /**
   * 获取底层被引用属性的解析实例。
   * @memberof ReferenceProperty.prototype
   * @type {Property|undefined}
   * @readonly
   */
  resolvedProperty: {
    get: function () {
      return resolve(this);
    },
  },
});

/**
 * 根据用于解析的实体集合以及指示目标实体 ID 和属性的字符串，创建一个新的实例。
 * 该字符串的格式为“objectId#foo.bar”，其中 # 用于分隔 ID 与
 * 属性路径，. 用于分隔子属性。如果引用标识符或任何子属性中包含 # . 或 \，则必须进行转义。
 * ReferenceProperty 的新实例。
 * referenceString。
 *
 * @param {EntityCollection} targetCollection
 * @param {string} referenceString
 * @returns {ReferenceProperty} A 获取指定时间下的属性值。
 *
 * @exception {DeveloperError} invalid 检索值的时长。如果未提供，则使用当前系统时间。
 */
ReferenceProperty.fromString = function (targetCollection, referenceString) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(targetCollection)) {
    throw new DeveloperError("targetCollection is required.");
  }
  if (!defined(referenceString)) {
    throw new DeveloperError("referenceString is required.");
  }
  //>>includeEnd('debug');

  let identifier;
  const values = [];

  let inIdentifier = true;
  let isEscaped = false;
  let token = "";
  for (let i = 0; i < referenceString.length; ++i) {
    const c = referenceString.charAt(i);

    if (isEscaped) {
      token += c;
      isEscaped = false;
    } else if (c === "\\") {
      isEscaped = true;
    } else if (inIdentifier && c === "#") {
      identifier = token;
      inIdentifier = false;
      token = "";
    } else if (!inIdentifier && c === ".") {
      values.push(token);
      token = "";
    } else {
      token += c;
    }
  }
  values.push(token);

  return new ReferenceProperty(targetCollection, identifier, values);
};

const timeScratch = new JulianDate();

/**
 * 如果未提供，则创建并返回新实例，用于存储值。
 *
 * @param {JulianDate} [time=JulianDate.now()] 修改后的结果参数或新实例（如果未提供结果参数）。
 * @param {object} [result] 获取指定时间下的属性值，并在提供的参考框架中。
 * @returns {object} The 仅当被引用的属性为 PositionProperty 时，此方法才有效。
 */
ReferenceProperty.prototype.getValue = function (time, result) {
  const target = resolve(this);
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  return defined(target) ? target.getValue(time, result) : undefined;
};

/**
 * 检索值的时长。
 * This method is only valid if the property being referenced is a {@link PositionProperty}.
 *
 * @param {JulianDate} time 如果未提供，则创建并返回新实例，用于存储值。
 * @param {ReferenceFrame} referenceFrame 修改后的结果参数或新实例（如果未提供结果参数）。
 * @param {Cartesian3} [result] 获取指定时间下的 {@link Material} 类型。
 * @returns {Cartesian3} The 仅当被引用的属性为 MaterialProperty 时，此方法才有效。
 */
ReferenceProperty.prototype.getValueInReferenceFrame = function (
  time,
  referenceFrame,
  result,
) {
  const target = resolve(this);
  return defined(target)
    ? target.getValueInReferenceFrame(time, referenceFrame, result)
    : undefined;
};

/**
 * 获取指定时间下的 {@link Material} 类型。
 * This method is only valid if the property being referenced is a {@link MaterialProperty}.
 *
 * @param {JulianDate} time 材料的类型。
 * @returns {string} The 材料的类型。
 */
ReferenceProperty.prototype.getType = function (time) {
  const target = resolve(this);
  return defined(target) ? target.getType(time) : undefined;
};

/**
 * 比较此属性与提供的属性，如果相等则返回
 * <code>true</code>，否则返回 <code>false</code>。
 *
 * @param {Property} [other] 另一个属性。
 * @returns {boolean} <code>true</code> 如果左右值相等，返回 <code>false</code>，否则返回 <code>false</code>。
 */
ReferenceProperty.prototype.equals = function (other) {
  if (this === other) {
    return true;
  }

  const names = this._targetPropertyNames;
  const otherNames = other._targetPropertyNames;

  if (
    this._targetCollection !== other._targetCollection || //
    this._targetId !== other._targetId || //
    names.length !== otherNames.length
  ) {
    return false;
  }

  const length = this._targetPropertyNames.length;
  for (let i = 0; i < length; i++) {
    if (names[i] !== otherNames[i]) {
      return false;
    }
  }

  return true;
};

ReferenceProperty.prototype._onTargetEntityDefinitionChanged = function (
  targetEntity,
  name,
  value,
  oldValue,
) {
  if (defined(this._targetProperty) && this._targetPropertyNames[0] === name) {
    this._targetProperty = undefined;
    this._definitionChanged.raiseEvent(this);
  }
};

ReferenceProperty.prototype._onCollectionChanged = function (
  collection,
  added,
  removed,
) {
  let targetEntity = this._targetEntity;
  if (defined(targetEntity) && removed.indexOf(targetEntity) !== -1) {
    targetEntity.definitionChanged.removeEventListener(
      ReferenceProperty.prototype._onTargetEntityDefinitionChanged,
      this,
    );
    this._targetEntity = this._targetProperty = undefined;
  } else if (!defined(targetEntity)) {
    targetEntity = resolve(this);
    if (defined(targetEntity)) {
      this._definitionChanged.raiseEvent(this);
    }
  }
};
export default ReferenceProperty;