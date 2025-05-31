attribute float highlight;
#include <common>
#include <clipping_planes_pars_vertex>

uniform bool SHADE;
uniform int LIGHTSIDE;

varying vec2 vUv;
varying float light;
varying float lift;

float AMBIENT = 0.5;
float XFAC = -0.15;
float ZFAC = 0.05;

void main()
{

	if (SHADE) {

		vec3 N = normalize( vec3( modelMatrix * vec4(normal, 0.0) ) );

		if (LIGHTSIDE == 1) {
			float temp = N.y;
			N.y = N.z * -1.0;
			N.z = temp;
		}
		if (LIGHTSIDE == 2) {
			float temp = N.y;
			N.y = N.x;
			N.x = temp;
		}
		if (LIGHTSIDE == 3) {
			N.y = N.y * -1.0;
		}
		if (LIGHTSIDE == 4) {
			float temp = N.y;
			N.y = N.z;
			N.z = temp;
		}
		if (LIGHTSIDE == 5) {
			float temp = N.y;
			N.y = N.x * -1.0;
			N.x = temp;
		}

		float yLight = (1.0+N.y) * 0.5;
		light = yLight * (1.0-AMBIENT) + N.x*N.x * XFAC + N.z*N.z * ZFAC + AMBIENT;

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