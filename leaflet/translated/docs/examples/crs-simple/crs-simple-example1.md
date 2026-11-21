---
layout: tutorial_frame
title: CRS.Simple 示例
---
<script>

	var map = L.map('map', {
		crs: L.CRS.Simple
	});

	var bounds = [[0, 0], [1000, 1000]];
	var image = L.imageOverlay('uqm_map_full.png', bounds).addTo(map);

	map.fitBounds(bounds);

</script>
