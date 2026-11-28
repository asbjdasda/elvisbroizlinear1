'use client';

import { Suspense, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const FOV = 30;
const INTRO_SECONDS = 1.3;
const DRAG_SPEED = 0.0065;
const PITCH_LIMIT = (65 * Math.PI) / 180;

const toRadians = degrees => (degrees * Math.PI) / 180;

const measured = new WeakMap();
const announced = new WeakSet();

const measure = object => {
  if (measured.has(object)) return measured.get(object);
  const box = new THREE.Box3().setFromObject(object);
  const extent = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 2 / Math.max(extent.x, extent.y, extent.z, 0.0001);
  const bounds = { scale, center, radius: (extent.length() / 2) * scale, floor: (extent.y / 2) * scale };
  measured.set(object, bounds);
  return bounds;
};

const Model = ({ url, children }) => {
  const { scene } = useGLTF(url, false, false);
  const object = useMemo(() => scene.clone(true), [scene]);
  return children(object);
};

const Stage = ({ object, settingsRef, visibleRef, onReady, startAngle, tilt, intro, shadow, shadowOpacity }) => {
  const { gl, invalidate } = useThree();
  const placeRef = useRef(null);
  const floatRef = useRef(null);
  const tiltRef = useRef(null);
  const spinRef = useRef(null);
  const fitRef = useRef(null);
  const bounds = useMemo(() => measure(object), [object]);
  const motionRef = useRef({
      yaw: toRadians(startAngle),
      pitch: toRadians(tilt),
      yawVelocity: 0,
      pitchVelocity: 0,
      zoom: 1,
      zoomGoal: 1,
      tiltX: 0,
      tiltY: 0,
      tiltGoalX: 0,
      tiltGoalY: 0,
      spinSpeed: 0,
      idle: 0,
      dragging: false,
      intro: intro === 'none' ? 1 : 0,
      clock: 0,
      reset: null
  });

  useEffect(() => {
    if (announced.has(object)) return;
    announced.add(object);
    onReady?.();
  }, [object, onReady]);

  useEffect(() => {
    const element = gl.domElement;
    const motion = motionRef.current;
    const pointers = new Map();
    let pinchStart = 0;
    let zoomStart = 1;

    const wake = () => invalidate();

    const onDown = event => {
      const s = settingsRef.current;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, t: event.timeStamp });
      if (pointers.size === 2 && s.zoom) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        zoomStart = motion.zoomGoal;
        motion.dragging = false;
      } else if (pointers.size === 1 && s.dragRotate && (event.pointerType !== 'mouse' || event.button === 0)) {
        motion.dragging = true;
        motion.yawVelocity = 0;
        motion.pitchVelocity = 0;
        element.setPointerCapture?.(event.pointerId);
        element.style.cursor = 'grabbing';
      }
      motion.idle = 0;
      wake();
    };

    const onMove = event => {
      const s = settingsRef.current;
      const rect = element.getBoundingClientRect();
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
        const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
        motion.tiltGoalX = ny * s.hoverTilt * 0.6;
        motion.tiltGoalY = nx * s.hoverTilt;
      }
      const last = pointers.get(event.pointerId);
      if (last) {
        const dx = event.clientX - last.x;
        const dy = event.clientY - last.y;
        const elapsed = Math.max((event.timeStamp - last.t) / 1000, 1 / 240);
        last.x = event.clientX;
        last.y = event.clientY;
        last.t = event.timeStamp;
        if (pointers.size === 2 && s.zoom && pinchStart > 0) {
          const [a, b] = [...pointers.values()];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          motion.zoomGoal = THREE.MathUtils.clamp((zoomStart * distance) / pinchStart, s.minZoom, s.maxZoom);
        } else if (motion.dragging) {
          const m = motion;
          m.yaw += dx * DRAG_SPEED;
          m.yawVelocity = m.yawVelocity * 0.4 + ((dx * DRAG_SPEED) / elapsed) * 0.6;
          if (!s.turntable) {
            m.pitch = THREE.MathUtils.clamp(m.pitch + dy * DRAG_SPEED, -PITCH_LIMIT, PITCH_LIMIT);
            m.pitchVelocity = m.pitchVelocity * 0.4 + ((dy * DRAG_SPEED) / elapsed) * 0.6;
          }
          m.idle = 0;
        }
      }
      wake();
    };

    const onUp = event => {
      const last = pointers.get(event.pointerId);
      if (last && event.timeStamp - last.t > 80) {
        motion.yawVelocity = 0;
        motion.pitchVelocity = 0;
      }
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchStart = 0;
      if (pointers.size === 0) {
        motion.dragging = false;
        element.style.cursor = '';
      }
      wake();
    };

    const onLeave = () => {
      motion.tiltGoalX = 0;
      motion.tiltGoalY = 0;
      wake();
    };

    const onWheel = event => {
      const s = settingsRef.current;
      if (!s.zoom || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const m = motion;
      m.zoomGoal = THREE.MathUtils.clamp(m.zoomGoal * Math.exp(-event.deltaY * 0.01), s.minZoom, s.maxZoom);
      m.idle = 0;
      wake();
    };

    const onDoubleClick = () => {
      const s = settingsRef.current;
      if (!s.resetOnDoubleClick) return;
      const m = motion;
      const turns = Math.round((m.yaw - toRadians(s.startAngle)) / (Math.PI * 2));
      m.reset = { yaw: toRadians(s.startAngle) + turns * Math.PI * 2, pitch: toRadians(s.tilt) };
      m.zoomGoal = 1;
      m.yawVelocity = 0;
      m.pitchVelocity = 0;
      m.idle = 0;
      wake();
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onUp);
    element.addEventListener('pointerleave', onLeave);
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('dblclick', onDoubleClick);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.removeEventListener('pointerleave', onLeave);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('dblclick', onDoubleClick);
    };
  }, [gl, invalidate, settingsRef]);

  useFrame(({ camera, size }, delta) => {
    const place = placeRef.current;
    const floatGroup = floatRef.current;
    const tiltGroup = tiltRef.current;
    const spinGroup = spinRef.current;
    if (!place || !floatGroup || !tiltGroup || !spinGroup) return;
    const s = settingsRef.current;
    const m = motionRef.current;
    const dt = Math.min(delta, 0.05);
    m.clock += dt;
    m.idle += dt;
    const reduce = s.reducedMotion;

    if (m.intro < 1) m.intro = reduce ? 1 : Math.min(1, m.intro + dt / INTRO_SECONDS);
    const eased = 1 - Math.pow(1 - m.intro, 3);

    if (m.reset) {
      m.yaw += (m.reset.yaw - m.yaw) * (1 - Math.exp(-dt * 7));
      m.pitch += (m.reset.pitch - m.pitch) * (1 - Math.exp(-dt * 7));
      if (Math.abs(m.reset.yaw - m.yaw) < 0.001 && Math.abs(m.reset.pitch - m.pitch) < 0.001) m.reset = null;
    } else if (!m.dragging) {
      const decay = Math.exp(-dt * 4.5);
      m.yaw += m.yawVelocity * dt;
      m.pitch = THREE.MathUtils.clamp(m.pitch + m.pitchVelocity * dt, -PITCH_LIMIT, PITCH_LIMIT);
      m.yawVelocity *= decay;
      m.pitchVelocity *= decay;
      if (s.turntable) m.pitch += (toRadians(s.tilt) - m.pitch) * (1 - Math.exp(-dt * 4));
    }

    const spinning = s.autoRotate && !reduce && !m.dragging && m.idle > s.autoRotateDelay;
    m.spinSpeed += ((spinning ? s.autoRotateSpeed : 0) - m.spinSpeed) * (1 - Math.exp(-dt * 2));
    m.yaw += m.spinSpeed * dt;

    m.zoom += (m.zoomGoal - m.zoom) * (1 - Math.exp(-dt * 8));
    m.tiltX += (m.tiltGoalX - m.tiltX) * (1 - Math.exp(-dt * 6));
    m.tiltY += (m.tiltGoalY - m.tiltY) * (1 - Math.exp(-dt * 6));

    const aspect = size.width / Math.max(size.height, 1);
    const halfView = Math.tan(toRadians(FOV) / 2);
    const fitDistance = bounds.radius / (Math.max(s.fit, 0.05) * halfView * Math.min(1, aspect));
    const distance = fitDistance / m.zoom;
    camera.position.set(0, 0, distance);
    camera.near = distance / 50;
    camera.far = distance * 50;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    const halfHeight = fitDistance * halfView;
    place.position.set(s.offsetX * halfHeight * aspect, s.offsetY * halfHeight, 0);

    const intro = s.intro;
    const rise = intro === 'rise' ? (1 - eased) * -0.45 : 0;
    const grow = intro === 'rise' ? 0.9 + 0.1 * eased : 1;
    const twist = intro === 'spin' ? (1 - eased) * -Math.PI * 1.2 : intro === 'rise' ? (1 - eased) * -0.5 : 0;
    const bob = reduce ? 0 : Math.sin(m.clock * 1.3) * s.float * 0.06;
    floatGroup.position.y = rise + bob;
    floatGroup.scale.setScalar(grow);
    tiltGroup.rotation.set(m.tiltX, m.tiltY, 0);
    spinGroup.rotation.set(m.pitch, m.yaw + twist, 0, 'YXZ');

    const settling =
      m.intro < 1 ||
      m.dragging ||
      !!m.reset ||
      Math.abs(m.yawVelocity) + Math.abs(m.pitchVelocity) > 0.0005 ||
      Math.abs(m.zoomGoal - m.zoom) > 0.0005 ||
      Math.abs(m.tiltGoalX - m.tiltX) + Math.abs(m.tiltGoalY - m.tiltY) > 0.0005 ||
      m.spinSpeed > 0.0005 ||
      (s.autoRotate && !reduce) ||
      (s.float > 0 && !reduce);
    if (settling && visibleRef.current) invalidate();
  });

  return (
    <group ref={placeRef}>
      <group ref={floatRef}>
        <group ref={tiltRef}>
          <group ref={spinRef}>
            <group
              ref={fitRef}
              scale={bounds.scale}
              position={[
                -bounds.center.x * bounds.scale,
                -bounds.center.y * bounds.scale,
                -bounds.center.z * bounds.scale
              ]}
            >
              <primitive object={object} />
            </group>
          </group>
        </group>
      </group>
      {shadow && (
        <ContactShadows
          position={[0, -bounds.floor - 0.08, 0]}
          opacity={shadowOpacity}
          scale={bounds.radius * 4}
          blur={2.6}
          far={bounds.floor * 2 + 0.5}
          resolution={512}
          color="#000000"
        />
      )}
    </group>
  );
};

const ModelViewer = ({
  url,
  width = 400,
  height = 400,
  environmentIntensity = 1,
  exposure = 1,
  autoRotate = true,
  autoRotateSpeed = 0.4,
  autoRotateDelay = 2,
  dragRotate = true,
  turntable = false,
  zoom = true,
  minZoom = 0.7,
  maxZoom = 2,
  hoverTilt = 0.15,
  float = 0.3,
  shadow = true,
  shadowOpacity = 0.45,
  intro = 'rise',
  startAngle = -30,
  tilt = 10,
  offsetX = 0,
  offsetY = 0,
  fit = 0.8,
  resetOnDoubleClick = true,
  className = '',
  style,
  onModelLoaded,
  ref
}) => {
  const glRef = useRef(null);
  const invalidateRef = useRef(null);
  const containerRef = useRef(null);
  const visibleRef = useRef(true);
  const [loadedUrl, setLoadedUrl] = useState(null);
  const ready = loadedUrl === url;
  const settings = {
    autoRotate,
    autoRotateSpeed,
    autoRotateDelay: Math.max(0, autoRotateDelay),
    dragRotate,
    turntable,
    zoom,
    minZoom: Math.min(minZoom, maxZoom),
    maxZoom: Math.max(minZoom, maxZoom),
    hoverTilt: Math.max(0, hoverTilt),
    float: Math.max(0, float),
    shadow,
    shadowOpacity,
    intro,
    startAngle,
    tilt,
    offsetX,
    offsetY,
    fit,
    resetOnDoubleClick,
    reducedMotion: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  };
  const settingsRef = useRef(settings);
  useLayoutEffect(() => {
    settingsRef.current = settings;
  });

  useImperativeHandle(
    ref,
    () => ({
      capture: (type = 'image/png') => glRef.current?.domElement.toDataURL(type) ?? null
    }),
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const observer = new IntersectionObserver(entries => {
      visibleRef.current = entries.some(entry => entry.isIntersecting);
      if (visibleRef.current) invalidateRef.current?.();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleReady = useCallback(() => {
    setLoadedUrl(url);
    onModelLoaded?.();
  }, [onModelLoaded, url]);

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', width, height, ...style }}>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: FOV, position: [0, 0, 6], near: 0.01, far: 100 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: exposure }}
        onCreated={state => {
          glRef.current = state.gl;
          invalidateRef.current = state.invalidate;
        }}
        style={{
          touchAction: 'none',
          cursor: dragRotate ? 'grab' : 'default',
          opacity: ready || intro === 'none' ? 1 : 0,
          transition: intro === 'none' ? 'none' : 'opacity 0.6s ease'
        }}
      >
        <directionalLight position={[3, 5, 4]} intensity={0.6} />
        <hemisphereLight intensity={1.2} color="#fffaf2" groundColor="#6c778b" />
        <Environment frames={1} resolution={128} environmentIntensity={environmentIntensity}>
          <Lightformer position={[-3, 4, 3]} scale={[4, 5, 1]} intensity={3} onUpdate={light => light.lookAt(0, 0, 0)} />
          <Lightformer position={[3, 2, -4]} scale={[3, 4, 1]} intensity={2} onUpdate={light => light.lookAt(0, 0, 0)} />
        </Environment>
        <Suspense fallback={null}>
          {url && (
            <Model url={url}>
              {object => (
                <Stage object={object} settingsRef={settingsRef} visibleRef={visibleRef} onReady={handleReady}
                  startAngle={startAngle} tilt={tilt} intro={intro} shadow={shadow} shadowOpacity={shadowOpacity} />
              )}
            </Model>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ModelViewer;
