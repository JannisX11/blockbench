attribute float highlight;

uniform bool SHADE;
uniform int SHADEMODE;
uniform vec3 SHADEPOS;
uniform vec3 SHADENEG;
uniform vec3 LIGHTDIR0;
uniform vec3 LIGHTDIR1;

varying vec2 vUv;
varying float light;
varying float lift;

void main()
{

	if (SHADE) {

		vec3 N = normalize( vec3( modelMatrix * vec4(normal, 0.0) ) );

		if (SHADEMODE == 1) {
			light = min(1.0, (max(0.0, dot(N, LIGHTDIR0)) + max(0.0, dot(N, LIGHTDIR1))) * 0.6 + 0.4);
		} else {
			vec3 S = N * N;
			light = S.x * (N.x >= 0.0 ? SHADEPOS.x : SHADENEG.x)
				+ S.y * (N.y >= 0.0 ? SHADEPOS.y : SHADENEG.y)
				+ S.z * (N.z >= 0.0 ? SHADEPOS.z : SHADENEG.z);
		}

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
	gl_Position = projectionMatrix * mvPosition;
}