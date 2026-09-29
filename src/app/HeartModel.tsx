import { useEffect, useRef, useState } from "react";
import type * as ThreeNS from "three";

/**
 * Beating 3D heart.
 *
 * Keeps the original GLTF/model, geometry, animation, camera and layout.
 * Only the visual treatment is changed to match the reference:
 *
 * - Deep burgundy / crimson outer heart
 * - Dark red transparent glass
 * - Warm red/orange inner glow
 * - Yellow/orange illuminated vessels
 * - Dark wine-colored valves
 * - No blue/cyan chrome appearance
 */
export function HeartModel() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">(
    "loading"
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const THREE = await import("three");

        const { GLTFLoader } = await import(
          "three/examples/jsm/loaders/GLTFLoader.js"
        );

        const { RoomEnvironment } = await import(
          "three/examples/jsm/environments/RoomEnvironment.js"
        );

        if (disposed) return;

        // ------------------------------------------------------------
        // Renderer
        // ------------------------------------------------------------

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
        });

        renderer.setPixelRatio(
          Math.min(window.devicePixelRatio || 1, 1.75)
        );

        renderer.setSize(
          mount.clientWidth,
          mount.clientHeight
        );

        renderer.outputColorSpace = THREE.SRGBColorSpace;

        mount.appendChild(renderer.domElement);

        // ------------------------------------------------------------
        // Scene
        // ------------------------------------------------------------

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(
          38,
          mount.clientWidth /
            Math.max(1, mount.clientHeight),
          0.1,
          100
        );

        camera.position.set(0, 0, 9);

        // ------------------------------------------------------------
        // Lighting
        // ------------------------------------------------------------
        // Warm lighting only.
        // The original blue/cool lighting has been removed.
        // ------------------------------------------------------------

        const keyLight = new THREE.DirectionalLight(
          0xffd2c2,
          1.8
        );

        keyLight.position.set(5, 7, 9);
        scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(
          0xff6b4a,
          1.0
        );

        rimLight.position.set(-7, -2, -6);
        scene.add(rimLight);

        const fillLight = new THREE.DirectionalLight(
          0x9b1730,
          0.7
        );

        fillLight.position.set(-6, 5, 3);
        scene.add(fillLight);

        // Warm internal orange light.
        const coreLight = new THREE.PointLight(
          0xff4b16,
          1.5,
          4.5,
          2
        );

        coreLight.position.set(0, 0.7, 0.3);
        scene.add(coreLight);

        // ------------------------------------------------------------
        // Load model
        // ------------------------------------------------------------

        const loader = new GLTFLoader();

        const gltf = await loader.loadAsync(
          "/models/human-heart/scene.gltf"
        );

        if (disposed) return;

        const root = gltf.scene;

        // ------------------------------------------------------------
        // Auto-center and scale
        // ------------------------------------------------------------

        const box = new THREE.Box3().setFromObject(root);

        const center = box.getCenter(
          new THREE.Vector3()
        );

        const size = box.getSize(
          new THREE.Vector3()
        );

        const maxDim =
          Math.max(size.x, size.y, size.z) || 1;

        const scale = 5.2 / maxDim;

        root.scale.setScalar(scale);

        root.position.sub(
          center.multiplyScalar(scale)
        );

        // ------------------------------------------------------------
        // Environment reflections
        // ------------------------------------------------------------

        const pmrem = new THREE.PMREMGenerator(
          renderer
        );

        const envRT = pmrem.fromScene(
          new RoomEnvironment(),
          0.06
        );

        scene.environment = envRT.texture;

        pmrem.dispose();

        // ------------------------------------------------------------
        // Shared heartbeat glow uniform
        // ------------------------------------------------------------

        const glowUniform = {
          value: 0.7,
        };

        // ------------------------------------------------------------
        // Glass / heart-body material
        // ------------------------------------------------------------

        const makeGlassMaterial = (
          min: ThreeNS.Vector3,
          max: ThreeNS.Vector3
        ) => {
          const mat = new THREE.MeshPhysicalMaterial({
            // Deep anatomical crimson.
            color: new THREE.Color(0x68101d),

            metalness: 0,

            // Very glossy.
            roughness: 0.055,

            clearcoat: 1,

            clearcoatRoughness: 0.035,

            // Glass/translucency.
            transparent: true,

            transmission: 0.8,

            thickness: 2.2,

            ior: 1.45,

            // Red/warm absorption.
            attenuationColor:
              new THREE.Color(0x8b1022),

            attenuationDistance: 1.4,

            // Base warm emission.
            emissive:
              new THREE.Color(0x5c0a12),

            emissiveIntensity: 0.18,

            // Keep reflections glossy but not chrome.
            envMapIntensity: 1.15,
          });

          mat.onBeforeCompile = (shader) => {
            shader.uniforms.uMin = {
              value: min.clone(),
            };

            shader.uniforms.uMax = {
              value: max.clone(),
            };

            shader.uniforms.uGlow = glowUniform;

            // --------------------------------------------------------
            // Vertex shader
            // --------------------------------------------------------

            shader.vertexShader =
              shader.vertexShader
                .replace(
                  "#include <common>",
                  `
                  #include <common>

                  varying vec3 vGlassPos;
                  `
                )
                .replace(
                  "#include <begin_vertex>",
                  `
                  #include <begin_vertex>

                  vGlassPos = position;
                  `
                );

            // --------------------------------------------------------
            // Fragment shader
            // --------------------------------------------------------

            shader.fragmentShader =
              shader.fragmentShader

                // Custom uniforms/varyings
                .replace(
                  "#include <common>",
                  `
                  #include <common>

                  varying vec3 vGlassPos;

                  uniform vec3 uMin;
                  uniform vec3 uMax;
                  uniform float uGlow;

                  float heartGlow = 0.0;
                  `
                )

                // ----------------------------------------------------
                // Main heart color
                // ----------------------------------------------------

                .replace(
                  "#include <color_fragment>",
                  `
                  // --------------------------------------------------
                  // Normalize local position
                  // --------------------------------------------------

                  vec3 np =
                    (vGlassPos - uMin) /
                    max(
                      uMax - uMin,
                      vec3(0.0001)
                    );

                  np = clamp(np, 0.0, 1.0);

                  float y = np.y;

                  // --------------------------------------------------
                  // Heart center
                  // --------------------------------------------------

                  vec3 heartCenter =
                    vec3(
                      0.52,
                      0.45,
                      0.52
                    );

                  float centerDist =
                    distance(
                      np,
                      heartCenter
                    );

                  // Strong central glow.
                  float centerGlow =
                    1.0 -
                    smoothstep(
                      0.08,
                      0.62,
                      centerDist
                    );

                  // Concentrate the strongest glow
                  // around lower/middle heart.
                  float lowerGlow =
                    1.0 -
                    smoothstep(
                      0.28,
                      0.78,
                      distance(
                        np.xy,
                        vec2(0.52, 0.40)
                      )
                    );

                  // --------------------------------------------------
                  // Base tissue palette
                  // --------------------------------------------------

                  vec3 deepWine =
                    vec3(
                      0.16,
                      0.008,
                      0.025
                    );

                  vec3 darkCrimson =
                    vec3(
                      0.38,
                      0.015,
                      0.035
                    );

                  vec3 crimson =
                    vec3(
                      0.68,
                      0.035,
                      0.055
                    );

                  vec3 ruby =
                    vec3(
                      0.92,
                      0.075,
                      0.075
                    );

                  // --------------------------------------------------
                  // Dark outer tissue -> crimson center
                  // --------------------------------------------------

                  vec3 tissueColor =
                    mix(
                      deepWine,
                      darkCrimson,
                      smoothstep(
                        0.05,
                        0.42,
                        centerGlow
                      )
                    );

                  tissueColor =
                    mix(
                      tissueColor,
                      crimson,
                      centerGlow * 0.48
                    );

                  tissueColor =
                    mix(
                      tissueColor,
                      ruby,
                      pow(
                        centerGlow,
                        2.5
                      ) * 0.16
                    );

                  // --------------------------------------------------
                  // Molten inner colors
                  // --------------------------------------------------

                  vec3 moltenRed =
                    vec3(
                      1.0,
                      0.075,
                      0.015
                    );

                  vec3 moltenOrange =
                    vec3(
                      1.0,
                      0.28,
                      0.025
                    );

                  vec3 moltenYellow =
                    vec3(
                      1.0,
                      0.72,
                      0.10
                    );

                  float molten =
                    centerGlow *
                    lowerGlow;

                  vec3 moltenColor =
                    mix(
                      moltenRed,
                      moltenOrange,
                      smoothstep(
                        0.25,
                        0.70,
                        molten
                      )
                    );

                  moltenColor =
                    mix(
                      moltenColor,
                      moltenYellow,
                      smoothstep(
                        0.68,
                        1.0,
                        molten
                      )
                    );

                  tissueColor =
                    mix(
                      tissueColor,
                      moltenColor,
                      molten * 0.52
                    );

                  // Final diffuse color.
                  diffuseColor.rgb =
                    tissueColor;

                  // --------------------------------------------------
                  // Transparency
                  // --------------------------------------------------

                  float transparencyGradient =
                    smoothstep(
                      0.0,
                      1.0,
                      y
                    );

                  diffuseColor.a =
                    mix(
                      0.94,
                      0.20,
                      transparencyGradient
                    );

                  heartGlow = molten;
                  `
                )

                // ----------------------------------------------------
                // Warm inner emissive glow
                // ----------------------------------------------------

                .replace(
                  "#include <emissivemap_fragment>",
                  `
                  float glow =
                    heartGlow *
                    uGlow;

                  vec3 redEmission =
                    vec3(
                      1.0,
                      0.025,
                      0.005
                    );

                  vec3 orangeEmission =
                    vec3(
                      1.0,
                      0.22,
                      0.015
                    );

                  vec3 yellowEmission =
                    vec3(
                      1.0,
                      0.62,
                      0.08
                    );

                  // Red -> orange
                  vec3 warmEmission =
                    mix(
                      redEmission,
                      orangeEmission,
                      smoothstep(
                        0.15,
                        0.65,
                        glow
                      )
                    );

                  // Orange -> yellow
                  warmEmission =
                    mix(
                      warmEmission,
                      yellowEmission,
                      smoothstep(
                        0.65,
                        1.2,
                        glow
                      )
                    );

                  totalEmissiveRadiance +=
                    warmEmission *
                    glow *
                    1.15;

                  // Very subtle red ambient emission.
                  totalEmissiveRadiance +=
                    vec3(
                      0.25,
                      0.008,
                      0.015
                    ) *
                    0.12 *
                    uGlow;
                  `
                );
          };

          return mat;
        };

        // ------------------------------------------------------------
        // Arteries / veins
        // ------------------------------------------------------------

        const filamentMaterial =
          new THREE.MeshStandardMaterial({
            color: 0x6e1118,

            emissive:
              new THREE.Color(
                0xff4a12
              ),

            emissiveIntensity: 1.15,

            roughness: 0.28,

            metalness: 0.05,
          });

        // ------------------------------------------------------------
        // Valves
        // ------------------------------------------------------------

        const valveMaterial =
          new THREE.MeshStandardMaterial({
            color: 0x3a0710,

            emissive:
              new THREE.Color(
                0x4d0710
              ),

            emissiveIntensity: 0.15,

            roughness: 0.4,

            metalness: 0.02,
          });

        // ------------------------------------------------------------
        // Apply materials to GLTF
        // ------------------------------------------------------------

        root.traverse(
          (obj: ThreeNS.Object3D) => {
            const mesh =
              obj as ThreeNS.Mesh;

            if (
              !mesh.isMesh ||
              !mesh.geometry
            ) {
              return;
            }

            mesh.geometry.computeBoundingBox();

            const bb =
              mesh.geometry.boundingBox ??
              new THREE.Box3(
                new THREE.Vector3(
                  -1,
                  -1,
                  -1
                ),
                new THREE.Vector3(
                  1,
                  1,
                  1
                )
              );

            const slots = Array.isArray(
              mesh.material
            )
              ? mesh.material
              : [mesh.material];

            const converted =
              slots.map((slot) => {
                const name =
                  (
                    (
                      slot as
                        | ThreeNS.Material
                        | undefined
                    )?.name ?? ""
                  ).toLowerCase();

                // Dispose original material.
                slot?.dispose?.();

                // Surface vessels.
                if (
                  name.includes(
                    "arteries"
                  ) ||
                  name.includes(
                    "veins"
                  )
                ) {
                  return filamentMaterial;
                }

                // Internal valves.
                if (
                  name.includes(
                    "valve"
                  )
                ) {
                  return valveMaterial;
                }

                // Heart body.
                return makeGlassMaterial(
                  bb.min,
                  bb.max
                );
              });

            mesh.material =
              Array.isArray(
                mesh.material
              )
                ? converted
                : converted[0];
          }
        );

        // ------------------------------------------------------------
        // Heart group
        // ------------------------------------------------------------

        const heart =
          new THREE.Group();

        heart.add(root);

        // Base 3/4 view. The sway
        // animation in frame() moves
        // around this angle.
        heart.rotation.y = 0.5;

        scene.add(heart);

        setState("ready");

        // ------------------------------------------------------------
        // Animation
        // ------------------------------------------------------------

        const reduceMotion =
          window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches;

        // Heartbeat rhythm: two
        // slow beats, then a rest.
        // Slightly stretched for a
        // gentler pace.
        const CYCLE = 2.8;

        const BEAT_LEN = 0.62;

        const BEAT2_START = 0.95;

        // Slow ping-pong sway:
        // the heart eases 30 degrees
        // to one side of the base
        // view, through it, and 30
        // degrees to the other side,
        // then back again.
        const SWAY_AMPLITUDE =
          Math.PI / 6; // 30 degrees.

        const SWAY_PERIOD = 20; // Seconds for a full swing from one side to the other and back.

        const clock =
          new THREE.Clock();

        let raf = 0;

        let running = false;

        const beatEnvelope = (
          t: number
        ): number => {
          const p =
            t % CYCLE;

          // First beat.
          if (
            p < BEAT_LEN
          ) {
            return (
              0.05 *
              Math.sin(
                (p / BEAT_LEN) *
                  Math.PI
              )
            );
          }

          // Second beat.
          if (
            p >=
              BEAT2_START &&
            p <
              BEAT2_START +
                BEAT_LEN
          ) {
            return (
              0.05 *
              Math.sin(
                ((p -
                  BEAT2_START) /
                  BEAT_LEN) *
                  Math.PI
              )
            );
          }

          // Rest.
          return 0;
        };

        // ------------------------------------------------------------
        // Render one frame
        // ------------------------------------------------------------

        const frame = () => {
          const t =
            clock.getElapsedTime();

          const b =
            reduceMotion
              ? 0
              : beatEnvelope(t);

          // Slow rotation: swings
          // from -30 degrees to +30
          // degrees around the base
          // view and back, ping-pong
          // style. Held at the base
          // view when reduced motion
          // is requested.
          const sway =
            reduceMotion
              ? 0
              : Math.cos(
                  (t * Math.PI * 2) /
                    SWAY_PERIOD
                );

          heart.rotation.y =
            0.5 + sway * SWAY_AMPLITUDE;

          // Physical heart expansion.
          heart.scale.setScalar(
            1 + b
          );

          // Pulse internal glow.
          glowUniform.value =
            0.7 + b * 3.5;

          // Pulse point light.
          coreLight.intensity =
            reduceMotion
              ? 1.5
              : 1.5 + b * 14;

          renderer.render(
            scene,
            camera
          );
        };

        // ------------------------------------------------------------
        // Start animation
        // ------------------------------------------------------------

        const start = () => {
          if (running) {
            return;
          }

          running = true;

          clock.start();

          const loop = () => {
            if (!running) {
              return;
            }

            frame();

            raf =
              requestAnimationFrame(
                loop
              );
          };

          raf =
            requestAnimationFrame(
              loop
            );
        };

        // ------------------------------------------------------------
        // Stop animation
        // ------------------------------------------------------------

        const stop = () => {
          running = false;

          cancelAnimationFrame(
            raf
          );
        };

        // ------------------------------------------------------------
        // Intersection observer
        // ------------------------------------------------------------

        const io =
          new IntersectionObserver(
            (entries) => {
              entries.some(
                (entry) =>
                  entry.isIntersecting
              )
                ? start()
                : stop();
            },
            {
              threshold: 0.05,
            }
          );

        io.observe(mount);

        // ------------------------------------------------------------
        // Resize
        // ------------------------------------------------------------

        const onResize = () => {
          const w =
            mount.clientWidth;

          const h =
            Math.max(
              1,
              mount.clientHeight
            );

          camera.aspect =
            w / h;

          camera.updateProjectionMatrix();

          renderer.setSize(
            w,
            h
          );
        };

        const ro =
          new ResizeObserver(
            onResize
          );

        ro.observe(mount);

        // ------------------------------------------------------------
        // Theme handling
        // ------------------------------------------------------------

        const applyTheme = () => {
          const dark =
            document.documentElement
              .dataset.theme ===
            "dark";

          keyLight.intensity =
            dark
              ? 1.9
              : 2.2;

          rimLight.intensity =
            dark
              ? 1.15
              : 0.9;

          fillLight.intensity =
            dark
              ? 0.8
              : 0.6;
        };

        const themeObserver =
          new MutationObserver(
            applyTheme
          );

        themeObserver.observe(
          document.documentElement,
          {
            attributes: true,
            attributeFilter: [
              "data-theme",
            ],
          }
        );

        applyTheme();

        // ------------------------------------------------------------
        // WebGL context handling
        // ------------------------------------------------------------

        const onContextLost =
          (e: Event) => {
            e.preventDefault();

            stop();
          };

        const onContextRestored =
          () => {
            start();
          };

        renderer.domElement.addEventListener(
          "webglcontextlost",
          onContextLost
        );

        renderer.domElement.addEventListener(
          "webglcontextrestored",
          onContextRestored
        );

        // ------------------------------------------------------------
        // Cleanup
        // ------------------------------------------------------------

        cleanup = () => {
          stop();

          io.disconnect();

          ro.disconnect();

          themeObserver.disconnect();

          renderer.domElement.removeEventListener(
            "webglcontextlost",
            onContextLost
          );

          renderer.domElement.removeEventListener(
            "webglcontextrestored",
            onContextRestored
          );

          root.traverse(
            (obj: ThreeNS.Object3D) => {
              const mesh =
                obj as ThreeNS.Mesh;

              if (!mesh.isMesh) {
                return;
              }

              mesh.geometry?.dispose();

              const mats =
                Array.isArray(
                  mesh.material
                )
                  ? mesh.material
                  : [mesh.material];

              mats.forEach(
                (
                  m:
                    | ThreeNS.Material
                    | ThreeNS.Material[]
                ) => {
                  if (
                    !Array.isArray(
                      m
                    )
                  ) {
                    m?.dispose();
                  }
                }
              );
            }
          );

          envRT.texture.dispose();

          renderer.dispose();

          renderer.domElement.remove();
        };
      } catch (err) {
        console.warn(
          "HeartModel: failed to start",
          err
        );

        if (!disposed) {
          setState("failed");
        }
      }
    })();

    return () => {
      disposed = true;

      cleanup?.();
    };
  }, []);

  // --------------------------------------------------------------
  // JSX
  // --------------------------------------------------------------

  return (
    <figure
      className="heart-stage"
      aria-label="3D beating heart"
    >
      <div
        className="heart-mount"
        ref={mountRef}
        data-state={state}
      />

      {state !== "ready" && (
        <div
          className={`heart-fallback ${
            state === "loading"
              ? "is-loading"
              : ""
          }`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 120 110"
            width="120"
            height="110"
          >
            <path
              d="
                M60 98
                C20 72, 8 46, 12 28
                C16 12, 34 4, 48 12
                C54 16, 58 22, 60 28
                C62 22, 66 16, 72 12
                C86 4, 104 12, 108 28
                C112 46, 100 72, 60 98 Z
              "
              fill="var(--danger-soft)"
              stroke="var(--danger)"
              strokeWidth="2"
            />
          </svg>
        </div>
      )}

      {/*
        CC-BY-4.0 attribution:
        The model (public/models/human-heart) is
        "Human Heart" by reynosa2000 (Sketchfab).

        Credit is intentionally not shown in the UI at the
        owner's request. The requirement and credit text live in:

        public/models/human-heart/license.txt

        and must be restored before public/commercial distribution.
      */}
    </figure>
  );
}