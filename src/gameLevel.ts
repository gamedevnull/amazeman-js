import {Animation} from "./video.js";
import {DoorKeyType} from "./commons.js";

export interface LevelData {
    name: string; // "Level 1"
    size: string; // "20x20"
    data: string; // "00010001...." -> 4 chars/digits -> 1 tile
    floor_tile_id: number;
    ceiling_tile_id: number;
    skybox_id?: number;
    time_limit?: number;
}

export enum TileType {
    Empty = 0,
    Wall = 21, // any value >= 21 is a wall
    DoorRed = 1,
    DoorGreen = 2,
    DoorBlue = 3,
    DoorOpen = 4,
    KeyRed = 5,
    KeyGreen = 6,
    KeyBlue = 7,
    Coin = 8,
    Exit = 10,
    PlayerStart = 11,
    DoorOpened = 9,
    CatStatue = 15
}

export class TileTypeHelper {

    private static readonly TILE_CATEGORIES = {
        doors: new Set([TileType.DoorRed, TileType.DoorGreen, TileType.DoorBlue, TileType.DoorOpen]),
        keys: new Set([TileType.KeyRed, TileType.KeyGreen, TileType.KeyBlue]),
    }

    static isDoor(tileType: TileType): boolean {
        return this.TILE_CATEGORIES.doors.has(tileType);
    }

    static isKey(tileType: TileType): boolean {
        return this.TILE_CATEGORIES.keys.has(tileType);
    }

    static isCatStatue(tileType: TileType): boolean {
        return tileType === TileType.CatStatue;
    }

    static isWall(tileType: TileType): boolean {
        return tileType >= TileType.Wall;
    }

    static isOpenedDoor(tileType: TileType): boolean {
        return tileType === TileType.DoorOpened;
    }

    static isCoin(tileType: TileType): boolean {
        return tileType === TileType.Coin;
    }

    static isStart(tileType: TileType): boolean {
        return tileType === TileType.PlayerStart;
    }

    static isExit(tileType: TileType): boolean {
        return tileType === TileType.Exit;
    }

    static getRequiredKeyForDoor(tileType: TileType): DoorKeyType | TileType.Empty {
        switch (tileType) {
            case TileType.DoorRed:
                return DoorKeyType.Red;
            case TileType.DoorGreen:
                return DoorKeyType.Green;
            case TileType.DoorBlue:
                return DoorKeyType.Blue;
            default:
                return TileType.Empty;
        }
    }

}

export type DoorState = "closed" | "opening" | "opened" | "closing";

// manages single door on the map -> open/close transition, animation progress -> syncs state to map
export class DoorTransition {
    readonly x: number;
    readonly y: number;

    private state: DoorState = "closed";
    private progress: number = 0; // 0..1
    private readonly openDurationMs: number;
    private readonly closeDurationMs: number;

    doorAnimation: Animation;

    constructor(x: number, y: number, openDurationMs = 200, closeDurationMs = 200) {
        this.x = x;
        this.y = y;
        this.openDurationMs = openDurationMs;
        this.closeDurationMs = closeDurationMs;
        this.doorAnimation = new Animation(32, 32,0, 0, 5, 50, 0);
    }

    update(deltaMs: number, doorManager: DoorManager, playerTileX: number, playerTileY: number): void {
        this.doorAnimation.update(deltaMs);

        switch (this.state) {

            case "opening":
                this.progress = Math.min(1, this.progress + deltaMs / this.openDurationMs);
                if (this.progress >= 1) {
                    this.state = "opened";
                    doorManager.onDoorOpened(this.x, this.y);
                }
                break;

            case "closing":
                this.progress = Math.max(0, this.progress - deltaMs / this.closeDurationMs);
                if (this.progress <= 0) {
                    if (doorManager.map.isPlayerOnTile(this.x, this.y, playerTileX, playerTileY, 0.5)) {
                        this.triggerOpen(); // player is on the way -> keep the door open
                        return;
                    }
                    this.state = "closed";
                    doorManager.onDoorClosed(this.x, this.y);
                }
                break;

            default:
                break;
        }
    }

    triggerOpen(): void {
        if (this.state === "opened" || this.state === "opening") return;
        this.state = "opening";
        this.doorAnimation.direction = 1;
        this.doorAnimation.start();
    }

    triggerClose(): void {
        if (this.state === "closed" || this.state === "closing") return;
        this.state = "closing";
        this.doorAnimation.direction = -1;
        this.doorAnimation.start();
    }

    toggle(): void {
        if (this.state === "closed" || this.state === "closing") this.triggerOpen();
        else this.triggerClose();
    }

    getState(): DoorState {
        return this.state;
    }

    getProgress(): number {
        return this.progress;
    }

    isBlocking(): boolean {
        return this.state !== "opened";
    }
}

// manages all doors on the map
export class DoorManager {

    map: GameLevel;
    private doors = new Map<string, DoorTransition>();
    doorClosedMap: Set<string> = new Set();

    constructor(gameLevel: GameLevel) {
        this.map = gameLevel;
    }

    private key(x: number, y: number): string {
        return `${x},${y}`;
    }

    ensureDoor(x: number, y: number): DoorTransition {
        const k = this.key(x, y);
        let d = this.doors.get(k);
        if (!d) {
            d = new DoorTransition(x, y);
            this.doors.set(k, d);
        }
        return d;
    }

    update(deltaMs: number, playerTileX: number, playerTileY: number): void {
        for (const d of this.doors.values()) {
            d.update(deltaMs, this, playerTileX, playerTileY);
        }
    }

    triggerOpen(x: number, y: number): void {
        this.ensureDoor(x, y).triggerOpen();
    }

    triggerClose(x: number, y: number): void {
        this.ensureDoor(x, y).triggerClose();
    }

    toggle(x: number, y: number): void {
        this.ensureDoor(x, y).toggle();
    }

    getStateObj(x: number, y: number): DoorTransition {
        return this.doors.get(this.key(x, y))!;
    }

    getState(x: number, y: number): DoorState {
        return this.doors.get(this.key(x, y))?.getState() ?? "closed";
    }

    getProgress(x: number, y: number): number {
        return this.doors.get(this.key(x, y))?.getProgress() ?? 0;
    }

    isBlocking(x: number, y: number): boolean {
        return this.doors.get(this.key(x, y))?.isBlocking() ?? true;
    }

    reset(): void {
        this.doors.clear();
        this.doorClosedMap.clear();
    }

    onDoorClosed(x: number, y: number): void {
        this.doorClosedMap.add(`${x},${y}`);
        this.map.onDoorClosed(x, y);
    }

    onDoorOpened(x: number, y: number): void {
        this.doorClosedMap.delete(`${x},${y}`);
        this.map.onDoorOpened(x, y);
    }
}

export class GameLevel {

    mapArray: number[][];
    mapArrayDefault: number[][];
    rows: number;
    cols: number;
    name: string;

    wallsMap: Set<string>;

    playerStartX: number = 0;
    playerStartY: number = 0;

    doorManager: DoorManager;

    floorTileId: number;
    ceilingTileId: number;
    skyboxId: number = 0;
    coinsTotal: number = 0;
    timeLimit: number = 59;

    constructor(json: LevelData) {
        this.doorManager = new DoorManager(this);
        this.name = json.name;
        const [cols, rows] = json.size.split('x').map(Number);
        this.rows = rows;
        this.cols = cols;
        this.mapArray = [];
        this.mapArrayDefault = [];
        let idx = 0;
        const tileBlockSize = 4; // 4 chars => 1 tile
        for (let i = 0; i < rows; ++i) {
            const row: number[] = [];
            for (let j = 0; j < cols; ++j) {
                const tileStr = json.data.substring(idx, idx + tileBlockSize);
                row.push(parseInt(tileStr, 10)); // force base 10^
                idx += tileBlockSize; // next tile
            }
            this.mapArray.push(row);
        }

        this.mapArrayDefault = this.mapArray.map(row => row.slice());

        this.floorTileId = json.floor_tile_id;
        this.ceilingTileId = json.ceiling_tile_id;

        if (json.skybox_id) {
            this.skyboxId = json.skybox_id;
        }

        if (json.time_limit) {
            this.timeLimit = json.time_limit;
        }

        this.wallsMap = new Set();

        this.buildMaps();
    }

    private isOutOfBounds(col: number, row: number): boolean {
        return col < 0 || row < 0 || col >= this.cols || row >= this.rows;
    }

    getTileType(col: number, row: number): TileType {
        if (this.isOutOfBounds(col, row)) {
            return TileType.Wall;
        }
        return this.mapArray[row][col] as TileType;
    }

    isPlayerStartTile(col: number, row: number): boolean {
        return TileTypeHelper.isStart(this.getTileType(col, row));
    }

    isDoorTile(col: number, row: number): boolean {
        return TileTypeHelper.isDoor(this.getTileType(col, row));
    }

    isOpenedDoorTile(col: number, row: number): boolean {
        return TileTypeHelper.isOpenedDoor(this.getTileType(col, row));
    }

    isExitTile(col: number, row: number): boolean {
        return TileTypeHelper.isExit(this.getTileType(col, row));
    }

    isCoinTile(col: number, row: number): boolean {
        return TileTypeHelper.isCoin(this.getTileType(col, row));
    }

    isKeyTile(col: number, row: number): boolean {
        return TileTypeHelper.isKey(this.getTileType(col, row));
    }

    isCatStatueTile(col: number, row: number): boolean {
        return TileTypeHelper.isCatStatue(this.getTileType(col, row));
    }

    isWallsTile(col: number, row: number): boolean {
        return TileTypeHelper.isWall(this.getTileType(col, row));
    }

    getRequiredKeyForDoor(tileType: TileType): DoorKeyType | TileType.Empty {
        return TileTypeHelper.getRequiredKeyForDoor(tileType);
    }

    getFloorTileId(col: number, row: number): number {
        return this.floorTileId;
    }

    getCeilingTileId(col: number, row: number): number {
        return this.ceilingTileId;
    }

    getSkyboxId(): number {
        return this.skyboxId;
    }

    updateDoorsTransitions(deltaTime: number, playerX: number, playerY: number) {
        this.doorManager.update(deltaTime, playerX, playerY);
    }

    getDoorTransitionProgress(x: number, y: number): number {
        return this.doorManager.getProgress(x, y);
    }

    getDoorTransition(x: number, y: number): DoorTransition {
        return this.doorManager.getStateObj(x, y);
    }

    getDoorTransitionState(x: number, y: number): DoorState | null {
        return  this.doorManager.getState(x, y);
    }

    getDoorColorAt(col: number, row: number): string {
        const tileType = this.getTileType(col, row);
        switch (tileType) {
            case TileType.DoorRed:
                return "#ff0000"; // red
            case TileType.DoorGreen:
                return "#00ff00"; // green
            case TileType.DoorBlue:
                return "#0000ff"; // blue
            case TileType.DoorOpen:
                return "#8b4513"; // brown
            case TileType.Exit:
                return "#00ddc5";
            case TileType.DoorOpened:
                return "#838383";
            default:
                return "#000";
        }
    }

    canMoveTo(x: number, y: number, radius: number = 0): boolean {
        const points = [
            {x: x + radius, y},
            {x: x - radius, y},
            {x, y: y + radius},
            {x, y: y - radius}
        ];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (!this.isPointWalkable(point.x, point.y)) {
                return false;
            }
        }
        return true;
    }

    isPlayerOnTile(tileX: number, tileY: number, x: number, y: number, radius: number = 0): boolean {
        radius = radius / 2;

        const points = [
            {x: x + radius, y},
            {x: x - radius, y},
            {x, y: y + radius},
            {x, y: y - radius}
        ];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (Math.floor(point.x) === tileX && Math.floor(point.y) === tileY) {
                return true;
            }
        }

        return false;
    }

    private isPointWalkable(x: number, y: number): boolean {
        const ix = Math.floor(x);
        const iy = Math.floor(y);

        if (this.isOutOfBounds(ix, iy)) return false;

        const tileType = this.getTileType(ix, iy);

        return !TileTypeHelper.isWall(tileType) &&
            !this.isDoorClosed(ix, iy) &&
            tileType !== TileType.Exit;
    }

    isDoorClosed(x: number, y: number): boolean {
        return this.doorManager.doorClosedMap.has(`${x},${y}`);
    }

    buildMaps() {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.isWallsTile(x, y)) {
                    this.wallsMap.add(`${x},${y}`);
                } else if (this.isPlayerStartTile(x, y)) {
                    this.playerStartX = x;
                    this.playerStartY = y;
                } else if (this.isDoorTile(x, y)) {
                    this.doorManager.doorClosedMap.add(`${x},${y}`);
                }
            }
        }
    }

    reset() {
        this.mapArray = this.mapArrayDefault.map(row => row.slice());
        this.wallsMap.clear();
        this.doorManager.reset();
        this.coinsTotal = 0;
        this.buildMaps();
    }

    onDoorClosed(x: number, y: number): void {
        this.mapArray[y][x] = TileType.DoorOpen;
    }

    onDoorOpened(x: number, y: number): void {
        this.mapArray[y][x] = TileType.DoorOpened;
    }
}