import React, { useState } from "react";
import { shippingZonesAPI } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Plus, Trash2, Edit2, Truck, Check, Loader2, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const COUNTRY_PRESETS = [
  { label: "🇺🇸 United States", code: "US" },
  { label: "🇨🇦 Canada", code: "CA" },
  { label: "🇬🇧 United Kingdom", code: "GB" },
  { label: "🇦🇺 Australia", code: "AU" },
  { label: "🇩🇪 Germany", code: "DE" },
  { label: "🇫🇷 France", code: "FR" },
  { label: "🇯🇵 Japan", code: "JP" },
  { label: "🇮🇳 India", code: "IN" },
  { label: "🇧🇷 Brazil", code: "BR" },
  { label: "🇲🇽 Mexico", code: "MX" },
  { label: "🌍 Rest of World", code: "WORLD" },
];

const BLANK_ZONE = {
  zone_name: "",
  countries: [],
  flat_rate: "",
  free_above: "",
  estimated_days_min: 3,
  estimated_days_max: 7,
  is_active: true,
};

function ZoneForm({ initial = BLANK_ZONE, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);

  const toggleCountry = (code) => {
    setForm(f => {
      let next;
      if (code === "WORLD") {
        next = f.countries.includes("WORLD") ? [] : ["WORLD"];
      } else {
        next = f.countries.includes(code) ? f.countries.filter(c => c !== code) : [...f.countries, code];
        next = next.filter(c => c !== "WORLD");
      }
      return { ...f, countries: next };
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-slate-500 font-medium block mb-1">Zone Name</label>
          <Input
            value={form.zone_name}
            onChange={e => setForm(f => ({ ...f, zone_name: e.target.value }))}
            placeholder="e.g. North America, Europe…"
            className="rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium block mb-1">Flat Rate (USD)</label>
          <Input
            type="number"
            value={form.flat_rate ?? ""}
            onChange={e => setForm(f => ({ ...f, flat_rate: e.target.value }))}
            placeholder="9.99"
            className="rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium block mb-1">Free Above ($) — 0 = never</label>
          <Input
            type="number"
            value={form.free_above ?? ""}
            onChange={e => setForm(f => ({ ...f, free_above: e.target.value }))}
            placeholder="50"
            className="rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium block mb-1">Min Days</label>
          <Input
            type="number"
            value={form.estimated_days_min}
            onChange={e => setForm(f => ({ ...f, estimated_days_min: parseInt(e.target.value) }))}
            className="rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium block mb-1">Max Days</label>
          <Input
            type="number"
            value={form.estimated_days_max}
            onChange={e => setForm(f => ({ ...f, estimated_days_max: parseInt(e.target.value) }))}
            className="rounded-xl text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-500 font-medium block mb-2">Countries / Regions</label>
        <div className="flex flex-wrap gap-2">
          {COUNTRY_PRESETS.map(c => (
            <button
              key={c.code}
              type="button"
              onClick={() => toggleCountry(c.code)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${form.countries.includes(c.code) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          onClick={() => onSave({ 
            ...form, 
            flat_rate: parseFloat(form.flat_rate) || 0, 
            free_above: parseFloat(form.free_above) || 0,
            estimated_days_min: parseInt(form.estimated_days_min) || 1,
            estimated_days_max: parseInt(form.estimated_days_max) || 1
          })}
          disabled={saving || !form.zone_name.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 rounded-xl flex-1"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
          Save Zone
        </Button>
        <Button variant="outline" className="rounded-xl" onClick={onCancel}>Cancel</Button>
      </div>
    </motion.div>
  );
}

export default function ShippingZoneManager({ store, vendorUsername }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const queryClient = useQueryClient();

  const { data: zonesResponse = {}, isLoading } = useQuery({
    queryKey: ["shippingZones", vendorUsername],
    queryFn: async () => {
      const res = await shippingZonesAPI.list({ vendor_username: vendorUsername });
      return res;
    },
    enabled: !!vendorUsername,
  });
  
  const zones = Array.isArray(zonesResponse?.zones) ? zonesResponse.zones : [];

  const createMutation = useMutation({
    mutationFn: (data) => shippingZonesAPI.create({ ...data, vendor_username: vendorUsername, store_id: store?.id }),
    onSuccess: () => { toast.success("Shipping zone added!"); setShowAdd(false); queryClient.invalidateQueries({ queryKey: ["shippingZones"] }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => shippingZonesAPI.update(id, data),
    onSuccess: () => { toast.success("Zone updated!"); setEditId(null); queryClient.invalidateQueries({ queryKey: ["shippingZones"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => shippingZonesAPI.delete(id),
    onSuccess: () => { toast.success("Zone deleted"); queryClient.invalidateQueries({ queryKey: ["shippingZones"] }); },
  });

  const toggleActive = (zone) => {
    updateMutation.mutate({ id: zone._id || zone.id, data: { is_active: !zone.is_active } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-500" /> Shipping Zones
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Define where you ship and how much it costs</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl gap-1.5">
          <Plus className="w-4 h-4" /> Add Zone
        </Button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <ZoneForm
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setShowAdd(false)}
            saving={createMutation.isPending}
          />
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : zones.length === 0 && !showAdd ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
          <Globe className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">No shipping zones yet</p>
          <p className="text-xs text-slate-400">Add zones to define your delivery regions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {zones.map(zone => (
            <motion.div key={zone._id || zone.id} layout className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {editId === (zone._id || zone.id) ? (
                <div className="p-4">
                  <ZoneForm
                    initial={zone}
                    onSave={(data) => updateMutation.mutate({ id: zone._id || zone.id, data })}
                    onCancel={() => setEditId(null)}
                    saving={updateMutation.isPending}
                  />
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${zone.is_active ? "bg-indigo-50" : "bg-slate-100"}`}>
                        <MapPin className={`w-4 h-4 ${zone.is_active ? "text-indigo-500" : "text-slate-400"}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${zone.is_active ? "text-slate-900" : "text-slate-400 line-through"}`}>{zone.zone_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs font-bold text-green-600">${(Number(zone.flat_rate) || 0).toFixed(2)} flat</span>
                          {(Number(zone.free_above) || 0) > 0 && <span className="text-xs text-slate-400">· Free over ${zone.free_above}</span>}
                          <span className="text-xs text-slate-400">· {zone.estimated_days_min}–{zone.estimated_days_max} days</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => toggleActive(zone)}
                        className={`w-8 h-5 rounded-full transition-colors relative ${zone.is_active ? "bg-indigo-500" : "bg-slate-200"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${zone.is_active ? "left-3.5" : "left-0.5"}`} />
                      </button>
                      <button onClick={() => setEditId(zone._id || zone.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(zone._id || zone.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {zone.countries?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {zone.countries.slice(0, 6).map(c => (
                        <Badge key={c} variant="secondary" className="text-[10px] px-1.5 py-0.5">{c}</Badge>
                      ))}
                      {zone.countries.length > 6 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">+{zone.countries.length - 6}</Badge>}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}