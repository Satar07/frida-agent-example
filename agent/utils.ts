import { off } from "node:process";
import { CONFIG } from "./config";

export function log(message: any) {
    console.log(message);
}

export function logi(message: any) {
    console.log("[+]", message);
}

export function logw(message: any) {
    console.log("[!]", message);
}

export function hook_addr(
    offset: NativePointer | Number,
    callback: InvocationListenerCallbacks | InstructionProbeCallback,
) {
    if (!CONFIG.so_base) {
        logw("sobase is null");
    }
    let base_addr = CONFIG.so_base as NativePointer;
    Interceptor.attach(base_addr.add(offset as NativePointer), callback);
}

export function is_printable_ascii(s: string | null): boolean {
    if (s === null || s.length === 0 || s.length > 512) {
        return false;
    }
    const len = s.length;
    let non_printable_count = 0;
    for (let i = 0; i < len; i++) {
        const c = s.charCodeAt(i);
        if (c < 32 || c > 126) {
            if (c !== 10 && c !== 9 && c !== 13) {
                non_printable_count += 1;
            }
        }
    }
    return non_printable_count / len < 0.2;
}

export function log_args(context: CpuContext, target_addr: NativePointer) {
    const arch = Process.arch;
    let arg_regs: string[] = [];

    if (arch === "x64") {
        arg_regs = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"];
    } else if (arch === "arm64") {
        arg_regs = ["x0", "x1", "x2", "x3", "x4", "x5"];
    } else {
        logw("unknown architecture!");
        return;
    }

    const module = Process.findModuleByAddress(target_addr);
    const target_info = module
        ? `${module.name} ! ${target_addr.sub(module.base)}`
        : target_addr.toString();

    logi(`Calling ${target_info} with args:`);

    for (let i = 0; i < arg_regs.length; i++) {
        const reg_name = arg_regs[i];
        const reg_val = context[reg_name as keyof CpuContext];
        log(`    ${reg_name}: ${smart_parse(reg_val)}`);
    }
}

export function smart_parse(p: NativePointer, depth: number = 5): string {
    if (p.isNull()) {
        return "0x0";
    }

    const addr_str = p.toString();
    if (depth == 0) {
        return `${addr_str} -> [max_depth_reached]`;
    }

    let output = addr_str;
    let next_ptr: NativePointer | null = null;
    let can_def = false;

    // 尝试解析成字符串
    try {
        const s = p.readCString();
        if (s && is_printable_ascii(s)) {
            output += ` (${JSON.stringify(s)})`;
        }
    } catch (e) {} // 忽略可能错误

    // 尝试解引用指针
    try {
        next_ptr = p.readPointer();
        can_def = true;
    } catch (e) {
        can_def = false;
    }
    if (can_def && next_ptr) {
        output += ` -> ${smart_parse(next_ptr, depth - 1)}`;
    }
    return output;
}
