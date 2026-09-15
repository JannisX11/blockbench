attribute float highlight;
#include <common>
#include <clipping_planes_pars_vertex>

uniform bool SHADE;
uniform int SHADEMODE;
SHADING_UNIFORMS

centroid varying vec2 vUv;
varying float light;
varying float lift;

void main()
{

	if (SHADE) {

		vec3 N = normalize( vec3( modelMatrix * vec4(normal, 0.0) ) );

		SHADING_MODES

	} else {

		light = 1.0;

	}

	if (highlight == 2.0) {
		lift = 0.22;
	} else if (highlight == 1.0) {
		lift = 0.1;
	} else {
		lift = 0.0;
	}
	
	vUv = uv;
	vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

	#include <clipping_planes_vertex>

	gl_Position = projectionMatrix * mvPosition;
}