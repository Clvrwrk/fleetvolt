"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { components } from "@fleetvolt/shared-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  scenarioFormSchema,
  slugFromTruckName,
  type ScenarioFormValues,
} from "@/lib/scenario-schema";
import { useScenarioStore } from "@/stores/scenario-store";

type TruckConfigSummary = components["schemas"]["TruckConfigSummary"];
type CorridorCatalogEntry = components["schemas"]["CorridorCatalogEntry"];

type ScenarioFormProps = {
  trucks: TruckConfigSummary[];
  corridors: CorridorCatalogEntry[];
};

const WEATHER_OPTIONS = [
  { value: "ideal", label: "Ideal" },
  { value: "hot", label: "Hot" },
  { value: "cold", label: "Cold" },
  { value: "headwind", label: "Headwind" },
] as const;

export function ScenarioForm({ trucks, corridors }: ScenarioFormProps) {
  const submitScenario = useScenarioStore((s) => s.submitScenario);
  const setFormInputs = useScenarioStore((s) => s.setFormInputs);
  const isPolling = useScenarioStore((s) => s.isPolling);
  const storedInputs = useScenarioStore((s) => s.formInputs);

  const corridorPresets = corridors.filter(
    (c) => c.type === "corridor" && c.corridor_key,
  );

  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioFormSchema),
    defaultValues: storedInputs,
  });

  const payloadLbs = form.watch("payload_lbs");

  const onSubmit = form.handleSubmit(async (values) => {
    setFormInputs(values);
    await submitScenario();
  });

  return (
    <form
      data-testid="scenario-form"
      className="space-y-4"
      onSubmit={onSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="truck">Truck</Label>
        <Select
          value={form.watch("truck_slug")}
          onValueChange={(slug) => {
            form.setValue("truck_slug", slug);
            setFormInputs({ truck_slug: slug });
          }}
        >
          <SelectTrigger id="truck">
            <SelectValue placeholder="Select truck" />
          </SelectTrigger>
          <SelectContent>
            {trucks.map((truck) => {
              const slug = slugFromTruckName(truck.name);
              return (
                <SelectItem key={truck.id} value={slug}>
                  {truck.name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="corridor">Corridor</Label>
        <Select
          value={form.watch("corridor_key")}
          onValueChange={(key) => {
            form.setValue("corridor_key", key);
            setFormInputs({ corridor_key: key });
          }}
        >
          <SelectTrigger id="corridor">
            <SelectValue placeholder="Select corridor" />
          </SelectTrigger>
          <SelectContent>
            {corridorPresets.map((corridor) => (
              <SelectItem
                key={corridor.corridor_key!}
                value={corridor.corridor_key!}
              >
                {corridor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="weather">Weather</Label>
        <Select
          value={form.watch("weather_preset")}
          onValueChange={(preset) => {
            form.setValue("weather_preset", preset as ScenarioFormValues["weather_preset"]);
            setFormInputs({
              weather_preset: preset as ScenarioFormValues["weather_preset"],
            });
          }}
        >
          <SelectTrigger id="weather">
            <SelectValue placeholder="Weather preset" />
          </SelectTrigger>
          <SelectContent>
            {WEATHER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="payload">Payload (lbs)</Label>
          <span className="text-sm font-medium">{payloadLbs.toLocaleString()}</span>
        </div>
        <Slider
          id="payload"
          min={20000}
          max={80000}
          step={1000}
          value={[payloadLbs]}
          onValueChange={([value]) => {
            form.setValue("payload_lbs", value ?? 34000);
            setFormInputs({ payload_lbs: value ?? 34000 });
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="port-drayage"
          checked={form.watch("port_drayage_enabled")}
          onCheckedChange={(checked) => {
            const enabled = checked === true;
            form.setValue("port_drayage_enabled", enabled);
            setFormInputs({ port_drayage_enabled: enabled });
          }}
        />
        <Label htmlFor="port-drayage" className="normal-case">
          Port drayage aux load
        </Label>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isPolling}
        data-testid="run-button"
      >
        {isPolling ? "Running simulation…" : "Run simulation"}
      </Button>
    </form>
  );
}
