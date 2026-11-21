// @ts-check

/** @import { Color } from "@cesium/core"; */
/** @import {Destroyable} from "../Core/globalTypes.js"; */

/**
 * 表示具有唯一整数 ID 和选择颜色的可选中对象。
 *
 * @implements {Destroyable}
 * @ignore
 */
class PickId {
  /**
   * @param {Map<number, object>} pickObjects
   * @param {number} key
   * @param {Color} color
   */
  constructor(pickObjects, key, color) {
    this._pickObjects = pickObjects;

    /** @type {number} */
    this.key = key;

    /** @type {Color} */
    this.color = color;
  }

  /** @type {object} */
  get object() {
    return this._pickObjects.get(this.key);
  }

  set object(value) {
    this._pickObjects.set(this.key, value);
  }

  /** @returns {void} */
  destroy() {
    this._pickObjects.delete(this.key);
    return undefined;
  }
}

/**
 * 表示空（缺失）Pick ID 的保留值。
 *
 * @type {number}
 * @constant
 */
PickId.NULL_PICK_ID = 0;

export default PickId;
