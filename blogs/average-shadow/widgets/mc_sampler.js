// Shared Monte Carlo sampler for the KaTeX static widgets.
// Produces a synchronized stream of directions u ∈ S^2 and running mean of A_proj(u) for a unit cube.
//
// Classic script (no ES modules).
(function () {
  if (window.KatexStaticMCSampler) return; // singleton

  function cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  function convexHull2D(points) {
    if (points.length <= 1) return points.slice();
    var pts = points.slice().sort(function (p, q) {
      return p.x === q.x ? p.y - q.y : p.x - q.x;
    });
    var lower = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    var upper = [];
    for (var j = pts.length - 1; j >= 0; j--) {
      var pp = pts[j];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pp) <= 0) upper.pop();
      upper.push(pp);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  function polygonArea(poly) {
    if (!poly || poly.length < 3) return 0;
    var a = 0;
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i];
      var q = poly[(i + 1) % poly.length];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a) * 0.5;
  }

  function orthonormalBasisFromU(THREE, u) {
    var a = Math.abs(u.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    var e1 = a.clone().cross(u).normalize();
    var e2 = u.clone().cross(e1).normalize();
    return { e1: e1, e2: e2 };
  }

  function randomDirection(THREE) {
    // Uniform on sphere.
    var z = 2 * Math.random() - 1;
    var t = 2 * Math.PI * Math.random();
    var r = Math.sqrt(Math.max(0, 1 - z * z));
    return new THREE.Vector3(r * Math.cos(t), z, r * Math.sin(t));
  }

  function projectedAreaUnitCube(THREE, u) {
    var verts = [
      new THREE.Vector3(-0.5, -0.5, -0.5),
      new THREE.Vector3(-0.5, -0.5, 0.5),
      new THREE.Vector3(-0.5, 0.5, -0.5),
      new THREE.Vector3(-0.5, 0.5, 0.5),
      new THREE.Vector3(0.5, -0.5, -0.5),
      new THREE.Vector3(0.5, -0.5, 0.5),
      new THREE.Vector3(0.5, 0.5, -0.5),
      new THREE.Vector3(0.5, 0.5, 0.5)
    ];
    var basis = orthonormalBasisFromU(THREE, u);
    var pts2 = [];
    for (var i = 0; i < verts.length; i++) {
      var v = verts[i];
      pts2.push({ x: v.dot(basis.e1), y: v.dot(basis.e2) });
    }
    var hull = convexHull2D(pts2);
    return polygonArea(hull);
  }

  var subscribers = [];
  var running = false;
  var lastMs = 0;
  var intervalMs = 1200; // default; widgets can override via setIntervalMs
  var directionFilter = null; // Optional filter: fn(u) => boolean. If set, resamples until filter passes.

  var n = 0;
  var mean = 0;
  var S = 6;
  var target = S / 4;
  var lastU = null;

  function tick(ms) {
    if (!running) return;
    if (!lastMs) lastMs = ms;

    if (ms - lastMs >= intervalMs) {
      lastMs = ms;
      var THREE = window.THREE;
      if (!THREE) {
        requestAnimationFrame(tick);
        return;
      }
      // Sample direction; resample if filter rejects it (max 50 attempts to avoid infinite loop).
      var u;
      var attempts = 0;
      do {
        u = randomDirection(THREE).normalize();
        attempts++;
      } while (directionFilter && !directionFilter(u) && attempts < 50);
      lastU = u.clone();
      var a = projectedAreaUnitCube(THREE, u);
      n += 1;
      mean += (a - mean) / n;

      var payload = { u: u, a: a, n: n, mean: mean, target: target, S: S };
      for (var i = 0; i < subscribers.length; i++) {
        try {
          subscribers[i](payload);
        } catch (e) {
          // Don't let a bad subscriber kill the stream.
          console.warn("MCSampler subscriber error:", e);
        }
      }
    }

    requestAnimationFrame(tick);
  }

  window.KatexStaticMCSampler = {
    subscribe: function (fn) {
      if (typeof fn !== "function") return function () {};
      subscribers.push(fn);
      if (!running) {
        running = true;
        requestAnimationFrame(tick);
      }
      // Push current state if available
      if (lastU) {
        fn({ u: lastU.clone(), a: null, n: n, mean: mean, target: target, S: S });
      }
      return function unsubscribe() {
        var idx = subscribers.indexOf(fn);
        if (idx >= 0) subscribers.splice(idx, 1);
      };
    },
    setIntervalMs: function (ms) {
      if (!isFinite(ms)) return;
      intervalMs = Math.max(50, ms);
    },
    getIntervalMs: function () {
      return intervalMs;
    },
    // Set a filter function: fn(u) => boolean. Only directions where fn(u) is true are sampled.
    setDirectionFilter: function (fn) {
      directionFilter = typeof fn === "function" ? fn : null;
    }
  };
})();


