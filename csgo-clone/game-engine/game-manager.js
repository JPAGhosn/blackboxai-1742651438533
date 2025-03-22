import * as THREE from 'three';
import { Enemy } from './enemy.js';
import { Player } from './player.js';
import { createBuildings } from './buildings.js';

export class GameManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.score = 0;
        this.enemies = [];
        this.maxEnemies = 10;
        this.spawnInterval = 4000;
        this.gameOver = false;
        this.player = null;
        this.spawnPoints = [];
        
        // Team and weapon settings
        this.team = null;
        this.weapon = null;
        this.weaponStats = {
            rifle: {
                damage: 25,
                fireRate: 100,
                range: 50
            },
            sniper: {
                damage: 100,
                fireRate: 1000,
                range: 100
            }
        };

        // Minimap settings
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapContext = this.minimapCanvas.getContext('2d');
        this.minimapScale = 20; // pixels per unit
        this.minimapSize = 200;
        this.minimapCanvas.width = this.minimapSize;
        this.minimapCanvas.height = this.minimapSize;
        
        // Initialize the game
        this.init();
    }

    updateMinimap() {
        const ctx = this.minimapContext;
        
        // Clear minimap
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, this.minimapSize, this.minimapSize);
        
        // Calculate minimap center (player position)
        const centerX = this.minimapSize / 2;
        const centerY = this.minimapSize / 2;
        
        // Draw walls
        ctx.fillStyle = '#666666';
        this.scene.children.forEach(obj => {
            if (obj.geometry instanceof THREE.BoxGeometry && !obj.isEnemy && !obj.isWeapon) {
                const relX = (obj.position.x - this.player.camera.position.x) * this.minimapScale + centerX;
                const relZ = (obj.position.z - this.player.camera.position.z) * this.minimapScale + centerY;
                const width = obj.geometry.parameters.width * this.minimapScale;
                const depth = obj.geometry.parameters.depth * this.minimapScale;
                
                ctx.fillRect(relX - width/2, relZ - depth/2, width, depth);
            }
        });
        
        // Draw enemies
        this.enemies.forEach(enemy => {
            const relX = (enemy.mesh.position.x - this.player.camera.position.x) * this.minimapScale + centerX;
            const relZ = (enemy.mesh.position.z - this.player.camera.position.z) * this.minimapScale + centerY;
            
            ctx.beginPath();
            ctx.arc(relX, relZ, 4, 0, Math.PI * 2);
            ctx.fillStyle = enemy.health > 0 ? '#ff0000' : '#000000';
            ctx.fill();
        });
        
        // Draw player
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        ctx.fillStyle = this.team === 'blue' ? '#0000ff' : '#ff0000';
        ctx.fill();
        
        // Draw player direction
        const direction = new THREE.Vector3();
        this.player.camera.getWorldDirection(direction);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + direction.x * 15,
            centerY + direction.z * 15
        );
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    setTeam(team) {
        this.team = team;
        // Update enemy colors based on player team
        const enemyColor = team === 'blue' ? 0xff0000 : 0x0000ff;
        this.enemies.forEach(enemy => {
            enemy.mesh.material.color.setHex(enemyColor);
        });
    }

    setWeapon(weapon) {
        this.weapon = weapon;
        if (this.player) {
            // Update player weapon stats
            const stats = this.weaponStats[weapon];
            this.player.damage = stats.damage;
            this.player.shootingCooldown = stats.fireRate;
            this.player.range = stats.range;
        }
    }

    init() {
        // Import and create buildings
        import('./buildings.js').then(module => {
            module.createBuildings(this.scene);
            
            // Create player after buildings are set up
            this.player = new Player(this.camera, this.scene);
            
            // Setup spawn points
            this.setupSpawnPoints();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Start enemy spawning
            this.startSpawning();
        }).catch(error => {
            console.error('Error loading buildings:', error);
        });
    }

    setupSpawnPoints() {
        // Create spawn points in a circle around the center
        const radius = 15;
        const numPoints = 8;
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            this.spawnPoints.push(new THREE.Vector3(x, 0, z));
        }
    }

    setupEventListeners() {
        // Listen for enemy deaths
        document.addEventListener('enemyKilled', (event) => {
            this.handleEnemyKilled(event.detail.position);
        });

        // Listen for player death
        document.addEventListener('playerDeath', () => {
            this.handlePlayerDeath();
        });
    }

    startSpawning() {
        this.spawnTimer = setInterval(() => {
            this.spawnEnemy();
        }, this.spawnInterval);
    }

    stopSpawning() {
        if (this.spawnTimer) {
            clearInterval(this.spawnTimer);
        }
    }

    spawnEnemy() {
        if (this.enemies.length >= this.maxEnemies || this.gameOver) return;

        // Choose a random spawn point
        const spawnPoint = this.spawnPoints[
            Math.floor(Math.random() * this.spawnPoints.length)
        ].clone();

        // Add some random offset to prevent enemies spawning exactly at the same spot
        spawnPoint.x += (Math.random() - 0.5) * 2;
        spawnPoint.z += (Math.random() - 0.5) * 2;

        // Create new enemy
        const enemy = new Enemy(this.scene, spawnPoint, this.player);
        
        // Set enemy color based on player team
        if (this.team) {
            const enemyColor = this.team === 'blue' ? 0xff0000 : 0x0000ff;
            enemy.mesh.material.color.setHex(enemyColor);
        }
        
        this.enemies.push(enemy);

        // Create spawn effect
        this.createSpawnEffect(spawnPoint);
    }

    createSpawnEffect(position) {
        const geometry = new THREE.SphereGeometry(0.5, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.8
        });

        const effect = new THREE.Mesh(geometry, material);
        effect.position.copy(position);
        effect.position.y = 1;
        this.scene.add(effect);

        // Animate the spawn effect
        const startScale = 0.1;
        const endScale = 2;
        const duration = 1000;
        const startTime = Date.now();

        const animateSpawn = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                const scale = startScale + (endScale - startScale) * progress;
                effect.scale.set(scale, scale, scale);
                effect.material.opacity = 0.8 * (1 - progress);
                requestAnimationFrame(animateSpawn);
            } else {
                this.scene.remove(effect);
            }
        };

        animateSpawn();
    }

    handleEnemyKilled(position) {
        // Update score
        this.score += 100;
        this.updateScoreDisplay();

        // Create score popup effect
        this.createScorePopup(position);

        // Remove enemy from array
        this.enemies = this.enemies.filter(enemy => enemy.health > 0);

        // Increase difficulty over time
        this.increaseDifficulty();
    }

    createScorePopup(position) {
        // Create floating score text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 100;
        canvas.height = 32;
        
        context.font = 'bold 24px Arial';
        context.fillStyle = '#00ff00';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('+100', canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(position);
        sprite.position.y += 2;
        sprite.scale.set(2, 1, 1);
        
        this.scene.add(sprite);

        // Animate the score popup
        const startY = sprite.position.y;
        const endY = startY + 2;
        const duration = 1000;
        const startTime = Date.now();

        const animatePopup = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                sprite.position.y = startY + (endY - startY) * progress;
                sprite.material.opacity = 1 - progress;
                requestAnimationFrame(animatePopup);
            } else {
                this.scene.remove(sprite);
            }
        };

        animatePopup();
    }

    updateScoreDisplay() {
        const scoreElement = document.querySelector('.score');
        if (scoreElement) {
            scoreElement.textContent = `Score: ${this.score}`;
        }
    }

    increaseDifficulty() {
        // Keep max enemies at 10
        this.maxEnemies = 10;

        // Decrease spawn interval every 500 points, but not too fast
        const newInterval = 4000 - Math.floor(this.score / 500) * 250;
        this.spawnInterval = Math.max(newInterval, 2000);

        // Update spawn timer if interval changed
        this.stopSpawning();
        this.startSpawning();
    }

    handlePlayerDeath() {
        // Start respawn countdown
        const countdownElement = document.getElementById('respawn-countdown');
        const countdownValue = countdownElement.querySelector('.countdown');
        let timeLeft = 10;

        countdownElement.classList.remove('hidden');
        
        const countdownInterval = setInterval(() => {
            timeLeft--;
            if (countdownValue) {
                countdownValue.textContent = timeLeft;
            }

            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                this.respawnPlayer();
                countdownElement.classList.add('hidden');
            }
        }, 1000);
    }

    respawnPlayer() {
        // Reset player state
        this.player.health = 100;
        this.player.ammo = 30;
        this.player.totalAmmo = 90;
        
        // Find a safe spawn point
        const spawnPoint = this.getRandomSpawnPoint();
        this.player.camera.position.copy(spawnPoint);
        this.player.camera.position.y = 1.7; // Player height
        
        // Reset player controls
        this.player.velocity.set(0, 0, 0);
        this.player.updateHUD();
    }

    getRandomSpawnPoint() {
        // Get all spawn points that are far enough from enemies
        const safeSpawnPoints = this.spawnPoints.filter(point => {
            return !this.enemies.some(enemy => 
                enemy.mesh.position.distanceTo(point) < 10
            );
        });

        // If no safe points found, use any spawn point
        const points = safeSpawnPoints.length > 0 ? safeSpawnPoints : this.spawnPoints;
        return points[Math.floor(Math.random() * points.length)].clone();
    }

    reset() {
        // Reset game state
        this.score = 0;
        this.gameOver = false;
        this.maxEnemies = 10;
        this.spawnInterval = 4000;

        // Remove all enemies
        for (const enemy of this.enemies) {
            this.scene.remove(enemy.mesh);
        }
        this.enemies = [];

        // Reset player
        this.player.health = 100;
        this.player.ammo = 30;
        this.player.totalAmmo = 90;
        this.player.updateHUD();

        // Reset camera position
        this.camera.position.set(0, 1.7, 0);
        this.camera.rotation.set(0, 0, 0);

        // Hide game over screen
        document.getElementById('game-over').classList.add('hidden');

        // Restart spawning
        this.startSpawning();
    }

    update(delta) {
        if (this.gameOver) return;

        // Update player
        this.player.update(delta);

        // Update all enemies
        for (const enemy of this.enemies) {
            enemy.update(delta);
        }

        // Update minimap
        this.updateMinimap();
    }
}