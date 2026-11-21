import { Matrix4 } from "@cesium/core";
import ModelUtility from "./ModelUtility.js";
import SceneMode from "../SceneMode.js";

/**
 * 模型矩阵更新阶段负责更新绘制命令的模型矩阵和边界体积。
 *
 * @namespace ModelMatrixUpdateStage
 *
 * @private
 */
const ModelMatrixUpdateStage = {};
ModelMatrixUpdateStage.name = "ModelMatrixUpdateStage"; // Helps with debugging

/**
 * 处理运行时节点。这会修改场景图及绘制命令的以下部分：
 * <ul>
 * <li>更新任何具有脏变换的节点的子节点的变换</li>
 * <li>更新脏节点及其子节点中每个基元内的绘制命令的模型矩阵</li>
 * <li>更新脏节点及其子节点中每个基元内的绘制命令的边界体积</li>
 * </ul>
 *
 * @param {ModelRuntimeNode} runtimeNode
 * @param {ModelSceneGraph} sceneGraph
 * @param {FrameState} frameState
 *
 * @private
 */
ModelMatrixUpdateStage.update = function (runtimeNode, sceneGraph, frameState) {
  // Skip the update stage if the model is being projected to 2D
  const use2D = frameState.mode !== SceneMode.SCENE3D;
  if (use2D && sceneGraph._model._projectTo2D) {
    return;
  }

  if (runtimeNode._transformDirty) {
    const modelMatrix = use2D
      ? sceneGraph._computedModelMatrix2D
      : sceneGraph._computedModelMatrix;

    updateRuntimeNode(
      runtimeNode,
      sceneGraph,
      modelMatrix,
      runtimeNode.transformToRoot,
    );
    runtimeNode._transformDirty = false;
  }
};

/**
 * 更新给定绘制命令的 modelMatrix 和 cullFraction。
 *
 * @private
 */
function updateDrawCommand(drawCommand, modelMatrix, transformToRoot) {
  drawCommand.modelMatrix = Matrix4.multiplyTransformation(
    modelMatrix,
    transformToRoot,
    drawCommand.modelMatrix,
  );
  drawCommand.cullFace = ModelUtility.getCullFace(
    drawCommand.modelMatrix,
    drawCommand.primitiveType,
  );
}

/**
 * 递归更新所有子运行时节点及其运行时基元。
 *
 * @private
 */
function updateRuntimeNode(
  runtimeNode,
  sceneGraph,
  modelMatrix,
  transformToRoot,
) {
  let i;

  // Apply the current node's transform to the end of the chain
  transformToRoot = Matrix4.multiplyTransformation(
    transformToRoot,
    runtimeNode.transform,
    new Matrix4(),
  );

  runtimeNode.updateComputedTransform();

  const primitivesLength = runtimeNode.runtimePrimitives.length;
  for (i = 0; i < primitivesLength; i++) {
    const runtimePrimitive = runtimeNode.runtimePrimitives[i];
    updateDrawCommand(
      runtimePrimitive.drawCommand,
      modelMatrix,
      transformToRoot,
    );
  }

  const childrenLength = runtimeNode.children.length;
  for (i = 0; i < childrenLength; i++) {
    const childRuntimeNode = sceneGraph._runtimeNodes[runtimeNode.children[i]];

    // Update transformToRoot to accommodate changes in the transforms of this node and its ancestors
    childRuntimeNode._transformToRoot = Matrix4.clone(
      transformToRoot,
      childRuntimeNode._transformToRoot,
    );

    updateRuntimeNode(
      childRuntimeNode,
      sceneGraph,
      modelMatrix,
      transformToRoot,
    );
    childRuntimeNode._transformDirty = false;
  }
}

export default ModelMatrixUpdateStage;
