import {GameLevel} from "./gameLevel.js";
import {GameObject, Player} from "./gameObjects.js";
import {SceneSurface, Ray} from "./raycaster.js";
import {TextureType} from "./commons.js";

export class TextureCache {
    private cachedTextures: Map<
        number, { data: Uint8ClampedArray, w: number, h: number }
    > = new Map();

    cacheTextureData(
        spriteSheet: HTMLImageElement,
        textures: { [key: number]: { x: number, y: number, w: number, h: number, tile_id: number } }
    ) {
        for (const key in textures) {
            const tex = textures[key];
            const c = document.createElement('canvas');
            c.width = tex.w;
            c.height = tex.h;
            const ctx = c.getContext('2d')!;
            ctx.drawImage(spriteSheet, tex.x, tex.y, tex.w, tex.h, 0, 0, tex.w, tex.h);
            const data = ctx.getImageData(0, 0, tex.w, tex.h).data;
            this.cachedTextures.set(tex.tile_id, { data, w: tex.w, h: tex.h });
        }
    }

    getTexture(tileId: number) {
        return this.cachedTextures.get(tileId);
    }
}

export class BitmapFontRenderer {
    private fontImage: HTMLImageElement;
    private charWidth: number;
    private charHeight: number;
    private firstCharCode: number;
    private sheetCols: number;

    constructor(
        fontImage: HTMLImageElement,
        charWidth: number,
        charHeight: number,
        sheetCols: number,
        firstCharCode: number = 32
    ) {
        this.fontImage = fontImage;
        this.charWidth = charWidth;
        this.charHeight = charHeight;
        this.firstCharCode = firstCharCode;
        this.sheetCols = sheetCols;
    }

    drawText(ctx: CanvasRenderingContext2D, text: string, posX: number, posY: number, scale: number = 2) {

        if (!text || text.length === 0) return;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = text.length * this.charWidth * scale;
        offCanvas.height = this.charHeight * scale;
        const offCtx = offCanvas.getContext('2d')!;
        offCtx.imageSmoothingEnabled = false;

        for (let i = 0; i < text.length; i++) {
            const ascii = text.charCodeAt(i);
            const charIndex = ascii - this.firstCharCode;
            if (charIndex < 0) continue;

            const col = charIndex % this.sheetCols;
            const row = Math.floor(charIndex / this.sheetCols);

            offCtx.drawImage(
                this.fontImage,
                col * this.charWidth, row * this.charHeight,
                this.charWidth, this.charHeight,
                i * this.charWidth * scale, 0,
                this.charWidth * scale, this.charHeight * scale
            );
        }

        ctx.drawImage(offCanvas, posX, posY);
    }
}

export class PixelBuffer {
    private offCanvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private imageData: ImageData;
    private data: Uint8ClampedArray;
    private width: number;
    private height: number;

    constructor(width: number, height: number) {
        this.offCanvas = document.createElement('canvas');
        this.offCanvas.width = width;
        this.offCanvas.height = height;
        this.ctx = this.offCanvas.getContext('2d')!;
        this.width = width;
        this.height = height;
        this.imageData = this.ctx.createImageData(width, height);
        this.data = this.imageData.data;
    }

    getData(): Uint8ClampedArray {
        return this.data;
    }

    getImageData(): ImageData {
        return this.imageData;
    }

    clear() {
        this.data.fill(0);
    }

    resize(width: number, height: number) {
        if (width !== this.width || height !== this.height) {
            this.width = width;
            this.height = height;
            this.offCanvas.width = width;
            this.offCanvas.height = height;
            this.imageData = this.ctx.createImageData(width, height);
            this.data = this.imageData.data;
        }
    }

    putTo(targetCtx: CanvasRenderingContext2D) {
        this.ctx.putImageData(this.imageData, 0, 0);
        targetCtx.drawImage(this.offCanvas, 0, 0);
    }
}

export class MiniMapRenderer {

    viewportX: number = 0;
    viewportY: number = 0;
    viewportCols: number = 8;
    viewportRows: number = 8;

    miniMapCanvas: HTMLCanvasElement;
    miniMapCtx: CanvasRenderingContext2D;
    miniMapTileSize: number = 20;

    visibleObjects: { x: number, y: number, scale: number, type: string, color: string }[] = [];

    constructor() {

        this.miniMapCanvas = document.createElement('canvas');
        this.miniMapCanvas.width = this.viewportCols * this.miniMapTileSize;
        this.miniMapCanvas.height = this.viewportRows * this.miniMapTileSize;

        this.miniMapCtx = this.miniMapCanvas.getContext('2d')!;
        this.miniMapCtx.imageSmoothingEnabled = false;
    }

    updateMiniMapView(player: Player, map: GameLevel, gameObjects: GameObject[]) {
        const halfCols = this.viewportCols / 2;
        const halfRows = this.viewportRows / 2;

        let offsetX = player.posX - halfCols;
        let offsetY = player.posY - halfRows;

        offsetX = Math.max(0, Math.min(map.cols - this.viewportCols, offsetX));
        offsetY = Math.max(0, Math.min(map.rows - this.viewportRows, offsetY));

        this.viewportX = offsetX;
        this.viewportY = offsetY;

        this.visibleObjects = gameObjects.filter(obj =>
            obj.isActive
        ).map(obj => ({
            x: obj.posX,
            y: obj.posY,
            scale: obj.scale,
            type: obj.objectType,
            color: obj.baseColor
        }));
    }

    renderMiniMap(parentCtx: CanvasRenderingContext2D, level: GameLevel, player: Player, rays_to_cast: Ray[], miniMapPosX: number = 10, miniMapPosY: number = 10) {
        this.miniMapCtx.clearRect(0, 0, this.miniMapCanvas.width, this.miniMapCanvas.height);
        this._drawMapGridOnMiniMap(this.miniMapTileSize);
        this._renderWallsOnMiniMap(level, this.miniMapTileSize);
        this._renderRaysOnMiniMap(rays_to_cast, this.miniMapTileSize);
        this._renderOtherObjectsOnMiniMap(level, this.miniMapTileSize);
        this._renderPlayerOnMiniMap(player, this.miniMapTileSize);
        parentCtx.drawImage(this.miniMapCanvas, miniMapPosX, miniMapPosY);
    }

    private _renderRaysOnMiniMap(rays_to_cast: Ray[], tileSize: number) {
        const ctx = this.miniMapCtx;
        ctx.save();
        ctx.strokeStyle = "rgb(255 255 0 / 0.33)";
        for (const r of rays_to_cast) {
            ctx.beginPath();
            ctx.moveTo(
                (r.startX - this.viewportX) * tileSize,
                (r.startY - this.viewportY) * tileSize
            );
            ctx.lineTo(
                (r.endX - this.viewportX) * tileSize,
                (r.endY - this.viewportY) * tileSize
            );
            ctx.stroke();
        }
        ctx.restore();
    }

    private _renderPlayerOnMiniMap(player: Player, tileSize: number) {
        const ctx = this.miniMapCtx;
        ctx.save();

        const px = (player.posX - this.viewportX) * tileSize;
        const py = (player.posY - this.viewportY) * tileSize;

        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(
            px,
            py,
            player.scale * tileSize / 2,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // movement direction line
        const dirLength = tileSize * 2;
        const dirX = Math.cos(player.angle) * dirLength;
        const dirY = Math.sin(player.angle) * dirLength;
        ctx.strokeStyle = 'yellow';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + dirX, py + dirY);
        ctx.stroke();

        ctx.restore();
    }

    private _renderOtherObjectsOnMiniMap(map: GameLevel, tileSize: number) {
        const ctx = this.miniMapCtx;
        ctx.save();

        for (const obj of this.visibleObjects) {

            const w = obj.scale * tileSize;
            const h = obj.scale * tileSize;

            const px = (obj.x - this.viewportX) * tileSize - w / 2;
            const py = (obj.y - this.viewportY) * tileSize - h / 2;

            if (obj.type === "coin") {
                ctx.fillStyle = obj.color;
                ctx.beginPath();
                ctx.arc(px + w / 2, py + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (obj.type === "key") {
                ctx.fillStyle = obj.color;
                ctx.fillRect(px, py, w, h);
            }
        }

        ctx.restore();
    }

    private _renderWallsOnMiniMap(map: GameLevel, tileSize: number) {
        const ctx = this.miniMapCtx;
        ctx.save();
        for (let y = Math.floor(this.viewportY); y < Math.ceil(this.viewportY + this.viewportRows); y++) {
            for (let x = Math.floor(this.viewportX); x < Math.ceil(this.viewportX + this.viewportCols); x++) {
                if (y >= 0 && y < map.rows && x >= 0 && x < map.cols) {
                    let isSolid = false;
                    if (map.isWallsTile(x, y)) {
                        ctx.fillStyle = 'white';
                        isSolid = true;
                    } else if (map.isDoorTile(x, y) && map.isDoorClosed(x, y)) {
                        ctx.fillStyle = map.getDoorColorAt(x, y);
                        isSolid = true;
                    } else if (map.isExitTile(x, y)) {
                        ctx.fillStyle = map.getDoorColorAt(x, y);
                        isSolid = true;
                    }
                    if (isSolid) {
                        ctx.fillRect(
                            (x - this.viewportX) * tileSize,
                            (y - this.viewportY) * tileSize,
                            tileSize, tileSize
                        );
                    }
                }
            }
        }
        ctx.restore();
    }

    private _drawMapGridOnMiniMap(tileSize: number, color: string = 'gray') {
        const ctx = this.miniMapCtx;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.5;

        for (let y = Math.floor(this.viewportY); y <= Math.ceil(this.viewportY + this.viewportRows); y++) {
            const screenY = (y - this.viewportY) * tileSize;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(this.viewportCols * tileSize, screenY);
            ctx.stroke();
        }

        for (let x = Math.floor(this.viewportX); x <= Math.ceil(this.viewportX + this.viewportCols); x++) {
            const screenX = (x - this.viewportX) * tileSize;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, this.viewportRows * tileSize);
            ctx.stroke();
        }
        ctx.restore();
    }

}

export class Renderer {

    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;

    textures: Map<TextureType, HTMLImageElement> = new Map();

    static readonly TEXTURE_TILE_W = 32;
    static readonly TEXTURE_TILE_H = 32;
    static readonly TEXTURE_GRID_COLS = 4;
    static readonly TEXTURE_GRID_ROWS = 43;

    private pixelBuffer: PixelBuffer | null = null;
    private textureCache: TextureCache = new TextureCache();

    minimapRenderer: MiniMapRenderer = new MiniMapRenderer();

    constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
        this.ctx = ctx;
        this.ctx.imageSmoothingEnabled = false;
        this.canvas = canvas;
    }

    async loadTextures() {

        const textureSources = new Map<TextureType, string>([
            [TextureType.WallsAndObjects, "res/tiles_02.png"],
            [TextureType.FloorsAndCeilings, "res/tiles_01.png"],
            [TextureType.Coin, "res/coin.png"],
            [TextureType.Fonts, "res/pixfont.png"],
            [TextureType.Skybox1, "res/sky1.png"],
            [TextureType.Skybox2, "res/sky2.png"],
            [TextureType.Skybox3, "res/sky3.png"],
            [TextureType.Door, "res/doors.png"],
            [TextureType.BgTitle, "res/bg_1.png"],
            [TextureType.BgWin, "res/bg_2.png"],
            [TextureType.BgLost, "res/bg_3.png"]
        ]);

        textureSources.forEach((src, id) => {
            const img = new window.Image();
            img.src = src;
            img.onload = () => {
                this.textures.set(id, img);

                if (id === TextureType.FloorsAndCeilings) {

                    const tex_w = Renderer.TEXTURE_TILE_W;
                    const tex_h = Renderer.TEXTURE_TILE_H;
                    const grid_cols = Renderer.TEXTURE_GRID_COLS;
                    const grid_rows = 8; //Renderer.TEXTURE_GRID_ROWS;

                    const tilesTextures: { [key: number]: { x: number, y: number, w: number, h: number, tile_id: number } } = {};
                    let tileId = 1;
                    for (let row = 0; row < grid_rows; row++) {
                        for (let col = 0; col < grid_cols; col++) {
                            const textureIndex = (row * grid_cols) + col;
                            const x = col * tex_w;
                            const y = row * tex_h;
                            tilesTextures[textureIndex] = {
                                x,
                                y,
                                w: tex_w,
                                h: tex_h,
                                tile_id: tileId
                            };
                            tileId++;
                        }
                    }
                    this.textureCache.cacheTextureData(img, tilesTextures);
                }
            };
        });
    }

    renderTextAsImage(text: string, x: number, y: number, scale: number = 2) {
        const fontImg = this.textures.get(TextureType.Fonts as TextureType);
        if (fontImg) {
            const ctx = this.ctx;
            const fontRenderer = new BitmapFontRenderer(fontImg, 12, 16, 16);
            fontRenderer.drawText(ctx, text, x, y, scale);
        }
    }

    renderCenteredTextAsImage(text: string, offsetY: number, scale: number = 2) {
        const charWidth = 12;
        const textWidth = text.length * charWidth * scale;
        const offsetX = (this.canvas.width - textWidth) / 2;
        this.renderTextAsImage(text, offsetX, offsetY, scale);
    }

    clearScreen() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    updateMiniMapView(player: Player, map: GameLevel, gameObjects: GameObject[]) {
        this.minimapRenderer.updateMiniMapView(player, map, gameObjects);
    }

    renderMiniMap(level: GameLevel, player: Player, rays_to_cast: Ray[], miniMapPosX: number = 10, miniMapPosY: number = 10) {
        this.minimapRenderer.renderMiniMap(this.ctx, level, player, rays_to_cast, miniMapPosX, miniMapPosY);
    }

    renderLoadingScreen() {
        const y = this.canvas.height / 2 + 40;
        this.renderCenteredTextAsImage(`Loading...`, y, 1)
    }

    renderLog(message: string) {
        this.ctx.save();
        this.ctx.fillStyle = "white";
        this.ctx.font = "12px monospace";
        this.ctx.fillText( message, 85, 470);
        this.ctx.restore();
    }

    renderLevelCompletedScreen(collectedCoins: number, totalCoins: number) {

        const coinsImg = this.textures.get(TextureType.WallsAndObjects as TextureType);
        if (coinsImg) {
            this.ctx.drawImage(coinsImg, 32*3, 32*2, 32, 32, this.canvas.width / 2 - 32, this.canvas.height / 2 - 100, 64, 64);
        }

        let x =  this.canvas.width / 2 - 190;
        let y = this.canvas.height / 2 ;
        this.renderTextAsImage(`LEVEL COMPLETED!`, x, y, 2);

        x =  this.canvas.width / 2 - 140;
        y = this.canvas.height / 2 + 60;
        this.renderTextAsImage(`Coins : ${collectedCoins} of ${totalCoins}`, x, y, 1.6);

        y = this.canvas.height / 2 + 130;
        this.renderCenteredTextAsImage(`Press SPACE to CONTINUE`, y, 1)
    }

    renderTitleScreen() {

        const bgImg = this.textures.get(TextureType.BgTitle as TextureType);
        if (bgImg) {
            this.ctx.drawImage(bgImg, 0, 0, this.canvas.width, this.canvas.height);
        }

        this.renderCenteredTextAsImage(`Amazeman 3D`, this.canvas.height / 2 + 100, 3);

        this.renderCenteredTextAsImage(`Press SPACE to START`, this.canvas.height / 2 + 180, 1)
    }

    renderGameOverScreen(isVictory: boolean, totalSeconds: number, totalCoins: number) {

        let bgImg;

        if (isVictory) {

            bgImg = this.textures.get(TextureType.BgWin as TextureType);
            if (bgImg) {
                this.ctx.drawImage(bgImg, 0, 0, this.canvas.width, this.canvas.height);
            }
            let x = this.canvas.width / 2 - 190;
            let y = this.canvas.height / 2 + 90;
            this.renderTextAsImage(`Congratulations!`, x, y, 2);

            x = this.canvas.width / 2 - 230;
            y = this.canvas.height / 2 + 150;

            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const secondsStr = ('0' + seconds).slice(-2);
            const totalTimeString = `${minutes}:${secondsStr}`;

            this.renderTextAsImage(`You have escaped in ${totalTimeString} with ${totalCoins} coins!`, x, y, 1);

            x = this.canvas.width / 2 - 135;
            y = this.canvas.height / 2 + 190;
            this.renderTextAsImage(`Press SPACE to RESTART`, x, y, 1);

        } else {

            bgImg = this.textures.get(TextureType.BgLost as TextureType);
            if (bgImg) {
                this.ctx.drawImage(bgImg, 0, 0, this.canvas.width, this.canvas.height);
            }
            let x = this.canvas.width / 2 - 190;
            let y = this.canvas.height / 2 + 110;
            this.renderTextAsImage(`You have lost...`, x, y, 2);

            x = this.canvas.width / 2 - 135;
            y = this.canvas.height / 2 + 180;
            this.renderTextAsImage(`Press SPACE to RESTART`, x, y, 1);

        }

    }

    renderHUD(collectedKeys: Set<number>, collectedCoins: number, timeLeftSeconds: number = 59) {
        this.renderCollectedKeys(collectedKeys);
        this.renderCoinsCounter(collectedCoins);
        this.renderGameTimer(timeLeftSeconds);
    }

    renderCollectedKeys(collectedKeys: Set<number>) {
        const ctx = this.ctx;
        ctx.save();

        const iconSize = 128;
        const spacing = 4;

        const keys = [
            {type: 1, color: "#aa0000", tex_x: 0, tex_y: 32 },
            {type: 2, color: "#00aa00", tex_x: 32, tex_y: 32 },
            {type: 3, color: "#0000ea", tex_x: 32 * 2, tex_y: 32 }
        ];

        const keysImg = this.textures.get(TextureType.WallsAndObjects as TextureType);

        let collected = keys.filter(key => collectedKeys.has(key.type));
        const totalWidth = collected.length * iconSize + (collected.length - 1) * spacing;
        const startX = (this.canvas.width - totalWidth) / 2;
        const startY = this.canvas.height - iconSize + 18;

        for (let i = 0; i < collected.length; i++) {
            const key = collected[i];
            const x = startX + i * (iconSize + spacing);
            if (keysImg) {
                ctx.drawImage(
                    keysImg,
                    key.tex_x, key.tex_y, 32, 32,
                    x, startY, iconSize, iconSize
                );
            }
        }
        ctx.restore();
    }

    renderCoinsCounter(collectedCoins: number) {
        const height = 32;
        const margin = 16;
        const x = margin;
        const y = this.canvas.height - height - margin;
        this.renderTextAsImage(`$ x ${collectedCoins}`, x, y);
    }

    renderGameTimer(timeLeftSeconds: number) {
        const width = 130;
        const height = 32;
        const margin = 16;
        const x = this.canvas.width - width - margin;
        const y = this.canvas.height - height - margin;
        this.renderTextAsImage(`T: ${timeLeftSeconds}`, x, y);
    }

    renderFpsCounter(fps: number) {
        this.ctx.save();
        this.ctx.fillStyle = "cyan";
        this.ctx.font = "16px monospace";
        this.ctx.fillText(`FPS: ${fps}`, 5, 470);
        this.ctx.restore();
    }

    renderFloorAndCeilingId(level: GameLevel) {
        this.ctx.save();
        this.ctx.fillStyle = "cyan";
        this.ctx.font = "14px monospace";
        this.ctx.fillText(`floor: ${level.floorTileId} & ceiling: ${level.ceilingTileId}`, 5, 15);
        this.ctx.restore();
    }

    renderSimpleWalls(walls: any, useDepthBuffer: boolean = false, renderFloor = true, renderCeiling = true, gameLevel: GameLevel) {
        const ctx = this.ctx;
        if (!walls) return;

        //walls = [...walls].sort((a, b) => b.depth - a.depth);
        walls.sort((a: any, b: any) => b.depth - a.depth);

        const w = this.canvas.width;
        const h = this.canvas.height;

        const maxWallDepth = 16;
        const minShade = Math.max(0.2, 1 - maxWallDepth / 16);

        if (useDepthBuffer) {

           const horizon = h / 2;
           const fakePlayerZ = 0.5;
           const floorColor = [109, 84, 18];

           if (renderFloor) {
               for (let y = horizon; y < h; y += 2) {
                   const relY = y - horizon;
                   const distance = fakePlayerZ / (relY / h);
                   const shade = Math.max(minShade, 1 - distance * 0.07);
                   ctx.fillStyle = `rgb(${floorColor.map(c => Math.floor(c * shade)).join(",")})`;
                   ctx.fillRect(0, y, w, 2);
               }
           }

           if (renderCeiling) {
               const ceilingColor = [80, 69, 155];
               for (let y = 0; y < horizon; y += 2) {
                   const relY = horizon - y;
                   const distance = fakePlayerZ / (relY / h);
                   const shade = Math.max(minShade, 1 - distance * 0.03);
                   ctx.fillStyle = `rgb(${ceilingColor.map(c => Math.floor(c * shade)).join(",")})`;
                   ctx.fillRect(0, y, w, 2);
               }
           }

       } else {

            // Floor
            ctx.fillStyle = "#6d5412";
            ctx.fillRect(0, h / 2, w, h / 2);
            ctx.restore();

            // Ceiling / sky
           ctx.save();
           ctx.fillStyle = "#50459b";
           ctx.fillRect(0, 0, w, h / 2);

       }

        // wall is object for rendering prepared in raycaster scene builder
        for (const wall of walls) {

            let wallHeight = wall.height;

            if (wall.renderType == "wall") {
                // check walls for door animation
                const tileX = wall.tileX;
                const tileY = wall.tileY;
                if (tileX !== undefined && tileY !== undefined) {
                    const doorTransition = gameLevel.getDoorTransition(tileX, tileY);
                    if (doorTransition) {
                        wallHeight = wall.height * (1 - doorTransition.getProgress());
                    }
                }
            }

            ctx.save();
            let basecolor = wall.color || "#adadad";
            let color = basecolor;
            if (useDepthBuffer && wall.depth !== undefined) {
                const shade = Math.max(minShade, 1 - wall.depth / maxWallDepth);
                const hex = basecolor.replace("#", "");
                const r = parseInt(hex.substring(0,2), 16);
                const g = parseInt(hex.substring(2,4), 16);
                const b = parseInt(hex.substring(4,6), 16);
                const nr = Math.floor(r * shade);
                const ng = Math.floor(g * shade);
                const nb = Math.floor(b * shade);
                color = `rgb(${nr},${ng},${nb})`;
            }
            ctx.fillStyle = color;
            ctx.fillRect(wall.x, wall.y, wall.width, wallHeight);
            ctx.restore();
        }

    }

    getSkyBoxImg(skyboxId: number): HTMLImageElement | null {
        let img;
        if (skyboxId == 1) {
            img = this.textures.get(TextureType.Skybox1);
        } else if (skyboxId == 2) {
            img = this.textures.get(TextureType.Skybox2);
        } else {
            img = this.textures.get(TextureType.Skybox3);
        }
        if (!img) return null;
        return img;
    }

    renderSkyBox(playerAngle: number, skyboxId: number) {
        const ctx = this.ctx;
        const img = this.getSkyBoxImg(skyboxId);
        if (!img) return;

        const w = this.canvas.width;
        const h = this.canvas.height / 2;

        let skyOffset = Math.floor((playerAngle / (2 * Math.PI)) * img.width) % img.width;
        if (skyOffset < 0) skyOffset += img.width;

        ctx.save();

        ctx.globalAlpha = 1.0;

        // 1 - from offset to the end of the texture
        const firstWidth = Math.min(img.width - skyOffset, w);
        ctx.drawImage(img, skyOffset, 0, firstWidth, img.height, 0, 0, firstWidth, h);

        // 2 - if needed -> from beginning of the texture
        if (firstWidth < w) {
            ctx.drawImage(img, 0, 0, w - firstWidth, img.height, firstWidth, 0, w - firstWidth, h);
        }

        ctx.restore();
    }

    renderTexturedWalls(walls: any, useDepthBuffer: boolean = false, renderFloor = true, renderCeiling = true, map: GameLevel) {

        const ctx = this.ctx;
        if (!walls) return;

        //walls = [...walls].sort((a, b) => b.depth - a.depth);
        walls.sort((a: any, b: any) => b.depth - a.depth);

        const w = this.canvas.width;
        const h = this.canvas.height;

        const maxWallDepthShade = 32;
        const minShade = Math.max(0.2, 1 - maxWallDepthShade / 16);

        const tex_w = Renderer.TEXTURE_TILE_W;
        const tex_h = Renderer.TEXTURE_TILE_H;
        const grid_cols = Renderer.TEXTURE_GRID_COLS;

        if (useDepthBuffer) {

            const horizon = h / 2;
            const fakePlayerZ = 0.5;
            const floorColor = [109, 84, 18];

            // Floor / simple one color floor
            if (renderFloor) {
                for (let y = horizon; y < h; y += 2) {
                    const relY = y - horizon;
                    const distance = fakePlayerZ / (relY / h);
                    const shade = Math.max(minShade, 1 - distance * 0.07);
                    ctx.fillStyle = `rgb(${floorColor.map(c => Math.floor(c * shade)).join(",")})`;
                    ctx.fillRect(0, y, w, 2);
                }
            }

            // Ceiling / sky / simple one color
            if (renderCeiling) {
                const ceilingColor = [80, 69, 155];
                for (let y = 0; y < horizon; y += 2) {
                    const relY = horizon - y;
                    const distance = fakePlayerZ / (relY / h);
                    const shade = Math.max(minShade, 1 - distance * 0.03);
                    ctx.fillStyle = `rgb(${ceilingColor.map(c => Math.floor(c * shade)).join(",")})`;
                    ctx.fillRect(0, y, w, 2);
                }
            }

        } else {

            // no shading, simple colors

            // Floor
            ctx.fillStyle = "#6d5412";
            ctx.fillRect(0, h / 2, w, h / 2);
            ctx.restore();

            // Ceiling / sky
            ctx.save();
            ctx.fillStyle = "#50459b";
            ctx.fillRect(0, 0, w, h / 2);

        }

        // wall is object for rendering prepared in raycaster scene builder
        for (const wall of walls) {

            if (wall.renderType == "wall") {

                const textureIndex = (wall.texture_id ?? 1) - 1;

                // simple wall from tiles sprite sheet
                let img = this.textures.get(TextureType.WallsAndObjects as TextureType);
                let tex_x = (textureIndex % grid_cols) * tex_w;
                let tex_y = Math.floor(textureIndex / grid_cols) * tex_h;

                // ... but on some tiles there are doors with animation
                const tileX = wall.tileX;
                const tileY = wall.tileY;
                if (tileX !== undefined && tileY !== undefined) {
                    const doorTransition = map.getDoorTransition(tileX, tileY);
                    if (doorTransition) {
                        const anim_frame_nb = doorTransition.doorAnimation.getCurrentFrameNumber();
                        const anim_tex_x = (doorTransition.doorAnimation.startCol * tex_w) + (anim_frame_nb * tex_w);
                        const anim_tex_y = (doorTransition.doorAnimation.startRow * tex_h);
                        // different texture and coordinates for doors animation
                        img = this.textures.get(TextureType.Door as TextureType);
                        tex_x = anim_tex_x;
                        tex_y = anim_tex_y;
                    }
                 }

                let shade = 0;

                if (useDepthBuffer) {
                    shade = Math.max(0, 1 - wall.depth / maxWallDepthShade);
                    // if (wall.wallType === "vertical") {
                    //     shade *= 0.7;
                    // } else if (wall.wallType === "horizontal") {
                    //     shade *= 1.0;
                    // }
                    shade *= 1.0;
                }

                if (!img) {
                    continue;
                }

                const sx = Math.floor(wall.texture_offset * (tex_w - 1));
                const fixed_tex_h = tex_h - 1; // -1 to avoid bleeding from texture tile below in sprite sheet (red dots)

                ctx.save();
                ctx.drawImage(
                    img,
                    tex_x + sx, tex_y, 1, fixed_tex_h,
                    wall.x, wall.y, wall.width, wall.height
                );
                ctx.restore();

                ctx.save();
                if (useDepthBuffer && shade) {
                    // apply shading
                    ctx.globalAlpha = 1 - shade;
                    ctx.fillStyle = "#000";
                    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
                    ctx.globalAlpha = 1.0;
                }
                ctx.restore();

            } else if (wall.renderType == "sprite") {

                // sprites without shading, maybe later...

                const img = this.textures.get(wall.texture_id as TextureType);
                if (!img) {
                    continue;
                }

                ctx.drawImage(
                    img,
                    wall.texture_x, wall.texture_y, wall.texture_w, wall.texture_h,
                    wall.x, wall.y, wall.width, wall.height
                );

            } else {

                // something else, just render a colored rectangle
                ctx.save();
                let basecolor = wall.color || "#adadad";
                let color = basecolor;
                if (useDepthBuffer && wall.depth !== undefined) {
                    const shade = Math.max(minShade, 1 - wall.depth / maxWallDepthShade);
                    const hex = basecolor.replace("#", "");
                    const r = parseInt(hex.substring(0,2), 16);
                    const g = parseInt(hex.substring(2,4), 16);
                    const b = parseInt(hex.substring(4,6), 16);
                    const nr = Math.floor(r * shade);
                    const ng = Math.floor(g * shade);
                    const nb = Math.floor(b * shade);
                    color = `rgb(${nr},${ng},${nb})`;
                }
                ctx.fillStyle = color;
                ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
                ctx.restore();

            }

        }

    }

    renderTexturedFloorAndCeiling(
        floorPixels: SceneSurface[],
        ceilingPixels: SceneSurface[],
        isCeilingEnabled:boolean = false
    ) {
        const ctx = this.ctx;

        const width = this.canvas.width;
        const height = this.canvas.height;

        if (!this.pixelBuffer || this.pixelBuffer['width'] !== width || this.pixelBuffer['height'] !== height) {
            this.pixelBuffer = new PixelBuffer(width, height);
        }

        const buffer = this.pixelBuffer;
        buffer.clear();

        this.renderPixelBlocks(floorPixels, buffer.getData(), width, height);

        if (isCeilingEnabled) {
            this.renderPixelBlocks(ceilingPixels, buffer.getData(), width, height);
        }

        buffer.putTo(ctx);
    }

    private renderPixelBlocks(
        pixels: SceneSurface[],
        data: Uint8ClampedArray,
        width: number,
        height: number
    ) {
        for (let i = 0; i < pixels.length; i++) {
            const pix = pixels[i];
            const texInfo = this.textureCache.getTexture(pix.texture);
            if (!texInfo) continue;
            const { data: texData, w: texW, h: texH } = texInfo;

            const sx = Math.floor(pix.texU * (texW - 1));
            const sy = Math.floor(pix.texV * (texH - 1));

            if (sx < 0 || sx >= texW || sy < 0 || sy >= texH) continue;

            const texIdx = (sy * texW + sx) * 4;
            let r = texData[texIdx];
            let g = texData[texIdx + 1];
            let b = texData[texIdx + 2];

            // depth shading
            // closer to 0 = brighter, farther = darker
            const depth = pix.depth || 1;
            const brightness = Math.max(0.15, 1.0 - (depth * 0.08));
            r = Math.floor(r * brightness);
            g = Math.floor(g * brightness);
            b = Math.floor(b * brightness);

            // block rendering
            const blockW = pix.width || 1;
            const blockH = pix.height || 1;
            const baseX = pix.screenX;
            const baseY = pix.screenY;

            // speed optimization for 1x1 blocks
            if (blockW === 1 && blockH === 1) {
                if (baseX >= 0 && baseX < width && baseY >= 0 && baseY < height) {
                    const screenIdx = (baseY * width + baseX) * 4;
                    data[screenIdx] = r;
                    data[screenIdx + 1] = g;
                    data[screenIdx + 2] = b;
                    data[screenIdx + 3] = 255;
                }
            } else {
                for (let by = 0; by < blockH; by++) {
                    const screenY = baseY + by;
                    if (screenY < 0 || screenY >= height) continue;
                    for (let bx = 0; bx < blockW; bx++) {
                        const screenX = baseX + bx;
                        if (screenX < 0 || screenX >= width) continue;
                        const screenIdx = (screenY * width + screenX) * 4;
                        data[screenIdx] = r;
                        data[screenIdx + 1] = g;
                        data[screenIdx + 2] = b;
                        data[screenIdx + 3] = 255;
                    }
                }
            }
        }
    }

}
