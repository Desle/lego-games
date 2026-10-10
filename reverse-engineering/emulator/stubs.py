"""Host implementations of the few C runtime imports the original code calls.

Every other import aborts the run with its name. A handler receives a StubContext and returns a StubResult.
"""

import math
import struct
from dataclasses import dataclass
from fractions import Fraction

from unicorn.x86_const import UC_X86_REG_FP0, UC_X86_REG_FPSW

NO_FLOAT_RESULT = None


@dataclass(frozen=True)
class StubResult:
    integer: int = 0
    # None leaves the x87 stack alone; a float is pushed after the input is popped when pops_input is true.
    floating: object = NO_FLOAT_RESULT
    pops_input: bool = False
    callee_cleanup_bytes: int = 0
    high_integer: int = 0


def read_st0(uc) -> tuple:
    # The binding exposes the physical registers FP0..FP7 as (mantissa, sign and exponent); ST0 is FP[TOP].
    top = (uc.reg_read(UC_X86_REG_FPSW) >> 11) & 7
    return uc.reg_read(UC_X86_REG_FP0 + top)


@dataclass(frozen=True)
class StubContext:
    uc: object

    def read_st0_exact(self) -> Fraction:
        mantissa, sign_exponent = read_st0(self.uc)
        sign = -1 if sign_exponent & 0x8000 else 1
        exponent = sign_exponent & 0x7FFF
        return sign * Fraction(mantissa, 1 << 63) * Fraction(2) ** (exponent - 16383)


def truncate_toward_zero(context: StubContext, read_argument) -> StubResult:
    value = context.read_st0_exact()
    truncated = int(value)
    return StubResult(integer=truncated & 0xFFFFFFFF, pops_input=True, high_integer=(truncated >> 32) & 0xFFFFFFFF)


def arccosine(context: StubContext, read_argument) -> StubResult:
    return StubResult(floating=math.acos(float(context.read_st0_exact())), pops_input=True)


def read_double_argument(read_argument) -> float:
    return struct.unpack("<d", struct.pack("<II", read_argument(0), read_argument(1)))[0]


def floor_function(context: StubContext, read_argument) -> StubResult:
    return StubResult(floating=float(math.floor(read_double_argument(read_argument))))


def ceiling_function(context: StubContext, read_argument) -> StubResult:
    return StubResult(floating=float(math.ceil(read_double_argument(read_argument))))


STUB_HANDLERS = {
    "_ftol": truncate_toward_zero,
    "_CIacos": arccosine,
    "floor": floor_function,
    "ceil": ceiling_function,
}
