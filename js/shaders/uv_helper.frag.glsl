#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D map;

uniform bool SHADE;

centroid varying vec2 vUv;
varying float light;
varying float lift;

void main(void)
{

	vec4 color = texture2D(map, vUv);
	
	if (color.a < 0.01) discard;

	gl_FragColor = vec4(lift + color.rgb * light, color.a);


	if (lift > 0.2) {
		gl_FragColor.r = gl_FragColor.r * 0.6;
		gl_FragColor.g = gl_FragColor.g * 0.7;
	}

}