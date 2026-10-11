"""C runtime functions only the front end needs."""

import struct


def register_front_end_stubs(machine) -> None:
    def qsort(context, argument):
        """Insertion sort in guest memory; the comparator is the guest's (cdecl), called through the stub generator protocol."""
        base, count, size, compare = argument(0), argument(1), argument(2), argument(3)
        scratch = machine.allocate_heap(size, 16)
        for index in range(1, count):
            machine.write_bytes(scratch, machine.read_bytes(base + index * size, size))
            position = index
            while position > 0:
                result = yield compare, [base + (position - 1) * size, scratch]
                if struct.unpack("<i", struct.pack("<I", (result or 0) & 0xFFFFFFFF))[0] <= 0:
                    break
                machine.write_bytes(base + position * size, machine.read_bytes(base + (position - 1) * size, size))
                position -= 1
            machine.write_bytes(base + position * size, machine.read_bytes(scratch, size))
        return 0

    qsort.callee_cleanup_bytes = 0
    machine.handlers["qsort"] = qsort
