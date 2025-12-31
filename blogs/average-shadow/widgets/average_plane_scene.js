// Widget: Same as average_scene.js, but instead of rotating the cube to follow u,
// the cube stays still and the *ground plane + grid* rotate according to u.
//
// Classic script (no ES modules) so it works on `file://`.
(function () {
  function makeErrorEl(msg) {
    var el = document.createElement("div");
    el.style.cssText =
      "margin-top:10px;padding:10px 12px;border:1px solid rgba(0,0,0,0.12);border-radius:10px;background:rgba(255,0,0,0.04);color:rgba(0,0,0,0.75);font-size:13px;";
    el.textContent = msg;
    return el;
  }

  // Sampling logic is shared via window.KatexStaticMCSampler (see mc_sampler.js)

  function initAveragePlaneScene(opts) {
    var THREE = window.THREE;
    if (!THREE) throw new Error("THREE not found on window. Did you load three.min.js?");
    var theme = window.KatexStaticTheme || {};

    var canvas = document.getElementById(opts.canvasId);
    var mount = document.getElementById(opts.mountId);
    if (!canvas || !mount) return;

    // Add an overlay readout (bottom-right corner, inside the .card).
    var card = canvas.parentElement;
    if (getComputedStyle(card).position === "static") card.style.position = "relative";

    var readout = document.createElement("div");
    readout.style.cssText =
      "position:absolute;right:14px;bottom:12px;padding:8px 10px;border:1px solid rgba(0,0,0,0.12);border-radius:10px;background:rgba(255,255,255,0.85);font-size:12px;color:rgba(0,0,0,0.75);backdrop-filter:saturate(1.1) blur(6px);white-space:pre;z-index:10;";
    readout.textContent = "Sampling…";
    card.appendChild(readout);

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
      mount.appendChild(makeErrorEl("Three.js WebGLRenderer failed to initialize (WebGL may be unavailable)."));
      console.error(e);
      return;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = theme.shadowMapType !== undefined ? theme.shadowMapType : THREE.PCFSoftShadowMap;

    var scene = new THREE.Scene();
    scene.background = null;

    // Match the camera framing used in shadow_scene.js (this is what makes it feel perfectly centered).
    var cubePos = new THREE.Vector3(0, 1.25, 0);
    var camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    camera.position.set(2.8, 2.2, 5.4);
    camera.lookAt(0, .65, 0);

    scene.add(new THREE.AmbientLight(0xffffff, theme.ambientIntensity || 0.35));
    var sun = new THREE.DirectionalLight(0xffffff, theme.dirIntensity || 1.0);
    sun.position.set(theme.dirPosition.x, theme.dirPosition.y, theme.dirPosition.z);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.bias = theme.shadowBias || 0.0001;
    sun.shadow.mapSize.width = theme.shadowMapSize || 1024;
    sun.shadow.mapSize.height = theme.shadowMapSize || 1024;
    var sCam = sun.shadow.camera;
    sCam.near = 0.1;
    sCam.far = 30;
    sCam.left = -(theme.shadowCameraSize || 4);
    sCam.right = theme.shadowCameraSize || 4;
    sCam.top = theme.shadowCameraSize || 4;
    sCam.bottom = -(theme.shadowCameraSize || 4);
    scene.add(sun);
    scene.add(sun.target);

    // Direction from cube toward camera (used to filter out bad samples).
    var camDir = new THREE.Vector3().subVectors(camera.position, cubePos).normalize();

    // --- Gaussian map overlay (separate canvas, absolutely positioned inside the .card) ---
    var overlaySize = 90;
    var overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = overlaySize * 2;
    overlayCanvas.height = overlaySize * 2;
    overlayCanvas.style.cssText = "position:absolute;left:10px;bottom:10px;width:" + overlaySize + "px;height:" + overlaySize + "px;border-radius:50%;pointer-events:none;z-index:10;border:2px solid rgba(0,0,0,0.08);box-shadow:0 2px 8px rgba(0,0,0,0.12);";
    card.appendChild(overlayCanvas);

    var overlayRenderer = new THREE.WebGLRenderer({ canvas: overlayCanvas, antialias: true, alpha: false });
    overlayRenderer.setPixelRatio(2);
    overlayRenderer.setSize(overlaySize, overlaySize, false);
    overlayRenderer.setClearColor(0xffffff, 1); // Clean white background

    var overlayScene = new THREE.Scene();
    overlayScene.background = new THREE.Color(0xffffff);
    var overlayCamera = new THREE.PerspectiveCamera(45, 1, 0.01, 50);
    overlayCamera.position.set(0.0, 0.0, 3.0);
    overlayCamera.lookAt(0, 0, 0);
    overlayScene.add(new THREE.AmbientLight(0xffffff, 0.85));
    overlayScene.add(new THREE.DirectionalLight(0xffffff, 0.3));

    // Translucent sphere with soft blue tint
    var sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 32, 24),
      new THREE.MeshStandardMaterial({ color: 0x6baed6, roughness: 0.7, metalness: 0.0, transparent: true, opacity: 0.3 })
    );
    overlayScene.add(sphere);

    // Direction arrow - bold teal, thicker
    var uArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1.08, 0x00897b, 0.22, 0.14);
    overlayScene.add(uArrow);

    // Still cube (does not rotate with u in this widget)
    var cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: theme.objectColor || 0xa8dadc,
        metalness: theme.objectMetalness || 0.0,
        roughness: theme.objectRoughness || 0.92
      })
    );
    cube.position.copy(cubePos);
    cube.castShadow = true;
    cube.receiveShadow = false;
    var cubeEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(cube.geometry),
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.35 })
    );
    cube.add(cubeEdges);
    scene.add(cube);

    // Ground plane + grid: we will rotate AND translate these with u so the cube stays "above" the plane.
    // Match the ground plane from shadow_scene.js exactly
    var planeOffset = 1.65; // same offset as the cube height above the horizontal plane in the other widget
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 3),
      new THREE.MeshStandardMaterial({
        color: theme.groundColor || 0xf2f2f2,
        roughness: theme.groundRoughness || 0.95,
        metalness: 0.0,
        side: THREE.DoubleSide
      })
    );
    // Base orientation like shadow_scene.js (horizontal XZ plane)
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    ground.receiveShadow = true;
    scene.add(ground);
    var groundBaseQuat = ground.quaternion.clone();

    // Smaller 3x3 grid for the plane scene
    var grid = new THREE.GridHelper(3, 6, theme.gridColor1 || 0xcccccc, theme.gridColor2 || 0xe0e0e0);
    grid.position.set(0, 0.001, 0);
    scene.add(grid);

    var up = new THREE.Vector3(0, 1, 0);

    // Track direction as a unit vector; slerp it so the plane moves along a sphere.
    var currentDir = new THREE.Vector3(0, 1, 0);
    var targetDir = new THREE.Vector3(0, 1, 0);

    // Sample cloud on Gaussian map
    var maxPts = 300;
    var pts = new Float32Array(maxPts * 3);
    var ptsGeo = new THREE.BufferGeometry();
    ptsGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    ptsGeo.setDrawRange(0, 0);
    var ptsMat = new THREE.PointsMaterial({ size: 0.045, color: 0xe65100, transparent: true, opacity: 0.9 }); // Orange points
    var ptsCloud = new THREE.Points(ptsGeo, ptsMat);
    overlayScene.add(ptsCloud);

    var writeIdx = 0;
    var drawCount = 0;

    function resizeCanvas() {
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = canvas.getBoundingClientRect();
      renderer.setPixelRatio(dpr);
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    }

    // Subscribe to the shared sampler so both widgets see identical u and identical mean.
    var sampler = window.KatexStaticMCSampler;
    if (sampler && sampler.setIntervalMs) sampler.setIntervalMs(1200);
    // Filter out directions where the plane would be between camera and cube.
    if (sampler && sampler.setDirectionFilter) {
      sampler.setDirectionFilter(function (u) {
        // u · camDir > -0.2 means the plane is not blocking the view.
        return u.x * camDir.x + u.y * camDir.y + u.z * camDir.z > -0.2;
      });
    }
    if (sampler && sampler.subscribe) {
      sampler.subscribe(function (payload) {
        if (!payload || !payload.u) return;
        var u = payload.u;

        uArrow.position.set(0, 0, 0);
        uArrow.setDirection(u);

        // Update target direction; animate() will slerp toward it along a sphere.
        targetDir.copy(u);

        pts[writeIdx * 3 + 0] = u.x;
        pts[writeIdx * 3 + 1] = u.y;
        pts[writeIdx * 3 + 2] = u.z;
        writeIdx = (writeIdx + 1) % maxPts;
        drawCount = Math.min(maxPts, drawCount + 1);
        ptsGeo.setDrawRange(0, drawCount);
        ptsGeo.attributes.position.needsUpdate = true;

        readout.textContent =
          "samples: " + payload.n +
          "\nmean A_proj: " + payload.mean.toFixed(3) +
          "\nS/4: " + payload.target.toFixed(3) +
          "\nerror: " + (payload.mean - payload.target).toFixed(3);
      });
    }

    function animate(t) {
      // Slerp the direction along a sphere (lerp + normalize approximates slerp for small steps).
      currentDir.lerp(targetDir, 0.08).normalize();

      // Compute plane position/rotation from the current direction.
      var planePos = cube.position.clone().addScaledVector(currentDir, -planeOffset);
      var frameQuat = new THREE.Quaternion().setFromUnitVectors(up, currentDir);
      var planeQuat = frameQuat.clone().multiply(groundBaseQuat);

      ground.position.copy(planePos);
      ground.quaternion.copy(planeQuat);

      grid.position.copy(planePos).addScaledVector(currentDir, 0.001);
      grid.quaternion.copy(frameQuat);

      // Light moves with the plane (perpendicular to it).
      var lightPos = planePos.clone().addScaledVector(currentDir, theme.dirPosition.y || 20);
      sun.position.copy(lightPos);
      sun.target.position.copy(planePos);
      sun.target.updateMatrixWorld();

      // Main scene render
      renderer.render(scene, camera);

      // Gaussian map (separate canvas/renderer — no interference with main scene)
      overlayRenderer.render(overlayScene, overlayCamera);

      requestAnimationFrame(animate);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    requestAnimationFrame(animate);
  }

  window.KatexStaticWidgets = window.KatexStaticWidgets || {};
  window.KatexStaticWidgets.initAveragePlaneScene = initAveragePlaneScene;
})();


