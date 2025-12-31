// Widget: 2D canvas visualization of cosine-weighted ambient occlusion.
// Shows a ray sweeping across a hemisphere (180°) with occluders above.
// When ray hits occluder: blocked (no contribution). When clear: contributes with cosine weight.
(function () {
  function initOcclusion2DScene(opts) {
    var canvas = document.getElementById(opts.canvasId);
    var mount = document.getElementById(opts.mountId);
    if (!canvas || !mount) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Theme colors (matching the site)
    var colors = {
      bg: "#ffffff",
      surface: "#333333",
      ray: "#1d3557",
      rayBlocked: "#e63946",
      rayOpen: "#2a9d8f",
      occluder: "#a8dadc",
      occluderStroke: "#457b9d",
      hemisphere: "rgba(168, 218, 220, 0.15)",
      hemisphereStroke: "#457b9d",
      text: "rgba(0,0,0,0.7)",
      contribution: "#2a9d8f",
      noContribution: "#e63946",
      cosineArc: "rgba(42, 157, 143, 0.3)",
      normal: "#1d3557"
    };

    // Occluders: defined as angular ranges [startAngle, endAngle] in degrees from vertical
    // Positive = right side, negative = left side
    var occluders = [
      { start: -70, end: -50, distance: 0.6 },
      { start: 20, end: 45, distance: 0.5 },
      { start: 55, end: 75, distance: 0.7 }
    ];

    var angle = 0; // Current ray angle in degrees (-90 to 90)
    var direction = 1; // 1 = going right, -1 = going left
    var speed = 0.35; // degrees per frame (slower sweep)

    function resize() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    function degToRad(deg) {
      return (deg * Math.PI) / 180;
    }

    function isOccluded(angleDeg) {
      for (var i = 0; i < occluders.length; i++) {
        if (angleDeg >= occluders[i].start && angleDeg <= occluders[i].end) {
          return occluders[i];
        }
      }
      return null;
    }

    function draw() {
      var rect = canvas.getBoundingClientRect();
      var w = rect.width;
      var h = rect.height;

      // Clear
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, w, h);

      // Layout
      var centerX = w / 2;
      var surfaceY = h * 0.75;
      var radius = Math.min(w * 0.38, h * 0.5);
      var surfaceWidth = w * 0.8;

      // Draw surface line
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX - surfaceWidth / 2, surfaceY);
      ctx.lineTo(centerX + surfaceWidth / 2, surfaceY);
      ctx.stroke();

      // Draw hemisphere outline
      ctx.strokeStyle = colors.hemisphereStroke;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(centerX, surfaceY, radius, Math.PI, 0, false);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fill hemisphere
      ctx.fillStyle = colors.hemisphere;
      ctx.beginPath();
      ctx.arc(centerX, surfaceY, radius, Math.PI, 0, false);
      ctx.closePath();
      ctx.fill();

      // Draw normal vector (pointing up)
      ctx.strokeStyle = colors.normal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, surfaceY);
      ctx.lineTo(centerX, surfaceY - radius * 0.85);
      ctx.stroke();
      // Arrow head
      ctx.beginPath();
      ctx.moveTo(centerX, surfaceY - radius * 0.85 - 8);
      ctx.lineTo(centerX - 5, surfaceY - radius * 0.85);
      ctx.lineTo(centerX + 5, surfaceY - radius * 0.85);
      ctx.closePath();
      ctx.fillStyle = colors.normal;
      ctx.fill();
      // Label
      ctx.font = "bold 14px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = colors.text;
      ctx.textAlign = "left";
      ctx.fillText("n(x)", centerX + 8, surfaceY - radius * 0.7);

      // Draw occluders
      for (var i = 0; i < occluders.length; i++) {
        var occ = occluders[i];
        var startRad = degToRad(90 - occ.start);
        var endRad = degToRad(90 - occ.end);
        var midAngle = (occ.start + occ.end) / 2;
        var midRad = degToRad(90 - midAngle);
        var dist = occ.distance * radius;

        // Occluder as arc segment
        var arcRadius = 18;
        var occCenterX = centerX + Math.cos(midRad) * dist;
        var occCenterY = surfaceY - Math.sin(midRad) * dist;

        // Draw as a small rectangle/block
        var blockWidth = Math.abs(occ.end - occ.start) * 1.8;
        var blockHeight = 12;

        ctx.save();
        ctx.translate(occCenterX, occCenterY);
        ctx.rotate(-midRad + Math.PI / 2);

        ctx.fillStyle = colors.occluder;
        ctx.strokeStyle = colors.occluderStroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-blockWidth / 2, -blockHeight / 2, blockWidth, blockHeight, 3);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }

      // Calculate current ray
      var rayRad = degToRad(90 - angle); // Convert to standard math angle
      var rayEndX = centerX + Math.cos(rayRad) * radius;
      var rayEndY = surfaceY - Math.sin(rayRad) * radius;

      var occluder = isOccluded(angle);
      var blocked = occluder !== null;

      // If blocked, calculate where ray stops
      var actualEndX = rayEndX;
      var actualEndY = rayEndY;
      if (blocked) {
        var dist = occluder.distance * radius * 0.95;
        actualEndX = centerX + Math.cos(rayRad) * dist;
        actualEndY = surfaceY - Math.sin(rayRad) * dist;
      }

      // Draw cosine weight arc (shows cos(theta) contribution)
      if (!blocked) {
        var cosTheta = Math.cos(degToRad(angle));
        var arcHeight = cosTheta * 40;
        ctx.fillStyle = colors.cosineArc;
        ctx.beginPath();
        ctx.moveTo(centerX, surfaceY);
        ctx.lineTo(centerX, surfaceY - arcHeight);
        ctx.lineTo(centerX + 25, surfaceY - arcHeight);
        ctx.lineTo(centerX + 25, surfaceY);
        ctx.closePath();
        ctx.fill();
      }

      // Draw the ray
      ctx.strokeStyle = blocked ? colors.rayBlocked : colors.rayOpen;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(centerX, surfaceY);
      ctx.lineTo(actualEndX, actualEndY);
      ctx.stroke();

      // Arrow head on ray
      var arrowLen = 10;
      var arrowAngle = 0.4;
      ctx.beginPath();
      ctx.moveTo(actualEndX, actualEndY);
      ctx.lineTo(
        actualEndX - arrowLen * Math.cos(rayRad - arrowAngle),
        actualEndY + arrowLen * Math.sin(rayRad - arrowAngle)
      );
      ctx.moveTo(actualEndX, actualEndY);
      ctx.lineTo(
        actualEndX - arrowLen * Math.cos(rayRad + arrowAngle),
        actualEndY + arrowLen * Math.sin(rayRad + arrowAngle)
      );
      ctx.stroke();

      // If blocked, draw X at intersection
      if (blocked) {
        ctx.strokeStyle = colors.noContribution;
        ctx.lineWidth = 3;
        var xSize = 8;
        ctx.beginPath();
        ctx.moveTo(actualEndX - xSize, actualEndY - xSize);
        ctx.lineTo(actualEndX + xSize, actualEndY + xSize);
        ctx.moveTo(actualEndX + xSize, actualEndY - xSize);
        ctx.lineTo(actualEndX - xSize, actualEndY + xSize);
        ctx.stroke();
      }

      // Draw ω label near ray
      ctx.font = "italic 14px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = blocked ? colors.rayBlocked : colors.rayOpen;
      ctx.textAlign = "center";
      var labelDist = blocked ? occluder.distance * radius * 0.5 : radius * 0.5;
      var labelX = centerX + Math.cos(rayRad) * labelDist + 15;
      var labelY = surfaceY - Math.sin(rayRad) * labelDist;
      ctx.fillText("ω", labelX, labelY);

      // Draw angle arc
      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 1;
      ctx.beginPath();
      var arcR = 35;
      if (angle >= 0) {
        ctx.arc(centerX, surfaceY, arcR, -Math.PI / 2, -rayRad, false);
      } else {
        ctx.arc(centerX, surfaceY, arcR, -rayRad, -Math.PI / 2, false);
      }
      ctx.stroke();

      // Angle label
      ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = colors.text;
      ctx.textAlign = "center";
      ctx.fillText("θ", centerX + 45, surfaceY - 20);

      // Status text - split into three fixed-position parts
      ctx.font = "bold 14px ui-sans-serif, system-ui, sans-serif";
      var statusY = h * 0.10;
      var cosVal = Math.cos(degToRad(angle)).toFixed(2);

      // Part 1: V(x, ω) = ? (left side, fixed position)
      ctx.textAlign = "right";
      ctx.fillStyle = blocked ? colors.noContribution : colors.contribution;
      ctx.fillText("V(x, ω) = " + (blocked ? "0" : "1"), centerX - 20, statusY);

      // Part 2: Status arrow and message (center, fixed position)
      ctx.textAlign = "left";
      ctx.fillStyle = colors.text;
      ctx.fillText("→", centerX - 10, statusY);
      ctx.fillStyle = blocked ? colors.noContribution : colors.contribution;
      ctx.fillText(blocked ? "Occluded" : "Visible", centerX + 5, statusY);

      // Part 3: cos(θ) = value (always visible, right side, fixed position)
      var cosY = statusY + 22;
      ctx.textAlign = "center";
      ctx.fillStyle = blocked ? colors.text : colors.contribution;
      ctx.globalAlpha = blocked ? 0.5 : 1.0;
      ctx.fillText("cos(θ) = " + cosVal, centerX, cosY);
      ctx.globalAlpha = 1.0;

      // Draw the surface point
      ctx.fillStyle = colors.surface;
      ctx.beginPath();
      ctx.arc(centerX, surfaceY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "bold 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = colors.text;
      ctx.textAlign = "center";
      ctx.fillText("x", centerX, surfaceY + 20);

      // 180° label
      ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = colors.text;
      ctx.textAlign = "left";
      ctx.fillText("-90°", centerX - radius - 25, surfaceY + 5);
      ctx.textAlign = "right";
      ctx.fillText("+90°", centerX + radius + 25, surfaceY + 5);
    }

    function animate() {
      // Update angle
      angle += direction * speed;

      // Bounce at edges
      if (angle >= 90) {
        angle = 90;
        direction = -1;
      } else if (angle <= -90) {
        angle = -90;
        direction = 1;
      }

      draw();
      requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener("resize", function () {
      resize();
      draw();
    });
    requestAnimationFrame(animate);
  }

  window.KatexStaticWidgets = window.KatexStaticWidgets || {};
  window.KatexStaticWidgets.initOcclusion2DScene = initOcclusion2DScene;
})();

