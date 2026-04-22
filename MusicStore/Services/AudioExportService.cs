using System.IO.Compression;
using System.ComponentModel;
using System.Diagnostics;
using System.Text;

namespace MusicStore.Services;

public class AudioExportService : IAudioExportService
{
    public byte[] RenderSongMp3(long audioSeed, double durationSeconds)
    {
        const int sampleRate = 44100;
        var duration = Math.Max(2, Math.Min(durationSeconds + 1, 45));
        var numSamples = (int)Math.Ceiling(sampleRate * duration);

        var left = new float[numSamples];
        var right = new float[numSamples];

        var rand = new Mulberry32Rng(audioSeed);

        var scales = new Dictionary<string, int[]>
        {
            ["major"] = [0, 2, 4, 5, 7, 9, 11],
            ["minor"] = [0, 2, 3, 5, 7, 8, 10],
            ["pentatonic"] = [0, 2, 4, 7, 9]
        };

        var scaleNames = scales.Keys.ToArray();
        var scale = scales[scaleNames[(int)(rand.NextDouble() * scaleNames.Length)]];

        var rootMidi = 48 + (int)(rand.NextDouble() * 12);
        var bpm = 80 + (int)(rand.NextDouble() * 60);
        var beatDur = 60.0 / bpm;
        var numBars = 20;
        var beatsPerBar = 4;

        var progressions = new[]
        {
            new[] { 0, 5, 3, 4 },
            new[] { 0, 3, 4, 0 },
            new[] { 0, 4, 5, 3 }
        };
        var prog = progressions[(int)(rand.NextDouble() * progressions.Length)];

        for (var bar = 0; bar < numBars; bar++)
        {
            var deg = prog[bar % prog.Length];
            for (var beat = 0; beat < beatsPerBar; beat++)
            {
                var t = bar * beatsPerBar * beatDur + beat * beatDur + 0.05;

                if (beat == 0)
                {
                    foreach (var d in new[] { 0, 2, 4 })
                    {
                        var midi = rootMidi + scale[(deg + d) % scale.Length];
                        AddOsc(left, right, sampleRate, t, beatDur * beatsPerBar * 0.9, MidiHz(midi), 0.1, WaveType.Sine);
                    }
                }

                if ((beat == 0 || beat == 2) && rand.NextDouble() < 0.8)
                {
                    var midi = rootMidi + scale[deg % scale.Length] - 12;
                    AddOsc(left, right, sampleRate, t, beatDur * 0.6, MidiHz(midi), 0.15, WaveType.Sawtooth);
                }

                if (rand.NextDouble() < 0.45)
                {
                    var si = (int)(rand.NextDouble() * scale.Length);
                    AddOsc(left, right, sampleRate, t, beatDur * 0.35, MidiHz(rootMidi + scale[si] + 12), 0.07, WaveType.Triangle);
                }

                if (beat % 2 == 0)
                {
                    AddKick(left, right, sampleRate, t, 0.3);
                }
            }
        }

        ApplyMasterGain(left, right, 0.55f);
        return ToMp3(left, right, sampleRate);
    }

    public byte[] BuildExportZip(IEnumerable<(string FileName, long AudioSeed, double DurationSeconds)> songs)
    {
        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var song in songs)
            {
                var entry = zip.CreateEntry(song.FileName, CompressionLevel.Fastest);
                using var entryStream = entry.Open();
                var mp3Bytes = RenderSongMp3(song.AudioSeed, song.DurationSeconds);
                entryStream.Write(mp3Bytes, 0, mp3Bytes.Length);
            }
        }

        return ms.ToArray();
    }

    private static void ApplyMasterGain(float[] left, float[] right, float gain)
    {
        for (var i = 0; i < left.Length; i++)
        {
            left[i] *= gain;
            right[i] *= gain;
        }
    }

    private static double MidiHz(int midi) => 440.0 * Math.Pow(2, (midi - 69) / 12.0);

    private static void AddOsc(float[] left, float[] right, int sampleRate, double startSeconds, double durationSeconds, double freq, double gain, WaveType waveType)
    {
        if (durationSeconds <= 0) return;

        var start = (int)(startSeconds * sampleRate);
        var end = Math.Min(left.Length, (int)((startSeconds + durationSeconds + 0.01) * sampleRate));

        var attackEnd = startSeconds + 0.02;
        var sustainEnd = Math.Max(startSeconds, startSeconds + durationSeconds - 0.04);
        var stop = startSeconds + durationSeconds;

        for (var i = Math.Max(0, start); i < end; i++)
        {
            var t = i / (double)sampleRate;
            var phase = 2 * Math.PI * freq * (t - startSeconds);
            var sample = SampleWave(waveType, phase);

            double env;
            if (t < attackEnd)
            {
                env = (t - startSeconds) / 0.02;
            }
            else if (t <= sustainEnd)
            {
                env = 1.0;
            }
            else if (t <= stop)
            {
                var releaseDur = Math.Max(0.001, stop - sustainEnd);
                env = 1.0 - (t - sustainEnd) / releaseDur;
            }
            else
            {
                env = 0.0;
            }

            var v = (float)(sample * gain * Math.Clamp(env, 0.0, 1.0));
            left[i] += v;
            right[i] += v;
        }
    }

    private static void AddKick(float[] left, float[] right, int sampleRate, double startSeconds, double durationSeconds)
    {
        var start = (int)(startSeconds * sampleRate);
        var end = Math.Min(left.Length, (int)((startSeconds + durationSeconds) * sampleRate));

        for (var i = Math.Max(0, start); i < end; i++)
        {
            var dt = i / (double)sampleRate - startSeconds;
            var freq = dt <= 0.12
                ? 150.0 * Math.Pow(40.0 / 150.0, dt / 0.12)
                : 40.0;

            var gain = dt <= 0.25
                ? 0.7 * Math.Pow(0.001 / 0.7, dt / 0.25)
                : 0.0;

            var sample = (float)(Math.Sin(2 * Math.PI * freq * dt) * gain);
            left[i] += sample;
            right[i] += sample;
        }
    }

    private static double SampleWave(WaveType type, double phase)
    {
        var norm = phase / (2 * Math.PI);
        var frac = norm - Math.Floor(norm);

        return type switch
        {
            WaveType.Sine => Math.Sin(phase),
            WaveType.Sawtooth => 2.0 * frac - 1.0,
            WaveType.Triangle => 1.0 - 4.0 * Math.Abs(frac - 0.5),
            _ => 0
        };
    }

    private static byte[] ToMp3(float[] left, float[] right, int sampleRate)
    {
        var wavBytes = ToWav(left, right, sampleRate);
        var tempWavPath = Path.Combine(Path.GetTempPath(), $"musicstore-{Guid.NewGuid():N}.wav");
        var tempMp3Path = Path.Combine(Path.GetTempPath(), $"musicstore-{Guid.NewGuid():N}.mp3");

        try
        {
            File.WriteAllBytes(tempWavPath, wavBytes);

            var psi = new ProcessStartInfo
            {
                FileName = "ffmpeg",
                Arguments = $"-y -hide_banner -loglevel error -i \"{tempWavPath}\" -codec:a libmp3lame -q:a 2 \"{tempMp3Path}\"",
                RedirectStandardError = true,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi)
                ?? throw new InvalidOperationException("Failed to start ffmpeg process.");

            var stdErr = process.StandardError.ReadToEnd();
            process.WaitForExit();

            if (process.ExitCode != 0 || !File.Exists(tempMp3Path))
                throw new InvalidOperationException($"MP3 encoding failed via ffmpeg. {stdErr}");

            return File.ReadAllBytes(tempMp3Path);
        }
        catch (Win32Exception ex)
        {
            throw new InvalidOperationException("MP3 encoding failed because ffmpeg is not installed or not available in PATH.", ex);
        }
        finally
        {
            if (File.Exists(tempWavPath)) File.Delete(tempWavPath);
            if (File.Exists(tempMp3Path)) File.Delete(tempMp3Path);
        }
    }

    private static byte[] ToWav(float[] left, float[] right, int sampleRate)
    {
        const short channels = 2;
        const short bitsPerSample = 16;
        var bytesPerSample = bitsPerSample / 8;
        var blockAlign = (short)(channels * bytesPerSample);
        var byteRate = sampleRate * blockAlign;
        var dataSize = left.Length * blockAlign;

        using var ms = new MemoryStream(44 + dataSize);
        using var bw = new BinaryWriter(ms, Encoding.ASCII, leaveOpen: true);

        bw.Write(Encoding.ASCII.GetBytes("RIFF"));
        bw.Write(36 + dataSize);
        bw.Write(Encoding.ASCII.GetBytes("WAVE"));

        bw.Write(Encoding.ASCII.GetBytes("fmt "));
        bw.Write(16);
        bw.Write((short)1);
        bw.Write(channels);
        bw.Write(sampleRate);
        bw.Write(byteRate);
        bw.Write(blockAlign);
        bw.Write(bitsPerSample);

        bw.Write(Encoding.ASCII.GetBytes("data"));
        bw.Write(dataSize);

        for (var i = 0; i < left.Length; i++)
        {
            bw.Write(FloatToPcm16(left[i]));
            bw.Write(FloatToPcm16(right[i]));
        }

        bw.Flush();
        return ms.ToArray();
    }

    private static short FloatToPcm16(float sample)
    {
        var clamped = Math.Clamp(sample, -1f, 1f);
        return clamped < 0
            ? (short)(clamped * short.MinValue)
            : (short)(clamped * short.MaxValue);
    }

    private sealed class Mulberry32Rng
    {
        private ulong _s;

        public Mulberry32Rng(long seed)
        {
            _s = unchecked((ulong)seed);
        }

        public double NextDouble()
        {
            _s += 0x9E3779B97F4A7C15UL;
            var z = _s;
            z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
            z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
            var next = z ^ (z >> 31);
            return (next >> 11) * (1.0 / (1UL << 53));
        }
    }

    private enum WaveType
    {
        Sine,
        Sawtooth,
        Triangle
    }
}
