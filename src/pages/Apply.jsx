import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/EmptyState";

export default function Apply() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [property, setProperty] = useState(null);
  const [reservation, setReservation] = useState(null);
  const [existingApp, setExistingApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    occupants: 1, desired_move_in_date: "", employment_info: "",
    rental_history: "", references: "", pets: "", additional_info: ""
  });

  useEffect(() => {
    (async () => {
      try {
        const lst = await zimrent.entities.Listing.get(listingId);
        setListing(lst);
        if (lst) {
          const prop = await zimrent.entities.Property.get(lst.data?.property_id);
          setProperty(prop);
          // Find active reservation
          const resvs = await zimrent.entities.Reservation.filter({
            listing_id: listingId, tenant_id: user.id, status: "active"
          });
          if (resvs && resvs.length > 0) setReservation(resvs[0]);
          // Check existing application
          const apps = await zimrent.entities.Application.filter({
            listing_id: listingId, tenant_id: user.id
          });
          if (apps && apps.length > 0) setExistingApp(apps[0]);
        }
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [listingId, user]);

  const handleSubmit = async () => {
    if (!reservation) { alert("You need an active reservation to apply."); return; }
    setSubmitting(true);
    try {
      const result = await zimrent.functions.invoke("submitApplication", {
        reservation_id: reservation.id,
        ...form
      });
      const res = result.data;
      if (res.error) throw new Error(res.error);
      navigate("/tenant-dashboard?tab=applications");
    } catch (e) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <LoadingState label="Loading..." />;
  if (!listing) return <EmptyState icon={AlertTriangle} title="Listing not found" action={<Button onClick={() => navigate("/")}>Go home</Button>} />;

  if (existingApp) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-success" />
        </div>
        <h1 className="text-xl font-bold font-heading">Application already submitted</h1>
        <p className="text-muted-foreground mt-2">You've already applied for this property. Check your dashboard for updates.</p>
        <Button className="mt-6" onClick={() => navigate("/tenant-dashboard?tab=applications")}>Go to dashboard</Button>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-warning" />
        </div>
        <h1 className="text-xl font-bold font-heading">Active reservation required</h1>
        <p className="text-muted-foreground mt-2">You need to reserve this property before submitting an application.</p>
        <Button className="mt-6" onClick={() => navigate(`/reserve/${listingId}`)}>Reserve this property</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to={`/property/${property?.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to property
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Rental Application</h1>
          <p className="text-sm text-muted-foreground">{property?.data?.title}</p>
        </div>
      </div>

      <Card className="border-border mb-4">
        <CardContent className="p-5 space-y-4">
          <div>
            <Label htmlFor="occupants">Number of occupants</Label>
            <Input id="occupants" type="number" min="1" max="20" value={form.occupants} onChange={(e) => setForm({ ...form, occupants: Number(e.target.value) })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="movein">Desired move-in date</Label>
            <Input id="movein" type="date" value={form.desired_move_in_date} onChange={(e) => setForm({ ...form, desired_move_in_date: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="emp">Employment / income information</Label>
            <Textarea id="emp" value={form.employment_info} onChange={(e) => setForm({ ...form, employment_info: e.target.value })} className="mt-1.5" rows={2} placeholder="e.g. Employed at XYZ Ltd, monthly income..." />
          </div>
          <div>
            <Label htmlFor="hist">Rental history</Label>
            <Textarea id="hist" value={form.rental_history} onChange={(e) => setForm({ ...form, rental_history: e.target.value })} className="mt-1.5" rows={2} placeholder="Previous rentals and landlords (with permission)" />
          </div>
          <div>
            <Label htmlFor="ref">References</Label>
            <Textarea id="ref" value={form.references} onChange={(e) => setForm({ ...form, references: e.target.value })} className="mt-1.5" rows={2} placeholder="Character or previous landlord references" />
          </div>
          <div>
            <Label htmlFor="pets">Pets</Label>
            <Input id="pets" value={form.pets} onChange={(e) => setForm({ ...form, pets: e.target.value })} className="mt-1.5" placeholder="e.g. No pets, one cat, etc." />
          </div>
          <div>
            <Label htmlFor="add">Additional information</Label>
            <Textarea id="add" value={form.additional_info} onChange={(e) => setForm({ ...form, additional_info: e.target.value })} className="mt-1.5" rows={3} placeholder="Anything else the owner should know" />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={submitting} className="w-full h-12">
        {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : "Submit application"}
      </Button>
    </div>
  );
}