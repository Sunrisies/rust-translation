import PointCloudEyeDomeLighting from "./PointCloudEyeDomeLighting.js";

/**
 * 在渲染时基于几何误差进行点衰减的选项
 * 使用 3D Tiles 的点云。
 *
 * @param {object} [options] 具有以下属性的对象：
 * @param {boolean} [options.attenuation=false] 基于几何误差进行点衰减。
 * @param {number} [options.geometricErrorScale=1.0] 应用于每个 tiles 的几何误差的缩放比例。
 * @param {number} [options.maximumAttenuation] 像素中的最大衰减值。默认值为 Cesium3DTileset 的 maximumScreenSpaceError。
 * @param {number} [options.baseResolution] 数据集的平均基础分辨率，单位：米。当无法获取几何误差时，此值可替代几何误差。
 * @param {boolean} [options.eyeDomeLighting=true] 如果启用，在使用点衰减进行绘制时采用眼罩照明。
 * @param {number} [options.eyeDomeLightingStrength=1.0] 此值越大，斜坡和边缘的对比度越高。
 * @param {number} [options.eyeDomeLightingRadius=1.0] 通过眼罩照明增加轮廓的厚度。
 * @param {boolean} [options.backFaceCulling=false] 决定是否隐藏背向视线的点。此选项仅在数据包含法线时生效。
 * @param {boolean} [options.normalShading=true] 决定包含法线的点云是否由场景光源进行阴影渲染。
 *
 * @alias PointCloudShading
 * @constructor
 */
function PointCloudShading(options) {
  const pointCloudShading = options ?? {};

  /**
   * 基于几何误差进行点衰减。
   * @type {boolean}
   * @default false
   */
  this.attenuation = pointCloudShading.attenuation ?? false;

  /**
   * 在计算衰减之前，应用于几何误差的缩放比例。
   * @type {number}
   * @default 1.0
   */
  this.geometricErrorScale = pointCloudShading.geometricErrorScale ?? 1.0;

  /**
   * 像素中的最大点衰减值。如果未定义，则使用 Cesium3DTileset 的 maximumScreenSpaceError。
   * @type {number}
   */
  this.maximumAttenuation = pointCloudShading.maximumAttenuation;

  /**
   * 数据集的平均基础分辨率，单位：米。
   * 当几何误差为 0 时，此值替代几何误差。
   * 如果未定义，对于几何误差为 0 的每个 tiles，将计算近似值。
   * @type {number}
   */
  this.baseResolution = pointCloudShading.baseResolution;

  /**
   * 在使用点衰减进行绘制时采用眼罩照明。
   * 需要 WebGL 1.0 中支持 EXT_frag_depth、OES_texture_float 和 WEBGL_draw_buffers 扩展，否则眼罩照明将被忽略。
   * 否则，眼罩照明将被忽略。
   *
   * @type {boolean}
   * @default true
   */
  this.eyeDomeLighting = pointCloudShading.eyeDomeLighting ?? true;

  /**
   * 眼罩照明强度（表观对比度）
   * @type {number}
   * @default 1.0
   */
  this.eyeDomeLightingStrength =
    pointCloudShading.eyeDomeLightingStrength ?? 1.0;

  /**
   * 通过眼罩照明产生的轮廓厚度
   * @type {number}
   * @default 1.0
   */
  this.eyeDomeLightingRadius = pointCloudShading.eyeDomeLightingRadius ?? 1.0;

  /**
   * 决定是否隐藏背向视线的点。
   * 此选项仅在数据包含法线时生效。
   *
   * @type {boolean}
   * @default false
   */
  this.backFaceCulling = pointCloudShading.backFaceCulling ?? false;

  /**
   * 决定包含法线的点云是否由场景光源进行阴影渲染。
   *
   * @type {boolean}
   * @default true
   */
  this.normalShading = pointCloudShading.normalShading ?? true;
}

/**
 * 决定点云阴影是否被支持。
 *
 * @param {Scene} scene 场景。
 * @returns {boolean} <code>true</code> 如果点云阴影被支持，则执行；否则返回 <code>false</code>。
 */
PointCloudShading.isSupported = function (scene) {
  return PointCloudEyeDomeLighting.isSupported(scene.context);
};
export default PointCloudShading;
