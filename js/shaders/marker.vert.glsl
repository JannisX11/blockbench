attribute float highlight;

uniform bool SHADE;

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
	gl_Position = projectionMatrix * mvPosition;
}