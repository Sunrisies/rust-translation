import {Layer} from '../Layer';
import * as Util from '../../core/Util';

/*
 * @class Path
 * @aka L.Path
 * @inherits Interactive layer
 *
 * 一个抽象类，包含在向量覆盖层（多边形、折线、Circle）之间共享的选项和常量。不要直接使用它，应扩展 `Layer` 类。
 * overlays (多边形, 折线, Circle). Do not use it directly. Extends `Layer`.
 */

export var Path = Layer.extend({

	// @section
	// @aka Path options
	options: {
		// @option stroke: Boolean = true
		// 是否沿路径绘制描边。将其设置为 `false` 可禁用多边形或圆形的边框。
		stroke: true,

		// @option color: String = '#3388ff'
		// 描边颜色
		color: '#3388ff',

		// @option weight: Number = 3
		// 像素单位的描边宽度
		weight: 3,

		// @option opacity: Number = 1.0
		// 描边透明度
		opacity: 1,

		// @option lineCap: String= 'round'
		// 定义描边端点形状的字符串，详见 [SVG 文档](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linecap)。
		lineCap: 'round',

		// @option lineJoin: String = 'round'
		// 定义描边角点形状的字符串，详见 [SVG 文档](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linejoin)。
		lineJoin: 'round',

		// @option dashArray: String = null
		// 定义描边虚线模式字符串，详见 [SVG 文档](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dasharray)。在 [某些旧浏览器](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility) 中无法在 `Canvas` 驱动的图层上使用。
		dashArray: null,

		// @option dashOffset: String = null
		// 定义虚线起始点距离字符串，详见 [SVG 文档](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dashoffset)。在 [某些旧浏览器](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility) 中无法在 `Canvas` 驱动的图层上使用。
		dashOffset: null,

		// @option fill: Boolean = depends
		// 是否用颜色填充路径。将其设置为 `false` 可禁用多边形或圆形的填充效果。
		fill: false,

		// @option fillColor: String = *
		// 填充颜色。默认值为 [`color`](#path-color) 选项的值。
		fillColor: null,

		// @option fillOpacity: Number = 0.2
		// 填充透明度。
		fillOpacity: 0.2,

		// @option fillRule: String = 'evenodd'
		// 定义形状内部填充规则的字符串，详见 [SVG 文档](https://developer.mozilla.org/docs/Web/SVG/Attribute/fill-rule)。
		fillRule: 'evenodd',

		// className: '',

		// 从“Interactive 图层”抽象类继承的选项。
		interactive: true,

		// @option bubblingMouseEvents: Boolean = true
		// 当 `true` 时，此路径上的鼠标事件将在地图上触发相同事件。
		// （除非使用了 [`L.DomEvent.stopPropagation`](#domevent-stoppropagation)）。
		bubblingMouseEvents: true
	},

	beforeAdd: function (map) {
		// 此处设置渲染器是因为我们需要在 `this.getEvents()` 之前调用 `renderer.getEvents()`。
		// 在更改路径坐标后，此操作可重新绘制图层。有时很有用。
		this._renderer = map.getRenderer(this);
	},

	onAdd: function () {
		this._renderer._initPath(this);
		this._reset();
		this._renderer._addPath(this);
	},

	onRemove: function () {
		this._renderer._removePath(this);
	},

	// @method redraw(): this
	// 根据 `Path options` 对象中的选项修改路径的外观。
	redraw: function () {
		if (this._map) {
			this._renderer._updatePath(this);
		}
		return this;
	},

	// @method setStyle(style: Path options): this
	// Changes the appearance of a Path based on the options in the `Path options` object.
	setStyle: function (style) {
		Util.setOptions(this, style);
		if (this._renderer) {
			this._renderer._updateStyle(this);
			if (this.options.stroke && style && Object.prototype.hasOwnProperty.call(style, 'weight')) {
				this._updateBounds();
			}
		}
		return this;
	},

	// @method bringToFront(): this
	// 将图层置于所有路径层的最上方。
	bringToFront: function () {
		if (this._renderer) {
			this._renderer._bringToFront(this);
		}
		return this;
	},

	// @method bringToBack(): this
	// 将该层置于所有路径层的底部。
	bringToBack: function () {
		if (this._renderer) {
			this._renderer._bringToBack(this);
		}
		return this;
	},

	getElement: function () {
		return this._path;
	},

	_reset: function () {
		// 在子类中定义
		this._project();
		this._update();
	},

	_clickTolerance: function () {
		// 用于Canvas 层的碰撞检测
		return (this.options.stroke ? this.options.weight / 2 : 0) +
		  (this._renderer.options.tolerance || 0);
	}
});
