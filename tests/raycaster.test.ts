import { RaycasterCore, Raycaster } from '../src/raycaster';
import { Player } from '../src/gameObjects';
import { GameLevel } from '../src/gameLevel';

const SIMPLE_MAP =
    '00210021002100210021' +  // W W W W W
    '00210000000000000021' +  // W . . . W
    '00210000001100000021' +  // W . P . W
    '00210000000000000021' +  // W . . . W
    '00210021002100210021';   // W W W W W

const BLOCKED_MAP =
    '0021002100210021002100210021' +  // W W W W W W W
    '0021000000000000000000000021' +  // W . . . . . W
    '0021001100000021000000000021' +  // W P . W . . W
    '0021000000000000000000000021' +  // W . . . . . W
    '0021002100210021002100210021';   // W W W W W W W

function makeLevel(data = SIMPLE_MAP, size = '5x5'): GameLevel {
    return new GameLevel({ name: 'Test', size, data, floor_tile_id: 1, ceiling_tile_id: 2 });
}

function makeBlockedLevel(): GameLevel {
    return new GameLevel({ name: 'Blocked', size: '7x5', data: BLOCKED_MAP, floor_tile_id: 1, ceiling_tile_id: 2 });
}

describe('RaycasterCore.castRays', () => {

    test('all depths are positive and finite inside a closed map', () => {
        const core = new RaycasterCore(640, 480);
        const player = new Player(2.5, 2.5, 0);
        const level = makeLevel();
        core.castRays(player, level);
        for (const hit of core.wall_hit_results) {
            expect(hit.depth).toBeGreaterThan(0);
            expect(isFinite(hit.depth)).toBe(true);
        }
    });

    test('center ray hits the wall straight ahead at the expected depth', () => {
        // Player centered at (2.5, 2.5), facing right (angle=0).
        // Right wall is at tile x=4 so the distance should be: 4 - 2.5 = 1.5
        const core = new RaycasterCore(640, 480);
        const player = new Player(2.5, 2.5, 0);
        const level = makeLevel();
        core.castRays(player, level);
        const center = core.wall_hit_results[Math.floor(core.NUM_RAYS / 2)];
        expect(center.depth).toBeCloseTo(1.5, 1);
    });

    test('closer wall makes larger proj_height than farther', () => {
        const core = new RaycasterCore(640, 480);
        const level = makeLevel();

        // close to the wall on the right (distance 0.5)
        const playerClose = new Player(3.5, 2.5, 0);
        core.castRays(playerClose, level);
        const closeHeight = core.wall_hit_results[Math.floor(core.NUM_RAYS / 2)].proj_height;

        // farther from right wall (distance 1.5)
        const playerFar = new Player(2.5, 2.5, 0);
        core.castRays(playerFar, level);
        const farHeight = core.wall_hit_results[Math.floor(core.NUM_RAYS / 2)].proj_height;

        expect(closeHeight).toBeGreaterThan(farHeight);
    });

    test('detects closed doors as portal hits', () => {
        const mapWithDoor =
            '00210021002100210021' +  // W W W W W
            '00210000000000000021' +  // W . . . W
            '00210000001100010021' +  // W . P D W   D - TileType.DoorRed = 1 at (3,2)
            '00210000000000000021' +  // W . . . W
            '00210021002100210021';   // W W W W W

        const core = new RaycasterCore(640, 480);
        const player = new Player(2.5, 2.5, 0);  // facing the door
        const level = makeLevel(mapWithDoor);
        core.castRays(player, level);

        const hasPortalHits = core.portal_hit_results.some(hits => hits && hits.length > 0);
        expect(hasPortalHits).toBe(true);
    });

});

describe('RaycasterCore projection', () => {

    test('edge rays are close to half of FOV', () => {
        const core = new RaycasterCore(640, 480);
        expect(core.fixRayAngle(0)).toBeCloseTo(-core.HALF_FOV, 2);
        expect(core.fixRayAngle(core.NUM_RAYS - 1)).toBeCloseTo(core.HALF_FOV, 2);
    });

    test('object straight ahead is in the screen center', () => {
        const core = new RaycasterCore(640, 480);
        expect(core.getScreenX(0)).toBeCloseTo(320);
    });

    test('object at the edge of FOV is at the screen edge', () => {
        const core = new RaycasterCore(640, 480);
        expect(core.getScreenX(-core.HALF_FOV)).toBeCloseTo(0);
        expect(core.getScreenX(core.HALF_FOV)).toBeCloseTo(640);
    });

});

describe('Raycaster line-of-sight', () => {

    test('can see target in open space', () => {
        const raycaster = new Raycaster();
        const level = makeLevel();
        const source = new Player(2.5, 2.5, 0);
        const target = new Player(2.5, 3.5, 0);
        expect(raycaster.canSeeTarget(source, target, level, 10)).toBe(true);
    });

    test('cannot see target behind a wall', () => {
        const raycaster = new Raycaster();
        const level = makeBlockedLevel();
        // source at (1.5, 2.5), wall at (3,2), target at (5.5, 2.5)
        const source = new Player(1.5, 2.5, 0);
        const target = new Player(5.5, 2.5, 0);
        expect(raycaster.canSeeTarget(source, target, level, 10)).toBe(false);
    });

    test('target beyond maxDistance is not visible', () => {
        const raycaster = new Raycaster();
        const level = makeLevel();
        const source = new Player(2.5, 2.5, 0);
        const target = new Player(2.5, 3.5, 0);
        expect(raycaster.canSeeTarget(source, target, level, 0.5)).toBe(false); // short distance
    });

});