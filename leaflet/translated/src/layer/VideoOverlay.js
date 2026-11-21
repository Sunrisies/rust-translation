import {ImageOverlay} from './ImageOverlay';
import * as DomUtil from '../dom/DomUtil';
import * as Util from '../core/Util';

/*
 * @class VideoOverlay
 * @aka L.VideoOverlay
 * @inherits ImageOverlay
 *
 * 用于在地图特定范围内加载和显示视频播放器。继承自 `ImageOverlay`。
 *
 * 视频覆盖层使用 [`<video>`](https://developer.mozilla.org/docs/Web/HTML/Element/video) 元素。
 * HTML5 元素。
 *
 * @example
 *
 * ```js
 * var videoUrl = 'https://www.mapbox.com/bites/00188/patricia_nasa.webm',
 * 	videoBounds = [[ 32, -130], [ 13, -100]];
 * L.videoOverlay(videoUrl, videoBounds ).addTo(map);
 * ```
 */

export var VideoOverlay = ImageOverlay.extend({

	// @section
	// @aka VideoOverlay options
	options: {
		// @option autoplay: Boolean = true
		// 当视频加载完成后是否自动开始播放。
		// 在某些浏览器中，自动播放仅适用于 `muted: true` 设置。
		autoplay: true,

		// @option loop: Boolean = true
		// 视频在播放时是否会循环回到开头。
		loop: true,

		// @option keepAspectRatio: Boolean = true
		// 投影后视频是否保留宽高比。
		// 与支持该功能的浏览器相关。请参阅 [浏览器兼容性说明](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit)。
		keepAspectRatio: true,

		// @option muted: Boolean = false
		// 视频加载时是否以静音状态开始播放。
		muted: false,

		// @option playsInline: Boolean = true
		// 移动浏览器会直接在原位置播放视频，而非全屏显示。
		playsInline: true
	},

	_initImage: function () {
		var wasElementSupplied = this._url.tagName === 'VIDEO';
		var vid = this._image = wasElementSupplied ? this._url : DomUtil.create('video');

		DomUtil.addClass(vid, 'leaflet-image-layer');
		if (this._zoomAnimated) { DomUtil.addClass(vid, 'leaflet-zoom-animated'); }
		if (this.options.className) { DomUtil.addClass(vid, this.options.className); }

		vid.onselectstart = Util.falseFn;
		vid.onmousemove = Util.falseFn;

		// @event load: Event
		// 当视频完成第一帧的加载后触发此事件。
		vid.onloadeddata = Util.bind(this.fire, this, 'load');

		if (wasElementSupplied) {
			var sourceElements = vid.getElementsByTagName('source');
			var sources = [];
			for (var j = 0; j < sourceElements.length; j++) {
				sources.push(sourceElements[j].src);
			}

			this._url = (sourceElements.length > 0) ? sources : [vid.src];
			return;
		}

		if (!Util.isArray(this._url)) { this._url = [this._url]; }

		if (!this.options.keepAspectRatio && Object.prototype.hasOwnProperty.call(vid.style, 'objectFit')) {
			vid.style['objectFit'] = 'fill';
		}
		vid.autoplay = !!this.options.autoplay;
		vid.loop = !!this.options.loop;
		vid.muted = !!this.options.muted;
		vid.playsInline = !!this.options.playsInline;
		for (var i = 0; i < this._url.length; i++) {
			var source = DomUtil.create('source');
			source.src = this._url[i];
			vid.appendChild(source);
		}
	}

	// @method getElement(): HTMLVideoElement
	// 返回 [`HTMLVideoElement`](https://developer.mozilla.org/docs/Web/API/HTMLVideoElement) 的实例。
	// 此覆盖层使用该实例。
});


// @factory L.videoOverlay(video: String|Array|HTMLVideoElement, bounds: LatLngBounds, options?: VideoOverlay options)
// 根据视频的 URL（或数组中的 URL，甚至视频元素）以及所关联的地理范围，实例化一个图像覆盖对象。
// 

export function videoOverlay(video, bounds, options) {
	return new VideoOverlay(video, bounds, options);
}
