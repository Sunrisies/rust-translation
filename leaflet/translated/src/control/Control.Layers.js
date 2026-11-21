
import {Control} from './Control';
import * as Util from '../core/Util';
import * as DomEvent from '../dom/DomEvent';
import * as DomUtil from '../dom/DomUtil';

/*
 * @class Control.Layers
 * @aka L.Control.Layers
 * @inherits Control
 *
 * 图层控制功能允许用户在不同基础层之间切换，并开启或关闭覆盖层（请参阅[详细示例](https://leafletjs.com/examples/layers-控件/)）。扩展了 `Control` 类。
 *
 * @example
 *
 * ```js
 * var baseLayers = {
 * 	"Mapbox": mapbox,
 * 	"OpenStreetMap": osm
 * };
 *
 * var overlays = {
 * 	"Marker": marker,
 * 	"Roads": roadsLayer
 * };
 *
 * L.control.layers(baseLayers, overlays).addTo(map);
 * ```
 *
 * The `baseLayers` and `overlays` parameters are object literals with layer names as keys and `Layer` objects as values:
 *
 * ```js
 * {
 *     "<someName1>": layer1,
 *     "<someName2>": layer2
 * }
 * ```
 *
 * The layer names can contain HTML, which allows you to add additional styling to the items:
 *
 * ```js
 * {"<img src='my-layer-icon' /> <span class='my-layer-item'>My Layer</span>": myLayer}
 * ```
 */

export var Layers = Control.extend({
	// @section
	// @aka Control.Layers options
	options: {
		// @option collapsed: Boolean = true
		// 如果设置为 `true`，该控件将在鼠标悬停、触摸或键盘激活时缩合成图标并展开。
		collapsed: true,
		position: 'topright',

		// @option autoZIndex: Boolean = true
		// 如果设置为 `true`，该控件会按递增顺序为所有图层分配 z-index 值，从而在开启或关闭这些图层时保持原有顺序。
		autoZIndex: true,

		// @option hideSingleBase: Boolean = false
		// 如果设置为 `true`，当只有一个基础层时，该控件中的基础层将被隐藏。
		hideSingleBase: false,

		// @option sortLayers: Boolean = false
		// 是否对图层进行排序。当设置为 `false` 时，图层将保持添加时的原始顺序。
		// 即它们被添加到控件时的顺序。
		sortLayers: false,

		// @option sortFunction: Function = *
		// 一个[比较函数](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)，当 `sortLayers` 设置为 `true` 时，该函数将用于对图层进行排序。
		// that will be used for sorting the layers, when `sortLayers` is `true`.
		// 该函数接收 `L.Layer` 实例及其名称，格式为
		// `sortFunction(layerA, layerB, nameA, nameB)`。
		// 默认情况下，按图层的名称进行字母排序。
		sortFunction: function (layerA, layerB, nameA, nameB) {
			return nameA < nameB ? -1 : (nameB < nameA ? 1 : 0);
		}
	},

	initialize: function (baseLayers, overlays, options) {
		Util.setOptions(this, options);

		this._layerControlInputs = [];
		this._layers = [];
		this._lastZIndex = 0;
		this._handlingClick = false;
		this._preventClick = false;

		for (var i in baseLayers) {
			this._addLayer(baseLayers[i], i);
		}

		for (i in overlays) {
			this._addLayer(overlays[i], i, true);
		}
	},

	onAdd: function (map) {
		this._initLayout();
		this._update();

		this._map = map;
		map.on('zoomend', this._checkDisabledLayers, this);

		for (var i = 0; i < this._layers.length; i++) {
			this._layers[i].layer.on('add remove', this._onLayerChange, this);
		}

		return this._container;
	},

	addTo: function (map) {
		Control.prototype.addTo.call(this, map);
		// 在图层控制元素被插入到 DOM 后触发展开操作，使其具有实际高度。
		return this._expandIfNotCollapsed();
	},

	onRemove: function () {
		this._map.off('zoomend', this._checkDisabledLayers, this);

		for (var i = 0; i < this._layers.length; i++) {
			this._layers[i].layer.off('add remove', this._onLayerChange, this);
		}
	},

	// @method addBaseLayer(layer: Layer, name: String): this
	// 向控件添加指定名称的基础层（单选按钮项）。
	addBaseLayer: function (layer, name) {
		this._addLayer(layer, name);
		return (this._map) ? this._update() : this;
	},

	// @method addOverlay(layer: Layer, name: String): this
	// 向控件添加指定名称的覆盖层（复选框项）。
	addOverlay: function (layer, name) {
		this._addLayer(layer, name, true);
		return (this._map) ? this._update() : this;
	},

	// @method removeLayer(layer: Layer): this
	// 从控件中移除指定的图层。
	removeLayer: function (layer) {
		layer.off('add remove', this._onLayerChange, this);

		var obj = this._getLayer(Util.stamp(layer));
		if (obj) {
			this._layers.splice(this._layers.indexOf(obj), 1);
		}
		return (this._map) ? this._update() : this;
	},

	// @method expand(): this
	// 如果控件是折叠状态，则展开其容器。
	expand: function () {
		DomUtil.addClass(this._container, 'leaflet-control-layers-expanded');
		this._section.style.height = null;
		var acceptableHeight = this._map.getSize().y - (this._container.offsetTop + 50);
		if (acceptableHeight < this._section.clientHeight) {
			DomUtil.addClass(this._section, 'leaflet-control-layers-scrollbar');
			this._section.style.height = acceptableHeight + 'px';
		} else {
			DomUtil.removeClass(this._section, 'leaflet-control-layers-scrollbar');
		}
		this._checkDisabledLayers();
		return this;
	},

	// @method collapse(): this
	// 如果控件是展开状态，则折叠其容器。
	collapse: function () {
		DomUtil.removeClass(this._container, 'leaflet-control-layers-expanded');
		return this;
	},

	_initLayout: function () {
		var className = 'leaflet-control-layers',
		    container = this._container = DomUtil.create('div', className),
		    collapsed = this.options.collapsed;

		// 通过在触摸释放时阻止触发鼠标离开事件，使此功能在 IE 触摸设备上正常工作。
		container.setAttribute('aria-haspopup', true);

		DomEvent.disableClickPropagation(container);
		DomEvent.disableScrollPropagation(container);

		var section = this._section = DomUtil.create('section', className + '-list');

		if (collapsed) {
			this._map.on('click', this.collapse, this);

			DomEvent.on(container, {
				mouseenter: this._expandSafely,
				mouseleave: this.collapse
			}, this);
		}

		var link = this._layersLink = DomUtil.create('a', className + '-toggle', container);
		link.href = '#';
		link.title = 'Layers';
		link.setAttribute('role', 'button');

		DomEvent.on(link, {
			keydown: function (e) {
				if (e.keyCode === 13) {
					this._expandSafely();
				}
			},
			// 某些屏幕阅读器会拦截按键事件，并发送点击事件作为替代。
			click: function (e) {
				DomEvent.preventDefault(e);
				this._expandSafely();
			}
		}, this);

		if (!collapsed) {
			this.expand();
		}

		this._baseLayersList = DomUtil.create('div', className + '-base', section);
		this._separator = DomUtil.create('div', className + '-separator', section);
		this._overlaysList = DomUtil.create('div', className + '-overlays', section);

		container.appendChild(section);
	},

	_getLayer: function (id) {
		for (var i = 0; i < this._layers.length; i++) {

			if (this._layers[i] && Util.stamp(this._layers[i].layer) === id) {
				return this._layers[i];
			}
		}
	},

	_addLayer: function (layer, name, overlay) {
		if (this._map) {
			layer.on('add remove', this._onLayerChange, this);
		}

		this._layers.push({
			layer: layer,
			name: name,
			overlay: overlay
		});

		if (this.options.sortLayers) {
			this._layers.sort(Util.bind(function (a, b) {
				return this.options.sortFunction(a.layer, b.layer, a.name, b.name);
			}, this));
		}

		if (this.options.autoZIndex && layer.setZIndex) {
			this._lastZIndex++;
			layer.setZIndex(this._lastZIndex);
		}

		this._expandIfNotCollapsed();
	},

	_update: function () {
		if (!this._container) { return this; }

		DomUtil.empty(this._baseLayersList);
		DomUtil.empty(this._overlaysList);

		this._layerControlInputs = [];
		var baseLayersPresent, overlaysPresent, i, obj, baseLayersCount = 0;

		for (i = 0; i < this._layers.length; i++) {
			obj = this._layers[i];
			this._addItem(obj);
			overlaysPresent = overlaysPresent || obj.overlay;
			baseLayersPresent = baseLayersPresent || !obj.overlay;
			baseLayersCount += !obj.overlay ? 1 : 0;
		}

		// 如果只有一个图层，则隐藏基础层部分。
		if (this.options.hideSingleBase) {
			baseLayersPresent = baseLayersPresent && baseLayersCount > 1;
			this._baseLayersList.style.display = baseLayersPresent ? '' : 'none';
		}

		this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';

		return this;
	},

	_onLayerChange: function (e) {
		if (!this._handlingClick) {
			this._update();
		}

		var obj = this._getLayer(Util.stamp(e.target));

		// @namespace Map
		// @section Layer events
		// @event baselayerchange: LayersControlEvent
		// 当通过[图层控制](#控件-layers)更改基础层时触发该事件。
		// @event overlayadd: LayersControlEvent
		// 当通过[图层控制](#控件-layers)选择覆盖层时触发该事件。
		// @event overlayremove: LayersControlEvent
		// 当通过[图层控制](#控件-layers)取消选择覆盖层时触发该事件。
		// @namespace Control.Layers
		var type = obj.overlay ?
			(e.type === 'add' ? 'overlayadd' : 'overlayremove') :
			(e.type === 'add' ? 'baselayerchange' : null);

		if (type) {
			this._map.fire(type, obj);
		}
	},

	// 如果动态创建单选按钮，IE7 会出现问题，因此必须采用这种 hack 方式（参见 https://stackoverflow.com/a/119079）。
	_createRadioElement: function (name, checked) {

		var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' +
				name + '"' + (checked ? ' checked="checked"' : '') + '/>';

		var radioFragment = document.createElement('div');
		radioFragment.innerHTML = radioHtml;

		return radioFragment.firstChild;
	},

	_addItem: function (obj) {
		var label = document.createElement('label'),
		    checked = this._map.hasLayer(obj.layer),
		    input;

		if (obj.overlay) {
			input = document.createElement('input');
			input.type = 'checkbox';
			input.className = 'leaflet-control-layers-selector';
			input.defaultChecked = checked;
		} else {
			input = this._createRadioElement('leaflet-base-layers_' + Util.stamp(this), checked);
		}

		this._layerControlInputs.push(input);
		input.layerId = Util.stamp(obj.layer);

		DomEvent.on(input, 'click', this._onInputClick, this);

		var name = document.createElement('span');
		name.innerHTML = ' ' + obj.name;

		// 有助于防止复选框处于禁用状态时层控制出现闪烁现象
		// https://github.com/Leaflet/Leaflet/issues/2771
		var holder = document.createElement('span');

		label.appendChild(holder);
		holder.appendChild(input);
		holder.appendChild(name);

		var container = obj.overlay ? this._overlaysList : this._baseLayersList;
		container.appendChild(label);

		this._checkDisabledLayers();
		return label;
	},

	_onInputClick: function () {
		// 通过点击即可扩展移动设备上的控制功能，这可能会导致添加图层——我们不希望这种情况发生
		if (this._preventClick) {
			return;
		}

		var inputs = this._layerControlInputs,
		    input, layer;
		var addedLayers = [],
		    removedLayers = [];

		this._handlingClick = true;

		for (var i = inputs.length - 1; i >= 0; i--) {
			input = inputs[i];
			layer = this._getLayer(input.layerId).layer;

			if (input.checked) {
				addedLayers.push(layer);
			} else if (!input.checked) {
				removedLayers.push(layer);
			}
		}

		// 缺陷修复问题 2318：在添加新图层之前应移除所有旧图层
		for (i = 0; i < removedLayers.length; i++) {
			if (this._map.hasLayer(removedLayers[i])) {
				this._map.removeLayer(removedLayers[i]);
			}
		}
		for (i = 0; i < addedLayers.length; i++) {
			if (!this._map.hasLayer(addedLayers[i])) {
				this._map.addLayer(addedLayers[i]);
			}
		}

		this._handlingClick = false;

		this._refocusOnMap();
	},

	_checkDisabledLayers: function () {
		var inputs = this._layerControlInputs,
		    input,
		    layer,
		    zoom = this._map.getZoom();

		for (var i = inputs.length - 1; i >= 0; i--) {
			input = inputs[i];
			layer = this._getLayer(input.layerId).layer;
			input.disabled = (layer.options.minZoom !== undefined && zoom < layer.options.minZoom) ||
			                 (layer.options.maxZoom !== undefined && zoom > layer.options.maxZoom);

		}
	},

	_expandIfNotCollapsed: function () {
		if (this._map && !this.options.collapsed) {
			this.expand();
		}
		return this;
	},

	_expandSafely: function () {
		var section = this._section;
		this._preventClick = true;
		DomEvent.on(section, 'click', DomEvent.preventDefault);
		this.expand();
		var that = this;
		setTimeout(function () {
			DomEvent.off(section, 'click', DomEvent.preventDefault);
			that._preventClick = false;
		});
	}

});


// @factory L.control.layers(baselayers?: Object, overlays?: Object, options?: Control.Layers options)
// 根据给定的图层创建一层控制面板。基础层将通过单选按钮进行切换，而叠加层则通过复选框进行切换。请注意，所有基础层都应传入基础层对象中，但在地图实例化时仅应添加一个基础层到地图上。
export var layers = function (baseLayers, overlays, options) {
	return new Layers(baseLayers, overlays, options);
};
