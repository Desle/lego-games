"""A fake DirectSound device that records what the original plays: buffers, play, stop, loop, volume, pan and frequency, per frame.

The tune streamer (TuneStream_Start 0x0041a360) and the music choice functions (0x00434930, 0x00434b00, 0x00434c80) only run when a
sound device exists, so the golden trace without one skipped the racing tune's random draw. Sounds are named by the call that asks
for them (RaceSounds_PlayAt 0x00443b80, RaceSounds_Play 0x00443b50: the sound id) and by the content hash of the decoded buffer;
tunes by the music list entry (0x0041a8a0) and the stream's file name (stream object +0x4c).
"""

import hashlib
import struct

from unicorn.x86_const import UC_X86_REG_ECX

from stubs import StubResult

DSBPLAY_LOOPING = 1
DSBSTATUS_PLAYING = 1
DSBSTATUS_LOOPING = 4
DSBCAPS_PRIMARYBUFFER = 1
SOUND_PLAY_AT = 0x00443B80
SOUND_PLAY = 0x00443B50
STREAM_PLAY = 0x00419F20
STREAM_STOP = 0x00419FA0
STREAM_VOLUME = 0x0041A520
MUSIC_LIST_OPEN = 0x0041A8A0
STREAM_NAME_OFFSET = 0x4C
MUSIC_NAME_TABLE_OFFSET = 0x124
MUSIC_NAME_STRIDE = 0x104
SOUND_LOAD = 0x0041AA60
BYTES_PER_SECOND_STREAM = 88200


class AudioRecorder:
    def __init__(self, machine, emit):
        self.machine = machine
        self.emit = emit
        self.frame = -1
        self.is_recording = True
        self.is_always_recording = True
        self.events = []
        self.next_buffer_number = 1
        self.buffer_numbers = {}
        self.pending_sound_name = None

    def install(self) -> None:
        machine = self.machine
        world = machine.com
        machine.handlers["ordinal_1"] = self.direct_sound_create
        for method in ("CreateSoundBuffer", "DuplicateSoundBuffer", "GetCaps", "SetCooperativeLevel"):
            setattr(world, f"DirectSound_{method}", getattr(self, f"on_sound_{method}"))
        for method in ("GetCaps", "GetCurrentPosition", "GetStatus", "Lock", "Play", "Stop", "SetVolume", "SetPan", "SetFrequency", "SetCurrentPosition", "SetFormat", "GetVolume", "GetFormat", "Restore", "Unlock"):
            setattr(world, f"DirectSoundBuffer_{method}", getattr(self, f"on_buffer_{method}"))
        machine.add_address_hook(SOUND_PLAY_AT, self.on_play_at)
        machine.add_address_hook(SOUND_PLAY, self.on_play)
        machine.add_address_hook(MUSIC_LIST_OPEN, self.on_music_open)
        machine.add_address_hook(SOUND_LOAD, self.on_sound_load)
        machine.add_address_hook(STREAM_PLAY, self.on_stream_play)
        machine.add_address_hook(STREAM_STOP, lambda: self.add({"k": "streamStop", "stream": self.stream_name()}))
        machine.add_address_hook(STREAM_VOLUME, self.on_stream_volume)

    # Frames ---------------------------------------------------------------------------------------------------------

    def begin_frame(self, frame: int) -> None:
        self.frame = frame
        self.events = []

    def end_frame(self) -> None:
        if self.is_recording and self.events:
            self.emit({"type": "audio_frame", "frame": self.frame, "events": self.events})
        self.events = []

    def add(self, event: dict) -> None:
        if self.is_recording:
            self.events.append(event)

    # Game hooks ----------------------------------------------------------------------------------------------------

    def argument(self, index: int) -> int:
        from unicorn.x86_const import UC_X86_REG_ESP

        return self.machine.read_u32(self.machine.uc.reg_read(UC_X86_REG_ESP) + 4 + 4 * index)

    def this(self) -> int:
        return self.machine.uc.reg_read(UC_X86_REG_ECX)

    def on_play_at(self) -> None:
        self.add({"k": "soundPlayAt", "id": self.argument(0), "arguments": [self.argument(index) for index in range(1, 6)]})

    def on_play(self) -> None:
        self.add({"k": "soundPlay", "id": self.argument(0)})

    def on_sound_load(self) -> None:
        self.pending_sound_name = self.machine.read_c_string(self.argument(0))
        self.add({"k": "soundLoad", "name": self.pending_sound_name})

    def on_music_open(self) -> None:
        list_object = self.this()
        index = self.argument(0)
        names = self.machine.read_u32(list_object + MUSIC_NAME_TABLE_OFFSET)
        name = self.machine.read_c_string(names + index * MUSIC_NAME_STRIDE) if names else ""
        self.add({"k": "musicOpen", "index": index, "name": name})

    def stream_name(self) -> str:
        return self.machine.read_c_string(self.this() + STREAM_NAME_OFFSET)

    def on_stream_play(self) -> None:
        self.add({"k": "streamPlay", "stream": self.stream_name(), "isLooping": self.argument(0) != 0})

    def on_stream_volume(self) -> None:
        self.add({"k": "streamVolume", "stream": self.stream_name(), "volume": struct.unpack("<f", struct.pack("<I", self.argument(0)))[0]})

    # DirectSound ---------------------------------------------------------------------------------------------------

    def direct_sound_create(self, context, argument):
        self.machine.write_u32(argument(1), self.machine.com.create("DirectSound"))
        return StubResult(integer=0, callee_cleanup_bytes=12)

    def on_sound_GetCaps(self, this, record, argument):
        pointer = argument(1)
        data = bytearray(self.machine.read_u32(pointer))
        struct.pack_into("<IIIIIIIIIIII", data, 0, len(data), 0x1, 100, 48000, 100, 100, 100, 100, 100, 100, 100, 100)
        self.machine.write_bytes(pointer, bytes(data))
        return 0

    def on_sound_SetCooperativeLevel(self, this, record, argument):
        return 0

    def on_sound_CreateSoundBuffer(self, this, record, argument):
        description = self.machine.read_bytes(argument(1), 0x14)
        size, flags, byte_count, _, format_pointer = struct.unpack("<5I", description)
        format_fields = struct.unpack("<HHIIHH", self.machine.read_bytes(format_pointer, 16)) if format_pointer else (0, 0, 0, 0, 0, 0)
        buffer = self.machine.com.create(
            "DirectSoundBuffer",
            flags=flags,
            byte_count=byte_count,
            channels=format_fields[1],
            sample_rate=format_fields[2],
            bits=format_fields[5],
            memory=0,
            volume=0,
            pan=0,
            frequency=format_fields[2],
            is_playing=False,
            is_looping=False,
            started_at=0,
            position=0,
            number=self.next_buffer_number,
        )
        self.next_buffer_number += 1
        self.machine.write_u32(argument(2), buffer)
        self.add({"k": "bufferCreate", "buffer": self.machine.com.object_kinds[buffer]["number"], "flags": flags, "bytes": byte_count, "channels": format_fields[1], "rate": format_fields[2], "bits": format_fields[5]})
        return 0

    def on_sound_DuplicateSoundBuffer(self, this, record, argument):
        source = self.machine.com.object_kinds[argument(1)]
        buffer = self.machine.com.create("DirectSoundBuffer", **{key: value for key, value in source.items() if key not in ("kind", "references", "number")}, number=self.next_buffer_number)
        self.next_buffer_number += 1
        self.machine.write_u32(argument(2), buffer)
        self.add({"k": "bufferDuplicate", "buffer": self.next_buffer_number - 1, "source": source["number"]})
        return 0

    def memory(self, record) -> int:
        if record["memory"] == 0:
            record["memory"] = self.machine.allocate_heap(max(record["byte_count"], 16), 16)
        return record["memory"]

    def on_buffer_GetCaps(self, this, record, argument):
        pointer = argument(1)
        self.machine.write_bytes(pointer, struct.pack("<IIII", 16, record["flags"], record["byte_count"], 0))
        return 0

    def on_buffer_GetCurrentPosition(self, this, record, argument):
        position = self.play_position(record)
        if argument(1):
            self.machine.write_u32(argument(1), position)
        if argument(2):
            self.machine.write_u32(argument(2), position)
        return 0

    def play_position(self, record) -> int:
        if not record["is_playing"] or record["byte_count"] == 0:
            return record["position"]
        elapsed = self.machine.operating_system.now_milliseconds - record["started_at"]
        position = record["position"] + elapsed * max(record["frequency"], 1) * record["channels"] * max(record["bits"], 8) // 8000
        return position % record["byte_count"]

    def on_buffer_GetStatus(self, this, record, argument):
        status = (DSBSTATUS_PLAYING if record["is_playing"] else 0) | (DSBSTATUS_LOOPING if record["is_playing"] and record["is_looping"] else 0)
        self.machine.write_u32(argument(1), status)
        return 0

    def on_buffer_Lock(self, this, record, argument):
        offset, count, pointer_one, size_one, pointer_two, size_two, flags = (argument(index) for index in range(1, 8))
        base = self.memory(record)
        if flags & 2:
            offset, count = 0, record["byte_count"]
        count = min(count, record["byte_count"])
        first = min(count, record["byte_count"] - offset)
        self.machine.write_u32(pointer_one, base + offset)
        self.machine.write_u32(size_one, first)
        if pointer_two:
            self.machine.write_u32(pointer_two, base if count > first else 0)
        if size_two:
            self.machine.write_u32(size_two, count - first)
        return 0

    def on_buffer_Unlock(self, this, record, argument):
        return 0

    def content_hash(self, record):
        if record["memory"] == 0 or record["flags"] & DSBCAPS_PRIMARYBUFFER:
            return None
        return hashlib.sha1(self.machine.read_bytes(record["memory"], record["byte_count"])).hexdigest()[:16]

    def on_buffer_Play(self, this, record, argument):
        flags = argument(3)
        record["is_playing"] = True
        record["is_looping"] = bool(flags & DSBPLAY_LOOPING)
        record["started_at"] = self.machine.operating_system.now_milliseconds
        self.add(
            {
                "k": "bufferPlay",
                "buffer": record["number"],
                "isLooping": record["is_looping"],
                "isPrimary": bool(record["flags"] & DSBCAPS_PRIMARYBUFFER),
                "volume": record["volume"],
                "pan": record["pan"],
                "frequency": record["frequency"],
                "bytes": record["byte_count"],
                "hash": self.content_hash(record)
            }
        )
        return 0

    def on_buffer_Stop(self, this, record, argument):
        record["position"] = self.play_position(record)
        record["is_playing"] = False
        self.add({"k": "bufferStop", "buffer": record["number"]})
        return 0

    def on_buffer_SetVolume(self, this, record, argument):
        record["volume"] = struct.unpack("<i", struct.pack("<I", argument(1)))[0]
        self.add({"k": "bufferVolume", "buffer": record["number"], "volume": record["volume"]})
        return 0

    def on_buffer_SetPan(self, this, record, argument):
        record["pan"] = struct.unpack("<i", struct.pack("<I", argument(1)))[0]
        self.add({"k": "bufferPan", "buffer": record["number"], "pan": record["pan"]})
        return 0

    def on_buffer_SetFrequency(self, this, record, argument):
        record["frequency"] = argument(1)
        self.add({"k": "bufferFrequency", "buffer": record["number"], "frequency": record["frequency"]})
        return 0

    def on_buffer_SetCurrentPosition(self, this, record, argument):
        record["position"] = argument(1)
        return 0

    def on_buffer_SetFormat(self, this, record, argument):
        return 0

    def on_buffer_GetVolume(self, this, record, argument):
        self.machine.write_u32(argument(1), record["volume"] & 0xFFFFFFFF)
        return 0

    def on_buffer_GetFormat(self, this, record, argument):
        return 0

    def on_buffer_Restore(self, this, record, argument):
        return 0
