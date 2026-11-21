import { Cartesian2 } from "@cesium/core";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import VerticalExaggerationStageVS from "../../Shaders/Model/VerticalExaggerationStageVS.js";

/**
 * 垂直放大管道阶段根据 {@link Scene#verticalExaggeration} 的值来转换顶点位置。
 * positions based on the values of {@link Scene#verticalExaggeration} and
 * {@link Scene#verticalExaggerationRelativeHeight}
 *
 * @namespace VerticalExaggerationPipelineStage
 *
 * @private
 */
const VerticalExaggerationPipelineStage = {
  name: "VerticalExaggerationPipelineStage", // Helps with debugging
};

const scratchExaggerationUniform = new Cartesian2();

/**
 * 顶点着色器中添加了用于垂直放大计算的添加器和统一变量。
 *
 * @param {PrimitiveRenderResources} renderResources 基元的渲染资源。
 * @param {ModelComponents.Primitive} primitive 要被渲染的基元。
 * @param {FrameState} frameState 帧状态。
 * @private
 */
VerticalExaggerationPipelineStage.process = function (
  renderResources,
  primitive,
  frameState,
) {
  const { shaderBuilder, uniformMap } = renderResources;

  shaderBuilder.addVertexLines(VerticalExaggerationStageVS);

  shaderBuilder.addDefine(
    "HAS_VERTICAL_EXAGGERATION",
    undefined,
    ShaderDestination.VERTEX,
  );

  shaderBuilder.addUniform(
    "vec2",
    "u_verticalExaggerationAndRelativeHeight",
    ShaderDestination.VERTEX,
  );

  uniformMap.u_verticalExaggerationAndRelativeHeight = function () {
    return Cartesian2.fromElements(
      frameState.verticalExaggeration,
      frameState.verticalExaggerationRelativeHeight,
      scratchExaggerationUniform,
    );
  };
};

export default VerticalExaggerationPipelineStage;