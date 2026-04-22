# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["MusicStore/MusicStore.csproj", "MusicStore/"]
RUN dotnet restore "MusicStore/MusicStore.csproj"

COPY . .
RUN dotnet publish "MusicStore/MusicStore.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

VOLUME ["/data"]

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "MusicStore.dll"]
