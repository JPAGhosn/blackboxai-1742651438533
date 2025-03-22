import * as THREE from 'three';

export class Player {
    constructor(camera, scene) {
        // Player properties
        this.camera = camera;
        this.scene = scene;
        this.moveSpeed = 0.3;
        this.health = 100;
        this.jumpForce = 8;
        this.isReloading = false;
        this.canShoot = true;
        this.isAiming = false;
        this.defaultFOV = 75;
        this.team = null; // 'red' or 'blue'

        // Sound effects
        this.sounds = {
            rifle: {
                shoot: new Audio('/sounds/rifle_shot.mp3'),
                reload: new Audio('/sounds/rifle_reload.mp3'),
                empty: new Audio('/sounds/gun_empty.mp3')
            },
            sniper: {
                shoot: new Audio('/sounds/sniper_shot.mp3'),
                reload: new Audio('/sounds/sniper_reload.mp3'),
                empty: new Audio('/sounds/gun_empty.mp3')
            },
            hit: new Audio('/sounds/hit_marker.mp3'),
            jump: new Audio('/sounds/jump.mp3'),
            land: new Audio('/sounds/land.mp3')
        };

        // Configure sounds
        Object.values(this.sounds).forEach(sound => {
            if (sound instanceof Audio) {
                sound.volume = 0.3;
            } else {
                Object.values(sound).forEach(s => s.volume = 0.3);
            }
        });
        
        // Weapon system
        this.currentWeapon = 'rifle';
        this.weapons = {
            rifle: {
                damage: 25,
                fireRate: 100,
                range: 50,
                ammo: 30,
                totalAmmo: 90,
                reloadTime: 2000,
                aimingFOV: 45
            },
            sniper: {
                damage: 100,
                fireRate: 1000,
                range: 100,
                ammo: 5,
                totalAmmo: 20,
                reloadTime: 3000,
                aimingFOV: 30
            }
        };
        
        // Initialize weapon system
        this.switchWeapon('rifle'); // This will set all weapon stats
        
        // Movement state
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.velocity = new THREE.Vector3();
        
        // Weapon properties
        this.setupWeapon();
        
        // Raycaster for shooting
        this.raycaster = new THREE.Raycaster();
        
        // Bind methods
        this.update = this.update.bind(this);
        this.shoot = this.shoot.bind(this);
        this.reload = this.reload.bind(this);
        this.setupEventListeners();
    }

    setupWeapon() {
        this.weaponSwayTime = 0;
        // Weapon model is already initialized in constructor via switchWeapon
    }

    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (document.pointerLockElement) {
                switch(event.code) {
                    case 'KeyW':
                        this.moveForward = true;
                        break;
                    case 'KeyS':
                        this.moveBackward = true;
                        break;
                    case 'KeyA':
                        this.moveLeft = true;
                        break;
                    case 'KeyD':
                        this.moveRight = true;
                        break;
                    case 'Space':
                        if (this.canJump) {
                            this.velocity.y = this.jumpForce;
                            this.canJump = false;
                        }
                        break;
                    case 'KeyR':
                        this.reload();
                        break;
                    case 'Digit1':
                        this.switchWeapon('rifle');
                        break;
                    case 'Digit2':
                        this.switchWeapon('sniper');
                        break;
                }
            }
        });

        document.addEventListener('keyup', (event) => {
            switch(event.code) {
                case 'KeyW':
                    this.moveForward = false;
                    break;
                case 'KeyS':
                    this.moveBackward = false;
                    break;
                case 'KeyA':
                    this.moveLeft = false;
                    break;
                case 'KeyD':
                    this.moveRight = false;
                    break;
            }
        });

        // Mouse events for shooting and aiming
        document.addEventListener('mousedown', (event) => {
            if (document.pointerLockElement) {
                if (event.button === 0) { // Left click
                    this.shoot();
                } else if (event.button === 2) { // Right click
                    this.startAiming();
                }
            }
        });

        document.addEventListener('mouseup', (event) => {
            if (event.button === 2) { // Right click release
                this.stopAiming();
            }
        });

        // Prevent context menu on right click
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });

        // Grenade throwing
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyG' && document.pointerLockElement) {
                this.throwGrenade();
            }
        });

        // Update HUD
        this.updateHUD();
    }

    shoot() {
        if (!this.canShoot || this.isReloading) return;
        
        if (this.ammo <= 0) {
            // Play empty gun sound
            this.sounds[this.currentWeapon].empty.currentTime = 0;
            this.sounds[this.currentWeapon].empty.play();
            return;
        }

        // Shooting logic
        this.canShoot = false;
        this.ammo--;

        // Add shooting animation to crosshair
        const crosshair = document.querySelector('.crosshair');
        crosshair.classList.add('shooting');
        setTimeout(() => {
            crosshair.classList.remove('shooting');
        }, 50);

        // Create muzzle flash
        this.createMuzzleFlash();

        // Get shooting direction from camera with spread
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        
        // Add weapon-specific spread
        if (!this.isAiming) {
            const spread = this.currentWeapon === 'sniper' ? 0.1 : 0.05; // More spread for sniper when not aiming
            direction.x += (Math.random() - 0.5) * spread;
            direction.y += (Math.random() - 0.5) * spread;
            direction.z += (Math.random() - 0.5) * spread;
            direction.normalize();
        }
        
        // Create bullet starting position
        const bulletStart = this.camera.position.clone();
        bulletStart.y -= 0.1;
        
        // Create and animate bullet with weapon-specific properties
        const bulletColor = this.currentWeapon === 'sniper' ? 0xff0000 : 0xffff00;
        const bulletSize = this.currentWeapon === 'sniper' ? 0.03 : 0.02;
        this.createBullet(bulletStart, direction, bulletColor, bulletSize);

        // Raycasting for hit detection
        this.raycaster.setFromCamera(new THREE.Vector2(), this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children);

        if (intersects.length > 0 && intersects[0].distance <= this.range) {
            this.createHitEffect(intersects[0].point);

            const hitObject = intersects[0].object;
            if (hitObject.isEnemy) {
                const enemyInstance = hitObject.enemyInstance;
                // Only damage enemies of the opposite team
                if (enemyInstance.team !== this.team) {
                    // Apply weapon-specific damage
                    const damage = this.currentWeapon === 'sniper' && this.isAiming ? 
                        this.damage * 1.5 : // Bonus damage for scoped sniper shots
                        this.damage;
                    enemyInstance.takeDamage(damage);
                    // Create hit effect with enemy hit feedback
                    this.createHitEffect(intersects[0].point, true);
                }
            } else {
                // Hit environment
                this.createHitEffect(intersects[0].point, false);
            }
        }

        // Add weapon-specific recoil
        if (this.currentWeapon === 'sniper') {
            this.camera.rotation.x -= 0.05; // More recoil for sniper
        } else {
            this.camera.rotation.x -= 0.02;
        }

        // Update HUD
        this.updateHUD();

        // Reset shooting cooldown
        setTimeout(() => {
            this.canShoot = true;
        }, this.shootingCooldown);

        // Auto-reload when empty
        if (this.ammo === 0 && this.totalAmmo > 0) {
            this.reload();
        }
    }

    startAiming() {
        this.isAiming = true;
        
        // Update crosshair
        const crosshair = document.querySelector('.crosshair');
        crosshair.classList.add('aiming');
        
        // Show scope overlay for sniper
        if (this.currentWeapon === 'sniper') {
            const scopeOverlay = document.querySelector('.scope-overlay');
            scopeOverlay.classList.add('visible');
        }
        
        // Smooth transition to aiming FOV
        const startFOV = this.camera.fov;
        const targetFOV = this.currentWeapon === 'sniper' ? 30 : 45; // Tighter zoom for sniper
        const duration = 200;
        const startTime = Date.now();

        const animateAim = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            this.camera.fov = startFOV + (targetFOV - startFOV) * progress;
            this.camera.updateProjectionMatrix();

            if (progress < 1) {
                requestAnimationFrame(animateAim);
            }
        };

        animateAim();
        
        // Reduce movement speed while aiming
        this.moveSpeed *= 0.5;
    }

    stopAiming() {
        this.isAiming = false;
        
        // Update crosshair
        const crosshair = document.querySelector('.crosshair');
        crosshair.classList.remove('aiming');
        
        // Hide scope overlay
        const scopeOverlay = document.querySelector('.scope-overlay');
        scopeOverlay.classList.remove('visible');
        
        // Smooth transition back to default FOV
        const startFOV = this.camera.fov;
        const targetFOV = this.defaultFOV;
        const duration = 200;
        const startTime = Date.now();

        const animateAim = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            this.camera.fov = startFOV + (targetFOV - startFOV) * progress;
            this.camera.updateProjectionMatrix();

            if (progress < 1) {
                requestAnimationFrame(animateAim);
            }
        };

        animateAim();
        
        // Restore normal movement speed
        this.moveSpeed *= 2;
    }

    throwGrenade() {
        const grenadeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const grenadeMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const grenade = new THREE.Mesh(grenadeGeometry, grenadeMaterial);
        
        // Set initial position
        grenade.position.copy(this.camera.position);
        
        // Get throwing direction from camera
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        
        // Add upward arc
        direction.y += 0.3;
        direction.normalize();
        
        // Initial velocity
        const velocity = direction.multiplyScalar(15);
        const gravity = new THREE.Vector3(0, -9.8, 0);
        
        this.scene.add(grenade);
        
        // Animate grenade
        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000; // Convert to seconds
            
            // Apply gravity
            velocity.add(gravity.clone().multiplyScalar(elapsed * 0.016)); // 0.016 is roughly 1/60
            grenade.position.add(velocity.clone().multiplyScalar(0.016));
            
            // Check for ground collision
            if (grenade.position.y <= 0.1) {
                this.createExplosion(grenade.position.clone());
                this.scene.remove(grenade);
                return;
            }
            
            // Check for wall collisions
            if (this.checkWallCollision(grenade.position, 0.1)) {
                this.createExplosion(grenade.position.clone());
                this.scene.remove(grenade);
                return;
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    createExplosion(position) {
        // Create explosion effect
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff3300,
            transparent: true,
            opacity: 0.8
        });
        
        const explosion = new THREE.Mesh(geometry, material);
        explosion.position.copy(position);
        this.scene.add(explosion);
        
        // Expand and fade out
        const startScale = 1;
        const endScale = 5;
        const duration = 500;
        const startTime = Date.now();
        
        const animateExplosion = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress < 1) {
                const scale = startScale + (endScale - startScale) * progress;
                explosion.scale.set(scale, scale, scale);
                explosion.material.opacity = 0.8 * (1 - progress);
                
                // Damage nearby enemies
                this.damageNearbyEnemies(position, scale * 2);
                
                requestAnimationFrame(animateExplosion);
            } else {
                this.scene.remove(explosion);
            }
        };
        
        animateExplosion();
    }

    damageNearbyEnemies(position, radius) {
        const enemies = this.scene.children.filter(obj => obj.isEnemy);
        enemies.forEach(enemy => {
            const distance = enemy.position.distanceTo(position);
            if (distance <= radius) {
                const damage = Math.floor(100 * (1 - distance / radius));
                enemy.enemyInstance.takeDamage(damage);
            }
        });
    }

    createBullet(startPosition, direction, bulletColor = 0xffff00, bulletSize = 0.02) {
        // Create bullet group
        const bulletGroup = new THREE.Group();
        this.scene.add(bulletGroup);
        
        // Create bullet with weapon-specific properties
        const bulletGeometry = new THREE.SphereGeometry(bulletSize, 8, 8);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: bulletColor });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        bulletGroup.add(bullet);
        
        // Create trajectory line
        const maxTrajectoryPoints = 50;
        const points = [];
        const trajectoryDir = direction.clone();
        let currentPos = startPosition.clone();
        
        // Calculate trajectory points
        for (let i = 0; i < maxTrajectoryPoints; i++) {
            points.push(currentPos.clone());
            currentPos.add(trajectoryDir.clone().multiplyScalar(0.5));
            
            // Check for wall collision for trajectory
            if (this.checkWallCollision(currentPos, 0.1)) {
                break;
            }
        }
        
        const trajectoryGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const trajectoryMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 0.3
        });
        const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
        bulletGroup.add(trajectoryLine);
        
        // Set initial position
        bullet.position.copy(startPosition);
        
        // Bullet properties
        const speed = 2.0;
        const maxDistance = 100;
        const startPos = startPosition.clone();
        
        // Animate bullet and trajectory
        const animateBullet = () => {
            if (!bullet || !bulletGroup.parent) return;
            
            // Move bullet
            bullet.position.add(direction.clone().multiplyScalar(speed));
            
            // Fade out trajectory
            trajectoryLine.material.opacity = Math.max(0, trajectoryLine.material.opacity - 0.05);
            
            // Check distance traveled
            if (bullet.position.distanceTo(startPos) > maxDistance) {
                this.scene.remove(bulletGroup);
                return;
            }
            
            // Check for wall collisions
            if (this.checkWallCollision(bullet.position, 0.1)) {
                this.scene.remove(bulletGroup);
                return;
            }
            
            requestAnimationFrame(animateBullet);
        };
        
        animateBullet();
    }

    switchWeapon(weaponType) {
        if (this.currentWeapon === weaponType || this.isReloading) return;
        
        // Remove current weapon model
        if (this.weaponModel) {
            this.camera.remove(this.weaponModel);
        }
        
        this.currentWeapon = weaponType;
        const stats = this.weapons[weaponType];
        
        // Update weapon stats
        this.damage = stats.damage;
        this.shootingCooldown = stats.fireRate;
        this.range = stats.range;
        this.ammo = stats.ammo;
        this.totalAmmo = stats.totalAmmo;
        this.aimingFOV = stats.aimingFOV;
        
        // Stop aiming when switching weapons
        if (this.isAiming) {
            this.stopAiming();
        }
        
        // Create new weapon model
        this.setupWeaponModel(weaponType);
        
        // Update HUD
        this.updateHUD();
    }

    setupWeaponModel(weaponType) {
        const gunBody = new THREE.Group();
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a2a,
            roughness: 0.7,
            metalness: 0.5
        });

        if (weaponType === 'rifle') {
            // Rifle model
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.15, 0.6),
                bodyMaterial
            );
            const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8),
                bodyMaterial
            );
            barrel.rotation.z = Math.PI / 2;
            barrel.position.z = -0.3;
            barrel.position.y = 0.02;

            gunBody.add(body);
            gunBody.add(barrel);
        } else if (weaponType === 'sniper') {
            // Sniper model
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.15, 0.8),
                bodyMaterial
            );
            const scope = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8),
                bodyMaterial
            );
            scope.position.y = 0.08;
            scope.position.z = -0.2;

            gunBody.add(body);
            gunBody.add(scope);
        }

        // Add muzzle flash light
        this.muzzleFlash = new THREE.PointLight(0xffaa00, 0, 3);
        this.muzzleFlash.position.set(0, 0, -0.5);
        gunBody.add(this.muzzleFlash);

        // Position the weapon model
        gunBody.position.set(0.25, -0.25, -0.35);
        gunBody.rotation.y = Math.PI / 60;

        // Store reference and add to camera
        this.weaponModel = gunBody;
        this.camera.add(gunBody);

        // Store initial position for weapon sway
        this.initialWeaponPosition = gunBody.position.clone();
    }

    reload() {
        if (this.isReloading || this.totalAmmo <= 0) return;

        const weaponStats = this.weapons[this.currentWeapon];
        if (this.ammo >= weaponStats.ammo) return;

        this.isReloading = true;
        
        // Reload animation and logic
        setTimeout(() => {
            const ammoNeeded = weaponStats.ammo - this.ammo;
            const ammoAvailable = Math.min(this.totalAmmo, ammoNeeded);
            
            this.ammo += ammoAvailable;
            this.totalAmmo -= ammoAvailable;
            this.isReloading = false;
            
            // Update HUD
            this.updateHUD();
        }, weaponStats.reloadTime);
    }

    createMuzzleFlash() {
        if (!this.weaponModel || !this.muzzleFlash) return;

        // Weapon-specific muzzle flash properties
        const flashIntensity = this.currentWeapon === 'sniper' ? 3 : 2;
        const flashSize = this.currentWeapon === 'sniper' ? 0.3 : 0.2;
        const flashDuration = this.currentWeapon === 'sniper' ? 100 : 50;
        const recoilAmount = this.currentWeapon === 'sniper' ? 0.04 : 0.02;

        // Enhance muzzle flash effect
        this.muzzleFlash.intensity = flashIntensity;
        this.weaponModel.position.z += recoilAmount;

        // Create a flash sprite
        const flashGeometry = new THREE.PlaneGeometry(flashSize, flashSize);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: this.currentWeapon === 'sniper' ? 0xff3300 : 0xffaa00,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const flashSprite = new THREE.Mesh(flashGeometry, flashMaterial);
        flashSprite.position.set(0.25, -0.2, -0.8);
        this.camera.add(flashSprite);

        // Animate the flash with weapon-specific effects
        let startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / flashDuration;

            if (progress < 1) {
                flashSprite.scale.set(1 - progress, 1 - progress, 1);
                flashSprite.material.opacity = 0.8 * (1 - progress);
                this.muzzleFlash.intensity = flashIntensity * (1 - progress);
                requestAnimationFrame(animate);
            } else {
                this.muzzleFlash.intensity = 0;
                this.camera.remove(flashSprite);
                this.weaponModel.position.z = this.initialWeaponPosition.z;
            }
        };
        animate();
    }

    // Add weapon sway animation
    updateWeaponSway(delta) {
        if (!this.weaponModel) return;

        this.weaponSwayTime += delta * 2;
        
        // Calculate sway based on movement
        const swayX = Math.sin(this.weaponSwayTime) * 0.002;
        const swayY = Math.cos(this.weaponSwayTime * 0.5) * 0.002;

        this.weaponModel.position.x = this.initialWeaponPosition.x + swayX;
        this.weaponModel.position.y = this.initialWeaponPosition.y + swayY;
    }

    createHitEffect(position, isEnemyHit = false) {
        // Create weapon-specific hit effect
        const size = this.currentWeapon === 'sniper' ? 0.2 : 0.1;
        const duration = this.currentWeapon === 'sniper' ? 200 : 100;
        
        // Color based on hit type and team
        let color;
        if (isEnemyHit) {
            // Red hit marker for enemy hits
            color = 0xff0000;
            // Create floating damage number
            this.createDamageNumber(position, this.damage);
        } else {
            // Yellow/orange for environment hits
            color = this.currentWeapon === 'sniper' ? 0xff3300 : 0xffaa00;
        }

        // Create hit marker effect
        const hitMarker = new THREE.Group();
        
        // Center sphere
        const centerSphere = new THREE.Mesh(
            new THREE.SphereGeometry(size, 8, 8),
            new THREE.MeshBasicMaterial({ 
                color: color,
                transparent: true,
                opacity: 0.8
            })
        );
        hitMarker.add(centerSphere);

        // Add cross lines for enemy hits
        if (isEnemyHit) {
            const lineSize = size * 2;
            const lines = [
                new THREE.Vector3(-lineSize, 0, 0),
                new THREE.Vector3(lineSize, 0, 0),
                new THREE.Vector3(0, -lineSize, 0),
                new THREE.Vector3(0, lineSize, 0)
            ];

            const lineGeometry = new THREE.BufferGeometry().setFromPoints(lines);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: color,
                transparent: true,
                opacity: 0.8
            });
            const crossLines = new THREE.LineSegments(lineGeometry, lineMaterial);
            hitMarker.add(crossLines);
        }

        hitMarker.position.copy(position);
        this.scene.add(hitMarker);

        // Animate hit effect
        const startScale = 1;
        const endScale = this.currentWeapon === 'sniper' ? 0.1 : 0.5;
        const startTime = Date.now();

        const animateHit = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                const scale = startScale + (endScale - startScale) * progress;
                hitMarker.scale.set(scale, scale, scale);
                hitMarker.children.forEach(child => {
                    if (child.material) {
                        child.material.opacity = 0.8 * (1 - progress);
                    }
                });
                requestAnimationFrame(animateHit);
            } else {
                this.scene.remove(hitMarker);
            }
        };

        animateHit();
    }

    createDamageNumber(position, damage) {
        // Create damage number sprite
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 64;

        // Draw damage number
        context.font = 'bold 48px Arial';
        context.fillStyle = '#ff0000';
        context.strokeStyle = '#ffffff';
        context.lineWidth = 4;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.strokeText(damage.toString(), canvas.width/2, canvas.height/2);
        context.fillText(damage.toString(), canvas.width/2, canvas.height/2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 1
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        // Position slightly above hit point
        const spritePos = position.clone();
        spritePos.y += 0.5;
        sprite.position.copy(spritePos);
        sprite.scale.set(0.5, 0.25, 1);
        
        this.scene.add(sprite);

        // Animate damage number
        const startY = spritePos.y;
        const startTime = Date.now();
        const duration = 1000;

        const animateDamageNumber = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                sprite.position.y = startY + progress * 0.5; // Float upward
                sprite.material.opacity = 1 - progress;
                requestAnimationFrame(animateDamageNumber);
            } else {
                this.scene.remove(sprite);
            }
        };

        animateDamageNumber();
    }

    updateHUD() {
        // Update health display
        const healthElement = document.querySelector('.health-value');
        if (healthElement) {
            healthElement.textContent = this.health;
        }

        // Update ammo display
        const ammoCurrentElement = document.querySelector('.ammo-current');
        const ammoTotalElement = document.querySelector('.ammo-total');
        if (ammoCurrentElement && ammoTotalElement) {
            ammoCurrentElement.textContent = this.ammo;
            ammoTotalElement.textContent = this.totalAmmo;
        }
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.updateHUD();

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        // Handle player death
        document.dispatchEvent(new CustomEvent('playerDeath'));
    }

    checkWallCollision(position, radius) {
        // Create raycasts in different directions to check for walls
        const directions = [
            new THREE.Vector3(1, 0, 0),   // right
            new THREE.Vector3(-1, 0, 0),  // left
            new THREE.Vector3(0, 0, 1),   // forward
            new THREE.Vector3(0, 0, -1),  // backward
            new THREE.Vector3(1, 0, 1).normalize(),   // diagonal
            new THREE.Vector3(-1, 0, 1).normalize(),  // diagonal
            new THREE.Vector3(1, 0, -1).normalize(),  // diagonal
            new THREE.Vector3(-1, 0, -1).normalize()  // diagonal
        ];

        // Adjust raycast origin to be at player's height
        position.y = 1.7; // Player eye level

        for (const direction of directions) {
            // Create a raycaster
            const raycaster = new THREE.Raycaster(position, direction, 0, radius);
            
            // Get all intersections with scene objects
            const intersects = raycaster.intersectObjects(this.scene.children, true);
            
            // Filter out non-wall objects
            const wallHits = intersects.filter(hit => {
                const obj = hit.object;
                // Check if it's a wall (box geometry) and not player's weapon or enemy
                return obj.geometry instanceof THREE.BoxGeometry && 
                       !obj.isEnemy && 
                       !obj.isWeapon;
            });

            if (wallHits.length > 0 && wallHits[0].distance < radius) {
                return true; // Collision detected
            }
        }
        
        return false; // No collision
    }

    update(delta) {
        // Update velocity based on movement state
        const direction = new THREE.Vector3();
        
        if (this.moveForward) direction.z -= 1;
        if (this.moveBackward) direction.z += 1;
        if (this.moveLeft) direction.x -= 1;
        if (this.moveRight) direction.x += 1;

        direction.normalize();

        // Get camera's forward and right vectors (fixed for proper direction)
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        forward.multiplyScalar(-1); // Invert forward direction to fix W/S movement

        const right = new THREE.Vector3();
        right.setFromMatrixColumn(this.camera.matrix, 0);
        right.y = 0;
        right.normalize();

        // Calculate movement vector based on camera direction
        const movement = new THREE.Vector3();
        
        if (direction.z !== 0) {
            movement.add(forward.multiplyScalar(direction.z));
        }
        if (direction.x !== 0) {
            movement.add(right.multiplyScalar(direction.x));
        }

        // Apply movement with smooth acceleration/deceleration
        const acceleration = 0.15;
        const maxSpeed = this.moveSpeed;
        
        // Gradually change velocity
        this.velocity.x += movement.x * acceleration;
        this.velocity.z += movement.z * acceleration;
        
        // Apply friction when not moving
        if (direction.length() === 0) {
            this.velocity.x *= 0.8;
            this.velocity.z *= 0.8;
        }
        
        // Limit maximum speed
        const horizontalVelocity = new THREE.Vector2(this.velocity.x, this.velocity.z);
        if (horizontalVelocity.length() > maxSpeed) {
            horizontalVelocity.normalize().multiplyScalar(maxSpeed);
            this.velocity.x = horizontalVelocity.x;
            this.velocity.z = horizontalVelocity.y;
        }

        // Store current position before movement
        const previousPosition = this.camera.position.clone();

        // Try to apply movement
        const newPosition = previousPosition.clone();
        newPosition.x += this.velocity.x;
        newPosition.z += this.velocity.z;

        // Check for wall collisions
        const playerRadius = 0.5; // Collision radius
        const wallCollision = this.checkWallCollision(newPosition, playerRadius);

        if (!wallCollision) {
            // No collision, apply movement
            this.camera.position.copy(newPosition);
        } else {
            // Collision detected, stop movement in that direction
            this.velocity.x = 0;
            this.velocity.z = 0;
        }

        // Simple collision detection with ground
        if (this.camera.position.y <= 1.7) {
            this.velocity.y = 0;
            this.camera.position.y = 1.7;
            this.canJump = true;
        }

        // Apply gravity
        this.velocity.y -= 20 * delta; // Increased gravity for better feel
        this.camera.position.y += this.velocity.y * delta;

        // Update weapon sway
        this.updateWeaponSway(delta);
    }
}