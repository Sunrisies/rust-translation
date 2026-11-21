import { Check, Frozen, combine, defined } from "@cesium/core";
import PropertyTable from "./PropertyTable.js";
import PropertyTexture from "./PropertyTexture.js";
import StructuralMetadata from "./StructuralMetadata.js";
import MetadataTable from "./MetadataTable.js";

/**
 * 解析 <code>EXT_feature_metadata</code> glTF 扩展以创建
 * 结构元数据对象。
 *
 * @param {object} options 具有以下属性的对象：
 * @param {object} options.extension 扩展 JSON 对象。
 * @param {MetadataSchema} options.schema 解析后的模式。
 * @param {Object<string, Uint8Array>} [options.bufferViews] 将 bufferView ID 映射到 Uint8Array 对象的对象。
 * @param {Object<string, Texture>} [options.textures] 将 texture ID 映射到 {@link Texture} 对象的对象。
 * @return {StructuralMetadata} A 结构元数据对象
 * @private
 * @experimental This 该特性使用了 3D Tiles 规范中的部分内容，该内容尚未最终定稿，且可能根据 Cesium 标准弃用政策进行更改。
 */
function parseFeatureMetadataLegacy(options) {
  options = options ?? Frozen.EMPTY_OBJECT;
  const extension = options.extension;

  // The calling code is responsible for loading the schema.
  // This keeps metadata parsing synchronous.
  const schema = options.schema;

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.object("options.extension", extension);
  Check.typeOf.object("options.schema", schema);
  //>>includeEnd('debug');

  let i;
  const propertyTables = [];
  let sortedIds;
  if (defined(extension.featureTables)) {
    // Store textures in an array sorted by the dictionary keys. This
    // allows compatibility with the newer EXT_structural_metadata extension
    // which is array-based.
    sortedIds = Object.keys(extension.featureTables).sort();
    for (i = 0; i < sortedIds.length; i++) {
      const featureTableId = sortedIds[i];
      const featureTable = extension.featureTables[featureTableId];
      const classDefinition = schema.classes[featureTable.class];

      const metadataTable = new MetadataTable({
        count: featureTable.count,
        properties: featureTable.properties,
        class: classDefinition,
        bufferViews: options.bufferViews,
      });

      propertyTables.push(
        new PropertyTable({
          id: featureTableId,
          count: featureTable.count,
          metadataTable: metadataTable,
          extras: featureTable.extras,
          extensions: featureTable.extensions,
        }),
      );
    }
  }

  const propertyTextures = [];
  if (defined(extension.featureTextures)) {
    // Store textures in an array sorted by the dictionary keys. This
    // allows compatibility with the newer EXT_structural_metadata extension
    // which is array-based.
    sortedIds = Object.keys(extension.featureTextures).sort();
    for (i = 0; i < sortedIds.length; i++) {
      const featureTextureId = sortedIds[i];
      const featureTexture = extension.featureTextures[featureTextureId];
      propertyTextures.push(
        new PropertyTexture({
          id: featureTextureId,
          propertyTexture: transcodeToPropertyTexture(featureTexture),
          class: schema.classes[featureTexture.class],
          textures: options.textures,
        }),
      );
    }
  }

  return new StructuralMetadata({
    schema: schema,
    propertyTables: propertyTables,
    propertyTextures: propertyTextures,
    statistics: extension.statistics,
    extras: extension.extras,
    extensions: extension.extensions,
  });
}

function transcodeToPropertyTexture(featureTexture) {
  const propertyTexture = {
    class: featureTexture.class,
    properties: {},
  };

  const properties = featureTexture.properties;
  for (const propertyId in properties) {
    if (properties.hasOwnProperty(propertyId)) {
      const oldProperty = properties[propertyId];
      const property = {
        // EXT_structural_metadata uses numeric channel indices instead of
        // a string of channel letters like "rgba".
        channels: reformatChannels(oldProperty.channels),
        extras: oldProperty.extras,
        extensions: oldProperty.extensions,
      };

      // EXT_feature_metadata puts the textureInfo in property.texture.
      // EXT_structural_metadata flattens this structure; essentially a
      // textureInfo + channels
      propertyTexture.properties[propertyId] = combine(
        oldProperty.texture,
        property,
        true,
      );
    }
  }

  return propertyTexture;
}

function reformatChannels(channelsString) {
  const length = channelsString.length;
  const result = new Array(length);
  for (let i = 0; i < length; i++) {
    result[i] = "rgba".indexOf(channelsString[i]);
  }
  return result;
}

export default parseFeatureMetadataLegacy;
