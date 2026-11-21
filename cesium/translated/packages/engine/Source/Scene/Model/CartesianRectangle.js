/**
 * 用于计算纹理坐标和索引范围的内部类。
 *
 * @private
 */
class CartesianRectangle {
  /**
   * 创建新实例
   *
   * @param {number} [minX=0] 最小 x 坐标
   * @param {number} [minY=0] 最小 y 坐标
   * @param {number} [maxX=0] 最大 x 坐标
   * @param {number} [maxY=0] 最大 y 坐标
   */
  constructor(minX, minY, maxX, maxY) {
    this._minX = minX ?? 0.0;
    this._minY = minY ?? 0.0;
    this._maxX = maxX ?? 0.0;
    this._maxY = maxY ?? 0.0;
  }

  /**
   * 返回最小 x 坐标
   *
   * @returns {number} The 坐标
   */
  get minX() {
    return this._minX;
  }
  set minX(value) {
    this._minX = value;
  }

  /**
   * 返回最小 y 坐标
   *
   * @returns {number} The 坐标
   */
  get minY() {
    return this._minY;
  }
  set minY(value) {
    this._minY = value;
  }

  /**
   * 返回最大 x 坐标
   *
   * @returns {number} The 坐标
   */
  get maxX() {
    return this._maxX;
  }
  set maxX(value) {
    this._maxX = value;
  }

  /**
   * 返回最大 y 坐标
   *
   * @returns {number} The 坐标
   */
  get maxY() {
    return this._maxY;
  }
  set maxY(value) {
    this._maxY = value;
  }

  /**
   * 返回该矩形是否包含给定坐标，
   * 使用默认包含检查，包括
   * 最小点，但排除最大点
   *
   * @param {number} x x 坐标
   * @param {number} y y 坐标
   * @returns {boolean} The 结果
   */
  contains(x, y) {
    return x >= this.minX && x < this.maxX && y >= this.minY && y < this.maxY;
  }

  /**
   * 返回该矩形是否包含给定坐标，
   * 排除边界
   *
   * @param {number} x x 坐标
   * @param {number} y y 坐标
   * @returns {boolean} The 结果
   */
  containsExclusive(x, y) {
    return x > this.minX && x < this.maxX && y > this.minY && y < this.maxY;
  }

  /**
   * 返回该矩形是否包含给定坐标，
   * 包括边界
   *
   * @param {number} x x 坐标
   * @param {number} y y 坐标
   * @returns {boolean} The 结果
   */
  containsInclusive(x, y) {
    return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
  }
}

export default CartesianRectangle;
