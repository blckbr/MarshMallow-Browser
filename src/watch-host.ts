import { AudioPresets, Room, Track } from "livekit-client";

type StartConfig = {
  livekitUrl: string;
  token: string;
  room: string;
};

declare global {
  interface Window {
    watchHost: {
      onStart(callback: (config: StartConfig) => void): () => void;
      onStop(callback: () => void): () => void;
      ready(): void;
      status(payload: unknown): void;
    };
  }
}

let room: Room | null = null;
let stream: MediaStream | null = null;
let stopping = false;
let generation = 0;

function report(phase: string, message: string, extra: Record<string, unknown> = {}) {
  window.watchHost.status({
    phase,
    message,
    at: Date.now(),
    ...extra,
  });
}

async function cleanup(options: { reportStopped?: boolean } = {}) {
  if (stopping) return;
  stopping = true;

  try {
    stream?.getTracks().forEach((track) => track.stop());
  } catch {}
  stream = null;

  const oldRoom = room;
  room = null;
  if (oldRoom) {
    try { await oldRoom.disconnect(); } catch {}
  }

  if (options.reportStopped) {
    report("stopped", "Publisher LiveKit encerrado.");
  }

  stopping = false;
}

async function start(config: StartConfig) {
  const myGeneration = ++generation;
  await cleanup({ reportStopped: false });

  report("publisher-start", "Publisher interno recebeu a ordem de transmissão.");
  report("connecting", "Conectando o host ao LiveKit…", {
    livekitUrl: config.livekitUrl,
    room: config.room,
  });

  try {
    const nextRoom = new Room({
      adaptiveStream: false,
      dynacast: false,
      disconnectOnPageLeave: false,
      publishDefaults: {
        simulcast: false,
        videoCodec: "h264",
        degradationPreference: "maintain-resolution",
      },
    });

    nextRoom.on("reconnecting", () => {
      report("reconnecting", "LiveKit reconectando…");
    });
    nextRoom.on("reconnected", () => {
      report("reconnected", "LiveKit reconectado.");
    });
    nextRoom.on("disconnected", (reason) => {
      if (myGeneration === generation) {
        report("livekit-disconnected", `LiveKit desconectou: ${String(reason ?? "sem motivo")}`);
      }
    });

    await nextRoom.connect(config.livekitUrl, config.token);
    if (myGeneration !== generation) {
      await nextRoom.disconnect();
      return;
    }
    room = nextRoom;

    report("livekit-connected", "Host conectado ao LiveKit.");
    report("capture-request", "Solicitando ao Electron vídeo + áudio do WebFrameMain selecionado…");

    let media: MediaStream;
    try {
      // A fonte e o áudio já são escolhidos pelo processo principal através
      // de setDisplayMediaRequestHandler(). Mantemos as constraints mínimas
      // aqui para evitar incompatibilidades de constraints do Chromium.
      media = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
    } catch (error) {
      const e = error as Error;
      throw new Error(`getDisplayMedia:${e?.name || "Error"}:${e?.message || String(error)}`);
    }

    if (myGeneration !== generation) {
      media.getTracks().forEach((track) => track.stop());
      return;
    }

    stream = media;
    const videoTracks = media.getVideoTracks().filter((track) => track.readyState === "live");
    const audioTracks = media.getAudioTracks().filter((track) => track.readyState === "live");

    if (!videoTracks.length) {
      throw new Error("capture:no-video-track");
    }

    // Perfil Cinema: anime/filmes se beneficiam mais de detalhe/bitrate do
    // que de 60 fps. Pedimos até 1080p/30 e deixamos o capturador manter a
    // resolução nativa caso o WebFrameMain seja menor.
    for (const track of videoTracks) {
      try {
        track.contentHint = "motion";
      } catch {}
      try {
        await track.applyConstraints({
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 30 },
        });
      } catch (constraintError) {
        report("quality-warning", `Não foi possível aplicar 1080p/30: ${String((constraintError as Error)?.message || constraintError)}`);
      }
    }

    for (const track of audioTracks) {
      try {
        track.contentHint = "music";
      } catch {}
    }

    const videoSettings = videoTracks[0]?.getSettings?.() || {};
    const audioSettings = audioTracks[0]?.getSettings?.() || {};
    const width = Number(videoSettings.width || 0);
    const height = Number(videoSettings.height || 0);
    const fps = Number(videoSettings.frameRate || 0);

    report(
      "capture-granted",
      `Origem capturada: ${width || "?"}×${height || "?"} @ ${fps ? Math.round(fps) : "?"} fps · ${videoTracks.length} vídeo + ${audioTracks.length} áudio.`,
      {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoSettings,
        audioSettings,
      },
    );

    for (const track of videoTracks) {
      report("publish-video", "Publicando track de vídeo no LiveKit…");
      try {
        await nextRoom.localParticipant.publishTrack(track, {
          name: "marshmallow-watch-video",
          stream: "marshmallow-watch",
          source: Track.Source.ScreenShare,
          simulcast: false,
          videoCodec: "h264",
          backupCodec: false,
          degradationPreference: "maintain-resolution",
          screenShareEncoding: {
            maxBitrate: 8_000_000,
            maxFramerate: 30,
            priority: "high",
          },
        });
      } catch (error) {
        const e = error as Error;
        throw new Error(`publish-video:${e?.message || String(error)}`);
      }
    }

    for (const track of audioTracks) {
      report("publish-audio", "Publicando track de áudio do frame no LiveKit…");
      try {
        await nextRoom.localParticipant.publishTrack(track, {
          name: "marshmallow-watch-audio",
          stream: "marshmallow-watch",
          source: Track.Source.ScreenShareAudio,
          audioPreset: AudioPresets.musicHighQualityStereo,
          dtx: false,
          red: true,
          forceStereo: true,
        });
      } catch (error) {
        const e = error as Error;
        report("audio-warning", `Vídeo continua, mas o áudio falhou: ${e?.message || String(error)}`);
      }
    }

    media.getTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (myGeneration !== generation) return;
        report("track-ended", `${track.kind} foi encerrado pelo capturador.`);
        void cleanup({ reportStopped: true });
      }, { once: true });
    });

    report(
      "live",
      audioTracks.length
        ? "AO VIVO · Cinema 1080p/30 · H.264 · até 8 Mbps · áudio estéreo"
        : "AO VIVO · Cinema 1080p/30 · H.264 · sem track de áudio",
      {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
      },
    );
  } catch (error) {
    const e = error as Error;
    const message = e?.message || String(error);

    // IMPORTANTE: erro permanece na interface. cleanup não o sobrescreve.
    report("error", message, {
      name: e?.name || "Error",
      stack: e?.stack || "",
    });

    await cleanup({ reportStopped: false });
  }
}

window.watchHost.onStart((config) => void start(config));
window.watchHost.onStop(() => {
  generation += 1;
  void cleanup({ reportStopped: true });
});

// Só sinaliza "ready" depois que todos os listeners acima estão instalados.
window.watchHost.ready();
report("publisher-ready", "Publisher Electron pronto e aguardando configuração.");
