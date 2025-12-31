// Widget: single-canvas Three.js scene with cube hovering over a ground plane,
// plus an orthographic projected shadow (polygon) drawn on the plane.
//
// This is written as a classic script (no ES modules) so it can run on `file://`.
(function () {
  function makeErrorEl(msg) {
    var el = document.createElement("div");
    el.style.cssText =
      "margin-top:10px;padding:10px 12px;border:1px solid rgba(0,0,0,0.12);border-radius:10px;background:rgba(255,0,0,0.04);color:rgba(0,0,0,0.75);font-size:13px;";
    el.textContent = msg;
    return el;
  }

  function initShadowScene(opts) {
    var THREE = window.THREE;
    if (!THREE) throw new Error("THREE not found on window. Did you load three.min.js?");
    var theme = window.KatexStaticTheme || {};

    var canvas = document.getElementById(opts.canvasId);
    var mount = document.getElementById(opts.mountId);
    if (!canvas || !mount) return;

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

    var camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    camera.position.set(2.8, 2.2, 3.4);
    camera.lookAt(0, 0.35, 0);

    scene.add(new THREE.AmbientLight(0xffffff, theme.ambientIntensity || 0.35));
    var dirLight = new THREE.DirectionalLight(0xffffff, theme.dirIntensity || 1.0);
    dirLight.position.set(theme.dirPosition.x, theme.dirPosition.y, theme.dirPosition.z);
    dirLight.target.position.set(0, 0, 0);
    dirLight.castShadow = true;
    dirLight.shadow.bias = theme.shadowBias || 0.0001;
    dirLight.shadow.mapSize.width = theme.shadowMapSize || 1024;
    dirLight.shadow.mapSize.height = theme.shadowMapSize || 1024;
    var sCam = dirLight.shadow.camera;
    // Match torus widget shadow camera settings for consistency.
    sCam.near = 0.1;
    sCam.far = 30;
    sCam.left = -(theme.shadowCameraSize || 4);
    sCam.right = theme.shadowCameraSize || 4;
    sCam.top = theme.shadowCameraSize || 4;
    sCam.bottom = -(theme.shadowCameraSize || 4);
    scene.add(dirLight);
    scene.add(dirLight.target);

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshStandardMaterial({
        color: theme.groundColor || 0xf2f2f2,
        roughness: theme.groundRoughness || 0.95,
        metalness: 0.0
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    var grid = new THREE.GridHelper(12, 24, theme.gridColor1 || 0xcccccc, theme.gridColor2 || 0xe0e0e0);
    grid.position.y = 0.001;
    scene.add(grid);

    var cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: theme.objectColor || 0xa8dadc,
        metalness: theme.objectMetalness || 0.0,
        roughness: theme.objectRoughness || 0.92
      })
    );
    cube.position.y = 1.25;
    cube.castShadow = true;
    // Avoid self-shadowing artifacts on the cube (shadow acne) while keeping a clean ground shadow.
    cube.receiveShadow = false;
    scene.add(cube);
    function resizeCanvas() {
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = canvas.getBoundingClientRect();
      renderer.setPixelRatio(dpr);
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    }

    function animate(t) {
      var tt = (t || 0) * 0.001;
      cube.rotation.y = tt * 0.9;
      cube.rotation.x = tt * 0.55;
      cube.position.y = 1.25 + 0.05 * Math.sin(tt * 1.4);
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    requestAnimationFrame(animate);
  }

  window.KatexStaticWidgets = window.KatexStaticWidgets || {};
  window.KatexStaticWidgets.initShadowScene = initShadowScene;
})();


