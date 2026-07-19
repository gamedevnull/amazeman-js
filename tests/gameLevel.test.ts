import { GameLevel, TileType, TileTypeHelper } from '../src/gameLevel';

const SIMPLE_MAP_DATA =
    '00210021002100210021' +  // W W W W W
    '00210000000000000021' +  // W . . . W
    '00210000001100000021' +  // W . S . W
    '00210000000000000021' +  // W . . . W
    '00210021002100210021';   // W W W W W

function makeLevel(data = SIMPLE_MAP_DATA, size = '5x5'): GameLevel {
    return new GameLevel({ name: 'Test', size, data, floor_tile_id: 1, ceiling_tile_id: 2 });
}

describe('TileTypeHelper', () => {

    test('walls', () => {
        expect(TileTypeHelper.isWall(TileType.Wall)).toBe(true);
        expect(TileTypeHelper.isWall(TileType.Empty)).toBe(false);
        expect(TileTypeHelper.isWall(TileType.DoorRed)).toBe(false);
        expect(TileTypeHelper.isWall(TileType.Coin)).toBe(false);
        expect(TileTypeHelper.isWall(50 as TileType)).toBe(true); // value >= 21 should be a wall
    });

    test('doors', () => {
        expect(TileTypeHelper.isDoor(TileType.DoorRed)).toBe(true);
        expect(TileTypeHelper.isDoor(TileType.DoorGreen)).toBe(true);
        expect(TileTypeHelper.isDoor(TileType.DoorBlue)).toBe(true);
        expect(TileTypeHelper.isDoor(TileType.Wall)).toBe(false);
    });

    test('keys', () => {
        expect(TileTypeHelper.getRequiredKeyForDoor(TileType.DoorRed)).not.toBe(TileType.Empty);
        expect(TileTypeHelper.getRequiredKeyForDoor(TileType.DoorGreen)).not.toBe(TileType.Empty);
        expect(TileTypeHelper.getRequiredKeyForDoor(TileType.DoorBlue)).not.toBe(TileType.Empty);
    });

});

describe('GameLevel construction', () => {

    test('initial state', () => {
        const level = makeLevel();
        // dimensions
        expect(level.cols).toBe(5);
        expect(level.rows).toBe(5);
        // start
        expect(level.playerStartX).toBe(2);
        expect(level.playerStartY).toBe(2);
    });

    test('walls coordinates', () => {
        const level = makeLevel();
        // designed
        expect(level.getTileType(0, 0)).toBe(TileType.Wall);
        expect(level.getTileType(4, 4)).toBe(TileType.Wall);
        // out-of-bounds
        expect(level.getTileType(-1, 0)).toBe(TileType.Wall);
        expect(level.getTileType(0, -1)).toBe(TileType.Wall);
        expect(level.getTileType(99, 99)).toBe(TileType.Wall);
    });

});

describe('GameLevel walkability', () => {

    test('player can move to the centre', () => {
        const level = makeLevel();
        expect(level.canMoveTo(2.5, 2.5, 0.2)).toBe(true);
    });

    test('player is blocked by the wall', () => {
        const level = makeLevel();
        expect(level.canMoveTo(0.5, 0.5, 0.2)).toBe(false);
    });

    test('player is blocked on the edge', () => {
        const level = makeLevel();
        // x: 3.85 + r: 0.2 pushes into the wall in column 4
        expect(level.canMoveTo(3.85, 2.5, 0.2)).toBe(false);
    });

});