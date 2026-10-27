export enum SoundId {
    CoinPicked = 'coinPicked',
    KeyPicked = 'keyPicked',
    DoorOpened = 'doorOpened',
    DoorLocked = 'doorLocked',
    Done = 'done',
    Fail = 'fail',
    Music = 'music',
    StepStone = 'stepStone',
}

export class SoundEffect {
    play(): void {}
    stop(): void {}
    isPlaying(): boolean { return false; }
    setVolume(_volume: number): this { return this; }
    setEnabled(_enabled: boolean): void {}
}

export class SoundManager {
    async loadSounds(): Promise<void> {}
    get(_id: SoundId): SoundEffect | undefined { return new SoundEffect(); }
    fixContext(): void {}
    setVolume(_id: SoundId, _volume: number): void {}
    setAllEnabled(_enabled: boolean): void {}
}