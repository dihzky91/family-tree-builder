import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Person } from '@/types';

// Fix Leaflet default icon issue in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
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

    // Extract unique places
    const places = useMemo(() => {
        const unique = new Set<string>();
        persons.forEach(p => {
            if (p.birthPlace) unique.add(p.birthPlace.trim());
            // if (p.deathPlace) unique.add(p.deathPlace.trim()); // Focus on birth for now to reduce clutter
        });
        return Array.from(unique).filter(p => p.length > 2); // Filter short invalid names
    }, [persons]);

    useEffect(() => {
        const fetchLocations = async () => {
            setLoading(true);
            const cache = getCache();
            let hasNewUpdates = false;

            // Queue simple requests (sequential to be nice to OSM Nominatim)
            // Nominatim Usage Policy: Max 1 request per second.

            const newLocations = { ...locations };

            for (const place of places) {
                // Normalize key
                const key = place.toLowerCase();

                if (cache[key]) {
                    newLocations[place] = cache[key];
                    continue;
                }

                if (newLocations[place]) continue; // Already loaded in state

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
        }
    }, [places]);

    // Group people by location
    const markers = useMemo(() => {
        const result: { place: string, lat: number, lon: number, people: Person[] }[] = [];

        Object.entries(locations).forEach(([placeName, loc]) => {
            const peopleAtPlace = persons.filter(p =>
                p.birthPlace?.toLowerCase().trim() === placeName.toLowerCase()
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

    return (
        <div className="w-full h-full relative">
            <MapContainer
                center={[-2.5, 118]} // Center of Indonesia roughly
                zoom={5}
                scrollWheelZoom={true}
                className="w-full h-full z-0"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {markers.map((m, idx) => (
                    <Marker key={idx} position={[m.lat, m.lon]}>
                        <Popup>
                            <div className="p-2 min-w-[200px]">
                                <h3 className="font-bold text-sm mb-2">{m.place}</h3>
                                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                    {m.people.map(p => (
                                        <div
                                            key={p.id}
                                            className="flex items-center gap-2 text-xs p-1 hover:bg-muted rounded cursor-pointer"
                                            onClick={() => onSelectPerson?.(p.id)}
                                        >
                                            <div className={`w-2 h-2 rounded-full ${p.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'}`} />
                                            <span>{p.fullName}</span>
                                            <span className="text-muted-foreground ml-auto">
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
                <Card className="absolute top-4 right-4 p-2 bg-background/80 backdrop-blur z-[1000]">
                    <span className="text-xs flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                        Memuat lokasi...
                    </span>
                </Card>
            )}

            <div className="absolute bottom-4 left-4 p-2 bg-background/80 backdrop-blur rounded-lg z-[1000] text-xs max-w-[200px]">
                <p>Menampilkan lokasi kelahiran.</p>
                <p className="text-muted-foreground">Lokasi diambil dari OpenStreetMap Nominatim.</p>
            </div>
        </div>
    );
}
