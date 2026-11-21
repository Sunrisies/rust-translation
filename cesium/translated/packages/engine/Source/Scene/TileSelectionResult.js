/**
 * 指示上次访问此瓦片进行选择时发生了什么。
 * @private
 */
const TileSelectionResult = {
  /**
   * 没有选择结果，可能是因为该瓦片未被访问。
   * 最后一帧。
   */
  NONE: 0,

  /**
   * 该瓦片被认为不可见并被剔除。
   */
  CULLED: 1,

  /**
   * 该瓦片被选中用于渲染。
   */
  RENDERED: 2,

  /**
   * 该瓦片未满足屏幕空间误差要求，因此被优化。
   */
  REFINED: 3,

  /**
   * 该瓦片原本被渲染，但由于尚未可渲染，被从渲染列表中移除。
   * 被祖先瓦片替代，因为该瓦片仍不可渲染。
   */
  RENDERED_AND_KICKED: 2 | 4,

  /**
   * 该瓦片原本被优化，但其已渲染的后代被从渲染列表中移除。
   * 被祖先瓦片替代，因为该瓦片仍不可渲染。
   */
  REFINED_AND_KICKED: 3 | 4,

  /**
   * 该瓦片被剔除是因为不可见，但仍需加载。
   * 其上的任何高度都需要更新，因为相机位置或相机参考框架的原点位于该瓦片内。加载该瓦片
   * camera's reference frame's origin falls inside this tile. Loading this tile
   * 可能会影响相机位置，如果相机当前位于地形下方，或者正在跟踪一个其高度与地形相关的对象。
   * 相机位置的变化也可能反过来影响被剔除的内容。
   * 决定了选择结果是否表明该瓦片或其后代被从渲染列表中移除。换句话说，如果是 <code>RENDERED_AND_KICKED</code> 或 <code>REFINED_AND_KICKED</code>。
   */
  CULLED_BUT_NEEDED: 1 | 8,

  /**
   * 用于测试选择结果是否表明该瓦片或其后代被从渲染列表中移除。换句话说，如果是 <code>RENDERED_AND_KICKED</code> 或 <code>REFINED_AND_KICKED</code>。
   * 用于测试的选择结果。
   * 如果瓦片被移除，无论其是否原本被渲染或优化。
   *
   * @param {TileSelectionResult} value 用于测试的原始选择结果。
   * @returns {boolean} true 如果瓦片被移除，无论其是否原本被渲染或优化。
   */
  wasKicked: function (value) {
    return value >= TileSelectionResult.RENDERED_AND_KICKED;
  },

  /**
   * 用于判断在被移除或被剔除但仍需优化之前的原始选择结果。
   * 如果瓦片未被移除或未被剔除但需优化，则返回原始值。
   * @param {TileSelectionResult} value 选择结果。
   * @returns {TileSelectionResult} The 被移除前的原始选择结果。
   */
  originalResult: function (value) {
    return value & 3;
  },

  /**
   * 将选择结果转换为移除状态。
   * @param {TileSelectionResult} value 原始选择结果。
   * @returns {TileSelectionResult} The 被移除后的选择结果形式。
   */
  kick: function (value) {
    return value | 4;
  },
};
export default TileSelectionResult;
