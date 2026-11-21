import { RuntimeError, defined } from "@cesium/core";
import FeatureDetection from "../Core/FeatureDetection.js";
import TaskProcessor from "../Core/TaskProcessor.js";

/**
 * @private
 */
class DracoLoader {
  static _getDecoderTaskProcessor() {
    if (!defined(DracoLoader._decoderTaskProcessor)) {
      const processor = new TaskProcessor(
        "decodeDraco",
        DracoLoader._maxDecodingConcurrency,
      );
      processor
        .initWebAssemblyModule({
          wasmBinaryFile: "ThirdParty/draco_decoder.wasm",
        })
        .then(function (result) {
          if (result) {
            DracoLoader._taskProcessorReady = true;
          } else {
            DracoLoader._error = new RuntimeError(
              "Draco decoder could not be initialized.",
            );
          }
        })
        .catch((error) => {
          DracoLoader._error = error;
        });
      DracoLoader._decoderTaskProcessor = processor;
    }

    return DracoLoader._decoderTaskProcessor;
  }

  /**
   * 解码压缩点云数据。如果任务无法安排，则返回未定义值。
   * @private
   *
   * @exception {RuntimeError} Draco 解码器未能初始化。
   */
  static decodePointCloud(parameters) {
    const decoderTaskProcessor = DracoLoader._getDecoderTaskProcessor();
    if (defined(DracoLoader._error)) {
      throw DracoLoader._error;
    }

    if (!DracoLoader._taskProcessorReady) {
      // The task processor is not ready to schedule tasks
      return;
    }
    return decoderTaskProcessor.scheduleTask(parameters, [
      parameters.buffer.buffer,
    ]);
  }

  /**
   * 解码缓冲区视图。如果任务无法安排，则返回未定义值。
   *
   * @param {object} options 包含以下属性的对象：
   * @param {Uint8Array} options.array 包含缓冲区视图数据的类型数组。
   * @param {object} options.bufferView glTF 缓冲区视图对象。
   * @param {Object<string, number>} options.compressedAttributes 压缩属性。
   * @param {boolean} options.dequantizeInShader POSITION 和 NORMAL 属性是否应在 GPU 上反量化。
   *
   * @returns {Promise} A 解析后的索引和属性承诺值。
   * @private
   *
   * @exception {RuntimeError} Draco 解码器未能初始化。
   */
  static decodeBufferView(options) {
    const decoderTaskProcessor = DracoLoader._getDecoderTaskProcessor();

    if (defined(DracoLoader._error)) {
      throw DracoLoader._error;
    }

    if (!DracoLoader._taskProcessorReady) {
      // The task processor is not ready to schedule tasks
      return;
    }

    return decoderTaskProcessor.scheduleTask(options, [options.array.buffer]);
  }
}

// Maximum concurrency to use when decoding draco models
DracoLoader._maxDecodingConcurrency = Math.max(
  FeatureDetection.hardwareConcurrency - 1,
  1,
);

// Exposed for testing purposes
DracoLoader._decoderTaskProcessor = undefined;
DracoLoader._taskProcessorReady = false;
DracoLoader._error = undefined;

export default DracoLoader;
