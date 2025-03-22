import * as THREE from 'three';

export class Enemy {
    constructor(scene, position, player) {
        this.scene = scene;
        this.player = player;
        this.health = 100;
        this.moveSpeed = 0.05;
        this.state = 'patrol'; // patrol, chase, attack
        this.detectionRange = 20;
        this.attackRange = 10;
        this.lastAttackTime = 0;
        this.attackCooldown = 1000; // 1 second between attacks
        this.patrolPoints = [];
        this.currentPatrolIndex = 0;
        this.damage = 10;

        // Create enemy mesh
        this.createEnemyMesh(position);
        
        // Set up patrol route
        this.setupPatrolRoute();
    }

    createEnemyMesh(position) {
        // Create a skinnier enemy model
        const geometry = new THREE.BoxGeometry(0.6, 2, 0.6);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x00ff00, // Start with green color
            transparent: true,
            opacity: 1
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Add property to identify as enemy for raycasting
        this.mesh.isEnemy = true;
        
        // Store reference to this class instance
        this.mesh.enemyInstance = this;
        
        this.scene.add(this.mesh);
    }

    checkWallCollision(nextPosition) {
        const raycaster = new THREE.Raycaster(
            this.mesh.position,
            nextPosition.clone().sub(this.mesh.position).normalize(),
            0,
            0.5
        );
        
        const intersects = raycaster.intersectObjects(this.scene.children);
        return intersects.some(hit => 
            hit.object.geometry instanceof THREE.BoxGeometry && 
            !hit.object.isEnemy && 
            !hit.object.isWeapon
        );
    }

    setupPatrolRoute() {
        // Create a simple patrol route around spawn position
        const center = this.mesh.position.clone();
        const radius = 5;
        
        // Create four patrol points in a square
        this.patrolPoints = [
            new THREE.Vector3(center.x + radius, center.y, center.z + radius),
            new THREE.Vector3(center.x + radius, center.y, center.z - radius),
            new THREE.Vector3(center.x - radius, center.y, center.z - radius),
            new THREE.Vector3(center.x - radius, center.y, center.z + radius)
        ];
    }

    update(delta) {
        if (this.health <= 0) return;

        // Calculate distance to player
        const distanceToPlayer = this.mesh.position.distanceTo(this.player.camera.position);

        // Update state based on distance to player
        if (distanceToPlayer <= this.attackRange) {
            this.state = 'attack';
        } else if (distanceToPlayer <= this.detectionRange) {
            this.state = 'chase';
        } else {
            this.state = 'patrol';
        }

        // Handle behavior based on state
        switch (this.state) {
            case 'patrol':
                this.patrol(delta);
                break;
            case 'chase':
                this.chase(delta);
                break;
            case 'attack':
                this.attack();
                break;
        }

        // Update enemy rotation to face movement direction
        if (this.mesh.userData.moveDirection) {
            const angle = Math.atan2(
                this.mesh.userData.moveDirection.x,
                this.mesh.userData.moveDirection.z
            );
            this.mesh.rotation.y = angle;
        }
    }

    patrol(delta) {
        const targetPoint = this.patrolPoints[this.currentPatrolIndex];
        const distanceToTarget = this.mesh.position.distanceTo(targetPoint);

        if (distanceToTarget < 0.5) {
            // Move to next patrol point
            this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
        } else {
            // Move towards current patrol point
            const direction = targetPoint.clone().sub(this.mesh.position).normalize();
            const nextPosition = this.mesh.position.clone().add(direction.multiplyScalar(this.moveSpeed));
            
            if (!this.checkWallCollision(nextPosition)) {
                this.mesh.position.copy(nextPosition);
                this.mesh.userData.moveDirection = direction;
            }
        }
    }

    chase(delta) {
        // Calculate direction to player
        const direction = new THREE.Vector3()
            .subVectors(this.player.camera.position, this.mesh.position)
            .normalize();

        // Check next position for wall collision
        const nextPosition = this.mesh.position.clone().add(direction.multiplyScalar(this.moveSpeed));
        
        if (!this.checkWallCollision(nextPosition)) {
            this.mesh.position.copy(nextPosition);
            this.mesh.userData.moveDirection = direction;
        }
    }

    attack() {
        const currentTime = Date.now();
        
        // Check if enough time has passed since last attack
        if (currentTime - this.lastAttackTime >= this.attackCooldown) {
            this.lastAttackTime = currentTime;
            
            // Deal damage to player
            this.player.takeDamage(this.damage);
            
            // Create bullet effect
            this.createBullet(this.player.camera.position.clone());
        }
    }

    createBullet(target) {
        // Create bullet geometry
        const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        // Set bullet starting position
        bullet.position.copy(this.mesh.position);
        bullet.position.y += 1; // Shoot from middle height
        
        // Calculate direction to target
        const direction = target.clone().sub(bullet.position).normalize();
        
        this.scene.add(bullet);
        
        // Animate bullet
        const speed = 0.5;
        const maxDistance = 50;
        const startPos = bullet.position.clone();
        
        const animateBullet = () => {
            if (!bullet) return;
            
            // Move bullet
            bullet.position.add(direction.multiplyScalar(speed));
            
            // Check distance traveled
            if (bullet.position.distanceTo(startPos) > maxDistance) {
                this.scene.remove(bullet);
                return;
            }
            
            // Check for wall collisions
            if (this.checkWallCollision(bullet.position)) {
                this.scene.remove(bullet);
                return;
            }
            
            requestAnimationFrame(animateBullet);
        };
        
        animateBullet();
    }

    takeDamage(amount) {
        this.health -= amount;
        
        // Create hit effect
        this.createHitEffect();

        if (this.health <= 0) {
            this.die();
        }
    }

    createHitEffect() {
        // Change color briefly to indicate damage
        const originalColor = this.mesh.material.color.clone();
        this.mesh.material.color.set(0xffffff);

        setTimeout(() => {
            this.mesh.material.color.copy(originalColor);
        }, 100);
    }

    die() {
        // Simple fade out effect
        this.mesh.material.transparent = true;
        
        // Change color to black instantly
        this.mesh.material.color.set(0x000000);
        
        // Use GSAP-like simple animation
        const duration = 500;
        const startTime = Date.now();
        const fadeOut = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            this.mesh.material.opacity = 1 - progress;
            
            if (progress < 1) {
                requestAnimationFrame(fadeOut);
            } else {
                this.scene.remove(this.mesh);
            }
        };
        
        fadeOut();

        // Dispatch event for scoring
        document.dispatchEvent(new CustomEvent('enemyKilled', {
            detail: { position: this.mesh.position.clone() }
        }));
    }
}