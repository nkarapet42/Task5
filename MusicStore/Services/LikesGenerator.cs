namespace MusicStore.Services;

public static class LikesGenerator
{
    public static int GenerateLikes(double avgLikes, DeterministicRandom64 rng)
    {
        if (avgLikes < 0 || avgLikes > 10) return  avgLikes < 0 ? 0 : 10;
        int floor = (int)Math.Floor(avgLikes);
        double fraction = avgLikes - floor;
        int likes = floor + (rng.NextDouble() < fraction ? 1 : 0);
        return Math.Clamp(likes, 0, 10);
    }
}
