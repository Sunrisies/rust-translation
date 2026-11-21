// @ts-check

import { Cartesian3, Cartesian4, Matrix3, Matrix4 } from "@cesium/core";
import AlphaMode from "./AlphaMode.js";

/** @import { TypedArray } from "@cesium/core"; */
/** @import ArticulationStageType from "../Core/ArticulationStageType.js"; */
/** @import { AttributeType } from "@cesium/core"; */
/** @import Axis from "./Axis.js"; */
/** @import { Cartesian2 } from "@cesium/core"; */
/** @import { ComponentDatatype } from "@cesium/core"; */
/** @import Credit from "../Core/Credit.js"; */
/** @import { IndexDatatype } from "@cesium/core"; */
/** @import InstanceAttributeSemantic from "./InstanceAttributeSemantic.js"; */
/** @import { InterpolationType } from "@cesium/core"; */
/** @import { Matrix2 } from "@cesium/core"; */
/** @import ModelPrimitiveImagery from "./Model/ModelPrimitiveImagery.js"; */
/** @import { PrimitiveType } from "@cesium/core"; */
/** @import { Quaternion } from "@cesium/core"; */
/** @import StructuralMetadata from "./StructuralMetadata.js"; */
/** @import Texture from "../Renderer/Texture.js"; */
/** @import VertexAttributeSemantic from "./VertexAttributeSemantic.js"; */
/** @import Buffer from "../Renderer/Buffer.js"; */

/**
 * 用于构建模型的组件。
 *
 * @namespace ModelComponents
 *
 * @ignore
 */
const ModelComponents = {};

/**
 * 关于量化属性的信息。
 *
 * @ignore
 */
export class Quantization {
  constructor() {
    /**
     * 量化属性是否采用八进制编码。
     *
     * @type {boolean}
     * @ignore
     */
    this.octEncoded = false;

    /**
     * 八进制编码的值是否以 ZXY 形式存储而非 XYZ。当从 Draco 解码时为真。
     *
     * @type {boolean}
     * @ignore
     */
    this.octEncodedZXY = false;

    /**
     * 用于将缓冲区值转换为归一化值的范围 [0.0, 1.0]
     * 该值通常计算为 (1 << quantizationBits) - 1。
     * 对于八进制编码的值，此值为一个单一的数字。
     *
     * @type {number|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4}
     * @ignore
     */
    this.normalizationRange = undefined;

    /**
     * 量化体积的左下角。对于八进制编码的属性不适用。
     * 类型应与属性类型匹配——例如，如果属性类型为
     * AttributeType.VEC4，则偏移量应为 Cartesian4。
     *
     * @type {number|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4}
     * @ignore
     */
    this.quantizedVolumeOffset = undefined;

    /**
     * 量化体积的维度。对于八进制编码的属性不适用。
     * 类型应与属性类型匹配——例如，如果属性类型为
     * AttributeType.VEC4，则维度应为 Cartesian4。
     *
     * @type {number|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4}
     * @ignore
     */
    this.quantizedVolumeDimensions = undefined;

    /**
     * 量化体积的步长，等于
     * quantizedVolumeDimensions / normalizationRange（逐分量）。
     * 对于八进制编码的属性不适用。
     * 类型应与属性类型匹配——例如，如果属性类型为
     * AttributeType.VEC4，则维度应为 Cartesian4。
     *
     * @type {number|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4}
     * @ignore
     */
    this.quantizedVolumeStepSize = undefined;

    /**
     * 量化属性的组件数据类型，例如 ComponentDatatype.UNSIGNED_SHORT。
     *
     * <p>
     * 以下组件数据类型不受支持：
     * <ul>
     * <li>ComponentDatatype.INT</li>
     * <li>ComponentDatatype.UNSIGNED_INT</li>
     * <li>ComponentDatatype.DOUBLE</li>
     * </ul>
     * </p>
     *
     * @type {ComponentDatatype}
     * @ignore
     */
    this.componentDatatype = undefined;

    /**
     * 量化属性的类型，例如对于八进制编码的法线，类型为 AttributeType.VEC2。
     *
     * @type {AttributeType}
     * @ignore
     */
    this.type = undefined;
  }
}

/**
 * 每个顶点或每个实例的属性。
 *
 * @ignore
 */
export class Attribute {
  constructor() {
    /**
     * 属性名称。必须在属性数组中唯一。
     *
     * @type {string}
     * @ignore
     */
    this.name = undefined;

    /**
     * 属性语义。语义和 setIndex 的组合必须在
     * 属性数组中唯一。
     *
     * @type {VertexAttributeSemantic|InstanceAttributeSemantic}
     * @ignore
     */
    this.semantic = undefined;

    /**
     * 属性的 setIndex。仅当属性具有以下之一种语义时适用：
     * <li>{@link VertexAttributeSemantic.TEXCOORD}</li>
     *
     * <ul>
     * <li>{@link VertexAttributeSemantic.TEXCOORD}</li>
     * <li>{@link VertexAttributeSemantic.COLOR}</li>
     * <li>{@link VertexAttributeSemantic.JOINTS}</li>
     * <li>{@link VertexAttributeSemantic.WEIGHTS}</li>
     * <li>{@link VertexAttributeSemantic.FEATURE_ID}</li>
     * <li>{@link InstanceAttributeSemantic.FEATURE_ID}</li>
     * </ul>
     */
    this.setIndex = undefined;

    /**
     * 属性的组件数据类型。
     * <p>
     * 当数据被量化时，componentDatatype 应与
     * 去量化数据匹配，去量化数据通常为 ComponentDatatype.FLOAT。
     * </p>
     * <p>
     * 以下组件数据类型不受支持：
     * <ul>
     * <li>ComponentDatatype.INT</li>
     * <li>ComponentDatatype.UNSIGNED_INT</li>
     * <li>ComponentDatatype.DOUBLE</li>
     * </ul>
     * </p>
     *
     * @type {ComponentDatatype}
     * @ignore
     */
    this.componentDatatype = undefined;

    /**
     * 属性的类型。
     * <p>
     * 当数据采用八进制编码时，类型应与解码后的数据一致，通常
     * 为 AttributeType.VEC3。
     * </p>
     *
     * @type {AttributeType}
     * @ignore
     */
    this.type = undefined;

    /**
     * 属性是否经过归一化。
     *
     * @type {boolean}
     * @default false
     * @ignore
     */
    this.normalized = false;

    /**
     * 元素数量。
     *
     * @type {number}
     * @ignore
     */
    this.count = undefined;

    /**
     * 属性中每个组件的最小值。
     * <p>
     * 当数据被量化时，最小值应与去量化后的数据一致。
     * 归一化属性对这些值没有影响。
     * </p>
     * <p>
     * 必须为 POSITION 属性定义。
     * </p>
     *
     * @type {number|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4}
     * @ignore
     */
    this.min = undefined;

    /**
     * 属性中每个组件的最大值。
     * <p>
     * 当数据被量化时，最大值应与去量化后的数据一致。
     * 归一化属性对这些值没有影响。
     * </p>
     * <p>
     * 必须为 POSITION 属性定义。
     * </p>
     *
     * @type {number|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4}
     * @ignore
     */
    this.max = undefined;

    /**
     * 当类型数组和缓冲区未定义时，所有元素使用的常数值。
     *
     * @type {number|Cartesian2|Cartesian3|Cartesian4|Matrix2|Matrix3|Matrix4}
     * @ignore
     */
    this.constant = undefined;

    /**
     * 关于量化属性的信息。
     *
     * @type {Quantization}
     * @ignore
     */
    this.quantization = undefined;

    /**
     * 包含紧密打包的属性值的类型数组，正如它们在模型文件中所示。
     * 一个顶点缓冲区。属性值通过 byteOffset 和 byteStride 访问。
     *
     * @type {Uint8Array|Int8Array|Uint16Array|Int16Array|Uint32Array|Int32Array|Float32Array}
     * @ignore
     */
    this.typedArray = undefined;

    /**
     * 缓冲区中元素的字节偏移量。
     *
     * @type {Buffer}
     * @ignore
     */
    this.buffer = undefined;

    /**
     * The byte offset of elements in the buffer.
     *
     * @type {number}
     * @default 0
     * @ignore
     */
    this.byteOffset = 0;

    /**
     * 缓冲区中元素的字节步长。当未定义时，元素会紧密打包。
     *
     * @type {number}
     * @ignore
     */
    this.byteStride = undefined;
  }
}

/**
 * 用于选择渲染顶点的索引。
 *
 * @ignore
 */
export class Indices {
  constructor() {
    /**
     * 属性的索引数据类型，例如 IndexDatatype.UNSIGNED_SHORT。
     *
     * @type {IndexDatatype}
     * @ignore
     */
    this.indexDatatype = undefined;

    /**
     * 索引的数量。
     *
     * @type {number}
     * @ignore
     */
    this.count = undefined;

    /**
     * 包含索引的索引缓冲区。
     *
     * @type {Buffer}
     * @ignore
     */
    this.buffer = undefined;

    /**
     * 包含索引的类型数组。
     *
     * @type {Uint8Array|Uint16Array|Uint32Array}
     * @ignore
     */
    this.typedArray = undefined;
  }
}

/**
 * 将每个顶点或每个实例的特征 ID 映射到属性表。特征
 * ID 存储在访问器中。
 *
 * @ignore
 */
export class FeatureIdAttribute {
  constructor() {
    /**
     * 这组特征 ID 中定义了多少个唯一特征。
     *
     * @type {number}
     * @ignore
     */
    this.featureCount = undefined;

    /**
     * 该值表示没有特征被标记为此顶点。
     *
     * @type {number}
     * @ignore
     */
    this.nullFeatureId = undefined;

    /**
     * 特征 ID 索引到的属性表的 ID。如果未定义，
     * 则使用特征 ID 进行分类，但不关联任何元数据。
     *
     *
     * @type {number}
     * @ignore
     */
    this.propertyTableId = undefined;

    /**
     * 包含特征 ID 的特征 ID 集合索引。
     *
     * @type {number}
     * @ignore
     */
    this.setIndex = undefined;

    /**
     * 用于识别这组特征 ID 的标签。它用于选择、
     * 样式和着色器中。
     *
     * @type {string}
     * @ignore
     */
    this.label = undefined;

    /**
     * 通过数组中的位置来识别这组特征 ID 的标签。
     * 这总是要么是“featureId_N”用于基本体，要么是
     * “instanceFeatureId_N”用于实例。
     *
     * @type {string}
     * @ignore
     */
    this.positionalLabel = undefined;
  }
}

/**
 * 定义一系列隐式定义的特征 ID，每个顶点或
 * 实例一个。这些特征 ID 可以可选地与属性表关联。
 * 存储元数据
 *
 * @ignore
 */
export class FeatureIdImplicitRange {
  constructor() {
    /**
     * 这组特征 ID 中定义了多少种独特的特征
     *
     * @type {number}
     * @ignore
     */
    this.featureCount = undefined;

    /**
     * 该值表示没有特征在该顶点被标记
     *
     * @type {number}
     * @ignore
     */
    this.nullFeatureId = undefined;

    /**
     * 特征 ID 所索引的属性表 ID。如果未定义，
     * 使用特征 ID 进行分类，但没有关联元数据
     *
     * @type {number}
     * @ignore
     */
    this.propertyTableId = undefined;

    /**
     * 当 setIndex 未定义时使用的第一个特征 ID
     *
     * @type {number}
     * @default 0
     * @ignore
     */
    this.offset = 0;

    /**
     * 每个特征 ID 在递增前重复出现的次数
     *
     * @type {number}
     * @ignore
     */
    this.repeat = undefined;

    /**
     * 用于标识这组特征 ID 的标签。在拾取、
     * 样式和着色器中用到
     *
     * @type {string}
     * @ignore
     */
    this.label = undefined;

    /**
     * 根据在数组中的位置来标识这组特征 ID 的标签
     * 这总是要么是“featureId_N”用于基本体，要么是
     * “instanceFeatureId_N”用于实例
     *
     * @type {string}
     * @ignore
     */
    this.positionalLabel = undefined;
  }
}

/**
 * 包含每像素特征 ID 的纹理，这些 ID 索引属性表
 *
 * @ignore
 */
export class FeatureIdTexture {
  constructor() {
    /**
     * 这组特征 ID 中定义了多少种独特的特征
     *
     * @type {number}
     * @ignore
     */
    this.featureCount = undefined;

    /**
     * 该值表示没有特征在该像素被标记
     *
     * @type {number}
     * @ignore
     */
    this.nullFeatureId = undefined;

    /**
     * 特征 ID 所索引的属性表 ID。如果未定义，
     * 使用特征 ID 进行分类，但没有关联元数据
     *
     * @type {number}
     * @ignore
     */
    this.propertyTableId = undefined;

    /**
     * 包含特征 ID 的纹理读取器
     *
     * @type {TextureReader}
     * @ignore
     */
    this.textureReader = undefined;

    /**
     * 用于标识这组特征 ID 的标签。在拾取、
     * 样式和着色器中用到
     *
     * @type {string}
     * @ignore
     */
    this.label = undefined;

    /**
     * 根据在数组中的位置来标识这组特征 ID 的标签
     * 这总是要么是“featureId_N”用于基本体，要么是
     * “instanceFeatureId_N”用于实例
     *
     * @type {string}
     * @ignore
     */
    this.positionalLabel = undefined;
  }
}

/**
 * 一个形态目标，其中每个属性包含属性位移数据
 *
 * @ignore
 */
export class MorphTarget {
  constructor() {
    /**
     * 属于形态目标的属性，例如位置、法线和切线
     *
     * @type {Attribute[]}
     * @ignore
     */
    this.attributes = [];
  }
}

/**
 * 使用材质渲染的几何形状
 *
 * @ignore
 */
export class Primitive {
  constructor() {
    /**
     * 顶点属性，例如位置、法线等
     *
     * @type {Attribute[]}
     * @ignore
     */
    this.attributes = [];

    /**
     * 形态目标
     *
     * @type {MorphTarget[]}
     * @ignore
     */
    this.morphTargets = [];

    /**
     * 索引
     *
     * @type {Indices}
     * @ignore
     */
    this.indices = undefined;

    /**
     * 材质
     *
     * @type {Material}
     * @ignore
     */
    this.material = undefined;

    /**
     * 基本体类型，例如 PrimitiveType.TRIANGLES
     *
     * @type {PrimitiveType}
     * @ignore
     */
    this.primitiveType = undefined;

    /**
     * 此基本体的 EXT_mesh_polygon 扩展数据
     *
     * @type {Polygon}
     * @ignore
     */
    this.polygon = undefined;

    /**
     * 此基本体的 CESIUM_mesh_vector 扩展数据
     *
     * @type {Vector}
     * @ignore
     * @deprecated To 在 v1.142 版本发布后将被移除
     */
    this.vector = undefined;

    /**
     * 与此基本体相关的特征 ID。特征 ID 类型可能
     * 相互交错
     *
     * @type {Array<FeatureIdAttribute|FeatureIdImplicitRange|FeatureIdTexture>}
     * @ignore
     */
    this.featureIds = [];

    /**
     * 属性纹理 ID。这些索引对应数组中的
     * 属性纹理
     *
     * @type {number[]}
     * @ignore
     */
    this.propertyTextureIds = [];

    /**
     * 属性属性 ID。这些索引对应数组中的
     * EXT_structural_metadata 扩展中的属性属性
     *
     * @type {number[]}
     * @ignore
     */
    this.propertyAttributeIds = [];

    /**
     * 如果使用了 CESIUM_primitive_outline glTF 扩展，此属性
     * 存储一个额外的属性，用于保存轮廓坐标
     *
     * @type {Attribute}
     * @ignore
     */
    this.outlineCoordinates = undefined;

    /**
     * 如果模型是 Cesium3DTileset 中的 Model3DTileContent 的一部分，并且包含 'imageryLayers'，那么这将表示用于将影像覆盖在该基元上的所需信息。
     * 从 EXT_mesh_primitive_edge_visibility 扩展加载的数据。
     * 节点实例的位置和元数据信息。
     *
     * @type {ModelPrimitiveImagery|undefined}
     * @ignore
     */
    this.modelPrimitiveImagery = undefined;

    /**
     * 节点实例的属性，例如平移、旋转、缩放、特征 ID 等。
     *
     * @type {object}
     * @ignore
     */
    this.edgeVisibility = undefined;
  }
}

/**
 * 与这些节点实例相关的特征 ID 属性。
 *
 * @ignore
 */
export class Instances {
  constructor() {
    /**
     * 特征 ID 属性类型可能混合出现。
     *
     * @type {Attribute[]}
     * @ignore
     */
    this.attributes = [];

    /**
     * 是否在世界空间中应用实例变换。对于使用 EXT_mesh_gpu_instancing 的 glTF 模型，变换是在对象空间中应用的。对于 i3dm 文件，
     * 实例变换在世界空间中。
     *
     * @type {Array<ModelComponents.FeatureIdAttribute|ModelComponents.FeatureIdImplicitRange>}
     * @ignore
     */
    this.featureIds = [];

    /**
     * 实例变换是否在世界空间中应用。
     * 关节和定义皮肤的矩阵。
     * 皮肤在 glTF 中的索引。这有助于在运行时实例化皮肤后查找适用于节点的皮肤。
     *
     * @type {boolean}
     * @ignore
     */
    this.transformInWorldSpace = false;
  }
}

/**
 * 关节。
 *
 * @ignore
 */
export class Skin {
  constructor() {
    /**
     * 影响该节点的关节索引。这在运行时实例化皮肤后查找属于该皮肤的节点时很有用。
     * 动画采样器，描述动画关键帧数据的来源及其插值方式。
     *
     * @type {number}
     * @ignore
     */
    this.index = undefined;

    /**
     * 动画的时间步长。
     *
     * @type {Node[]}
     * @ignore
     */
    this.joints = [];

    /**
     * 用于插值动画关键帧数据的方法。
     *
     * @type {Matrix4[]}
     * @ignore
     */
    this.inverseBindMatrices = [];
  }
}

/**
 * 动画的关键帧数据。
 *
 * @ignore
 */
export class Node {
  constructor() {
    /**
     * 动画目标，指定要动画化的节点和属性。
     *
     * @type {string|undefined}
     * @ignore
     */
    this.name = undefined;

    /**
     * The index of the node in the glTF. This is useful for finding the nodes
     * that belong to a skin after they have been instantiated at runtime.
     *
     * @type {number|undefined}
     * @ignore
     */
    this.index = undefined;

    /**
     * The children nodes.
     *
     * @type {Node[]}
     * @ignore
     */
    this.children = [];

    /**
     * The mesh primitives.
     *
     * @type {Primitive[]}
     * @ignore
     */
    this.primitives = [];

    /**
     * Instances of this node.
     *
     * @type {Instances|undefined}
     * @ignore
     */
    this.instances = undefined;

    /**
     * The skin.
     *
     * @type {Skin|undefined}
     * @ignore
     */
    this.skin = undefined;

    /**
     * The local transformation matrix. When matrix is defined translation,
     * rotation, and scale must be undefined. When matrix is undefined
     * translation, rotation, and scale must all be defined.
     *
     * @type {Matrix4|undefined}
     * @ignore
     */
    this.matrix = undefined;

    /**
     * The local translation.
     *
     * @type {Cartesian3|undefined}
     * @ignore
     */
    this.translation = undefined;

    /**
     * The local rotation.
     *
     * @type {Quaternion|undefined}
     * @ignore
     */
    this.rotation = undefined;

    /**
     * The local scale.
     *
     * @type {Cartesian3|undefined}
     * @ignore
     */
    this.scale = undefined;

    /**
     * An array of weights to be applied to the primitives' morph targets.
     * These are supplied by either the node or its mesh.
     *
     * @type {number[]}
     * @ignore
     */
    this.morphWeights = [];

    /**
     * The name of the articulation affecting this node, as defined by the
     * AGI_articulations extension.
     *
     * @type {string|undefined}
     * @ignore
     */
    this.articulationName = undefined;

    /**
     * The CESIUM_mesh_vector extension data for this node.
     *
     * @type {object|undefined}
     * @ignore
     */
    this.meshVector = undefined;

    /**
     * The KHR_node_visibility extension data for this node.
     *
     * @type {object|undefined}
     * @ignore
     */
    this.nodeVisibility = undefined;
  }
}

/**
 * A scene containing nodes.
 *
 * @ignore
 */
export class Scene {
  constructor() {
    /**
     * The nodes belonging to the scene.
     *
     * @type {Node[]}
     * @ignore
     */
    this.nodes = [];
  }
}

/**
 * The property of the node that is targeted by an animation. The values of
 * this enum are used to look up the appropriate property on the runtime node.
 *
 * @enum {string}
 *
 * @ignore
 */
export const AnimatedPropertyType = {
  TRANSLATION: "translation",
  ROTATION: "rotation",
  SCALE: "scale",
  WEIGHTS: "weights",
};

/**
 * An animation sampler that describes the sources of animated keyframe data
 * and their interpolation.
 *
 * @ignore
 */
export class AnimationSampler {
  constructor() {
    /**
     * The timesteps of the animation.
     *
     * @type {number[]}
     * @ignore
     */
    this.input = [];

    /**
     * The method used to interpolate between the animation's keyframe data.
     *
     * @type {InterpolationType}
     * @ignore
     */
    this.interpolation = undefined;

    /**
     * The keyframe data of the animation.
     *
     * @type {number[]|Cartesian3[]|Quaternion[]}
     * @ignore
     */
    this.output = [];
  }
}

/**
 * An animation target, which specifies the node and property to animate.
 *
 * @ignore
 */
export class AnimationTarget {
  constructor() {
    /**
     * 将受动画影响的节点。
     *
     * @type {Node}
     * @ignore
     */
    this.node = undefined;

    /**
     * 要被动画处理的节点属性。
     *
     * @type {AnimatedPropertyType}
     * @ignore
     */
    this.path = undefined;
  }
}

/**
 * 连接动画采样器与其动画目标的动画通道。
 *
 * @ignore
 */
export class AnimationChannel {
  constructor() {
    /**
     * 作为动画数据来源的采样器。
     *
     * @type {AnimationSampler}
     * @ignore
     */
    this.sampler = undefined;

    /**
     * 动画的目标对象。
     *
     * @type {AnimationTarget}
     * @ignore
     */
    this.target = undefined;
  }
}

/**
 * 模型中的动画效果。
 *
 * @ignore
 */
export class Animation {
  constructor() {
    /**
     * 动画的名称。
     *
     * @type {string}
     * @ignore
     */
    this.name = undefined;

    /**
     * 此动画中使用的采样器。
     *
     * @type {AnimationSampler[]}
     * @ignore
     */
    this.samplers = [];

    /**
     * 此动画中使用的通道。
     *
     * @type {AnimationChannel[]}
     * @ignore
     */
    this.channels = [];
  }
}

/**
 * 属于某个关节的关节阶段。
 * 由 AGI_articulations 扩展定义。
 *
 * @ignore
 */
export class ArticulationStage {
  constructor() {
    /**
     * 关节阶段的名称。
     *
     * @type {string}
     * @ignore
     */
    this.name = undefined;

    /**
     * 关节阶段的类型，由它修改的运动类型决定。
     *
     * @type {ArticulationStageType}
     * @ignore
     */
    this.type = undefined;

    /**
     * 该关节阶段运动范围的最小值。
     *
     * @type {number}
     * @ignore
     */
    this.minimumValue = undefined;

    /**
     * 该关节阶段运动范围的最大值。
     *
     * @type {number}
     * @ignore
     */
    this.maximumValue = undefined;

    /**
     * 该关节阶段的初始值。
     *
     * @type {number}
     * @ignore
     */
    this.initialValue = undefined;
  }
}

/**
 * 由 AGI_articulations 扩展定义的模型关节。
 *
 * @ignore
 */
export class Articulation {
  constructor() {
    /**
     * 关节的名称。
     *
     * @type {string}
     * @ignore
     */
    this.name = undefined;

    /**
     * 属于该关节的阶段。这些阶段按出现顺序应用于模型。
     * 模型中的各个部分。
     *
     * @type {ArticulationStage[]}
     * @ignore
     */
    this.stages = [];
  }
}

/**
 * 模型的资源文件。
 *
 * @ignore
 */
export class Asset {
  constructor() {
    /**
     * 模型的致谢信息。
     *
     * @type {Credit[]}
     * @ignore
     */
    this.credits = [];
  }
}

/**
 * 构成模型的各种组件。
 *
 * @ignore
 */
export class Components {
  constructor() {
    /**
     * 模型的资源文件。
     *
     * @type {Asset}
     * @ignore
     */
    this.asset = new Asset();

    /**
     * 默认场景。
     *
     * @type {Scene}
     * @ignore
     */
    this.scene = undefined;

    /**
     * 模型中的所有节点。
     *
     * @type {Node[]}
     */
    this.nodes = [];

    /**
     * 模型中的所有皮肤。
     *
     * @type {Skin[]}
     */
    this.skins = [];

    /**
     * 模型中的所有动画。
     *
     * @type {Animation[]}
     */
    this.animations = [];

    /**
     * 由 AGI_articulations 扩展定义的所有关节。
     *
     * @type {Articulation[]}
     */
    this.articulations = [];

    /**
     * 包含模式、属性表、属性
     * 纹理和属性映射的结构化元数据。
     *
     * @type {StructuralMetadata}
     * @ignore
     */
    this.structuralMetadata = undefined;

    /**
     * 模型的上轴。
     *
     * @type {Axis}
     * @ignore
     */
    this.upAxis = undefined;

    /**
     * 模型的前轴。
     *
     * @type {Axis}
     * @ignore
     */
    this.forwardAxis = undefined;

    /**
     * 应用于基本体的世界空间变换。
     *
     * @type {Matrix4}
     * @ignore
     */
    this.transform = Matrix4.clone(Matrix4.IDENTITY);

    /**
     * 从 `"EXT_example_extension"` 等扩展名称到
     * 由扩展输入创建的对象의映射。
     *
     * @type {object}
     * @ignore
     */
    this.extensions = {};
  }
}

/**
 * 关于 GPU 纹理的信息，包括纹理本身。
 *
 * @ignore
 */
export class TextureReader {
  constructor() {
    /**
     * 底层的 GPU 纹理。{@link Texture} 中包含采样器。
     *
     * @type {Texture}
     * @ignore
     */
    this.texture = undefined;

    /**
     * 纹理在 glTF 中的索引。这有助于确定
     * 何时共享纹理，以避免在着色器的多个统一槽中附加同一纹理。
     * 纹理通道。当未定义时，所有通道都会被读取。
     *
     * @type {number}
     * @ignore
     */
    this.index = undefined;

    /**
     * 纹理坐标集。
     *
     * @type {number}
     * @default 0
     * @ignore
     */
    this.texCoord = 0;

    /**
     * 应用于纹理坐标的变换矩阵。
     *
     * @type {Matrix3}
     * @default Matrix3.IDENTITY
     */
    this.transform = Matrix3.clone(Matrix3.IDENTITY);

    /**
     * 应用于纹理值的缩放比例。
     *
     * @type {number}
     * @default 1.0
     * @ignore
     */
    this.scale = 1.0;

    /**
     * 要读取的纹理通道。当未定义时，所有通道都会被读取。
     *
     * @type {string}
     */
    this.channels = undefined;

    /**
     * 来自 EXT_textureInfo_constant_lod 扩展的恒定细节级别参数。
     *
     * @type {object|undefined}
     * @private
     */
    this.constantLod = undefined;
  }
}

/**
 * PBR 金属粗糙度着色模型的材质属性。
 *
 * @ignore
 */
export class MetallicRoughness {
  /**
   * @ignore
   */
  static DEFAULT_BASE_COLOR_FACTOR = Cartesian4.ONE;

  /**
   * @ignore
   */
  static DEFAULT_METALLIC_FACTOR = 1.0;

  /**
   * @ignore
   */
  static DEFAULT_ROUGHNESS_FACTOR = 1.0;

  constructor() {
    /**
     * 基础颜色纹理读取器。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.baseColorTexture = undefined;

    /**
     * 金属粗糙纹理读取器。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.metallicRoughnessTexture = undefined;

    /**
     * 基础颜色因子。
     *
     * @type {Cartesian4}
     * @default new Cartesian4(1.0, 1.0, 1.0, 1.0)
     * @ignore
     */
    this.baseColorFactor = Cartesian4.clone(
      MetallicRoughness.DEFAULT_BASE_COLOR_FACTOR,
    );

    /**
     * 金属因子。
     *
     * @type {number}
     * @default 1.0
     * @ignore
     */
    this.metallicFactor = MetallicRoughness.DEFAULT_METALLIC_FACTOR;

    /**
     * 粗糙度因子。
     *
     * @type {number}
     * @default 1.0
     * @ignore
     */
    this.roughnessFactor = MetallicRoughness.DEFAULT_ROUGHNESS_FACTOR;
  }
}

/**
 * PBR镜面光泽着色模型的材质属性。
 *
 * @ignore
 */
export class SpecularGlossiness {
  /**
   * @ignore
   */
  static DEFAULT_DIFFUSE_FACTOR = Cartesian4.ONE;

  /**
   * @ignore
   */
  static DEFAULT_SPECULAR_FACTOR = Cartesian3.ONE;

  /**
   * @ignore
   */
  static DEFAULT_GLOSSINESS_FACTOR = 1.0;

  constructor() {
    /**
     * 漫反射纹理读取器。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.diffuseTexture = undefined;

    /**
     * 镜面光泽纹理读取器。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.specularGlossinessTexture = undefined;

    /**
     * 漫反射因子。
     *
     * @type {Cartesian4}
     * @default new Cartesian4(1.0, 1.0, 1.0, 1.0)
     * @ignore
     */
    this.diffuseFactor = Cartesian4.clone(
      SpecularGlossiness.DEFAULT_DIFFUSE_FACTOR,
    );

    /**
     * 镜面因子。
     *
     * @type {Cartesian3}
     * @default new Cartesian3(1.0, 1.0, 1.0)
     * @ignore
     */
    this.specularFactor = Cartesian3.clone(
      SpecularGlossiness.DEFAULT_SPECULAR_FACTOR,
    );

    /**
     * 光泽因子。
     *
     * @type {number}
     * @default 1.0
     * @ignore
     */
    this.glossinessFactor = SpecularGlossiness.DEFAULT_GLOSSINESS_FACTOR;
  }
}

export class Specular {
  /**
   * @ignore
   */
  static DEFAULT_SPECULAR_FACTOR = 1.0;

  /**
   * @ignore
   */
  static DEFAULT_SPECULAR_COLOR_FACTOR = Cartesian3.ONE;

  constructor() {
    /**
     * 镜面因子。
     *
     * @type {number}
     * @default 1.0
     * @ignore
     */
    this.specularFactor = Specular.DEFAULT_SPECULAR_FACTOR;

    /**
     * 镜面纹理读取器。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.specularTexture = undefined;

    /**
     * 镜面颜色因子。
     *
     * @type {Cartesian3}
     * @default new Cartesian3(1.0, 1.0, 1.0)
     * @ignore
     */
    this.specularColorFactor = Cartesian3.clone(
      Specular.DEFAULT_SPECULAR_COLOR_FACTOR,
    );

    /**
     * 镜面颜色纹理读取器。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.specularColorTexture = undefined;
  }
}

export class Anisotropy {
  /**
   * @ignore
   */
  static DEFAULT_ANISOTROPY_STRENGTH = 0.0;

  /**
   * @ignore
   */
  static DEFAULT_ANISOTROPY_ROTATION = 0.0;

  constructor() {
    /**
     * 各向异性强度。
     *
     * @type {number}
     * @default 0.0
     * @ignore
     */
    this.anisotropyStrength = Anisotropy.DEFAULT_ANISOTROPY_STRENGTH;

    /**
     * 各向异性在切线空间中的旋转角度，
     * 以从切线方向逆时针测量的弧度为单位。
     *
     * @type {number}
     * @default 0.0
     * @ignore
     */
    this.anisotropyRotation = Anisotropy.DEFAULT_ANISOTROPY_ROTATION;

    /**
     * 各向异性纹理读取器。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.anisotropyTexture = undefined;
  }
}

export class Clearcoat {
  /**
   * @ignore
   */
  static DEFAULT_CLEARCOAT_FACTOR = 0.0;

  /**
   * @ignore
   */
  static DEFAULT_CLEARCOAT_ROUGHNESS_FACTOR = 0.0;

  constructor() {
    /**
     * 清漆层强度。
     *
     * @type {number}
     * @default 0.0
     * @ignore
     */
    this.clearcoatFactor = Clearcoat.DEFAULT_CLEARCOAT_FACTOR;

    /**
     * 清漆层强度纹理读取器。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.clearcoatTexture = undefined;

    /**
     * 清漆层粗糙度。
     *
     * @type {number}
     * @default 0.0
     * @ignore
     */
    this.clearcoatRoughnessFactor =
      Clearcoat.DEFAULT_CLEARCOAT_ROUGHNESS_FACTOR;

    /**
     * 清漆层粗糙度纹理。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.clearcoatRoughnessTexture = undefined;

    /**
     * 清漆法线图纹理。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.clearcoatNormalTexture = undefined;
  }
}

export class EmissiveStrength {
  /**
   * @ignore
   */
  static DEFAULT_EMISSIVE_STRENGTH = 1.0;

  constructor() {
    /**
     * 与材质发射值相乘的强度调整因子。
     *
     * @type {number}
     * @default 1.0
     * @ignore
     */
    this.emissiveStrength = EmissiveStrength.DEFAULT_EMISSIVE_STRENGTH;
  }
}

/**
 * BENTLEY_materials_line_style扩展的材质属性。
 *
 * @private
 */
export class LineStyle {
  /**
   * LINES基元中的像素线宽。
   *
   * @type {number|undefined}
   * @default undefined
   */
  width = undefined;

  /**
   * LINES基元中的线虚线模式。以16位无符号整数编码，
   * 其中每个位代表一个像素（1=开启，0=关闭）。
   *
   * @type {number|undefined}
   * @default undefined
   */
  pattern = undefined;
}

/**
 * 来自BENTLEY_materials_planar_fill扩展的平面填充属性。
 * 控制CAD风格可视化中平面多边形填充的渲染行为。
 *
 * @private
 */
export class PlanarFill {
  static DEFAULT_WIREFRAME_FILL = 0;

  /**
   * @param {object} [planarFillInfo={}] 解析后的glTF JSON中的BENTLEY_materials_planar_fill扩展内容。
   * @param {number} [planarFillInfo.wireframeFill=0] 内部填充是否在线框视图模式下显示。
   * @param {boolean} [planarFillInfo.backgroundFill=false] 填充是否应使用视图背景颜色绘制。
   * @param {boolean} [planarFillInfo.behind=false] 填充是否应绘制在相同逻辑对象的其他共面几何体之后。
   */
  constructor(planarFillInfo = {}) {
    const {
      wireframeFill = PlanarFill.DEFAULT_WIREFRAME_FILL,
      backgroundFill = false,
      behind = false,
    } = planarFillInfo;

    /**
     * 指定内部填充是否在线框视图模式下显示及何时显示。
     * 0 = NONE（从不绘制），1 = ALWAYS（始终绘制），2 = TOGGLE（当填充显示启用时绘制）。
     *
     * 注意：此属性目前无作用。CesiumJS尚未提供真正的
     * 线框渲染模式（debugWireframe并非真正的线框模式）。该值被加载并存储以完善文档，但对渲染没有影响。
     * value is loaded and stored for completeness, but it has no effect on rendering.
     * 当CesiumJS添加真正的线框视图模式时将实现此功能。
     * 参见https://github.com/CesiumGS/cesium/issues/13620。
     *
     * @type {number}
     * @default 0
     */
    this.wireframeFill = wireframeFill;

    /**
     * 如果为true，填充应使用视图背景颜色绘制。
     * 创建不可见的遮罩多边形。
     *
     * @type {boolean}
     * @default false
     */
    this.backgroundFill = backgroundFill;

    /**
     * 如果为 true，填充内容应绘制在其他共面几何图形之后。
     * 属于同一个逻辑对象，有助于减少 z 重叠问题。
     * 与叠加的几何图形，如阴影图案或文字一起使用。
     *
     * @type {boolean}
     * @default false
     */
    this.behind = behind;
  }
}

/**
 * 基本体的材质外观。
 *
 * @ignore
 */
export class Material {
  /**
   * @ignore
   */
  static DEFAULT_EMISSIVE_FACTOR = Cartesian3.ZERO;

  constructor() {
    /**
     * PBR 金属粗糙度着色模型的材质属性。
     *
     * @type {MetallicRoughness}
     * @ignore
     */
    this.metallicRoughness = new MetallicRoughness();

    /**
     * PBR 镜面光泽着色模型的材质属性。
     *
     * @type {SpecularGlossiness}
     * @ignore
     */
    this.specularGlossiness = undefined;

    /**
     * PBR 镜面着色模型的材质属性。
     *
     * @type {Specular}
     * @ignore
     */
    this.specular = undefined;

    /**
     * PBR 各向异性着色模型的材质属性。
     *
     * @type {Anisotropy}
     * @ignore
     */
    this.anisotropy = undefined;

    /**
     * PBR 清漆着色模型的材质属性。
     *
     * @type {Clearcoat}
     * @ignore
     */
    this.clearcoat = undefined;

    /**
     * KHR_materials_emissive_strength 的材质属性。
     *
     * @type {EmissiveStrength|undefined}
     * @ignore
     */
    this.emissiveStrength = undefined;

    /**
     * 发射纹理读取器。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.emissiveTexture = undefined;

    /**
     * 法线纹理读取器。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.normalTexture = undefined;

    /**
     * 遮挡纹理读取器。
     *
     * @type {TextureReader}
     * @ignore
     */
    this.occlusionTexture = undefined;

    /**
     * 发射因子。
     *
     * @type {Cartesian3}
     * @default Cartesian3.ZERO
     * @ignore
     */
    this.emissiveFactor = Cartesian3.clone(Material.DEFAULT_EMISSIVE_FACTOR);

    /**
     * Alpha 模式。
     *
     * @type {AlphaMode}
     * @default AlphaMode.OPAQUE
     * @ignore
     */
    this.alphaMode = AlphaMode.OPAQUE;

    /**
     * MASK alpha 模式下材质的 Alpha 截断值。
     *
     * @type {number}
     * @default 0.5
     * @ignore
     */
    this.alphaCutoff = 0.5;

    /**
     * 指定材质是否为双面材质。
     *
     * @type {boolean}
     * @default false
     * @ignore
     */
    this.doubleSided = false;

    /**
     * 指定材质是否为无光照材质。
     *
     * @type {boolean}
     * @default false
     * @ignore
     */
    this.unlit = false;

    /**
     * POINTS 基本体的像素点直径。该值由...
     * BENTLEY_materials_point_style 扩展定义。
     *
     * @type {number|undefined}
     * @default undefined
     * @ignore
     */
    this.pointDiameter = undefined;

    /**
     * 来自 BENTLEY_materials_planar_fill 扩展的平面填充属性。
     * 控制 CAD 风格可视化中平面多边形填充的渲染行为。
     *
     * @type {ModelComponents.PlanarFill}
     * @private
     */
    this.planarFill = undefined;

    /**
     * BENTLEY_materials_line_style 扩展的材质属性。
     *
     * @type {LineStyle}
     * @ignore
     */
    this.lineStyle = undefined;
  }
}

/**
 * 模型中的多边形数据，由 EXT_mesh_polygon 扩展定义。
 *
 * @ignore
 */
export class Polygon {
  /** @type {number} */
  count = 0;

  // Triangle indices are required for LINE_LOOP primitives, and loop indices
  // are required for TRIANGLES primitives. The final spec will not keep both
  // options, but while the questions is undecided, both are supported.
  // See: https://github.com/KhronosGroup/glTF/pull/2570

  /** @type {TypedArray|undefined} */
  triangleIndices = undefined;

  /** @type {TypedArray|undefined} */
  triangleIndicesOffsets = undefined;

  /** @type {TypedArray|undefined} */
  loopIndices = undefined;

  /** @type {TypedArray|undefined} */
  loopIndicesOffsets = undefined;
}

/**
 * 模型中的向量数据，由 CESIUM_mesh_vector 扩展定义。
 *
 * @deprecated To 在 v1.142 版本发布后将被移除。
 * @ignore
 */
export class Vector {
  /** @type {true} */
  vector = true;

  /** @type {number} */
  count = 0;

  /** @type {TypedArray} */
  polygonAttributeOffsets = undefined;

  /** @type {TypedArray} */
  polygonHoleCounts = undefined;

  /** @type {TypedArray} */
  polygonHoleOffsets = undefined;

  /** @type {TypedArray} */
  polygonIndicesOffsets = undefined;
}

ModelComponents.Quantization = Quantization;
ModelComponents.Attribute = Attribute;
ModelComponents.Indices = Indices;
ModelComponents.FeatureIdAttribute = FeatureIdAttribute;
ModelComponents.FeatureIdTexture = FeatureIdTexture;
ModelComponents.FeatureIdImplicitRange = FeatureIdImplicitRange;
ModelComponents.MorphTarget = MorphTarget;
ModelComponents.Primitive = Primitive;
ModelComponents.Instances = Instances;
ModelComponents.Skin = Skin;
ModelComponents.Node = Node;
ModelComponents.Scene = Scene;
ModelComponents.AnimatedPropertyType = Object.freeze(AnimatedPropertyType);
ModelComponents.AnimationSampler = AnimationSampler;
ModelComponents.AnimationTarget = AnimationTarget;
ModelComponents.AnimationChannel = AnimationChannel;
ModelComponents.Animation = Animation;
ModelComponents.ArticulationStage = ArticulationStage;
ModelComponents.Articulation = Articulation;
ModelComponents.Asset = Asset;
ModelComponents.Components = Components;
ModelComponents.TextureReader = TextureReader;
ModelComponents.MetallicRoughness = MetallicRoughness;
ModelComponents.SpecularGlossiness = SpecularGlossiness;
ModelComponents.Specular = Specular;
ModelComponents.Anisotropy = Anisotropy;
ModelComponents.Clearcoat = Clearcoat;
ModelComponents.EmissiveStrength = EmissiveStrength;
ModelComponents.PlanarFill = PlanarFill;
ModelComponents.LineStyle = LineStyle;
ModelComponents.Material = Material;
ModelComponents.Vector = Vector;
ModelComponents.Polygon = Polygon;

export default ModelComponents;
