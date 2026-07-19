export class SoundEffect {
    private static audioContext: AudioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    private src: string;
    private buffer: AudioBuffer | null = null;
    private mute: boolean = false;
    private playing: boolean = false;
    private gainNode: GainNode;
    private currentSource: AudioBufferSourceNode | null = null;
    private previousVolume: number = 1;

    constructor(src: string) {
        this.src = src;
        this.gainNode = SoundEffect.audioContext.createGain();
        this.gainNode.connect(SoundEffect.audioContext.destination);
        this.initBuffer();
    }

    public setVolume(volume: number): this {
        if (!this.mute) {
            this.gainNode.gain.value = volume;
        }
        this.previousVolume = volume;
        return this;
    }

    public setEnabled(enabled: boolean): void {
        this.mute = !enabled;
        this.gainNode.gain.value = this.mute ? 0 : this.previousVolume;
    }

    private async initBuffer(): Promise<void> {
        try {
            const response = await fetch(this.src);
            const arrayBuffer = await response.arrayBuffer();
            this.buffer = await SoundEffect.audioContext.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error('Sound init error:', e);
        }
    }

    public async play(): Promise<void> {
        if (this.mute || !this.buffer) {
            return;
        }
        try {
            if (SoundEffect.audioContext.state === 'suspended') {
                await SoundEffect.audioContext.resume();
            }
            const source = SoundEffect.audioContext.createBufferSource();
            source.buffer = this.buffer;
            source.connect(this.gainNode);
            source.start(0);
            this.currentSource = source;
            this.playing = true;
            source.onended = () => {
                this.playing = false;
                this.currentSource = null;
            };
        } catch (e) {
            console.error('Sound playing error:', e);
        }
    }

    public stop(): void {
        if (this.currentSource) {
            this.currentSource.stop();
            this.currentSource.disconnect();
            this.currentSource = null;
            this.playing = false;
        }
    }

    public isPlaying(): boolean {
        return this.playing;
    }
}

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

export class SoundManager {
    private sounds: Map<SoundId, SoundEffect> = new Map();

    constructor() {
    }

    async loadSounds() {
        const soundSources = new Map<SoundId, string>([
            [SoundId.CoinPicked, 'res/coin.mp3'],
            [SoundId.KeyPicked, 'res/key.mp3'],
            [SoundId.DoorOpened, 'res/open.mp3'],
            [SoundId.DoorLocked, 'res/locked.mp3'],
            [SoundId.Done, 'res/done.mp3'],
            [SoundId.Music, 'res/music.mp3'],
            [SoundId.StepStone, 'res/steps.mp3'],
            [SoundId.Fail, 'res/failed.mp3'],
        ]);

        for (const [id, src] of soundSources) {
            const sound = new SoundEffect(src);
            this.sounds.set(id, sound);
        }
    }

    get(id: SoundId): SoundEffect | undefined {
        return this.sounds.get(id);
    }

    setVolume(id: SoundId, volume: number) {
        const sound = this.sounds.get(id);
        if (sound) sound.setVolume(volume);
    }

    // TODO use for mute toggle
    setAllEnabled(enabled: boolean) {
        for (const sound of this.sounds.values()) {
            sound.setEnabled(enabled);
        }
    }
}