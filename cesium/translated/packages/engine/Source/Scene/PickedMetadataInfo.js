/**
 * 关于应被选取的元数据的信息。
 *
 * 该信息在 `Scene.pickMetadata` 函数中初始化，并传递给
 * `FrameState`。它用于配置绘制命令，以将
 * 对象的元数据值渲染到选取帧缓冲区中。
 * 原始值从该缓冲区读取，然后利用此处存储的元数据结构信息，在 `Picking.pickMetadata` 中转换回
 * 正确的元数据值。
 * 元数据模式的可选 ID。
 *
 * @constructor
 * @private
 */
function PickedMetadataInfo(
  schemaId,
  className,
  propertyName,
  classProperty,
  metadataProperty,
) {
  /**
   * 元数据类的名称。
   *
   * @type {string|undefined}
   */
  this.schemaId = schemaId;
  /**
   * 元数据属性的名称。
   *
   * @type {string}
   */
  this.className = className;
  /**
   * 元数据属性的名称。
   *
   * @type {string}
   */
  this.propertyName = propertyName;

  /**
   * 由该结构描述的 `MetadataClassProperty`，从 `MetadataSchema` 中获取。
   * 由该结构描述的 `PropertyTextureProperty` 或 `PropertyAttributeProperty`，从与类名和属性名匹配的 `StructuralMetadata` 的纹理或属性中获取。
   *
   * @type {MetadataClassProperty}
   */
  this.classProperty = classProperty;

  /**
   * 。
   * is described by this structure, as obtained from the property texture
   * or property attribute of the `StructuralMetadata` that matches the
   * class name and property name.
   *
   * @type {object}
   */
  this.metadataProperty = metadataProperty;
}
export default PickedMetadataInfo;
