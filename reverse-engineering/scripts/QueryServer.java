import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.data.StringDataInstance;
import ghidra.program.model.listing.Data;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.symbol.Reference;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

// Keeps one program open and answers one-line queries on localhost, so lookups skip Ghidra's startup.
// Usage: -postScript QueryServer.java <port>. Query with reverse-engineering/ghidra-query.sh.
public class QueryServer extends GhidraScript {
    private DecompInterface decompiler;

    @Override
    public void run() throws Exception {
        int port = Integer.parseInt(getScriptArgs()[0]);
        decompiler = new DecompInterface();
        decompiler.openProgram(currentProgram);
        try (ServerSocket server = new ServerSocket(port, 50, InetAddress.getLoopbackAddress())) {
            println("QUERY SERVER READY " + currentProgram.getName() + " on port " + port);
            while (!monitor.isCancelled()) {
                try (Socket client = server.accept();
                     BufferedReader input = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8));
                     PrintWriter output = new PrintWriter(client.getOutputStream(), true, StandardCharsets.UTF_8)) {
                    String line = input.readLine();
                    if (line == null) continue;
                    if (line.trim().equals("shutdown")) {
                        output.println("stopping");
                        return;
                    }
                    try {
                        output.print(answer(line.trim().split("\\s+")));
                    } catch (Exception error) {
                        output.println("ERROR " + error);
                    }
                    output.flush();
                }
            }
        }
    }

    private String answer(String[] words) throws Exception {
        StringBuilder result = new StringBuilder();
        switch (words[0]) {
            case "decompile":
                for (int index = 1; index < words.length; index++) {
                    Function function = getFunctionContaining(toAddr(words[index]));
                    if (function == null) {
                        result.append("NO FUNCTION AT ").append(words[index]).append('\n');
                        continue;
                    }
                    DecompileResults decompiled = decompiler.decompileFunction(function, 120, monitor);
                    result.append("==== ").append(function.getName()).append(" @ ").append(function.getEntryPoint())
                        .append(" callers: ").append(getCallers(function)).append('\n')
                        .append(decompiled.getDecompiledFunction() == null ? decompiled.getErrorMessage() : decompiled.getDecompiledFunction().getC());
                }
                return result.toString();
            case "disassemble": {
                Address end = toAddr(words[2]);
                Instruction instruction = getInstructionAt(toAddr(words[1]));
                if (instruction == null) instruction = getInstructionAfter(toAddr(words[1]));
                while (instruction != null && instruction.getAddress().compareTo(end) < 0) {
                    result.append(instruction.getAddress()).append("  ").append(instruction).append('\n');
                    instruction = instruction.getNext();
                }
                return result.toString();
            }
            case "xrefs":
                for (Reference reference : getReferencesTo(toAddr(words[1]))) {
                    Function function = getFunctionContaining(reference.getFromAddress());
                    result.append(reference.getFromAddress()).append(' ').append(reference.getReferenceType())
                        .append(" in ").append(function == null ? "null" : function.getName() + " @ " + function.getEntryPoint()).append('\n');
                }
                return result.toString();
            case "bytes": {
                byte[] bytes = getBytes(toAddr(words[1]), Integer.decode(words[2]));
                for (int index = 0; index < bytes.length; index++) {
                    if (index % 16 == 0) result.append(index == 0 ? "" : "\n").append(toAddr(words[1]).add(index)).append(": ");
                    result.append(String.format("%02x ", bytes[index]));
                }
                return result.append('\n').toString();
            }
            case "strings": {
                String needle = String.join(" ", java.util.Arrays.copyOfRange(words, 1, words.length)).toLowerCase();
                for (Data data : currentProgram.getListing().getDefinedData(true)) {
                    if (!StringDataInstance.isString(data)) continue;
                    String value = StringDataInstance.getStringDataInstance(data).getStringValue();
                    if (value == null || !value.toLowerCase().contains(needle)) continue;
                    result.append(data.getAddress()).append(" \"").append(value).append("\"\n");
                    for (Reference reference : getReferencesTo(data.getAddress())) {
                        Function function = getFunctionContaining(reference.getFromAddress());
                        result.append("  from ").append(reference.getFromAddress()).append(" in ")
                            .append(function == null ? "null" : function.getName()).append('\n');
                    }
                }
                return result.toString();
            }
            case "function": {
                Function function = getFunctionContaining(toAddr(words[1]));
                return function == null ? "NO FUNCTION\n"
                    : function.getName() + " @ " + function.getEntryPoint() + " .. " + function.getBody().getMaxAddress()
                        + " signature: " + function.getSignature() + " callers: " + getCallers(function) + '\n';
            }
            default:
                return "Commands: decompile <address...> | disassemble <start> <end> | xrefs <address> | bytes <address> <count> | strings <text> | function <address> | shutdown\n";
        }
    }

    private String getCallers(Function function) {
        StringBuilder callers = new StringBuilder();
        for (Reference reference : getReferencesTo(function.getEntryPoint())) {
            Function caller = getFunctionContaining(reference.getFromAddress());
            callers.append(caller == null ? reference.getFromAddress().toString() : caller.getName()).append(' ');
        }
        return callers.toString().trim();
    }
}
