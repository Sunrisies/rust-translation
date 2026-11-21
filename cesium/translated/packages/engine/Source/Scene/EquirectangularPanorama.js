import {
  Cartesian2,
  DeveloperError,
  Frozen,
  GeometryInstance,
  Matrix4,
  SphereGeometry,
  VertexFormat,
  defined,
  destroyObject,
} from "@cesium/core";
import Credit from "../Core/Credit.js";
import Material from "./Material.js";
import MaterialAppearance from "./MaterialAppearance.js";
import Primitive from "./Primitive.js";

const DEFAULT_RADIUS = 100000.0;

/**
 * @typedef {object} EquirectangularPanorama.ConstructorOptions
 *
 * EquirectangularPanorama 构造器的初始化选项
 *
 * @property {Matrix4} options.transform 定义全景图位置和方向的 4x4 变换矩阵
 * （例如，由位置与航向-俯仰-滚转组合得到）
 * @property {string|HTMLImageElement|HTMLCanvasElement|ImageBitmap} options.image 指向图像资源的 URL，或预加载的图像对象
 * @property {number} [options.radius=100000.0] 全景图的半径，单位：米
 * @property {number} [options.repeatHorizontal=1.0] 纹理在水平方向上重复的次数
 * @property {number} [options.repeatVertical=1.0] 纹理在垂直方向上重复的次数
 * @property {Credit|string} [options.credit] 显示在画布上的全景图版权信息
 */

/**
 * 在场景中以等距矩形格式显示影像的 {@link Panorama}
 *
 * @alias EquirectangularPanorama
 * @constructor
 *
 * @param {EquirectangularPanorama.ConstructorOptions} options 描述初始化选项的对象
 *
 * @example
 * const position = Cesium.Cartesian3.fromDegrees(
 * -75.1699,  // 经度
 * 39.9522,   // 纬度
 * 100.0      // 高度，单位：米
 * );
 *
 * const heading = Cesium.Math.toRadians(45.0); // 绕垂直轴的旋转角度
 * const pitch = Cesium.Math.toRadians(-30.0);   // 俯仰角（负值表示向下）
 * const roll = Cesium.Math.toRadians(10.0);    // 滚转角，关于前进轴
 *
 * const hpr = new Cesium.HeadingPitchRoll(
 * heading,
 * pitch,
 * roll
 * );
 *
 * const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
 * position,
 * hpr,
 * Cesium.Ellipsoid.WGS84,
 * Cesium.Transforms.eastNorthUpToFixedFrame
 * );
 *
 * scene.primitives.add(new Cesium.EquirectangularPanorama({
 * transform: modelMatrix,
 * image: 'path/to/image',
 * }));
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=panorama|Cesium Sandcastle Panorama}
 */
function EquirectangularPanorama(options) {
  options = options ?? Frozen.EMPTY_OBJECT;

  //>>includeStart('debug', pragmas.debug);
  if (!defined(options.image)) {
    throw new DeveloperError("options.image is required.");
  }

  if (defined(options.transform) && !(options.transform instanceof Matrix4)) {
    throw new DeveloperError("options.transform must be a Matrix4.");
  }
  //>>includeEnd('debug');

  // Credit specified by the user.
  let credit = options.credit;
  if (typeof credit === "string") {
    credit = new Credit(credit);
  }
  this._credit = credit;

  this._radius = defined(options.radius) ? options.radius : DEFAULT_RADIUS;
  this._image = options.image;
  this._transform = defined(options.transform)
    ? options.transform
    : Matrix4.IDENTITY;
  this._repeatHorizontal = defined(options.repeatHorizontal)
    ? options.repeatHorizontal
    : 1.0;
  this._repeatVertical = defined(options.repeatVertical)
    ? options.repeatVertical
    : 1.0;

  const geometry = new SphereGeometry({
    radius: this._radius,
    vertexFormat: VertexFormat.ALL,
  });

  const geometryInstance = new GeometryInstance({
    geometry: geometry,
    modelMatrix: this._transform,
  });

  const equirectangularMaterial = new Material({
    fabric: {
      type: "Image",
      uniforms: {
        image: this._image, // 2:1 360 degrees equirectangular image path
        repeat: new Cartesian2(-this._repeatHorizontal, this._repeatVertical), // flip horizontally by default to match expected orientation of images inside a sphere, but allow user to override
      },
    },
  });

  // Create the primitive with the material
  this._primitive = new Primitive({
    geometryInstances: geometryInstance,
    appearance: new MaterialAppearance({
      material: equirectangularMaterial,
      closed: true,
      faceForward: false,
      flat: true,
      translucent: false,
      renderState: {
        cull: {
          enabled: false, // show inside of sphere
        },
      },
    }),
    credit: this._credit,
  });

  return this;
}

Object.defineProperties(EquirectangularPanorama.prototype, {
  /**
   * 获取全景图的半径
   * @memberof EquirectangularPanorama.prototype
   * @type {number}
   * @readonly
   */
  radius: {
    get: function () {
      return this._radius;
    },
  },

  /**
   * 获取全景图的源图像
   * @memberof EquirectangularPanorama.prototype
   * @type {string|HTMLImageElement|HTMLCanvasElement|ImageBitmap}
   * @readonly
   */
  image: {
    get: function () {
      return this._image;
    },
  },

  /**
   * 获取全景图的变换矩阵
   * @memberof EquirectangularPanorama.prototype
   * @type {Matrix4}
   * @readonly
   */
  transform: {
    get: function () {
      return this._transform;
    },
  },

  /**
   * 获取全景图的版权信息
   * @memberof EquirectangularPanorama.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return defined(this._credit) ? this._credit : undefined;
    },
  },

  /**
   * 决定是否显示等距矩形全景图
   * @memberof EquirectangularPanorama.prototype
   * @type {boolean}
   */
  show: {
    get: function () {
      return defined(this._primitive) ? this._primitive.show : undefined;
    },
    set: function (value) {
      if (defined(this._primitive)) {
        this._primitive.show = value;
      }
    },
  },
});

// Proxy update/destroy/etc to the primitive

/**
 * 在 {@link Viewer} 或 {@link CesiumWidget} 渲染场景时调用，以获取渲染此基本体的所需绘制命令
 * 不要直接调用此函数。此文档仅用于列出渲染场景时可能产生的异常：
 * <p>
 * 会销毁该对象持有的 WebGL 资源。销毁对象允许确定性地释放 WebGL 资源，而无需依赖垃圾回收器来销毁该对象
 * 一旦对象被销毁，就不应再使用它；调用除
 * </p>
 *
 */
EquirectangularPanorama.prototype.update = function (frameState) {
  if (defined(this._credit)) {
    frameState.creditDisplay.addCreditToNextFrame(this._credit);
  }

  return this._primitive.update(frameState);
};

/**
 * <code>isDestroyed</code> 之外的任何函数都将引发 {@link DeveloperError} 异常。因此，
 * 将返回值（<code>undefined</code>）赋给对象，如示例中所示
 * <br /><br />
 * 对象已被销毁，即调用了 destroy()
 * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
 * assign the return value (<code>undefined</code>) to the object as done in the example.
 *
 * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
 *
 *
 * @example
 * equirectangularPanorama = equirectangularPanorama && equirectangularPanorama.destroy();
 *
 * @see EquirectangularPanorama#isDestroyed
 */
EquirectangularPanorama.prototype.destroy = function () {
  this._primitive = this._primitive && this._primitive.destroy();
  return destroyObject(this);
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将引发 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 true；否则返回 <code>false</code>。
 *
 * @see EquirectangularPanorama#destroy
 */

EquirectangularPanorama.prototype.isDestroyed = function () {
  return this._primitive.isDestroyed();
};

// Exposed for tests
export default EquirectangularPanorama;