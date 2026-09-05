import { useState, useEffect } from "react";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ClipboardCheck, Plus, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import StateBadge from "@/components/StateBadge";
import { formatDate } from "@/lib/rental-utils";

const CONDITION_OPTIONS = [
  { value: "excellent", label: "Excellent", color: "success" },
  { value: "good", label: "Good", color: "success" },
  { value: "fair", label: "Fair", color: "warning" },
  { value: "poor", label: "Poor", color: "warning" },
  { value: "damaged", label: "Damaged", color: "destructive" },
  { value: "n_a", label: "N/A", color: "secondary" }
];

const INSPECTION_ITEMS = [
  { key: "walls_condition", label: "Walls" },
  { key: "floors_condition", label: "Floors" },
  { key: "doors_condition", label: "Doors" },
  { key: "windows_condition", label: "Windows" },
  { key: "plumbing_condition", label: "Plumbing" },
  { key: "electrical_condition", label: "Electrical" },
  { key: "appliances_condition", label: "Appliances" },
  { key: "furniture_condition", label: "Furniture" }
];

export default function InspectionPanel({ tenancy }) {
  const { user } = useAuth();
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    inspection_type: "move_in",
    inspection_date: new Date().toISOString().substring(0, 10),
    both_parties_present: true,
    walls_condition: "good",
    floors_condition: "good",
    doors_condition: "good",
    windows_condition: "good",
    plumbing_condition: "good",
    electrical_condition: "good",
    appliances_condition: "n_a",
    furniture_condition: "n_a",
    existing_damage_notes: "",
    general_notes: ""
  });

  const d = tenancy?.data;

  useEffect(() => {
    (async () => {
      if (!tenancy?.id) return;
      try {
        const list = await zimrent.entities.Inspection.filter({ tenancy_id: tenancy.id }, "-inspection_date", 20);
        setInspections(list || []);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [tenancy?.id]);

  const submitInspection = async () => {
    if (!form.inspection_date) { alert("Please select an inspection date"); return; }
    setSaving(true);
    try {
      await zimrent.entities.Inspection.create({
        tenancy_id: tenancy.id,
        property_id: d?.property_id,
        property_title: d?.property_title,
        tenant_id: d?.tenant_id,
        owner_id: d?.owner_id,
        inspection_type: form.inspection_type,
        inspector_id: user.id,
        inspector_role: d?.tenant_id === user.id ? "tenant" : d?.owner_id === user.id ? "owner" : "agent",
        inspection_date: form.inspection_date,
        walls_condition: form.walls_condition,
        floors_condition: form.floors_condition,
        doors_condition: form.doors_condition,
        windows_condition: form.windows_condition,
        plumbing_condition: form.plumbing_condition,
        electrical_condition: form.electrical_condition,
        appliances_condition: form.appliances_condition,
        furniture_condition: form.furniture_condition,
        existing_damage_notes: form.existing_damage_notes,
        general_notes: form.general_notes,
        both_parties_present: form.both_parties_present,
        status: "completed"
      });
      setModalOpen(false);
      setForm({
        inspection_type: "move_in", inspection_date: new Date().toISOString().substring(0, 10),
        both_parties_present: true, walls_condition: "good", floors_condition: "good",
        doors_condition: "good", windows_condition: "good", plumbing_condition: "good",
        electrical_condition: "good", appliances_condition: "n_a", furniture_condition: "n_a",
        existing_damage_notes: "", general_notes: ""
      });
      const list = await zimrent.entities.Inspection.filter({ tenancy_id: tenancy.id }, "-inspection_date", 20);
      setInspections(list || []);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading inspections...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Record move-in, move-out, and periodic inspections. History is preserved.</p>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> New inspection
        </Button>
      </div>

      {inspections.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No inspections yet" description="Record a move-in inspection when the tenancy starts to document the property condition." />
      ) : (
        <div className="space-y-3">
          {inspections.map(insp => {
            const id = insp.data;
            const typeLabel = id?.inspection_type === "move_in" ? "Move-in" : id?.inspection_type === "move_out" ? "Move-out" : "Periodic";
            const hasDamage = id?.existing_damage_notes?.trim();
            const damagedCount = INSPECTION_ITEMS.filter(item => ["poor", "damaged"].includes(id?.[item.key])).length;
            return (
              <Card key={insp.id} className="border-border cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setDetailModal(insp)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ClipboardCheck className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{typeLabel} inspection</p>
                        <p className="text-xs text-muted-foreground">{formatDate(id?.inspection_date)} · by {id?.inspector_role}</p>
                      </div>
                    </div>
                    <StateBadge status={id?.status} label={id?.status === "completed" ? "Completed" : id?.status} color={id?.status === "completed" ? "success" : "warning"} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                    {damagedCount > 0 ? (
                      <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="w-3 h-3" /> {damagedCount} item(s) need attention</span>
                    ) : (
                      <span className="flex items-center gap-1 text-success"><CheckCircle2 className="w-3 h-3" /> All items in acceptable condition</span>
                    )}
                    {hasDamage && <span>· Damage notes recorded</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create inspection modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record property inspection</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Inspection type</Label>
                <Select value={form.inspection_type} onValueChange={(v) => setForm({ ...form, inspection_type: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="move_in">Move-in</SelectItem>
                    <SelectItem value="move_out">Move-out</SelectItem>
                    <SelectItem value="periodic">Periodic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Inspection date</Label>
                <Input type="date" value={form.inspection_date} onChange={(e) => setForm({ ...form, inspection_date: e.target.value })} className="mt-1.5" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.both_parties_present} onChange={(e) => setForm({ ...form, both_parties_present: e.target.checked })} className="rounded" />
              Both parties present (tenant &amp; landlord)
            </label>
            <div>
              <p className="text-sm font-medium mb-2">Condition of items</p>
              <div className="space-y-2">
                {INSPECTION_ITEMS.map(item => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{item.label}</span>
                    <Select value={form[item.key]} onValueChange={(v) => setForm({ ...form, [item.key]: v })}>
                      <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Existing damage notes</Label>
              <Textarea value={form.existing_damage_notes} onChange={(e) => setForm({ ...form, existing_damage_notes: e.target.value })} className="mt-1.5" rows={2} placeholder="Describe any existing damage or wear" />
            </div>
            <div>
              <Label>General notes</Label>
              <Textarea value={form.general_notes} onChange={(e) => setForm({ ...form, general_notes: e.target.value })} className="mt-1.5" rows={2} placeholder="Any additional observations" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={submitInspection} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save inspection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail modal */}
      <Dialog open={!!detailModal} onOpenChange={(v) => !v && setDetailModal(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detailModal && (() => {
            const id = detailModal.data;
            const typeLabel = id?.inspection_type === "move_in" ? "Move-in" : id?.inspection_type === "move_out" ? "Move-out" : "Periodic";
            return (
              <>
                <DialogHeader><DialogTitle>{typeLabel} inspection — {formatDate(id?.inspection_date)}</DialogTitle></DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Inspected by</span><span className="font-medium capitalize">{id?.inspector_role}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Both parties present</span><span className="font-medium">{id?.both_parties_present ? "Yes" : "No"}</span></div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Condition ratings</p>
                    <div className="grid grid-cols-2 gap-2">
                      {INSPECTION_ITEMS.map(item => {
                        const opt = CONDITION_OPTIONS.find(o => o.value === id?.[item.key]);
                        return (
                          <div key={item.key} className="flex items-center justify-between text-xs">
                            <span>{item.label}</span>
                            <StateBadge status={id?.[item.key]} label={opt?.label || id?.[item.key]} color={opt?.color || "secondary"} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {id?.existing_damage_notes && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">Existing damage</p>
                      <p className="whitespace-pre-wrap">{id.existing_damage_notes}</p>
                    </div>
                  )}
                  {id?.general_notes && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">General notes</p>
                      <p className="whitespace-pre-wrap">{id.general_notes}</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}