import ghidra.app.cmd.disassemble.DisassembleCommand;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSet;
import ghidra.program.model.listing.Function;
import ghidra.program.model.mem.MemoryBlock;

// Seeds functions in .text gaps that no function covers (code reached only through vtables or tables of pointers that live inside code). Run on a writable copy.
public class RecoverCodeGaps extends GhidraScript {
    @Override
    public void run() throws Exception {
        MemoryBlock text = currentProgram.getMemory().getBlock(".text");
        int createdFunctions = 0;
        for (int pass = 0; pass < 4; pass++) {
            AddressSet uncovered = new AddressSet(text.getStart(), text.getEnd());
            for (Function function : currentProgram.getFunctionManager().getFunctions(true)) {
                uncovered.delete(function.getBody());
            }
            int createdThisPass = 0;
            for (ghidra.program.model.address.AddressRange range : uncovered) {
                Address cursor = range.getMinAddress();
                while (cursor.compareTo(range.getMaxAddress()) <= 0) {
                    int value = getByte(cursor) & 0xff;
                    if (value != 0xcc && value != 0x90 && value != 0x00) break;
                    cursor = cursor.add(1);
                }
                if (cursor.compareTo(range.getMaxAddress()) > 0) continue;
                if (range.getMaxAddress().subtract(cursor) < 4) continue;
                if (getDataContaining(cursor) != null && getDataContaining(cursor).isDefined()) continue;
                if (getInstructionAt(cursor) == null) {
                    new DisassembleCommand(cursor, null, true).applyTo(currentProgram, monitor);
                }
                if (getInstructionAt(cursor) != null && getFunctionContaining(cursor) == null && createFunction(cursor, null) != null) {
                    createdThisPass++;
                }
            }
            createdFunctions += createdThisPass;
            println("PASS " + pass + " CREATED " + createdThisPass);
            if (createdThisPass == 0) break;
        }
        println("CREATED FUNCTIONS " + createdFunctions + " FUNCTION COUNT " + currentProgram.getFunctionManager().getFunctionCount());
    }
}
