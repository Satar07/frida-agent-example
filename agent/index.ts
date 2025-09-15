// import Java from "frida-java-bridge";
import { hook_addr, logi } from "./utils.js";
import { set_trace } from "./call-trace.js";
import { CONFIG } from "./config.js";

function main() {
    const main_logic = () => {
        hook_addr(0x88c, {
            onEnter: () => {
                logi("enter main");
                set_trace();
            },
        });
    };

    Process.attachModuleObserver({
        onAdded: (module) => {
            logi(`load module ${module.name}`);
            if (CONFIG.so_name === module.name) {
                logi(`is time to load! base addr is: ${module.base}`);
                CONFIG.so_base = module.base;
                main_logic();
            }
        },
    });
}

main();
