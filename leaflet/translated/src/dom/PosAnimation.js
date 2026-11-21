import * as Util from '../core/Util';
import {Evented} from '../core/Events';
import * as DomUtil from '../dom/DomUtil';


/*
 * @class PosAnimation
 * @aka L.PosAnimation
 * @inherits Evented
 * 在内部用于平移动画，使用 CSS3 过渡效果支持现代浏览器，并在 IE6-9 中采用计时 fallback 方案。
 *
 * @example
 * ```js
 * var myPositionMarker = L.marker([48.864716, 2.294694]).addTo(map);
 *
 * myPositionMarker.on("click", function() {
 * 	var pos = map.latLngToLayerPoint(myPositionMarker.getLatLng());
 * 	pos.y -= 25;
 * 	var fx = new L.PosAnimation();
 *
 * 	fx.once('end',function() {
 * 		pos.y += 25;
 * 		fx.run(myPositionMarker._icon, pos, 0.8);
 * 	});
 *
 * 	fx.run(myPositionMarker._icon, pos, 0.3);
 * });
 *
 * ```
 *
 * @constructor L.PosAnimation()
 * 创建 `PosAnimation` 对象。
 *
 */

export var PosAnimation = Evented.extend({

	// @method run(el: HTMLElement, newPos: Point, duration?: Number, easeLinearity?: Number)
	// 对指定元素执行动画，使其移动到新位置，可选项设置
	// 秒数时长（默认值为 `0.25`）和缓动线性因子（[三次贝塞尔曲线](https://cubic-bezier.com/#0,0,.5,1)的第三个参数）。
	// 默认值为 `0.5`。
	// `0.5` by default).
	run: function (el, newPos, duration, easeLinearity) {
		this.stop();

		this._el = el;
		this._inProgress = true;
		this._duration = duration || 0.25;
		this._easeOutPower = 1 / Math.max(easeLinearity || 0.5, 0.2);

		this._startPos = DomUtil.getPosition(el);
		this._offset = newPos.subtract(this._startPos);
		this._startTime = +new Date();

		// @event start: Event
		// 在动画开始时触发。
		this.fire('start');

		this._animate();
	},

	// @method stop()
	// 停止当前正在运行的动画。
	stop: function () {
		if (!this._inProgress) { return; }

		this._step(true);
		this._complete();
	},

	_animate: function () {
		// 动画循环。
		this._animId = Util.requestAnimFrame(this._animate, this);
		this._step();
	},

	_step: function (round) {
		var elapsed = (+new Date()) - this._startTime,
		    duration = this._duration * 1000;

		if (elapsed < duration) {
			this._runFrame(this._easeOut(elapsed / duration), round);
		} else {
			this._runFrame(1);
			this._complete();
		}
	},

	_runFrame: function (progress, round) {
		var pos = this._startPos.add(this._offset.multiplyBy(progress));
		if (round) {
			pos._round();
		}
		DomUtil.setPosition(this._el, pos);

		// @event step: Event
		// 在动画期间持续触发。
		this.fire('step');
	},

	_complete: function () {
		Util.cancelAnimFrame(this._animId);

		this._inProgress = false;
		// @event end: Event
		// 在动画结束时触发。
		this.fire('end');
	},

	_easeOut: function (t) {
		return 1 - Math.pow(1 - t, this._easeOutPower);
	}
});
