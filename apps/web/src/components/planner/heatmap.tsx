/// <reference types="google.maps" />
"use client";

import { useEffect, useRef } from "react";

// Charger-gap heatmap for CaaS queries.
// Uses Google Maps visualization.HeatmapLayer — red = largest gap, blue/green = well-covered.
// Falls back to colored-pin overlay if the visualization library isn't loaded.

interface HeatmapData {
  origin?: { lat: number; lng: number; label?: string };
  destination?: { lat: number; lng: number; label?: string };
  gapPoints?: { lat: number; lng: number; gapScore: number; class8Count: number; radiusM: number }[];
  chargers?: { stationId: string; name: string; lat: number; lng: number; powerKw: number; isClass8: boolean }[];
  carriers?: { name: string; lat: number; lng: number }[];
}

export function Heatmap({ data }: { data: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const d = data as HeatmapData;
    if (!d || !ref.current) return;
    const checkGoogle = setInterval(() => {
      if (window.google?.maps) {
        clearInterval(checkGoogle);
        initMap(d);
      }
    }, 200);
    return () => clearInterval(checkGoogle);
  }, [data]);

  function initMap(d: HeatmapData) {
    if (!ref.current || !window.google?.maps) return;

    const bounds = new google.maps.LatLngBounds();
    const hasOrigin = d.origin?.lat && d.origin?.lng;
    const hasDest = d.destination?.lat && d.destination?.lng;

    if (hasOrigin) bounds.extend({ lat: d.origin!.lat, lng: d.origin!.lng });
    if (hasDest) bounds.extend({ lat: d.destination!.lat, lng: d.destination!.lng });
    (d.gapPoints ?? []).forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));

    const center = hasOrigin ? { lat: d.origin!.lat, lng: d.origin!.lng } : { lat: 37.8, lng: -122.3 };

    mapRef.current = new google.maps.Map(ref.current, {
      center,
      zoom: 8,
      mapId: "fleetvolt-heatmap",
      zoomControl: true,
    });

    // Try the visualization HeatmapLayer
    const vizLib = (window.google as unknown as { maps?: { visualization?: { HeatmapLayer?: new (opts: unknown) => { setData: (d: unknown[]) => void; setMap: (m: google.maps.Map | null) => void } } } }).maps?.visualization;

    if (vizLib?.HeatmapLayer && d.gapPoints?.length) {
      const heatData = d.gapPoints.map((p) => ({
        location: new google.maps.LatLng(p.lat, p.lng),
        weight: Math.max(1, p.gapScore * 100), // higher gap = more intense
      }));
      const layer = new vizLib.HeatmapLayer({ data: heatData });
      layer.setMap(mapRef.current);
    } else if (d.gapPoints?.length) {
      // Fallback: colored pins (red = gap, green = covered)
      d.gapPoints.forEach((p) => {
        const color = p.class8Count === 0 ? "#ef4444" : p.class8Count <= 2 ? "#eab308" : "#22c55e";
        new google.maps.Marker({
          map: mapRef.current,
          position: { lat: p.lat, lng: p.lng },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: color,
            fillOpacity: 0.8,
            strokeColor: "#fff",
            strokeWeight: 1,
          },
          title: `${p.class8Count} Class-8 chargers within ${Math.round(p.radiusM / 1000)}km`,
        });
      });
    }

    // Origin/destination markers
    if (hasOrigin) {
      new google.maps.Marker({
        map: mapRef.current,
        position: { lat: d.origin!.lat, lng: d.origin!.lng },
        label: { text: "A", color: "#fff" },
        title: d.origin!.label ?? "Origin (Port)",
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

    // Route line
    if (hasOrigin && hasDest) {
      new google.maps.Polyline({
        map: mapRef.current,
        path: [
          { lat: d.origin!.lat, lng: d.origin!.lng },
          { lat: d.destination!.lat, lng: d.destination!.lng },
        ],
        strokeColor: "#3b82f6",
        strokeWeight: 3,
        strokeOpacity: 0.6,
      });
    }

    // Charger pins
    (d.chargers ?? []).forEach((c) => {
      const color = c.isClass8 ? "#22c55e" : "#6b7280";
      new google.maps.Marker({
        map: mapRef.current,
        position: { lat: c.lat, lng: c.lng },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: c.isClass8 ? 6 : 4,
          fillColor: color,
          fillOpacity: 0.8,
          strokeColor: "#fff",
          strokeWeight: 1,
        },
        title: `${c.name} — ${c.powerKw}kW${c.isClass8 ? " (Class-8)" : ""}`,
      });
    });

    mapRef.current.fitBounds(bounds);
  }

  return <div ref={ref} className="w-full h-[400px] rounded-lg border border-[var(--fv-stroke,#2a2a3e)] bg-[var(--fv-bg,#0d0d1a)]" />;
}
