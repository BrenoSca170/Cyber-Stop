// src/components/GlitchText.jsx
import { Canvas } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { EffectComposer, Glitch } from '@react-three/postprocessing'
import { GlitchMode } from 'postprocessing'

export default function GlitchText({ text, fontSize, color, fontWeight, textAlign, font }) {
  return (
    <Canvas style={{ height: '150px' }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2.5, 5, 5]} intensity={1} />
      <EffectComposer>
        <Glitch
          delay={[0.5, 1.5]}
          duration={[0.1, 0.2]}
          strength={[0.05, 0.1]}
          mode={GlitchMode.SPORADIC}
          active
          ratio={0.85}
        />
        <Text
          text={text}
          fontSize={fontSize}
          fontWeight={fontWeight}
          textAlign={textAlign}
          font={font}
          position={[0, 0, 0]}
          anchorX="center"
          anchorY="middle"
        >
          <meshStandardMaterial emissive={color} emissiveIntensity={2} />
        </Text>
      </EffectComposer>
    </Canvas>
  )
}
