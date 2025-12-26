"use client";

import dynamic from "next/dynamic";

const ShaderGradientCanvas = dynamic(
  () => import("@shadergradient/react").then((mod) => mod.ShaderGradientCanvas),
  { ssr: false }
);

const ShaderGradientComponent = dynamic(
  () => import("@shadergradient/react").then((mod) => mod.ShaderGradient),
  { ssr: false }
);

export function ShaderBackground() {
  return (
    <ShaderGradientCanvas
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
      pixelDensity={1}
      fov={45}
    >
      <ShaderGradientComponent
        type="plane"
        animate="on"
        uAmplitude={1}
        uDensity={1.3}
        uSpeed={0.4}
        uStrength={4}
        uFrequency={5.5}
        uTime={0}
        cAzimuthAngle={180}
        cDistance={3.6}
        cPolarAngle={90}
        positionX={-1.4}
        positionY={0}
        positionZ={0}
        rotationX={0}
        rotationY={10}
        rotationZ={50}
        color1="#ff5005"
        color2="#dbba95"
        color3="#d0bce1"
        brightness={1.2}
        reflection={0.1}
        wireframe={false}
        grain="on"
        lightType="3d"
        envPreset="city"
      />
    </ShaderGradientCanvas>
  );
}
