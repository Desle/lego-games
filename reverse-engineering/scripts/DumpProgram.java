import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.data.StringDataInstance;
import ghidra.program.model.listing.Data;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.Symbol;
import java.io.File;
import java.io.PrintWriter;

// Usage: DumpProgram.java <outputDirectory>
// Writes <program>.strings.txt (string, address, referencing functions), <program>.imports.txt (import, referencing addresses and functions) and <program>.functions.c (every function decompiled, with callers).
public class DumpProgram extends GhidraScript {
    private String getReferencingFunctions(ghidra.program.model.address.Address address) {
        StringBuilder users = new StringBuilder();
        for (Reference reference : getReferencesTo(address)) {
            Function function = getFunctionContaining(reference.getFromAddress());
            users.append(function == null ? "data:" + reference.getFromAddress() : function.getEntryPoint().toString()).append(' ');
        }
        return users.toString();
    }

    @Override
    public void run() throws Exception {
        String outputDirectory = getScriptArgs()[0];
        String programName = currentProgram.getName();
        try (PrintWriter strings = new PrintWriter(new File(outputDirectory, programName + ".strings.txt"))) {
            for (Data data : currentProgram.getListing().getDefinedData(true)) {
                if (!StringDataInstance.isString(data)) continue;
                String value = StringDataInstance.getStringDataInstance(data).getStringValue();
                if (value == null) continue;
                strings.println(data.getAddress() + "\t\"" + value.replace("\n", "\\n").replace("\r", "\\r") + "\"\t" + getReferencingFunctions(data.getAddress()));
            }
        }
        try (PrintWriter imports = new PrintWriter(new File(outputDirectory, programName + ".imports.txt"))) {
            for (Symbol symbol : currentProgram.getSymbolTable().getExternalSymbols()) {
                StringBuilder users = new StringBuilder();
                for (Reference reference : getReferencesTo(symbol.getAddress())) {
                    users.append(reference.getFromAddress()).append(' ');
                    for (Reference second : getReferencesTo(reference.getFromAddress())) {
                        Function function = getFunctionContaining(second.getFromAddress());
                        users.append(function == null ? "data:" + second.getFromAddress() : function.getEntryPoint().toString()).append(' ');
                    }
                }
                imports.println(symbol.getParentNamespace().getName() + "!" + symbol.getName() + "\t" + users);
            }
        }
        DecompInterface decompiler = new DecompInterface();
        decompiler.openProgram(currentProgram);
        try (PrintWriter functions = new PrintWriter(new File(outputDirectory, programName + ".functions.c"))) {
            for (Function function : currentProgram.getFunctionManager().getFunctions(true)) {
                if (monitor.isCancelled()) break;
                functions.println("==== " + function.getName() + " @ " + function.getEntryPoint() + " size " + function.getBody().getNumAddresses() + " callers: " + getReferencingFunctions(function.getEntryPoint()));
                DecompileResults results = decompiler.decompileFunction(function, 60, monitor);
                if (results.getDecompiledFunction() == null) {
                    functions.println("// decompile failed: " + results.getErrorMessage());
                } else {
                    functions.println(results.getDecompiledFunction().getC());
                }
            }
        }
    }
}
