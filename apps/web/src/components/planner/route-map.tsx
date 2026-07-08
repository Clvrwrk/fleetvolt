/// <reference types="google.maps" />
"use client";

import { useEffect, useRef } from "react";

// Route map visualization for Driver + Fleet Manager queries.
// Shows the route polyline + Class-8 charger pins + POI pins.
// Uses the Google Maps JS API directly (already loaded by the app via @vis.gl/react-google-maps).

interface RouteMapData {
  origin?: { lat: number; lng: number; label?: string };
  destination?: { lat: number; lng: number; label?: string };
  waypoints?: { lat: number; lng: number }[];
  chargers?: { stationId: string; name: string; lat: number; lng: number; powerKw: number; isClass8: boolean; distanceM: number }[];
  pois?: { type: string; name: string; lat: number; lng: number; distanceM: number }[];
  carriers?: { name: string; lat: number; lng: number; distanceM: number }[];
  chargingStops?: { name: string; lat: number; lng: number; powerKw: number; dwellMin: number }[];
}

export function RouteMap({ data }: { data: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const d = data as RouteMapData;
    if (!d || !ref.current) return;

    // Wait for Google Maps to be available
    const checkGoogle = setInterval(() => {
      if (window.google?.maps) {
        clearInterval(checkGoogle);
        initMap(d);
      }
    }, 200);
    return () => clearInterval(checkGoogle);
  }, [data]);

  function initMap(d: RouteMapData) {
    if (!ref.current || !window.google?.maps) return;

    const bounds = new google.maps.LatLngBounds();
    const hasOrigin = d.origin?.lat && d.origin?.lng;
    const hasDest = d.destination?.lat && d.destination?.lng;

    if (hasOrigin) bounds.extend({ lat: d.origin!.lat, lng: d.origin!.lng });
    if (hasDest) bounds.extend({ lat: d.destination!.lat, lng: d.destination!.lng });
    (d.chargers ?? []).forEach((c) => bounds.extend({ lat: c.lat, lng: c.lng }));
    (d.pois ?? []).forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));

    const center = hasOrigin ? { lat: d.origin!.lat, lng: d.origin!.lng } : { lat: 37.8, lng: -122.3 };

    mapRef.current = new google.maps.Map(ref.current, {
      center,
      zoom: 8,
      mapId: "fleetvolt-route-map",
      disableDefaultUI: false,
      zoomControl: true,
    });

    // Origin/destination markers
    if (hasOrigin) {
      new google.maps.Marker({
        map: mapRef.current,
        position: { lat: d.origin!.lat, lng: d.origin!.lng },
        label: { text: "A", color: "#fff" },
        title: d.origin!.label ?? "Origin",
      });
    }
    if (hasDest) {
      new google.maps.Marker({
        map: mapRef.current,
        position: { lat: d.destination!.lat, lng: d.destination!.lng },
        label: { text: "B", color: "#fff" },
        title: d.destination!.label ?? "Destination",
      });
    }

    // Route polyline (straight line or waypoints)
    const path = [
      ...(hasOrigin ? [{ lat: d.origin!.lat, lng: d.origin!.lng }] : []),
      ...(d.waypoints ?? []),
      ...(hasDest ? [{ lat: d.destination!.lat, lng: d.destination!.lng }] : []),
    ];
    if (path.length >= 2) {
      new google.maps.Polyline({
        map: mapRef.current,
        path,
        strokeColor: "#3b82f6",
        strokeWeight: 4,
        strokeOpacity: 0.8,
      });
    }

    // Charger pins (color by power)
    (d.chargers ?? []).forEach((c) => {
      const color = c.powerKw >= 350 ? "#22c55e" : c.powerKw >= 150 ? "#eab308" : "#ef4444";
      new google.maps.Marker({
        map: mapRef.current,
        position: { lat: c.lat, lng: c.lng },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 1,
        },
        title: `${c.name} — ${c.powerKw}kW${c.isClass8 ? " (Class-8)" : ""}`,
      });
    });

    // POI pins (blue dots)
    (d.pois ?? []).forEach((p) => {
      new google.maps.Marker({
        map: mapRef.current,
        position: { lat: p.lat, lng: p.lng },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: "#3b82f6",
          fillOpacity: 0.7,
          strokeColor: "#fff",
          strokeWeight: 1,
        },
        title: `${p.type}: ${p.name}`,
      });
    });

    // Charging stops (highlighted with bigger markers)
    (d.chargingStops ?? []).forEach((s) => {
      new google.maps.Marker({
        map: mapRef.current,
        position: { lat: s.lat, lng: s.lng },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#f59e0b",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        label: { text: "⚡", fontSize: "10px" },
        title: `${s.name} — ${s.powerKw}kW, ${s.dwellMin}min dwell`,
      });
    });

    mapRef.current.fitBounds(bounds);
  }

  return <div ref={ref} className="w-full h-[400px] rounded-lg border border-[var(--fv-stroke,#2a2a3e)] bg-[var(--fv-bg,#0d0d1a)]" />;
}
