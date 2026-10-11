"""The power-ups' state for the golden trace: bricks, enhancement bricks, the active effects, explosions and held levels."""

import struct

POWER_UPS_OFFSET = 0x6DC
BRICKS_OFFSET = 0x28
ENHANCEMENT_BRICKS_OFFSET = 0x2C
BRICK_COUNT_OFFSET = 0x34
ENHANCEMENT_BRICK_COUNT_OFFSET = 0x38
BRICK_STRIDE = 0x68
ACTIVE_EFFECTS_OFFSET = 0x1880
EFFECT_NEXT_OFFSET = 0xC
POOL_COUNTS_OFFSET = 0x1884
POOL_ARRAYS_OFFSET = 0x1890
# The pools in the order 0x00457d30 builds them: magnet, oil slick, barrel, curse, cannon, grapple, wand, rocket, shield, turbo, warp.
POOL_STRIDES = (0x84, 0x190, 0x17C, 0x68, 0xE8, 0x290, 0x24C, 0x224, 0x2C, 0x34, 0xE4)
EXPLOSION_HEADS = (0x193C, 0x1940)
EXPLOSION_NEXT_OFFSET = 0x26C
RACER_STRIDE = 0xE34
END_OF_LIST = 0xFFFFFFFF


def classify_effect(machine, system: int, effect: int) -> int:
    for pool, stride in enumerate(POOL_STRIDES):
        base = machine.read_u32(system + POOL_ARRAYS_OFFSET + 4 * pool)
        count = machine.read_bytes(system + POOL_COUNTS_OFFSET + pool, 1)[0]
        if base <= effect < base + stride * count:
            return pool
    return END_OF_LIST


def snapshot_bricks(machine, system: int) -> tuple:
    brick_words = []
    bricks = machine.read_u32(system + BRICKS_OFFSET)
    for index in range(machine.read_u32(system + BRICK_COUNT_OFFSET)):
        brick = bricks + BRICK_STRIDE * index
        brick_words += [
            machine.read_u32(brick + 0x3C),
            machine.read_u32(brick + 0x40),
            machine.read_u32(brick + 0x4C),
            machine.read_u32(brick + 0x50) & 7,
            machine.read_u32(brick + 0x5C),
            machine.read_u32(brick + 0x60),
            machine.read_u32(brick + 0x64),
        ]
    enhancement_words = []
    enhancements = machine.read_u32(system + ENHANCEMENT_BRICKS_OFFSET)
    for index in range(machine.read_u32(system + ENHANCEMENT_BRICK_COUNT_OFFSET)):
        brick = enhancements + BRICK_STRIDE * index
        enhancement_words += [
            machine.read_u32(brick + 0x3C),
            machine.read_u32(brick + 0x4C),
            machine.read_u32(brick + 0x50) & 7,
            machine.read_u32(brick + 0x60),
            machine.read_u32(brick + 0x64) & 3,
        ]
    return brick_words, enhancement_words


def snapshot_effects(machine, system: int) -> list:
    words = []
    effect = machine.read_u32(system + ACTIVE_EFFECTS_OFFSET)
    while effect != 0:
        words += [
            classify_effect(machine, system, effect),
            machine.read_u32(effect + 4),
            machine.read_u32(effect + 8),
            machine.read_u32(effect + 0x14),
        ]
        effect = machine.read_u32(effect + EFFECT_NEXT_OFFSET)
    return words


def snapshot_explosions(machine, system: int) -> list:
    words = []
    for head in EXPLOSION_HEADS:
        explosion = machine.read_u32(system + head)
        while explosion != 0:
            words += [machine.read_u32(explosion + 4), machine.read_u32(explosion + 0x238)]
            explosion = machine.read_u32(explosion + EXPLOSION_NEXT_OFFSET)
        words.append(END_OF_LIST)
    return words


def snapshot_power_up_fields(machine, fields: dict, race: int, racers: int, racer_count: int) -> None:
    system = race + POWER_UPS_OFFSET
    brick_words, enhancement_words = snapshot_bricks(machine, system)
    fields["powerUps.bricks"] = brick_words
    fields["powerUps.enhancementBricks"] = enhancement_words
    fields["powerUps.effects"] = snapshot_effects(machine, system)
    fields["powerUps.explosions"] = snapshot_explosions(machine, system)
    for index in range(racer_count):
        racer = racers + RACER_STRIDE * index
        fields[f"racer{index}.powerUps.level"] = [machine.read_u32(racer + 0xD58)]
