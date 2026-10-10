import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Instruction;
import java.util.HashMap;
import java.util.Map;

// Usage: FindInstructions.java <MNEMONIC>... — lists every instruction with one of the mnemonics (case-insensitive), with its function, plus a per-mnemonic count.
public class FindInstructions extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] mnemonics = getScriptArgs();
        Map<String, Integer> counts = new HashMap<>();
        for (Instruction instruction : currentProgram.getListing().getInstructions(true)) {
            String mnemonic = instruction.getMnemonicString();
            for (String wanted : mnemonics) {
                if (!mnemonic.equalsIgnoreCase(wanted)) continue;
                counts.merge(wanted.toUpperCase(), 1, Integer::sum);
                Function function = getFunctionContaining(instruction.getAddress());
                println("INSN " + instruction.getAddress() + " " + instruction + " in " + (function == null ? "?" : function.getEntryPoint().toString()));
            }
        }
        println("COUNTS " + counts);
    }
}
