import { Cartesian2, combine } from "@cesium/core";
import ShaderDestination from "../../Renderer/ShaderDestination.js";
import StencilConstants from "../StencilConstants.js";

/**
 * 瓦片集管道阶段负责更新具有 3D Tiles 特性的模型行为。
 * 该行为特定于 3D Tiles。
 *
 * @namespace TilesetPipelineStage
 *
 * @private
 */
const TilesetPipelineStage = {
  name: "TilesetPipelineStage", // Helps with debugging
};

/**
 * 处理模型。这会修改渲染资源的以下部分：
 *
 * <ul>
 * <li>在片段着色器中添加定义，以表明模型使用多边形偏移来实现 skipLevelOfDetail 优化</li>
 * <li>在统一映射中添加函数，以提供多边形偏移值用于 skipLevelOfDetail 优化</li>
 * <li>设置用于 3D Tiles 分类的模板值</li>
 * </ul>
 *
 * <p>
 * 有关对应的 skipLevelOfDetail 派生命令，请参见 {@link ModelDrawCommand}。
 * </p>
 *
 * @param {ModelRenderResources} renderResources 该模型的渲染资源。
 * @param {Model} model 模型本身。
 * @param {FrameState} frameState 帧状态。
 *
 * @private
 */
TilesetPipelineStage.process = function (renderResources, model, frameState) {
  if (model.hasSkipLevelOfDetail(frameState)) {
    // Make the log-depth depth fragment write account for the polygon offset, too.
    // Otherwise, the back face commands will cause the higher resolution
    // tiles to disappear.
    const shaderBuilder = renderResources.shaderBuilder;
    shaderBuilder.addDefine(
      "POLYGON_OFFSET",
      undefined,
      ShaderDestination.FRAGMENT,
    );

    // This value will be overriden by the depth-only back face derived command.
    // We just prepare it in advance so we don't have to recompile the shader.
    // We don't add a uniform declaration through ShaderBuilder because
    // this is included in writeLogDepth.glsl
    const uniformMap = {
      u_polygonOffset: function () {
        return Cartesian2.ZERO;
      },
    };

    renderResources.uniformMap = combine(
      uniformMap,
      renderResources.uniformMap,
    );
    renderResources.hasSkipLevelOfDetail = true;
  }

  // Set stencil values for classification on 3D Tiles. This is applied to all
  // of the derived commands, not just the back-face derived command.
  const renderStateOptions = renderResources.renderStateOptions;
  renderStateOptions.stencilTest = StencilConstants.setCesium3DTileBit();
  renderStateOptions.stencilMask = StencilConstants.CESIUM_3D_TILE_MASK;
};

export default TilesetPipelineStage;
