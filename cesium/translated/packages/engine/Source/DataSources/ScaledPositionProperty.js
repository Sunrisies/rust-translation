import {
  DeveloperError,
  Ellipsoid,
  Event,
  JulianDate,
  ReferenceFrame,
  defined,
} from "@cesium/core";
import Property from "./Property.js";

/**
 * 这是一个临时类，用于将位置属性缩放至椭球表面。
 * 该类将被移除或重构，以支持具有任意高度参考的数据。
 * @private
 */
function ScaledPositionProperty(value) {
  this._definitionChanged = new Event();
  this._value = undefined;
  this._removeSubscription = undefined;
  this.setValue(value);
}

Object.defineProperties(ScaledPositionProperty.prototype, {
  isConstant: {
    get: function () {
      return Property.isConstant(this._value);
    },
  },
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },
  referenceFrame: {
    get: function () {
      return defined(this._value)
        ? this._value.referenceFrame
        : ReferenceFrame.FIXED;
    },
  },
});

const timeScratch = new JulianDate();

ScaledPositionProperty.prototype.getValue = function (time, result) {
  if (!defined(time)) {
    time = JulianDate.now(timeScratch);
  }
  return this.getValueInReferenceFrame(time, ReferenceFrame.FIXED, result);
};

ScaledPositionProperty.prototype.setValue = function (value) {
  if (this._value !== value) {
    this._value = value;

    if (defined(this._removeSubscription)) {
      this._removeSubscription();
      this._removeSubscription = undefined;
    }

    if (defined(value)) {
      this._removeSubscription = value.definitionChanged.addEventListener(
        this._raiseDefinitionChanged,
        this,
      );
    }
    this._definitionChanged.raiseEvent(this);
  }
};

ScaledPositionProperty.prototype.getValueInReferenceFrame = function (
  time,
  referenceFrame,
  result,
) {
  //>>includeStart('debug', pragmas.debug);
  if (!defined(time)) {
    throw new DeveloperError("time is required.");
  }
  if (!defined(referenceFrame)) {
    throw new DeveloperError("referenceFrame is required.");
  }
  //>>includeEnd('debug');

  if (!defined(this._value)) {
    return undefined;
  }

  result = this._value.getValueInReferenceFrame(time, referenceFrame, result);
  return defined(result)
    ? Ellipsoid.default.scaleToGeodeticSurface(result, result)
    : undefined;
};

ScaledPositionProperty.prototype.equals = function (other) {
  return (
    this === other ||
    (other instanceof ScaledPositionProperty && this._value === other._value)
  );
};

ScaledPositionProperty.prototype._raiseDefinitionChanged = function () {
  this._definitionChanged.raiseEvent(this);
};
export default ScaledPositionProperty;
