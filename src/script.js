import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Water } from 'three/examples/jsm/objects/Water';
import { Sky } from 'three/examples/jsm/objects/Sky';
import * as dat from 'dat.gui';
import firebase from "firebase/app";
import "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCsjWceUHIg1-rvehDkJPS-Y9B7kXOyNtA",
    authDomain: "leave-no-trace.firebaseapp.com",
    databaseURL: "https://leave-no-trace-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "leave-no-trace",
    storageBucket: "leave-no-trace.appspot.com",
    messagingSenderId: "457637248324",
    appId: "1:457637248324:web:705aa20f5c9f4d0f4b2b11"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const countRef = db.collection("pledges").doc("count");

let pledgeCount = 0;
let canvas, spinnerBackground, spinner;
let camera, scene, renderer, pmremGenerator;
let controls, water, sun, sky, model;
let animationStarted = false;

let controlTargetX = -30, controlTargetY = 10, controlTargetZ = 0;

let modelsLoaded = false, sceneLoaded = false, sceneFinished = false;

const parameters = {
    logoScale: undefined,
    modelScale: undefined,
    logoPosition: undefined,
    modelPosition: undefined,
    elevation: -0.5,
    azimuth: undefined,
    distortionScale: undefined,
    distortionSize: undefined
};

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

let isMobile = sizes.width <= 480;
let isTablet = sizes.width > 480 && sizes.width <= 1024;

const calculateLayout = () => {
    if (isMobile) {
        parameters.logoScale = 120;
        parameters.modelScale = 0.5;
        parameters.logoPosition =  new THREE.Vector3(30, 20, 400);
        parameters.modelPosition = new THREE.Vector3(-10, 3, 3);
        parameters.azimuth = 30;
        parameters.distortionScale = 12;
        parameters.distortionSize = 0.25;
    }

    else if (isTablet) {
        parameters.logoScale = 100;
        parameters.modelScale = 0.75;
        parameters.logoPosition =  new THREE.Vector3(-24, 16, 240);
        parameters.modelPosition = new THREE.Vector3(3, 3, 3);
        parameters.azimuth = 35;
        parameters.distortionScale = 14;
        parameters.distortionSize = 0.25;
    }

    else {
        parameters.logoScale = 100;
        parameters.modelScale = 1;
        parameters.logoPosition =  new THREE.Vector3(-60, 16, 180);
        parameters.modelPosition = new THREE.Vector3(3, 3, 3);
        parameters.azimuth = 40;
        parameters.distortionScale = 12;
        parameters.distortionSize = 0.25;
    }
};

const createEventListeners = () => {
    window.addEventListener('load', (e) => {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        window.scrollTo(0,0);

        // Set pledge count
        countRef.get().then((doc) => {
            if (doc.exists) {
                pledgeCount = doc.data().pledgeCount;
                document.querySelector('#counter').innerHTML = doc.data().pledgeCount;
            }
        }).catch((error) => {
            console.log("Error getting document:", error);
        });
    });

    window.addEventListener('orientationchange', () => {
        window.location.href = window.location.href;
    });

    // window.addEventListener('resize', () => {
    //     window.location.href = window.location.href;
    // });

    const checkbox = document.querySelector('#pledge-checkbox');
    const button = document.querySelector('#pledge-button');
    const copyToClipboardInput = document.querySelector('#copy-to-clipboard-input');
    const copyToClipboardButton = document.querySelector('#copy-to-clipboard-button');
    const modal = document.querySelector('#success-modal');
    const modalClose = document.querySelector('#modal-close');
    const content = document.querySelector('#content');

    copyToClipboardButton.addEventListener('click', () => {
        copyToClipboardInput.select();
        document.execCommand("copy");
        copyToClipboardButton.innerHTML = "&#10003";
    })

    checkbox.addEventListener('change', (e) => {
        checkbox.checked ? button.disabled = false : button.disabled = true;
    });

    button.addEventListener('click', () => {
        // Increment counter
        const now = new Date();

        const pledgesRef = db.collection('pledges').doc(pledgeCount.toString());
        const pledgeCountRef = db.collection('pledges').doc('count');
        const increment = firebase.firestore.FieldValue.increment(1);
        
        const batch = db.batch();
        batch.set(pledgesRef, { date: now.toString() });
        batch.set(pledgeCountRef, { pledgeCount: increment }, { merge: true });
        batch.commit();

        // setPledgeCount();
        pledgeCount++;
        document.querySelector('#counter').innerHTML = pledgeCount;

        // UI actions
        checkbox.checked = false;
        button.disabled = true;
        modal.style.display = "flex";
        if (!content.classList.contains('blurred')) {
            content.classList.add('blurred');
        }
    });

    modalClose.onclick = function() {
        modal.style.display = "none";
        if (content.classList.contains('blurred')) {
            content.classList.remove('blurred');
        }
        copyToClipboardButton.innerHTML = '<img src="/images/clipboard-outline.svg" alt="Clipboard outline"/>';
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
            if (content.classList.contains('blurred')) {
                content.classList.remove('blurred');
            }
            copyToClipboardButton.innerHTML = '<img src="/images/clipboard-outline.svg" alt="Clipboard outline"/>';
        }
      }
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

    pmremGenerator = new THREE.PMREMGenerator(renderer);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(55, sizes.width / sizes.height, 1, 20000);
    camera.position.set(-60, 20, -100);
    
    controls = new OrbitControls(camera, canvas);
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
    if (modelsLoaded && !sceneLoaded) {
        model.scale.set(parameters.modelScale, parameters.modelScale, parameters.modelScale);

        scene.add(sky);
        scene.add(model);
        scene.add(water);

        sceneLoaded = true;

        setTimeout(() => {
            animationStarted = true;
            document.querySelector('.arrows').style.display = 'initial';
        }, 1000);
    }

    else if (sceneLoaded && !sceneFinished) {
        canvas.classList.add('fadeIn');
        spinnerBackground.classList.add('fadeOut');
        spinner.classList.add('fadeOut');
    }
}

const buildAssets = () => {
    model = new THREE.Group();
    buildModels();
};

const buildModels = () => {
    const gltfLoader = new GLTFLoader();

    gltfLoader.load('models/logo/logo_.glb', (logo) => {
        logo.scene.scale.set(parameters.logoScale, parameters.logoScale, 0);
        logo.scene.rotation.set(0, Math.PI, 0);
        logo.scene.position.set(parameters.logoPosition.x, parameters.logoPosition.y, parameters.logoPosition.z);
        model.add(logo.scene);

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
    });
};

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
    createEventListeners();

    sceneSetup();

    buildWater();
    buildSky();
    buildSun();
    buildAssets();

    // buildGUI();
};

const animate = () => {
    addAssets();

    if (sceneLoaded) {
        water.material.uniforms['time'].value += 1.0 / 200.0;
    
        if (animationStarted && parameters.elevation < 3.5) {             
            parameters.elevation += 0.005;
            parameters.azimuth -= 0.005;
            buildSun();
        }
        
        else if (animationStarted && !sceneFinished && parameters.elevation >= 3.5) {
            animationStarted = false;
            sceneFinished = true;
        }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

init();
animate();