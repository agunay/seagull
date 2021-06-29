uniform sampler2D texture;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec2 vUv;

void main() {
    gl_FragColor = texture2D(texture, vUv);
    
    #ifdef USE_FOG
        #ifdef USE_LOGDEPTHBUG_EXT
            float depth = gl_FragDepthEXT / gl_FragCoord.w;
        #else
            float depth = gl_FragCoord.z / gl_FragCoord.w;
        #endif
        float fogFactor = smoothstep(fogNear, fogFar, depth);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif

}