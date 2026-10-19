'use client';

import { useEffect, useRef } from 'react';

/** A quiet mechanical key: filtered contact noise plus a short, low body tap. */
export function useKeyClick() {
  const context = useRef<AudioContext | null>(null);
  const noise = useRef<AudioBuffer | null>(null);

  useEffect(() => () => {
    const current = context.current;
    context.current = null;
    noise.current = null;
    if (current && current.state !== 'closed') void current.close().catch(() => {});
  }, []);

  return () => {
    try {
      const Audio = window.AudioContext ?? (window as Window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;
      if (!Audio) return;
      const ctx = context.current ?? (context.current = new Audio());
      const play = () => {
        if (ctx !== context.current || ctx.state !== 'running') return;
        if (!noise.current) {
          const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.028), ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
          noise.current = buffer;
        }
        const t = ctx.currentTime;
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        source.buffer = noise.current;
        filter.type = 'bandpass';
        filter.frequency.value = 1900;
        filter.Q.value = 0.65;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.075, t + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.026);
        source.connect(filter).connect(gain).connect(ctx.destination);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
        source.start(t);
        source.stop(t + 0.03);

        const body = ctx.createOscillator();
        const bodyGain = ctx.createGain();
        body.type = 'sine';
        body.frequency.setValueAtTime(320, t);
        body.frequency.exponentialRampToValueAtTime(150, t + 0.035);
        bodyGain.gain.setValueAtTime(0, t);
        bodyGain.gain.linearRampToValueAtTime(0.035, t + 0.002);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        body.connect(bodyGain).connect(ctx.destination);
        body.onended = () => { body.disconnect(); bodyGain.disconnect(); };
        body.start(t);
        body.stop(t + 0.045);
      };
      // Created/resumed inside the digit's user gesture, including the first tap.
      if (ctx.state !== 'running') void ctx.resume().then(play).catch(() => {});
      else play();
    } catch {
      // Audio availability must never prevent score entry.
    }
  };
}
