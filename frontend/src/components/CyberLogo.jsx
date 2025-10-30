import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'

// Componente interno que lida com a lógica 3D
function SpinningMesh() {
  // useRef é usado para obter uma referência ao objeto 3D (como o document.getElementById)
  const meshRef = useRef()

  // useFrame é um hook que roda a cada frame (60fps)
  useFrame((state, delta) => {
    // Gira o cubo
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5
      meshRef.current.rotation.y += delta * 0.5
    }
  })

  return (
    <mesh ref={meshRef}>
      {/* A geometria (o formato) */}
      <boxGeometry args={[2, 2, 2]} />
      {/* O material (a "skin" do objeto) */}
      {/* 'meshStandardMaterial' reage à luz. 'color' é a cor base. */}
      {/* 'emissive' é a cor que "brilha" (perfeito para neon) */}
      <meshStandardMaterial 
        color="rgb(var(--color-primary))" 
        emissive="rgb(var(--color-primary))" 
        emissiveIntensity={2} 
      />
    </mesh>
  )
}

// Componente principal que exportamos
export default function CyberLogo() {
  return (
    // O Canvas é onde a cena 3D é renderizada.
    <Canvas>
      {/* Adiciona uma luz ambiente para que possamos ver o objeto */}
      <ambientLight intensity={0.1} />
      {/* Adiciona uma luz pontual (como uma lâmpada) */}
      <pointLight position={[5, 5, 5]} intensity={1000} color="rgb(var(--color-secondary))" />
      
      {/* Renderiza nosso cubo giratório */}
      <SpinningMesh />
    </Canvas>
  )
}