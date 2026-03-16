import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Person } from '@/types';

// Fix Leaflet default icon issue in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface GeoMapViewProps {
    persons: Person[];
    onSelectPerson?: (personId: string) => void;
}

interface Location {
    lat: number;
    lon: number;
    display_name: string;
}

const PLACE_ALIASES: Record<string, string> = {
    jkt: 'Jakarta, Indonesia',
    jakarta: 'Jakarta, Indonesia',
    'dki jakarta': 'Jakarta, Indonesia',
    'jakarta selatan': 'Jakarta Selatan, Jakarta, Indonesia',
    'jakarta pusat': 'Jakarta Pusat, Jakarta, Indonesia',
    'jakarta barat': 'Jakarta Barat, Jakarta, Indonesia',
    'jakarta timur': 'Jakarta Timur, Jakarta, Indonesia',
    'jakarta utara': 'Jakarta Utara, Jakarta, Indonesia',
    jogja: 'Yogyakarta, Indonesia',
    yogyakarta: 'Yogyakarta, Indonesia',
    yogya: 'Yogyakarta, Indonesia',
    solo: 'Surakarta, Jawa Tengah, Indonesia',
    sby: 'Surabaya, Jawa Timur, Indonesia',
    bdg: 'Bandung, Jawa Barat, Indonesia',
    smg: 'Semarang, Jawa Tengah, Indonesia',
    mlg: 'Malang, Jawa Timur, Indonesia',
};

interface NormalizedPlaceEntry {
    raw: string;
    normalized: string;
}

function toTitleCase(value: string) {
    return value
        .split(' ')
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
}

function normalizePlace(rawPlace?: string | null) {
    if (!rawPlace) return null;

    const collapsed = rawPlace
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[.;]+$/g, '');

    if (collapsed.length < 3) return null;

    const lowered = collapsed.toLowerCase();
    if (PLACE_ALIASES[lowered]) {
        return PLACE_ALIASES[lowered];
    }

    const parts = collapsed
        .split(',')
        .map((part) => toTitleCase(part.trim().toLowerCase()))
        .filter(Boolean);

    if (parts.length === 0) return null;
    if (parts.length === 1 && !/indonesia/i.test(parts[0])) {
        parts.push('Indonesia');
    }

    return parts.join(', ');
}

function MapResizer() {
    const map = useMap();

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            map.invalidateSize();
        }, 120);

        return () => window.clearTimeout(timeoutId);
    }, [map]);

    return null;
}

function MapViewport({ markers }: { markers: Array<{ lat: number; lon: number }> }) {
    const map = useMap();

    useEffect(() => {
        if (markers.length === 0) return;
        if (markers.length === 1) {
            map.setView([markers[0].lat, markers[0].lon], 7, { animate: true });
            return;
        }

        const bounds = L.latLngBounds(markers.map((marker) => [marker.lat, marker.lon] as [number, number]));
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 8 });
    }, [map, markers]);

    return null;
}

// Simple in-memory cache + localStorage
const CACHE_KEY = 'geo_cache_v1';
const getCache = (): Record<string, Location> => {
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    } catch {
        return {};
    }
}
const saveCache = (cache: Record<string, Location>) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function GeoMapView({ persons, onSelectPerson }: GeoMapViewProps) {
    const [locations, setLocations] = useState<Record<string, Location>>({});
    const [loading, setLoading] = useState(false);

    const personsWithBirthPlace = useMemo(
        () => persons.filter((person) => person.birthPlace?.trim()),
        [persons]
    );

    // Extract unique places
    const normalizedPlaces = useMemo<NormalizedPlaceEntry[]>(() => {
        const byNormalized = new globalThis.Map<string, string>();

        persons.forEach((person) => {
            const normalized = normalizePlace(person.birthPlace);
            const raw = person.birthPlace?.trim();
            if (!normalized || !raw) return;

            if (!byNormalized.has(normalized)) {
                byNormalized.set(normalized, raw);
            }
        });

        return Array.from(byNormalized.entries()).map(([normalized, raw]) => ({ raw, normalized }));
    }, [persons]);

    const places = useMemo(
        () => normalizedPlaces.map((entry) => entry.normalized),
        [normalizedPlaces]
    );

    useEffect(() => {
        const fetchLocations = async () => {
            setLoading(true);
            const cache = getCache();
            let hasNewUpdates = false;

            // Queue simple requests (sequential to be nice to OSM Nominatim)
            // Nominatim Usage Policy: Max 1 request per second.

            const newLocations: Record<string, Location> = {};

            for (const place of places) {
                // Normalize key
                const key = place.toLowerCase();

                if (cache[key]) {
                    newLocations[place] = cache[key];
                    setLocations(prev => ({ ...prev, [place]: cache[key] }));
                    continue;
                }

                try {
                    // Fetch from Nominatim
                    await new Promise(r => setTimeout(r, 1200)); // Rate limit delay
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&limit=1`, {
                        headers: {
                            'User-Agent': 'SilsilahApp/1.0'
                        }
                    });
                    const data = await res.json();

                    if (data && data.length > 0) {
                        const loc = {
                            lat: parseFloat(data[0].lat),
                            lon: parseFloat(data[0].lon),
                            display_name: data[0].display_name
                        };
                        cache[key] = loc;
                        newLocations[place] = loc;
                        hasNewUpdates = true;

                        // Update state progressively
                        setLocations(prev => ({ ...prev, [place]: loc }));
                    }
                } catch (e) {
                    console.error("Geocoding failed for", place, e);
                }
            }

            if (hasNewUpdates) {
                saveCache(cache);
            }
            setLoading(false);
        };

        if (places.length > 0) {
            fetchLocations();
        } else {
            setLocations({});
            setLoading(false);
        }
    }, [places]);

    // Group people by location
    const markers = useMemo(() => {
        const result: { place: string, lat: number, lon: number, people: Person[] }[] = [];

        Object.entries(locations).forEach(([placeName, loc]) => {
            const peopleAtPlace = persons.filter(p =>
                normalizePlace(p.birthPlace) === placeName
            );

            if (peopleAtPlace.length > 0) {
                result.push({
                    place: placeName,
                    lat: loc.lat,
                    lon: loc.lon,
                    people: peopleAtPlace
                });
            }
        });

        return result;
    }, [locations, persons]);

    const unresolvedPlaces = useMemo(
        () => normalizedPlaces.filter((entry) => !locations[entry.normalized]),
        [normalizedPlaces, locations]
    );

    const locationCoverage = persons.length > 0
        ? Math.round((personsWithBirthPlace.length / persons.length) * 100)
        : 0;

    return (
        <div className="mx-auto flex h-full w-full max-w-[1700px] flex-col gap-6 px-6 py-8">
            <section className="rounded-[28px] border border-border/60 bg-background/88 p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Sebaran geografis</p>
                        <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">Peta lokasi kelahiran</h2>
                        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                            Mode ini memetakan lokasi lahir anggota keluarga. Marker akan muncul jika `birthPlace` cukup jelas dan berhasil ditemukan oleh OpenStreetMap Nominatim.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5">{markers.length} marker aktif</span>
                        <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5">{places.length} lokasi unik</span>
                        <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5">Coverage {locationCoverage}%</span>
                    </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <Card className="rounded-2xl border-border/60 bg-muted/20 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total anggota</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{persons.length}</p>
                    </Card>
                    <Card className="rounded-2xl border-border/60 bg-muted/20 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Punya `birthPlace`</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{personsWithBirthPlace.length}</p>
                    </Card>
                    <Card className="rounded-2xl border-border/60 bg-muted/20 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Lokasi belum match</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{unresolvedPlaces.length}</p>
                    </Card>
                    <Card className="rounded-2xl border-border/60 bg-muted/20 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sumber geocoding</p>
                        <p className="mt-2 text-sm font-medium text-foreground">OpenStreetMap Nominatim</p>
                        <p className="mt-1 text-xs text-muted-foreground">Request bertahap agar aman dari limit.</p>
                    </Card>
                </div>

                {unresolvedPlaces.length > 0 && !loading && (
                    <div className="mt-4 rounded-2xl border border-amber-300/50 bg-amber-50/70 p-4 text-sm text-amber-900">
                        <p className="font-medium">Ada lokasi yang belum berhasil ditemukan.</p>
                        <p className="mt-1 text-xs text-amber-800/80">
                            Cek penulisan tempat lahir berikut agar lebih spesifik: {unresolvedPlaces.slice(0, 6).map((entry) => entry.raw).join(', ')}{unresolvedPlaces.length > 6 ? ', ...' : ''}
                        </p>
                    </div>
                )}
            </section>

            <div className="relative h-full min-h-[680px] w-full overflow-hidden rounded-[28px] border border-border/60 bg-background/80 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.55)] backdrop-blur-sm">
                <MapContainer
                    center={[-2.5, 118]}
                    zoom={5}
                    scrollWheelZoom={true}
                    className="w-full h-full z-0"
                >
                    <MapResizer />
                    <MapViewport markers={markers} />
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {markers.map((m, idx) => (
                        <Marker key={idx} position={[m.lat, m.lon]}>
                            <Popup>
                                <div className="p-2 min-w-[200px]">
                                    <h3 className="mb-2 text-sm font-bold">{m.place}</h3>
                                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                        {m.people.map(p => (
                                            <div
                                                key={p.id}
                                                className="flex cursor-pointer items-center gap-2 rounded p-1 text-xs hover:bg-muted"
                                                onClick={() => onSelectPerson?.(p.id)}
                                            >
                                                <div className={`h-2 w-2 rounded-full ${p.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'}`} />
                                                <span>{p.fullName}</span>
                                                <span className="ml-auto text-muted-foreground">
                                                    {p.birthDate ? new Date(p.birthDate).getFullYear() : ''}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>

                {loading && (
                    <Card className="absolute right-4 top-4 z-[1000] border-border/70 bg-background/90 p-2 backdrop-blur">
                        <span className="flex items-center gap-2 text-xs">
                            <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                            Memuat lokasi...
                        </span>
                    </Card>
                )}

                <div className="absolute bottom-4 left-4 max-w-[240px] rounded-lg bg-background/80 p-2 text-xs backdrop-blur z-[1000]">
                    <p>Menampilkan lokasi kelahiran.</p>
                    <p className="text-muted-foreground">Klik marker untuk melihat anggota yang lahir di tempat tersebut.</p>
                </div>

                {!loading && markers.length === 0 && (
                    <Card className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 border-border/70 bg-background/90 px-4 py-3 text-sm shadow-lg">
                        <p className="font-medium">Belum ada marker yang bisa ditampilkan.</p>
                        <p className="mt-1 text-xs text-muted-foreground">Pastikan data anggota punya `birthPlace` yang cukup jelas untuk dicari.</p>
                    </Card>
                )}
            </div>
        </div>
    );
}
