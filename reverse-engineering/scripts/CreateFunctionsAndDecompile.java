import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;

public class CreateFunctionsAndDecompile extends GhidraScript {
    @Override
    public void run() throws Exception {
        DecompInterface decompiler = new DecompInterface();
        decompiler.openProgram(currentProgram);
        for (String argument : getScriptArgs()) {
            Address address = toAddr(argument);
            disassemble(address);
            Function function = getFunctionAt(address);
            if (function == null) function = createFunction(address, null);
            if (function == null) { println("COULD NOT CREATE " + address); continue; }
            println("==== " + function.getName() + " @ " + function.getEntryPoint());
            println(decompiler.decompileFunction(function, 120, monitor).getDecompiledFunction().getC());
        }
    }
}
