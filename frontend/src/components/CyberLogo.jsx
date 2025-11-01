// src/components/CyberLogo.jsx
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'

// Componente interno para a forma 3D
function SpinningShape() {
  const meshRef = useRef()

  // Animação de rotação (ajuste a velocidade como quiser)
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5
      meshRef.current.rotation.y += delta * 0.8
    }
  })

  return (
    <mesh ref={meshRef}>
      {/* Aqui pode trocar a geometria.
        Experimente descomentar uma destas:
      */}
      
      {/* Opção 1: Esfera (Raio, Segmentos Horizontais, Segmentos Verticais) */}
      {/*<sphereGeometry args={[1.8, 32, 32]} />*/}
      
      {/* Opção 2: Anel (Torus) (Raio do anel, Raio do tubo, SegmentosR, SegmentosT) */}
      {/* <torusGeometry args={[1.5, 0.5, 16, 100]} /> */}
      
      {/* Opção 3: Cubo (Lados) */}
      {/* <boxGeometry args={[2.5, 2.5, 2.5]} /> */}
      <boxGeometry args={[3.5, 3.5, 3.5]} />

      {/* Material Neon.
        - Lê a cor '--color-primary' do seu tema CSS.
        - wireframe={true} dá o efeito de "holograma".
      */}
      <meshStandardMaterial 
        color="rgb(var(--color-primary))" 
        emissive="rgb(var(--color-primary))" 
        emissiveIntensity={2} 
        wireframe={true} 
      />
    </mesh>
  )
}

// Componente principal (Canvas)
export default function CyberLogo() {
  return (
    <Canvas>
      {/* Luzes para iluminar o material */}
      <ambientLight intensity={0.5} />
      
      <pointLight 
        position={[5, 5, 5]} 
        intensity={1000} 
        color="rgb(var(--color-secondary))" 
      />
      <pointLight 
        position={[-5, -5, -5]} 
        intensity={500} 
        color="rgb(var(--color-primary))" 
      />
      
      {/* Renderiza a nossa forma giratória */}
      <SpinningShape />
    </Canvas>
  )
}