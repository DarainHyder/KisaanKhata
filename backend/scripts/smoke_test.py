import sys
sys.path.insert(0, '.')

from services import stt_service
from routers import ledger

print("stt_service imported OK")
print(f"Whisper model size : {stt_service.WHISPER_MODEL_SIZE}")
print(f"Default language   : {stt_service.WHISPER_LANGUAGE}")

if stt_service._model is not None:
    print("Whisper model      : LOADED")
elif stt_service._model_load_error:
    print(f"Whisper model      : NOT loaded — {stt_service._model_load_error}")
else:
    print("Whisper model      : state unknown")

print("ledger router      : imported OK")
print("ALL OK")
