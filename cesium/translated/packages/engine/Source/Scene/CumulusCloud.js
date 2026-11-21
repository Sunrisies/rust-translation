import {
  Cartesian2,
  Cartesian3,
  Check,
  Color,
  Frozen,
  defined,
} from "@cesium/core";

/**
 * <div class="notice">
 * 通过调用 {@link CloudCollection#add} 创建云并设置其初始属性。
 * 以及 {@link CloudCollection#remove}。不要直接调用构造函数。
 * </div>
 * 位于 3D 场景中的积云广告牌，使用 {@link CloudCollection} 创建和渲染。
 * <br /><br />
 * <div align='center'>
 * <img src='Images/CumulusCloud.png' width='400' height='300' /><br />
 * 积云示例
 * </div>
 * @alias CumulusCloud
 *
 * @performance Similar 对 {@link Billboard} 调用属性，例如 {@link CumulusCloud#show}，
 * 需要常数时间。将值赋给属性也是常数时间，但会导致
 * 当调用 {@link CloudCollection#update} 时产生 CPU 到 GPU 的数据传输。每个云的传输量
 * 与更新的属性数量无关。如果集合中的大多数云都需要
 * 更新，使用 {@link CloudCollection#removeAll} 清空集合可能更高效
 * 然后添加新云，而不是修改每个云。
 *
 * @see CloudCollection
 * @see CloudCollection#add
 *
 * @internalConstructor
 * @class
 *
 * @demo {@link https://sandcastle.cesium.com/index.html?id=cloud-parameters|Cesium Sandcastle Cloud Parameters Demo}
 */
function CumulusCloud(options, cloudCollection) {
  options = options ?? Frozen.EMPTY_OBJECT;
  this._show = options.show ?? true;

  this._position = Cartesian3.clone(options.position ?? Cartesian3.ZERO);

  if (!defined(options.scale) && defined(options.maximumSize)) {
    this._maximumSize = Cartesian3.clone(options.maximumSize);
    this._scale = new Cartesian2(this._maximumSize.x, this._maximumSize.y);
  } else {
    this._scale = Cartesian2.clone(options.scale ?? new Cartesian2(20.0, 12.0));

    const defaultMaxSize = new Cartesian3(
      this._scale.x,
      this._scale.y,
      Math.min(this._scale.x, this._scale.y) / 1.5,
    );
    this._maximumSize = Cartesian3.clone(options.maximumSize ?? defaultMaxSize);
  }

  this._slice = options.slice ?? -1.0;
  this._color = Color.clone(options.color ?? Color.WHITE);
  this._brightness = options.brightness ?? 1.0;
  this._cloudCollection = cloudCollection;
  this._index = -1; // Used by CloudCollection
}

const SHOW_INDEX = (CumulusCloud.SHOW_INDEX = 0);
const POSITION_INDEX = (CumulusCloud.POSITION_INDEX = 1);
const SCALE_INDEX = (CumulusCloud.SCALE_INDEX = 2);
const MAXIMUM_SIZE_INDEX = (CumulusCloud.MAXIMUM_SIZE_INDEX = 3);
const SLICE_INDEX = (CumulusCloud.SLICE_INDEX = 4);
const BRIGHTNESS_INDEX = (CumulusCloud.BRIGHTNESS_INDEX = 5);
const COLOR_INDEX = (CumulusCloud.COLOR_INDEX = 6);
CumulusCloud.NUMBER_OF_PROPERTIES = 7;

function makeDirty(cloud, propertyChanged) {
  const cloudCollection = cloud._cloudCollection;
  if (defined(cloudCollection)) {
    cloudCollection._updateCloud(cloud, propertyChanged);
    cloud._dirty = true;
  }
}

Object.defineProperties(CumulusCloud.prototype, {
  /**
   * 决定此积云是否显示。使用此功能隐藏或显示云，而不是
   * 移除它并重新添加到集合中。
   * @memberof CumulusCloud.prototype
   * @type {boolean}
   * @default true
   */
  show: {
    get: function () {
      return this._show;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug);
      Check.typeOf.bool("value", value);
      //>>includeEnd('debug');

      if (this._show !== value) {
        this._show = value;
        makeDirty(this, SHOW_INDEX);
      }
    },
  },

  /**
   * 获取或设置此积云的笛卡尔位置。
   * @memberof CumulusCloud.prototype
   * @type {Cartesian3}
   */
  position: {
    get: function () {
      return this._position;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug)
      Check.typeOf.object("value", value);
      //>>includeEnd('debug');

      const position = this._position;
      if (!Cartesian3.equals(position, value)) {
        Cartesian3.clone(value, position);
        makeDirty(this, POSITION_INDEX);
      }
    },
  },

  /**
   * <p>获取或设置积云广告牌的缩放比例（以米为单位）。
   * <code>scale</code> 属性会影响广告牌的大小，
   * 但不会影响云的实际外观。
   * <div align='center'>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'>
   * <code>cloud.scale = new Cesium.Cartesian2(12, 8);</code><br/>
   * <img src='Images/CumulusCloud.scalex12y8.png' width='250' height='158' />
   * </td>
   * <td align='center'>
   * <code>cloud.scale = new Cesium.Cartesian2(24, 10);</code><br/>
   * <img src='Images/CumulusCloud.scalex24y10.png' width='250' height='158' />
   * </td>
   * </tr></table>
   * </div>
   *
   * <p>要修改云的外观，需修改其 <code>maximumSize</code>
   * 和 <code>slice</code> 属性。
   * @memberof CumulusCloud.prototype
   * @type {Cartesian2}
   *
   * @see CumulusCloud#maximumSize
   * @see CumulusCloud#slice
   */
  scale: {
    get: function () {
      return this._scale;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug)
      Check.typeOf.object("value", value);
      //>>includeEnd('debug');

      const scale = this._scale;
      if (!Cartesian2.equals(scale, value)) {
        Cartesian2.clone(value, scale);
        makeDirty(this, SCALE_INDEX);
      }
    },
  },

  /**
   * 获取或设置广告牌上渲染的积云的最大大小。
   * 这定义了云可以出现的最大椭球体积。
   * 与其保证特定大小，不如指定云出现的边界，
   * 更改此边界会影响云的形状。
   * 更改 <code>maximumSize</code> 的 z 值对云外观的影响最大，
   * 因为它改变了云的深度，从而改变云的外观。
   * 云形纹理被采样的位置。</p>
   * <div align='center'>
   * <table border='0' cellpadding='5'>
   * <tr>
   * <td align='center'>
   * <code>cloud.maximumSize = new Cesium.Cartesian3(14, 9, 10);</code><br/>
   * <img src='Images/CumulusCloud.maximumSizex14y9z10.png' width='250' height='158' />
   *   </td>
   * <td align='center'>
   * <code>cloud.maximumSize.x = 25;</code><br/>
   * <img src='Images/CumulusCloud.maximumSizex25.png' width='250' height='158' />
   *   </td>
   * </tr>
   * <tr>
   * <td align='center'>
   * <code>cloud.maximumSize.y = 5;</code><br/>
   * <img src='Images/CumulusCloud.maximumSizey5.png' width='250' height='158' />
   *   </td>
   * <td align='center'>
   * <code>cloud.maximumSize.z = 17;</code><br/>
   * <img src='Images/CumulusCloud.maximumSizez17.png' width='250' height='158' />
   *   </td>
   * </tr>
   * </table>
   * </div>
   *
   * <p>要修改广告牌的实际大小，请修改云的 <code>scale</code> 属性。</p>
   * @memberof CumulusCloud.prototype
   * @type {Cartesian3}
   *
   * @see CumulusCloud#scale
   */
  maximumSize: {
    get: function () {
      return this._maximumSize;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug)
      Check.typeOf.object("value", value);
      //>>includeEnd('debug');

      const maximumSize = this._maximumSize;
      if (!Cartesian3.equals(maximumSize, value)) {
        Cartesian3.clone(value, maximumSize);
        makeDirty(this, MAXIMUM_SIZE_INDEX);
      }
    },
  },
  /**
   * 设置云的颜色
   * @memberof CumulusCloud.prototype
   * @type {Color}
   * @default Color.WHITE
   */
  color: {
    get: function () {
      return this._color;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug)
      Check.typeOf.object("value", value);
      //>>includeEnd('debug');

      const color = this._color;
      if (!Color.equals(color, value)) {
        Color.clone(value, color);
        makeDirty(this, COLOR_INDEX);
      }
    },
  },
  /**
   * <p>获取或设置在广告牌上显示的云的“切片”，即
   * 选择用于广告牌外观的特定云截面。
   * 给定一个介于 0 和 1 之间的值，该切片指定了云在 z 方向的最大尺寸下深入的程度。</p>
   * </p>
   * <div align='center'>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'><code>cloud.slice = 0.32;</code><br/><img src='Images/CumulusCloud.slice0.32.png' width='250' height='158' /></td>
   * <td align='center'><code>cloud.slice = 0.5;</code><br/><img src='Images/CumulusCloud.slice0.5.png' width='250' height='158' /></td>
   * <td align='center'><code>cloud.slice = 0.6;</code><br/><img src='Images/CumulusCloud.slice0.6.png' width='250' height='158' /></td>
   * </tr></table>
   * </div>
   *
   * <br />
   * <p>由于该切片的计算方式，
   * 小于 <code>0.2</code> 的值可能导致截面过小，
   * 从而椭圆边缘会显现出来。同样，大于 <code>0.7</code> 的值
   * 会使云看起来更小。超出 <code>[0.1, 0.9]</code> 范围的值
   * 应完全避免，因为它们无法产生理想的结果。</p>
   *
   * <div align='center'>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'><code>cloud.slice = 0.08;</code><br/><img src='Images/CumulusCloud.slice0.08.png' width='250' height='158' /></td>
   * <td align='center'><code>cloud.slice = 0.8;</code><br/><img src='Images/CumulusCloud.slice0.8.png' width='250' height='158' /></td>
   * </tr></table>
   * </div>
   *
   * <p>如果将 <code>slice</code> 设置为负数，云将不会显示截面。
   * 相反，它将显示可见的椭球体外部。对于具有
   * 较小 <code>maximumSize.z</code> 值的云，这可以产生美观的效果，但对于较大的
   * 云，则可能导致云被不希望地扭曲到椭球体体积上。</p>
   *
   * <div align='center'>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'>
   * <code>cloud.slice = -1.0;<br/>cloud.maximumSize.z = 18;</code><br/>
   * <img src='Images/CumulusCloud.slice-1z18.png' width='250' height='158' />
   * </td>
   * <td align='center'>
   * <code>cloud.slice = -1.0;<br/>cloud.maximumSize.z = 30;</code><br/>
   * <img src='Images/CumulusCloud.slice-1z30.png' width='250' height='158' /></td>
   * </tr></table>
   * </div>
   *
   * @memberof CumulusCloud.prototype
   * @type {number}
   * @default -1.0
   */
  slice: {
    get: function () {
      return this._slice;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug)
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');

      const slice = this._slice;
      if (slice !== value) {
        this._slice = value;
        makeDirty(this, SLICE_INDEX);
      }
    },
  },

  /**
   * 获取或设置云的亮度。这可用于使云呈现
   * 更暗、更灰的外观。
   * <br /><br />
   * <div align='center'>
   * <table border='0' cellpadding='5'><tr>
   * <td align='center'><code>cloud.brightness = 1.0;</code><br/><img src='Images/CumulusCloud.brightness1.png' width='250' height='158' /></td>
   * <td align='center'><code>cloud.brightness = 0.6;</code><br/><img src='Images/CumulusCloud.brightness0.6.png' width='250' height='158' /></td>
   * <td align='center'><code>cloud.brightness = 0.0;</code><br/><img src='Images/CumulusCloud.brightness0.png' width='250' height='158' /></td>
   * </tr></table>
   * </div>
   * @memberof CumulusCloud.prototype
   * @type {number}
   * @default 1.0
   */
  brightness: {
    get: function () {
      return this._brightness;
    },
    set: function (value) {
      //>>includeStart('debug', pragmas.debug)
      Check.typeOf.number("value", value);
      //>>includeEnd('debug');

      const brightness = this._brightness;
      if (brightness !== value) {
        this._brightness = value;
        makeDirty(this, BRIGHTNESS_INDEX);
      }
    },
  },
});

CumulusCloud.prototype._destroy = function () {
  this._cloudCollection = undefined;
};

export default CumulusCloud;
