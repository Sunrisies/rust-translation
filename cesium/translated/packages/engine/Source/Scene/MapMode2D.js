// @ts-check

/**
 * 描述了地图在二维空间中的运行方式。
 *
 * @enum {number}
 */
const MapMode2D = {
  /**
   * 二维地图可以围绕 z 轴旋转。
   *
   * @type {number}
   * @constant
   */
  ROTATE: 0,

  /**
   * 二维地图可以在水平方向上无限滚动。
   *
   * @type {number}
   * @constant
   */
  INFINITE_SCROLL: 1,
};

Object.freeze(MapMode2D);

export default MapMode2D;
