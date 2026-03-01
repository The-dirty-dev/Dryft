Shader "Drift/ColorBlindCorrection"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Mode ("Color Blind Mode", Int) = 0
        _Strength ("Correction Strength", Range(0, 1)) = 1.0
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalRenderPipeline" }
        LOD 100

        Pass
        {
            Name "ColorBlindCorrection"

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 uv : TEXCOORD0;
            };

            TEXTURE2D(_MainTex);
            SAMPLER(sampler_MainTex);

            CBUFFER_START(UnityPerMaterial)
                int _Mode;
                float _Strength;
            CBUFFER_END

            Varyings vert(Attributes input)
            {
                Varyings output;
                output.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                output.uv = input.uv;
                return output;
            }

            // Color blind simulation matrices (Daltonization)
            // These matrices simulate how colors appear to people with color vision deficiencies

            // Protanopia (red-blind) simulation matrix
            static const float3x3 protanopiaMatrix = float3x3(
                0.567, 0.433, 0.000,
                0.558, 0.442, 0.000,
                0.000, 0.242, 0.758
            );

            // Deuteranopia (green-blind) simulation matrix
            static const float3x3 deuteranopiaMatrix = float3x3(
                0.625, 0.375, 0.000,
                0.700, 0.300, 0.000,
                0.000, 0.300, 0.700
            );

            // Tritanopia (blue-blind) simulation matrix
            static const float3x3 tritanopiaMatrix = float3x3(
                0.950, 0.050, 0.000,
                0.000, 0.433, 0.567,
                0.000, 0.475, 0.525
            );

            // Correction matrices (Daltonization correction)
            // These enhance contrast in the visible spectrum for each type

            static const float3x3 protanopiaCorrectionMatrix = float3x3(
                0.0, 2.02344, -2.52581,
                0.0, 1.0, 0.0,
                0.0, 0.0, 1.0
            );

            static const float3x3 deuteranopiaCorrectionMatrix = float3x3(
                1.0, 0.0, 0.0,
                0.49421, 0.0, 1.24827,
                0.0, 0.0, 1.0
            );

            static const float3x3 tritanopiaCorrectionMatrix = float3x3(
                1.0, 0.0, 0.0,
                0.0, 1.0, 0.0,
                -0.395913, 0.801109, 0.0
            );

            float3 ApplyColorBlindCorrection(float3 color, int mode, float strength)
            {
                if (mode == 0) return color; // No correction

                float3 simulated;
                float3 corrected;

                // Simulate how the color appears to someone with CVD
                if (mode == 1) // Protanopia
                {
                    simulated = mul(protanopiaMatrix, color);
                    // Calculate error (what they can't see)
                    float3 error = color - simulated;
                    // Apply correction to shift missing info to visible spectrum
                    corrected = color + mul(protanopiaCorrectionMatrix, error);
                }
                else if (mode == 2) // Deuteranopia
                {
                    simulated = mul(deuteranopiaMatrix, color);
                    float3 error = color - simulated;
                    corrected = color + mul(deuteranopiaCorrectionMatrix, error);
                }
                else if (mode == 3) // Tritanopia
                {
                    simulated = mul(tritanopiaMatrix, color);
                    float3 error = color - simulated;
                    corrected = color + mul(tritanopiaCorrectionMatrix, error);
                }
                else if (mode == 4) // Achromatopsia (grayscale)
                {
                    float luminance = dot(color, float3(0.299, 0.587, 0.114));
                    corrected = float3(luminance, luminance, luminance);
                }
                else
                {
                    corrected = color;
                }

                // Clamp to valid color range
                corrected = saturate(corrected);

                // Blend based on strength
                return lerp(color, corrected, strength);
            }

            float4 frag(Varyings input) : SV_Target
            {
                float4 color = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, input.uv);
                color.rgb = ApplyColorBlindCorrection(color.rgb, _Mode, _Strength);
                return color;
            }
            ENDHLSL
        }
    }

    // Fallback for Built-in Render Pipeline
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 100

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 vertex : SV_POSITION;
            };

            sampler2D _MainTex;
            int _Mode;
            float _Strength;

            v2f vert(appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv;
                return o;
            }

            // Same matrices as above for Built-in RP
            static const float3x3 protanopiaMatrix = float3x3(
                0.567, 0.433, 0.000,
                0.558, 0.442, 0.000,
                0.000, 0.242, 0.758
            );

            static const float3x3 deuteranopiaMatrix = float3x3(
                0.625, 0.375, 0.000,
                0.700, 0.300, 0.000,
                0.000, 0.300, 0.700
            );

            static const float3x3 tritanopiaMatrix = float3x3(
                0.950, 0.050, 0.000,
                0.000, 0.433, 0.567,
                0.000, 0.475, 0.525
            );

            static const float3x3 protanopiaCorrectionMatrix = float3x3(
                0.0, 2.02344, -2.52581,
                0.0, 1.0, 0.0,
                0.0, 0.0, 1.0
            );

            static const float3x3 deuteranopiaCorrectionMatrix = float3x3(
                1.0, 0.0, 0.0,
                0.49421, 0.0, 1.24827,
                0.0, 0.0, 1.0
            );

            static const float3x3 tritanopiaCorrectionMatrix = float3x3(
                1.0, 0.0, 0.0,
                0.0, 1.0, 0.0,
                -0.395913, 0.801109, 0.0
            );

            float3 ApplyColorBlindCorrection(float3 color, int mode, float strength)
            {
                if (mode == 0) return color;

                float3 simulated;
                float3 corrected;

                if (mode == 1)
                {
                    simulated = mul(protanopiaMatrix, color);
                    float3 error = color - simulated;
                    corrected = color + mul(protanopiaCorrectionMatrix, error);
                }
                else if (mode == 2)
                {
                    simulated = mul(deuteranopiaMatrix, color);
                    float3 error = color - simulated;
                    corrected = color + mul(deuteranopiaCorrectionMatrix, error);
                }
                else if (mode == 3)
                {
                    simulated = mul(tritanopiaMatrix, color);
                    float3 error = color - simulated;
                    corrected = color + mul(tritanopiaCorrectionMatrix, error);
                }
                else if (mode == 4)
                {
                    float luminance = dot(color, float3(0.299, 0.587, 0.114));
                    corrected = float3(luminance, luminance, luminance);
                }
                else
                {
                    corrected = color;
                }

                corrected = saturate(corrected);
                return lerp(color, corrected, strength);
            }

            fixed4 frag(v2f i) : SV_Target
            {
                fixed4 color = tex2D(_MainTex, i.uv);
                color.rgb = ApplyColorBlindCorrection(color.rgb, _Mode, _Strength);
                return color;
            }
            ENDCG
        }
    }
}
