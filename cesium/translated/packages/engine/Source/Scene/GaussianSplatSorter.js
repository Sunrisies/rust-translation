import { RuntimeError, defined } from "@cesium/core";
import FeatureDetection from "../Core/FeatureDetection.js";
import TaskProcessor from "../Core/TaskProcessor.js";

/** * A sorter for Gaussian splats that uses a task processor to handle sorting in parallel.
 * 该类负责初始化任务处理器并安排排序任务。
 * * @constructor
 * @private
 */
function GaussianSplatSorter() {}

GaussianSplatSorter._maxSortingConcurrency = Math.max(
  FeatureDetection.hardwareConcurrency - 1,
  1,
);

GaussianSplatSorter._sorterTaskProcessor = undefined;
GaussianSplatSorter._taskProcessorReady = false;
GaussianSplatSorter._error = undefined;
GaussianSplatSorter._getSorterTaskProcessor = function () {
  if (!defined(GaussianSplatSorter._sorterTaskProcessor)) {
    const processor = new TaskProcessor(
      "gaussianSplatSorter",
      GaussianSplatSorter._maxSortingConcurrency,
    );
    processor
      .initWebAssemblyModule({
        wasmBinaryFile: "ThirdParty/wasm_splats_bg.wasm",
      })
      .then(function (result) {
        if (result) {
          GaussianSplatSorter._taskProcessorReady = true;
        } else {
          GaussianSplatSorter._error = new RuntimeError(
            "Gaussian splat sorter could not be initialized.",
          );
        }
      })
      .catch((error) => {
        GaussianSplatSorter._error = error;
      });
    GaussianSplatSorter._sorterTaskProcessor = processor;
  }

  return GaussianSplatSorter._sorterTaskProcessor;
};
/**
 * 使用基数排序算法对高斯模糊点进行排序，按与相机的距离顺序排列。
 * 返回一个新的索引列表，可用于按正确顺序渲染这些模糊点。
 *
 * @param {object} parameters - 用于排序高斯模糊点索引的参数。
 * @param {object} parameters.primitive - 包含位置和模型视图矩阵的原始数据。
 * @returns {Promise|undefined} A 一个承诺，若任务能够安排则返回排序后的索引，若无法安排则返回 undefined。
 * @exception {RuntimeError} Sorter 无法初始化。
 * @private
 */
GaussianSplatSorter.radixSortIndexes = function (parameters) {
  const sorterTaskProcessor = GaussianSplatSorter._getSorterTaskProcessor();
  if (defined(GaussianSplatSorter._error)) {
    throw GaussianSplatSorter._error;
  }

  if (!GaussianSplatSorter._taskProcessorReady) {
    return;
  }

  return sorterTaskProcessor.scheduleTask(parameters, [
    parameters.primitive.positions.buffer,
  ]);
};

export default GaussianSplatSorter;
