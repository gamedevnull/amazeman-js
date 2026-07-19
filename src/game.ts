import {Renderer} from "./renderer.js";
import {Input} from "./input.js";
import {GameState} from "./commons.js";
import {LevelData} from "./gameLevel.js";
import {GameObject, Player} from "./gameObjects.js";
import {LogicManager, LevelManager} from "./gameLogic.js";
import {Raycaster} from "./raycaster.js";
import {SoundId, SoundManager} from './audio.js';

export class Game {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;

    lastTime: number;
    boundLoop: (timestamp: number) => void;

    fps: number = 0;
    frameCount: number = 0;
    fpsTime: number = 0;

    renderer: Renderer;
    input: Input;

    player: Player;
    gameObjects: GameObject[] = [];

    gameState: GameState = GameState.Loading;

    logicManager: LogicManager;
    levelManager: LevelManager;
    soundManager: SoundManager;

    assetsLoaded: boolean = false;

    raycaster: Raycaster;

    isMapVisible: boolean = false;
    isFpsVisible: boolean = false;
    isDebugActive: boolean = false;

    constructor(
        ctx: CanvasRenderingContext2D,
        canvas: HTMLCanvasElement
    ) {
        this.ctx = ctx;
        this.canvas = canvas;

        this.lastTime = 0;
        this.boundLoop = this.loop.bind(this);

        this.renderer = new Renderer(this.ctx, this.canvas);
        this.input = new Input();

        this.player = new Player();

        this.logicManager = new LogicManager(this);
        this.levelManager = new LevelManager();
        this.soundManager = new SoundManager();

        this.loadAssets();

        this.raycaster = new Raycaster();

        this.player.setSoundManager(this.soundManager);
    }

    async loadAssets() {
        await Promise.all([
            this.loadLevelsData(),
            this.soundManager.loadSounds(),
            this.renderer.loadTextures()
        ]);
        this.assetsLoaded = true;
        this.gameState = GameState.Title;
    }

    async loadLevelsData() {
        const response = await fetch('./res/levels.json');
        const levels: LevelData[] = await response.json();
        this.levelManager.loadLevels(levels);
    }

    update(deltaTime: number) {

        if (this.isFpsVisible) {
            this.countFps(deltaTime);
        }

        switch (this.gameState) {

            case GameState.Title:

                if (!this.assetsLoaded) return;

                if (this.input.keys[' ']) {
                    this.input.keys[' '] = false;
                    this.logicManager.loadCurrentLevel();
                    this.gameState = GameState.Playing;
                }

                break;

            case GameState.LevelComplete:

                if (this.input.keys[' ']) {
                    this.input.keys[' '] = false;
                    this.logicManager.loadNextLevel();
                    this.gameState = GameState.Playing;
                }

                break;

            case GameState.Playing:

                // if (this.input.keys['[']) {
                //     this.getCurrentLevel().ceilingTileId--;
                //     console.log(this.getCurrentLevel().ceilingTileId);
                //     this.input.keys['['] = false;
                // }
                //
                // if (this.input.keys[']']) {
                //     this.getCurrentLevel().ceilingTileId++;
                //     console.log(this.getCurrentLevel().ceilingTileId);
                //     this.input.keys[']'] = false;
                // }
                //
                // if (this.input.keys['9']) {
                //     this.getCurrentLevel().floorTileId--;
                //     console.log(this.getCurrentLevel().floorTileId);
                //     this.input.keys['9'] = false;
                // }
                //
                // if (this.input.keys['0']) {
                //     this.getCurrentLevel().floorTileId++;
                //     console.log(this.getCurrentLevel().floorTileId);
                //     this.input.keys['0'] = false;
                // }

                // if (this.input.keys[',']) {
                //     this.getCurrentLevel().skyboxId--;
                //     this.input.keys[','] = false;
                // }
                //
                // if (this.input.keys['.']) {
                //     this.getCurrentLevel().skyboxId++;
                //     this.input.keys['.'] = false;
                // }

                if (this.input.keys['f']) {
                    this.input.keys['f'] = false;
                    this.isFpsVisible = !this.isFpsVisible;
                }

                if (this.input.keys['m']) {
                    this.input.keys['m'] = false;
                    this.isMapVisible = !this.isMapVisible;
                }

                if (this.input.keys['d']) {
                    this.input.keys['d'] = false;
                    this.isDebugActive = !this.isDebugActive;
                }

                const music = this.soundManager.get(SoundId.Music);
                if (music && !music.isPlaying()) {
                    music.setVolume(0.4);
                    music.play();
                }

                this.logicManager.checkCollisions();

                this.raycaster.update(
                    this.player,
                    this.getCurrentLevel(),
                    this.gameObjects);

                this.player.update(deltaTime);

                this.gameObjects.filter(obj => obj.isActive)
                    .forEach(obj => {
                        obj.update(deltaTime);
                    });

                this.getCurrentLevel().updateDoorsTransitions(deltaTime, this.player.posX, this.player.posY);

                if (this.input.keys[' ']) {
                    this.input.keys[' '] = false;
                    this.logicManager.openDoorInFrontOfPlayer();
                }

                if (this.isMapVisible) {
                    this.renderer.updateMiniMapView(
                        this.player,
                        this.getCurrentLevel(),
                        this.gameObjects
                    );
                }

                this.player.updateMovement(deltaTime, this.input, this.getCurrentLevel());

                if (this.logicManager.timeIsUp(deltaTime)) {
                    this.gameState = GameState.GameOver;
                }

                break;

            case GameState.GameOver:

                if (this.input.keys[' ']) {
                    this.input.keys[' '] = false;
                    this.logicManager.resetGame();
                    this.gameState = GameState.Title;
                }

                break;
        }

        this.deleteInactiveObjects();
    }

    deleteInactiveObjects() {
        this.gameObjects = this.gameObjects.filter(obj => obj.isActive);
    }

    private getCurrentLevel() {
        return this.levelManager.currentLevel;
    }

    render() {

        this.renderer.clearScreen();

        switch (this.gameState) {

            case GameState.Loading:
                this.renderer.renderLoadingScreen();
                break;

            case GameState.Title:
                this.renderer.renderTitleScreen();
                break;

            case GameState.Playing:

                const isSkyboxOn = this.getCurrentLevel().getSkyboxId();
                const isCeilingOn = !isSkyboxOn;

                this.renderer.renderTexturedFloorAndCeiling(this.raycaster.scene_floor, this.raycaster.scene_ceiling, isCeilingOn);

                if (isSkyboxOn) {
                    this.renderer.renderSkyBox(this.player.angle, this.getCurrentLevel().getSkyboxId());
                }

                if (!this.isDebugActive) {
                    this.renderer.renderTexturedWalls(this.raycaster.scene_objects, true, false, false, this.getCurrentLevel());
                } else {
                    this.renderer.renderSimpleWalls(this.raycaster.scene_objects, true, true, true, this.getCurrentLevel());
                }

                if (this.isMapVisible) {
                    this.renderer.renderMiniMap(
                        this.getCurrentLevel(),
                        this.player,
                        this.raycaster.rays_for_minimap
                    );
                }

                this.renderer.renderHUD(this.player.getInventory().getCollectedKeys(), this.player.getInventory().getCoins(), this.logicManager.timeLeftSeconds);

                //this.renderer.renderFloorAndCeilingId(this.getCurrentLevel());
                //this.renderer.renderLog(this.raycaster.log);

                break;

            case GameState.LevelComplete:
                this.renderer.renderLevelCompletedScreen(this.player.getInventory().getCoinsCollectedOnLevel(), this.getCurrentLevel().coinsTotal);
                break;

            case GameState.GameOver:
                this.renderer.renderGameOverScreen(this.logicManager.victory, this.player.totalTime, this.player.getInventory().getCoins());
                break;

        }

        if (this.isFpsVisible) {
            this.renderer.renderFpsCounter(this.fps);
        }

    }

    countFps(deltaTime: number) {
        this.frameCount++;
        this.fpsTime += deltaTime;
        if (this.fpsTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsTime = 0;
        }
    }

    loop(timestamp: number) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.render();

        requestAnimationFrame(this.boundLoop);
    }

    start() {
        requestAnimationFrame(this.boundLoop);
    }

}