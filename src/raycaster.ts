import {GameObject, Player} from "./gameObjects.js";
import {GameLevel, TileTypeHelper} from "./gameLevel.js";

export interface Ray {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

export interface RayIntersection {
    depth: number;
    x: number;
    y: number;
    texture_id: number;
    tileX: number;
    tileY: number;
}

export interface WallHit {
    depth: number;
    proj_height: number;
    wallType: "vertical" | "horizontal";
    texture_id: number;
    texture_offset: number;
    tileX?: number;
    tileY?: number;
}

export interface PortalHit {
    x: number;
    y: number;
    depth: number;
    wallType: "vertical" | "horizontal";
    texture_id: number;
    texture_offset: number;
    rayIndex: number;
    tileX: number;
    tileY: number;
    baseColor: string;
    portalType: "closed" | "opening" | "opened" | "exit";
}

export interface SceneColumn {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    depth: number;
    texture_id: number;
    texture_offset: number;
    texture_x: number;
    texture_y: number;
    texture_w: number;
    texture_h: number;
    wallType: "vertical" | "horizontal" | "sprite" | "animated_sprite";
    tileX?: number;
    tileY?: number;
    renderType?: string;
}

export interface SceneSurface {
    x: number;
    y: number;
    screenX: number;
    screenY: number;
    width?: number;
    height?: number;
    texture: number;
    texU: number;
    texV: number;
    depth: number;
}

export class RaycasterCore {

    SCREEN_WIDTH: number;
    SCREEN_HEIGHT: number;
    FOV: number;
    HALF_FOV: number;
    NUM_RAYS: number;
    HALF_NUM_RAYS: number;
    DELTA_ANGLE: number;
    MAX_DEPTH: number;
    STRIP_WIDTH: number;
    EPS: number = 1e-6;

    wall_hit_results: WallHit[];
    portal_hit_results: PortalHit[][];

    rays_for_minimap: Ray[];

    log: string = "";

    constructor(width: number = 640, height: number = 480) {
        this.SCREEN_WIDTH = width;
        this.SCREEN_HEIGHT = height;

        this.FOV = Math.PI / 3;
        this.NUM_RAYS = this.SCREEN_WIDTH / 2;

        this.HALF_NUM_RAYS = Math.floor(this.NUM_RAYS / 2);
        this.HALF_FOV = this.FOV / 2;

        this.DELTA_ANGLE = this.FOV / this.NUM_RAYS;
        this.MAX_DEPTH = 32; // in tiles units

        this.STRIP_WIDTH = Math.floor(this.SCREEN_WIDTH / this.NUM_RAYS);

        this.wall_hit_results = [];
        this.portal_hit_results = [];

        this.rays_for_minimap = [];
    }

    castRays(player: Player, map: GameLevel) {

        this.wall_hit_results = [];
        this.portal_hit_results = [];

        this.rays_for_minimap = [];

        const sx = player.posX;
        const sy = player.posY;

        let rayAngle = player.angle - this.HALF_FOV + 0.0001;

        let x_map = Math.floor(sx);
        let y_map = Math.floor(sy);

        for (let ray = 0; ray < this.NUM_RAYS; ray++) {

            const sin_a = Math.sin(rayAngle);
            const cos_a = Math.cos(rayAngle);

            const fishEyeFix = Math.cos(player.angle - rayAngle);

            const hIntersect = this.getHorizontalIntersections(sx, sy, sin_a, cos_a, y_map, map, ray, fishEyeFix);
            const vIntersect = this.getVerticalIntersections(sx, sy, sin_a, cos_a, x_map, map, ray, fishEyeFix);

            const depth_hor = hIntersect.depth;
            const depth_vert = vIntersect.depth;

            const x_hor = hIntersect.x;
            const y_vert = vIntersect.y;

            let depth: number, texture_id: number, texture_offset: number, tileX: number, tileY: number;
            let wallType: "vertical" | "horizontal";

            if (depth_vert < depth_hor) {

                depth = depth_vert;
                wallType = "vertical";
                texture_id = vIntersect.texture_id;
                let yv = y_vert % 1;
                texture_offset = cos_a > 0 ? yv : (1 - yv);
                tileX = vIntersect.tileX;
                tileY = vIntersect.tileY;

            } else {

                depth = depth_hor;
                wallType = "horizontal";
                texture_id = hIntersect.texture_id;
                let xh = x_hor % 1;
                texture_offset = sin_a > 0 ? (1 - xh) : xh;
                tileX = hIntersect.tileX;
                tileY = hIntersect.tileY;

            }

            this.rays_for_minimap.push({
                startX: sx,
                startY: sy,
                endX: sx + depth * cos_a,
                endY: sy + depth * sin_a
            });

            depth *= fishEyeFix;

            this.wall_hit_results.push({
                depth: depth,
                wallType: wallType,
                proj_height: this.SCREEN_HEIGHT / (depth + 0.0001),
                texture_id: texture_id,
                texture_offset: texture_offset,
                tileX: tileX,
                tileY: tileY
            });

            rayAngle += this.DELTA_ANGLE;
        }
    }

    getVerticalIntersections(
        ox: number, oy: number,
        sin_a: number, cos_a: number,
        x_map: number,
        map: GameLevel,
        rayIndex: number = -1,
        fishEyeFix: number = 1,
        breakOnClosedDoor: boolean = false
    ) : RayIntersection {

        if (Math.abs(cos_a) < this.EPS) {
            return {depth: Infinity, x: ox, y: oy, texture_id: 1, tileX: 0, tileY: 0};
        }

        let x_vert: number, dx: number;
        if (cos_a > 0) {
            x_vert = x_map + 1;
            dx = 1;
        } else {
            x_vert = x_map - this.EPS;
            dx = -1;
        }
        let depth_vert = (x_vert - ox) / cos_a;
        let y_vert = oy + depth_vert * sin_a;
        const delta_depth_vert = dx / cos_a;
        const dy_vert = delta_depth_vert * sin_a;

        let texture_id = 1;
        let portalHits: PortalHit[] = [];
        for (let i = 0; i < this.MAX_DEPTH; i++) {
            const tile_vert = [Math.floor(x_vert), Math.floor(y_vert)];
            const tileVal = map.mapArray[tile_vert[1]] && map.mapArray[tile_vert[1]][tile_vert[0]];

            if (TileTypeHelper.isDoor(tileVal) || TileTypeHelper.isOpenedDoor(tileVal) || TileTypeHelper.isExit(tileVal)) {
                if (breakOnClosedDoor && !TileTypeHelper.isOpenedDoor(tileVal)) {
                    break;
                }
                const centerX = tile_vert[0] + 0.5;
                const centerY = tile_vert[1] + 0.5;
                const dx_c = centerX - ox;
                const dy_c = centerY - oy;
                const t = (cos_a !== 0) ? dx_c / cos_a : dy_c / sin_a; // t = distance to center of tile
                const x_hit = ox + t * cos_a;
                const y_hit = oy + t * sin_a;
                let yv = y_hit % 1;
                let texture_offset = cos_a > 0 ? yv : (1 - yv);

                const portalType = TileTypeHelper.isOpenedDoor(tileVal) ? "opened" : "closed";

                portalHits.push({
                    x: x_hit,
                    y: y_hit,
                    depth: t * fishEyeFix,
                    wallType: "vertical",
                    texture_id: map.getTileType(tile_vert[0], tile_vert[1]),
                    texture_offset,
                    rayIndex: rayIndex ?? -1,
                    tileX: tile_vert[0],
                    tileY: tile_vert[1],
                    baseColor: map.getDoorColorAt(tile_vert[0], tile_vert[1]),
                    portalType: (TileTypeHelper.isExit(tileVal)) ? "exit" : portalType
                });

            } else if (TileTypeHelper.isWall(tileVal)) {
                texture_id = tileVal;
                break;
            }

            x_vert += dx;
            y_vert += dy_vert;
            depth_vert += delta_depth_vert;
        }
        if (rayIndex !== undefined && portalHits.length > 0) {
            if (!this.portal_hit_results[rayIndex]) this.portal_hit_results[rayIndex] = [];
            this.portal_hit_results[rayIndex].push(...portalHits);
        }
        return {depth: depth_vert, x: x_vert, y: y_vert, texture_id: texture_id, tileX: Math.floor(x_vert), tileY: Math.floor(y_vert)};
    }

    getHorizontalIntersections(
        ox: number, oy: number,
        sin_a: number, cos_a: number,
        y_map: number,
        map: GameLevel,
        rayIndex: number = -1,
        fishEyeFix: number = 1,
        breakOnClosedDoor: boolean = false
    ) : RayIntersection {
        if (Math.abs(sin_a) < this.EPS) {
            return {depth: Infinity, x: ox, y: oy, texture_id: 1, tileX: 0, tileY: 0};
        }
        let y_hor: number;
        let dy: number;
        if (sin_a > 0) {
            y_hor = y_map + 1;
            dy = 1;
        } else {
            y_hor = y_map - this.EPS;
            dy = -1;
        }

        let depth_hor = (y_hor - oy) / sin_a;
        let x_hor = ox + depth_hor * cos_a;

        const delta_depth_hor = dy / sin_a;
        const dx_hor = delta_depth_hor * cos_a;

        let texture_id = 1;
        let portalHits: PortalHit[] = [];
        for (let i = 0; i < this.MAX_DEPTH; i++) {
            const tile_hor = [Math.floor(x_hor), Math.floor(y_hor)];
            const tileVal = map.mapArray[tile_hor[1]] && map.mapArray[tile_hor[1]][tile_hor[0]];

            if (TileTypeHelper.isDoor(tileVal) || TileTypeHelper.isOpenedDoor(tileVal) || TileTypeHelper.isExit(tileVal)) {
                if (breakOnClosedDoor && !TileTypeHelper.isOpenedDoor(tileVal)) {
                    break;
                }

                const centerX = tile_hor[0] + 0.5;
                const centerY = tile_hor[1] + 0.5;
                const dx_c = centerX - ox;
                const dy_c = centerY - oy;
                const t = (sin_a !== 0) ? dy_c / sin_a : dx_c / cos_a; // t = distance to center of tile
                const x_hit = ox + t * cos_a;
                const y_hit = oy + t * sin_a;
                let xh = x_hit % 1;
                let texture_offset = sin_a > 0 ? (1 - xh) : xh;

                const portalType = TileTypeHelper.isOpenedDoor(tileVal) ? "opened" : "closed";

                portalHits.push({
                    x: x_hit,
                    y: y_hit,
                    depth: t * fishEyeFix,
                    wallType: "horizontal",
                    texture_id: map.getTileType(tile_hor[0], tile_hor[1]),
                    texture_offset,
                    rayIndex: rayIndex ?? -1,
                    tileX: tile_hor[0],
                    tileY: tile_hor[1],
                    baseColor: map.getDoorColorAt(tile_hor[0], tile_hor[1]),
                    portalType: (TileTypeHelper.isExit(tileVal)) ? "exit" : portalType
                });

            } else if (TileTypeHelper.isWall(tileVal)) {
                texture_id = tileVal;
                break;
            }

            x_hor += dx_hor;
            y_hor += dy;
            depth_hor += delta_depth_hor;
        }
        if (rayIndex !== undefined && portalHits.length > 0) {
            if (!this.portal_hit_results[rayIndex]) this.portal_hit_results[rayIndex] = [];
            this.portal_hit_results[rayIndex].push(...portalHits);
        }
        return {depth: depth_hor, x: x_hor, y: y_hor, texture_id: texture_id, tileX: Math.floor(x_hor), tileY: Math.floor(y_hor)};
    }

}

export class Raycaster {

    log: string = "";

    scene_objects: SceneColumn[] = [];
    scene_floor: SceneSurface[] = [];
    scene_ceiling: SceneSurface[] = [];

    raycasterCore: RaycasterCore;

    constructor(width: number = 640, height: number = 480) {
        this.raycasterCore = new RaycasterCore(width, height);
    }

    // yes, its a mess 3x
    get wall_hit_results() { return this.raycasterCore.wall_hit_results; }
    get portal_hit_results() { return this.raycasterCore.portal_hit_results; }
    get rays_for_minimap() { return this.raycasterCore.rays_for_minimap; }

    update(player: Player, map: GameLevel, gameObjects: GameObject[], showWalls = true, usePrimitivePortals = false): void
    {
        this.log = "";

        this.raycasterCore.castRays(player, map);

        this.castFloorAndCeilingScanline(player, map);

        //const before = gameObjects.length;
        const visibleObjects = gameObjects.filter(obj => this.isVisibleForPlayer(player, obj, map));
        //const after = visibleObjects.length;

        //this.log = `culling: ${before} -> ${after}`;

        this.prepareScene(player, visibleObjects, map, showWalls, usePrimitivePortals);
    }

    prepareScene(player: Player, gameObjects: GameObject[], currentLevel: GameLevel, showWalls = true, usePrimitivePortals = true) {
        this.scene_objects = [];

        if (showWalls) {
            // just normal walls, without portals, animations, etc.
            for (let ray = 0; ray < this.wall_hit_results.length; ray++) {
                this.scene_objects.push(this.makeWallColumn(ray, this.wall_hit_results[ray]));
            }
        }

        // group portal hits by tile coordinates and type, so each group can render the same portal only once
        const portalGroups = new Map<string, PortalHit[]>();
        for (let ray = 0; ray < this.portal_hit_results.length; ray++) {
            for (const hit of this.portal_hit_results[ray] || []) {
                const key = `${hit.tileX}_${hit.tileY}_${hit.portalType}_${hit.wallType}`;
                if (!portalGroups.has(key)) portalGroups.set(key, []);
                portalGroups.get(key)!.push(hit);
            }
        }

        // each group is a set of portal hits for the same wall/door tile
        for (const groupHits of portalGroups.values()) {

            const numBars = 7; // for primitive portal rendering mode (in early game version)

            const getFrac = (ray: PortalHit) =>
                groupHits[0].wallType === "vertical"
                    ? ((ray.y % 1 + 1) % 1)
                    : ((ray.x % 1 + 1) % 1);

            const fracs = groupHits.map(getFrac);
            let minFrac = Math.min(...fracs);
            let maxFrac = Math.max(...fracs);
            let visibleRange = maxFrac - minFrac;

            groupHits.sort((a, b) => a.rayIndex - b.rayIndex);

            if (groupHits[0].portalType === "closed") {

                if (usePrimitivePortals) { // primitive portal rendering mode / no textures

                    for (let bar = 0; bar < numBars; bar++) {

                        const barStart = minFrac + (visibleRange * bar / numBars);
                        const barEnd = minFrac + (visibleRange * (bar + 1) / numBars);

                        for (const ray of groupHits) {

                            const frac = getFrac(ray);
                            const inBar = barEnd <= 1
                                ? (frac >= barStart && frac < barEnd)
                                : (frac >= barStart || frac < (barEnd % 1));

                            if (inBar && bar % 2 === 0) {
                                let proj_height = this.raycasterCore.SCREEN_HEIGHT / (ray.depth + 0.0001);
                                const percentageDoorTransition = currentLevel.getDoorTransitionProgress(ray.tileX, ray.tileY);
                                proj_height *= (1 - percentageDoorTransition);
                                this.scene_objects.push(this.makePortalColumn(ray, proj_height));
                            }
                        }
                    }

                } else {

                    for (const ray of groupHits) {
                        const proj_height = this.raycasterCore.SCREEN_HEIGHT / (ray.depth + 0.0001);
                        this.scene_objects.push(this.makePortalColumn(ray, proj_height));
                    }

                }

            } else if (groupHits[0].portalType === "opened") {

                if (usePrimitivePortals) { // no textures mode

                    const edgeFrac = visibleRange * 0.1;

                    for (const ray of groupHits) {
                        const frac = getFrac(ray);
                        if ((frac >= minFrac && frac < minFrac + edgeFrac) ||
                            (frac > maxFrac - edgeFrac && frac <= maxFrac)) {
                            let proj_height = this.raycasterCore.SCREEN_HEIGHT / (ray.depth + 0.0001);
                            const percentageDoorTransition = currentLevel.getDoorTransitionProgress(ray.tileX, ray.tileY);
                            if (percentageDoorTransition < 1) {
                                proj_height *= (1 - percentageDoorTransition);
                            }
                            this.scene_objects.push(this.makePortalColumn(ray, proj_height));
                        }
                    }

                } else {

                    for (const ray of groupHits) {
                        const proj_height = this.raycasterCore.SCREEN_HEIGHT / (ray.depth + 0.0001);
                        this.scene_objects.push(this.makePortalColumn(ray, proj_height));
                    }
                }

            } else if (groupHits[0].portalType === "exit") {

                for (const ray of groupHits) {
                    const proj_height = this.raycasterCore.SCREEN_HEIGHT / (ray.depth + 0.0001);
                    this.scene_objects.push(this.makePortalColumn(ray, proj_height));
                }
            }
        }

        // Rendering sprites for game objects
        for (let obj_it = 0; obj_it < gameObjects.length; obj_it++) {

            const obj = gameObjects[obj_it];

            // position relative to player
            const dx = obj.posX - player.posX;
            const dy = obj.posY - player.posY;
            const distance = Math.hypot(dx, dy);

            // angle between player direction and sprite
            let theta = Math.atan2(dy, dx);
            let delta = theta - player.angle;

            if (delta > Math.PI) delta -= 2 * Math.PI;
            if (delta < -Math.PI) delta += 2 * Math.PI;

            // sprite is not in FOV
            if (Math.abs(delta) > this.raycasterCore.HALF_FOV + 0.2) continue;

            // screen projection size
            const normDistance = distance * Math.cos(delta);
            if (normDistance <= 0.5) continue;

            if (!obj.sprite) continue;

            const sprite = obj.sprite;

            const proj = (this.raycasterCore.SCREEN_HEIGHT / normDistance) * sprite.scale;
            const projWidth = proj * (sprite.width / sprite.height);
            const projHeight = proj;

            // screen position
            const deltaRays = delta / (this.raycasterCore.FOV / this.raycasterCore.NUM_RAYS);
            const halfNumRays = this.raycasterCore.NUM_RAYS / 2;
            const scale = this.raycasterCore.SCREEN_WIDTH / this.raycasterCore.NUM_RAYS;
            const screenX = (halfNumRays + deltaRays) * scale;

            const x = screenX - projWidth / 2;
            const y = (this.raycasterCore.SCREEN_HEIGHT / 2) - projHeight / 2 + projHeight * sprite.shift;

            this.scene_objects.push(this.makeSpriteColumn(
                x, y, projWidth, projHeight,
                obj.baseColor, normDistance,
                sprite.texture_id, sprite.texture_x, sprite.texture_y,
                sprite.width, sprite.height
            ));
        }

    }

    castFloorAndCeilingScanline(player: Player, map: GameLevel) {
        this.scene_floor = [];
        this.scene_ceiling = [];

        const width = this.raycasterCore.SCREEN_WIDTH;
        const height = this.raycasterCore.SCREEN_HEIGHT;
        const halfHeight = height / 2;
        const px = player.posX;
        const py = player.posY;
        const angle = player.angle;

        if (!this.wall_hit_results.length) return;

        const getQuality = (distance: number) => {
            if (distance < 1) return { stepX: 2, stepY: 1 };
            if (distance < 2) return { stepX: 3, stepY: 1 };
            return { stepX: 4, stepY: 1 };
        };

        // precompute ray data for each screen column to make it all faster
        const rayData: {
            rayIndex: number,
            rayAngle: number,
            rayDirX: number,
            rayDirY: number,
            cosRay: number
        }[] = [];
       // for (let x = 0; x < width; x += 1) {
        for (let rayIndex = 0; rayIndex < this.raycasterCore.NUM_RAYS; rayIndex++) {
            //const rayIndex = Math.floor(x / this.STRIP_WIDTH);
            const rayAngle = angle - this.raycasterCore.HALF_FOV + (rayIndex + 0.5) * this.raycasterCore.DELTA_ANGLE;
            rayData[rayIndex] = {
                rayIndex,
                rayAngle,
                rayDirX: Math.cos(rayAngle),
                rayDirY: Math.sin(rayAngle),
                cosRay: Math.cos(rayAngle - player.angle)
            };
        }

        // floor (center -> bottom)
        for (let y = halfHeight; y < height; y++) {
            const p = y - halfHeight;
            const rowDistance = (halfHeight) / p;
            const quality = getQuality(rowDistance);

            if (y % quality.stepY !== 0) continue; // skip some rows

            for (let x = 0; x < width; x += quality.stepX) {
                const rayIndex = Math.floor(x / this.raycasterCore.STRIP_WIDTH);
                const ray = rayData[rayIndex];
                if (!ray) continue;

                const wallHit = this.wall_hit_results[rayIndex];
                if (!wallHit) continue;
                const wallDepth = wallHit.depth;
                if (rowDistance >= wallDepth) continue;

                // use precomputed values
                const correctedRowDistance = rowDistance / ray.cosRay;
                const floorX = px + correctedRowDistance * ray.rayDirX;
                const floorY = py + correctedRowDistance * ray.rayDirY;

                const mapX = Math.floor(floorX);
                const mapY = Math.floor(floorY);

                if (!map.isWallsTile(mapX, mapY)) {
                    this.scene_floor.push({
                        x: floorX,
                        y: floorY,
                        screenX: x,
                        screenY: y,
                        width: quality.stepX,
                        height: quality.stepY,
                        texture: map.getFloorTileId(mapX, mapY),
                        texU: floorX % 1,
                        texV: floorY % 1,
                        depth: rowDistance
                    });
                }
            }
        }

        if (map.getSkyboxId()) {
            return;
        }

        // ceiling (center -> top)
        for (let y = 0; y < halfHeight; y++) {
            const p = halfHeight - y;
            const rowDistance = (halfHeight) / p;
            const quality = getQuality(rowDistance);

            if (y % quality.stepY !== 0) continue; // skip some rows

            for (let x = 0; x < width; x += quality.stepX) {
                const rayIndex = Math.floor(x / this.raycasterCore.STRIP_WIDTH);
                const ray = rayData[rayIndex];
                if (!ray) continue;

                const wallHit = this.wall_hit_results[rayIndex];
                if (!wallHit) continue;
                const wallDepth = wallHit.depth;
                if (rowDistance >= wallDepth) continue;

                // use precomputed values
                const correctedRowDistance = rowDistance / ray.cosRay;
                const ceilX = px + correctedRowDistance * ray.rayDirX;
                const ceilY = py + correctedRowDistance * ray.rayDirY;

                const mapX = Math.floor(ceilX);
                const mapY = Math.floor(ceilY);

                if (!map.isWallsTile(mapX, mapY)) {
                    this.scene_ceiling.push({
                        x: ceilX,
                        y: ceilY,
                        screenX: x,
                        screenY: y,
                        width: quality.stepX,
                        height: quality.stepY,
                        texture: map.getCeilingTileId(mapX, mapY),
                        texU: ceilX % 1,
                        texV: ceilY % 1,
                        depth: rowDistance
                    });
                }
            }
        }
    }

    canSeeTarget(source: GameObject, target: GameObject, map: GameLevel, maxDistance: number = 6): boolean
    {
        return this.inLineOfSight(source, target, map, maxDistance, true);
    }

    isVisibleForPlayer(player: Player, obj: GameObject, map: GameLevel): boolean
    {
        return this.inLineOfSight(player, obj, map, 16, false, player.angle);
    }

    inLineOfSight(source: GameObject,
                  target: GameObject,
                  map: GameLevel,
                  maxSightDistance: number = 10,
                  breakOnClosedDoor: boolean = true,
                  sourceAngle: number | null = null
    ): boolean
    {
        // source
        const sx = source.position.x;
        const sy = source.position.y;

        // target
        const tx = target.position.x;
        const ty = target.position.y;

        // delta
        const dx = tx - sx;
        const dy = ty - sy;

        const distance = Math.hypot(dx, dy);

        if (distance > maxSightDistance) {
            return false; // too far away from each other -> NOT visible
        }

        const angle = Math.atan2(dy, dx);

        if (sourceAngle !== null) {
            let delta = angle - sourceAngle;
            if (delta > Math.PI) delta -= 2 * Math.PI;
            if (delta < -Math.PI) delta += 2 * Math.PI;
            if (Math.abs(delta) > this.raycasterCore.HALF_FOV) {
                return false; // outside of source's FOV -> NOT visible
            }
        }

        const sin_a = Math.sin(angle);
        const cos_a = Math.cos(angle);

        const x_map = Math.floor(sx);
        const y_map = Math.floor(sy);

        // for compatibility with intersections functions
        const rayIndex = -1;
        const fishEyeFix = 1;

        const vert = this.raycasterCore.getVerticalIntersections(sx, sy, sin_a, cos_a, x_map, map, rayIndex, fishEyeFix, breakOnClosedDoor);
        const hor = this.raycasterCore.getHorizontalIntersections(sx, sy, sin_a, cos_a, y_map, map, rayIndex, fishEyeFix, breakOnClosedDoor);

        const minDepth = Math.min(vert.depth, hor.depth);
        //console.log("checking: " + source.objectType + " -> " + target.objectType + " vert" + vert.depth + " hor " + hor.depth + " sin_a " + sin_a.toFixed(2) + " cos_a " + cos_a.toFixed(2));

        return distance < minDepth; // if target is closer than the nearest wall, then IT IS visible
    }

    private makeWallColumn(rayIndex: number, hit: WallHit): SceneColumn {
        return {
            x: rayIndex * this.raycasterCore.STRIP_WIDTH,
            y: (this.raycasterCore.SCREEN_HEIGHT / 2) - (hit.proj_height / 2),
            width: this.raycasterCore.STRIP_WIDTH,
            height: hit.proj_height,
            color: hit.wallType === "vertical" ? "#adadad" : "#898989",
            depth: hit.depth,
            texture_id: hit.texture_id,
            texture_offset: hit.texture_offset,
            texture_x: 0, texture_y: 0, texture_w: 0, texture_h: 0,
            wallType: hit.wallType,
            tileX: hit.tileX,
            tileY: hit.tileY,
            renderType: "wall"
        };
    }

    private makePortalColumn(ray: PortalHit, projHeight: number): SceneColumn {
        return {
            x: ray.rayIndex * this.raycasterCore.STRIP_WIDTH,
            y: (this.raycasterCore.SCREEN_HEIGHT / 2) - (projHeight / 2),
            width: this.raycasterCore.STRIP_WIDTH,
            height: projHeight,
            color: ray.baseColor,
            depth: ray.depth,
            texture_id: ray.texture_id,
            texture_offset: ray.texture_offset,
            texture_x: 0, texture_y: 0, texture_w: 0, texture_h: 0,
            wallType: ray.wallType,
            tileX: ray.tileX,
            tileY: ray.tileY,
            renderType: "wall"
        };
    }

    private makeSpriteColumn(
        x: number, y: number, projWidth: number, projHeight: number,
        color: string, normDistance: number,
        texture_id: number, texture_x: number, texture_y: number,
        texture_w: number, texture_h: number
    ): SceneColumn {
        return {
            x, y,
            width: projWidth,
            height: projHeight,
            color,
            depth: normDistance,
            texture_id,
            texture_offset: 0,
            texture_x, texture_y, texture_w, texture_h,
            wallType: "sprite",
            renderType: "sprite"
        };
    }

}

