import {
  Cartesian3,
  DeveloperError,
  Math as CesiumMath,
  defined,
} from "@cesium/core";
import SceneMode from "./SceneMode.js";

/**
 * 将距离相机较远的几何图形与大气混合，以生成地平线视图。还能通过渲染更少的几何图形和发送更少的地形请求来提升性能。
 * 如果雾效已启用，则允许性能提升；否则不允许。
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=fog|Cesium Sandcastle Fog Demo}
 *
 * @alias Fog
 * @constructor
 */
function Fog() {
  /**
   * 若雾效被启用，则为 <code>true</code>；否则为 <code>false</code>。
   * @type {boolean}
   * @default true
   * @example
   * // 在场景中禁用雾效
   * viewer.scene.fog.enabled = false;
   */
  this.enabled = true;
  /**
   * 若雾效可在着色器中渲染，则值为 <code>true</code>；否则为 <code>false</code>。
   * 这允许利用基于雾效密度的优化瓦片加载策略，而无需实际进行视觉渲染。
   * @type {boolean}
   * @default true
   * @example
   * // 使用雾效剔除，但不进行渲染
   * viewer.scene.fog.enabled = true;
   * viewer.scene.fog.renderable = false;
   */
  this.renderable = true;
  /**
   * 用于确定雾效密度的标量。完全被雾覆盖的地形将被剔除。
   * 当该数值接近 1.0 时，雾效密度增加；接近零时则变得稀疏。
   * 雾效越密集，地形被剔除的力度越大。例如，如果相机位于椭球体上方
   * 1000.0 米处，将数值增加到 3.0e-3 会导致许多靠近观察者的瓦片被剔除。
   * 降低该数值会使雾效远离观察者，但会降低性能，因为更多地形被渲染出来。
   * @type {number}
   * @default 0.0006
   * @example
   * // 将默认雾效密度翻倍
   * viewer.scene.fog.density = 0.0012;
   */
  this.density = 0.0006;
  /**
   * 用于根据相机相对于地形的高度调整雾效密度的标量。
   * @type {number}
   * @default 0.001
   */
  this.heightScalar = 0.001;
  this._heightFalloff = 0.59;
  /**
   * 雾效适用的最大高度。如果相机高于此高度，则雾效将被禁用。
   * @type {number}
   * @default 800000.0
   */
  this.maxHeight = 800000.0;
  /**
   * 影响雾效视觉密度的标量。该值不影响地形的剔除。
   * 与 {@link Fog.density} 结合使用，可控制雾效的密集程度。
   * @type {number}
   * @default 0.15
   * @experimental The 该标量的数值可能并非最终确定，可能会发生变化。
   * @example
   * // 增强雾效视觉效果
   * viewer.scene.fog.visualDensityScalar = 0.6;
   */
  this.visualDensityScalar = 0.15;
  /**
   * 用于增加部分在雾中时的地形瓦片屏幕空间误差的因子。其效果是减少
   * 需要渲染的地形瓦片数量。若设置为零，该功能将被禁用。如果针对山区区域增大该值，需要请求的瓦片数量会减少，但地平线附近的地形网格可能会明显
   * for mountainous regions, less tiles will need to be requested, but the terrain meshes near the horizon may be a noticeably
   * 分辨率降低。如果在相对平坦的区域增大该值，地平线上的变化则不明显。
   * @type {number}
   * @default 2.0
   */
  this.screenSpaceErrorFactor = 2.0;
  /**
   * 来自光照的雾色最低亮度。值为 0.0 时，雾会完全变黑。值为 1.0 则不会影响亮度。
   * 亮度完全不受影响。
   * @type {number}
   * @default 0.03
   */
  this.minimumBrightness = 0.03;
}

Object.defineProperties(Fog.prototype, {
  /**
   * 此参数是函数中的指数因子，用于调整密度随相机高度变化的方式。数值越小，随着相机高度增加，过渡越平缓。
   * 值必须大于 0。
   * @memberof Fog.prototype
   * @type {number}
   * @default 0.59
   */
  heightFalloff: {
    get: function () {
      return this._heightFalloff;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value) && value < 0) {
        throw new DeveloperError("value must be positive.");
      }
      //>>includeEnd('debug');

      this._heightFalloff = value;
    },
  },
});

const scratchPositionNormal = new Cartesian3();

/**
 * @param {FrameState} frameState
 * @private
 */
Fog.prototype.update = function (frameState) {
  const enabled = (frameState.fog.enabled = this.enabled);
  if (!enabled) {
    return;
  }

  frameState.fog.renderable = this.renderable;

  const camera = frameState.camera;
  const positionCartographic = camera.positionCartographic;

  // Turn off fog in space.
  if (
    !defined(positionCartographic) ||
    positionCartographic.height > this.maxHeight ||
    frameState.mode !== SceneMode.SCENE3D
  ) {
    frameState.fog.enabled = false;
    frameState.fog.density = 0;
    return;
  }

  const height = positionCartographic.height;
  let density =
    this.density *
    this.heightScalar *
    Math.pow(
      Math.max(height / this.maxHeight, CesiumMath.EPSILON4),
      -Math.max(this._heightFalloff, 0.0),
    );

  // Fade fog in as the camera tilts toward the horizon.
  const positionNormal = Cartesian3.normalize(
    camera.positionWC,
    scratchPositionNormal,
  );
  const dot = Math.abs(Cartesian3.dot(camera.directionWC, positionNormal));
  density *= 1.0 - dot;

  frameState.fog.density = density;
  frameState.fog.visualDensityScalar = this.visualDensityScalar;
  frameState.fog.sse = this.screenSpaceErrorFactor;
  frameState.fog.minimumBrightness = this.minimumBrightness;
};
export default Fog;
