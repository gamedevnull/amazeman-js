export class RenderableSprite {

    x: number;
    y: number;

    width: number;
    height: number

    texture_id: number;
    texture_x: number;
    texture_y: number;

    scale: number;
    shift: number;

    facePlayer: boolean = true;

    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        texture_id: number,
        texture_x: number,
        texture_y: number,
        scale: number = 0.8,
        shift: number = 0.2
    ) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.texture_id = texture_id;
        this.texture_x = texture_x;
        this.texture_y = texture_y;
        this.scale = scale;
        this.shift = shift;
    }

    animate(animation: Animation) {
        const frameNumber = animation.getCurrentFrameNumber();
        this.texture_x = (animation.startCol * this.width) + (frameNumber * this.width);
        this.texture_y = (animation.startRow * this.height);
    }
}

export class Animation {
    width: number;
    height: number;
    startRow: number;
    startCol: number;
    length: number;
    delay: number;
    loop: number;
    currentFrame: number;
    timer: number;
    isPlaying: boolean = false;
    direction: number = 1; // 1 -> forward, -1 -> backward

    constructor(width: number, height: number, startRow: number, startCol: number, length: number, delay: number = 100, loop: number = 1) {
        this.width = width;
        this.height = height;
        this.length = length;
        this.startRow = startRow || 0;
        this.startCol = startCol || 0;
        this.currentFrame = 0;
        this.timer = 0;
        this.delay = delay;
        this.loop = loop;
    }

    start(): void {
        this.isPlaying = true;
    }

    stop(): void {
        this.isPlaying = false;
    }

    isOn(): boolean {
        return this.isPlaying;
    }

    update(deltaTime: number): void {

        if (!this.isOn()) return;

        this.timer += deltaTime;
        if (this.timer < this.delay) return;
        this.timer = 0;

        const nextFrame = this.currentFrame + this.direction;

        if (this.loop) {

            const len = this.length;
            this.currentFrame = ((nextFrame % len) + len) % len;

        } else {

            if (nextFrame < 0) {
                this.currentFrame = 0;
                this.stop();
            } else if (nextFrame > this.length - 1) {
                this.currentFrame = this.length - 1;
                this.stop();
            } else {
                this.currentFrame = nextFrame;
            }
        }

    }

    reset(): void {
        this.currentFrame = 0;
        this.timer = 0;
    }

    isFinished(): boolean {
        return (!this.loop && this.currentFrame === (this.length - 1));
    }

    getCurrentFrameNumber(): number {
        return this.currentFrame;
    }
}

export class RenderableObject {

    x: number;
    y: number;
    sprite: RenderableSprite;

    constructor(
        x: number,
        y: number,
        sprite: RenderableSprite
    ) {
        this.x = x;
        this.y = y;
        this.sprite = sprite;
    }

    update(
        deltaTime: number
    ) {

    }

    getAnimatedSprite(animation: Animation) {

        const frameNumber = animation.getCurrentFrameNumber();
        const texture_w = this.sprite.width;
        const texture_h = this.sprite.height;
        const texture_x = (animation.startCol * texture_w) + (frameNumber * texture_w);
        const texture_y = (animation.startRow * texture_h);

        this.sprite.texture_x = texture_x;
        this.sprite.texture_y = texture_y;

        return this.sprite;
    }

    getSprite(): RenderableSprite {
        return this.sprite;
    }
}