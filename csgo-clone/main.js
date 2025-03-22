import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GameManager } from './game-engine/game-manager.js';

class Game {
    constructor() {
        // Initialize properties
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.gameManager = null;
        this.clock = new THREE.Clock();
        this.isGameRunning = false;

        // Bind methods
        this.init = this.init.bind(this);
        this.animate = this.animate.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.setupEventListeners = this.setupEventListeners.bind(this);
        this.startGame = this.startGame.bind(this);
        this.pauseGame = this.pauseGame.bind(this);
        this.resumeGame = this.resumeGame.bind(this);
        this.restartGame = this.restartGame.bind(this);

        // Initialize the game
        this.init();
    }

    init() {
        try {
            // Check WebGL support
            if (!this.checkWebGLSupport()) {
                document.getElementById('error-message').classList.remove('hidden');
                return;
            }

            // Create scene
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x88ccff);
            this.scene.fog = new THREE.Fog(0x88ccff, 0, 50);

            // Create camera
            this.camera = new THREE.PerspectiveCamera(
                75,
                window.innerWidth / window.innerHeight,
                0.1,
                1000
            );
            this.camera.position.y = 1.7; // Average human height

            // Create renderer
            this.renderer = new THREE.WebGLRenderer({
                canvas: document.getElementById('game-canvas'),
                antialias: true
            });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            // Create controls
            this.controls = new PointerLockControls(this.camera, document.body);

            // Setup lighting
            this.setupLighting();

            // Create environment
            this.createEnvironment();

            // Initialize game manager
            this.gameManager = new GameManager(this.scene, this.camera);

            // Setup event listeners
            this.setupEventListeners();

            // Start animation loop
            this.animate();

        } catch (error) {
            console.error('Error initializing game:', error);
            document.getElementById('error-message').classList.remove('hidden');
        }
    }

    setupLighting() {
        // Main ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(5, 8, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        directionalLight.shadow.bias = -0.0001;
        this.scene.add(directionalLight);

        // Add subtle blue rim light
        const rimLight = new THREE.DirectionalLight(0x6495ED, 0.3);
        rimLight.position.set(-5, 2, -5);
        this.scene.add(rimLight);

        // Add point lights for atmosphere
        const createPointLight = (color, intensity, position) => {
            const light = new THREE.PointLight(color, intensity, 20);
            light.position.copy(position);
            light.castShadow = true;
            light.shadow.mapSize.width = 1024;
            light.shadow.mapSize.height = 1024;
            light.shadow.camera.near = 0.1;
            light.shadow.camera.far = 25;
            this.scene.add(light);
        };

        // Add atmospheric point lights
        createPointLight(0xFFD700, 0.8, new THREE.Vector3(10, 5, 10));
        createPointLight(0x00CED1, 0.6, new THREE.Vector3(-10, 5, -10));
        createPointLight(0xFF6B6B, 0.4, new THREE.Vector3(0, 3, 0));
    }

    createEnvironment() {
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Add walls and obstacles
        this.createWalls();
    }

    createWalls() {
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.7,
            metalness: 0.3
        });

        // Create a more complex environment with various walls and obstacles
        const createWall = (width, height, depth, position, rotation = 0) => {
            const wallGeometry = new THREE.BoxGeometry(width, height, depth);
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.copy(position);
            wall.rotation.y = rotation;
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
            return wall;
        };

        // Outer walls
        createWall(50, 5, 1, new THREE.Vector3(0, 2.5, -25)); // North
        createWall(50, 5, 1, new THREE.Vector3(0, 2.5, 25));  // South
        createWall(50, 5, 1, new THREE.Vector3(-25, 2.5, 0), Math.PI / 2); // West
        createWall(50, 5, 1, new THREE.Vector3(25, 2.5, 0), Math.PI / 2);  // East

        // Inner walls and obstacles
        createWall(10, 3, 1, new THREE.Vector3(-10, 1.5, -5), Math.PI / 4);
        createWall(15, 4, 1, new THREE.Vector3(8, 2, 10), -Math.PI / 6);
        createWall(12, 3.5, 1, new THREE.Vector3(-5, 1.75, 8), Math.PI / 3);

        // Create some boxes as cover
        const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
        const boxes = [
            { pos: new THREE.Vector3(5, 1, -8) },
            { pos: new THREE.Vector3(-7, 1, -12) },
            { pos: new THREE.Vector3(12, 1, 5) },
            { pos: new THREE.Vector3(-15, 1, 7) }
        ];

        boxes.forEach(box => {
            const mesh = new THREE.Mesh(boxGeometry, wallMaterial);
            mesh.position.copy(box.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        });
    }

    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(
                window.WebGLRenderingContext && 
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
            );
        } catch (e) {
            return false;
        }
    }

    addTemporaryWalls() {
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.7,
            metalness: 0.3
        });

        // Create walls
        const wallGeometry = new THREE.BoxGeometry(20, 5, 1);
        
        // Front wall
        const frontWall = new THREE.Mesh(wallGeometry, wallMaterial);
        frontWall.position.set(0, 2.5, -10);
        this.scene.add(frontWall);

        // Back wall
        const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
        backWall.position.set(0, 2.5, 10);
        this.scene.add(backWall);

        // Left wall
        const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.position.set(-10, 2.5, 0);
        this.scene.add(leftWall);

        // Right wall
        const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
        rightWall.rotation.y = Math.PI / 2;
        rightWall.position.set(10, 2.5, 0);
        this.scene.add(rightWall);
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', this.onWindowResize, false);

        // Game state variables
        this.selectedTeam = null;
        this.selectedWeapon = null;

        // Menu navigation
        document.getElementById('start-game').addEventListener('click', () => {
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('team-selection').classList.remove('hidden');
        });

        document.getElementById('resume').addEventListener('click', this.resumeGame);
        document.getElementById('restart').addEventListener('click', this.restartGame);

        // Team selection
        document.getElementById('team-blue').addEventListener('click', () => this.selectTeam('blue'));
        document.getElementById('team-red').addEventListener('click', () => this.selectTeam('red'));

        // Weapon selection
        document.getElementById('weapon-rifle').addEventListener('click', () => this.selectWeapon('rifle'));
        document.getElementById('weapon-sniper').addEventListener('click', () => this.selectWeapon('sniper'));

        // Back to menu button
        document.getElementById('back-to-menu').addEventListener('click', () => {
            document.getElementById('team-selection').classList.add('hidden');
            document.getElementById('main-menu').classList.remove('hidden');
            this.selectedTeam = null;
            this.selectedWeapon = null;
            this.resetSelections();
        });

        // Function to return to main menu
        const returnToMainMenu = () => {
            // Reset game state
            this.isGameRunning = false;
            this.selectedTeam = null;
            this.selectedWeapon = null;
            
            // Hide all game screens and show main menu
            document.getElementById('game-over').classList.add('hidden');
            document.getElementById('pause-menu').classList.add('hidden');
            document.getElementById('hud').classList.add('hidden');
            document.getElementById('team-selection').classList.add('hidden');
            document.getElementById('main-menu').classList.remove('hidden');
            
            // Reset game manager
            if (this.gameManager) {
                this.gameManager.reset();
            }
            
            // Reset camera position
            this.camera.position.set(0, 1.7, 0);
            this.camera.rotation.set(0, 0, 0);
            
            // Ensure controls are disabled
            this.controls.unlock();
            this.controls.enabled = false;
            
            // Reset selections
            this.resetSelections();
        };

        // Add click handlers for both quit buttons
        document.getElementById('main-menu-return').addEventListener('click', returnToMainMenu);
        document.getElementById('quit-to-menu').addEventListener('click', returnToMainMenu);
        
        // Pause game on Escape key
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Escape' && this.isGameRunning) {
                this.pauseGame();
            }
        });

        // Handle pointer lock change
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === document.body) {
                this.controls.enabled = true;
                document.getElementById('hud').classList.remove('hidden');
                document.getElementById('main-menu').classList.add('hidden');
                document.getElementById('pause-menu').classList.add('hidden');
            } else {
                this.controls.enabled = false;
                if (this.isGameRunning && !this.gameManager.gameOver) {
                    document.getElementById('pause-menu').classList.remove('hidden');
                }
            }
        });
    }

    selectTeam(team) {
        this.selectedTeam = team;
        
        // Update UI
        document.querySelectorAll('.team-choice').forEach(el => {
            el.classList.remove('selected');
        });
        document.getElementById(`team-${team}`).classList.add('selected');
        
        // Show weapon selection
        document.querySelector('.weapon-selection').classList.remove('hidden');
        document.querySelector('.weapon-selection').classList.add('visible');
    }

    selectWeapon(weapon) {
        this.selectedWeapon = weapon;
        
        // Update UI
        document.querySelectorAll('.weapon-choice').forEach(el => {
            el.classList.remove('selected');
        });
        document.getElementById(`weapon-${weapon}`).classList.add('selected');
        
        // Start game after short delay
        setTimeout(() => this.startGame(), 500);
    }

    resetSelections() {
        document.querySelectorAll('.team-choice, .weapon-choice').forEach(el => {
            el.classList.remove('selected');
        });
        document.querySelector('.weapon-selection').classList.add('hidden');
        document.querySelector('.weapon-selection').classList.remove('visible');
    }

    startGame() {
        if (!this.selectedTeam || !this.selectedWeapon) return;
        
        this.isGameRunning = true;
        document.getElementById('team-selection').classList.add('hidden');
        this.controls.lock();
        
        if (this.gameManager) {
            this.gameManager.reset();
            this.gameManager.setTeam(this.selectedTeam);
            this.gameManager.setWeapon(this.selectedWeapon);
        }
    }

    pauseGame() {
        if (this.isGameRunning && !this.gameManager.gameOver) {
            this.controls.unlock();
            document.getElementById('pause-menu').classList.remove('hidden');
        }
    }

    resumeGame() {
        if (this.isGameRunning && !this.gameManager.gameOver) {
            document.getElementById('pause-menu').classList.add('hidden');
            this.controls.lock();
        }
    }

    restartGame() {
        this.isGameRunning = true;
        document.getElementById('game-over').classList.add('hidden');
        if (this.gameManager) {
            this.gameManager.reset();
        }
        this.controls.lock();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate);

        const delta = this.clock.getDelta();

        if (this.isGameRunning && this.controls.enabled && this.gameManager) {
            this.gameManager.update(delta);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});