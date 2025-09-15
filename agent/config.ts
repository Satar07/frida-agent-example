const SO_NAME = "test";

const MAIN_BASE = Process.mainModule.base;

class Config {
    so_base: NativePointer | undefined = undefined;
    main_base: NativePointer = MAIN_BASE;
    so_name: string = SO_NAME;
}

export const CONFIG = new Config();
