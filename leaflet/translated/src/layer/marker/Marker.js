import {Layer} from '../Layer';
import {IconDefault} from './Icon.Default';
import * as Util from '../../core/Util';
import {toLatLng as latLng} from '../../geo/LatLng';
import {toPoint as point} from '../../geometry/Point';
import * as DomUtil from '../../dom/DomUtil';
import * as DomEvent from '../../dom/DomEvent';
import {MarkerDrag} from './Marker.Drag';

/*
 * @class Marker
 * @inherits Interactive layer
 * @aka L.Marker
 * L.Marker is used to display clickable/draggable icons on the map. Extends `Layer`.
 *
 * @example
 *
 * ```js
 * L.marker([50.5, 30.5]).addTo(map);
 * ```
 */

export var Marker = Layer.extend({

	// @section
	// @aka Marker options
	options: {
		// @option icon: Icon = *
		// 用于渲染标记的图标实例。
		// 有关如何自定义标记图标的详细信息，请参阅[Icon 文档](#L.Icon)。
		// 如果没有指定，则使用 `L.Icon.Default` 的默认实例。
		icon: new IconDefault(),

		// 从“Interactive 图层”抽象类继承的选项。
		interactive: true,

		// @option keyboard: Boolean = true
		// 是否可以通过键盘切换并按回车键点击该标记。
		keyboard: true,

		// @option title: String = ''
		// 在标记悬停时出现的浏览器工具提示文本（默认不显示工具提示）。
		// [Useful for accessibility](https://leafletjs.com/examples/accessibility/#markers-must-be-labelled).
		title: '',

		// @option alt: String = 'Marker'
		// 图标图像的 `alt` 属性对应的文本。
		// [Useful for accessibility](https://leafletjs.com/examples/accessibility/#markers-must-be-labelled).
		alt: 'Marker',

		// @option zIndexOffset: Number = 0
		// 默认情况下，标记图像的 z-index 会根据其纬度自动设置。如果您希望将标记置于所有其他元素之上或之下，可以指定较大的值，如 `1000`（或较大的负值）。
		zIndexOffset: 0,

		// @option opacity: Number = 1.0
		// 标记的不透明度。
		opacity: 1,

		// @option riseOnHover: Boolean = false
		// 如果设置为 `true`，当鼠标悬停在该标记上时，该标记会覆盖其他标记。
		riseOnHover: false,

		// @option riseOffset: Number = 250
		// 用于 `riseOnHover` 功能的 z-index 偏移量。
		riseOffset: 250,

		// @option pane: String = 'markerPane'
		// 添加标记图标的 `Map pane`。
		pane: 'markerPane',

		// @option shadowPane: String = 'shadowPane'
		// 添加标记阴影的 `Map pane`。
		shadowPane: 'shadowPane',

		// @option bubblingMouseEvents: Boolean = false
		// 如果设置为 `true`，该标记上的鼠标事件将触发地图上的相同事件。
		// （除非使用了 [`L.DomEvent.stopPropagation`](#domevent-stoppropagation)）。
		bubblingMouseEvents: false,

		// @option autoPanOnFocus: Boolean = true
		// 如果设置为 `true`，当标记获得焦点时，地图将会平移。
		// 例如，通过键盘按 `tab` 键来聚焦标记，以确保标记在地图范围内可见。
		// 标记是否可以通过鼠标或触摸进行拖动。
		autoPanOnFocus: true,

		// @section Draggable marker options
		// @option draggable: Boolean = false
		// Whether the 标记 is draggable with mouse/touch or not.
		draggable: false,

		// @option autoPan: Boolean = false
		// 在将标记拖到边缘附近时，是否应该平移地图。
		autoPan: false,

		// @option autoPanPadding: Point = Point(50, 50)
		// 开始平移地图时的距离（以像素为单位，向左/右和向上/下）。
		// 地图应平移的像素数。
		autoPanPadding: [50, 50],

		// @option autoPanSpeed: Number = 10
		// Number of pixels the 地图 should pan by.
		autoPanSpeed: 10
	},

	/* @section
	 *
	 * 除了 [共享层方法](#图层) 如 `addTo()` 和 `remove()` 以及 [弹出窗口方法](#弹出窗口) 如 bindPopup() 之外，还可以使用以下方法：
	 */

	initialize: function (latlng, options) {
		Util.setOptions(this, options);
		this._latlng = latLng(latlng);
	},

	onAdd: function (map) {
		this._zoomAnimated = this._zoomAnimated && map.options.markerZoomAnimation;

		if (this._zoomAnimated) {
			map.on('zoomanim', this._animateZoom, this);
		}

		this._initIcon();
		this.update();
	},

	onRemove: function (map) {
		if (this.dragging && this.dragging.enabled()) {
			this.options.draggable = true;
			this.dragging.removeHooks();
		}
		delete this.dragging;

		if (this._zoomAnimated) {
			map.off('zoomanim', this._animateZoom, this);
		}

		this._removeIcon();
		this._removeShadow();
	},

	getEvents: function () {
		return {
			zoom: this.update,
			viewreset: this.update
		};
	},

	// @method getLatLng: LatLng
	// 返回标记当前的地理位置。
	getLatLng: function () {
		return this._latlng;
	},

	// @method setLatLng(latlng: LatLng): this
	// 将标记位置更改为给定的点。
	setLatLng: function (latlng) {
		var oldLatLng = this._latlng;
		this._latlng = latLng(latlng);
		this.update();

		// @event move: Event
		// 当通过 [`setLatLng`](#标记-setlatlng) 或 [拖动](#标记-dragging) 移动标记时触发该事件。事件参数中包含旧坐标和新坐标，分别为 `oldLatLng` 和 `latlng`。
		return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
	},

	// @method setZIndexOffset(offset: Number): this
	// 更改标记的 [zIndex offset](#标记-zindexoffset)。
	setZIndexOffset: function (offset) {
		this.options.zIndexOffset = offset;
		return this.update();
	},

	// @method getIcon: Icon
	// 返回标记当前使用的图标。
	getIcon: function () {
		return this.options.icon;
	},

	// @method setIcon(icon: Icon): this
	// 更改标记图标。
	setIcon: function (icon) {

		this.options.icon = icon;

		if (this._map) {
			this._initIcon();
			this.update();
		}

		if (this._popup) {
			this.bindPopup(this._popup, this._popup.options);
		}

		return this;
	},

	getElement: function () {
		return this._icon;
	},

	update: function () {

		if (this._icon && this._map) {
			var pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(pos);
		}

		return this;
	},

	_initIcon: function () {
		var options = this.options,
		    classToAdd = 'leaflet-zoom-' + (this._zoomAnimated ? 'animated' : 'hide');

		var icon = options.icon.createIcon(this._icon),
		    addIcon = false;

		// 如果不再使用旧图标，则移除旧图标并初始化新图标。
		if (icon !== this._icon) {
			if (this._icon) {
				this._removeIcon();
			}
			addIcon = true;

			if (options.title) {
				icon.title = options.title;
			}

			if (icon.tagName === 'IMG') {
				icon.alt = options.alt || '';
			}
		}

		DomUtil.addClass(icon, classToAdd);

		if (options.keyboard) {
			icon.tabIndex = '0';
			icon.setAttribute('role', 'button');
		}

		this._icon = icon;

		if (options.riseOnHover) {
			this.on({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		if (this.options.autoPanOnFocus) {
			DomEvent.on(icon, 'focus', this._panOnFocus, this);
		}

		var newShadow = options.icon.createShadow(this._shadow),
		    addShadow = false;

		if (newShadow !== this._shadow) {
			this._removeShadow();
			addShadow = true;
		}

		if (newShadow) {
			DomUtil.addClass(newShadow, classToAdd);
			newShadow.alt = '';
		}
		this._shadow = newShadow;


		if (options.opacity < 1) {
			this._updateOpacity();
		}


		if (addIcon) {
			this.getPane().appendChild(this._icon);
		}
		this._initInteraction();
		if (newShadow && addShadow) {
			this.getPane(options.shadowPane).appendChild(this._shadow);
		}
	},

	_removeIcon: function () {
		if (this.options.riseOnHover) {
			this.off({
				mouseover: this._bringToFront,
				mouseout: this._resetZIndex
			});
		}

		if (this.options.autoPanOnFocus) {
			DomEvent.off(this._icon, 'focus', this._panOnFocus, this);
		}

		DomUtil.remove(this._icon);
		this.removeInteractiveTarget(this._icon);

		this._icon = null;
	},

	_removeShadow: function () {
		if (this._shadow) {
			DomUtil.remove(this._shadow);
		}
		this._shadow = null;
	},

	_setPos: function (pos) {

		if (this._icon) {
			DomUtil.setPosition(this._icon, pos);
		}

		if (this._shadow) {
			DomUtil.setPosition(this._shadow, pos);
		}

		this._zIndex = pos.y + this.options.zIndexOffset;

		this._resetZIndex();
	},

	_updateZIndex: function (offset) {
		if (this._icon) {
			this._icon.style.zIndex = this._zIndex + offset;
		}
	},

	_animateZoom: function (opt) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();

		this._setPos(pos);
	},

	_initInteraction: function () {

		if (!this.options.interactive) { return; }

		DomUtil.addClass(this._icon, 'leaflet-interactive');

		this.addInteractiveTarget(this._icon);

		if (MarkerDrag) {
			var draggable = this.options.draggable;
			if (this.dragging) {
				draggable = this.dragging.enabled();
				this.dragging.disable();
			}

			this.dragging = new MarkerDrag(this);

			if (draggable) {
				this.dragging.enable();
			}
		}
	},

	// @method setOpacity(opacity: Number): this
	// 更改标记的不透明度。
	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		if (this._map) {
			this._updateOpacity();
		}

		return this;
	},

	_updateOpacity: function () {
		var opacity = this.options.opacity;

		if (this._icon) {
			DomUtil.setOpacity(this._icon, opacity);
		}

		if (this._shadow) {
			DomUtil.setOpacity(this._shadow, opacity);
		}
	},

	_bringToFront: function () {
		this._updateZIndex(this.options.riseOffset);
	},

	_resetZIndex: function () {
		this._updateZIndex(0);
	},

	_panOnFocus: function () {
		var map = this._map;
		if (!map) { return; }

		var iconOpts = this.options.icon.options;
		var size = iconOpts.iconSize ? point(iconOpts.iconSize) : point(0, 0);
		var anchor = iconOpts.iconAnchor ? point(iconOpts.iconAnchor) : point(0, 0);

		map.panInside(this._latlng, {
			paddingTopLeft: anchor,
			paddingBottomRight: size.subtract(anchor)
		});
	},

	_getPopupAnchor: function () {
		return this.options.icon.options.popupAnchor;
	},

	_getTooltipAnchor: function () {
		return this.options.icon.options.tooltipAnchor;
	}
});


// factory Larker(latlng: LatLng, options? : 标记 options)

// @factory L.marker(latlng: LatLng, options? : Marker options)
// 根据地理点及可选选项对象创建标记对象。
export function marker(latlng, options) {
	return new Marker(latlng, options);
}
