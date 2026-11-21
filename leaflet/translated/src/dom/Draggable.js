import {Evented} from '../core/Events';
import Browser from '../core/Browser';
import * as DomEvent from './DomEvent';
import * as DomUtil from './DomUtil';
import * as Util from '../core/Util';
import {Point} from '../geometry/Point';

/*
 * @class Draggable
 * @aka L.Draggable
 * @inherits Evented
 *
 * 一个用于使DOM元素可拖拽的类（包含触摸支持）。
 * 在地图和标记拖拽中内部使用。仅适用于通过 [`L.DomUtil.setPosition`](#domutil-setposition) 定位的元素。
 * 
 *
 * @example
 * ```js
 * var draggable = new L.Draggable(elementToDrag);
 * draggable.enable();
 * ```
 */

var START = Browser.touch ? 'touchstart mousedown' : 'mousedown';

export var Draggable = Evented.extend({

	options: {
		// @section
		// @aka Draggable options
		// @option clickTolerance: Number = 3
		// 用户在点击时可以移动鼠标指针的最大像素数，以被视为有效的点击（而非鼠标拖拽）。
		// 
		clickTolerance: 3
	},

	// @constructor L.Draggable(el: HTMLElement, dragHandle?: HTMLElement, preventOutline?: Boolean, options?: Draggable options)
	// 创建一个 `Draggable` 对象，用于在拖动 `dragHandle` 元素时移动 `el`（默认等于 `el` 本身）。
	initialize: function (element, dragStartTarget, preventOutline, options) {
		Util.setOptions(this, options);

		this._element = element;
		this._dragStartTarget = dragStartTarget || element;
		this._preventOutline = preventOutline;
	},

	// @method enable()
	// 启用拖拽功能
	enable: function () {
		if (this._enabled) { return; }

		DomEvent.on(this._dragStartTarget, START, this._onDown, this);

		this._enabled = true;
	},

	// @method disable()
	// 禁用拖拽功能
	disable: function () {
		if (!this._enabled) { return; }

		// 如果我们正在拖拽这个可拖拽元素，
		// 禁用它相当于结束拖拽操作。
		if (Draggable._dragging === this) {
			this.finishDrag(true);
		}

		DomEvent.off(this._dragStartTarget, START, this._onDown, this);

		this._enabled = false;
		this._moved = false;
	},

	_onDown: function (e) {
		// 如果禁用，则忽略该事件；这在IE11中会发生。
		// 在某些情况下，参见#3666。
		if (!this._enabled) { return; }

		this._moved = false;

		if (DomUtil.hasClass(this._element, 'leaflet-zoom-anim')) { return; }

		if (e.touches && e.touches.length !== 1) {
			// 完成拖拽以避免与触摸缩放冲突。
			if (Draggable._dragging === this) {
				this.finishDrag();
			}
			return;
		}

		if (Draggable._dragging || e.shiftKey || ((e.which !== 1) && (e.button !== 1) && !e.touches)) { return; }
		Draggable._dragging = this;  // Prevent dragging multiple objects at once.

		if (this._preventOutline) {
			DomUtil.preventOutline(this._element);
		}

		DomUtil.disableImageDrag();
		DomUtil.disableTextSelection();

		if (this._moving) { return; }

		// @event down: Event
		// 在拖拽即将开始时触发。
		this.fire('down');

		var first = e.touches ? e.touches[0] : e,
		    sizedParent = DomUtil.getSizedParentNode(this._element);

		this._startPoint = new Point(first.clientX, first.clientY);
		this._startPos = DomUtil.getPosition(this._element);

		// 缓存缩放值，以便在拖拽期间持续补偿 (_onMove)。
		this._parentScale = DomUtil.getScale(sizedParent);

		var mouseevent = e.type === 'mousedown';
		DomEvent.on(document, mouseevent ? 'mousemove' : 'touchmove', this._onMove, this);
		DomEvent.on(document, mouseevent ? 'mouseup' : 'touchend touchcancel', this._onUp, this);
	},

	_onMove: function (e) {
		// 如果禁用，则忽略该事件；这在IE11中会发生。
		// 在某些情况下，参见#3666。
		if (!this._enabled) { return; }

		if (e.touches && e.touches.length > 1) {
			this._moved = true;
			return;
		}

		var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e),
		    offset = new Point(first.clientX, first.clientY)._subtract(this._startPoint);

		if (!offset.x && !offset.y) { return; }
		if (Math.abs(offset.x) + Math.abs(offset.y) < this.options.clickTolerance) { return; }

		// 我们假设在拖拽过程中父容器的位置、边框和缩放不会发生变化。
		// 因此无需考虑位置和边框（它们通过减法被消除）。
		// 我们可以使用缓存的缩放值。
		offset.x /= this._parentScale.x;
		offset.y /= this._parentScale.y;

		DomEvent.preventDefault(e);

		if (!this._moved) {
			// @event dragstart: Event
			// 在拖拽开始时触发。
			this.fire('dragstart');

			this._moved = true;

			DomUtil.addClass(document.body, 'leaflet-dragging');

			this._lastTarget = e.target || e.srcElement;
			// IE和Edge不提供 `<use>` 元素，因此需要获取它。
			// 如有必要。
			if (window.SVGElementInstance && this._lastTarget instanceof window.SVGElementInstance) {
				this._lastTarget = this._lastTarget.correspondingUseElement;
			}
			DomUtil.addClass(this._lastTarget, 'leaflet-drag-target');
		}

		this._newPos = this._startPos.add(offset);
		this._moving = true;

		this._lastEvent = e;
		this._updatePosition();
	},

	_updatePosition: function () {
		var e = {originalEvent: this._lastEvent};

		// @event predrag: Event
		// 在每次对应元素的位置更新之前持续触发。
		// 在拖拽过程中持续触发。
		this.fire('predrag', e);
		DomUtil.setPosition(this._element, this._newPos);

		// @event drag: Event
		// 在拖拽过程中持续触发。
		this.fire('drag', e);
	},

	_onUp: function () {
		// 如果禁用，则忽略该事件；这在IE11中会发生。
		// 在某些情况下，参见#3666。
		if (!this._enabled) { return; }
		this.finishDrag();
	},

	finishDrag: function (noInertia) {
		DomUtil.removeClass(document.body, 'leaflet-dragging');

		if (this._lastTarget) {
			DomUtil.removeClass(this._lastTarget, 'leaflet-drag-target');
			this._lastTarget = null;
		}

		DomEvent.off(document, 'mousemove touchmove', this._onMove, this);
		DomEvent.off(document, 'mouseup touchend touchcancel', this._onUp, this);

		DomUtil.enableImageDrag();
		DomUtil.enableTextSelection();

		var fireDragend = this._moved && this._moving;

		this._moving = false;
		Draggable._dragging = false;

		if (fireDragend) {
			// @event dragend: DragEndEvent
			// 在拖拽结束时触发。
			this.fire('dragend', {
				noInertia: noInertia,
				distance: this._newPos.distanceTo(this._startPos)
			});
		}
	}

});
