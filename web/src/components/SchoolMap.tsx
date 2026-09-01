import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
if (token) mapboxgl.accessToken = token;

type SchoolMapProps = {
  latitude: number | null;
  longitude: number | null;
};

/**
 * Real interactive map for the school's geocoded location — replaces the
 * earlier static placeholder SVG (which showed a generic pin icon
 * regardless of the actual coordinates). Falls back to a plain message if
 * no VITE_MAPBOX_TOKEN is configured or no coordinates exist yet.
 */
export default function SchoolMap({ latitude, longitude }: SchoolMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!token || !containerRef.current || latitude == null || longitude == null) return;

    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [longitude, latitude],
        zoom: 14,
        attributionControl: true,
      });
      mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      markerRef.current = new mapboxgl.Marker({ color: "#1F35B8" })
        .setLngLat([longitude, latitude])
        .addTo(mapRef.current);
    } else {
      mapRef.current.setCenter([longitude, latitude]);
      markerRef.current?.setLngLat([longitude, latitude]);
    }

    return () => {
      // Keep the map instance alive across coordinate updates; only tear
      // down on unmount.
    };
  }, [latitude, longitude]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  if (!token) {
    return (
      <div className="pin-card pin-card-empty">
        <p className="mono">VITE_MAPBOX_TOKEN not set — add it to web/.env.local to show the map.</p>
      </div>
    );
  }

  if (latitude == null || longitude == null) {
    return (
      <div className="pin-card pin-card-empty">
        <p className="mono">No coordinates yet — run a website lookup or drop a pin manually.</p>
      </div>
    );
  }

  return <div className="pin-card pin-card-map" ref={containerRef} />;
}
