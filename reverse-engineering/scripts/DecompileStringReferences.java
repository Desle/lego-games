import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.program.model.data.StringDataInstance;
import ghidra.program.model.listing.Data;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;
import java.util.LinkedHashSet;
import java.util.Set;

public class DecompileStringReferences extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] needles = getScriptArgs();
        println("FUNCTION COUNT: " + currentProgram.getFunctionManager().getFunctionCount());
        Set<Function> functions = new LinkedHashSet<>();
        for (Data data : currentProgram.getListing().getDefinedData(true)) {
            if (!StringDataInstance.isString(data)) continue;
            String value = StringDataInstance.getStringDataInstance(data).getStringValue();
            if (value == null) continue;
            for (String needle : needles) {
                if (!value.toLowerCase().contains(needle.toLowerCase())) continue;
                println("STRING " + data.getAddress() + " \"" + value + "\"");
                for (Reference reference : getReferencesTo(data.getAddress())) {
                    Function function = getFunctionContaining(reference.getFromAddress());
                    println("  referenced from " + reference.getFromAddress() + " in " + function);
                    if (function != null) functions.add(function);
                }
            }
        }
        DecompInterface decompiler = new DecompInterface();
        decompiler.openProgram(currentProgram);
        for (Function function : functions) {
            println("==== " + function.getName() + " @ " + function.getEntryPoint());
            println(decompiler.decompileFunction(function, 120, monitor).getDecompiledFunction().getC());
        }
    }
}
