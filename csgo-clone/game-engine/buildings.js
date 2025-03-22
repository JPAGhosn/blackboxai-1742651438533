import * as THREE from 'three';

export function createBuildings(scene) {
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.7,
        metalness: 0.3
    });

    // Create buildings with roofs
    const createBuilding = (width, height, depth, position) => {
        const group = new THREE.Group();
        
        // Create walls
        const wallGeometry = new THREE.BoxGeometry(width, height, depth);
        const walls = new THREE.Mesh(wallGeometry, wallMaterial);
        walls.castShadow = true;
        walls.receiveShadow = true;
        group.add(walls);

        // Create roof
        const roofGeometry = new THREE.BoxGeometry(width + 0.5, 0.5, depth + 0.5);
        const roof = new THREE.Mesh(roofGeometry, wallMaterial);
        roof.position.y = height / 2;
        roof.castShadow = true;
        roof.receiveShadow = true;
        group.add(roof);

        // Add stairs to roof
        const stairWidth = 2;
        const stairDepth = 0.5;
        const numStairs = Math.floor(height);
        
        for (let i = 0; i < numStairs; i++) {
            const stairGeometry = new THREE.BoxGeometry(stairWidth, 0.5, stairDepth);
            const stair = new THREE.Mesh(stairGeometry, wallMaterial);
            stair.position.set(
                width/2 + stairDepth/2, // Outside the building
                i * (height/numStairs),  // Gradually increasing height
                0                        // Centered on z-axis
            );
            stair.castShadow = true;
            stair.receiveShadow = true;
            group.add(stair);
        }

        group.position.copy(position);
        scene.add(group);
        return group;
    };

    // Create multiple buildings
    const buildings = [
        { width: 10, height: 8, depth: 10, pos: new THREE.Vector3(-15, 4, -15) },
        { width: 12, height: 6, depth: 8, pos: new THREE.Vector3(15, 3, -10) },
        { width: 8, height: 10, depth: 12, pos: new THREE.Vector3(-10, 5, 15) },
        { width: 15, height: 7, depth: 15, pos: new THREE.Vector3(12, 3.5, 12) }
    ];

    buildings.forEach(building => {
        createBuilding(
            building.width,
            building.height,
            building.depth,
            building.pos
        );
    });

    // Add ground-level cover
    const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
    const covers = [
        { pos: new THREE.Vector3(0, 1, 0) },
        { pos: new THREE.Vector3(-5, 1, -5) },
        { pos: new THREE.Vector3(5, 1, 5) },
        { pos: new THREE.Vector3(-5, 1, 5) },
        { pos: new THREE.Vector3(5, 1, -5) }
    ];

    covers.forEach(cover => {
        const mesh = new THREE.Mesh(boxGeometry, wallMaterial);
        mesh.position.copy(cover.pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
    });

    // Add outer boundary walls
    const createBoundaryWall = (width, height, depth, position, rotation = 0) => {
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            wallMaterial
        );
        wall.position.copy(position);
        wall.rotation.y = rotation;
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
    };

    // Boundary walls
    createBoundaryWall(100, 15, 1, new THREE.Vector3(0, 7.5, -50)); // North
    createBoundaryWall(100, 15, 1, new THREE.Vector3(0, 7.5, 50));  // South
    createBoundaryWall(100, 15, 1, new THREE.Vector3(-50, 7.5, 0), Math.PI / 2); // West
    createBoundaryWall(100, 15, 1, new THREE.Vector3(50, 7.5, 0), Math.PI / 2);  // East
}