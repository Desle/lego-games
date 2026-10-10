import ghidra.app.cmd.disassemble.DisassembleCommand;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.SourceType;
import java.io.BufferedReader;
import java.io.FileReader;

// Usage: ApplyNames.java <names file> — each line is "<hex address> <name>"; blank lines and lines starting with # are skipped.
// Renames the function at each address, creating it first when auto-analysis missed it. Run without -readOnly so the names persist.
public class ApplyNames extends GhidraScript {
    @Override
    public void run() throws Exception {
        int renamed = 0;
        int created = 0;
        int failed = 0;
        try (BufferedReader reader = new BufferedReader(new FileReader(getScriptArgs()[0]))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                String[] parts = line.split("\\s+");
                Address address = toAddr(parts[0]);
                String name = parts[1];
                Function function = getFunctionAt(address);
                if (function == null) {
                    if (getInstructionAt(address) == null) {
                        new DisassembleCommand(address, null, true).applyTo(currentProgram, monitor);
                    }
                    function = createFunction(address, null);
                    if (function != null) created++;
                }
                if (function == null) {
                    println("FAILED " + address + " " + name);
                    failed++;
                    continue;
                }
                function.setName(name, SourceType.USER_DEFINED);
                renamed++;
            }
        }
        println("RENAMED " + renamed + " CREATED " + created + " FAILED " + failed);
    }
}
