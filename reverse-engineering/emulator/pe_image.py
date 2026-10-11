"""Minimal PE32 loader: sections at their preferred base and the import table. No relocations."""

import struct
from dataclasses import dataclass

PAGE_SIZE = 0x1000


def align_up(value: int, alignment: int = PAGE_SIZE) -> int:
    return (value + alignment - 1) & ~(alignment - 1)


@dataclass(frozen=True)
class Section:
    name: str
    virtual_address: int
    virtual_size: int
    raw_data: bytes


@dataclass(frozen=True)
class Import:
    dll_name: str
    function_name: str
    table_entry_address: int


@dataclass(frozen=True)
class PeImage:
    name: str
    image_base: int
    image_size: int
    sections: tuple
    imports: tuple
    entry_point: int = 0
    exports: tuple = ()


def read_c_string(data: bytes) -> str:
    return data[: data.index(b"\0")].decode("ascii")


def read_at_rva(sections: list, rva: int, length: int) -> bytes:
    for section in sections:
        if section.virtual_address <= rva < section.virtual_address + len(section.raw_data):
            start = rva - section.virtual_address
            return section.raw_data[start : start + length]
    raise ValueError(f"rva {rva:#x} has no file data")


def parse_imports(sections: list, image_base: int, directory_rva: int) -> list:
    imports = []
    if directory_rva == 0:
        return imports
    descriptor_rva = directory_rva
    while True:
        lookup_start, _, _, name_rva, table_start = struct.unpack("<IIIII", read_at_rva(sections, descriptor_rva, 20))
        if name_rva == 0:
            return imports
        dll_name = read_c_string(read_at_rva(sections, name_rva, 256))
        lookup_rva = lookup_start or table_start
        index = 0
        while True:
            (entry,) = struct.unpack("<I", read_at_rva(sections, lookup_rva + index * 4, 4))
            if entry == 0:
                break
            if entry & 0x80000000:
                function_name = f"ordinal_{entry & 0xFFFF}"
            else:
                function_name = read_c_string(read_at_rva(sections, entry + 2, 256))
            imports.append(Import(dll_name, function_name, image_base + table_start + index * 4))
            index += 1
        descriptor_rva += 20


def parse_exports(sections: list, image_base: int, directory_rva: int) -> dict:
    if directory_rva == 0:
        return {}
    (name_count,) = struct.unpack("<I", read_at_rva(sections, directory_rva + 24, 4))
    functions_rva, names_rva, ordinals_rva = struct.unpack("<III", read_at_rva(sections, directory_rva + 28, 12))
    exports = {}
    for index in range(name_count):
        (name_rva,) = struct.unpack("<I", read_at_rva(sections, names_rva + index * 4, 4))
        (ordinal,) = struct.unpack("<H", read_at_rva(sections, ordinals_rva + index * 2, 2))
        (function_rva,) = struct.unpack("<I", read_at_rva(sections, functions_rva + ordinal * 4, 4))
        exports[read_c_string(read_at_rva(sections, name_rva, 256))] = image_base + function_rva
    return exports


def load_pe_image(path: str) -> PeImage:
    with open(path, "rb") as file:
        data = file.read()
    (pe_offset,) = struct.unpack_from("<I", data, 0x3C)
    if data[pe_offset : pe_offset + 4] != b"PE\0\0":
        raise ValueError(f"{path} is not a PE file")
    section_count, optional_size = struct.unpack_from("<H", data, pe_offset + 6)[0], struct.unpack_from("<H", data, pe_offset + 20)[0]
    optional = pe_offset + 24
    (image_base,) = struct.unpack_from("<I", data, optional + 28)
    (image_size,) = struct.unpack_from("<I", data, optional + 56)
    (import_rva,) = struct.unpack_from("<I", data, optional + 104)
    (export_rva,) = struct.unpack_from("<I", data, optional + 96)
    (entry_rva,) = struct.unpack_from("<I", data, optional + 16)
    sections = []
    table = optional + optional_size
    for index in range(section_count):
        name, virtual_size, virtual_address, raw_size, raw_pointer = struct.unpack_from("<8sIIII", data, table + index * 40)
        sections.append(Section(name.rstrip(b"\0").decode("ascii"), virtual_address, virtual_size, data[raw_pointer : raw_pointer + raw_size]))
    imports = parse_imports(sections, image_base, import_rva)
    exports = parse_exports(sections, image_base, export_rva)
    return PeImage(path.rsplit("/", 1)[-1], image_base, image_size, tuple(sections), tuple(imports), image_base + entry_rva, tuple(exports.items()))
