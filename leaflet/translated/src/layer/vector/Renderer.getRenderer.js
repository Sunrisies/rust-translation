import {Map} from '../../map/Map';
import {canvas} from './Canvas';
import {svg} from './SVG';

Map.include({
	// @namespace Map; @method getRenderer(layer: Path): Renderer
	// 返回用于渲染给定
	// `Path` 的 `Renderer` 实例。它会确保地图和路径的 `renderer` 选项被遵循，并且该地图上存在相应的渲染器。
	// are respected, and that the renderers do exist on the 地图.
	getRenderer: function (layer) {
		// @namespace Path; @option renderer: Renderer
		// 针对此路径，使用这个特定的 `Renderer` 实例。它具有
		// 高于地图 [默认渲染器](#地图-renderer) 的优先级。
		var renderer = layer.options.renderer || this._getPaneRenderer(layer.options.pane) || this.options.renderer || this._renderer;

		if (!renderer) {
			renderer = this._renderer = this._createRenderer();
		}

		if (!this.hasLayer(renderer)) {
			this.addLayer(renderer);
		}
		return renderer;
	},

	_getPaneRenderer: function (name) {
		if (name === 'overlayPane' || name === undefined) {
			return false;
		}

		var renderer = this._paneRenderers[name];
		if (renderer === undefined) {
			renderer = this._createRenderer({pane: name});
			this._paneRenderers[name] = renderer;
		}
		return renderer;
	},

	_createRenderer: function (options) {
		// @namespace Map; @option preferCanvas: Boolean = false
		// 是否应在 `Canvas` 渲染器上渲染 `Path`。
		// 默认情况下，所有 `Path` 都通过 `SVG` 渲染器进行渲染。
		return (this.options.preferCanvas && canvas(options)) || svg(options);
	}
});
