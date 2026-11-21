/**
 * 指示场景是以3D、2D还是2.5D Columbus视图查看。
 *
 * @enum {number}
 * @see Scene#mode
 */
const SceneMode = {
  /**
   * 模式间的变形，例如从3D变为2D。
   *
   * @type {number}
   * @constant
   */
  MORPHING: 0,

  /**
   * Columbus View模式。一种2.5D透视视图，地图以平面形式呈现，且非零高度的物体会绘制在其上方。
   * 2D模式。地图以俯视视角通过正交投影查看。
   *
   * @type {number}
   * @constant
   */
  COLUMBUS_VIEW: 1,

  /**
   * 3D模式。传统的全球3D透视视图。
   *
   * @type {number}
   * @constant
   */
  SCENE2D: 2,

  /**
   * 返回给定场景模式的变形时间。
   *
   * @type {number}
   * @constant
   */
  SCENE3D: 3,
};

/**
 * 场景模式
 *
 * @param {SceneMode} value 场景模式
 * @returns {number} The 变形时间
 */
SceneMode.getMorphTime = function (value) {
  if (value === SceneMode.SCENE3D) {
    return 1.0;
  } else if (value === SceneMode.MORPHING) {
    return undefined;
  }
  return 0.0;
};

Object.freeze(SceneMode);

export default SceneMode;
