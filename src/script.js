import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Water } from 'three/examples/jsm/objects/Water';
import { Sky } from 'three/examples/jsm/objects/Sky';
import * as dat from 'dat.gui';

let canvas, spinnerBackground, spinner;
let camera, scene, renderer, pmremGenerator;
let controls, water, sun, sky, model, text;
let animationStarted = false;

let controlTargetX = -30, controlTargetY = 10, controlTargetZ = 0;

let modelsLoaded = false, fontLoaded = true, sceneLoaded = false, reloadRequested = false, sceneFinished = false;

const parameters = {
    modelScale: undefined,
    modelPosition: undefined,
    elevation: -3,
    azimuth: undefined,
    distortionScale: undefined,
    distortionSize: undefined
};

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

let isTablet = sizes.width > 400 && sizes.width < 800;
let isMobile = sizes.width <= 400;

const calculateLayout = () => {
    if (isTablet) {
        parameters.modelScale = 0.75;
        parameters.modelPosition = new THREE.Vector3(3, 3, 3);
        parameters.azimuth = 35;
        parameters.distortionScale = 14;
        parameters.distortionSize = 0.25;
    }
    
    else if (isMobile) {
        parameters.modelScale = 0.5;
        parameters.modelPosition = new THREE.Vector3(-12, 3, 3);
        parameters.azimuth = 30;
        parameters.distortionScale = 12;
        parameters.distortionSize = 0.25;
    }

    else {
        parameters.modelScale = 1;
        parameters.modelPosition = new THREE.Vector3(3, 3, 3);
        parameters.azimuth = 40;
        parameters.distortionScale = 12;
        parameters.distortionSize = 0.25;
    }
};

const createEventListeners = () => {
    window.addEventListener('load', (e) => {
        const image = document.getElementById('west-pier-image');
        image.src = '/images/west-pier-black.png';
    });

    window.addEventListener('resize', () => {
        window.location.href = window.location.href
    });
}

const sceneSetup = () => {
    calculateLayout();

    spinnerBackground = document.querySelector('.spinner-container');
    spinner = document.querySelector('.cssload-container');
    canvas = document.querySelector('canvas.webgl');

    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(sizes.width, sizes.height);
    renderer.toneMapping = THREE.NoToneMapping;
    // renderer.toneMappingExposure = 2;

    pmremGenerator = new THREE.PMREMGenerator(renderer);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(55, sizes.width / sizes.height, 1, 20000);
    camera.position.set(-60, 20, -100);
    
    controls = new OrbitControls(camera, canvas);
    // controls.minPolarAngle = Math.PI * 0.495;
    // controls.maxPolarAngle = Math.PI * 0.495;
    // controls.minDistance = 40.0;
    // controls.maxDistance = 200.0;
    controls.target.set(controlTargetX, controlTargetY, controlTargetZ);
    controls.enabled = false;
    controls.update();
};

const buildSun = () => {
    sun = new THREE.Vector3();

    const updateSun = () => {
        const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
        const theta = THREE.MathUtils.degToRad(parameters.azimuth);
        
        sun.setFromSphericalCoords(1, phi, theta);

        sky.material.uniforms['sunPosition'].value.copy(sun);
        water.material.uniforms['sunDirection'].value.copy(sun).normalize();

        scene.environment = pmremGenerator.fromScene(sky).texture;
    };

    updateSun();
};

const buildWater = () => {
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    
    water = new Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load('textures/waternormals.jpg', (texture) => {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            distortionScale: parameters.distortionScale,
            fog: scene.fog !== undefined,
        }
    );

    water.material.uniforms.size.value = parameters.distortionSize;
    water.rotation.x = -Math.PI / 2;
};

const buildSky = () => {
    sky = new Sky();
    sky.scale.setScalar(10000);

    const skyUniforms = sky.material.uniforms;

    skyUniforms['turbidity'].value = 1.5;
    skyUniforms['rayleigh'].value = 3;
    skyUniforms['mieCoefficient'].value = 0.0006;
    skyUniforms['mieDirectionalG'].value = 0.8;
};

const addAssets = () => {
    // Clear the scene
    if (sceneLoaded && reloadRequested) {
        while(scene.children.length > 0){ 
            scene.remove(scene.children[0]); 
        }
        reloadRequested = false;
        sceneLoaded = false;
    }

    // Add scene children
    if (modelsLoaded && fontLoaded && !sceneLoaded) {
        model.scale.set(parameters.modelScale, parameters.modelScale, parameters.modelScale);

        scene.add(sky);
        scene.add(model);
        scene.add(water);

        sceneLoaded = true;

        setTimeout(() => {
            animationStarted = true;
        }, 5000);
    }

    else if (sceneLoaded) {
        canvas.classList.add('fadeIn');
        spinnerBackground.classList.add('fadeOut');
        spinner.classList.add('fadeOut');
    }
}

const buildAssets = () => {
    model = new THREE.Group();
    buildModels();
    // buildFont();
};

const buildModels = () => {
    const gltfLoader = new GLTFLoader();

    gltfLoader.load('models/rock/scene.gltf', (rock) => {
        model.add(rock.scene);

        gltfLoader.load('models/seagull/scene.gltf', (seagull) => {
            const scale = 8;
            seagull.scene.scale.set(scale,scale, scale);
            seagull.scene.position.set(3, 14, 0);
            model.add(seagull.scene);
            
            model.position.set(parameters.modelPosition.x, parameters.modelPosition.y, parameters.modelPosition.z);
            modelsLoaded = true;            
        });
    });
};

// const buildFont = () => {
//     const fontLoader = new THREE.FontLoader();

//     fontLoader.load(
//         '/fonts/Urbanist/Urbanist_Bold.typeface.json',
//         (font) => {
//             const textGeometry = new THREE.TextGeometry(
//                 '#LeaveNoTrace',
//                 {
//                     font: font,
//                     size: 8,
//                     height: 0.05,
//                     curveSegments: 12,
//                     bevelEnabled: true,
//                     bevelThickness: 0.03,
//                     bevelSize: 0.02,
//                     bevelOffset: 0,
//                     bevelSegments: 5,
//                 }
//             );
//             const textMaterial = new THREE.MeshBasicMaterial({
//                 color: '#000000', 
//                 transparent: true,
//             });
//             text = new THREE.Mesh(textGeometry, textMaterial);
//             text.castShadow = false;
//             text.receiveShadow = false;
//             text.rotation.set(0, -210, 0);
//             text.position.set(-15, 35, 20);
//             text.name = 'text';
//             model.add(text);
//             fontLoaded = true;
//         });
// };

// const buildSounds = () => {
//     const listener = new THREE.AudioListener();
//     const sound = new THREE.Audio(listener);    
//     const audioLoader = new THREE.AudioLoader();
    
//     camera.add(listener);
    
//     const playSound = () => {
//         audioLoader.load('/sounds/seagull-sounds.mp3', (buffer) => {
//             sound.setBuffer(buffer);
//             sound.setLoop(true);
//             sound.play();
//         });
//     }

//     window.addEventListener('click', () => {
//         if (!sound.isPlaying) {
//             playSound();       
//         }
//     });   
// };

// const buildGUI = () => {
//     const gui = new dat.GUI();
//     const folderSky = gui.addFolder('Sky');

//     folderSky.add(parameters, 'elevation', -1, 180, 0.01).onChange(() => {
//         buildSun()
//     });
//     folderSky.add(parameters, 'azimuth', -180, 180, 0.1).onChange(() => { 
//         buildSun();
//     });
//     folderSky.open();

//     const waterUniforms = water.material.uniforms;

//     const folderWater = gui.addFolder('Water');
//     folderWater.add(waterUniforms.distortionScale, 'value', 0, 40, 0.1).name('distortionScale');
//     folderWater.add(waterUniforms.size, 'value', 0.1, 10, 0.001).name('size');
//     folderWater.open();
// };

const init = async () => {
    window.addEventListener('load', (e) => {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        window.scrollTo(0,0);
    });

    sceneSetup();

    buildWater();
    buildSky();
    buildSun();
    buildAssets();

    // buildSounds();
    // buildGUI();

    createEventListeners();
};

const animate = () => {
    addAssets();

    if (sceneLoaded) {
        // Water distortion
        water.material.uniforms['time'].value += 1.0 / 200.0;
    
        if (animationStarted && parameters.elevation < 3.5) {             
            // Rising sun
            parameters.elevation += 0.015;
            parameters.azimuth -= 0.005;
            buildSun();
        }
        
        else if (animationStarted && !sceneFinished && parameters.elevation >= 3.5) {
            document.querySelector('.arrows').style.display = 'initial';
            animationStarted = false;
            sceneFinished = true;
        }

    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

init();
animate();