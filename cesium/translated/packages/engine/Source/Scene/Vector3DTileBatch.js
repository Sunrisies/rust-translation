/**
 * 描述一组可渲染的几何图形。
 *
 * @alias Vector3DTileBatch
 * @constructor
 *
 * @param {object} options 具有以下属性的对象：
 * @param {number} options.offset 批次在索引缓冲区中的偏移量。
 * @param {number} options.count 批次中的索引数量。
 * @param {Color} options.color 批次中几何图形的颜色。
 * @param {number[]} options.batchIds 一个数组，每个元素都是该批次中几何图形的批次 ID。
 *
 * @private
 */
function Vector3DTileBatch(options) {
  /**
   * 批次在索引缓冲区中的偏移量。
   * @type {number}
   */
  this.offset = options.offset;
  /**
   * 批次中的索引数量。
   * @type {number}
   */
  this.count = options.count;
  /**
   * 批次中几何图形的颜色。
   * @type {Color}
   */
  this.color = options.color;
  /**
   * 一个数组，每个元素都是该批次中几何图形的批次 ID。
   * @type {number[]}
   */
  this.batchIds = options.batchIds;
}
export default Vector3DTileBatch;
