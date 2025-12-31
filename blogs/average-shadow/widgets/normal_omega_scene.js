// Widget: static torus + a single surface point x, its outward normal n(x),
// and a moving direction omega sweeping the outward hemisphere at x.
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

  // Minimal OBJ parser: supports v and f; fan triangulation for ngons.
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

  function orthonormalBasis(n) {
    // Create tangents t1,t2 so that {t1,t2,n} is orthonormal.
    var t1;
    if (Math.abs(n.y) < 0.9) t1 = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    else t1 = new THREE.Vector3(1, 0, 0).cross(n).normalize();
    var t2 = n.clone().cross(t1).normalize();
    return { t1: t1, t2: t2 };
  }

  function initNormalOmegaScene(opts) {
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
    // Slightly higher camera for a clearer view of the local frame at x.
    camera.position.set(3.8, 3.1, 4.8);
    camera.lookAt(0, 1.05, 0);

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
    sCam.far = 40;
    sCam.left = -(theme.shadowCameraSize || 4);
    sCam.right = theme.shadowCameraSize || 4;
    sCam.top = theme.shadowCameraSize || 4;
    sCam.bottom = -(theme.shadowCameraSize || 4);
    scene.add(sun);
    scene.add(sun.target);

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

    var torusMesh = null;

    // Visual elements for multiple {x, n(x), hemisphere, omega} frames
    var frames = [];
    var frameConfig = {
      xRadius: 0.038,
      arrowNLen: 0.45,
      arrowWLen: 0.425,
      headLen: 0.11,
      headWidth: 0.065,
      hemiRadius: 0.45
    };

    function makeFrame() {
      var xSphere = new THREE.Mesh(
        new THREE.SphereGeometry(frameConfig.xRadius, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.6, metalness: 0.0 })
      );
      xSphere.castShadow = false;
      xSphere.receiveShadow = false;
      scene.add(xSphere);

      var nArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 1, 0),
        frameConfig.arrowNLen,
        0x1f77b4,
        frameConfig.headLen,
        frameConfig.headWidth
      );
      scene.add(nArrow);

      var wArrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        frameConfig.arrowWLen,
        0x2ca02c,
        frameConfig.headLen,
        frameConfig.headWidth
      );
      scene.add(wArrow);

      var hemi = new THREE.Mesh(
        // Hemisphere oriented initially along +Y (top half of a sphere)
        new THREE.SphereGeometry(frameConfig.hemiRadius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.08, depthWrite: false })
      );
      scene.add(hemi);

      return { xSphere: xSphere, nArrow: nArrow, wArrow: wArrow, hemi: hemi, xLocal: null, nLocal: null };
    }

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
      torusMesh.position.y = 1.35; // a bit above ground
      torusMesh.castShadow = true;
      torusMesh.receiveShadow = true;
      scene.add(torusMesh);

      // Pick a few representative surface points (local coordinates) so we can attach frames.
      var posAttr = torusMesh.geometry.getAttribute("position");
      var nAttr = torusMesh.geometry.getAttribute("normal");

      function scoreAt(i, w) {
        var px = posAttr.getX(i), py = posAttr.getY(i), pz = posAttr.getZ(i);
        return w.y * py + w.z * pz + w.xAbs * -Math.abs(px);
      }

      var candidates = [
        { name: "top-front", w: { y: 2.0, z: 0.8, xAbs: 0.15 } },
        { name: "top-back", w: { y: 2.0, z: -0.8, xAbs: 0.15 } },
        { name: "side", w: { y: 0.7, z: 0.2, xAbs: -0.8 } } // prefer |x| large
      ];

      // Clear old frames if any
      for (var fi = 0; fi < frames.length; fi++) {
        scene.remove(frames[fi].xSphere);
        scene.remove(frames[fi].nArrow);
        scene.remove(frames[fi].wArrow);
        scene.remove(frames[fi].hemi);
      }
      frames = [];

      var chosen = [];
      var minSep = 0.55; // local-space separation threshold

      function tooClose(p) {
        for (var ci = 0; ci < chosen.length; ci++) if (chosen[ci].distanceTo(p) < minSep) return true;
        return false;
      }

      for (var c = 0; c < candidates.length; c++) {
        var bestIdx = 0;
        var bestScore = -1e9;
        for (var ii = 0; ii < posAttr.count; ii++) {
          var sc = scoreAt(ii, candidates[c].w);
          if (sc > bestScore) {
            bestScore = sc;
            bestIdx = ii;
          }
        }
        var pLocal = new THREE.Vector3(posAttr.getX(bestIdx), posAttr.getY(bestIdx), posAttr.getZ(bestIdx));
        // If too close, search a little for an alternative.
        if (tooClose(pLocal)) {
          for (var tries = 0; tries < 5000; tries++) {
            var jj = (bestIdx + 37 * tries) % posAttr.count;
            var pTry = new THREE.Vector3(posAttr.getX(jj), posAttr.getY(jj), posAttr.getZ(jj));
            if (!tooClose(pTry)) {
              pLocal = pTry;
              bestIdx = jj;
              break;
            }
          }
        }
        chosen.push(pLocal);

        var frame = makeFrame();
        frame.xLocal = pLocal.clone();
        frame.nLocal = new THREE.Vector3(nAttr.getX(bestIdx), nAttr.getY(bestIdx), nAttr.getZ(bestIdx)).normalize();
        frames.push(frame);
      }
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

    function animate(t) {
      var tt = (t || 0) * 0.001;
      if (torusMesh) {
        // Very slow rotation for context.
        torusMesh.rotation.y = tt * 0.08;
        torusMesh.rotation.x = Math.sin(tt * 0.12) * 0.03;
        torusMesh.updateMatrixWorld(true);
      }

      // Sweep omega over hemisphere: faster sweep than before.
      // theta in [0, pi/2), phi wraps [0, 2pi)
      var phiBase = tt * 2.2;
      var thetaBase = 0.12 + 0.75 * (0.5 + 0.5 * Math.sin(tt * 1.05));
      thetaBase = Math.min(thetaBase, Math.PI / 2 - 0.02);

      for (var fi2 = 0; fi2 < frames.length; fi2++) {
        var fr = frames[fi2];
        if (!fr.xLocal || !fr.nLocal || !torusMesh) continue;

        var xWorld = fr.xLocal.clone().applyMatrix4(torusMesh.matrixWorld);
        var nWorld = fr.nLocal.clone().transformDirection(torusMesh.matrixWorld).normalize();
        var basis = orthonormalBasis(nWorld);

        fr.xSphere.position.copy(xWorld);
        fr.nArrow.position.copy(xWorld);
        fr.nArrow.setDirection(nWorld);

        fr.hemi.position.copy(xWorld);
        var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nWorld);
        fr.hemi.setRotationFromQuaternion(q);

        // Slight phase offsets so each omega isn't synchronized.
        var phi = phiBase + fi2 * 2.1;
        var theta = Math.min(thetaBase + 0.06 * fi2, Math.PI / 2 - 0.02);

        var w = nWorld.clone().multiplyScalar(Math.cos(theta))
          .add(basis.t1.clone().multiplyScalar(Math.sin(theta) * Math.cos(phi)))
          .add(basis.t2.clone().multiplyScalar(Math.sin(theta) * Math.sin(phi)))
          .normalize();

        fr.wArrow.position.copy(xWorld);
        fr.wArrow.setDirection(w);
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    requestAnimationFrame(animate);
  }

  window.KatexStaticWidgets = window.KatexStaticWidgets || {};
  window.KatexStaticWidgets.initNormalOmegaScene = initNormalOmegaScene;
})();


