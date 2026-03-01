Shader "Drift/NeonGlow"
{
    Properties
    {
        _Color ("Color", Color) = (0, 1, 1, 1)
        _EmissionColor ("Emission Color", Color) = (0, 1, 1, 1)
        _EmissionIntensity ("Emission Intensity", Range(0, 5)) = 1.5
        _MainTex ("Texture", 2D) = "white" {}
        _GlowWidth ("Glow Width", Range(0, 0.5)) = 0.1
        _PulseSpeed ("Pulse Speed", Range(0, 10)) = 2
        _PulseAmount ("Pulse Amount", Range(0, 1)) = 0.3
    }

    SubShader
    {
        Tags
        {
            "RenderType" = "Opaque"
            "Queue" = "Geometry"
        }

        Pass
        {
            Name "FORWARD"
            Tags { "LightMode" = "ForwardBase" }

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog

            #include "UnityCG.cginc"
            #include "Lighting.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 vertex : SV_POSITION;
                float3 worldNormal : TEXCOORD1;
                float3 worldPos : TEXCOORD2;
                UNITY_FOG_COORDS(3)
            };

            sampler2D _MainTex;
            float4 _MainTex_ST;
            float4 _Color;
            float4 _EmissionColor;
            float _EmissionIntensity;
            float _GlowWidth;
            float _PulseSpeed;
            float _PulseAmount;

            v2f vert (appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.worldPos = mul(unity_ObjectToWorld, v.vertex).xyz;
                UNITY_TRANSFER_FOG(o, o.vertex);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                // Base color
                fixed4 col = tex2D(_MainTex, i.uv) * _Color;

                // Animated pulse
                float pulse = 1 + sin(_Time.y * _PulseSpeed) * _PulseAmount;

                // Emission with pulse
                float3 emission = _EmissionColor.rgb * _EmissionIntensity * pulse;

                // Fresnel-like edge glow
                float3 viewDir = normalize(_WorldSpaceCameraPos - i.worldPos);
                float fresnel = pow(1.0 - saturate(dot(i.worldNormal, viewDir)), 3);
                emission += _EmissionColor.rgb * fresnel * _GlowWidth * pulse;

                col.rgb += emission;

                UNITY_APPLY_FOG(i.fogCoord, col);
                return col;
            }
            ENDCG
        }
    }

    FallBack "Diffuse"
}
