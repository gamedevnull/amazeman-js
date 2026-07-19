import {Input} from "./input.js";
import {GameLevel, TileType} from "./gameLevel.js";
import {GameObjectType, DoorKeyType} from "./commons.js";
import {Animation, RenderableSprite} from "./video.js";
import {TextureType, GameConfig} from "./commons.js";
import {SoundId, SoundManager} from "./audio.js";

export class GameObject {
    static nextUid: number = 1;
    uid: number;
    objectType: string;
    isActive: boolean = true;

    posX: number = 0;
    posY: number = 0;

    scale: number = 1;

    baseColor: string = "#ffffff";

    sprite: RenderableSprite | null = null;

    constructor(objectType: string) {
        this.uid = GameObject.nextUid++;
        this.objectType = objectType;
    }

    get position(): { x: number, y: number } {
        return {x: this.posX, y: this.posY};
    }

    get size(): { width: number, height: number } {
        return { width: this.scale, height: this.scale };
    }

    update(deltaTime: number) {}

}

export class PlayerInventory {
    private collectedKeys: Set<number> = new Set();
    private collectedCoins: number = 0;
    private collectedCoinsOnLevel: number = 0;

    collectKey(keyType: number): void {
        this.collectedKeys.add(keyType);
    }

    useKey(keyType: number): boolean {
        return this.collectedKeys.delete(keyType);
    }

    getCollectedKeys(): Set<number> {
        return this.collectedKeys;
    }

    hasKey(keyType: number): boolean {
        return this.collectedKeys.has(keyType);
    }

    collectCoin(): void {
        this.collectedCoins++;
        this.collectedCoinsOnLevel++;
    }

    getCoins(): number {
        return this.collectedCoins;
    }

    getCoinsCollectedOnLevel(): number {
        return this.collectedCoinsOnLevel;
    }

    resetCoinsCollectedOnLevel(): void {
        this.collectedCoinsOnLevel = 0;
    }

    dropAllKeys(): void {
        this.collectedKeys.clear();
    }

    reset(): void {
        this.collectedKeys.clear();
        this.collectedCoins = 0;
        this.collectedCoinsOnLevel = 0;
    }
}

export class Player extends GameObject {

    angle: number;
    scale: number;
    walkSpeed: number;
    rotateSpeed: number;
    stepTime: number = 0;
    totalTime: number = 0;

    soundManager: SoundManager | null = null;
    inventory: PlayerInventory;

    constructor(posX: number = 0, posY: number = 0, angle: number = 0) {
        super(GameObjectType.Player);
        this.angle = angle;
        this.scale = 0.5;
        this.walkSpeed = GameConfig.player.walkSpeed;
        this.rotateSpeed = GameConfig.player.rotateSpeed;
        this.posX = posX;
        this.posY = posY;
        this.inventory = new PlayerInventory();
    }

    getInventory(): PlayerInventory {
        return this.inventory;
    }

    resetState() {
        this.stepTime = 0;
        this.getInventory().reset();
        this.totalTime = 0;
    }

    collectKey(key: DoorKey) {
        this.inventory.collectKey(key.keyType);
    }

    useKey(keyType: number) {
        this.inventory.useKey(keyType);
    }

    collectCoin() {
        this.inventory.collectCoin();
    }

    dropKeys() {
        this.inventory.dropAllKeys();
    }

    hasKey(keyType: number): boolean {
        return this.inventory.hasKey(keyType);
    }

    setPosition(x: number, y: number) {
        this.posX = x;
        this.posY = y;
    }

    update(deltaTime: number) {
    }

    updateMovement(deltaTime: number, input: Input, map: GameLevel) {
        this.move(deltaTime, input, map);
    }

    setSoundManager(soundManager: SoundManager) {
        this.soundManager = soundManager;
    }

    playSound(id: any)
    {
        if (!this.soundManager) return;
        let soundEffect = this.soundManager.get(id);
        if (soundEffect && !soundEffect.isPlaying()) {
            soundEffect.play();
        }
    }

    move(deltaTime: number, input: Input, map: GameLevel)
    {
        let sin_angle = Math.sin(this.angle);
        let cos_angle = Math.cos(this.angle);

        let dx = 0;
        let dy = 0;

        let speed = this.walkSpeed * deltaTime;

        let speed_sin = speed * sin_angle;
        let speed_cos = speed * cos_angle;

        if (input.keys.ArrowUp) {
            dx += speed_cos;
            dy += speed_sin;
        }

        if (input.keys.ArrowDown) {
            dx -= speed_cos;
            dy -= speed_sin;
        }

        if (input.keys.ArrowUp || input.keys.ArrowDown) {
            this.stepTime += deltaTime * this.walkSpeed;
        } else {
            this.stepTime = 0;
        }

        let moved = false;
        let prevX = this.posX;
        let prevY = this.posY;

        if (!this.isMoveBlocked(dx, 0, map)) {
            this.posX += dx;
        }

        if (!this.isMoveBlocked(0, dy, map)) {
            this.posY += dy;
        }

        if (input.keys.ArrowLeft) {
            this.angle -= this.rotateSpeed * deltaTime;
        }
        if (input.keys.ArrowRight) {
            this.angle += this.rotateSpeed * deltaTime;
        }

        this.angle = this.angle % (Math.PI * 2); // keep angle in range 0 to 2*PI

        if (this.posX !== prevX || this.posY !== prevY) {
            moved = true;
        }

        if (moved) {
            this.playSound(SoundId.StepStone);
        }
    }

    isMoveBlocked(dx: number, dy: number, map: GameLevel): boolean {

        const radius = this.scale / 2;

        if (dx !== 0) {
            const nextX = this.posX + dx;
            return !map.canMoveTo(nextX, this.posY, radius);
        }

        if (dy !== 0) {
            const nextY = this.posY + dy;
            return !map.canMoveTo(this.posX, nextY, radius);
        }

        return false;
    }

}

export class GoldCoin extends GameObject {

    animation: Animation;

    constructor(posX: number = 0, posY: number = 0) {
        super(GameObjectType.Coin);
        this.posX = posX;
        this.posY = posY;
        this.scale = 0.3;
        this.baseColor = "#ffff00";

        this.sprite = new RenderableSprite(
            this.posX, this.posY,
            16,
            16,
            TextureType.Coin,
            0,
            0,
            0.3,
            1
        );

        this.animation = new Animation(16, 16, 0, 0, 12, 70, 1);
        this.animation.start();
    }

    update(deltaTime: number) {
        if (this.sprite) {
            this.animation.update(deltaTime);
            this.sprite.animate(this.animation);
        }
    }

}

export class DoorKey extends GameObject {

    keyType: number;
    sprite: RenderableSprite;

    constructor(posX: number = 0, posY: number = 0, tileValue: number) {
        super(GameObjectType.Key);
        this.posX = posX;
        this.posY = posY;
        this.scale = 0.4;

        let tex_x = 0;
        let tex_y = 0;

        if (tileValue === TileType.KeyRed) {
            this.keyType = DoorKeyType.Red;
            this.baseColor = "#aa0000";
            tex_x = 0;
            tex_y = 32;
        } else if (tileValue === TileType.KeyGreen) {
            this.keyType = DoorKeyType.Green;
            this.baseColor = "#00aa00";
            tex_x = 32;
            tex_y = 32;
        } else if (tileValue === TileType.KeyBlue) {
            this.keyType = DoorKeyType.Blue;
            this.baseColor = "#0000ea";
            tex_x = 32 * 2;
            tex_y = 32;
        } else {
            this.keyType = 0;
        }

        this.sprite = new RenderableSprite(
            posX, posY,
            32,
            32,
            TextureType.WallsAndObjects,
            tex_x,
            tex_y,
            0.8,
            0.2
        );

    }

}

export class CatStatue extends GameObject {

    sprite: RenderableSprite;

    constructor(posX: number = 0, posY: number = 0) {
        super(GameObjectType.CatStatue);
        this.posX = posX;
        this.posY = posY;
        this.scale = 0.4;

        let tex_x = 32 * 2;
        let tex_y = 32 * 3;

        this.sprite = new RenderableSprite(
            posX, posY,
            32,
            32,
            TextureType.WallsAndObjects,
            tex_x,
            tex_y,
            0.9,
            0.1
        );

        this.sprite.facePlayer = false;
    }

}