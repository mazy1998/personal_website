// Widget: load an OBJ mesh (torus_aspect_2.obj), rotate it, and show a ground plane with a shadow.
//
// Notes:
// - On `file://`, many browsers block XHR/fetch to local files. We attempt XHR; if it fails, we fall back
//   to a procedural torus so the widget still works without a server.
// - Uses Three.js shadow mapping (fast, good looking, and “directional light at infinity”).
(function () {
  function makeErrorEl(msg) {
    var el = document.createElement("div");
    el.style.cssText =
      "margin-top:10px;padding:10px 12px;border:1px solid rgba(0,0,0,0.12);border-radius:10px;background:rgba(255,0,0,0.04);color:rgba(0,0,0,0.75);font-size:13px;";
    el.textContent = msg;
    return el;
  }

  function loadTextXHR(url, cb) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) cb(null, xhr.responseText);
        else cb(new Error("XHR status " + xhr.status + " for " + url));
      };
      xhr.send(null);
    } catch (e) {
      cb(e);
    }
  }

  // Minimal OBJ parser: supports v/vn/vt (ignored) and f triangles/quads/ngons (fan triangulation).
  function parseOBJToGeometry(THREE, objText) {
    var verts = [];
    var faces = [];

    var lines = objText.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line[0] === "#") continue;
      var parts = line.split(/\s+/);
      var tag = parts[0];
      if (tag === "v" && parts.length >= 4) {
        verts.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
      } else if (tag === "f" && parts.length >= 4) {
        // Each part can be: v, v/vt, v//vn, v/vt/vn
        var idx = [];
        for (var j = 1; j < parts.length; j++) {
          var tok = parts[j];
          if (!tok) continue;
          var vi = tok.split("/")[0];
          var n = parseInt(vi, 10);
          if (!isFinite(n)) continue;
          // OBJ indices are 1-based; negative indices are relative to end.
          if (n < 0) n = verts.length + 1 + n;
          idx.push(n - 1);
        }
        if (idx.length < 3) continue;
        // Fan triangulate: (0, k, k+1)
        for (var k = 1; k + 1 < idx.length; k++) {
          faces.push([idx[0], idx[k], idx[k + 1]]);
        }
      }
    }

    var positions = new Float32Array(faces.length * 9);
    var p = 0;
    for (var f = 0; f < faces.length; f++) {
      var a = faces[f][0], b = faces[f][1], c = faces[f][2];
      var va = verts[a], vb = verts[b], vc = verts[c];
      positions[p++] = va[0]; positions[p++] = va[1]; positions[p++] = va[2];
      positions[p++] = vb[0]; positions[p++] = vb[1]; positions[p++] = vb[2];
      positions[p++] = vc[0]; positions[p++] = vc[1]; positions[p++] = vc[2];
    }

    var geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    geom.computeBoundingSphere();

    // Center geometry at origin.
    if (geom.boundingBox) {
      var bb = geom.boundingBox;
      var cx = (bb.min.x + bb.max.x) / 2;
      var cy = (bb.min.y + bb.max.y) / 2;
      var cz = (bb.min.z + bb.max.z) / 2;
      geom.translate(-cx, -cy, -cz);
    }
    return geom;
  }

  function initTorusScene(opts) {
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

    var camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    camera.position.set(3.6, 2.8, 4.6);
    camera.lookAt(0, 0.6, 0);

    scene.add(new THREE.AmbientLight(0xffffff, theme.ambientIntensity || 0.35));

    // Directional light from straight above (parallel rays).
    var sun = new THREE.DirectionalLight(0xffffff, theme.dirIntensity || 1.0);
    sun.position.set(theme.dirPosition.x, theme.dirPosition.y, theme.dirPosition.z);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.bias = theme.shadowBias || 0.0001;
    scene.add(sun);
    scene.add(sun.target);

    // Tight orthographic shadow camera for crisp “orthographic” look.
    sun.shadow.mapSize.width = theme.shadowMapSize || 1024;
    sun.shadow.mapSize.height = theme.shadowMapSize || 1024;
    var sCam = sun.shadow.camera;
    sCam.near = 0.1;
    sCam.far = 30;
    sCam.left = -(theme.shadowCameraSize || 4);
    sCam.right = theme.shadowCameraSize || 4;
    sCam.top = theme.shadowCameraSize || 4;
    sCam.bottom = -(theme.shadowCameraSize || 4);

    // Ground plane to receive shadow.
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
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

    var grid = new THREE.GridHelper(14, 28, theme.gridColor1 || 0xcccccc, theme.gridColor2 || 0xe0e0e0);
    grid.position.y = 0.001;
    scene.add(grid);

    var mesh = null;

    function setMeshGeometry(geom) {
      if (mesh) {
        scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
      }
      // Matte light blue (match cube)
      var mat = new THREE.MeshStandardMaterial({
        color: theme.objectColor || 0xa8dadc,
        metalness: theme.objectMetalness || 0.0,
        roughness: theme.objectRoughness || 0.92
      });
      mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 1.375; // ~10% higher than 1.25
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    // Use procedural torus geometry (no external OBJ needed)
    (function createTorus() {
      var geom = new THREE.TorusGeometry(1.0, 0.35, 32, 96);
      geom.scale(1.0, 1.0, 2.0);
      geom.computeVertexNormals();
      setMeshGeometry(geom);
    })();

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
      if (mesh) {
        // Match cube rotation rates.
        mesh.rotation.y = tt * 0.9;
        mesh.rotation.x = tt * 0.55;
        mesh.position.y = 1.485 + 0.05 * Math.sin(tt * 1.4); // ~10% higher than 1.35
      }
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    requestAnimationFrame(animate);
  }

  window.KatexStaticWidgets = window.KatexStaticWidgets || {};
  window.KatexStaticWidgets.initTorusScene = initTorusScene;
})();


