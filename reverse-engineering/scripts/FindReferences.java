import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;

// Lists every reference to each address given as an argument, with the containing function.
public class FindReferences extends GhidraScript {
    @Override
    public void run() throws Exception {
        for (String argument : getScriptArgs()) {
            Address target = toAddr(argument);
            println("==== references to " + target);
            for (Reference reference : getReferencesTo(target)) {
                Function function = getFunctionContaining(reference.getFromAddress());
                println(reference.getFromAddress() + " " + reference.getReferenceType() + " "
                        + (function == null ? "(no function)" : function.getName() + " @ " + function.getEntryPoint()));
            }
        }
    }
}
