// Widget: visualize the orthographic projection area integrand:
// - a small surface patch with normal n(x)
// - a direction u on S^2
// - the cosine factor (n·u)_+ controls the patch brightness (front-facing only)
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

  function initProjectionScene(opts) {
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

    var scene = new THREE.Scene();
    scene.background = null;

    var camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    camera.position.set(2.9, 2.4, 3.2);
    camera.lookAt(0, 1.05, 0);

    scene.add(new THREE.AmbientLight(0xffffff, theme.ambientIntensity || 0.35));
    var sun = new THREE.DirectionalLight(0xffffff, theme.dirIntensity || 1.0);
    sun.position.set(theme.dirPosition.x, theme.dirPosition.y, theme.dirPosition.z);
    sun.target.position.set(0, 0, 0);
    scene.add(sun);
    scene.add(sun.target);

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshStandardMaterial({
        color: theme.groundColor || 0xf2f2f2,
        roughness: theme.groundRoughness || 0.95,
        metalness: 0.0
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    var grid = new THREE.GridHelper(10, 20, theme.gridColor1 || 0xcccccc, theme.gridColor2 || 0xe0e0e0);
    grid.position.y = 0.001;
    scene.add(grid);

    // A small patch at a point x (centered above the ground).
    var x = new THREE.Vector3(0, 1.05, 0);
    var patchGeo = new THREE.PlaneGeometry(0.9, 0.9);
    var patchMat = new THREE.MeshStandardMaterial({
      color: theme.objectColor || 0xa8dadc,
      metalness: theme.objectMetalness || 0.0,
      roughness: theme.objectRoughness || 0.92,
      side: THREE.DoubleSide
    });
    var patch = new THREE.Mesh(patchGeo, patchMat);
    patch.position.copy(x);
    // Tilt the patch a bit so n isn't trivial.
    patch.rotation.x = -0.55;
    patch.rotation.z = 0.35;
    scene.add(patch);

    // Marker for x
    var xSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.6, metalness: 0.0 })
    );
    xSphere.position.copy(x);
    scene.add(xSphere);

    // Normal arrow n(x)
    var nArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), x, 0.55, 0x1f77b4, 0.14, 0.08);
    scene.add(nArrow);

    // Direction arrow u
    var uArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), x, 0.55, 0x17becf, 0.14, 0.08);
    scene.add(uArrow);

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

      // Move u on the sphere of directions.
      var phi = tt * 1.25;
      var theta = 0.65 + 0.45 * Math.sin(tt * 0.7);
      theta = Math.max(0.15, Math.min(1.45, theta));
      var u = new THREE.Vector3(
        Math.cos(phi) * Math.sin(theta),
        Math.cos(theta),
        Math.sin(phi) * Math.sin(theta)
      ).normalize();

      // Compute n(x) from patch orientation in world space.
      patch.updateMatrixWorld(true);
      var n = new THREE.Vector3(0, 0, 1).transformDirection(patch.matrixWorld).normalize(); // PlaneGeometry faces +Z

      nArrow.position.copy(x);
      nArrow.setDirection(n);

      uArrow.position.copy(x);
      uArrow.setDirection(u);

      var cos = n.dot(u);
      var cosPos = Math.max(cos, 0);

      // Visualize (n·u)_+ as brightness: front-facing gets brighter, back-facing dims.
      // Keep a floor so the patch remains visible.
      var base = 0.12;
      var intensity = base + 0.88 * cosPos;
      patchMat.color.setHex(theme.objectColor || 0xa8dadc);
      patchMat.emissive.setRGB(intensity * 0.18, intensity * 0.18, intensity * 0.18);
      patchMat.needsUpdate = true;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    requestAnimationFrame(animate);
  }

  window.KatexStaticWidgets = window.KatexStaticWidgets || {};
  window.KatexStaticWidgets.initProjectionScene = initProjectionScene;
})();


