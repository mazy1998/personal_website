// Widget: visualize the visibility indicator V(x, u) by raycasting.
// We pick a fixed surface point x on a (slowly rotating) torus, animate a direction u on S^2,
// cast a ray from "infinity" along -u, and set V(x,u)=1 iff the first hit is at x.
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
        var idx = [];
        for (var j = 1; j < parts.length; j++) {
          var tok = parts[j];
          if (!tok) continue;
          var vi = tok.split("/")[0];
          var n = parseInt(vi, 10);
          if (!isFinite(n)) continue;
          if (n < 0) n = verts.length + 1 + n;
          idx.push(n - 1);
        }
        if (idx.length < 3) continue;
        for (var k = 1; k + 1 < idx.length; k++) faces.push([idx[0], idx[k], idx[k + 1]]);
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
    if (geom.boundingBox) {
      var bb = geom.boundingBox;
      var cx = (bb.min.x + bb.max.x) / 2;
      var cy = (bb.min.y + bb.max.y) / 2;
      var cz = (bb.min.z + bb.max.z) / 2;
      geom.translate(-cx, -cy, -cz);
    }
    return geom;
  }

  function initVisibilityScene(opts) {
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
    camera.position.set(4.1, 3.2, 5.2);
    camera.lookAt(0, 1.1, 0);

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
    sCam.far = 50;
    sCam.left = -(theme.shadowCameraSize || 4);
    sCam.right = theme.shadowCameraSize || 4;
    sCam.top = theme.shadowCameraSize || 4;
    sCam.bottom = -(theme.shadowCameraSize || 4);
    scene.add(sun);
    scene.add(sun.target);

    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
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

    var grid = new THREE.GridHelper(16, 32, theme.gridColor1 || 0xcccccc, theme.gridColor2 || 0xe0e0e0);
    grid.position.y = 0.001;
    scene.add(grid);

    var torusMesh = null;
    var xLocal = null;

    // Point marker at x (turns green if visible, red if occluded)
    var xSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xff4d4d, roughness: 0.6, metalness: 0.0 })
    );
    scene.add(xSphere);

    // Direction arrow u (cyan) and incoming ray (orange)
    var uArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), 1.2, 0x17becf, 0.18, 0.10);
    scene.add(uArrow);

    var rayGeom = new THREE.BufferGeometry();
    rayGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    var rayLine = new THREE.Line(rayGeom, new THREE.LineBasicMaterial({ color: 0xff7f0e, transparent: true, opacity: 0.9 }));
    scene.add(rayLine);

    var raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;

    function setTorusGeometry(geom) {
      if (torusMesh) {
        scene.remove(torusMesh);
        if (torusMesh.geometry) torusMesh.geometry.dispose();
        if (torusMesh.material) torusMesh.material.dispose();
      }
      var mat = new THREE.MeshStandardMaterial({
        color: theme.objectColor || 0xa8dadc,
        metalness: theme.objectMetalness || 0.0,
        roughness: theme.objectRoughness || 0.92
      });
      torusMesh = new THREE.Mesh(geom, mat);
      torusMesh.position.y = 1.35;
      torusMesh.castShadow = true;
      torusMesh.receiveShadow = true;
      scene.add(torusMesh);

      // Choose x as a stable vertex (top/front-ish).
      var posAttr = torusMesh.geometry.getAttribute("position");
      var bestIdx = 0;
      var bestScore = -1e9;
      for (var i = 0; i < posAttr.count; i++) {
        var px = posAttr.getX(i), py = posAttr.getY(i), pz = posAttr.getZ(i);
        var score = 2.0 * py + 0.7 * pz - 0.15 * Math.abs(px);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      xLocal = new THREE.Vector3(posAttr.getX(bestIdx), posAttr.getY(bestIdx), posAttr.getZ(bestIdx));
    }

    // Use procedural torus geometry (no external OBJ needed)
    (function createTorus() {
      var geom = new THREE.TorusGeometry(1.0, 0.35, 32, 96);
      geom.scale(1.0, 1.0, 2.0);
      geom.computeVertexNormals();
      geom.computeBoundingSphere();
      if (geom.boundingSphere) {
        var r = geom.boundingSphere.radius || 1;
        var s = 1.25 / r;
        geom.scale(s, s, s);
      }
      setTorusGeometry(geom);
    })();

    function resizeCanvas() {
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = canvas.getBoundingClientRect();
      renderer.setPixelRatio(dpr);
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    }

    function setRayLine(a, b) {
      var arr = rayGeom.getAttribute("position").array;
      arr[0] = a.x; arr[1] = a.y; arr[2] = a.z;
      arr[3] = b.x; arr[4] = b.y; arr[5] = b.z;
      rayGeom.getAttribute("position").needsUpdate = true;
    }

    function animate(t) {
      var tt = (t || 0) * 0.001;
      if (torusMesh) {
        // Slow rotation so occlusion changes are visible.
        torusMesh.rotation.y = tt * 0.06;
        torusMesh.updateMatrixWorld(true);
      }

      if (torusMesh && xLocal) {
        var xWorld = xLocal.clone().applyMatrix4(torusMesh.matrixWorld);
        xSphere.position.copy(xWorld);

        // Animate u on S^2 (mostly above to reduce degenerate grazing rays).
        var phi = tt * 1.4;
        var theta = 0.55 + 0.35 * Math.sin(tt * 0.55); // stays away from poles
        var u = new THREE.Vector3(
          Math.cos(phi) * Math.sin(theta),
          Math.cos(theta),
          Math.sin(phi) * Math.sin(theta)
        ).normalize();

        // Display u as an arrow at x.
        uArrow.position.copy(xWorld);
        uArrow.setDirection(u);

        // Ray from "infinity" in direction -u (i.e., coming from +u).
        var L = 20;
        var origin = xWorld.clone().addScaledVector(u, L);
        var dir = u.clone().multiplyScalar(-1);

        // Raycast to first surface hit.
        raycaster.set(origin, dir);
        var hits = raycaster.intersectObject(torusMesh, true);
        var visible = false;
        if (hits && hits.length) {
          // If first hit point is sufficiently close to xWorld, treat as visible.
          var hit = hits[0];
          var eps = 0.12;
          visible = hit.point.distanceTo(xWorld) < eps;

          // Draw ray segment to the first hit.
          setRayLine(origin, hit.point);
        } else {
          // No hit: draw a ray segment toward x (fallback).
          setRayLine(origin, xWorld);
        }

        xSphere.material.color.setHex(visible ? 0x2ca02c : 0xff4d4d);
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    requestAnimationFrame(animate);
  }

  window.KatexStaticWidgets = window.KatexStaticWidgets || {};
  window.KatexStaticWidgets.initVisibilityScene = initVisibilityScene;
})();


