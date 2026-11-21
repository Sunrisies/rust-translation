import { Check, defined } from "@cesium/core";
import ScreenSpaceEventType from "../../Core/ScreenSpaceEventType.js";
import MouseButton from "./MouseButton.js";

/**
 * @typedef {object} InputBinding
 * @memberof ScreenSpaceInputBindings
 * @property {MouseButton} button 用于开始/停止拖动的鼠标按钮。
 * @property {number} [modifier] 可选择的键盘修饰键，用于注册。
 */

/**
 * @typedef {object} DragInputActions
 * @memberof ScreenSpaceInputBindings
 * @property {Function} [start] 在拖动开始时被调用。
 * @property {Function} [end] 在拖动停止时被调用。
 * @property {Function} [change] 在拖动移动时被调用。
 */

/**
 * @typedef {object} DragInputState
 * @memberof ScreenSpaceInputBindings
 * @property {boolean} isDragging 如果正在进行拖动操作，则为真，否则为假。
 */

/**
 * @private
 * @param {MouseButton} button 鼠标按钮。
 * @returns {ScreenSpaceEventType|undefined} The 对应的按下事件类型。
 */
function getDownEventType(button) {
  if (button === MouseButton.LEFT) {
    return ScreenSpaceEventType.LEFT_DOWN;
  }

  if (button === MouseButton.MIDDLE) {
    return ScreenSpaceEventType.MIDDLE_DOWN;
  }

  if (button === MouseButton.RIGHT) {
    return ScreenSpaceEventType.RIGHT_DOWN;
  }

  return undefined;
}

/**
 * @private
 * @param {MouseButton} button 鼠标按钮。
 * @returns {ScreenSpaceEventType|undefined} The 对应的按下事件类型。
 */
function getUpEventType(button) {
  if (button === MouseButton.LEFT) {
    return ScreenSpaceEventType.LEFT_UP;
  }

  if (button === MouseButton.MIDDLE) {
    return ScreenSpaceEventType.MIDDLE_UP;
  }

  if (button === MouseButton.RIGHT) {
    return ScreenSpaceEventType.RIGHT_UP;
  }

  return undefined;
}

/**
 * @namespace
 */
class ScreenSpaceInputBindings {
  /**
   * 在屏幕空间事件处理器上注册拖动输入绑定。
   * @param {ScreenSpaceEventHandler} handler 屏幕空间事件处理器。
   * @param {InputBinding[]} inputBindings 要注册的拖动绑定。
   * @param {DragInputActions} dragInputActions 用于调用以执行拖动操作的回调函数。
   * @returns {DragInputState} The 拖动输入状态。
   */
  static registerDragInputBindings(handler, inputBindings, dragInputActions) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.object("handler", handler);
    Check.defined("inputBindings", inputBindings);
    Check.typeOf.object("dragInputActions", dragInputActions);
    //>>includeEnd('debug');

    const changeModifiers = new Set();
    const dragInputState = {
      isDragging: false,
    };

    for (const binding of inputBindings) {
      dragInputState.isDragging = false;
      const downEventType = getDownEventType(binding.button);
      const upEventType = getUpEventType(binding.button);

      if (defined(downEventType)) {
        handler.setInputAction(
          (...e) => {
            dragInputState.isDragging = true;
            if (defined(dragInputActions.start)) {
              dragInputActions.start(...e);
            }
          },
          downEventType,
          binding.modifier,
        );
      }

      if (defined(upEventType)) {
        handler.setInputAction(
          (...e) => {
            if (dragInputState.isDragging) {
              dragInputState.isDragging = false;
              if (defined(dragInputActions.end)) {
                dragInputActions.end(...e);
              }
            }
          },
          upEventType,
          binding.modifier,
        );

        // Register a global up event to ensure that the drag end callback is called even if the mouse is released outside of the canvas or the modifier key is released before the mouse button.
        handler.setInputAction((...e) => {
          if (dragInputState.isDragging) {
            dragInputState.isDragging = false;
            if (defined(dragInputActions.end)) {
              dragInputActions.end(...e);
            }
          }
        }, upEventType);
      }

      changeModifiers.add(binding.modifier);
    }

    for (const modifier of changeModifiers) {
      handler.setInputAction(
        (...e) => {
          if (dragInputState.isDragging && defined(dragInputActions.change)) {
            dragInputActions.change(...e);
          }
        },
        ScreenSpaceEventType.MOUSE_MOVE,
        modifier,
      );
    }

    return dragInputState;
  }
}

export default ScreenSpaceInputBindings;
