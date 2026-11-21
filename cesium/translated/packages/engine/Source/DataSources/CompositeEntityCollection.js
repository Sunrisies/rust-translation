import {
  DeveloperError,
  Math as CesiumMath,
  createGuid,
  defined,
} from "@cesium/core";
import Entity from "./Entity.js";
import EntityCollection from "./EntityCollection.js";

const entityOptionsScratch = {
  id: undefined,
};
const entityIdScratch = new Array(2);

function clean(entity) {
  const propertyNames = entity.propertyNames;
  const propertyNamesLength = propertyNames.length;
  for (let i = 0; i < propertyNamesLength; i++) {
    entity[propertyNames[i]] = undefined;
  }
  entity._name = undefined;
  entity._availability = undefined;
}

function subscribeToEntity(that, eventHash, collectionId, entity) {
  entityIdScratch[0] = collectionId;
  entityIdScratch[1] = entity.id;
  eventHash[JSON.stringify(entityIdScratch)] =
    entity.definitionChanged.addEventListener(
      CompositeEntityCollection.prototype._onDefinitionChanged,
      that,
    );
}

function unsubscribeFromEntity(that, eventHash, collectionId, entity) {
  entityIdScratch[0] = collectionId;
  entityIdScratch[1] = entity.id;
  const id = JSON.stringify(entityIdScratch);
  eventHash[id]();
  eventHash[id] = undefined;
}

function recomposite(that) {
  that._shouldRecomposite = true;
  if (that._suspendCount !== 0) {
    return;
  }

  const collections = that._collections;
  const collectionsLength = collections.length;

  const collectionsCopy = that._collectionsCopy;
  const collectionsCopyLength = collectionsCopy.length;

  let i;
  let entity;
  let entities;
  let iEntities;
  let collection;
  const composite = that._composite;
  const newEntities = new EntityCollection(that);
  const eventHash = that._eventHash;
  let collectionId;

  for (i = 0; i < collectionsCopyLength; i++) {
    collection = collectionsCopy[i];
    collection.collectionChanged.removeEventListener(
      CompositeEntityCollection.prototype._onCollectionChanged,
      that,
    );
    entities = collection.values;
    collectionId = collection.id;
    for (iEntities = entities.length - 1; iEntities > -1; iEntities--) {
      entity = entities[iEntities];
      unsubscribeFromEntity(that, eventHash, collectionId, entity);
    }
  }

  for (i = collectionsLength - 1; i >= 0; i--) {
    collection = collections[i];
    collection.collectionChanged.addEventListener(
      CompositeEntityCollection.prototype._onCollectionChanged,
      that,
    );

    //Merge all of the existing entities.
    entities = collection.values;
    collectionId = collection.id;
    for (iEntities = entities.length - 1; iEntities > -1; iEntities--) {
      entity = entities[iEntities];
      subscribeToEntity(that, eventHash, collectionId, entity);

      let compositeEntity = newEntities.getById(entity.id);
      if (!defined(compositeEntity)) {
        compositeEntity = composite.getById(entity.id);
        if (!defined(compositeEntity)) {
          entityOptionsScratch.id = entity.id;
          compositeEntity = new Entity(entityOptionsScratch);
        } else {
          clean(compositeEntity);
        }
        newEntities.add(compositeEntity);
      }
      compositeEntity.merge(entity);
    }
  }
  that._collectionsCopy = collections.slice(0);

  composite.suspendEvents();
  composite.removeAll();
  const newEntitiesArray = newEntities.values;
  for (i = 0; i < newEntitiesArray.length; i++) {
    composite.add(newEntitiesArray[i]);
  }
  composite.resumeEvents();
}

/**
 * 非破坏性地将多个 {@link EntityCollection} 实例合并为单个集合。
 * 如果具有相同 ID 的实体存在于多个集合中，它将非破坏性地
 * 合并为一个新的实体实例。如果某个实体在多个集合中有相同的属性，
 * 则使用该列表最后集合中的实体属性。
 * 可以几乎在任何使用 EntityCollection 的地方使用 CompositeEntityCollection。
 * 可以使用 EntityCollection。
 *
 * @alias CompositeEntityCollection
 * @constructor
 *
 * @param {EntityCollection[]} [collections] 需要合并的 EntityCollection 实例的初始列表。
 * @param {DataSource|CompositeEntityCollection} [owner] 创建此集合的数据源（或复合实体集合）。
 */
function CompositeEntityCollection(collections, owner) {
  this._owner = owner;
  this._composite = new EntityCollection(this);
  this._suspendCount = 0;
  this._collections = defined(collections) ? collections.slice() : [];
  this._collectionsCopy = [];
  this._id = createGuid();
  this._eventHash = {};
  recomposite(this);
  this._shouldRecomposite = false;
}

Object.defineProperties(CompositeEntityCollection.prototype, {
  /**
   * 获取实体被添加到或从集合中移除时触发的事件。
   * 生成的事件为 {@link EntityCollection.collectionChangedEventCallback}。
   * @memberof CompositeEntityCollection.prototype
   * @readonly
   * @type {Event}
   */
  collectionChanged: {
    get: function () {
      return this._composite._collectionChanged;
    },
  },
  /**
   * 获取该集合的全局唯一标识符。
   * @memberof CompositeEntityCollection.prototype
   * @readonly
   * @type {string}
   */
  id: {
    get: function () {
      return this._id;
    },
  },
  /**
   * 获取集合中的实体实例数组。
   * 不应直接修改此数组。
   * @memberof CompositeEntityCollection.prototype
   * @readonly
   * @type {Entity[]}
   */
  values: {
    get: function () {
      return this._composite.values;
    },
  },
  /**
   * 获取此复合实体集合的拥有者，即创建它的数据源或复合实体集合。
   * @memberof CompositeEntityCollection.prototype
   * @readonly
   * @type {DataSource|CompositeEntityCollection}
   */
  owner: {
    get: function () {
      return this._owner;
    },
  },
});

/**
 * 向复合集合中添加一个集合。
 *
 * @param {EntityCollection} collection 要添加的集合。
 * @param {number} [index] 要添加集合的索引。如果省略，则集合将
 * 添加到所有现有集合之上。
 *
 * @exception {DeveloperError} index, 如果提供，必须大于或等于零且小于或等于集合的数量。
 */
CompositeEntityCollection.prototype.addCollection = function (
  collection,
  index,
) {
  const hasIndex = defined(index);
  //>>includeStart('debug', pragmas.debug);
  if (!defined(collection)) {
    throw new DeveloperError("collection is required.");
  }
  if (hasIndex) {
    if (index < 0) {
      throw new DeveloperError("index must be greater than or equal to zero.");
    } else if (index > this._collections.length) {
      throw new DeveloperError(
        "index must be less than or equal to the number of collections.",
      );
    }
  }
  //>>includeEnd('debug');

  if (!hasIndex) {
    this._collections.push(collection);
  } else {
    this._collections.splice(index, 0, collection);
  }

  recomposite(this);
};

/**
 * 如果存在，则从复合集合中移除一个集合。
 *
 * @param {EntityCollection} collection 要移除的集合。
 * @returns {boolean} true 如果集合在复合集合中并且被移除，
 * 如果集合不在复合集合中，则返回 false。
 */
CompositeEntityCollection.prototype.removeCollection = function (collection) {
  const index = this._collections.indexOf(collection);
  if (index !== -1) {
    this._collections.splice(index, 1);
    recomposite(this);
    return true;
  }
  return false;
};

/**
 * 从复合集合中移除所有集合。
 */
CompositeEntityCollection.prototype.removeAllCollections = function () {
  this._collections.length = 0;
  recomposite(this);
};

/**
 * 检查复合集合是否包含给定的集合。
 *
 * @param {EntityCollection} collection 要检查的集合。
 * @returns {boolean} true 如果复合集合包含该集合，则返回 false，否则返回 true。
 */
CompositeEntityCollection.prototype.containsCollection = function (collection) {
  return this._collections.indexOf(collection) !== -1;
};

/**
 * 如果提供的实体在此集合中，则返回 true，否则返回 false。
 *
 * @param {Entity} entity 实体。
 * @returns {boolean} true 如果提供的实体在此集合中，则返回 false，否则返回 true。
 */
CompositeEntityCollection.prototype.contains = function (entity) {
  return this._composite.contains(entity);
};

/**
 * 确定给定集合在复合集合中的索引。
 *
 * @param {EntityCollection} collection 要查找索引的集合。
 * @returns {number} The 复合集合中该集合的索引，如果不存在则返回 -1。
 */
CompositeEntityCollection.prototype.indexOfCollection = function (collection) {
  return this._collections.indexOf(collection);
};

/**
 * 通过索引从复合集合中获取一个集合。
 *
 * @param {number} index 要检索的索引。
 */
CompositeEntityCollection.prototype.getCollection = function (index) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(index)) {
    throw new DeveloperError("index is required.", "index");
  }
  //>>includeEnd('debug');

  return this._collections[index];
};

/**
 * 获取此复合集合中的集合数量。
 */
CompositeEntityCollection.prototype.getCollectionsLength = function () {
  return this._collections.length;
};

function getCollectionIndex(collections, collection) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(collection)) {
    throw new DeveloperError("collection is required.");
  }
  //>>includeEnd('debug');

  const index = collections.indexOf(collection);

  //>>includeStart('debug', pragmas.debug);
  if (index === -1) {
    throw new DeveloperError("collection is not in this composite.");
  }
  //>>includeEnd('debug');

  return index;
}

function swapCollections(composite, i, j) {
  const arr = composite._collections;
  i = CesiumMath.clamp(i, 0, arr.length - 1);
  j = CesiumMath.clamp(j, 0, arr.length - 1);

  if (i === j) {
    return;
  }

  const temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;

  recomposite(composite);
}

/**
 * 将集合在复合集合中向上移动一个位置。
 *
 * @param {EntityCollection} collection 要移动的集合。
 *
 * @exception {DeveloperError} collection 不在此复合集合中。
 */
CompositeEntityCollection.prototype.raiseCollection = function (collection) {
  const index = getCollectionIndex(this._collections, collection);
  swapCollections(this, index, index + 1);
};

/**
 * 将集合在复合体中向下移动一个位置。
 *
 * @param {EntityCollection} collection 要移动的集合。
 *
 * @exception {DeveloperError} collection 不在该复合体中。
 */
CompositeEntityCollection.prototype.lowerCollection = function (collection) {
  const index = getCollectionIndex(this._collections, collection);
  swapCollections(this, index, index - 1);
};

/**
 * 将集合提升到复合体的顶部。
 *
 * @param {EntityCollection} collection 要移动的集合。
 *
 * @exception {DeveloperError} collection 不在该复合体中。
 */
CompositeEntityCollection.prototype.raiseCollectionToTop = function (
  collection,
) {
  const index = getCollectionIndex(this._collections, collection);
  if (index === this._collections.length - 1) {
    return;
  }
  this._collections.splice(index, 1);
  this._collections.push(collection);

  recomposite(this);
};

/**
 * 将集合在复合体中向下移动到底部。
 *
 * @param {EntityCollection} collection 要移动的集合。
 *
 * @exception {DeveloperError} collection 不在该复合体中。
 */
CompositeEntityCollection.prototype.lowerCollectionToBottom = function (
  collection,
) {
  const index = getCollectionIndex(this._collections, collection);
  if (index === 0) {
    return;
  }
  this._collections.splice(index, 1);
  this._collections.splice(0, 0, collection);

  recomposite(this);
};

/**
 * 防止 {@link EntityCollection#collectionChanged} 事件被触发。
 * 直到执行 {@link EntityCollection#resumeEvents} 相应的调用时，
 * 此时将触发一个涵盖所有暂停操作的单一事件。
 * 这允许高效地添加和移除多个项目。
 * 当事件被暂停时，集合的重新组合也会被暂停，因为这可能是一个耗时的操作。
 * 只要存在对应的 {@link EntityCollection#resumeEvents} 调用，就可以安全多次调用此函数。
 * 当添加或移除项目时，此函数可以立即恢复 {@link EntityCollection#collectionChanged} 事件的触发。在事件暂停期间所做的任何修改
 * are corresponding calls to {@link EntityCollection#resumeEvents}.
 */
CompositeEntityCollection.prototype.suspendEvents = function () {
  this._suspendCount++;
  this._composite.suspendEvents();
};

/**
 * Resumes raising {@link EntityCollection#collectionChanged} events immediately
 * 此函数是引用计数类型，只要存在对应的 {@link EntityCollection#resumeEvents} 调用，就可以安全多次调用。
 * 不能在 suspendEvents 之前调用。
 * 计算集合中实体的最大可用性。
 * 如果集合包含无限可用数据和非无限数据的混合情况，
 * are corresponding calls to {@link EntityCollection#resumeEvents}.
 *
 * @exception {DeveloperError} resumeEvents 集合中实体的可用性。
 */
CompositeEntityCollection.prototype.resumeEvents = function () {
  //>>includeStart('debug', pragmas.debug);
  if (this._suspendCount === 0) {
    throw new DeveloperError(
      "resumeEvents can not be called before suspendEvents.",
    );
  }
  //>>includeEnd('debug');

  this._suspendCount--;
  // recomposite before triggering events (but only if required for performance) that might depend on a composited collection
  if (this._shouldRecomposite && this._suspendCount === 0) {
    recomposite(this);
    this._shouldRecomposite = false;
  }

  this._composite.resumeEvents();
};

/**
 * 获取具有指定 ID 的实体。
 * 要检索的实体的 ID。
 * 提供 ID 的实体，如果该 ID 不存在于集合中则返回 undefined。
 * data is infinite, an infinite interval will be returned.
 *
 * @returns {TimeInterval} The availability of entities in the collection.
 */
CompositeEntityCollection.prototype.computeAvailability = function () {
  return this._composite.computeAvailability();
};

/**
 * Gets an entity with the specified id.
 *
 * @param {string} id The id of the entity to retrieve.
 * @returns {Entity|undefined} The entity with the provided id or undefined if the id did not exist in the collection.
 */
CompositeEntityCollection.prototype.getById = function (id) {
  return this._composite.getById(id);
};

CompositeEntityCollection.prototype._onCollectionChanged = function (
  collection,
  added,
  removed,
) {
  const collections = this._collectionsCopy;
  const collectionsLength = collections.length;
  const composite = this._composite;
  composite.suspendEvents();

  let i;
  let q;
  let entity;
  let compositeEntity;
  const removedLength = removed.length;
  const eventHash = this._eventHash;
  const collectionId = collection.id;
  for (i = 0; i < removedLength; i++) {
    const removedEntity = removed[i];
    unsubscribeFromEntity(this, eventHash, collectionId, removedEntity);

    const removedId = removedEntity.id;
    //Check if the removed entity exists in any of the remaining collections
    //If so, we clean and remerge it.
    for (q = collectionsLength - 1; q >= 0; q--) {
      entity = collections[q].getById(removedId);
      if (defined(entity)) {
        if (!defined(compositeEntity)) {
          compositeEntity = composite.getById(removedId);
          clean(compositeEntity);
        }
        compositeEntity.merge(entity);
      }
    }
    //We never retrieved the compositeEntity, which means it no longer
    //exists in any of the collections, remove it from the composite.
    if (!defined(compositeEntity)) {
      composite.removeById(removedId);
    }
    compositeEntity = undefined;
  }

  const addedLength = added.length;
  for (i = 0; i < addedLength; i++) {
    const addedEntity = added[i];
    subscribeToEntity(this, eventHash, collectionId, addedEntity);

    const addedId = addedEntity.id;
    //We know the added entity exists in at least one collection,
    //but we need to check all collections and re-merge in order
    //to maintain the priority of properties.
    for (q = collectionsLength - 1; q >= 0; q--) {
      entity = collections[q].getById(addedId);
      if (defined(entity)) {
        if (!defined(compositeEntity)) {
          compositeEntity = composite.getById(addedId);
          if (!defined(compositeEntity)) {
            entityOptionsScratch.id = addedId;
            compositeEntity = new Entity(entityOptionsScratch);
            composite.add(compositeEntity);
          } else {
            clean(compositeEntity);
          }
        }
        compositeEntity.merge(entity);
      }
    }
    compositeEntity = undefined;
  }

  composite.resumeEvents();
};

CompositeEntityCollection.prototype._onDefinitionChanged = function (
  entity,
  propertyName,
  newValue,
  oldValue,
) {
  const collections = this._collections;
  const composite = this._composite;

  const collectionsLength = collections.length;
  const id = entity.id;
  const compositeEntity = composite.getById(id);
  let compositeProperty = compositeEntity[propertyName];
  const newProperty = !defined(compositeProperty);

  let firstTime = true;
  for (let q = collectionsLength - 1; q >= 0; q--) {
    const innerEntity = collections[q].getById(entity.id);
    if (defined(innerEntity)) {
      const property = innerEntity[propertyName];
      if (defined(property)) {
        if (firstTime) {
          firstTime = false;
          //We only want to clone if the property is also mergeable.
          //This ensures that leaf properties are referenced and not copied,
          //which is the entire point of compositing.
          if (defined(property.merge) && defined(property.clone)) {
            compositeProperty = property.clone(compositeProperty);
          } else {
            compositeProperty = property;
            break;
          }
        }
        compositeProperty.merge(property);
      }
    }
  }

  if (
    newProperty &&
    compositeEntity.propertyNames.indexOf(propertyName) === -1
  ) {
    compositeEntity.addProperty(propertyName);
  }

  compositeEntity[propertyName] = compositeProperty;
};
export default CompositeEntityCollection;