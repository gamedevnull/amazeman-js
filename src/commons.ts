export const GameConfig = {
    player: {
        walkSpeed: 0.004,
        rotateSpeed: 0.003
    }
}

export enum GameState {
    Title = 1,
    Loading,
    Playing,
    LevelComplete,
    GameOver
}

export enum GameObjectType {
    Player = "player", // string is easier to debug
    Coin = "coin",
    Key = "key",
    CatStatue = "catStatue"
}

export enum DoorKeyType {
    Red = 1,
    Green,
    Blue
}

export enum TextureType {
    WallsAndObjects = 2,
    FloorsAndCeilings,
    Coin,
    Skybox1,
    Skybox2,
    Skybox3,
    Door,
    Fonts,
    BgTitle,
    BgWin,
    BgLost
}