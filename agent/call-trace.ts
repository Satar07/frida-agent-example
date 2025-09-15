import { logi, log, log_args } from "./utils.js";
import { CONFIG } from "./config.js";

export function set_trace() {
    const trace_pid = Process.getCurrentThreadId();

    const target_module_map = new ModuleMap((m) => m.name === CONFIG.so_name);

    logi("Start set trace");
    // Stalker.follow(trace_pid, {
    //     events: {
    //         call: true,
    //         ret: false,
    //         exec: false,
    //     },
    //     onReceive: (events) => {
    //         const parse_events = Stalker.parse(events);
    //         for (const event of parse_events) {
    //             // event: ['call', location, target, depth]
    //             if (event[0] !== "call") {
    //                 continue;
    //             }

    //             const location = event[1] as NativePointer;
    //             if (!target_module_map.has(location)) {
    //                 continue;
    //             }
    //             const target_addr = event[2] as NativePointer;
    //             const depth = event[3];

    //             const target_module = Process.findModuleByAddress(target_addr);
    //             let call_info: string;
    //             if (target_module) {
    //                 call_info = `${target_module.name}!${target_addr.sub(target_module.base)}`;
    //             } else {
    //                 call_info = `${target_addr}`;
    //             }

    //             log(`[+] call ${call_info} from ${location} depth ${depth}`);

    //             const symbol = DebugSymbol.fromAddress(target_addr);
    //             if (symbol && symbol.name) {
    //                 const symbol_offset = target_addr.sub(symbol.address);
    //                 logi(`    symbol: ${symbol.name} +${symbol_offset}`);
    //             } else {
    //                 logi(`    symbol: (not found)`);
    //             }
    //         }
    //     },
    // });
    if (Process.arch !== "arm64") {
        logi("only arm64 is supported");
        return;
    }
    Stalker.follow(trace_pid, {
        transform: function (
            iterator: StalkerArm64Iterator | StalkerX86Iterator,
        ) {
            let instruction = iterator.next();

            do {
                // 只关心来自我们目标模块的代码
                if (target_module_map.has(instruction!.address)) {
                    // 检查指令是否是调用函数
                    if (
                        instruction?.mnemonic.startsWith("b") ||
                        instruction?.mnemonic.startsWith("call")
                    ) {
                        // 获取call的目标地址
                        const targetOperand = instruction.operands[0];
                        if (
                            targetOperand &&
                            (targetOperand.type === "imm" ||
                                targetOperand.type === "reg")
                        ) {
                            // 在 call 指令前插入我们的 JS 回调
                            iterator.putCallout((context) => {
                                let target_addr: NativePointer;
                                if (targetOperand.type === "imm") {
                                    // 直接调用地址: call 0x...
                                    target_addr = new NativePointer(
                                        targetOperand.value,
                                    );
                                } else {
                                    // 'reg'
                                    // 间接调用: call rax
                                    target_addr = context[
                                        targetOperand.value as keyof CpuContext
                                    ] as NativePointer;
                                }
                                log_args(context, target_addr);
                            });
                        }
                    }
                }
                iterator.keep(); // 保留原始指令
                instruction = iterator.next();
            } while (instruction !== null);
        },
    });
    Thread.sleep(1);
}

export function cleanup_trace(threadId: ThreadId) {
    logi(`[+] Cleaning up trace for thread ${threadId}`);
    Stalker.flush();
    Stalker.unfollow(threadId);
    Stalker.garbageCollect();
}
