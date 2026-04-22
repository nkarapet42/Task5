namespace MusicStore.Services;

public sealed class DeterministicRandom64
{
    private ulong _state;

    public DeterministicRandom64(long seed)
    {
        _state = unchecked((ulong)seed);
    }

    public static DeterministicRandom64 Create(long seed, ulong stream)
    {
        var mixed = SplitMix64(unchecked((ulong)seed) ^ stream);
        return new DeterministicRandom64(unchecked((long)mixed));
    }

    public int Next(int maxExclusive)
    {
        if (maxExclusive <= 0) throw new ArgumentOutOfRangeException(nameof(maxExclusive));
        return (int)(NextUInt64() % (ulong)maxExclusive);
    }

    public double NextDouble()
    {
        return (NextUInt64() >> 11) * (1.0 / (1UL << 53));
    }

    private ulong NextUInt64()
    {
        _state += 0x9E3779B97F4A7C15UL;
        var z = _state;
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
        z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
        return z ^ (z >> 31);
    }

    private static ulong SplitMix64(ulong value)
    {
        var z = value + 0x9E3779B97F4A7C15UL;
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
        z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
        return z ^ (z >> 31);
    }
}
