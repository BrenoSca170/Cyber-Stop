// src/components/CyberLogo.jsx
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, Suspense } from 'react'
import { useGLTF, OrbitControls } from '@react-three/drei' // Importe o OrbitControls para testar

// Um componente "placeholder" para mostrar enquanto o modelo 3D carrega
function Loader() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="rgb(var(--color-primary))" wireframe />
    </mesh>
  )
}

// Componente interno que lida com o modelo
function SpinningModel() {
  // 1. Aponte para o arquivo .GLTF
  // (Troque 'meu_logo.gltf' pelo nome exato do seu arquivo)
  const { scene } = useGLTF('/AtomoBásico.gltf')
  
  const modelRef = useRef()

  // 2. Animação de rotação
  useFrame((state, delta) => {
    if (modelRef.current) {
      modelRef.current.rotation.y += delta * 0.5
    }
  })

  // 3. Renderiza a cena carregada
  // Ajuste o 'scale' para o tamanho desejado
  return (
    <primitive
      ref={modelRef}
      object={scene}
      scale={1.0} 
    />
  )
}

// Componente principal que exportamos
export default function CyberLogo() {
  return (
    <Canvas>
      {/* 4. 'Suspense' é necessário para mostrar o Loader enquanto o modelo carrega */}
      <Suspense fallback={<Loader />}>
        {/* Ajuste as luzes para o seu modelo */}
        <ambientLight intensity={1.0} />
        
        <directionalLight 
          position={[5, 10, 5]} 
          intensity={3} 
          color="rgb(var(--color-secondary))" 
        />
        
        <pointLight 
          position={[-5, -5, -5]} 
          intensity={1000} 
          color="rgb(var(--color-primary))" 
        />
        
        {/* Renderiza nosso novo modelo giratório */}
        <SpinningModel />

        {/* 5. (Opcional) Adicione OrbitControls para poder girar o modelo com o mouse e testar */}
        {/* <OrbitControls /> */}
      </Suspense>
    </Canvas>
  )
}