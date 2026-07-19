import {Game} from "./game.js";
import {CatStatue, DoorKey, GameObject, GoldCoin, Player} from "./gameObjects.js";
import {GameLevel, LevelData, TileType} from "./gameLevel.js";
import {GameState, GameObjectType} from "./commons.js";
import {CollisionManager} from "./collisions.js";
import {SoundId} from "./audio.js";

export class LogicManager {
    private game: Game;
    private player: Player;
    private collisionManager: CollisionManager;

    timeLeftSeconds: number = 59;
    private timeAccumulator: number = 0;
    victory : boolean = false;

    constructor(game: Game) {
        this.game = game;
        this.player = game.player;

        this.collisionManager = new CollisionManager();

        this.registerCollisionCallbacks();
    }

    timeIsUp(deltaTime: number): boolean {
        this.timeAccumulator += deltaTime;
        if (this.timeAccumulator >= 1000) {
            this.timeAccumulator -= 1000;
            if (this.timeLeftSeconds > 0) {
                this.timeLeftSeconds--;
            }
            if (this.timeLeftSeconds <= 0) {
                this.timeLeftSeconds = 0;
                this.game.soundManager.get(SoundId.Fail)?.play();
                return true;
            }
        }
        return false;
    }

    resetTimeLeft(timeLimit: number = 59): void {
        this.timeLeftSeconds = timeLimit;
        this.timeAccumulator = 0;
    }

    checkCollisions(
    ): void {
        const objectsToCheck: GameObject[] = [this.player, ...this.game.gameObjects];
        const activeObjects = objectsToCheck.filter(obj => obj.isActive);
        this.collisionManager.checkCollisions(activeObjects);
    }

    openDoorInFrontOfPlayer(): void {
        const distance = 1;
        const doorX = this.player.posX + Math.cos(this.player.angle) * distance;
        const doorY = this.player.posY + Math.sin(this.player.angle) * distance;

        const map = this.game.levelManager.currentLevel;
        const ix = Math.floor(doorX);
        const iy = Math.floor(doorY);

        if (map?.isDoorTile(ix, iy) && map.isDoorClosed(ix, iy)) {
            const tileType = map.getTileType(ix, iy);
            const requiredKey = map.getRequiredKeyForDoor(tileType);

            if (requiredKey === TileType.Empty || this.player.hasKey(requiredKey)) {
                map.doorManager.triggerOpen(ix, iy);
                if (requiredKey !== TileType.Empty) {
                    this.player.useKey(requiredKey);
                }
                this.game.soundManager.get(SoundId.DoorOpened)?.play();
            } else {
                this.game.soundManager.get(SoundId.DoorLocked)?.play();
            }

        } else if (map?.isExitTile(ix, iy)) {
            this.game.soundManager.get(SoundId.Done)?.play();

            const levelTime = map.timeLimit - this.timeLeftSeconds;
            this.player.totalTime += levelTime;

            if (this.game.levelManager.hasNextLevel()) {
                this.game.gameState = GameState.LevelComplete;
            } else {
                this.victory = true;
                this.game.gameState = GameState.GameOver;
            }
        } else if (map?.isOpenedDoorTile(ix, iy)) {
            this.game.soundManager.get(SoundId.DoorOpened)?.play();
            if (!(Math.floor(this.player.posX) === ix && Math.floor(this.player.posY) === iy)) {
                map.doorManager.triggerClose(ix, iy);
            }
        }
    }

    registerCollisionCallbacks() {

        this.collisionManager.addCollisionCallback(GameObjectType.Player, GameObjectType.Coin, (objectA, objectB) => {
            let player: GameObject;
            let coin: GameObject;
            if (objectA.objectType === GameObjectType.Player) {
                player = objectA;
                coin = objectB;
            } else {
                player = objectB;
                coin = objectA;
            }
            coin.isActive = false;
            this.player.collectCoin();
            this.game.soundManager.get(SoundId.CoinPicked)?.play();
        });

        this.collisionManager.addCollisionCallback(GameObjectType.Player, GameObjectType.Key, (objectA, objectB) => {
            let player: GameObject;
            let key: GameObject;
            if (objectA.objectType === GameObjectType.Player) {
                player = objectA;
                key = objectB;
            } else {
                player = objectB;
                key = objectA;
            }

            if (objectB.objectType === GameObjectType.Key && objectB instanceof DoorKey) {
                this.player.collectKey(objectB);
            this.game.soundManager.get(SoundId.KeyPicked)?.play();
            }

            key.isActive = false;
        });

    }

    resetGame(): void {
        this.game.levelManager.resetToFirstLevel();
        this.game.player.resetState();
        this.game.gameObjects = [];
        this.resetTimeLeft();
        this.victory = false;
    }

    loadNextLevel(): void {
        if (!this.game.levelManager.hasNextLevel()) {
            throw new Error("loadNextLevel: no next level!");
        }
        this.game.levelManager.nextLevel();
        this.game.player.dropKeys();
        this.loadCurrentLevel();
        this.game.player.getInventory().resetCoinsCollectedOnLevel();
    }

    loadCurrentLevel(): void {
        const level = this.game.levelManager.currentLevel; // const level is still reference here!

        level.reset();
        this.game.gameObjects = [];
        this.game.player.setPosition(level.playerStartX + 0.5, level.playerStartY + 0.5);
        this.game.player.angle = 45;
        this.resetTimeLeft(level.timeLimit);

        for (let y = 0; y < level.rows; y++) {
            for (let x = 0; x < level.cols; x++) {

                // + 0.5 to center the object in the tile

                if (level.isCoinTile(x, y)) {
                    this.game.gameObjects.push(new GoldCoin(x + 0.5, y + 0.5));
                    level.coinsTotal++;
                }
                if (level.isKeyTile(x, y)) {
                    this.game.gameObjects.push(new DoorKey(x + 0.5, y + 0.5, level.mapArray[y][x]));
                }

                if (level.isCatStatueTile(x, y)) {
                    this.game.gameObjects.push(new CatStatue(x + 0.5, y + 0.5));
                }

            }
        }
    }

}

export class LevelManager {
    private levels: GameLevel[] = [];
    private currentIndex: number = 0;

    constructor() {
    }

    loadLevels(levelsData: LevelData[]): void {
        this.levels = levelsData.map(data => new GameLevel(data));
    }

    get currentLevel(): GameLevel {
        return this.levels[this.currentIndex];
    }

    get currentLevelIndex(): number {
        return this.currentIndex;
    }

    get totalLevels(): number {
        return this.levels.length;
    }

    hasNextLevel(): boolean {
        return this.currentIndex < this.levels.length - 1;
    }

    nextLevel(): boolean {
        if (this.hasNextLevel()) {
            this.currentIndex++;
            return true;
        }
        return false;
    }

    resetToFirstLevel(): void {
        this.currentIndex = 0;
    }

    isLastLevel(): boolean {
        return this.currentIndex === this.levels.length - 1;
    }

}

