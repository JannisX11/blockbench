#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D t0;
uniform sampler2D t1;
uniform sampler2D t2;

uniform bool SHADE;

varying vec2 vUv;
varying float light;
varying float lift;

void main(void)
{
	vec4 Ca = texture2D(t0, vUv);
	vec4 Cb = texture2D(t1, vUv);
	vec4 Cc = texture2D(t2, vUv);
	
	vec3 ctemp = Ca.rgb * Ca.a + Cb.rgb * Cb.a * (1.0 - Ca.a);
	vec4 ctemp4 = vec4(ctemp, Ca.a + (1.0 - Ca.a) * Cb.a);

	vec3 c = ctemp4.rgb + Cc.rgb * Cc.a * (1.0 - ctemp4.a);
	gl_FragColor= vec4(lift + c * light, ctemp4.a + (1.0 - ctemp4.a) * Cc.a);

	if (lift > 0.2) {
		gl_FragColor.r = gl_FragColor.r * 0.6;
		gl_FragColor.g = gl_FragColor.g * 0.7;
	}
	
	if (gl_FragColor.a < 0.05) discard;
}