import { Animation } from '../src/video';

describe('Animation', () => {

    test('loops to last frame', () => {
        const anim = new Animation(16, 16, 0, 0, 3, 100, 1);
        anim.start();
        anim.update(100); // to frame 1
        anim.update(100); // frame 2
        anim.update(100); // wrap to 0
        expect(anim.getCurrentFrameNumber()).toBe(0);
    });

});