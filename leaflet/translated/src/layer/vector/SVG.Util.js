import Browser from '../../core/Browser';

// @namespace SVG; @section
// 有一些静态函数无需实例化 L.SVG 即可调用：

// @function create(name: String): SVGElement
// 返回 [SVGElement](https://developer.mozilla.org/docs/Web/API/SVGElement) 的实例，
// 与传入的类名相对应。例如，使用 'line' 将返回
// [SVGLineElement](https://developer.mozilla.org/docs/Web/API/SVGLineElement) 的实例。
export function svgCreate(name) {
	return document.createElementNS('http://www.w3.org/2000/svg', name);
}

// @function pointsToPath(rings: Point[], closed: Boolean): String
// 生成多个环的 SVG 路径字符串，每个环转换为 "M..L..L.." 指令
// 用于多边形；"x" 是 VML 语法
export function pointsToPath(rings, closed) {
	var str = '',
	i, j, len, len2, points, p;

	for (i = 0, len = rings.length; i < len; i++) {
		points = rings[i];

		for (j = 0, len2 = points.length; j < len2; j++) {
			p = points[j];
			str += (j ? 'L' : 'M') + p.x + ' ' + p.y;
		}

		// closes the ring for polygons; "x" is VML syntax
		str += closed ? (Browser.svg ? 'z' : 'x') : '';
	}

	// SVG 会报错关于空路径字符串的问题
	return str || 'M0 0';
}




