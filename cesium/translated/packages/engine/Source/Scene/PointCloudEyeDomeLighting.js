import {
  Cartesian2,
  Color,
  PrimitiveType,
  defined,
  destroyObject,
} from "@cesium/core";
import ClearCommand from "../Renderer/ClearCommand.js";
import DrawCommand from "../Renderer/DrawCommand.js";
import FramebufferManager from "../Renderer/FramebufferManager.js";
import Pass from "../Renderer/Pass.js";
import RenderState from "../Renderer/RenderState.js";
import ShaderSource from "../Renderer/ShaderSource.js";
import BlendingState from "../Scene/BlendingState.js";
import StencilConstants from "../Scene/StencilConstants.js";
import PointCloudEyeDomeLightingShader from "../Shaders/PostProcessStages/PointCloudEyeDomeLighting.js";

/**
 * 眼罩照明。不支持具有点级半透明度的点，但允许在球体上采用半透明样式。
 * 需要支持 WebGL 1.0 中的 EXT_frag_depth 和 WEBGL_draw_buffers 扩展。
 *
 * @private
 */
function PointCloudEyeDomeLighting() {
  this._framebuffer = new FramebufferManager({
    colorAttachmentsLength: 2,
    depth: true,
    supportsDepthTexture: true,
  });

  this._drawCommand = undefined;
  this._clearCommand = undefined;

  this._strength = 1.0;
  this._radius = 1.0;
}

Object.defineProperties(PointCloudEyeDomeLighting.prototype, {
  framebuffer: {
    get: function () {
      return this._framebuffer.framebuffer;
    },
  },
  colorGBuffer: {
    get: function () {
      return this._framebuffer.getColorTexture(0);
    },
  },
  depthGBuffer: {
    get: function () {
      return this._framebuffer.getColorTexture(1);
    },
  },
});

function destroyFramebuffer(processor) {
  processor._framebuffer.destroy();
  processor._drawCommand = undefined;
  processor._clearCommand = undefined;
}

const distanceAndEdlStrengthScratch = new Cartesian2();

function createCommands(processor, context) {
  const blendFS = new ShaderSource({
    defines: ["LOG_DEPTH_WRITE"],
    sources: [PointCloudEyeDomeLightingShader],
  });

  const blendUniformMap = {
    u_pointCloud_colorGBuffer: function () {
      return processor.colorGBuffer;
    },
    u_pointCloud_depthGBuffer: function () {
      return processor.depthGBuffer;
    },
    u_distanceAndEdlStrength: function () {
      distanceAndEdlStrengthScratch.x = processor._radius;
      distanceAndEdlStrengthScratch.y = processor._strength;
      return distanceAndEdlStrengthScratch;
    },
  };

  const blendRenderState = RenderState.fromCache({
    blending: BlendingState.ALPHA_BLEND,
    depthMask: true,
    depthTest: {
      enabled: true,
    },
    stencilTest: StencilConstants.setCesium3DTileBit(),
    stencilMask: StencilConstants.CESIUM_3D_TILE_MASK,
  });

  processor._drawCommand = context.createViewportQuadCommand(blendFS, {
    uniformMap: blendUniformMap,
    renderState: blendRenderState,
    pass: Pass.CESIUM_3D_TILE,
    owner: processor,
  });

  processor._clearCommand = new ClearCommand({
    framebuffer: processor.framebuffer,
    color: new Color(0.0, 0.0, 0.0, 0.0),
    depth: 1.0,
    renderState: RenderState.fromCache(),
    pass: Pass.CESIUM_3D_TILE,
    owner: processor,
  });
}

function createResources(processor, context) {
  const width = context.drawingBufferWidth;
  const height = context.drawingBufferHeight;
  processor._framebuffer.update(context, width, height);
  createCommands(processor, context);
}

function isSupported(context) {
  return context.drawBuffers && context.fragmentDepth;
}

PointCloudEyeDomeLighting.isSupported = isSupported;

function getECShaderProgram(context, shaderProgram) {
  let shader = context.shaderCache.getDerivedShaderProgram(shaderProgram, "EC");
  if (!defined(shader)) {
    const attributeLocations = shaderProgram._attributeLocations;

    const fs = shaderProgram.fragmentShaderSource.clone();

    fs.sources.splice(
      0,
      0,
      `layout (location = 0) out vec4 out_FragData_0;\nlayout (location = 1) out vec4 out_FragData_1;`,
    );

    fs.sources = fs.sources.map(function (source) {
      source = ShaderSource.replaceMain(
        source,
        "czm_point_cloud_post_process_main",
      );
      source = source.replaceAll(/out_FragColor/g, "out_FragData_0");
      return source;
    });

    fs.sources.push(
      "void main() \n" +
        "{ \n" +
        "    czm_point_cloud_post_process_main(); \n" +
        "#ifdef LOG_DEPTH\n" +
        "    czm_writeLogDepth();\n" +
        "    out_FragData_1 = czm_packDepth(gl_FragDepth); \n" +
        "#else\n" +
        "    out_FragData_1 = czm_packDepth(gl_FragCoord.z);\n" +
        "#endif\n" +
        "}",
    );

    shader = context.shaderCache.createDerivedShaderProgram(
      shaderProgram,
      "EC",
      {
        vertexShaderSource: shaderProgram.vertexShaderSource,
        fragmentShaderSource: fs,
        attributeLocations: attributeLocations,
      },
    );
  }

  return shader;
}

PointCloudEyeDomeLighting.prototype.update = function (
  frameState,
  commandStart,
  pointCloudShading,
  boundingVolume,
) {
  if (!isSupported(frameState.context)) {
    return;
  }

  this._strength = pointCloudShading.eyeDomeLightingStrength;
  this._radius =
    pointCloudShading.eyeDomeLightingRadius * frameState.pixelRatio;

  createResources(this, frameState.context);

  // Hijack existing point commands to render into an offscreen FBO.
  let i;
  const commandList = frameState.commandList;
  const commandEnd = commandList.length;

  for (i = commandStart; i < commandEnd; ++i) {
    const command = commandList[i];
    if (
      command.primitiveType !== PrimitiveType.POINTS ||
      command.pass === Pass.TRANSLUCENT
    ) {
      continue;
    }

    let derivedCommand;
    let originalShaderProgram;

    let derivedCommandObject = command.derivedCommands.pointCloudProcessor;
    if (defined(derivedCommandObject)) {
      derivedCommand = derivedCommandObject.command;
      originalShaderProgram = derivedCommandObject.originalShaderProgram;
    }

    if (
      !defined(derivedCommand) ||
      command.dirty ||
      originalShaderProgram !== command.shaderProgram ||
      derivedCommand.framebuffer !== this.framebuffer
    ) {
      // Prevent crash when tiles out-of-view come in-view during context size change or
      // when the underlying shader changes while EDL is disabled
      derivedCommand = DrawCommand.shallowClone(command, derivedCommand);
      derivedCommand.framebuffer = this.framebuffer;
      derivedCommand.shaderProgram = getECShaderProgram(
        frameState.context,
        command.shaderProgram,
      );
      derivedCommand.castShadows = false;
      derivedCommand.receiveShadows = false;

      if (!defined(derivedCommandObject)) {
        derivedCommandObject = {
          command: derivedCommand,
          originalShaderProgram: command.shaderProgram,
        };
        command.derivedCommands.pointCloudProcessor = derivedCommandObject;
      }

      derivedCommandObject.originalShaderProgram = command.shaderProgram;
    }

    commandList[i] = derivedCommand;
  }

  const clearCommand = this._clearCommand;
  const blendCommand = this._drawCommand;

  blendCommand.boundingVolume = boundingVolume;

  // Blend EDL into the main FBO
  commandList.push(blendCommand);
  commandList.push(clearCommand);
};

/**
 * 如果此对象被销毁，则返回 true；否则返回 false。
 * <br /><br />
 * 如果此对象被销毁，则不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。
 *
 * @returns {boolean} <code>true</code> 如果此对象被销毁，则返回 true；否则返回 <code>false</code>。
 *
 * @see PointCloudEyeDomeLighting#destroy
 */
PointCloudEyeDomeLighting.prototype.isDestroyed = function () {
  return false;
};

/**
 * 会销毁此对象持有的 WebGL 资源。销毁对象可以确保
 * WebGL 资源的确定释放，而不是依赖垃圾收集器来销毁此对象。
 * <br /><br />
 * 一旦对象被销毁，就不应使用它；调用除
 * <code>isDestroyed</code> 之外的任何函数将导致 {@link DeveloperError} 异常。因此，
 * 应将返回值 (<code>undefined</code>) 赋给对象，如示例中所示。
 *
 * @exception {DeveloperError} This 对象被销毁，即调用了 destroy() 方法。
 *
 * @example
 * processor = processor && processor.destroy();
 *
 * @see PointCloudEyeDomeLighting#isDestroyed
 */
PointCloudEyeDomeLighting.prototype.destroy = function () {
  destroyFramebuffer(this);
  return destroyObject(this);
};
export default PointCloudEyeDomeLighting;
