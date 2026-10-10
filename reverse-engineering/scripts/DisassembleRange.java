import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Instruction;

public class DisassembleRange extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] arguments = getScriptArgs();
        Address end = toAddr(arguments[1]);
        Instruction instruction = getInstructionAt(toAddr(arguments[0]));
        while (instruction != null && instruction.getAddress().compareTo(end) < 0) {
            println("ASM " + instruction.getAddress() + "  " + instruction);
            instruction = instruction.getNext();
        }
    }
}
