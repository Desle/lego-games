import ghidra.app.cmd.disassemble.DisassembleCommand;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.data.TerminatedStringDataType;
import ghidra.program.model.mem.MemoryBlock;

// Code reached only through function-pointer tables is invisible to auto-analysis; seed it from data.
public class RecoverFunctionPointers extends GhidraScript {
    @Override
    public void run() throws Exception {
        MemoryBlock text = currentProgram.getMemory().getBlock(".text");
        int createdFunctions = 0;
        int createdStrings = 0;
        for (MemoryBlock block : currentProgram.getMemory().getBlocks()) {
            if (block.getName().equals(".text") || block.getName().equals(".reloc")) continue;
            Address cursor = block.getStart();
            while (cursor.add(4).compareTo(block.getEnd()) <= 0) {
                long value = getInt(cursor) & 0xffffffffL;
                Address target = toAddr(value);
                if (text.contains(target) && getFunctionContaining(target) == null && getInstructionAt(target) == null) {
                    if (new DisassembleCommand(target, null, true).applyTo(currentProgram, monitor) && createFunction(target, null) != null) {
                        createdFunctions++;
                    }
                }
                cursor = cursor.add(4);
            }
        }
        for (MemoryBlock block : currentProgram.getMemory().getBlocks()) {
            if (!block.getName().equals(".data") && !block.getName().equals(".rdata")) continue;
            Address cursor = block.getStart();
            while (cursor.compareTo(block.getEnd()) < 0) {
                int length = 0;
                while (length < 256) {
                    byte value = getByte(cursor.add(length));
                    if (value == 0 || value < 0x20 || value > 0x7e) break;
                    length++;
                }
                if (length >= 4 && getByte(cursor.add(length)) == 0 && getDataAt(cursor) == null) {
                    try {
                        createData(cursor, new TerminatedStringDataType());
                        createdStrings++;
                    } catch (Exception ignored) {
                    }
                }
                cursor = cursor.add(length + 1);
            }
        }
        println("CREATED FUNCTIONS " + createdFunctions + " STRINGS " + createdStrings);
        analyzeChanges(currentProgram);
        println("FUNCTION COUNT: " + currentProgram.getFunctionManager().getFunctionCount());
    }
}
