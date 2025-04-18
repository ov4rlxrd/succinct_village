import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Portal names - easy to edit here
const portalNames = [
    "Proof Verified",
    "Proved ur Love",
    "Prover",
    "Proofer",
    "SP1up",
    "Super Prover"
];

// Main variables
let scene, camera, renderer;
let character;
let controls;
let portalLight; // Reference to the glowing part of the portal
let portalSpotLight; // Spotlight from the portal
let portalPointLight; // Additional point light for volumetric glow effect
let portals = []; // Array of portals with information
let infoSigns = []; // Array of information signs
let activeInfoSign = null; // Current active sign
let wantedBoard = null; // Wanted board
let activeWantedBoard = false; // Flag for wanted board activity
let wantedObjects = []; // Array of wanted objects (want1-want6)
let raycaster = new THREE.Raycaster(); 
let mouse = new THREE.Vector2();
let collisionObjects = []; // Array of objects the character can collide with
let floor;
let moveSpeed = 0.1;
let characterHeight = 0;
let characterSize = 0.5;
let isNightMode = true; // Lighting mode flag (night mode by default)
let dayLight; // Light source for day mode
let torchLights = []; // Array for storing torch light sources
let fixedCameraPosition = new THREE.Vector3(30, 35, 30);
let infoPanel = null; // Reference to the information panel
let activePortal = null; // Current active portal
let torchMeshes = []; // Array of torch objects
let switchObject = null; // Switch object from Blender
let switchLight = null; // Light from switch in night mode
let switchAnimation = null; // Switch animation
let isSwitchAnimating = false; // Flag to track switch animation
let textModeNight = null; // Night mode icon object TextMode1
let textModeDay = null; // Day mode icon object TextMode2
let collisionRaycaster; // Raycaster for collision detection
let characterBoundingBox; // Character bounding box for collisions
let stairObjects = []; // Array of stair objects
let stairClimbSpeed = 0.15; // Stair climbing speed
let walkSound; // Walking sound
let portalSound; // Portal opening sound
let backgroundMusic; // Background music

// Переиспользуемые переменные для векторов и других объектов
const _tempVector = new THREE.Vector3();
const _tempVector2 = new THREE.Vector3();
const _tempVector3 = new THREE.Vector3();
const _tempQuaternion = new THREE.Quaternion();
const _tempColor = new THREE.Color();
const _tempBox = new THREE.Box3();
const _tempMatrix = new THREE.Matrix4();
const _tempRaycaster = new THREE.Raycaster();

// Camera control variables
let cameraMinDistance = 20; // Minimum distance to character
let cameraMaxDistance = 50; // Maximum distance to character
let currentCameraDistance = 35; // Current distance
let baseCameraPosition = new THREE.Vector3(30, 35, 30); // Base camera position
let cameraOffsetX = 0; // Camera X offset
let cameraOffsetY = 0; // Camera Y offset
let maxCameraOffset = 15; // Maximum camera offset
let isDragging = false; // Camera dragging flag
let lastMouseX = 0; // Last mouse X position
let lastMouseY = 0; // Last mouse Y position

// For selective Bloom effect
const BLOOM_SCENE = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);
const darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
const materials = {};

// Rendering composers
let bloomComposer, finalComposer;

// Bloom effect parameters
const bloomParams = {
    threshold: 0,
    strength: 0.8,
    radius: 0.35,
    exposure: 0.8
};

// Keyboard control variables
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    l: false, // Toggle lighting mode
    e: false  // Interact with objects
};

// Movement boundaries
const movementBounds = {
    minX: -200,
    maxX: 200,
    minZ: -200,
    maxZ: 200
};

// URLs for wanted objects
const wantedUrls = {
    want1: 'https://t.me/succinct_game_bot?start=stepaks',
    want2: 'https://t.me/succinct_game_bot?start=godblessme',
    want3: 'https://t.me/succinct_game_bot?start=crlaze',
    want4: 'https://t.me/succinct_game_bot?start=Yinger',
    want5: 'https://t.me/succinct_game_bot?start=M4lka',
    want6: 'https://t.me/succinct_game_bot?start=Pixie'
};


// Shader for combining normal scene and glow effect
const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform sampler2D baseTexture;
uniform sampler2D bloomTexture;
varying vec2 vUv;
void main() {
    gl_FragColor = (texture2D(baseTexture, vUv) + vec4(1.0) * texture2D(bloomTexture, vUv));
}
`;

// Function for smooth transition (cubic animation)
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Main initialization function
function init() {
    // Create scene with black background
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Black background
    
    // Set renderer to cover the entire screen
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance" 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = Math.pow(bloomParams.exposure, 4.0);
    
    // Enable shadows in renderer and use VSMShadowMap for soft shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    
    document.body.appendChild(renderer.domElement);
    
    // Set camera with optimized frustum
    // Уменьшаем far plane до 150 (было 1000) для лучшей производительности
    // Устанавливаем near plane в 0.5 вместо 0.1 - всё ещё достаточно для деталей вблизи
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 150);
    
    // Update camera position based on character
    fixedCameraPosition = baseCameraPosition.clone();
    camera.position.copy(fixedCameraPosition);
    
    // Point camera towards center of the scene
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    
    // Disable OrbitControls, as we're using our own camera control system
    controls = null;
    
    // Set up Bloom effect for glow
    setupPostProcessing();
    
    // Add event listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('click', onClick);
    
    // Set up camera controls
    setupCameraControls();
    
    // Load world from Blender
    loadWorldFromBlender();
    
    // Load character
    loadCharacter();
    
    // Initialize walking sound
    setupWalkSound();
    
    // Initialize portal opening sound
    setupPortalSound();
    
    // Initialize background music
    setupBackgroundMusic();
    
    // Add styles for information panel
    addInfoPanelStyles();
    
    // Initialize raycaster for collision detection
    collisionRaycaster = new THREE.Raycaster();
    
    // Start animation loop
    animate();
    
    // Add event listeners for mouse interaction
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onMouseClick);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
}

// Post-processing setup (selective Bloom effect)
function setupPostProcessing() {
    // Create render pass for the scene
    const renderScene = new RenderPass(scene, camera);
    
    // Create Bloom pass
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        bloomParams.strength,
        bloomParams.radius,
        bloomParams.threshold
    );
    
    // Composer for rendering only glow objects
    bloomComposer = new EffectComposer(renderer);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(renderScene);
    bloomComposer.addPass(bloomPass);
    
    // Shader for combining normal scene and glow effect
    const mixPass = new ShaderPass(
        new THREE.ShaderMaterial({
            uniforms: {
                baseTexture: { value: null },
                bloomTexture: { value: bloomComposer.renderTarget2.texture }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            defines: {}
        }), "baseTexture"
    );
    mixPass.needsSwap = true;
    
    // Final output pass
    const outputPass = new OutputPass();
    
    // Composer for rendering final scene
    finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(renderScene);
    finalComposer.addPass(mixPass);
    finalComposer.addPass(outputPass);
}

// Event handlers for key presses
function onKeyDown(event) {
    // If viewing wanted board, only process return key
    if (isViewingWantedBoard) {
        if (event.key.toLowerCase() === 'e') {
            returnFromWantedBoard();
        }
        return; // Ignore other keys while viewing board
    }

    switch(event.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
        case 'l': 
            // Check if key is already pressed
            if (!keys.l) {
                keys.l = true;
                toggleLightingMode();
            }
            break;
        case 'e':
            // Interact with objects
            if (!keys.e) {
                keys.e = true;
                
                // Если персонаж в хабе, обрабатываем выход
                if (isViewingHub) {
                    exitHub();
                    return;
                }
                
                // Check wanted board first (priority over other objects)
                if (activeWantedBoard) {
                    toggleWantedBoard();
                }
                // Then check information signs
                else if (activeInfoSign) {
                    toggleInfoSign(activeInfoSign);
                }
                // Then check portals (if no active sign)
                else if (activePortal) {
                    togglePortalInfo(activePortal);
                }
                // Then check if near hub trigger
                else {
                    let nearHubTrigger = false;
                    scene.traverse((node) => {
                        if (node.userData && node.userData.isHubTrigger) {
                            const distance = character.position.distanceTo(node.getWorldPosition(new THREE.Vector3()));
                            if (distance < 3) {
                                nearHubTrigger = true;
                            }
                        }
                    });
                    if (nearHubTrigger) {
                        enterHub();
                    }
                }
            }
            break;
    }
}

function onKeyUp(event) {
    switch(event.key.toLowerCase()) {
        case 'w': keys.w = false; break;
        case 'a': keys.a = false; break;
        case 's': keys.s = false; break;
        case 'd': keys.d = false; break;
        case 'l': keys.l = false; break;
        case 'e': keys.e = false; break;
    }
}

// Function to load world from Blender
function loadWorldFromBlender() {
    const loader = new GLTFLoader();
    
    loader.load(
      'scene.glb',
      (gltf) => {
        console.log('Loaded scene:', gltf);
        
        // Loop through all objects, find needed ones
        gltf.scene.traverse((node) => {
          // Remove all light sources from imported scene
          if (node.isLight) {
            console.log('Removing light source:', node.name);
            gltf.scene.remove(node);
          }
          
          // Find wanted board
          if (node.name === 'Wanted' || node.name.includes('wanted')) {
            console.log('Found wanted board:', node.name);
            // Get board position
            const wantedPosition = node.getWorldPosition(new THREE.Vector3());
            // Save information about wanted board
            setupWantedBoard(node, wantedPosition);
          }
          
          // Find wanted objects (want1-want6)
          if (node.name.match(/^want[1-6]$/)) {
            console.log('Found wanted object:', node.name);
            wantedObjects.push({
                mesh: node,
                originalMaterial: node.material.clone(),
                url: wantedUrls[node.name]
            });
            
            // Enable interaction
            node.userData.isWantedObject = true;
            node.userData.wantedId = wantedObjects.length - 1;
            
            // Add hover effect
            node.material = node.material.clone();
            node.material.emissive = new THREE.Color(0x000000);
            node.material.emissiveIntensity = 0;
          }
          
          // Find information signs by name
          if (node.name === 'Info' || node.name.includes('Info')) {
            console.log('Found information sign:', node.name);
            // Get sign position
            const infoPosition = node.getWorldPosition(new THREE.Vector3());
            // Create information sign
            createInfoSign(node, infoPosition, "Information", getInfoContent(node.name));
          }
          
          // Find hub trigger objects
          if (node.name.includes('hub_trigger')) {
            console.log('Found hub trigger:', node.name);
            // Mark as hub trigger
            node.userData.isHubTrigger = true;
            // Enable shadows
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          }
          
          // Find main hub object
          if (node.name.includes('hub_main')) {
            console.log('Found main hub object:', node.name);
            hubObjects.main = node;
            // Enable shadows
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          }
          
          // Save reference to switch
          if (node.name === 'Switch') {
            console.log('Found switch:', node.name);
            switchObject = node;
            
            // Set up switch
            if (node.isMesh) {
              // Enable shadows
              node.castShadow = true;
              node.receiveShadow = true;
              
              // If switch is in night mode, make it glowing
              if (isNightMode) {
                makeSwichGlow(node);
              }
              
              // Add light from switch
              createSwitchLight(node.position.clone());
            }
          }
          
          if (node.name === 'Torch1' || node.name === 'Torch2') {
            console.log('Found torch:', node.name);
            
            // Add torch object to array
            torchMeshes.push(node);
            
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              
              // Create glowing effect for torch
              if (isNightMode) {
                makeTorchGlow(node);
              }
              
              // Create light source from torch
              createTorchLight(node.position.clone(), node.name);
            }
          }

          // Find mode icons
          if (node.name === 'TextMode1') {
            console.log('Found night mode icon:', node.name);
            textModeNight = node;
            // Set visibility based on current mode
            if (node.visible !== undefined) {
              node.visible = isNightMode;
            }
          }
          
          if (node.name === 'TextMode2') {
            console.log('Found day mode icon:', node.name);
            textModeDay = node;
            // Set visibility based on current mode
            if (node.visible !== undefined) {
              node.visible = !isNightMode;
            }
          }
          
          // Determine stairs by name
          if (node.isMesh && (node.name.includes('Stair') || 
                             node.name.includes('Stairs'))) {
            console.log('Found stairs:', node.name);
            stairObjects.push(node);
            
            // Mark object as stair in userData
            node.userData.isStair = true;
            
           
          }
        });
        
        // Add model to scene
        scene.add(gltf.scene);
        
        // Loop through all objects, save and modify materials
        gltf.scene.traverse((node) => {
          if (node.isMesh) {
            // Save original textures and materials
            if (node.material) {
              // Save original material in userData for possible restoration
              node.userData.originalMaterial = node.material.clone();
              
              // If this is portal frame (named "Portal" or containing this word)
              if (node.name.includes('Portal') && !node.name.includes('Light')) {
                console.log('Found portal frame:', node.name);
                
                // Create new material, but keep textures from original
                const newMaterial = new THREE.MeshStandardMaterial({ 
                  color: 0x222222,
                  side: THREE.DoubleSide,
                  roughness: 0.8,
                  metalness: 0.2
                });
                
                // Copy textures from original material if they exist
                if (node.material.map) newMaterial.map = node.material.map;
                if (node.material.normalMap) newMaterial.normalMap = node.material.normalMap;
                if (node.material.roughnessMap) newMaterial.roughnessMap = node.material.roughnessMap;
                if (node.material.metalnessMap) newMaterial.metalnessMap = node.material.metalnessMap;
                if (node.material.aoMap) newMaterial.aoMap = node.material.aoMap;
                
                // Apply new material
                node.material = newMaterial;
                
                // Set shadows for frame
                node.castShadow = true;
                
                // Create portal with information for this object
                const portalPosition = node.getWorldPosition(new THREE.Vector3());
                // Use index as identifier for portal information
                const portalIndex = portals.length;
                // Pass mesh as portal object, using name from array or default name
                const portalName = portalNames[portalIndex] || `Portal ${portalIndex + 1}`;
                createPortalInfo(node, portalPosition, portalName, getPortalContent(portalIndex));
              }
              
              // If this is glowing part of portal (named "PortalLight")
              else if (node.name.includes('PortalLight')) {
                console.log('Found glowing part of portal:', node.name);
                portalLight = node;
                
                // Save texture if it exists
                const originalTexture = node.material.map;
                
                // Create bright glowing material for Bloom effect
                const portalLightMaterial = new THREE.MeshBasicMaterial({ 
                  color: 0x4df3ff, // Bright cyan color
                  side: THREE.DoubleSide,
                  transparent: true,
                  opacity: 0.8
                });
                
                // Apply original texture if it exists
                if (originalTexture) {
                  portalLightMaterial.map = originalTexture;
                }
                
                // Apply new material
                node.material = portalLightMaterial;
                
                // For animation, save original material
                node.userData.glowMaterial = portalLightMaterial;
                
                // Enable layer for Bloom effect
                node.layers.enable(BLOOM_SCENE);
                
                // Add light source from portal
                addPortalLighting(node.getWorldPosition(new THREE.Vector3()));
              }
              
              // For floor use material with shadows, but keep textures and color
              else if (node.name.includes('Floor') || node.name.includes('floor') || 
                       node.name.includes('Ground') || node.name.includes('ground')) {
                console.log('Found floor:', node.name);
                
                // Save original color
                const originalColor = node.material.color ? node.material.color.clone() : new THREE.Color(0x00ff00); // Green by default, if no color
                
                // Save textures from original material
                const originalTextures = {
                  map: node.material.map,
                  normalMap: node.material.normalMap,
                  roughnessMap: node.material.roughnessMap,
                  metalnessMap: node.material.metalnessMap,
                  aoMap: node.material.aoMap
                };
                
                // Material for floor, which will accept shadows but with original color
                const floorMaterial = new THREE.MeshStandardMaterial({ 
                  color: originalColor, // Use original color from Blender
                  roughness: 0.9,
                  metalness: 0.1,
                  emissive: 0x000000 
                });
                
                // Apply saved textures
                for (const [key, texture] of Object.entries(originalTextures)) {
                  if (texture) floorMaterial[key] = texture;
                }
                
                // Apply new material
                node.material = floorMaterial;
                
                // Save original color for night mode
                node.userData.nightColor = originalColor.clone();
                // Create color for day mode in advance
                node.userData.dayColor = originalColor.clone().multiplyScalar(1.3); // Slightly brighter for day
                
                // Set shadow properties
                node.receiveShadow = true;
              }
              
              // Add all meshes (except floor, character, portals, and Plane objects) to array of collidable objects
              if (node.name !== 'Character' && 
                  !node.name.includes('PortalLight') && 
                  !(node.name.includes('Floor') || node.name.includes('floor') || 
                    node.name.includes('Ground') || node.name.includes('ground')) &&
                  !node.name.includes('Plane') && // Exclude all Plane objects
                  node.geometry && node.geometry.type !== 'PlaneGeometry' && // Exclude objects with plane geometry
                  node.geometry.type !== 'PlaneBufferGeometry') { 
                
                // Create collision object
                collisionObjects.push(node);
                
                // Add isCollidable property for filtering
                node.userData.isCollidable = true;
                
                console.log('Added collision object:', node.name);
              }
            }
          }
        });
        
        // After loading scene and setting up materials
        updateShadowCameraHelper();
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      },
      (error) => {
        console.error('Error loading model:', error);
        // If model couldn't be loaded, create basic world
        createBasicWorld();
      }
    );
}

// Function to add lighting from portal
function addPortalLighting(position) {
    // Create main light source from portal - point light
    portalSpotLight = new THREE.PointLight(0x4df3ff, 350, 20);
    portalSpotLight.position.copy(position);
    
    // Set up shadows for point light
    portalSpotLight.castShadow = true;
    portalSpotLight.shadow.mapSize.width = 1024;
    portalSpotLight.shadow.mapSize.height = 1024;
    portalSpotLight.shadow.camera.near = 0.5;
    portalSpotLight.shadow.camera.far = 20; // Уменьшаем радиус теней для соответствия настройкам камеры
    portalSpotLight.shadow.bias = -0.001;
    
    // Set up radius and blur for shadows (VSM specific)
    portalSpotLight.shadow.radius = 8;
    portalSpotLight.shadow.blurSamples = 12;
    
    scene.add(portalSpotLight);
    
    // Add additional point light with smaller radius for enhancing near glow
    portalPointLight = new THREE.PointLight(0x4df3ff, 3, 5);
    portalPointLight.position.copy(position);
    scene.add(portalPointLight);
    
    // Add very weak global ambient light for visibility in darkness
    const ambientLight = new THREE.AmbientLight(0x111111, 0.1);
    scene.add(ambientLight);
    
    // Create daytime lighting, but off by default
    createDayLighting();
    updateLightingMode();
}

// Function to create daytime lighting
function createDayLighting() {
    // Create directional light for simulating sunlight
    dayLight = {
        // Main directional light (sunset)
        directional: new THREE.DirectionalLight(0xff9a3c, 1.3), // Bright orange sunset light
        // Ambient lighting for filling shadows
        ambient: new THREE.AmbientLight(0xfffaf0, 0.3), // Very weak ambient lighting for contrast
        // Hemispherical lighting for more realistic sky/ground lighting
        hemisphere: new THREE.HemisphereLight(0xffd6aa, 0x586778, 0.2), // Minimal fill
        // Light with slight green tinge for simulating opposite side of sky
        fill: new THREE.DirectionalLight(0xb4c8dd, 0.15) // Weak green light
    };
    
    // Set up main directional light - sharply from side and low (like sunset)
    dayLight.directional.position.set(50, 15, 0); // Strong side light for long shadows
    dayLight.directional.castShadow = true;
    
    // Set up additional light from opposite side
    dayLight.fill.position.set(-30, 8, 0);
    dayLight.fill.castShadow = false; // Doesn't cast shadows
    
    // Оптимизируем настройки теней для соответствия новому frustum
    dayLight.directional.shadow.mapSize.width = 2048;
    dayLight.directional.shadow.mapSize.height = 2048;
    dayLight.directional.shadow.camera.near = 0.5;
    dayLight.directional.shadow.camera.far = 120; // Уменьшаем, чтобы не выходить за пределы frustum камеры
    
    // Very wide area for capturing long shadows
    const shadowSize = 50;
    dayLight.directional.shadow.camera.left = -shadowSize;
    dayLight.directional.shadow.camera.right = shadowSize;
    dayLight.directional.shadow.camera.top = shadowSize;
    dayLight.directional.shadow.camera.bottom = -shadowSize;
    
    // Sharp shadows for emphasized sunset effect
    dayLight.directional.shadow.radius = 1.5; // Sharper shadows
    dayLight.directional.shadow.bias = -0.0005;
    
    // Add light sources to scene, but off for night mode
    scene.add(dayLight.directional);
    scene.add(dayLight.ambient);
    scene.add(dayLight.hemisphere);
    scene.add(dayLight.fill);
    
    // Default to off for daytime (handled in updateLightingMode)
}

// Function to toggle between lighting modes
function toggleLightingMode() {
    isNightMode = !isNightMode;
    console.log(`Lighting mode: ${isNightMode ? "night" : "day"}`);
    
    // Update light sources
    updateLightingMode();
    
    // Update switch appearance
    updateSwitchAppearance();
    
    // Update visibility of mode icons
    updateModesVisibility();
}

// Function to update switch appearance
function updateSwitchAppearance() {
    if (!switchObject || !switchObject.isMesh) return;
    
    if (isNightMode) {
        // Make switch glow in night mode
        makeSwichGlow(switchObject);
        
        // Turn on switch light
        if (switchLight) {
            switchLight.visible = true;
            
            // Animate light pulse
            animateSwitchLight();
        }
    } else {
        // Return to original material in day mode
        if (switchObject.userData.originalMaterial) {
            // Use brighter material for day mode
            const dayMaterial = switchObject.userData.originalMaterial.clone();
            // Increase brightness for day mode
            if (dayMaterial.color) {
                dayMaterial.color.multiplyScalar(1.2);
            }
            switchObject.material = dayMaterial;
            
            // Disable layer for switch
            switchObject.layers.disable(BLOOM_SCENE);
        }
        
        // Turn off switch light
        if (switchLight) {
            switchLight.visible = false;
        }
    }
}

// Function to animate light pulse
function animateSwitchLight() {
    if (!switchLight) return;
    
    // Variable for tracking animation
    let animating = true;
    
    // Function to update light pulse
    function updateLightPulse() {
        if (!animating || !switchLight.visible) return;
        
        const time = Date.now() * 0.001;
        // More gradual and pronounced light pulse intensity
        switchLight.intensity = 15 + Math.sin(time * 1.5) * 8;
        
        // Continue animation
        requestAnimationFrame(updateLightPulse);
    }
    
    // Start animation
    updateLightPulse();
    
    // Stop animation when light is off
    switchLight.userData.stopAnimation = () => {
        animating = false;
    };
}

// Function to update light sources based on mode
function updateLightingMode() {
    if (!dayLight || !portalSpotLight) return;
    
    // Update light sources based on mode
    if (isNightMode) {
        // Night mode: turn on portal light, turn off daytime lighting
        portalSpotLight.intensity = 350;
        portalPointLight.intensity = 3;
        
        // Completely turn off daytime lighting
        dayLight.directional.intensity = 0;
        dayLight.ambient.intensity = 0.05; // Very weak ambient lighting to make objects visible as shadows
        dayLight.hemisphere.intensity = 0;
        dayLight.fill.intensity = 0;
        
        // Increase torch light intensity in night mode
        if (torchLights.length > 0) {
            torchLights.forEach(torch => {
                if (torch.mainLight) {
                    torch.mainLight.intensity = 3;
                    torch.mainLight.visible = true;
                }
                if (torch.ambientLight) {
                    torch.ambientLight.intensity = 0.8;
                    torch.ambientLight.visible = true;
                }
            });
        }
        
        // Set exposure for night mode
        renderer.toneMappingExposure = Math.pow(bloomParams.exposure, 4.0);
        
        // Black background for night
        scene.background = new THREE.Color(0x000000);
        
        // Restore night materials
        updateMaterialsForNightlight();
    } else {
        // Day mode (sunset): decrease portal light, turn on directional lighting for sunset
        portalSpotLight.intensity = 50;
        portalPointLight.intensity = 0.8;
        
        // Set lighting for sunset - bright from one side
        dayLight.directional.intensity = 1.3;
        dayLight.ambient.intensity = 0.3;
        dayLight.hemisphere.intensity = 0.2;
        dayLight.fill.intensity = 0.15;
        
        // Decrease torch light intensity in day mode
        if (torchLights.length > 0) {
            torchLights.forEach(torch => {
                if (torch.mainLight) {
                    torch.mainLight.intensity = 1; // Decrease intensity in day mode
                }
                if (torch.ambientLight) {
                    torch.ambientLight.intensity = 0.3;
                }
            });
        }
        
        // Set exposure for sunset mode
        renderer.toneMappingExposure = Math.pow(1.0, 4.0);
        
        // Background for sunset - gradient from dark blue to orange
        // (Three.js doesn't support gradients directly, so we use base color)
        scene.background = new THREE.Color(0x2a3c5a); // Dark blue sky at sunset
        
        // Update materials for sunset view
        updateMaterialsForSunset();
    }
}

// Function to set up materials for sunset
function updateMaterialsForSunset() {
    // Loop through all objects in scene and set them up for sunset lighting
    scene.traverse((object) => {
        if (object.isMesh && !object.layers.test(bloomLayer)) {
           // Don't touch glowing objects (portals)
            
            // Check if object has default material
            if (object.material && object.material.isMeshStandardMaterial) {
                // Set parameters for materials for better directional light rendering
                object.material.roughness = 0.7;
                
                // If object has saved night color, restore it
                // Minimize color change to allow light to create sunset effect
                if (object.userData.nightColor) {
                    // First restore original color
                    object.material.color.copy(object.userData.nightColor);
                    
                    // For objects in light path, add slight warm tone
                    // But do it very gently so main effect is from directional light
                    if (object.position.x > 0) { // Objects with positive X will be lit by sunset
                        const warmth = 0.15; // Very small change in color
                        object.material.color.lerp(new THREE.Color(0xffd6aa), warmth);
                    }
                }
            }
        }
    });
    
    // Don't use fog for clear directional light effect
    if (scene.fog) {
        scene.fog = null;
    }
}

// Function to set up materials for night lighting
function updateMaterialsForNightlight() {
    // Loop through all objects in scene and return night colors
    scene.traverse((object) => {
        if (object.isMesh && !object.layers.test(bloomLayer)) {
            // If object has saved night color, apply it
            if (object.userData.nightColor && object.material) {
                object.material.color.copy(object.userData.nightColor);
            }
        }
    });
}

// Function to display camera helper (useful for debugging)
function updateShadowCameraHelper() {
    if (portalSpotLight) {
        // Debugging helpers - uncomment if needed
        // const shadowHelper = new THREE.CameraHelper(portalSpotLight.shadow.camera);
        // scene.add(shadowHelper);
        // const lightHelper = new THREE.SpotLightHelper(portalSpotLight);
        // scene.add(lightHelper);
    }
    
    if (dayLight && dayLight.directional) {
        // Debugging helpers - uncomment if needed
        // const dirLightHelper = new THREE.DirectionalLightHelper(dayLight.directional, 10);
        // scene.add(dirLightHelper);
        // const dirShadowHelper = new THREE.CameraHelper(dayLight.directional.shadow.camera);
        // scene.add(dirShadowHelper);
    }
}

// Create basic world if model from Blender didn't load
function createBasicWorld() {
    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(50, 50);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x111111,
        roughness: 0.9,
        metalness: 0.1
    });
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true; // Floor accepts shadows
    scene.add(floor);
    
    // Create simple portal
    createBasicPortal();
}

// Create simple portal if model didn't load
function createBasicPortal() {
    // Group for portal
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, 1.5, -5);
    scene.add(portalGroup);
    
    // Outer portal frame
    const portalFrameGeometry = new THREE.TorusGeometry(1, 0.1, 16, 100);
    const portalFrameMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222, 
        side: THREE.DoubleSide,
        roughness: 0.5,
        metalness: 0.7
    });
    const portalFrameMesh = new THREE.Mesh(portalFrameGeometry, portalFrameMaterial);
    portalFrameMesh.castShadow = true;
    portalGroup.add(portalFrameMesh);
    
    // Glowing part of portal
    const portalLightGeometry = new THREE.CircleGeometry(0.9, 32);
    const portalLightMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x4df3ff, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });
    portalLight = new THREE.Mesh(portalLightGeometry, portalLightMaterial);
    portalLight.userData.glowMaterial = portalLightMaterial;
    portalLight.rotation.y = Math.PI;
    // Enable layer for Bloom effect
    portalLight.layers.enable(BLOOM_SCENE);
    portalGroup.add(portalLight);
    
    // Base for portal
    const baseGeometry = new THREE.BoxGeometry(2, 0.1, 0.5);
    const baseMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222,
        roughness: 0.5,
        metalness: 0.7
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = -1.05;
    base.castShadow = true;
    portalGroup.add(base);
    
    // Pillar of portal
    const pillarGeometry = new THREE.BoxGeometry(0.1, 2, 0.1);
    const pillarMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        roughness: 0.5,
        metalness: 0.7
    });
    
    const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    leftPillar.position.set(-1, -0.05, 0);
    leftPillar.castShadow = true;
    portalGroup.add(leftPillar);
    
    const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    rightPillar.position.set(1, -0.05, 0);
    rightPillar.castShadow = true;
    portalGroup.add(rightPillar);
    
    // Add lighting from portal
    addPortalLighting(portalGroup.position);
    
    // Add several objects around portal for shadow demonstration
    addSurroundingObjects(portalGroup.position);
}

// Adding objects around portal for shadow demonstration
function addSurroundingObjects(portalPosition) {
    // Create several pillars around portal
    const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3, 16);
    const pillarMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.7,
        metalness: 0.3
    });
    
    // Positions for pillars (radially around portal)
    const positions = [
        new THREE.Vector3(3, 0, -2),
        new THREE.Vector3(-3, 0, -2),
        new THREE.Vector3(0, 0, -8),
        new THREE.Vector3(5, 0, -5),
        new THREE.Vector3(-5, 0, -5)
    ];
    
    // Create pillars
    positions.forEach(pos => {
        const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        // Используем _tempVector для предотвращения создания нового объекта
        _tempVector.set(
            portalPosition.x + pos.x,
            1.5,
            portalPosition.z + pos.z
        );
        pillar.position.copy(_tempVector);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        scene.add(pillar);
    });
    
    // Add several cubes of different sizes
    const boxGeometry1 = new THREE.BoxGeometry(1, 1, 1);
    const boxGeometry2 = new THREE.BoxGeometry(1.5, 0.5, 1.5);
    const boxMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.6,
        metalness: 0.4
    });
    
    const box1 = new THREE.Mesh(boxGeometry1, boxMaterial);
    _tempVector.set(portalPosition.x + 2, 0.5, portalPosition.z + 3);
    box1.position.copy(_tempVector);
    box1.castShadow = true;
    box1.receiveShadow = true;
    scene.add(box1);
    
    const box2 = new THREE.Mesh(boxGeometry2, boxMaterial);
    _tempVector.set(portalPosition.x - 2, 0.25, portalPosition.z + 3);
    box2.position.copy(_tempVector);
    box2.castShadow = true;
    box2.receiveShadow = true;
    scene.add(box2);
}

// Load character
function loadCharacter() {
    console.log('Loading crab model...');
    
    // Get position for character (save for later use)
    _tempVector.set(0, characterHeight / 2, 0);
    const characterStartPosition = _tempVector.clone();
    
    // Use GLTFLoader to load model
    const loader = new GLTFLoader();
    
    // Temporarily create invisible cube-placeholder while model loads
    const tempGeometry = new THREE.BoxGeometry(characterSize, characterHeight, characterSize);
    const tempMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x3333ff,
        transparent: true,
        opacity: 0
    });
    character = new THREE.Mesh(tempGeometry, tempMaterial);
    character.position.copy(characterStartPosition);
    scene.add(character);
    
    // Find crab in main scene
    let crabFound = false;
    
    // If crab not found in scene, load separate model
    if (!crabFound) {
        loader.load(
            'crab.glb', // Path to model file
            (gltf) => {
                console.log('Loaded crab model:', gltf);
                
                // Remove temporary character
                scene.remove(character);
                
                // Create container for model (easier to control position)
                character = new THREE.Group();
                
                // Set position for group container
                character.position.copy(characterStartPosition);
                
                // Get crab model
                const crabModel = gltf.scene;
                
                // Scale model if needed
                crabModel.scale.set(0.5, 0.5, 0.5);
                
                // Rotate model 180 degrees on Y axis, so it looks in the correct direction
                crabModel.rotation.y = Math.PI;
                
                // Center model in container space
                // To do this, we'll create a temporary box to get model dimensions
                _tempBox.setFromObject(crabModel);
                _tempVector.set(0, 0, 0); // Reuse temp vector
                _tempBox.getCenter(_tempVector);
                
                // Move model so its center is in the center of the container
                crabModel.position.sub(_tempVector);
                
                // Raise model so it stands on the ground
                crabModel.position.y = -_tempBox.min.y + (characterHeight / 4);
                
                // Enable shadows
                crabModel.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });
                
                // Add model to container
                character.add(crabModel);
                
                // Add container to scene
                scene.add(character);
                
                // Update bounding box
                characterBoundingBox = new THREE.Box3().setFromObject(character);
                
                console.log('Crab model loaded and set as character, position:', character.position);
                console.log('Crab center:', _tempVector);
                
                // Update camera position
                updateCameraPosition();
            },
            (xhr) => {
                console.log('Loading model: ' + (xhr.loaded / xhr.total * 100) + '%');
            },
            (error) => {
                console.error('Error loading crab model:', error);
                
                // In case of error, use simple cube instead
                console.log('Using simple cube instead of crab');
                
                // Create simple character (as it was originally)
                const geometry = new THREE.BoxGeometry(characterSize, characterHeight, characterSize);
                const material = new THREE.MeshStandardMaterial({ 
                    color: 0xCC5500, // Orange color for crab
                    roughness: 0.7,
                    metalness: 0.3
                });
                character = new THREE.Mesh(geometry, material);
                character.position.copy(characterStartPosition);
                character.castShadow = true;
                scene.add(character);
                
                // Update bounding box
                characterBoundingBox = new THREE.Box3().setFromObject(character);
            }
        );
    }
}

// Character collision handling
function onClick(event) {
    // Normalize mouse coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Set raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Check for intersection with objects
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Check if we clicked on the switch
    for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object;
        
        // If this is switch light
        if (object.name === 'Switch' || object.parent && object.parent.name === 'Switch') {
            if (!isSwitchAnimating) {
                // Animate switch and change lighting mode
                animateLightSwitch();
            }
            return;
        }
        
        // If this is portal
        if (object.userData && object.userData.isPortal) {
            const portalId = object.userData.portalId;
            portals[portalId].activate();
            return;
        }
    }
}

// Function to animate switch light
function animateLightSwitch() {
    if (!switchObject || isSwitchAnimating) return;
    
    isSwitchAnimating = true;
    
    // Initial and final positions of switch
    const startPosition = switchObject.position.clone();
    const endPosition = switchObject.position.clone();
    
    // Move right or left based on current mode
    endPosition.x += isNightMode ? 1.6 : -1.6;
    
    // Create animation
    const duration = 500; // Animation duration in ms
    const startTime = Date.now();
    
    // Function to update switch position
    function updateSwitchPosition() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Smooth transition using easing function
        const easedProgress = easeInOutCubic(progress);
        
        // Update switch position
        switchObject.position.lerpVectors(startPosition, endPosition, easedProgress);
        
        // If we have light from switch, update its position
        if (switchLight) {
            switchLight.position.copy(switchObject.position);
            // Add slight upward offset
            switchLight.position.y += 0.2;
        }
        
        if (progress < 1) {
            // Continue animation
            requestAnimationFrame(updateSwitchPosition);
        } else {
            // Animation completed, switch lighting mode
            toggleLightingMode();
            isSwitchAnimating = false;
        }
    }
    
    // Start animation
    updateSwitchPosition();
}

// Handle window resize
function onWindowResize() {
    // Update camera aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    // Resize renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update post-processing composers
    if (bloomComposer) {
        bloomComposer.setSize(window.innerWidth, window.innerHeight);
    }
    if (finalComposer) {
        finalComposer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Function to darken objects that shouldn't glow
function darkenNonBloomed(obj) {
    if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
        materials[obj.uuid] = obj.material;
        obj.material = darkMaterial;
    }
}

// Function to restore original materials
function restoreMaterial(obj) {
    if (materials[obj.uuid]) {
        obj.material = materials[obj.uuid];
        delete materials[obj.uuid];
    }
}

// Update character position based on WASD
function updateCharacterMovement() {
    if (!character) return;
    
    // Reuse vector for movement direction
    const moveVector = new THREE.Vector3(0, 0, 0);
    
    // Determine movement vector based on pressed keys
    if (keys.w) moveVector.z = -1;
    if (keys.s) moveVector.z = 1;
    if (keys.a) moveVector.x = -1;
    if (keys.d) moveVector.x = 1;
    
    // If there's movement
    if (moveVector.length() > 0) {
        // Normalize vector for consistent speed
        moveVector.normalize();
        
        // Multiply by movement speed
        moveVector.multiplyScalar(moveSpeed);
        
        // Save old position
        const oldPosition = character.position.clone();
        
        // Calculate new position
        const newPosition = oldPosition.clone().add(moveVector);
        
        // Check world boundaries
        newPosition.x = Math.max(movementBounds.minX, Math.min(movementBounds.maxX, newPosition.x));
        newPosition.z = Math.max(movementBounds.minZ, Math.min(movementBounds.maxZ, newPosition.z));
        
        // Check if character is on stairs or moving towards them
        const stairInfo = checkStairCollision(newPosition);
        
        // If character is on stairs, adjust their position on Y axis
        if (stairInfo.onStair) {
            // Determine new character height
            newPosition.y = stairInfo.height;
        }
        
        // Check for collisions
        if (checkCollisions(oldPosition, newPosition)) {
            // Try sliding along obstacle
            const slideOptions = [
                // Try moving only on X
                new THREE.Vector3(moveVector.x, 0, 0),
                // Try moving only on Z
                new THREE.Vector3(0, 0, moveVector.z)
            ];
            
            let slidingSuccessful = false;
            
            // Loop through sliding options
            for (let slideVector of slideOptions) {
                if (slideVector.length() === 0) continue; // Skip zero vector
                
                // Normalize and multiply by speed
                slideVector.normalize().multiplyScalar(moveSpeed);
                
                // Calculate new position while sliding
                const slidePosition = oldPosition.clone().add(slideVector);
                
                // Check world boundaries
                slidePosition.x = Math.max(movementBounds.minX, Math.min(movementBounds.maxX, slidePosition.x));
                slidePosition.z = Math.max(movementBounds.minZ, Math.min(movementBounds.maxZ, slidePosition.z));
                
                // Check if character is on stairs while sliding
                const slideStairInfo = checkStairCollision(slidePosition);
                if (slideStairInfo.onStair) {
                    slidePosition.y = slideStairInfo.height;
                }
                
                // Check for collisions while sliding
                if (!checkCollisions(oldPosition, slidePosition)) {
                    // Update character position with sliding
                    character.position.copy(slidePosition);
                    slidingSuccessful = true;
                    break;
                }
            }
            
            // If sliding failed, stay in old position
            if (!slidingSuccessful) {
                character.position.copy(oldPosition);
            }
        } else {
            // If no collisions, update position
            character.position.copy(newPosition);
        }
        
        // Rotate character towards movement direction
        if (moveVector.x !== 0 || moveVector.z !== 0) {
            const targetRotation = Math.atan2(moveVector.x, moveVector.z);
            const rotationSpeed = 0.15; // Rotation speed
            
            // Smooth rotation towards target angle
            let currentRotation = character.rotation.y;
            
            // Calculate shortest path to rotation
            let rotationDiff = targetRotation - currentRotation;
            if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
            if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
            
            // Apply partial rotation
            character.rotation.y += rotationDiff * rotationSpeed;
        }
        
        // Check proximity to portals
        checkPortalsProximity();
        
        // Play walking sound
        if (!walkSound.isPlaying) {
            walkSound.play();
        }
    } else {
        // Stop walking sound if character isn't moving
        if (walkSound.isPlaying) {
            walkSound.stop();
        }
    }
}

// Function to check for collisions
function checkCollisions(oldPosition, newPosition) {
    // Update bounding box of character with new position
    const tempCharacter = character.clone();
    tempCharacter.position.copy(newPosition);
    const tempBox = new THREE.Box3().setFromObject(tempCharacter);
    
    // Calculate movement vector and its length
    const moveDirection = newPosition.clone().sub(oldPosition).normalize();
    
    // Character radius for collision detection
    const collisionRadius = characterSize * 0.6;
    
    // Adjust raycaster settings
    collisionRaycaster.far = collisionRadius * 1.2; // Slightly larger than radius for buffer
    
    // Directions for rays (8 directions around circle)
    const directions = [
        new THREE.Vector3(1, 0, 0),   // right
        new THREE.Vector3(-1, 0, 0),  // left
        new THREE.Vector3(0, 0, 1),   // forward
        new THREE.Vector3(0, 0, -1),  // backward
        new THREE.Vector3(1, 0, 1).normalize(),   // right-forward
        new THREE.Vector3(-1, 0, 1).normalize(),  // left-forward
        new THREE.Vector3(1, 0, -1).normalize(),  // right-backward
        new THREE.Vector3(-1, 0, -1).normalize()  // left-backward
    ];
    
    // Add movement vector to list of directions to check for more accurate detection
    if (moveDirection.length() > 0) {
        directions.push(moveDirection);
    }
    
    // Create starting points for rays at different heights of character for better coverage
    const rayOrigins = [
        new THREE.Vector3(newPosition.x, characterHeight * 0.2, newPosition.z), // Legs
        new THREE.Vector3(newPosition.x, characterHeight * 0.5, newPosition.z), // Midpoint
        new THREE.Vector3(newPosition.x, characterHeight * 0.8, newPosition.z)  // Top
    ];
    
    // Check for collisions using rays from multiple points of character
    for (let origin of rayOrigins) {
        for (let direction of directions) {
            collisionRaycaster.set(origin, direction);
            const intersects = collisionRaycaster.intersectObjects(collisionObjects, true);
            
            // If ray intersects with any object closer than character radius
            if (intersects.length > 0 && intersects[0].distance < collisionRadius) {
                console.log(`Collision detected: object ${intersects[0].object.name}, distance ${intersects[0].distance}`);
                return true; // Collision exists
            }
        }
    }
    
    // Check for intersection with bounding boxes of nearby objects
    // for optimization purposes
    for (let obj of collisionObjects) {
        // Skip objects far away
        if (newPosition.distanceTo(obj.position) > characterHeight + 2) continue;
        
        // Get bounding box of object
        const objBox = new THREE.Box3().setFromObject(obj);
        
        // Check for intersection
        if (tempBox.intersectsBox(objBox)) {
            console.log(`Collision with box detected: object ${obj.name}`);
            return true; // Collision exists
        }
    }
    
    return false; // No collisions
}

// Function to check if character is on stairs
function checkStairCollision(position) {
    let result = {
        onStair: false,
        height: character.position.y
    };
    
    // If there are no stairs or character, return default result
    if (!character || stairObjects.length === 0) {
        return result;
    }
    
    console.log("Checking stairs. Number of stairs:", stairObjects.length);
    for (let stair of stairObjects) {
        console.log("Stair name:", stair.name, "Position:", stair.position.x, stair.position.y, stair.position.z);
    }
    
    // Create several points for checking (under different parts of character)
    const checkPoints = [
        new THREE.Vector3(position.x, position.y + characterHeight * 0.1, position.z), // center
        new THREE.Vector3(position.x + characterSize * 0.3, position.y + characterHeight * 0.1, position.z + characterSize * 0.3), // right front corner
        new THREE.Vector3(position.x - characterSize * 0.3, position.y + characterHeight * 0.1, position.z + characterSize * 0.3), // left front corner
        new THREE.Vector3(position.x + characterSize * 0.3, position.y + characterHeight * 0.1, position.z - characterSize * 0.3), // right back corner
        new THREE.Vector3(position.x - characterSize * 0.3, position.y + characterHeight * 0.1, position.z - characterSize * 0.3), // left back corner
    ];
    
    const rayDirection = new THREE.Vector3(0, -1, 0);
    
    // Maximum distance for checking stairs (increase for tall stairs)
    const maxDistance = characterHeight * 5;
    
    // Check all points
    for (let i = 0; i < checkPoints.length; i++) {
        const rayStart = checkPoints[i];
        
        // Create ray from current point downwards
        const rayDown = new THREE.Raycaster(rayStart, rayDirection, 0, maxDistance);
        
        console.log(`Ray ${i} starts at:`, rayStart.x, rayStart.y, rayStart.z);
        
        // Check for intersection only with stair objects
        const intersects = rayDown.intersectObjects(stairObjects, true);
        
        if (intersects.length > 0) {
            // Found stairs under character
            const stairHit = intersects[0];
            
            console.log(`Ray ${i} hit stairs:`, stairHit.object.name, 'distance:', stairHit.distance, 'point:', stairHit.point.x, stairHit.point.y, stairHit.point.z);
            
            // Height of stairs at intersection point
            const stairHeightAtPoint = stairHit.point.y;
            
            // Current height of character (bottom of his body)
            const characterBase = character.position.y - characterHeight / 2;
            
            // Determine if we need to climb or descend
            const heightDifference = stairHeightAtPoint - characterBase;
            
            console.log('Current character height (base):', characterBase);
            console.log('Stair height at intersection:', stairHeightAtPoint);
            console.log('Height difference:', heightDifference);
            
            // Check if height difference is too large
            // Increase maximum allowable height difference
            if (Math.abs(heightDifference) < characterHeight * 2.0) {
                // For steeper stairs, increase climbing speed
                const adjustedSpeed = Math.max(stairClimbSpeed, Math.abs(heightDifference) * 0.3);
                
                // Gradually change character height to stair height
                const newHeight = characterBase + Math.sign(heightDifference) * Math.min(Math.abs(heightDifference), adjustedSpeed);
                
                console.log('New base height of character:', newHeight);
                
                result.onStair = true;
                // Set character's center position to desired height
                result.height = newHeight + characterHeight / 2;
                
                console.log('Total character height (center):', result.height);
                
                // If we found stairs, stop checking other points
                return result;
            } else {
                console.log('Height difference too large, skipping adjustment.');
            }
        } else {
            console.log(`Ray ${i} didn't find stairs`);
        }
    }
    
    console.log('Stairs not found under character');
    return result;
}

// Portal animation
function updatePortalEffect() {
    if (portalLight) {
        // Get current time
        const time = Date.now() * 0.001;
        
        // Gradual color change
        const hue = (time * 0.05) % 1;
        const color = new THREE.Color().setHSL(hue, 0.7, 0.6);
        portalLight.material.color = color;
        
        // Pulse transparency
        portalLight.material.opacity = 0.5 + Math.sin(time * 2) * 0.15;
        
        // Update color of light from portal
        if (portalSpotLight) {
            portalSpotLight.color = color;
            
            // Pulse intensity of light based on mode
            if (isNightMode) {
                portalSpotLight.intensity = 300 + Math.sin(time * 2) * 100;
            } else {
                portalSpotLight.intensity = 80 + Math.sin(time * 2) * 40;
            }
            
            // Slightly move light up and down for flickering effect
            portalSpotLight.position.y = portalLight.getWorldPosition(new THREE.Vector3()).y + Math.sin(time * 4) * 0.1;
        }
        
        if (portalPointLight) {
            portalPointLight.color = color;
            
            // Pulse intensity of secondary light based on mode
            if (isNightMode) {
                portalPointLight.intensity = 3 + Math.sin(time * 3) * 1.5;
            } else {
                portalPointLight.intensity = 1 + Math.sin(time * 3) * 0.5;
            }
            
            // Random small offset for more lively effect
            const noiseOffset = 0.03;
            portalPointLight.position.x += (Math.random() - 0.5) * noiseOffset;
            portalPointLight.position.y += (Math.random() - 0.5) * noiseOffset;
            portalPointLight.position.z += (Math.random() - 0.5) * noiseOffset;
        }
    }
}

// Animation function
function animate() {
    requestAnimationFrame(animate);
    
    // Update camera control (if not viewing wanted board)
    if (controls && !isViewingWantedBoard) controls.update();
    
    // Update character movement (only if not viewing wanted board)
    if (!isViewingWantedBoard) {
        updateCharacterMovement();
    }
    
    // Update portal effect
    updatePortalEffect();
    
    // Update camera position relative to character (only if not viewing wanted board)
    if (!isViewingWantedBoard) {
        updateCameraPosition();
    }
    
    // Check proximity to portals and hub (only if not viewing wanted board)
    if (!isViewingWantedBoard) {
        checkPortalsProximity();
        checkInfoSignsProximity();
        checkHubProximity();
    }
    
    // Render selective Bloom effect (optimized)
    renderBloom();
    
    // Final rendering
    finalComposer.render();
}

// Render with Bloom effect
function renderBloom() {
    // First, render only objects that should glow
    scene.traverse(darkenNonBloomed);
    bloomComposer.render();
    scene.traverse(restoreMaterial);
}

// Function to create portal information
function createPortalInfo(mesh, position, title, content) {
    const portal = {
        mesh: mesh,
        position: position,
        title: title,
        content: content,
        active: false
    };
    
    // Mark mesh as portal and attach index in portals array
    mesh.userData.isPortal = true;
    mesh.userData.portalId = portals.length;
    
    // Add portal to array
    portals.push(portal);
}

// Function to get portal content based on index
function getPortalContent(index) {
    // Create block with unique image for each portal
    const getImageBlock = (portalIndex) => {
        // Use different images for each portal
        const imageName = `portal${portalIndex + 1}.png`;
        return `
            <div style="text-align: center; margin-bottom: 15px;">
                <img src="imgs/${imageName}" alt="Portal Image ${portalIndex + 1}" style="max-width: 200px; border-radius: 10px; border: 2px solid #ff80bf; box-shadow: 0 0 10px #ff80bf;">
            </div>
        `;
    };
    
    const contents = [
        `
         <p>The starting role!</p>
         <p>Access to verified channels and events. Can be given out by L2 role holders.</p>`,
        
        `${getImageBlock(1)}
         <p>Given to genuine members who show interest and passionate towards Succinct.</p>
         <p>Everyone in PROVED UR LUV is someone we know will come back everyday and make this community stronger. Members of this role are all selfless individuals who are willing to help Succinct grow in anyway possible.</p>`,
        
        `${getImageBlock(2)}
         <p> Given to those who create high-quality artworks and creative works for Succinct and its community.</p>`,
        
        `${getImageBlock(3)}
         <p>Given to those who have consistently proved their love for Succinct via participation, activeness, helpfulness, supporting the team's and community contributor posts on X, and are recognized community figures of our community. </p>`,   

        `${getImageBlock(4)}
         <p> Developers who build applications for Succinct or use SP1 and help developers in the community.</p>`,

        `${getImageBlock(5)}
         <p> Awarded to select Prover members who consistently uphold top-quality contributions and discussions.</p>`
    ];
    
    // If content doesn't exist for given index, return default with image
    return contents[index % contents.length] || 
        `${getImageBlock(index)}
         <p>Information portal #${index + 1}</p>
         <p>Explore the world and find other portals for additional information.</p>`;
}

// Function to toggle information display for portal
function togglePortalInfo(portal) {
    if (portal.active) {
        // If portal is already active, close information panel
        closeInfoPanel();
        portal.active = false;
        activePortal = null;
    } else {
        // Otherwise, open information panel
        showInfoPanel(portal);
        portal.active = true;
    }
}

// Function to display information panel
function showInfoPanel(item) {
    // Close previous panel if it's open
    if (infoPanel) {
        closeInfoPanel();
    }
    

    try {
        if (portalSound && !portalSound.isPlaying) {
            portalSound.play();
        }
    } catch (e) {
        console.error('Error playing portal sound:', e);
    }
    

    infoPanel = document.createElement('div');
    infoPanel.className = 'info-panel';
    
    infoPanel.innerHTML = `
        <div class="info-header">
            <h2>${item.title}</h2>
            <button class="close-btn">×</button>
        </div>
        <div class="info-content">${item.content}</div>
    `;
    

    document.body.appendChild(infoPanel);
    

    const closeBtn = infoPanel.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        closeInfoPanel();
        item.active = false;

        if (item.mesh.userData.isPortal) {
            activePortal = null;
        } else if (item.mesh.userData.isInfoSign) {
            activeInfoSign = null;
        }
    });
}


function closeInfoPanel() {
    if (infoPanel && infoPanel.parentNode) {
        infoPanel.parentNode.removeChild(infoPanel);
        infoPanel = null;
    }
}


function showPortalHint() {

    let hint = document.querySelector('.portal-hint');
    

    if (!hint) {
        hint = document.createElement('div');
        hint.className = 'portal-hint';
        hint.textContent = 'Press E to interact with portal';
        document.body.appendChild(hint);
    }
}


function hidePortalHint() {
    const hint = document.querySelector('.portal-hint');
    if (hint) {
        hint.parentNode.removeChild(hint);
    }
}

function checkPortalsProximity() {
    if (!character) return;
    
    let nearPortal = null;
    let minDistance = 3; 
    

    for (const portal of portals) {
        if (portal.mesh && portal.position) {
            const distance = character.position.distanceTo(
                new THREE.Vector3(
                    portal.position.x,
                    character.position.y,
                    portal.position.z
                )
            );
            

            if (distance < minDistance) {
                nearPortal = portal;
                minDistance = distance;
            }
        }
    }
    

    if (nearPortal !== activePortal) {
        if (nearPortal) {

            showPortalHint();
            activePortal = nearPortal;
        } else {

            hidePortalHint();
            activePortal = null;
        }
    }
}

function addInfoPanelStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .info-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 500px;
            max-width: 80%;
            background-color: rgba(0, 0, 0, 0.8);
            border: 2px solid #ff80bf;
            border-radius: 10px;
            padding: 20px;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 1000;
            box-shadow: 0 0 20px #ff80bf;
            backdrop-filter: blur(5px);
        }
        .info-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid #ff80bf;
            padding-bottom: 10px;
        }
        .info-header h2 {
            margin: 0;
            color: #ff80bf;
            font-size: 24px;
        }
        .close-btn {
            background: none;
            border: none;
            color: #ff80bf;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .close-btn:hover {
            color: white;
        }
        .info-content {
            line-height: 1.6;
            font-size: 16px;
        }
        .portal-hint {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(235, 6, 166, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            z-index: 1000;
            border: 1px solid #ff80bf;
        }
        .hub-hint {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(235, 6, 166, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            z-index: 1000;
            border: 1px solid #ff80bf;
        }
        .info-hint {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(235, 6, 166, 0.7);
            color: #ff99cc;
            padding: 10px 20px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            z-index: 1000;
            border: 1px solid #ff99cc;
            box-shadow: 0 0 10px rgba(255, 153, 204, 0.5);
        }
        .wanted-hint {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(139, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            z-index: 1000;
            border: 1px solid #ff66b2;
            box-shadow: 0 0 10px rgba(255, 102, 178, 0.7);
        }
        .wanted-view-hint {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.7);
            color: #ff66b2;
            padding: 10px 20px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            z-index: 1000;
            border: 1px solid #ff66b2;
            box-shadow: 0 0 10px rgba(255, 102, 178, 0.5);
        }
        .info-view-hint {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.7);
            color: #ff99cc;
            padding: 10px 20px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            z-index: 1000;
            border: 1px solid #ff99cc;
            box-shadow: 0 0 10px rgba(255, 153, 204, 0.5);
        }
        .camera-lock-message {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 1000;
            border: 1px solid #ff80bf;
            opacity: 0;
            transition: opacity 0.5s ease;
        }
        .camera-lock-message.visible {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);
}




function createTorchLight(position, torchName) {
 
    const torchLight = new THREE.PointLight(0xffcc44, 3, 15);
    torchLight.position.copy(position);
    torchLight.position.y += 0.3;
    

    torchLight.castShadow = true;
    torchLight.shadow.mapSize.width = 512;
    torchLight.shadow.mapSize.height = 512;
    torchLight.shadow.camera.near = 0.5;
    torchLight.shadow.camera.far = 15;
    torchLight.shadow.bias = -0.0005;
    torchLight.shadow.radius = 4; 
    

    scene.add(torchLight);
    
 
    const ambientTorchLight = new THREE.PointLight(0xffbb33, 0.8, 3);
    ambientTorchLight.position.copy(position);
    scene.add(ambientTorchLight);
    

    torchLight.userData.ambientLight = ambientTorchLight;
    

    torchLight.userData.torchName = torchName;
    
    const flickerIntensity = { min: 2.5, max: 3.5 }; 
    const flickerAmbientIntensity = { min: 0.6, max: 1.0 }; 
  
    const seed = torchName ? torchName.charCodeAt(torchName.length - 1) : Math.random() * 10;
    
    function animateFlicker() {
        if (!torchLight.visible) return;
        
        const time = Date.now() * 0.001; 
        
        
        torchLight.intensity = flickerIntensity.min + 
            (Math.sin(time * 3 + seed) * 0.5 + 0.5) * (flickerIntensity.max - flickerIntensity.min);
        
        ambientTorchLight.intensity = flickerAmbientIntensity.min + 
            (Math.sin(time * 2.5 + seed + 1) * 0.5 + 0.5) * (flickerAmbientIntensity.max - flickerAmbientIntensity.min);
        
    
        const posOffset = 0.02;
        torchLight.position.x = position.x + Math.sin(time * 7 + seed) * posOffset;
        torchLight.position.y = position.y + 0.3 + Math.cos(time * 5 + seed) * posOffset;
        torchLight.position.z = position.z + Math.sin(time * 3 + seed) * posOffset;
        
        requestAnimationFrame(animateFlicker);
    }
    
 
    animateFlicker();
    

    if (!isNightMode) {
        torchLight.intensity *= 0.3;
        ambientTorchLight.intensity *= 0.3;
    }
    

    torchLights.push({
        mainLight: torchLight,
        ambientLight: ambientTorchLight,
        name: torchName,
        position: position.clone()
    });
    
    return torchLight;
}


function makeTorchGlow(torchMesh) {

    if (torchMesh.material) {
 
        const originalMap = torchMesh.material.map;
        
  
        const glowMaterial = new THREE.MeshStandardMaterial({
            color: 0xffcc00, 
            emissive: 0xff7700,
            emissiveIntensity: 1.5, 
            metalness: 0.0,
            roughness: 0.4
        });
        
       
        if (originalMap) {
            glowMaterial.map = originalMap;
        }
        
        
        torchMesh.userData.originalMaterial = torchMesh.material.clone();
        
    
        torchMesh.material = glowMaterial;
        
 
        torchMesh.layers.enable(BLOOM_SCENE);
    }
}



function createSwitchLight(position) {

    switchLight = new THREE.PointLight(0xffffff, 15, 10);
    switchLight.position.copy(position);
    switchLight.position.y += 0.2; 
    

    switchLight.castShadow = true;
    switchLight.shadow.mapSize.width = 512;
    switchLight.shadow.mapSize.height = 512;
    switchLight.shadow.camera.near = 0.5;
    switchLight.shadow.camera.far = 10;
    

    scene.add(switchLight);
    

    if (!isNightMode) {
        switchLight.visible = false;
    }
}

function makeSwichGlow(switchMesh) {
    if (switchMesh.material) {

        const originalMap = switchMesh.material.map;
        

        const glowMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 2.0, 
            metalness: 0.1,
            roughness: 0.1
        });
        

        if (originalMap) {
            glowMaterial.map = originalMap;
        }
            

        switchMesh.userData.originalMaterial = switchMesh.material.clone();
        
        switchMesh.material = glowMaterial;
        
        switchMesh.layers.enable(BLOOM_SCENE);
    }
}


function updateModesVisibility() {

    if (textModeNight && textModeNight.visible !== undefined) {
        textModeNight.visible = isNightMode;
        
        if (isNightMode) {
        
            if (textModeNight.isMesh && textModeNight.material) {

                if (!textModeNight.userData.originalMaterial) {
                    textModeNight.userData.originalMaterial = textModeNight.material.clone();
                }
                
                const glowMaterial = new THREE.MeshStandardMaterial({
                    color: 0xa8c6ff,
                    emissive: 0x3b5fd9,
                    emissiveIntensity: 1.2,
                    metalness: 0.3,
                    roughness: 0.2
                });
                

                textModeNight.material = glowMaterial;
                

                textModeNight.layers.enable(BLOOM_SCENE);
            }
        }
    }
    
    if (textModeDay && textModeDay.visible !== undefined) {
        textModeDay.visible = !isNightMode;
        
        if (!isNightMode) {
    
            if (textModeDay.isMesh && textModeDay.material) {
                if (!textModeDay.userData.originalMaterial) {
                    textModeDay.userData.originalMaterial = textModeDay.material.clone();
                }
                
             
                const sunnyMaterial = new THREE.MeshStandardMaterial({
                    color: 0xffd700, 
                    emissive: 0xff7700, 
                    emissiveIntensity: 0.6,
                    metalness: 0.8,
                    roughness: 0.1
                });
                

                textModeDay.material = sunnyMaterial;
            }
        }
    }
}

function setupCameraControls() {

    window.addEventListener('wheel', onMouseWheel);
    

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
}


function onMouseWheel(event) {

    if (isViewingWantedBoard) {
        return;
    }

    const zoomDelta = Math.sign(event.deltaY) * 2;
    
    currentCameraDistance = Math.max(
        cameraMinDistance,
        Math.min(cameraMaxDistance, currentCameraDistance + zoomDelta)
    );
    

    updateCameraPosition();
}


function onMouseDown(event) {

    if (isViewingWantedBoard) {
        return;
    }
    
    if (event.button === 0) { 
        isDragging = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    }
}


function onMouseMove(event) {
    // Если пользователь зажал кнопку мыши, обрабатываем движение камеры
    if (isDragging) {
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;
        
        updateCameraOffset(deltaX, deltaY);
        
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        return;
    }
    
    // Если мышь не зажата, обрабатываем hover эффект
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Reset hover effect for all wanted objects
    wantedObjects.forEach(obj => {
        if (obj.mesh && obj.mesh.material) {
            obj.mesh.material.emissiveIntensity = 0;
            obj.mesh.material.emissive.setHex(0x000000);
            obj.mesh.layers.disable(BLOOM_SCENE);
        }
    });
    
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Check if we're hovering over a wanted object
    for (let i = 0; i < intersects.length; i++) {
        const intersect = intersects[i];
        if (intersect.object.userData && intersect.object.userData.isWantedObject) {
            const wantedId = intersect.object.userData.wantedId;
            if (wantedObjects[wantedId] && wantedObjects[wantedId].mesh && wantedObjects[wantedId].mesh.material) {
                wantedObjects[wantedId].mesh.material.emissive.setHex(0xff80bf);
                wantedObjects[wantedId].mesh.material.emissiveIntensity = 1.0;
                wantedObjects[wantedId].mesh.layers.enable(BLOOM_SCENE);
                break;
            }
        }
    }
}

// Mouse click handler
function onMouseClick(event) {
    // Если пользователь зажал кнопку мыши, не обрабатываем клик
    if (isDragging) return;
    
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Check if we clicked on a wanted object
    for (let i = 0; i < intersects.length; i++) {
        const intersect = intersects[i];
        if (intersect.object.userData && intersect.object.userData.isWantedObject) {
            const wantedId = intersect.object.userData.wantedId;
            if (wantedObjects[wantedId] && wantedObjects[wantedId].url) {
                window.open(wantedObjects[wantedId].url, '_blank');
                break;
            }
        }
    }
}

// Add event listeners
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('click', onMouseClick);


function onMouseUp() {
    isDragging = false;
}


function onTouchStart(event) {

    if (isViewingWantedBoard) {
        return;
    }
    
    if (event.touches.length === 1) {
        isDragging = true;
        lastMouseX = event.touches[0].clientX;
        lastMouseY = event.touches[0].clientY;
    }
}

function onTouchMove(event) {
   
    if (isViewingWantedBoard || !isDragging || event.touches.length !== 1) {
        return;
    }
    
    const deltaX = event.touches[0].clientX - lastMouseX;
    const deltaY = event.touches[0].clientY - lastMouseY;
    
    updateCameraOffset(deltaX, deltaY);
    
    lastMouseX = event.touches[0].clientX;
    lastMouseY = event.touches[0].clientY;
}

function onTouchEnd() {
    isDragging = false;
}


function updateCameraOffset(deltaX, deltaY) {

    cameraOffsetX -= deltaX * 0.1;
    cameraOffsetY += deltaY * 0.1;
    

    cameraOffsetX = Math.max(-maxCameraOffset, Math.min(maxCameraOffset, cameraOffsetX));
    cameraOffsetY = Math.max(-maxCameraOffset, Math.min(maxCameraOffset, cameraOffsetY));
    

    updateCameraPosition();
}


function updateCameraPosition() {
    if (isCameraAnimating || isViewingHub) return; // Не обновляем позицию камеры во время анимации или при просмотре хаба
    
    const direction = new THREE.Vector3(
        baseCameraPosition.x + cameraOffsetX,
        baseCameraPosition.y + cameraOffsetY,
        baseCameraPosition.z
    ).normalize();

    const centerPoint = new THREE.Vector3(0, 0, 0);
    
    camera.position.copy(centerPoint).add(direction.multiplyScalar(currentCameraDistance));
    camera.lookAt(centerPoint);
}
    
function createInfoSign(mesh, position, title, content) {
    const infoSign = {
        mesh: mesh,
        position: position,
        title: title,
        content: content,
        active: false
    };
    
    mesh.userData.isInfoSign = true;
    mesh.userData.infoId = infoSigns.length;
    
    infoSigns.push(infoSign);
    
    console.log(`Добавлена информационная табличка: ${title} (ID: ${mesh.userData.infoId})`);
}

function getInfoContent(name) {
    return `
        <div style="text-align: center; margin-bottom: 15px;">
            <img src="imgs/me.jpg" alt="Profile Photo" style="max-width: 200px; border-radius: 10px; border: 2px solid #ff80bf; box-shadow: 0 0 10px #ff80bf;">
        </div>
        <p>Hi everyone, my name is ov4rlxrd, this interactive website was created especially for SuccinctLabs by me from scratch, I hope you will appreciate it!</p>
        <p>Here you can walk for Ferris, read about roles on the server and so on!</p>
        <div style="margin-top: 20px; display: flex; justify-content: center; gap: 20px;">
            <a href="https://x.com/DDenicah" target="_blank" style="color: #ff80bf; text-decoration: none; font-weight: bold; display: inline-block; padding: 8px 15px; border: 1px solid #ff80bf; border-radius: 5px; box-shadow: 0 0 5px #ff80bf;">Twitter (X)</a>
            <a href="https://github.com/ov4rlxrd" target="_blank" style="color: #ff80bf; text-decoration: none; font-weight: bold; display: inline-block; padding: 8px 15px; border: 1px solid #ff80bf; border-radius: 5px; box-shadow: 0 0 5px #ff80bf;">GitHub</a>
        </div>
    `;
}

function checkInfoSignsProximity() {
    if (!character || infoSigns.length === 0) return;
    
    const characterPosition = character.position.clone();
    let closestSign = null;
    let minDistance = Infinity;
    let isNearInfoSign = false;
    
    for (let infoSign of infoSigns) {
        const distance = characterPosition.distanceTo(infoSign.position);
        
        if (distance < 3) {
            isNearInfoSign = true;
            
            if (distance < minDistance) {
                minDistance = distance;
                closestSign = infoSign;
            }
        }
    }
    
    if (isNearInfoSign && closestSign) {
        if (!document.querySelector('.info-hint')) {
            const hint = document.createElement('div');
            hint.className = 'info-hint';
            hint.textContent = 'Press E to view information';
            document.body.appendChild(hint);
        }
        
        activeInfoSign = closestSign;
    } else {
        const hint = document.querySelector('.info-hint');
        if (hint) {
            hint.remove();
        }
        activeInfoSign = null;
    }
}

function toggleInfoSign(infoSign) {
    if (infoSign.active) {
        closeInfoPanel();
        infoSign.active = false;
    } else {
        showInfoPanel(infoSign);
        infoSign.active = true;
    }
}

function setupWantedBoard(mesh, position) {
    wantedBoard = {
        mesh: mesh,
        position: position
    };
    
    mesh.userData.isWantedBoard = true;
    
    console.log('Настроена доска розыска в позиции:', position);
}

function checkWantedBoardProximity() {
    if (!character || !wantedBoard) return;
    
    const distance = character.position.distanceTo(
        new THREE.Vector3(
            wantedBoard.position.x,
            character.position.y,
            wantedBoard.position.z
        )
    );
    
    if (distance < 3) {
        if (!document.querySelector('.wanted-hint')) {
            const hint = document.createElement('div');
            hint.className = 'wanted-hint';
            hint.textContent = 'Press E to view wanted board';
            document.body.appendChild(hint);
        }
        
        activeWantedBoard = true;
    } else {

        const hint = document.querySelector('.wanted-hint');
        if (hint) {
            hint.remove();
        }
        

        activeWantedBoard = false;
    }
}


function toggleWantedBoard() {
    if (isViewingWantedBoard) {

        returnFromWantedBoard();
    } else {

        viewWantedBoard();
    }
}


function viewWantedBoard() {
    if (!wantedBoard || isViewingWantedBoard) return;
    

    originalCameraPosition = camera.position.clone();
    originalControlsEnabled = controls ? controls.enabled : false;
    

    if (controls) {
        controls.enabled = false;
    }
    

    const boardNormal = new THREE.Vector3(-1.4, 0, 0); 
    const viewPosition = wantedBoard.position.clone().add(
        boardNormal.clone().multiplyScalar(-2) 
    );
    viewPosition.y += 1.2; 

    const lookAtPosition = wantedBoard.position.clone();
    

    wantedBoardViewStartTime = Date.now();
   
    function animateCamera() {
        const elapsed = (Date.now() - wantedBoardViewStartTime) / 1000; 
        const progress = Math.min(elapsed / wantedBoardViewDuration, 1.0);
      
        camera.position.lerpVectors(originalCameraPosition, viewPosition, easeInOutCubic(progress));
        
   
        camera.lookAt(lookAtPosition);
        
     
        if (progress < 1.0) {
            requestAnimationFrame(animateCamera);
        } else {
            
            console.log('Камера перемещена к доске розыска');
        }
    }
    

    isViewingWantedBoard = true;
    animateCamera();
    
 
    showWantedViewHint();
}
    

function returnFromWantedBoard() {
    if (!isViewingWantedBoard || !originalCameraPosition) return;

    const startPosition = camera.position.clone();
    const startTime = Date.now();
    
    function animateReturn() {
        const elapsed = (Date.now() - startTime) / 1000; 
        const progress = Math.min(elapsed / wantedBoardViewDuration, 1.0);
        

        camera.position.lerpVectors(startPosition, originalCameraPosition, easeInOutCubic(progress));
        
     
        if (progress < 1.0) {
            requestAnimationFrame(animateReturn);
        } else {
            
            if (controls) {
                controls.enabled = originalControlsEnabled;
            }
            isViewingWantedBoard = false;
            
         
            hideWantedViewHint();
            
     
            updateCameraPosition();
            
            console.log('Камера возвращена в исходное положение');
        }
    }
    

    animateReturn();
}

function showWantedViewHint() {
    hideWantedViewHint();
    
    const hint = document.createElement('div');
    hint.className = 'wanted-view-hint';
    hint.textContent = 'Press E to return';
    document.body.appendChild(hint);
}

function hideWantedViewHint() {
    const hint = document.querySelector('.wanted-view-hint');
    if (hint) {
        hint.remove();
    }
}

let isViewingWantedBoard = false; 
let originalCameraPosition = null; 
let originalControlsEnabled = false; 
let wantedBoardViewDuration = 1.0; 
let wantedBoardViewStartTime = 0; 


function setupWalkSound() {
    console.log('Настройка звука шагов...');
    

    walkSound = null;
    
    try {
   
        const audioLoader = new THREE.AudioLoader();
 
        const listener = new THREE.AudioListener();
        camera.add(listener);

        walkSound = new THREE.Audio(listener);
  
        audioLoader.load(
            'sounds/walk.mp3', 
            function(buffer) {
                console.log('Звук шагов успешно загружен');
                walkSound.setBuffer(buffer);
                walkSound.setLoop(true);
                walkSound.setVolume(0.5);
            },
            function(xhr) {
                console.log('Загрузка звука: ' + (xhr.loaded / xhr.total * 100) + '%');
            },
            function(error) {
                console.error('Ошибка загрузки звука шагов:', error);
               
                walkSound = {
                    isPlaying: false,
                    play: function() { 
                        this.isPlaying = true;
                        console.log('Имитация воспроизведения звука шагов');
                    },
                    stop: function() { 
                        this.isPlaying = false;
                        console.log('Имитация остановки звука шагов');
                    }
                };
            }
        );
    } catch (e) {
        console.error('Ошибка при инициализации звука шагов:', e);
   
        walkSound = {
            isPlaying: false,
            play: function() { 
                this.isPlaying = true;
                console.log('Имитация воспроизведения звука шагов');
            },
            stop: function() { 
                this.isPlaying = false;
                console.log('Имитация остановки звука шагов');
            }
        };
    }
}


function setupPortalSound() {
    console.log('Настройка звука портала...');
    
  
    portalSound = null;
    
    try {
        
        const audioLoader = new THREE.AudioLoader();
        
        const listener = camera.children.find(child => child instanceof THREE.AudioListener) || 
                         (() => {
                             const newListener = new THREE.AudioListener();
                             camera.add(newListener);
                             return newListener;
                         })();
        
     
        portalSound = new THREE.Audio(listener);
        
   
        audioLoader.load(
            'sounds/popup.mp3', 
            function(buffer) {
                console.log('Звук портала успешно загружен');
                portalSound.setBuffer(buffer);
                portalSound.setLoop(false);
                portalSound.setVolume(0.4);
            },
            function(xhr) {
                console.log('Загрузка звука портала: ' + (xhr.loaded / xhr.total * 100) + '%');
            },
            function(error) {
                console.error('Ошибка загрузки звука портала:', error);
        
                portalSound = {
                    isPlaying: false,
                    play: function() { 
                        this.isPlaying = true;
                        console.log('Имитация воспроизведения звука портала');
                    }
                };
            }
        );
    } catch (e) {
        console.error('Ошибка при инициализации звука портала:', e);
        portalSound = {
            isPlaying: false,
            play: function() { 
                this.isPlaying = true;
                console.log('Имитация воспроизведения звука портала');
            }
        };
    }
}


function setupBackgroundMusic() {
    console.log('Настройка фоновой музыки...');

    backgroundMusic = null;
    
    try {

        const audioLoader = new THREE.AudioLoader();
   
        const listener = camera.children.find(child => child instanceof THREE.AudioListener) || 
                         (() => {
                             const newListener = new THREE.AudioListener();
                             camera.add(newListener);
                             return newListener;
                         })();
        
 
        backgroundMusic = new THREE.Audio(listener);
        

        audioLoader.load(
            'sounds/main.mp3', 
            function(buffer) {
                console.log('Фоновая музыка успешно загружена');
                backgroundMusic.setBuffer(buffer);
                backgroundMusic.setLoop(true);
                backgroundMusic.setVolume(0.5);
         
                backgroundMusic.play();
            },
            function(xhr) {
                console.log('Загрузка фоновой музыки: ' + (xhr.loaded / xhr.total * 100) + '%');
            },
            function(error) {
                console.error('Ошибка загрузки фоновой музыки:', error);

                backgroundMusic = {
                    isPlaying: false,
                    play: function() { 
                        this.isPlaying = true;
                        console.log('Имитация воспроизведения фоновой музыки');
                    }
                };
            }
        );
    } catch (e) {
        console.error('Ошибка при инициализации фоновой музыки:', e);
        backgroundMusic = {
            isPlaying: false,
            play: function() { 
                this.isPlaying = true;
                console.log('Имитация воспроизведения фоновой музыки');
            }
        };
    }
}

let hubObjects = {
    main: null,
    wanted: null,
    roles: null
};
let isViewingHub = false;
let currentHubView = 'main';
let hubNavigationArrows = null;
let isCameraAnimating = false; // Добавляем флаг для анимации камеры

function createHubNavigationArrows() {
    if (hubNavigationArrows) return;
    
    console.log('Creating navigation arrows...');
    
    hubNavigationArrows = document.createElement('div');
    hubNavigationArrows.className = 'hub-navigation';
    hubNavigationArrows.innerHTML = `
        <div class="hub-arrow left">←</div>
        <div class="hub-arrow right">→</div>
    `;
    document.body.appendChild(hubNavigationArrows);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .hub-navigation {
            position: fixed;
            top: 50%;
            left: 0;
            right: 0;
            transform: translateY(-50%);
            display: flex;
            justify-content: space-between;
            padding: 0 20px;
            pointer-events: auto;
            z-index: 1000;
        }
        .hub-arrow {
            width: 50px;
            height: 50px;
            background: rgba(0, 0, 0, 0.5);
            border: 2px solid #ff80bf;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ff80bf;
            font-size: 24px;
            cursor: pointer;
            pointer-events: auto;
            transition: all 0.3s ease;
        }
        .hub-arrow:hover {
            background: rgba(255, 128, 191, 0.2);
            transform: scale(1.1);
        }
        .hub-arrow.left {
            margin-right: auto;
        }
        .hub-arrow.right {
            margin-left: auto;
        }
    `;
    document.head.appendChild(style);
    
    // Add event listeners
    const leftArrow = hubNavigationArrows.querySelector('.hub-arrow.left');
    const rightArrow = hubNavigationArrows.querySelector('.hub-arrow.right');
    
    leftArrow.addEventListener('click', () => {
        console.log('Left arrow clicked');
        if (currentHubView === 'main') {
            navigateToHubView('wanted');
        } else if (currentHubView === 'wanted') {
            navigateToHubView('roles');
        } else if (currentHubView === 'roles') {
            navigateToHubView('main');
        }
    });
    
    rightArrow.addEventListener('click', () => {
        console.log('Right arrow clicked');
        if (currentHubView === 'main') {
            navigateToHubView('roles');
        } else if (currentHubView === 'roles') {
            navigateToHubView('wanted');
        } else if (currentHubView === 'wanted') {
            navigateToHubView('main');
        }
    });
    
    console.log('Navigation arrows created and event listeners attached');
}

function navigateToHubView(targetView) {
    if (!hubObjects.main) return;
    
    console.log('Starting navigation to view:', targetView);
    console.log('Current view:', currentHubView);
    
    const startRotation = camera.rotation.clone();
    const startTime = Date.now();
    const duration = 1000;
    
    // Определяем целевой угол поворота в зависимости от вида
    let targetRotation = startRotation.clone();
    if (targetView === 'roles') {
        // Для roles поворот на 0 градусов (относительно начального положения)
        targetRotation.y = 0;
    } else if (targetView === 'wanted') {
        // Для wanted поворот на 180 градусов (относительно начального положения)
        targetRotation.y = Math.PI;
    } else {
        // Для main поворот на 90 градусов (относительно начального положения)
        targetRotation.y = Math.PI / 2;
    }
    
    // Нормализуем углы для корректного поворота
    while (startRotation.y > Math.PI) startRotation.y -= 2 * Math.PI;
    while (startRotation.y < -Math.PI) startRotation.y += 2 * Math.PI;
    while (targetRotation.y > Math.PI) targetRotation.y -= 2 * Math.PI;
    while (targetRotation.y < -Math.PI) targetRotation.y += 2 * Math.PI;
    
    // Выбираем кратчайший путь поворота
    let diff = targetRotation.y - startRotation.y;
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;
    
    console.log('Rotation parameters:', {
        startRotation: startRotation,
        targetRotation: targetRotation,
        diff: diff
    });
    
    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1.0);
        const easedProgress = easeInOutCubic(progress);
        
        // Интерполируем только поворот по оси Y
        camera.rotation.y = startRotation.y + diff * easedProgress;
        
        // Сбрасываем повороты по другим осям
        camera.rotation.x = 0;
        camera.rotation.z = 0;
        
        console.log('Current camera rotation:', camera.rotation);
        
        if (progress < 1.0) {
            requestAnimationFrame(animateCamera);
        } else {
            currentHubView = targetView;
            console.log('Navigation completed to view:', targetView);
            console.log('Final camera rotation:', camera.rotation);
        }
    }
    
    animateCamera();
}

function showHubHint() {
    let hint = document.querySelector('.hub-hint');
    
    if (!hint) {
        hint = document.createElement('div');
        hint.className = 'hub-hint';
        hint.textContent = 'Press E to enter hub';
        document.body.appendChild(hint);
    }
}

function hideHubHint() {
    const hint = document.querySelector('.hub-hint');
    if (hint) {
        hint.remove();
    }
}

function showExitHubHint() {
    let hint = document.querySelector('.hub-hint');
    
    if (!hint) {
        hint = document.createElement('div');
        hint.className = 'hub-hint';
        hint.textContent = 'Press E to exit hub';
        document.body.appendChild(hint);
    }
}

function checkHubProximity() {
    if (!character) return;
    
    // Если персонаж в хабе, показываем подсказку о выходе
    if (isViewingHub) {
        showExitHubHint();
        return;
    }
    
    // Иначе проверяем, находится ли персонаж рядом с триггером хаба
    let nearHubTrigger = false;
    
    scene.traverse((node) => {
        if (node.userData && node.userData.isHubTrigger) {
            const distance = character.position.distanceTo(node.getWorldPosition(new THREE.Vector3()));
            if (distance < 3) {
                nearHubTrigger = true;
            }
        }
    });
    
    if (nearHubTrigger) {
        showHubHint();
    } else {
        hideHubHint();
    }
}

function enterHub() {
    console.log('Attempting to enter hub...');
    console.log('isViewingHub:', isViewingHub);
    console.log('hubObjects.main:', hubObjects.main);
    
    if (isViewingHub || !hubObjects.main) {
        console.log('Cannot enter hub:', isViewingHub ? 'already viewing hub' : 'hub object not found');
        return;
    }
    
    isViewingHub = true;
    currentHubView = 'main';
    isCameraAnimating = true;
    
    // Удаляем старую подсказку о входе
    hideHubHint();
    
    // Save original camera state
    originalCameraPosition = camera.position.clone();
    originalControlsEnabled = controls ? controls.enabled : false;
    
    if (controls) {
        controls.enabled = false;
    }
    
    // Get hub main position
    const hubPosition = hubObjects.main.position.clone();
    console.log('Hub position:', hubPosition);
    
    // Calculate target camera position - перемещаем камеру влево
    const targetPosition = hubPosition.clone();
    targetPosition.x += 6; // Перемещаем влево
    console.log('Target camera position:', targetPosition);
    
    // Start animation
    const startTime = Date.now();
    const duration = 1000;
    
    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1.0);
        
        const easedProgress = easeInOutCubic(progress);
        
        const newPosition = new THREE.Vector3();
        newPosition.lerpVectors(originalCameraPosition, targetPosition, easedProgress);
        camera.position.copy(newPosition);
        
        console.log('Animation progress:', progress);
        console.log('Current camera position:', camera.position);
        
        // Камера смотрит на хаб
        camera.lookAt(hubPosition);
        
        if (progress < 1.0) {
            requestAnimationFrame(animateCamera);
        } else {
            // Устанавливаем поворот камеры на 90 градусов влево
            camera.rotation.y = Math.PI / 2;
            // Создаем стрелки навигации
            createHubNavigationArrows();
            isCameraAnimating = false;
            // Показываем подсказку о выходе
            showExitHubHint();
            console.log('Entered hub view');
            console.log('Final camera position:', camera.position);
            console.log('Final camera rotation:', camera.rotation);
        }
    }
    
    animateCamera();
}

function exitHub() {
    if (!isViewingHub) return;
    
    isViewingHub = false;
    
    // Удаляем подсказку о выходе
    hideHubHint();
    
    // Remove navigation arrows
    if (hubNavigationArrows) {
        hubNavigationArrows.remove();
        hubNavigationArrows = null;
    }
    
    // Animate camera back to original position
    const startPosition = camera.position.clone();
    const startTime = Date.now();
    const duration = 1000;
    
    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1.0);
        
        camera.position.lerpVectors(startPosition, originalCameraPosition, easeInOutCubic(progress));
        
        if (progress < 1.0) {
            requestAnimationFrame(animateCamera);
        } else {
            if (controls) {
                controls.enabled = originalControlsEnabled;
            }
            console.log('Exited hub view');
        }
    }
    
    animateCamera();
}


// Add hub proximity check to animation loop


init();