import {
  Check,
  DeveloperError,
  NearFarScalar,
  Rectangle,
  defined,
} from "@cesium/core";

/**
 * 控制地球球体半透明度的属性。
 *
 * @alias GlobeTranslucency
 * @constructor
 */
function GlobeTranslucency() {
  this._enabled = false;
  this._frontFaceAlpha = 1.0;
  this._frontFaceAlphaByDistance = undefined;
  this._backFaceAlpha = 1.0;
  this._backFaceAlphaByDistance = undefined;
  this._rectangle = Rectangle.clone(Rectangle.MAX_VALUE);
}

Object.defineProperties(GlobeTranslucency.prototype, {
  /**
   * 当设置为 true 时，地球球体将以半透明表面形式渲染。
   * <br /><br />
   * 透明度是通过混合 {@link Globe#material}、{@link Globe#imageryLayers} 以及 {@link Globe#baseColor} 来计算的，这些元素可能包含半透明效果，然后乘以
   * {@link GlobeTranslucency#frontFaceAlpha} 和 {@link GlobeTranslucency#frontFaceAlphaByDistance} 用于正面面，
   * {@link GlobeTranslucency#backFaceAlpha} 和 {@link GlobeTranslucency#backFaceAlphaByDistance} 用于背面面。
   * 当相机位于地下时，背面面和正面面会被交换，即背向的几何图形
   * 被视为正面面向用户。
   * 半透明效果默认被禁用。
   * <br /><br />
   * 默认情况下，半透明效果被禁用。
   *
   * @memberof GlobeTranslucency.prototype
   *
   * @type {boolean}
   * @default false
   *
   * @see GlobeTranslucency#frontFaceAlpha
   * @see GlobeTranslucency#frontFaceAlphaByDistance
   * @see GlobeTranslucency#backFaceAlpha
   * @see GlobeTranslucency#backFaceAlphaByDistance
   */
  enabled: {
    get: function () {
      return this._enabled;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.bool("enabled", value);
      //>>includeEnd('debug');
      this._enabled = value;
    },
  },

  /**
   * 应用于地球球体正面面的恒定半透明值。
   * <br /><br />
   * 要使此选项生效，{@link GlobeTranslucency#enabled} 必须设置为 true。
   *
   * @memberof GlobeTranslucency.prototype
   *
   * @type {number}
   * @default 1.0
   *
   * @see GlobeTranslucency#enabled
   * @see GlobeTranslucency#frontFaceAlphaByDistance
   *
   * @example
   * // 将正面面的半透明度设置为 0.5。
   * globe.translucency.frontFaceAlpha = 0.5;
   * globe.translucency.enabled = true;
   */
  frontFaceAlpha: {
    get: function () {
      return this._frontFaceAlpha;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number.greaterThanOrEquals("frontFaceAlpha", value, 0.0);
      Check.typeOf.number.lessThanOrEquals("frontFaceAlpha", value, 1.0);
      //>>includeEnd('debug');
      this._frontFaceAlpha = value;
    },
  },
  /**
   * 根据与相机的距离，获取或设置地球球体正面面的近距和远距半透明属性。
   * 半透明度将在 {@link NearFarScalar#nearValue} 和
   * {@link NearFarScalar#farValue} 之间插值，当相机距离落在指定的
   * {@link NearFarScalar#near} 和 {@link NearFarScalar#far} 的上下范围内时。
   * 超出这些范围时，半透明度将限制在最近的边界内。如果未定义，
   * {@link GlobeTranslucency#backFaceAlphaByDistance} 将被禁用。
   * <br /><br />
   * 要使此选项生效，{@link GlobeTranslucency#enabled} 必须设置为 true。
   *
   * @memberof GlobeTranslucency.prototype
   *
   * @type {NearFarScalar}
   * @default undefined
   *
   * @see GlobeTranslucency#enabled
   * @see GlobeTranslucency#frontFaceAlpha
   *
   * @example
   * // 示例 1。
   * // 当
   * // 相机距离表面 1500 米且距离为 1.0 时，
   * // 当相机距离接近 8.0e6 米时，将正面面的半透明度设置为 0.5。
   * globe.translucency.frontFaceAlphaByDistance = new Cesium.NearFarScalar(1.5e2, 0.5, 8.0e6, 1.0);
   * globe.translucency.enabled = true;
   *
   * @example
   * // 示例 2。
   * // 通过距离禁用背面面的半透明效果
   * globe.translucency.frontFaceAlphaByDistance = undefined;
   */
  frontFaceAlphaByDistance: {
    get: function () {
      return this._frontFaceAlphaByDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value) && value.far < value.near) {
        throw new DeveloperError(
          "far distance must be greater than near distance.",
        );
      }
      //>>includeEnd('debug');
      this._frontFaceAlphaByDistance = NearFarScalar.clone(
        value,
        this._frontFaceAlphaByDistance,
      );
    },
  },

  /**
   * 应用于地球球体背面的恒定半透明值。
   * <br /><br />
   * {@link GlobeTranslucency#enabled} 必须设置为 true 以使此选项生效。
   *
   * @memberof GlobeTranslucency.prototype
   *
   * @type {number}
   * @default 1.0
   *
   * @see GlobeTranslucency#enabled
   * @see GlobeTranslucency#backFaceAlphaByDistance
   *
   * @example
   * // 将背面面的半透明度设置为 0.5。
   * globe.translucency.backFaceAlpha = 0.5;
   * globe.translucency.enabled = true;
   */
  backFaceAlpha: {
    get: function () {
      return this._backFaceAlpha;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.number.greaterThanOrEquals("backFaceAlpha", value, 0.0);
      Check.typeOf.number.lessThanOrEquals("backFaceAlpha", value, 1.0);
      //>>includeEnd('debug');
      this._backFaceAlpha = value;
    },
  },
  /**
   * 根据与相机的距离，获取或设置地球球体背面面的近距和远距半透明属性。
   * 半透明效果将在 {@link NearFarScalar#nearValue} 和
   * {@link NearFarScalar#farValue} 之间插值，此时相机距离位于指定 {@link NearFarScalar#near} 和 {@link NearFarScalar#far} 的上下边界内。
   * 超出这些范围时，半透明效果会被限制在最近的边界值。如果未定义，
   * Outside of these ranges the translucency remains clamped to the nearest bound.  If undefined,
   * backFaceAlphaByDistance 将被禁用。
   * <br /><br />
   * {@link GlobeTranslucency#enabled} 必须设置为 true，此选项才能生效。
   *
   * @memberof GlobeTranslucency.prototype
   *
   * @type {NearFarScalar}
   * @default undefined
   *
   * @see GlobeTranslucency#enabled
   * @see GlobeTranslucency#backFaceAlpha
   *
   * @example
   * // 示例 1。
   * // 当相机距离表面 1500 米且距离为 1.0
   * // 时，将背面半透明效果设置为 0.5。
   * // 当相机距离接近 8.0e6 米时。
   * globe.translucency.backFaceAlphaByDistance = new Cesium.NearFarScalar(1.5e2, 0.5, 8.0e6, 1.0);
   * globe.translucency.enabled = true;
   *
   * @example
   * // 示例 2。
   * // 通过距离禁用背面半透明效果。
   * globe.translucency.backFaceAlphaByDistance = undefined;
   */
  backFaceAlphaByDistance: {
    get: function () {
      return this._backFaceAlphaByDistance;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      if (defined(value) && value.far < value.near) {
        throw new DeveloperError(
          "far distance must be greater than near distance.",
        );
      }
      //>>includeEnd('debug');
      this._backFaceAlphaByDistance = NearFarScalar.clone(
        value,
        this._backFaceAlphaByDistance,
      );
    },
  },

  /**
   * 一个指定 {@link Rectangle} 的属性，用于将半透明效果限制在特定地图区域。
   * 默认设置为地图坐标的最大范围。
   *
   * @memberof GlobeTranslucency.prototype
   *
   * @type {Rectangle}
   * @default {@link Rectangle.MAX_VALUE}
   */
  rectangle: {
    get: function () {
      return this._rectangle;
    },
    set: function (value) {
      if (!defined(value)) {
        value = Rectangle.clone(Rectangle.MAX_VALUE);
      }
      Rectangle.clone(value, this._rectangle);
    },
  },
});

export default GlobeTranslucency;
