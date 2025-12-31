// Shared theme and constants for KaTeX static widgets
(function () {
  window.KatexStaticTheme = {
    // Lighting
    // Slightly higher ambient + slightly lower directional reduces shadow contrast.
    ambientIntensity: 0.75,
    dirIntensity: 0.5,
    dirPosition: { x: 0, y: 20, z: 0 },

    // Materials
    objectColor: 0xa8dadc, // Matte light blue
    objectRoughness: 0.99,
    objectMetalness: 0.0,

    groundColor: 0xf2f2f2,
    groundRoughness: 0.95,

    // Grid
    gridColor1: 0xcccccc,
    gridColor2: 0xe0e0e0,

    // Shadows
    shadowMapType: 0, // 0: BasicShadowMap (hard), 1: PCFShadowMap, 2: PCFSoftShadowMap
    // For the custom projection mesh in shadow_scene.js
    projectionOpacity: 0.4,
    projectionColor: 0x000000,

    // For the real shadows in torus_scene.js
    shadowBias: 0.0001,
    shadowMapSize: 1024,
    shadowCameraSize: 4
  };
})();

