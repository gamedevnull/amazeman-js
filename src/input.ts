export class Input {
    keys: { [key: string]: boolean };

    constructor() {
        this.keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            ' ': false,
            'd': false,
            'm': false,
            'f': false,
            // '[': false,
            // ']': false,
            // '9': false,
            // '0': false,
            // ',': false,
            // '.': false
        };

        window.addEventListener('keydown', (event) => {
            if (event.key in this.keys) {
                this.keys[event.key] = true;
                event.preventDefault();
            }
        });

        window.addEventListener('keyup', (event) => {
            if (event.key in this.keys) {
                this.keys[event.key] = false;
                event.preventDefault();
            }
        });
    }
}