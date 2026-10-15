import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "react-three-fiber";

export default ({ fov = 55, ...props }) => {
  // ref
  const ref = useRef();
  const { setDefaultCamera, gl } = useThree();
  // camera.position.set();
  useEffect(() => {
    ref.current.rotation.order = "YXZ";
    setDefaultCamera(ref.current);
  }, []);
  useFrame((state, delta) => {
    ref.current.updateMatrixWorld();
  });

  /* Iluminación de cine: sin esto el three r116 escribe en lineal y la escena sale lavada,
   * con las luces fuertes reventadas en blanco. sRGB + ACES da el color que se ha pintado y
   * enrolla las altas luces. La exposición se puede tocar desde el panel de vistas. */
  gl.outputEncoding = THREE.sRGBEncoding;
  gl.physicallyCorrectLights = true;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  if (gl.toneMapping !== THREE.ACESFilmicToneMapping) {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = window.fabrickExposicion || 1.05;
  }
  if (window.fabrickExposicion) gl.toneMappingExposure = window.fabrickExposicion;

  return (
    <perspectiveCamera
      ref={ref}
      fov={55}
      far={100}
      near={0.1}
      // position={[1.3, 1.35, 2.6]}
      {...props}
    />
  );
};
