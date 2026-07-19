import {GameObject} from "./gameObjects.js";

export class CollisionManager {
    private collisionCallbacks: Map<string, (objectA: GameObject, objectB: GameObject) => void>;
    private collidedPairs: Set<string>;

    constructor() {
        this.collisionCallbacks = new Map(); // callbacks defined by object types
        this.collidedPairs = new Set(); // collisions by objects instance uid
    }

    // checking unique objects instances (not classes!) each pair once
    checkCollisions(objects: GameObject[]): void {
        this.collidedPairs.clear();
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                const objectA = objects[i];
                const objectB = objects[j];
                const instancePairKey = this.getInstancePairKey(objectA.uid, objectB.uid);
                if (this.hasCollided(objectA, objectB) && !this.collidedPairs.has(instancePairKey)) {
                    this.collidedPairs.add(instancePairKey);
                    this.handleCollision(objectA, objectB);
                }
            }
        }
    }

    addCollisionCallback(idA: string, idB: string, callback: (objectA: GameObject, objectB: GameObject) => void): void {
        const key = this.getTypePairKey(idA, idB);
        this.collisionCallbacks.set(key, callback);
    }

    private hasCollided(objectA: GameObject, objectB: GameObject): boolean {
        if (!objectA.isActive || !objectB.isActive) {
            return false;
        }
        const posA = objectA.position;
        const sizeA = objectA.size;
        const posB = objectB.position;
        const sizeB = objectB.size;

        return (
            // simple AABB box test is enough
            posA.x < posB.x + sizeB.width &&
            posA.x + sizeA.width > posB.x &&
            posA.y < posB.y + sizeB.height &&
            posA.y + sizeA.height > posB.y
        );
    }

    private getInstancePairKey(uidA: number, uidB: number): string {
        return uidA < uidB ? `${uidA}:${uidB}` : `${uidB}:${uidA}`;
    }

    private getTypePairKey(idA: string, idB: string): string {
        return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
    }

    private handleCollision(objectA: GameObject, objectB: GameObject): void {
        const key = this.getTypePairKey(objectA.objectType, objectB.objectType);
        if (this.collisionCallbacks.has(key)) {
            this.collisionCallbacks.get(key)!(objectA, objectB); // BEWARE: callback has to detect which is which
        }
    }
}