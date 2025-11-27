import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, Cloud } from '@react-three/drei';
import * as THREE from 'three';

// --- HELPER: SEEDED NOISE ---
// Updated to accept a 'seed' for randomization and tuned for steeper cliffs
const getTerrainHeight = (x, z, seed) => {
  // Offset coordinates based on seed to simulate different terrain
  const xs = x + (seed * 123.45);
  const zs = z + (seed * 67.89);

  // Layer 1: Large rolling structures (Base height)
  let y = (Math.sin(xs * 0.05) * Math.cos(zs * 0.05) * 8); 

  // Layer 2: Detail and steepness (adds jaggedness)
  y += (Math.sin(xs * 0.2 + zs * 0.1) * Math.cos(zs * 0.2) * 3);
  
  // Layer 3: Micro noise for roughness
  y += Math.sin(xs * 0.5) * 0.5;

  return y;
};

// --- ASSET CONFIGURATION ---
const ASSET_TYPES = [
  { id: 'tree', label: 'Pine Tree', color: '#1a472a', shape: 'cone', height: 2 },
  { id: 'rock', label: 'Boulder', color: '#5c5c5c', shape: 'rock', height: 1 },
  { id: 'shrub', label: 'Dry Shrub', color: '#8f7e45', shape: 'shrub', height: 0.8 },
  { id: 'crate', label: 'Supply Crate', color: '#d97706', shape: 'box', height: 1.2 },
];

function App() {
  const [isPaintMode, setIsPaintMode] = useState(true);
  const [groundColor, setGroundColor] = useState('#5c4033');
  const [sunPosition, setSunPosition] = useState([10, 20, 10]);
  const [terrainSeed, setTerrainSeed] = useState(1); // Seed for randomizer

  // Tool Settings
  const [selectedAsset, setSelectedAsset] = useState(ASSET_TYPES[0]);
  const [brushSize, setBrushSize] = useState(10);
  const [density, setDensity] = useState(3);
  const [maxSlope, setMaxSlope] = useState(30);

  // Data
  const [placedAssets, setPlacedAssets] = useState([]);
  
  // Memory Profiler Data
  const [memoryStats, setMemoryStats] = useState({ total: 0, count: 0, history: [] });

  // --- MEMORY SIMULATION LOOP ---
  useEffect(() => {
    const interval = setInterval(() => {
      setMemoryStats(prev => {
        const baseMemory = placedAssets.length * 1024; // ~1KB per asset
        const noise = Math.random() * 5000;
        const currentTotal = baseMemory + 100000 + noise; // Baseline engine overhead
        
        const newHistory = [...prev.history, currentTotal].slice(-50);
        return {
          total: currentTotal,
          count: placedAssets.length,
          history: newHistory
        };
      });
    }, 100);
    return () => clearInterval(interval);
  }, [placedAssets.length]);

  // Spacebar Toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') setIsPaintMode(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- PAINT LOGIC ---
  const handlePaint = (point, normal) => {
    if (!isPaintMode) return;
    
    // 1. Cliff Logic (Slope Check)
    const upVector = new THREE.Vector3(0, 1, 0);
    const angleRad = normal.angleTo(upVector);
    const angleDeg = THREE.MathUtils.radToDeg(angleRad);

    if (angleDeg > maxSlope) return;

    const newAssets = [];
    for (let i = 0; i < density; i++) {
      const r = Math.sqrt(Math.random()) * (brushSize / 2);
      const theta = Math.random() * Math.PI * 2;
      const x = point.x + r * Math.cos(theta);
      const z = point.z + r * Math.sin(theta);
      
      // Calculate height using the current terrain seed so assets stick to ground
      const y = getTerrainHeight(x, z, terrainSeed);

      // Simple visual check to ensure we don't spawn floating assets if terrain is wild
      // In real engine, we'd do a raycast check here against the specific mesh normal
      
      newAssets.push({
        id: Date.now() + Math.random(),
        position: [x, y, z],
        rotation: [0, Math.random() * Math.PI * 2, 0], 
        scale: 0.8 + Math.random() * 0.6,
        type: selectedAsset,
      });
    }
    setPlacedAssets(prev => [...prev, ...newAssets]);
  };

  const regenerateTerrain = () => {
    setTerrainSeed(Math.random() * 1000);
    setPlacedAssets([]); // Clear assets as they would be floating/buried
  };

  return (
    <div className="flex h-screen w-full bg-[#111] text-gray-200 font-sans select-none overflow-hidden">
      
      {/* --- SIDEBAR --- */}
      <div className="w-80 flex flex-col border-r border-gray-800 bg-[#1a1a1a] z-10 shadow-2xl">
        <div className="p-4 bg-[#222] border-b border-gray-700">
          <h1 className="text-sm font-bold uppercase tracking-wider text-orange-500">Unreal Foliage Tool</h1>
          <p className="text-xs text-gray-500 mt-1">Remote Profiler Connected</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Mode Switcher */}
          <div className="bg-gray-800 p-1 rounded-lg flex text-xs font-bold">
            <button onClick={() => setIsPaintMode(true)} className={`flex-1 py-2 rounded ${isPaintMode ? 'bg-orange-600' : 'text-gray-400'}`}>PAINT</button>
            <button onClick={() => setIsPaintMode(false)} className={`flex-1 py-2 rounded ${!isPaintMode ? 'bg-blue-600' : 'text-gray-400'}`}>VIEW</button>
          </div>

          {/* Terrain Randomizer */}
          <div className="p-3 bg-gray-800 rounded border border-gray-700">
            <label className="text-xs font-bold uppercase text-gray-500 mb-2 block">Terrain Generation</label>
            <button 
              onClick={regenerateTerrain}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded border border-gray-600 transition-colors"
            >
              🎲 REGENERATE TERRAIN
            </button>
            <p className="text-[10px] text-gray-500 mt-1 text-center">Seed: {terrainSeed.toFixed(2)}</p>
          </div>

          {/* Asset Selection */}
          <div className="grid grid-cols-2 gap-2">
            {ASSET_TYPES.map((asset) => (
              <button
                key={asset.id}
                onClick={() => setSelectedAsset(asset)}
                className={`p-3 rounded border transition-all flex flex-col items-center ${
                  selectedAsset.id === asset.id ? 'bg-gray-700 border-orange-500' : 'bg-gray-800 border-transparent'
                }`}
              >
                <div className="w-4 h-4 rounded mb-1" style={{ backgroundColor: asset.color }} />
                <span className="text-[10px] uppercase font-bold">{asset.label}</span>
              </button>
            ))}
          </div>

          {/* Sliders */}
          <div className="space-y-4">
             <ControlSlider label="Brush Radius" value={brushSize} min={2} max={30} onChange={setBrushSize} unit="m" />
             <ControlSlider label="Density" value={density} min={1} max={15} onChange={setDensity} />
             <ControlSlider label="Max Slope Angle" value={maxSlope} min={0} max={90} onChange={setMaxSlope} unit="°" />
          </div>

          {/* MEMORY PROFILER UI */}
          <div className="bg-[#111] p-3 rounded border border-gray-700 mt-6">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold text-gray-400">ENGINE MEMORY</span>
              <span className="text-xs font-mono text-green-400">{(memoryStats.total / 1024).toFixed(2)} KB</span>
            </div>
            <div className="flex items-end h-16 gap-[1px]">
              {memoryStats.history.map((val, i) => (
                <div 
                  key={i} 
                  className="bg-green-600/50 flex-1 hover:bg-green-500"
                  style={{ height: `${Math.min(100, (val / 200000) * 100)}%` }}
                />
              ))}
            </div>
            <div className="mt-2 text-[10px] text-gray-500 flex justify-between">
               <span>Allocations: {memoryStats.count}</span>
               <span>Fragments: Low</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- 3D SCENE --- */}
      <div className="flex-1 relative cursor-crosshair">
        <Canvas shadows camera={{ position: [20, 30, 20], fov: 45 }}>
          <Sky 
            sunPosition={sunPosition} 
            turbidity={0.5} 
            rayleigh={0.5} 
            mieCoefficient={0.005} 
            mieDirectionalG={0.8} 
          />
          <CloudCluster /> 
          
          <ambientLight intensity={0.5} />
          <directionalLight position={sunPosition} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
          
          <OrbitControls enabled={!isPaintMode} makeDefault />

          <Terrain 
            color={groundColor} 
            isPaintMode={isPaintMode} 
            onPaint={handlePaint} 
            seed={terrainSeed}
          />

          {placedAssets.map((asset) => <AssetInstance key={asset.id} data={asset} />)}

          {isPaintMode && <BrushCursor size={brushSize} color={selectedAsset.color} />}
        </Canvas>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

const CloudCluster = () => (
  <group position={[0, 40, 0]}>
    <Cloud position={[-30, 0, -30]} opacity={0.5} speed={0.2} width={20} depth={2} segments={10} />
    <Cloud position={[30, 5, 20]} opacity={0.6} speed={0.2} width={25} depth={3} segments={15} />
    <Cloud position={[0, -5, -50]} opacity={0.4} speed={0.3} width={30} depth={5} segments={20} />
  </group>
);

const Terrain = ({ color, onPaint, isPaintMode, seed }) => {
  // Use seed in dependency array to regenerate geometry when button is clicked
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(150, 150, 128, 128);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Use the updated noise function with seed
      pos.setY(i, getTerrainHeight(x, z, seed));
    }
    geo.computeVertexNormals();
    return geo;
  }, [seed]);

  const handleInteract = (e) => {
    if (isPaintMode && (e.type === 'pointerdown' || e.buttons === 1)) {
      e.stopPropagation();
      onPaint(e.point, e.face.normal);
    }
  };

  return (
    <mesh 
      receiveShadow geometry={geometry} 
      onPointerDown={handleInteract} onPointerMove={handleInteract}
    >
      <meshStandardMaterial color={color} roughness={0.9} flatShading />
    </mesh>
  );
};

const AssetInstance = ({ data }) => {
  let geo;
  if(data.type.shape === 'cone') geo = <coneGeometry args={[0.5, 2, 8]} />;
  else if(data.type.shape === 'rock') geo = <dodecahedronGeometry args={[0.6, 0]} />;
  else if(data.type.shape === 'shrub') geo = <capsuleGeometry args={[0.3, 0.8, 4]} />;
  else geo = <boxGeometry args={[0.8, 0.8, 0.8]} />;
  
  return (
    <mesh position={data.position} rotation={data.rotation} scale={data.scale} castShadow receiveShadow>
      {geo}
      <meshStandardMaterial color={data.type.color} />
    </mesh>
  );
};

const BrushCursor = ({ size, color }) => {
  const ref = useRef();
  useFrame(({ mouse, raycaster, scene, camera }) => {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);
    if (intersects.length > 0) {
      ref.current.position.copy(intersects[0].point);
      ref.current.position.y += 0.5;
      ref.current.lookAt(intersects[0].point.clone().add(intersects[0].face.normal));
    }
  });
  return (
    <mesh ref={ref}>
      <ringGeometry args={[size/2 - 0.2, size/2, 32]} />
      <meshBasicMaterial color={color} opacity={0.8} transparent side={THREE.DoubleSide} />
    </mesh>
  );
};

const ControlSlider = ({ label, value, min, max, onChange, unit = '' }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-gray-400">{label}</span>
      <span className="text-orange-400 font-mono">{Math.round(value)}{unit}</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg accent-orange-500 cursor-pointer"/>
  </div>
);

export default App;