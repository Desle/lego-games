import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;

public class DecompileAddressRange extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] arguments = getScriptArgs();
        Address start = toAddr(arguments[0]);
        Address end = toAddr(arguments[1]);
        DecompInterface decompiler = new DecompInterface();
        decompiler.openProgram(currentProgram);
        for (Function function : currentProgram.getFunctionManager().getFunctions(start, true)) {
            if (function.getEntryPoint().compareTo(end) > 0) break;
            StringBuilder callers = new StringBuilder();
            for (Reference reference : getReferencesTo(function.getEntryPoint())) {
                Function caller = getFunctionContaining(reference.getFromAddress());
                callers.append(caller == null ? reference.getFromAddress().toString() : caller.getName()).append(' ');
            }
            println("==== " + function.getName() + " @ " + function.getEntryPoint() + " callers: " + callers);
            println(decompiler.decompileFunction(function, 120, monitor).getDecompiledFunction().getC());
        }
        for (int index = 2; index < arguments.length; index++) {
            Address address = toAddr(arguments[index]);
            byte[] bytes = getBytes(address, 16);
            StringBuilder hex = new StringBuilder();
            for (byte value : bytes) hex.append(String.format("%02x ", value));
            println("BYTES " + address + ": " + hex);
        }
    }
}
