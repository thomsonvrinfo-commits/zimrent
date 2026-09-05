import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Building2, CheckCircle2, Image as ImageIcon, Video, ShieldCheck, Eye, FileCheck } from "lucide-react";
import { PROPERTY_TYPES, formatCurrency, WATER_SOURCES, ELECTRICITY_OPTIONS, BACKUP_POWER } from "@/lib/rental-utils";
import PhotoUploader from "@/components/PhotoUploader";
import { Image } from "@/components/ui/image";

const CITIES = ["Harare", "Bulawayo", "Chitungwiza", "Mutare", "Gweru", "Kwekwe", "Kadoma", "Masvingo"];
const SUBURBS = {
  Harare: ["Borrowdale", "Mount Pleasant", "Avondale", "Highlands", "Greendale", "Waterfalls", "Warren Park", "Mbare", "Hatfield", "Tynwald"],
  Bulawayo: ["Hillside", "Suburbs", "Burnside", "Khumalo", "Newtown", "Pelendaba"],
  Chitungwiza: ["Unit A", "Unit B", "Unit C", "Unit D", "Seke", "Zengeza"],
  Mutare: ["Avenues", "Murambi", "Greendale", "Yeovil", "Chikanga"],
  Gweru: ["Senga", "Mkoba", "Riverside", "Southview"],
  Kwekwe: ["Mbizo", "Riverside", "Amaveni"],
  Kadoma: ["Riverside", "Chikangwe", "Ngezi"],
  Masvingo: ["Mucheke", "Rujeko", "Target Kopje", "Eastvale"]
};

export default function AddProperty() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploadingAuth, setUploadingAuth] = useState(false);
  const [form, setForm] = useState({
    title: "", property_type: "house", city: "Harare", suburb: "", area: "",
    approx_lat: -17.83, approx_lng: 31.05,
    bedrooms: 2, bathrooms: 1, has_kitchen: true, has_living_room: true, has_yard: false,
    parking_spaces: 1, furnished: false, building_type: "", floor: "",
    photos: [], video_url: "",
    water_source: "council", water_reliability: "intermittent", electricity: "zesa",
    backup_power: "none", internet: "unknown", refuse_collection: true, sewage: "municipal", gas: "none",
    walled: true, gated: true, security_guard: false, cctv: false, alarm: false, secure_parking: false,
    pets_allowed: false, smoking_allowed: false, visitors_allowed: true, max_occupancy: 4,
    subletting_allowed: false, children_allowed: true,
    nearby_landmarks: "", nearby_transport: "", nearby_schools: "", nearby_shopping: "", nearby_hospitals: "",
    monthly_rent: 300, security_deposit: 300, reservation_fee: 25, application_fee: 0, agent_fee: 0,
    currency: "USD", payment_frequency: "monthly", available_from: "",
    description: "", requires_application: true, reservation_duration_hours: 48,
    authority_document_uri: "", authority_acknowledged: false
  });

  const suburbs = SUBURBS[form.city] || [];
  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleAuthorityUpload = async (file) => {
    if (!file) return;
    setUploadingAuth(true);
    try {
      const { file_uri } = await zimrent.integrations.Core.UploadPrivateFile({ file });
      setField("authority_document_uri", file_uri);
    } catch (e) { alert("Upload failed: " + e.message); }
    finally { setUploadingAuth(false); }
  };

  const handleSave = async () => {
    if (!form.title || !form.suburb) { alert("Please complete the required fields"); return; }
    setSaving(true);
    try {
      const property = await zimrent.entities.Property.create({
        title: form.title, property_type: form.property_type, city: form.city, suburb: form.suburb, area: form.area,
        approx_lat: form.approx_lat, approx_lng: form.approx_lng,
        bedrooms: form.bedrooms, bathrooms: form.bathrooms,
        has_kitchen: form.has_kitchen, has_living_room: form.has_living_room, has_yard: form.has_yard,
        parking_spaces: form.parking_spaces, furnished: form.furnished,
        building_type: form.building_type, floor: form.floor,
        photos: form.photos, video_url: form.video_url,
        media_updated_at: new Date().toISOString(),
        water_source: form.water_source, water_reliability: form.water_reliability,
        electricity: form.electricity, backup_power: form.backup_power,
        internet: form.internet, refuse_collection: form.refuse_collection, sewage: form.sewage, gas: form.gas,
        walled: form.walled, gated: form.gated, security_guard: form.security_guard,
        cctv: form.cctv, alarm: form.alarm, secure_parking: form.secure_parking,
        pets_allowed: form.pets_allowed, smoking_allowed: form.smoking_allowed,
        visitors_allowed: form.visitors_allowed, max_occupancy: form.max_occupancy,
        subletting_allowed: form.subletting_allowed, children_allowed: form.children_allowed,
        nearby_landmarks: form.nearby_landmarks, nearby_transport: form.nearby_transport,
        nearby_schools: form.nearby_schools, nearby_shopping: form.nearby_shopping, nearby_hospitals: form.nearby_hospitals,
        verification_status: "unverified", verification_level: "basic",
        authority_status: form.authority_document_uri ? "pending" : "unverified"
      });

      const listing = await zimrent.entities.Listing.create({
        property_id: property.id, title: form.title, description: form.description,
        monthly_rent: form.monthly_rent, security_deposit: form.security_deposit,
        reservation_fee: form.reservation_fee, application_fee: form.application_fee,
        agent_fee: form.agent_fee, currency: form.currency, payment_frequency: form.payment_frequency,
        estimated_move_in_cost: (form.monthly_rent || 0) + (form.security_deposit || 0),
        available_from: form.available_from || new Date().toISOString().substring(0, 10),
        availability_confirmed_at: new Date().toISOString(),
        status: "draft", requires_application: form.requires_application,
        reservation_duration_hours: form.reservation_duration_hours
      });

      if (form.authority_document_uri) {
        const doc = await zimrent.entities.Document.create({
          owner_id: user.id, document_type: "authority_evidence",
          title: `Authority evidence — ${form.title}`,
          file_uri: form.authority_document_uri, is_private: true,
          related_type: "property", related_id: property.id, status: "active"
        });
        await zimrent.entities.Property.update(property.id, { authority_reference: doc.id });
      }

      // Submit for verification — admin must approve before listing goes active
      await zimrent.functions.invoke("transitionListing", { listing_id: listing.id, new_status: "pending_verification" });

      navigate("/my-properties?published=1");
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const steps = [1, 2, 3, 4, 5, 6];
  const stepLabels = ["Basic", "Media", "Utilities", "Rules", "Pricing", "Review"];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate("/my-properties")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Cancel
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Add a Property</h1>
          <p className="text-sm text-muted-foreground">List your property for tenants to discover</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center flex-shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            <span className={`ml-1.5 text-xs hidden sm:inline ${step >= s ? "text-foreground font-medium" : "text-muted-foreground"}`}>{stepLabels[i]}</span>
            {i < steps.length - 1 && <div className={`w-4 sm:w-6 h-0.5 mx-1 ${step > s ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Basic info */}
      {step === 1 && (
        <Card className="border-border"><CardContent className="p-5 space-y-4">
          <h2 className="font-semibold font-heading">Basic information</h2>
          <div>
            <Label>Property title</Label>
            <Input value={form.title} onChange={(e) => setField("title", e.target.value)} className="mt-1.5" placeholder="e.g. Modern 2-bedroom cottage in Borrowdale" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Property type</Label>
              <Select value={form.property_type} onValueChange={(v) => setField("property_type", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PROPERTY_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>City</Label>
              <Select value={form.city} onValueChange={(v) => { setField("city", v); setField("suburb", ""); }}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Suburb</Label>
              <Select value={form.suburb} onValueChange={(v) => setField("suburb", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select suburb" /></SelectTrigger>
                <SelectContent>{suburbs.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Area (optional)</Label>
              <Input value={form.area} onChange={(e) => setField("area", e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><Label>Bedrooms</Label><Input type="number" min="0" max="10" value={form.bedrooms} onChange={(e) => setField("bedrooms", Number(e.target.value))} className="mt-1.5" /></div>
            <div><Label>Bathrooms</Label><Input type="number" min="0" max="10" value={form.bathrooms} onChange={(e) => setField("bathrooms", Number(e.target.value))} className="mt-1.5" /></div>
            <div><Label>Parking</Label><Input type="number" min="0" max="10" value={form.parking_spaces} onChange={(e) => setField("parking_spaces", Number(e.target.value))} className="mt-1.5" /></div>
            <div><Label>Max occupancy</Label><Input type="number" min="1" max="20" value={form.max_occupancy} onChange={(e) => setField("max_occupancy", Number(e.target.value))} className="mt-1.5" /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Toggle label="Furnished" value={form.furnished} onChange={(v) => setField("furnished", v)} />
            <Toggle label="Kitchen" value={form.has_kitchen} onChange={(v) => setField("has_kitchen", v)} />
            <Toggle label="Living room" value={form.has_living_room} onChange={(v) => setField("has_living_room", v)} />
            <Toggle label="Yard" value={form.has_yard} onChange={(v) => setField("has_yard", v)} />
          </div>
          <Button onClick={() => setStep(2)} disabled={!form.title || !form.suburb} className="w-full">Continue</Button>
        </CardContent></Card>
      )}

      {/* Step 2: Media */}
      {step === 2 && (
        <Card className="border-border"><CardContent className="p-5 space-y-4">
          <h2 className="font-semibold font-heading flex items-center gap-2"><ImageIcon className="w-5 h-5 text-primary" /> Photos &amp; video tour</h2>
          <PhotoUploader photos={form.photos} onChange={(urls) => setField("photos", urls)} maxPhotos={10} />
          <div>
            <Label className="flex items-center gap-1.5"><Video className="w-4 h-4" /> Video tour URL (optional)</Label>
            <Input value={form.video_url} onChange={(e) => setField("video_url", e.target.value)} className="mt-1.5" placeholder="YouTube or video link for a property walkthrough" />
            <p className="text-xs text-muted-foreground mt-1">A video walkthrough helps tenants experience the property remotely.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(3)} className="flex-1">Continue</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Step 3: Utilities & security */}
      {step === 3 && (
        <Card className="border-border"><CardContent className="p-5 space-y-4">
          <h2 className="font-semibold font-heading">Utilities &amp; security</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Water source</Label>
              <Select value={form.water_source} onValueChange={(v) => setField("water_source", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(WATER_SOURCES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Water reliability</Label>
              <Select value={form.water_reliability} onValueChange={(v) => setField("water_reliability", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reliable">Reliable</SelectItem><SelectItem value="intermittent">Intermittent</SelectItem><SelectItem value="unreliable">Unreliable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Electricity</Label>
              <Select value={form.electricity} onValueChange={(v) => setField("electricity", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ELECTRICITY_OPTIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Backup power</Label>
              <Select value={form.backup_power} onValueChange={(v) => setField("backup_power", v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(BACKUP_POWER).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Toggle label="Walled" value={form.walled} onChange={(v) => setField("walled", v)} />
            <Toggle label="Gated" value={form.gated} onChange={(v) => setField("gated", v)} />
            <Toggle label="Security guard" value={form.security_guard} onChange={(v) => setField("security_guard", v)} />
            <Toggle label="CCTV" value={form.cctv} onChange={(v) => setField("cctv", v)} />
            <Toggle label="Alarm" value={form.alarm} onChange={(v) => setField("alarm", v)} />
            <Toggle label="Secure parking" value={form.secure_parking} onChange={(v) => setField("secure_parking", v)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(4)} className="flex-1">Continue</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Step 4: Rules & nearby */}
      {step === 4 && (
        <Card className="border-border"><CardContent className="p-5 space-y-4">
          <h2 className="font-semibold font-heading">Rules &amp; nearby</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Toggle label="Pets allowed" value={form.pets_allowed} onChange={(v) => setField("pets_allowed", v)} />
            <Toggle label="Smoking allowed" value={form.smoking_allowed} onChange={(v) => setField("smoking_allowed", v)} />
            <Toggle label="Visitors allowed" value={form.visitors_allowed} onChange={(v) => setField("visitors_allowed", v)} />
            <Toggle label="Children allowed" value={form.children_allowed} onChange={(v) => setField("children_allowed", v)} />
            <Toggle label="Subletting allowed" value={form.subletting_allowed} onChange={(v) => setField("subletting_allowed", v)} />
          </div>
          <div>
            <Label>Nearby landmarks</Label>
            <Input value={form.nearby_landmarks} onChange={(e) => setField("nearby_landmarks", e.target.value)} className="mt-1.5" placeholder="e.g. Sam Levy Village" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nearby transport</Label><Input value={form.nearby_transport} onChange={(e) => setField("nearby_transport", e.target.value)} className="mt-1.5" /></div>
            <div><Label>Nearby schools</Label><Input value={form.nearby_schools} onChange={(e) => setField("nearby_schools", e.target.value)} className="mt-1.5" /></div>
            <div><Label>Nearby shopping</Label><Input value={form.nearby_shopping} onChange={(e) => setField("nearby_shopping", e.target.value)} className="mt-1.5" /></div>
            <div><Label>Nearby hospitals</Label><Input value={form.nearby_hospitals} onChange={(e) => setField("nearby_hospitals", e.target.value)} className="mt-1.5" /></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(5)} className="flex-1">Continue</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Step 5: Pricing */}
      {step === 5 && (
        <Card className="border-border"><CardContent className="p-5 space-y-4">
          <h2 className="font-semibold font-heading">Pricing &amp; availability</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Monthly rent (USD)</Label><Input type="number" min="0" value={form.monthly_rent} onChange={(e) => setField("monthly_rent", Number(e.target.value))} className="mt-1.5" /></div>
            <div><Label>Security deposit (USD)</Label><Input type="number" min="0" value={form.security_deposit} onChange={(e) => setField("security_deposit", Number(e.target.value))} className="mt-1.5" /></div>
            <div><Label>Reservation fee (USD)</Label><Input type="number" min="0" value={form.reservation_fee} onChange={(e) => setField("reservation_fee", Number(e.target.value))} className="mt-1.5" /></div>
            <div><Label>Available from</Label><Input type="date" value={form.available_from} onChange={(e) => setField("available_from", e.target.value)} className="mt-1.5" /></div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} className="mt-1.5" rows={4} placeholder="Describe what makes this property special..." />
          </div>
          <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
            Your listing will be submitted for verification. Once approved by our team, it will appear on the marketplace.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(4)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(6)} className="flex-1">Review &amp; publish</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Step 6: Preview & authority verification */}
      {step === 6 && (
        <div className="space-y-4">
          <Card className="border-border"><CardContent className="p-5">
            <h2 className="font-semibold font-heading flex items-center gap-2 mb-4"><Eye className="w-5 h-5 text-primary" /> Preview your listing</h2>
            {form.photos.length > 0 ? (
              <div className="aspect-[16/9] rounded-xl overflow-hidden mb-3">
                <Image src={form.photos[0]} alt={form.title} className="w-full h-full" fittingType="fill" />
              </div>
            ) : (
              <div className="aspect-[16/9] rounded-xl bg-muted flex items-center justify-center mb-3">
                <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
              </div>
            )}
            <h3 className="font-semibold font-heading">{form.title || "Untitled property"}</h3>
            <p className="text-sm text-muted-foreground">{form.suburb}, {form.city} · {PROPERTY_TYPES[form.property_type]}</p>
            <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
              <span>{form.bedrooms} bed</span><span>{form.bathrooms} bath</span>
              {form.furnished && <span>Furnished</span>}{form.walled && <span>Walled</span>}{form.gated && <span>Gated</span>}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <span className="text-2xl font-bold font-heading text-primary">{formatCurrency(form.monthly_rent, form.currency)}<span className="text-sm font-normal text-muted-foreground">/month</span></span>
              <span className="text-xs text-muted-foreground">Deposit: {formatCurrency(form.security_deposit, form.currency)}</span>
            </div>
            {form.description && <p className="text-sm text-muted-foreground mt-3">{form.description}</p>}
          </CardContent></Card>

          {/* Authority verification */}
          <Card className="border-border"><CardContent className="p-5 space-y-3">
            <h2 className="font-semibold font-heading flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Authority to list</h2>
            <p className="text-sm text-muted-foreground">Verify your authority to rent this property (ownership or agent mandate). This builds trust and is reviewed by our team.</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.authority_acknowledged} onChange={(e) => setField("authority_acknowledged", e.target.checked)} className="rounded" />
              I confirm I have the legal right to list this property for rent
            </label>
            <div>
              <Label className="flex items-center gap-1.5"><FileCheck className="w-4 h-4" /> Upload evidence document (optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Title deed, lease agreement, or agent mandate. Stored privately — only you and admins can access it.</p>
              <input
                type="file" accept=".pdf,.jpg,.jpeg,.png"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer"
                onChange={(e) => e.target.files?.[0] && handleAuthorityUpload(e.target.files[0])}
              />
              {uploadingAuth && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
              {form.authority_document_uri && <p className="text-xs text-success mt-1">✓ Document uploaded</p>}
            </div>
          </CardContent></Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(5)} className="flex-1">Back</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing...</> : "Submit for verification"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-colors ${value ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
      {label}
      <div className={`w-9 h-5 rounded-full relative transition-colors ${value ? "bg-primary" : "bg-muted-foreground/20"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
    </button>
  );
}