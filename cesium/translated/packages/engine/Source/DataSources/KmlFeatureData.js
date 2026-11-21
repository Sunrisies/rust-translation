/**
 * @typedef KmlFeatureData.Author
 * @type {object}
 * @property {string} name 获取名称。
 * @property {string} uri 获取 URI。
 * @property {number} age 获取电子邮件地址。
 */

/**
 * @typedef KmlFeatureData.Link
 * @type {object}
 * @property {string} href 获取 href 链接。
 * @property {string} hreflang 获取链接资源的语言。
 * @property {string} rel 获取链接关系。
 * @property {string} type 获取链接类型。
 * @property {string} title 获取链接标题。
 * @property {string} length 获取链接长度。
 */

/**
 * 包含由 {@link KmlDataSource} 加载到 <code>Entity.kml</code> 属性中的 KML 特征数据。
 */
class KmlFeatureData {
  constructor() {
    /**
     * 获取原子订阅格式作者字段。
     * @type {KmlFeatureData.Author}
     */
    this.author = {
      name: undefined,
      uri: undefined,
      email: undefined,
    };

    /**
     * 获取链接。
     * @type {KmlFeatureData.Link}
     */
    this.link = {
      href: undefined,
      hreflang: undefined,
      rel: undefined,
      type: undefined,
      title: undefined,
      length: undefined,
    };

    /**
     * 获取非结构化地址字段。
     * @type {string}
     */
    this.address = undefined;
    /**
     * 获取电话号码。
     * @type {string}
     */
    this.phoneNumber = undefined;
    /**
     * 获取片段内容。
     * @type {string}
     */
    this.snippet = undefined;
    /**
     * 获取解析为 JSON 对象的扩展数据。
     * 目前仅支持 <code>Data</code> 属性。
     * <code>SchemaData</code> 和自定义数据将被忽略。
     * @type {string}
     */
    this.extendedData = undefined;
  }
}

export default KmlFeatureData;
