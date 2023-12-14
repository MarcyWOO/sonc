const WASM_initInput = (() => {
    let WASM_canvas = document.getElementById("canvas");

    let WASM_mouseDownHandler = null;
    let WASM_mouseUpHandler = null;
    let WASM_mouseMoveHandler = null;
    let WASM_keyDownHandler = null;
    let WASM_keyUpHandler = null;
    let WASM_rect = null;
    
    WASM_rect = WASM_canvas.getBoundingClientRect();

    window.addEventListener("resize", () => {
        WASM_rect = WASM_canvas.getBoundingClientRect();
    }, { passive: true });

    // gotta scale the coordinates to the canvas size since the canvas is scaled to fit the window
    const WASM_scaleCoordinates = (e) => {
        const x = e.clientX - WASM_rect.left;
        const y = e.clientY - WASM_rect.top;

        return { x: x * WASM_canvas.width / WASM_rect.width, y: y * WASM_canvas.height / WASM_rect.height };
    }

    WASM_canvas.addEventListener("mousedown", (ev) => {
        if (WASM_mouseDownHandler === null) {
            WASM_mouseDownHandler = Module.mono_bind_static_method(
                "[Sonic4Episode1.Wasm]Microsoft.Xna.Framework.Input.WasmMouse:InjectMouseDown");
        }

        let coords = WASM_scaleCoordinates(ev);
        WASM_mouseDownHandler(coords.x, coords.y, ev.button);
    })

    WASM_canvas.addEventListener("mouseup", (ev) => {
        if (WASM_mouseUpHandler === null) {
            WASM_mouseUpHandler = Module.mono_bind_static_method(
                "[Sonic4Episode1.Wasm]Microsoft.Xna.Framework.Input.WasmMouse:InjectMouseUp");
        }

        let coords = WASM_scaleCoordinates(ev);
        WASM_mouseUpHandler(coords.x, coords.y, ev.button);
    })

    WASM_canvas.addEventListener("mousemove", (ev) => {
        if (WASM_mouseMoveHandler === null) {
            WASM_mouseMoveHandler = Module.mono_bind_static_method(
                "[Sonic4Episode1.Wasm]Microsoft.Xna.Framework.Input.WasmMouse:InjectMouseMove");
        }

        let coords = WASM_scaleCoordinates(ev);
        WASM_mouseMoveHandler(coords.x, coords.y);
    })

    document.addEventListener("keydown", (ev) => {
        if (WASM_keyDownHandler === null) {
            WASM_keyDownHandler = Module.mono_bind_static_method(
                "[Sonic4Episode1.Wasm]Microsoft.Xna.Framework.Input.WasmKeyboard:InjectKeyDown");
        }

        WASM_keyDownHandler(ev.keyCode);

    });

    document.addEventListener("keyup", (ev) => {
        if (WASM_keyUpHandler === null) {
            WASM_keyUpHandler = Module.mono_bind_static_method(
                "[Sonic4Episode1.Wasm]Microsoft.Xna.Framework.Input.WasmKeyboard:InjectKeyUp");
        }

        WASM_keyUpHandler(ev.keyCode);
    });

    // TODO: when uno get their shit together, this should help enable touch support

    // let WASM_touchHandler = null;
    // let WASM_TouchLocationState = {
    //     Invalid: 0,
    //     Released: 1,
    //     Pressed: 2,
    //     Moved: 3
    // };

    // let WASM_touches = [
    //     null,
    //     null,
    //     null,
    //     null,
    //     null,
    //     null,
    //     null,
    //     null,
    // ]

    // // each touch needs an index 0-7, find the first null one and use that
    // document.addEventListener("touchstart", (ev) => {
    //     if (WASM_touchHandler === null) {
    //         WASM_touchHandler = Module.mono_bind_static_method(
    //             "[FNA]Microsoft.Xna.Framework.Input.Touch.TouchPanel:SetFinger");
    //     }

    //     for (let i = 0; i < ev.changedTouches.length; i++) {
    //         let touch = ev.changedTouches[i];
    //         let index = WASM_touches.indexOf(null);
    //         if (index === -1) {
    //             console.log("too many touches");
    //             return;
    //         }

    //         WASM_touches[index] = touch;
    //         let coords = WASM_scaleCoordinates(touch);
    //         WASM_touchHandler(index, WASM_TouchLocationState.Pressed, coords.x, coords.y);
    //     }  
    // });

    // document.addEventListener("touchend", (ev) => {
    //     if (WASM_touchHandler === null) {
    //         WASM_touchHandler = Module.mono_bind_static_method(
    //             "[FNA]Microsoft.Xna.Framework.Input.Touch.TouchPanel:SetFinger");
    //     }
        
    // });

    // document.addEventListener("touchmove", (ev) => {
    //     if (WASM_touchHandler === null) {
    //         WASM_touchHandler = Module.mono_bind_static_method(
    //             "[FNA]Microsoft.Xna.Framework.Input.Touch.TouchPanel:SetFinger");
    //     }
        
    // });


    const MediaState = {
        Stopped: 0,
        Playing: 1,
        Paused: 2
    };

    class WasmMediaPlayer {
        constructor() {
            this.volume = 1;
            this.context = new AudioContext();
            this.gainNode = this.context.createGain();
            this.gainNode.connect(this.context.destination);

            this.onEnded = this.onEnded.bind(this);

            this.isGarbage = document.createElement("audio").canPlayType("audio/ogg") === "";
        }

        setVolume(vol) {
            this.volume = vol;
            this.gainNode.gain.value = vol;
        }

        getVolume() {
            return this.volume;
        }

        play(path, loopPos) {
            this.getAudioBuffer(path)
                .then(audioBuffer => {
                    this.playQueue(audioBuffer, loopPos);
                })
        }

        stop() {
            if (this.source) {
                this.source.stop();
                this.source = null;
            }
        }

        playQueue(buffer, loopPos) {
            if (this.source) {
                this.source.removeEventListener("ended", this.onEnded);
                this.source.stop();
            }

            this.source = this.context.createBufferSource();
            this.source.buffer = buffer;
            this.source.connect(this.gainNode);
            this.source.addEventListener("ended", this.onEnded);

            if (loopPos !== undefined) {
                this.source.loopStart = loopPos;
                this.source.loopEnd = buffer.duration;
                this.source.loop = true;
            }

            this.source.start();
            this.setState(MediaState.Playing);
        }

        getAudioBuffer(path) {
            path = "/sonic4" + path;
            if (this.isGarbage) {
                path = path.substring(0, path.length - 4) + ".m4a";
            }

            return window.fetch(path)
                .then(response => response.arrayBuffer())
                .then(arrayBuffer => this.context.decodeAudioData(arrayBuffer));
        }

        onEnded(e) {
            this.setState(MediaState.Stopped);
        }

        setState(state) {
            if (this.Microsoft_Xna_Framework_Media_WasmMediaPlayer_ChangeState === undefined) {
                this.Microsoft_Xna_Framework_Media_WasmMediaPlayer_ChangeState = Module.mono_bind_static_method(
                    "[Sonic4Episode1.Wasm]Microsoft.Xna.Framework.Media.WasmMediaPlayer:ChangeState");
            }

            this.Microsoft_Xna_Framework_Media_WasmMediaPlayer_ChangeState(state);
        }
    }

    window.WASM_MediaPlayer = new WasmMediaPlayer();
});