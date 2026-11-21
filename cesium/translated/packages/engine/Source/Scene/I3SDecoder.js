import {
  Cartographic,
  Check,
  Ellipsoid,
  Math as CesiumMath,
  Matrix3,
  RuntimeError,
  defined,
} from "@cesium/core";
import FeatureDetection from "../Core/FeatureDetection.js";
import TaskProcessor from "../Core/TaskProcessor.js";

/**
 * 使用 Web 工作线程解码 I3S。
 *
 * @private
 */
function I3SDecoder() {}

// Maximum concurrency to use when decoding draco models
I3SDecoder._maxDecodingConcurrency = Math.max(
  FeatureDetection.hardwareConcurrency - 1,
  1,
);

I3SDecoder._decodeTaskProcessor = new TaskProcessor(
  "decodeI3S",
  I3SDecoder._maxDecodingConcurrency,
);

I3SDecoder._promise = undefined;

async function initializeDecoder() {
  const result = await I3SDecoder._decodeTaskProcessor.initWebAssemblyModule({
    wasmBinaryFile: "ThirdParty/draco_decoder.wasm",
  });
  if (result) {
    return I3SDecoder._decodeTaskProcessor;
  }

  throw new RuntimeError("I3S decoder could not be initialized.");
}

/**
 * 在 Web 工作线程中将 I3S 转换为 glTF。
 * @param {string} url 自定义属性来源 URL
 * @param {object} defaultGeometrySchema 解码时使用的架构。
 * @param {I3SGeometry} geometryData Draco 编码的几何数据。
 * @param {Array} [featureData] Draco 编码的特征数据。
 * @param {object} [symbologyData] 要应用的渲染符号化方式。
 * @returns Promise<undefined|object> 返回一个承诺，在任务无法在此帧中调度时返回 undefined，否则返回 glTF 结果。
 *
 * @exception {RuntimeError} I3S 解码器未能初始化。
 */
I3SDecoder.decode = async function (
  url,
  defaultGeometrySchema,
  geometryData,
  featureData,
  symbologyData,
) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("url", url);
  Check.defined("defaultGeometrySchema", defaultGeometrySchema);
  Check.defined("geometryData", geometryData);
  //>>includeEnd('debug');

  if (!defined(I3SDecoder._promise)) {
    I3SDecoder._promise = initializeDecoder();
  }

  return I3SDecoder._promise.then(function (taskProcessor) {
    // Prepare the data to send to the worker
    const parentData = geometryData._parent._data;
    const parentRotationInverseMatrix =
      geometryData._parent._inverseRotationMatrix;

    let longitude = 0.0;
    let latitude = 0.0;
    let height = 0.0;

    if (defined(parentData.obb)) {
      longitude = parentData.obb.center[0];
      latitude = parentData.obb.center[1];
      height = parentData.obb.center[2];
    } else if (defined(parentData.mbs)) {
      longitude = parentData.mbs[0];
      latitude = parentData.mbs[1];
      height = parentData.mbs[2];
    }

    const axisFlipRotation = Matrix3.fromRotationX(-CesiumMath.PI_OVER_TWO);
    const parentRotation = new Matrix3();

    Matrix3.multiply(
      axisFlipRotation,
      parentRotationInverseMatrix,
      parentRotation,
    );

    const cartographicCenter = Cartographic.fromDegrees(
      longitude,
      latitude,
      height,
    );

    const cartesianCenter =
      Ellipsoid.WGS84.cartographicToCartesian(cartographicCenter);

    const payload = {
      binaryData: geometryData._data,
      featureData:
        defined(featureData) && defined(featureData[0])
          ? featureData[0].data
          : undefined,
      schema: defaultGeometrySchema,
      bufferInfo: geometryData._geometryBufferInfo,
      ellipsoidRadiiSquare: Ellipsoid.WGS84.radiiSquared,
      url: url,
      geoidDataList: geometryData._dataProvider._geoidDataList,
      cartographicCenter: cartographicCenter,
      cartesianCenter: cartesianCenter,
      parentRotation: parentRotation,
      enableFeatures: geometryData._dataProvider.showFeatures,
      splitGeometryByColorTransparency:
        geometryData._dataProvider.adjustMaterialAlphaMode,
      symbologyData: symbologyData,
      calculateNormals: geometryData._dataProvider.calculateNormals,
    };

    return taskProcessor.scheduleTask(payload);
  });
};

export default I3SDecoder;
