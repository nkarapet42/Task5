// ── Advanced Procedural Music Engine (Tone.js) ────────────────────────────────
// Loaded after Tone.js CDN script in index.html
const AudioEngine = (() => {

  // ── Seeded RNG ──────────────────────────────────────────────────────────────
  function mkRng(seed) {
    let s = (Number(seed) & 0x7FFFFFFF) >>> 0;
    if (s === 0) s = 1;
    return () => {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function pick(arr, rand) { return arr[Math.floor(rand() * arr.length)]; }

  // ── Music theory tables ─────────────────────────────────────────────────────
  const SCALES = {
    major:      [0,2,4,5,7,9,11],
    minor:      [0,2,3,5,7,8,10],
    dorian:     [0,2,3,5,7,9,10],
    mixolydian: [0,2,4,5,7,9,10],
    pentatonic: [0,2,4,7,9]
  };

  // Chord progressions as scale-degree indices (0-based)
  const PROGRESSIONS = {
    major: [
      [0,5,3,4], [0,3,4,0], [0,4,5,3], [0,3,0,4], [0,2,5,1,4,0]
    ],
    minor: [
      [0,6,3,7], [0,5,6,4], [0,3,6,7], [5,3,0,4], [0,6,7,4]
    ]
  };

  const ROOTS = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];

  // Convert scale degree + root to Tone.js note string
  function degreeToNote(rootIdx, scaleOffsets, degree, octave) {
    const semitone = (rootIdx + scaleOffsets[((degree % scaleOffsets.length) + scaleOffsets.length) % scaleOffsets.length]) % 12;
    return ROOTS[semitone] + octave;
  }

  function buildChordNotes(rootIdx, scaleOffsets, degree, octave) {
    return [
      degreeToNote(rootIdx, scaleOffsets, degree,     octave),
      degreeToNote(rootIdx, scaleOffsets, degree + 2, octave),
      degreeToNote(rootIdx, scaleOffsets, degree + 4, octave)
    ];
  }

  // ── Tone.js instruments ─────────────────────────────────────────────────────
  let activeParts  = [];
  let activeSynths = [];

  function disposeAll() {
    activeParts.forEach(p  => { try { p.stop(); p.dispose(); } catch(e){} });
    activeSynths.forEach(s => { try { s.dispose(); } catch(e){} });
    activeParts  = [];
    activeSynths = [];
    try { Tone.Transport.stop(); Tone.Transport.cancel(); } catch(e){}
  }

  function makeReverb(rand) {
    const rev = new Tone.Reverb({ decay: 1.5 + rand()*3, wet: 0.25 + rand()*0.2 });
    activeSynths.push(rev);
    return rev;
  }

  function makeDelay(rand) {
    const del = new Tone.FeedbackDelay({
      delayTime: pick(['8n','16n','4n'], rand),
      feedback:  0.2 + rand()*0.25,
      wet:       0.12 + rand()*0.15
    });
    activeSynths.push(del);
    return del;
  }

  function makeLimiter() {
    const lim = new Tone.Limiter(-2);
    activeSynths.push(lim);
    return lim;
  }

  // ── Song structure ──────────────────────────────────────────────────────────
  // Structure: intro(2) → verse(4) → chorus(4) → verse(4) → chorus(4) → outro(2)
  // Total = 20 bars — each bar = beatsPerBar beats
  function buildSongMap(rand) {
    const barCounts = { intro:2, verse:4, chorus:4, outro:2 };
    const order = ['intro','verse','chorus','verse','chorus','outro'];
    const map = [];
    let bar = 0;
    for (const section of order) {
      map.push({ section, startBar: bar, bars: barCounts[section] });
      bar += barCounts[section];
    }
    return { map, totalBars: bar };
  }

  // ── Main play function ──────────────────────────────────────────────────────
  async function play(audioSeed, onEnd) {
    disposeAll();
    await Tone.start();
    Tone.Transport.stop();
    Tone.Transport.cancel();

    const rand = mkRng(audioSeed);

    // ── Global song params ────────────────────────────────────────────────────
    const bpm       = 72 + Math.floor(rand() * 72);   // 72-144
    const rootIdx   = Math.floor(rand() * 12);
    const isMajor   = rand() < 0.55;
    const scaleName = isMajor
      ? pick(['major','mixolydian'], rand)
      : pick(['minor','dorian'], rand);
    const scale     = SCALES[scaleName];
    const progPool  = isMajor ? PROGRESSIONS.major : PROGRESSIONS.minor;
    const prog      = pick(progPool, rand);
    const { map, totalBars } = buildSongMap(rand);
    const beatsPerBar = 4;
    const totalBeats  = totalBars * beatsPerBar;

    Tone.Transport.bpm.value = bpm;

    // ── Effects chain ─────────────────────────────────────────────────────────
    const limiter  = makeLimiter();
    const reverb   = makeReverb(rand);
    const delay    = makeDelay(rand);
    await reverb.ready;
    limiter.toDestination();
    reverb.connect(limiter);
    delay.connect(reverb);

    // ── Instrument factory ────────────────────────────────────────────────────
    function makePad() {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: pick(['sine','triangle','fatsine'], rand) },
        envelope: { attack: 0.4, decay: 0.3, sustain: 0.8, release: 1.8 },
        volume: -14
      });
      s.connect(reverb);
      activeSynths.push(s);
      return s;
    }

    function makeLead() {
      const s = new Tone.Synth({
        oscillator: { type: pick(['triangle','sine','square'], rand) },
        envelope: { attack: 0.02, decay: 0.15, sustain: 0.6, release: 0.5 },
        volume: -18
      });
      s.connect(delay);
      activeSynths.push(s);
      return s;
    }

    function makeBass() {
      const s = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 },
        volume: -10
      });
      const filt = new Tone.Filter(280, 'lowpass');
      s.connect(filt); filt.connect(reverb);
      activeSynths.push(s, filt);
      return s;
    }

    function makeDrum(note, vol) {
      const s = new Tone.MembraneSynth({
        pitchDecay: note === 'kick' ? 0.12 : 0.04,
        octaves:    note === 'kick' ? 6    : 4,
        volume: vol
      });
      s.connect(limiter);
      activeSynths.push(s);
      return s;
    }

    function makeHihat() {
      const s = new Tone.MetalSynth({
        frequency: 400, envelope: { attack:0.001, decay:0.05, release:0.01 },
        harmonicity:5.1, modulationIndex:32, resonance:4000, octaves:1.5,
        volume: -24
      });
      s.connect(limiter);
      activeSynths.push(s);
      return s;
    }

    const pad    = makePad();
    const lead   = makeLead();
    const bass   = makeBass();
    const kick   = makeDrum('kick', -6);
    const snare  = makeDrum('snare', -14);
    const hihat  = makeHihat();

    // Helper: bar+beat → Tone transport time string
    function barBeat(bar, beat, subdiv = 0) {
      return `${bar}:${beat}:${subdiv}`;
    }

    // ── Schedule events per section ───────────────────────────────────────────
    for (const { section, startBar, bars } of map) {
      const chordProg = section === 'chorus'
        ? prog.slice(0, 2)   // Chorus uses first 2 chords repeated
        : prog;

      for (let b = 0; b < bars; b++) {
        const absBar  = startBar + b;
        const chordDeg = chordProg[b % chordProg.length];

        // ── Pad chords (every bar) ──────────────────────────────────────────
        if (section !== 'intro') {
          const chordNotes = buildChordNotes(rootIdx, scale, chordDeg, 4);
          const chordDur   = section === 'chorus' ? '2n' : '1n';
          Tone.Transport.schedule(time => {
            pad.triggerAttackRelease(chordNotes, chordDur, time, 0.55);
            if (section === 'chorus') {
              pad.triggerAttackRelease(
                buildChordNotes(rootIdx, scale, chordDeg, 5),
                chordDur, time, 0.3
              );
            }
          }, barBeat(absBar, 0));
        }

        // ── Bass (root on 1, fifth on 3) ────────────────────────────────────
        if (section !== 'intro' && section !== 'outro') {
          const rootNote  = degreeToNote(rootIdx, scale, chordDeg, 2);
          const fifthNote = degreeToNote(rootIdx, scale, chordDeg + 4, 2);
          const bassVol   = section === 'chorus' ? -8 : -11;

          [[0, rootNote],[1, fifthNote],[2, rootNote],[3, fifthNote]].forEach(([beat, note]) => {
            if (rand() < (section === 'chorus' ? 0.9 : 0.75)) {
              Tone.Transport.schedule(time => {
                bass.volume.value = bassVol;
                bass.triggerAttackRelease(note, '8n', time, 0.7);
              }, barBeat(absBar, beat));
            }
          });
        }

        // ── Melody (lead) – only in verse and chorus ────────────────────────
        if (section === 'verse' || section === 'chorus') {
          const melOctave = section === 'chorus' ? 5 : 4;
          const density   = section === 'chorus' ? 0.7 : 0.5;
          for (let beat = 0; beat < beatsPerBar; beat++) {
            for (let sub = 0; sub < 2; sub++) {   // 8th note subdivisions
              if (rand() > density) continue;
              const scaleIdx = Math.floor(rand() * scale.length);
              const note = degreeToNote(rootIdx, scale, chordDeg + scaleIdx, melOctave);
              const dur  = pick(['8n','16n','4n'], rand);
              const vel  = 0.3 + rand() * 0.4;
              Tone.Transport.schedule(time => {
                lead.triggerAttackRelease(note, dur, time, vel);
              }, barBeat(absBar, beat, sub * 2));
            }
          }
        }

        // ── Drums ──────────────────────────────────────────────────────────
        if (section !== 'intro') {
          const drumDensity = section === 'chorus' ? 1.0 : 0.85;

          // Kick: beat 0, beat 2 (always in chorus)
          [0, 2].forEach(beat => {
            if (rand() < drumDensity) {
              Tone.Transport.schedule(t => kick.triggerAttackRelease('C1', '8n', t), barBeat(absBar, beat));
            }
          });

          // Snare: beat 1, beat 3
          [1, 3].forEach(beat => {
            if (rand() < drumDensity) {
              Tone.Transport.schedule(t => snare.triggerAttackRelease('C2', '16n', t), barBeat(absBar, beat));
            }
          });

          // Hi-hat: every 8th note, busier in chorus
          const hhDensity = section === 'chorus' ? 0.85 : 0.55;
          for (let beat = 0; beat < beatsPerBar; beat++) {
            for (let sub = 0; sub < 2; sub++) {
              if (rand() < hhDensity) {
                Tone.Transport.schedule(t => hihat.triggerAttackRelease('32n', t, 0.3 + rand()*0.3),
                  barBeat(absBar, beat, sub * 2));
              }
            }
          }
        }
      }
    }

    // ── Duration & end callback ───────────────────────────────────────────────
    const secPerBeat   = 60 / bpm;
    const totalSeconds = totalBeats * secPerBeat + 1.5;

    Tone.Transport.schedule(() => {
      disposeAll();
      if (onEnd) onEnd();
    }, `+${totalSeconds}`);

    Tone.Transport.start('+0.1');
    return totalSeconds;
  }

  function stop() {
    disposeAll();
  }

  return { play, stop };
})();
