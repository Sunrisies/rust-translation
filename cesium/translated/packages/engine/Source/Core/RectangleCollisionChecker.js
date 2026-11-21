import { Check } from "@cesium/core";
import RBush from "rbush";

/**
 * 用于与 Rectangle 类型一起使用的 rbush 包装器。
 * @private
 */
function RectangleCollisionChecker() {
  this._tree = new RBush();
}

function RectangleWithId() {
  this.minX = 0.0;
  this.minY = 0.0;
  this.maxX = 0.0;
  this.maxY = 0.0;
  this.id = "";
}

RectangleWithId.fromRectangleAndId = function (id, rectangle, result) {
  result.minX = rectangle.west;
  result.minY = rectangle.south;
  result.maxX = rectangle.east;
  result.maxY = rectangle.north;
  result.id = id;
  return result;
};

/**
 * 将矩形插入碰撞检查器中。
 *
 * @param {string} id 插入的矩形的唯一字符串 ID。
 * @param {Rectangle} rectangle 一个 Rectangle
 * @private
 */
RectangleCollisionChecker.prototype.insert = function (id, rectangle) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("id", id);
  Check.typeOf.object("rectangle", rectangle);
  //>>includeEnd('debug');

  const withId = RectangleWithId.fromRectangleAndId(
    id,
    rectangle,
    new RectangleWithId(),
  );
  this._tree.insert(withId);
};

function idCompare(a, b) {
  return a.id === b.id;
}

const removalScratch = new RectangleWithId();
/**
 * 从碰撞检查器中移除一个矩形。
 *
 * @param {string} id 被移除的矩形的唯一字符串 ID。
 * @param {Rectangle} rectangle 一个 Rectangle
 * @private
 */
RectangleCollisionChecker.prototype.remove = function (id, rectangle) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("id", id);
  Check.typeOf.object("rectangle", rectangle);
  //>>includeEnd('debug');

  const withId = RectangleWithId.fromRectangleAndId(
    id,
    rectangle,
    removalScratch,
  );
  this._tree.remove(withId, idCompare);
};

const collisionScratch = new RectangleWithId();
/**
 * 检查给定的矩形是否与集合中的任何矩形发生碰撞。
 *
 * @param {Rectangle} rectangle 需要由碰撞检查器中的矩形进行检查的 Rectangle。
 * @returns {boolean} Whether 该矩形是否与碰撞检查器中的任何矩形发生碰撞。
 */
RectangleCollisionChecker.prototype.collides = function (rectangle) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("rectangle", rectangle);
  //>>includeEnd('debug');

  const withId = RectangleWithId.fromRectangleAndId(
    "",
    rectangle,
    collisionScratch,
  );
  return this._tree.collides(withId);
};
export default RectangleCollisionChecker;
