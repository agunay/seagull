import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import Stats from 'three/examples/jsm/libs/stats.module';
import { Water } from 'three/examples/jsm/objects/Water';
import { Sky } from 'three/examples/jsm/objects/Sky';
import * as dat from 'dat.gui'

let canvas, stats;
let camera, scene, renderer;
let controls, water, sun;

const init = () => {
    canvas = document.querySelector('canvas.webgl');

    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.NoToneMapping;
    // renderer.toneMappingExposure = 2;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 20000);
    camera.position.set(30, 30, 100);

    sun = new THREE.Vector3();

    // Water
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    
    water = new Water(
        waterGeometry,
        {
            textureWidth: 1028,
            textureHeight: 1028,
            waterNormals: new THREE.TextureLoader().load('textures/waternormals.jpg', (texture) => {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            distortionScale: 20,
            fog: scene.fog !== undefined,
        }
    );

    water.rotation.x = -Math.PI / 2;
    scene.add(water);

    // Skybox
    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;

    skyUniforms['turbidity'].value = 1.5;
    skyUniforms['rayleigh'].value = 3;
    skyUniforms['mieCoefficient'].value = 0.0006;
    skyUniforms['mieDirectionalG'].value = 0.8;

    const parameters = {
        elevation: 1,
        azimuth: -138,
    };

    const pmremGenerator = new THREE.PMREMGenerator(renderer);

    const updateSun = () => {
        const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
        const theta = THREE.MathUtils.degToRad(parameters.azimuth);
        
        sun.setFromSphericalCoords(1, phi, theta);

        sky.material.uniforms['sunPosition'].value.copy(sun);
        water.material.uniforms['sunDirection'].value.copy(sun).normalize();

        scene.environment = pmremGenerator.fromScene(sky).texture;
    };

    updateSun();

    controls = new OrbitControls(camera, canvas);
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set(0, 10, 0);
    controls.minDistance = 40.0;
    controls.maxDistance = 200.0;
    controls.update();

    stats = new Stats();
    canvas.appendChild(stats.dom);

    // 3D Models
    let model = new THREE.Group();

    const gltfLoader = new GLTFLoader();

    gltfLoader.load('models/rock/scene.gltf', (rock) => {
        model.add(rock.scene);

        gltfLoader.load('models/seagull/scene.gltf', (seagull) => {
            const scale = 8;
            seagull.scene.scale.set(scale,scale, scale);
            seagull.scene.position.set(3, 14, 0);
            model.add(seagull.scene);
            
            model.position.set(3, 3, 3);
            scene.add(model);
        });
    });

    // Sounds
    const listener = new THREE.AudioListener();
    camera.add(listener);

    const sound = new THREE.Audio(listener);    

    const audioLoader = new THREE.AudioLoader();

    const playSound = () => {
        audioLoader.load('/sounds/seagull-sounds.mp3', (buffer) => {
            sound.setBuffer(buffer);
            sound.setLoop(true);
            sound.play();
        });
    }

    // GUI
    const gui = new dat.GUI();

    const folderSky = gui.addFolder('Sky');
    folderSky.add(parameters, 'elevation', -1, 180, 0.01).onChange(updateSun);
    folderSky.add(parameters, 'azimuth', -180, 180, 0.1).onChange(updateSun);
    folderSky.open();

    const waterUniforms = water.material.uniforms;

    const folderWater = gui.addFolder('Water');
    folderWater.add(waterUniforms.distortionScale, 'value', 0, 40, 0.1).name('distortionScale');
    folderWater.add(waterUniforms.size, 'value', 0.1, 10, 0.1).name('size');
    folderWater.open();
    
    // window.addEventListener('click', () => {
    //     if (!sound.isPlaying) {
    //         playSound();       
    //     }
    // });   
    window.addEventListener('resize', onWindowResize);
};

const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

const animate = () => {
    requestAnimationFrame(animate);
    render();
    stats.update();
}

const render = () => {
    // const time = performance.now() * 0.001;
    water.material.uniforms['time'].value += 1.0 / 80.0;
    renderer.render(scene, camera);
};

init();
animate();